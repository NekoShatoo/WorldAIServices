import { DISCORD_COMMANDS } from "./discordCommands.js";
import { buildTranslationMessages, buildTranslationPromptText, TRANSLATION_PROMPT_VERSION } from "./translationPrompt.js";

const JSON_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "content-type,x-signature-ed25519,x-signature-timestamp",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "cache-control": "no-store",
  "content-type": "application/json; charset=UTF-8",
};

const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  requestsPerMinute: 6,
  maxChars: 300,
  cacheTtlSeconds: 60 * 60 * 24 * 180,
  errorRetentionSeconds: 60 * 60 * 24 * 14,
});

const MAINTENANCE_BATCH_SIZE = 500;
const DISCORD_MESSAGE_FLAGS_EPHEMERAL = 1 << 6;
const DISCORD_INTERACTION_TYPE_PING = 1;
const DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND = 2;
const DISCORD_INTERACTION_RESPONSE_PONG = 1;
const DISCORD_INTERACTION_RESPONSE_CHANNEL_MESSAGE = 4;

let discordVerifyKeyPromise = null;
let discordVerifyKeySource = "";

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: JSON_HEADERS });

    ctx.waitUntil(runDatabaseMaintenance(env));

    try {
      return await routeRequest(request, env, ctx);
    } catch (error) {
      const entry = createErrorEntry("critical", "UNHANDLED_EXCEPTION", "未処理例外が発生しました。", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack ?? "" : "",
        method: request.method,
        path: new URL(request.url).pathname,
      });

      ctx.waitUntil(recordError(env, entry));
      ctx.waitUntil(notifyCriticalError(env, entry));

      return jsonResponse({ status: "error", result: "Server error" }, 500);
    }
  },
};

export class TranslationCoordinator {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.inFlight = null;
  }

  async fetch(request) {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ ok: false, publicReason: "Invalid coordinator payload" }, 400);
    }

    if (payload?.action !== "translate")
      return jsonResponse({ ok: false, publicReason: "Invalid coordinator action" }, 400);

    if (this.inFlight === null)
      this.inFlight = this.runTranslation(payload);

    try {
      const result = await this.inFlight;
      return jsonResponse(result, result.statusCode ?? 200);
    } finally {
      this.inFlight = null;
    }
  }

  async runTranslation(payload) {
    if (payload.useCache) {
      const cached = await getCachedTranslation(this.env, payload.cacheKey);
      if (cached !== null) {
        return {
          ok: true,
          statusCode: 200,
          source: "cache",
          latencyMs: 0,
          result: cached,
        };
      }
    }

    const aiResult = await requestAiTranslation(this.env, payload.lang, payload.text, {
      source: payload.requestSource,
      promptVersion: payload.promptVersion,
    });
    if (!aiResult.ok) {
      return {
        ok: false,
        statusCode: 502,
        source: "ai",
        latencyMs: aiResult.latencyMs,
        publicReason: aiResult.publicReason,
        reason: aiResult.reason,
      };
    }

    if (payload.writeCache) {
      await putCachedTranslation(
        this.env,
        payload.cacheKey,
        payload.lang,
        payload.promptVersion,
        aiResult.result,
        payload.cacheTtlSeconds,
      );
    }

    return {
      ok: true,
      statusCode: 200,
      source: "ai",
      latencyMs: aiResult.latencyMs,
      result: aiResult.result,
    };
  }
}

async function routeRequest(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname === "/" || url.pathname === "/health")
    return handleHealth(env);

  if (url.pathname === "/trans") {
    if (request.method !== "GET")
      return jsonResponse({ status: "error", result: "Invalid method" }, 405);

    return handleTranslate(request, env, ctx, url);
  }

  if (url.pathname === "/discord/interactions") {
    if (request.method !== "POST")
      return jsonResponse({ status: "error", result: "Invalid method" }, 405);

    return handleDiscordInteractions(request, env, ctx);
  }

  if (url.pathname === "/discord/commands")
    return handleDiscordCommands(request);

  return jsonResponse({ status: "error", result: "Not found" }, 404);
}

async function handleHealth(env) {
  const config = await loadConfig(env);
  return jsonResponse({
    status: "ok",
    result: {
      enabled: config.enabled,
      requestsPerMinute: config.requestsPerMinute,
      maxChars: config.maxChars,
    },
  });
}

async function handleTranslate(request, env, ctx, url) {
  const config = await loadConfig(env);
  if (!config.enabled)
    return jsonResponse({ status: "error", result: "Server is closed" }, 503);

  const parsed = parseTranslateQuery(url);
  if (!parsed)
    return jsonResponse({ status: "error", result: "Invalid request" }, 400);

  const text = parsed.text.trim();
  if (text.length === 0)
    return jsonResponse({ status: "ok", result: "" });

  if (countCharacters(text) > config.maxChars)
    return jsonResponse({ status: "error", result: "Text too long" }, 400);

  const cacheKey = await buildCacheKey(parsed.lang, text, TRANSLATION_PROMPT_VERSION);
  const cached = await getCachedTranslation(env, cacheKey);
  if (cached !== null) {
    ctx.waitUntil(
      recordTranslationStats(env, {
        lang: parsed.lang,
        textLength: countCharacters(text),
        cacheHit: true,
        cacheMiss: false,
        aiRequest: false,
        aiSuccess: false,
        aiFailure: false,
      }),
    );

    return jsonResponse({ status: "ok", result: cached });
  }

  const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rateLimit = await checkRateLimit(env, clientIp, config.requestsPerMinute);
  if (!rateLimit.allowed)
    return jsonResponse({ status: "error", result: "Rate limit exceeded" }, 429);

  const translation = await executeTranslation(env, ctx, config, parsed.lang, text, {
    requestSource: "translate-api",
    useCache: true,
    writeCache: true,
    useSingleFlight: true,
  });
  if (!translation.ok) {
    ctx.waitUntil(recordTranslationOutcome(env, parsed.lang, countCharacters(text), translation));
    return jsonResponse({ status: "error", result: translation.publicReason }, translation.statusCode);
  }

  ctx.waitUntil(recordTranslationOutcome(env, parsed.lang, countCharacters(text), translation));

  return jsonResponse({ status: "ok", result: translation.result });
}

async function handleDiscordCommands(request) {
  if (request.method === "GET") {
    return jsonResponse({ status: "ok", result: DISCORD_COMMANDS });
  }

  return jsonResponse({ status: "error", result: "Invalid method" }, 405);
}

async function handleDiscordInteractions(request, env, ctx) {
  const rawBody = await request.text();
  const isValid = await verifyDiscordRequest(request, env, rawBody);
  if (!isValid)
    return jsonResponse({ status: "error", result: "Unauthorized" }, 401);

  let interaction;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ status: "error", result: "Invalid JSON" }, 400);
  }

  if (interaction.type === DISCORD_INTERACTION_TYPE_PING)
    return jsonResponse({ type: DISCORD_INTERACTION_RESPONSE_PONG });

  if (interaction.type !== DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND) {
    return discordMessageResponse("未対応の Interaction 種別です。", true);
  }

  try {
    return await handleDiscordApplicationCommand(interaction, env, ctx);
  } catch (error) {
    const entry = createErrorEntry(
      "critical",
      "DISCORD_COMMAND_FAILED",
      "Discord コマンド処理中に未処理例外が発生しました。",
      {
        commandName: interaction?.data?.name ?? "",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack ?? "" : "",
      },
    );

    ctx.waitUntil(recordError(env, entry));
    ctx.waitUntil(notifyCriticalError(env, entry));

    return discordMessageResponse("サーバーエラーが発生しました。", true);
  }
}

async function handleDiscordApplicationCommand(interaction, env, ctx) {
  const commandName = interaction?.data?.name ?? "";
  const options = flattenDiscordOptions(interaction?.data?.options ?? []);

  if (commandName === "help") {
    ctx.waitUntil(autoHealDiscordCommandsOnHelp(env, interaction));
    return discordMessageResponse(buildDiscordHelpMessage(), false);
  }

  if (commandName === "status") {
    const config = await loadConfig(env);
    return discordMessageResponse(buildDiscordStatusMessage(config), false);
  }

  if (!isDiscordAdmin(interaction, env))
    return discordMessageResponse("このコマンドを実行する権限がありません。", false);

  if (commandName === "service") {
    const action = String(options.action ?? "");
    if (action !== "on" && action !== "off")
      return discordMessageResponse("action は on または off を指定してください。", false);

    const next = await updateConfig(env, { enabled: action === "on" });
    return discordMessageResponse(
      `翻訳サービスを ${next.enabled ? "起動" : "停止"} に変更しました。`,
      false,
    );
  }

  if (commandName === "limit") {
    const current = await loadConfig(env);
    const value = clampInteger(Number(options.requests_per_minute), 1, 60, current.requestsPerMinute);
    await updateConfig(env, { requestsPerMinute: value });
    return discordMessageResponse(`1 分あたりの上限を ${value} 回に変更しました。`, false);
  }

  if (commandName === "maxchars") {
    const current = await loadConfig(env);
    const value = clampInteger(Number(options.value), 1, 1000, current.maxChars);
    await updateConfig(env, { maxChars: value });
    return discordMessageResponse(`最大文字数を ${value} に変更しました。`, false);
  }

  if (commandName === "errors") {
    const limit = clampInteger(Number(options.limit), 1, 10, 5);
    const errors = await listRecentErrors(env, limit);
    return discordMessageResponse(buildDiscordErrorsMessage(errors), false);
  }

  if (commandName === "llmrequests") {
    const limit = clampInteger(Number(options.limit), 1, 10, 5);
    const requests = await listRecentLlmRequests(env, limit);
    return discordMessageResponse(buildDiscordLlmRequestsMessage(requests), false);
  }

  if (commandName === "ping") {
    const pingResult = await requestAiTranslation(env, "en_US", "ping", {
      source: "discord-ping",
      promptVersion: TRANSLATION_PROMPT_VERSION,
    });
    return discordMessageResponse(buildDiscordPingMessage(pingResult), false);
  }

  if (commandName === "simulate") {
    const config = await loadConfig(env);
    if (!config.enabled)
      return discordMessageResponse("Server is closed", false);

    const lang = String(options.lang ?? "").trim();
    const text = String(options.text ?? "").trim();
    if (lang.length === 0)
      return discordMessageResponse("lang を指定してください。", false);

    if (text.length === 0)
      return discordMessageResponse("text を指定してください。", false);

    if (countCharacters(text) > config.maxChars)
      return discordMessageResponse("Text too long", false);

    const result = await executeTranslation(env, ctx, config, lang, text, {
      requestSource: "discord-simulate",
      useCache: true,
      writeCache: true,
      useSingleFlight: true,
    });
    return discordMessageResponse(buildDiscordSimulationMessage(result), false);
  }

  if (commandName === "resetcache") {
    const userId = interaction?.member?.user?.id ?? interaction?.user?.id ?? "";
    ctx.waitUntil(
      resetTranslationCache(env, userId),
    );
    return discordMessageResponse("translation_cache のレコード削除を開始しました。", false);
  }

  if (commandName === "stats") {
    const stats = await loadTranslationStatsSummary(env);
    return discordMessageResponse(buildDiscordStatsMessage(stats), false);
  }

  return discordMessageResponse("未対応のコマンドです。", false);
}

async function autoHealDiscordCommandsOnHelp(env, interaction) {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_APPLICATION_ID)
    return;

  try {
    const configuredGuildId = String(env.DISCORD_GUILD_ID ?? "").trim();
    const interactionGuildId = String(interaction?.guild_id ?? "").trim();

    if (configuredGuildId.length > 0 && interactionGuildId === configuredGuildId) {
      await syncDiscordCommandScope(env, configuredGuildId, DISCORD_COMMANDS);
      await syncDiscordCommandScope(env, "", []);
      return;
    }

    if (configuredGuildId.length === 0)
      await syncDiscordCommandScope(env, "", DISCORD_COMMANDS);
  } catch (error) {
    await recordError(
      env,
      createErrorEntry(
        "error",
        "DISCORD_COMMAND_AUTO_HEAL_FAILED",
        "Discord command 自動修復に失敗しました。",
        {
          message: error instanceof Error ? error.message : String(error),
          guildId: interaction?.guild_id ?? "",
        },
      ),
    );
  }
}

async function syncDiscordCommandScope(env, guildId, desiredCommands) {
  const endpoint = buildDiscordCommandEndpoint(env.DISCORD_APPLICATION_ID, guildId);
  const currentCommands = await fetchDiscordCommandDefinitions(env.DISCORD_BOT_TOKEN, endpoint);
  if (areDiscordCommandsEquivalent(currentCommands, desiredCommands))
    return false;

  await putDiscordCommandDefinitions(env.DISCORD_BOT_TOKEN, endpoint, desiredCommands);
  return true;
}

function buildDiscordCommandEndpoint(applicationId, guildId) {
  if (guildId && guildId.length > 0)
    return `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;

  return `https://discord.com/api/v10/applications/${applicationId}/commands`;
}

async function fetchDiscordCommandDefinitions(botToken, endpoint) {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      authorization: `Bot ${botToken}`,
    },
  });

  if (!response.ok)
    throw new Error(`discord_get_commands_${response.status}`);

  return await response.json();
}

async function putDiscordCommandDefinitions(botToken, endpoint, commands) {
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      authorization: `Bot ${botToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok)
    throw new Error(`discord_put_commands_${response.status}`);
}

function areDiscordCommandsEquivalent(currentCommands, desiredCommands) {
  return JSON.stringify(normalizeDiscordCommands(currentCommands)) ===
    JSON.stringify(normalizeDiscordCommands(desiredCommands));
}

function normalizeDiscordCommands(commands) {
  if (!Array.isArray(commands))
    return [];

  return commands
    .map((command) => normalizeDiscordCommand(command))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeDiscordCommand(command) {
  return {
    name: String(command?.name ?? ""),
    description: String(command?.description ?? ""),
    type: safeMetricNumber(command?.type),
    options: normalizeDiscordOptions(command?.options),
  };
}

function normalizeDiscordOptions(options) {
  if (!Array.isArray(options))
    return [];

  return options
    .map((option) => ({
      type: safeMetricNumber(option?.type),
      name: String(option?.name ?? ""),
      description: String(option?.description ?? ""),
      required: Boolean(option?.required),
      min_value: normalizeOptionalNumber(option?.min_value),
      max_value: normalizeOptionalNumber(option?.max_value),
      min_length: normalizeOptionalNumber(option?.min_length),
      max_length: normalizeOptionalNumber(option?.max_length),
      choices: normalizeDiscordChoices(option?.choices),
      options: normalizeDiscordOptions(option?.options),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeDiscordChoices(choices) {
  if (!Array.isArray(choices))
    return [];

  return choices
    .map((choice) => ({
      name: String(choice?.name ?? ""),
      value: choice?.value ?? "",
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeOptionalNumber(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

async function verifyDiscordRequest(request, env, rawBody) {
  if (!env.DISCORD_PUBLIC_KEY)
    return false;

  const signatureHex = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!signatureHex || !timestamp)
    return false;

  const publicKey = await getDiscordVerifyKey(env.DISCORD_PUBLIC_KEY);
  const messageBytes = new TextEncoder().encode(`${timestamp}${rawBody}`);
  const signatureBytes = hexToUint8Array(signatureHex);
  if (signatureBytes === null)
    return false;

  return crypto.subtle.verify("Ed25519", publicKey, signatureBytes, messageBytes);
}

async function getDiscordVerifyKey(publicKeyHex) {
  const keyBytes = hexToUint8Array(publicKeyHex);
  if (keyBytes === null)
    throw new Error("DISCORD_PUBLIC_KEY が不正な 16 進文字列です。");

  if (!discordVerifyKeyPromise || discordVerifyKeySource !== publicKeyHex) {
    discordVerifyKeySource = publicKeyHex;
    discordVerifyKeyPromise = crypto.subtle.importKey(
      "raw",
      keyBytes,
      "Ed25519",
      false,
      ["verify"],
    );
  }

  return discordVerifyKeyPromise;
}

function hexToUint8Array(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0)
    return null;

  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized))
    return null;

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2)
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);

  return bytes;
}

function flattenDiscordOptions(options) {
  const result = {};
  for (const option of options) {
    if (option && Array.isArray(option.options)) {
      const nested = flattenDiscordOptions(option.options);
      Object.assign(result, nested);
      continue;
    }

    if (option && typeof option.name === "string")
      result[option.name] = option.value;
  }

  return result;
}

function isDiscordAdmin(interaction, env) {
  const adminIds = String(env.DISCORD_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (adminIds.length === 0)
    return false;

  const userId = interaction?.member?.user?.id ?? interaction?.user?.id ?? "";
  return adminIds.includes(userId);
}

function buildDiscordHelpMessage() {
  return [
    "利用可能なコマンド:",
    "/help - この一覧を表示します。",
    "/status - 現在のサービス状態を表示します。",
    "/service action:on|off - サービスの起動状態を切り替えます。",
    "/limit requests_per_minute:<1-60> - IP ごとの 1 分上限を変更します。",
    "/maxchars value:<1-1000> - 1 件の最大文字数を変更します。",
    "/errors [limit] - 最近のエラーログを表示します。",
    "/llmrequests [limit] - 最近の LLM リクエスト記録を表示します。",
    "/ping - AI 上流APIへの疎通と遅延を表示します。",
    "/simulate lang:<code> text:<本文> - 翻訳API処理を手動で疑似実行します。",
    "/resetcache - translation_cache のレコードを全削除します。",
    "/stats - 当日と当月の翻訳統計を表示します。",
  ].join("\n");
}

function buildDiscordStatusMessage(config) {
  return [
    "現在設定:",
    `enabled: ${config.enabled}`,
    `requestsPerMinute: ${config.requestsPerMinute}`,
    `maxChars: ${config.maxChars}`,
    `cacheTtlSeconds: ${config.cacheTtlSeconds}`,
  ].join("\n");
}

function buildDiscordErrorsMessage(errors) {
  if (errors.length === 0)
    return "最近のエラーログはありません。";

  const lines = ["最近のエラー:"];
  for (const item of errors) {
    const reason = sanitizeDiscordLine(item?.details?.reason ?? "");
    const code = sanitizeDiscordLine(item?.code ?? "");
    const timestamp = sanitizeDiscordLine(item?.occurredAt ?? "");
    lines.push(`${timestamp} ${code} ${reason}`.trim());
  }

  return truncateDiscordMessage(lines.join("\n"));
}

function buildDiscordStatsMessage(summary) {
  return truncateDiscordMessage(
    [
      "翻訳統計:",
      formatStatsBlock("当日", summary.day),
      formatStatsBlock("当月", summary.month),
    ].join("\n\n"),
  );
}

function buildDiscordLlmRequestsMessage(requests) {
  if (requests.length === 0)
    return "最近の LLM リクエスト記録はありません。";

  const lines = ["最近の LLM リクエスト:"];
  for (const item of requests) {
    const timestamp = sanitizeDiscordLine(item.occurredAt);
    const source = sanitizeDiscordLine(item.source);
    const providerMode = sanitizeDiscordLine(item.providerMode);
    const lang = sanitizeDiscordLine(item.lang);
    const status = sanitizeDiscordLine(item.status);
    const reason = sanitizeDiscordLine(item.publicReason);
    const inputPreview = sanitizeDiscordLine(item.inputPreview);
    const outputPreview = sanitizeDiscordLine(item.outputPreview);

    lines.push(
      [
        `${timestamp} ${source} ${providerMode}`.trim(),
        `status:${status} lang:${lang} chars:${item.inputChars} promptVersion:${item.promptVersion} latencyMs:${item.latencyMs}`,
        reason.length > 0 ? `reason:${reason}` : "",
        inputPreview.length > 0 ? `input:${inputPreview}` : "",
        outputPreview.length > 0 ? `output:${outputPreview}` : "",
      ].filter((line) => line.length > 0).join("\n"),
    );
  }

  return truncateDiscordMessage(lines.join("\n\n"));
}

function buildDiscordPingMessage(result) {
  if (!result.ok) {
    return [
      "AI ping:",
      "status: error",
      `latencyMs: ${result.latencyMs}`,
      `reason: ${result.publicReason}`,
    ].join("\n");
  }

  return [
    "AI ping:",
    "status: ok",
    `latencyMs: ${result.latencyMs}`,
    `preview: ${sanitizeDiscordLine(result.result).slice(0, 120) || "(empty)"}`,
  ].join("\n");
}

function buildDiscordSimulationMessage(result) {
  if (!result.ok) {
    return [
      "simulate:",
      "status: error",
      `source: ${result.source}`,
      `latencyMs: ${result.latencyMs}`,
      `reason: ${result.publicReason}`,
    ].join("\n");
  }

  return truncateDiscordMessage(
    [
      "simulate:",
      "status: ok",
      `source: ${result.source}`,
      `latencyMs: ${result.latencyMs}`,
      `result: ${result.result}`,
    ].join("\n"),
  );
}

function formatStatsBlock(label, record) {
  const averageLength =
    record.requestsTotal > 0 ? (record.totalInputChars / record.requestsTotal).toFixed(1) : "0.0";
  const cacheHitRate =
    record.requestsTotal > 0 ? ((record.cacheHits / record.requestsTotal) * 100).toFixed(1) : "0.0";

  return [
    `${label} (${record.periodKey})`,
    `requests: ${record.requestsTotal}`,
    `avgLength: ${averageLength}`,
    `cacheHits: ${record.cacheHits}`,
    `cacheMisses: ${record.cacheMisses}`,
    `cacheHitRate: ${cacheHitRate}%`,
    `aiSuccesses: ${record.aiSuccesses}`,
    `aiFailures: ${record.aiFailures}`,
    `languages: ${formatLanguageCounts(record.languages)}`,
  ].join("\n");
}

function formatLanguageCounts(languages) {
  const entries = Object.entries(languages);
  if (entries.length === 0)
    return "none";

  return entries
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map((item) => `${item[0]}:${item[1]}`)
    .join(", ");
}

function sanitizeDiscordLine(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function truncateDiscordMessage(content) {
  if (content.length <= 1900)
    return content;

  return `${content.slice(0, 1897)}...`;
}

function discordMessageResponse(content, ephemeral) {
  return jsonResponse({
    type: DISCORD_INTERACTION_RESPONSE_CHANNEL_MESSAGE,
    data: {
      content: truncateDiscordMessage(content),
      flags: ephemeral ? DISCORD_MESSAGE_FLAGS_EPHEMERAL : 0,
    },
  });
}

function buildDiscordAlertMessage(entry) {
  const summary = [
    "重大エラーを検出しました。",
    `code: ${sanitizeDiscordLine(entry.code ?? "")}`,
    `time: ${sanitizeDiscordLine(entry.occurredAt ?? "")}`,
  ];

  const reason = sanitizeDiscordLine(entry?.details?.message ?? entry?.message ?? "");
  if (reason.length > 0)
    summary.push(`reason: ${reason}`);

  return truncateDiscordMessage(summary.join("\n"));
}

async function updateConfig(env, partialConfig) {
  const current = await loadConfig(env);
  const next = {
    ...current,
    ...partialConfig,
  };

  await upsertConfig(env, next);
  return next;
}

async function executeTranslation(env, ctx, config, lang, text, options) {
  if (options.useSingleFlight) {
    return requestTranslationThroughCoordinator(env, {
      cacheKey: await buildCacheKey(lang, text, TRANSLATION_PROMPT_VERSION),
      cacheTtlSeconds: config.cacheTtlSeconds,
      lang,
      promptVersion: TRANSLATION_PROMPT_VERSION,
      requestSource: options.requestSource,
      text,
      useCache: options.useCache,
      writeCache: options.writeCache,
    });
  }

  const startedAt = Date.now();
  const textLength = countCharacters(text);
  const cacheKey = await buildCacheKey(lang, text, TRANSLATION_PROMPT_VERSION);

  if (options.useCache) {
    const cached = await getCachedTranslation(env, cacheKey);
    if (cached !== null) {
      if (options.recordStats) {
        ctx.waitUntil(
          recordTranslationStats(env, {
            lang,
            textLength,
            cacheHit: true,
            cacheMiss: false,
            aiRequest: false,
            aiSuccess: false,
            aiFailure: false,
          }),
        );
      }

      return {
        ok: true,
        statusCode: 200,
        source: "cache",
        latencyMs: Date.now() - startedAt,
        result: cached,
      };
    }
  }

  const aiResult = await requestAiTranslation(env, lang, text, {
    source: options.requestSource,
    promptVersion: TRANSLATION_PROMPT_VERSION,
  });
  if (!aiResult.ok) {
    if (options.recordStats) {
      ctx.waitUntil(
        recordTranslationStats(env, {
          lang,
          textLength,
          cacheHit: false,
          cacheMiss: true,
          aiRequest: true,
          aiSuccess: false,
          aiFailure: true,
        }),
      );
    }

    ctx.waitUntil(
      recordError(
        env,
        createErrorEntry("error", "AI_REQUEST_FAILED", "翻訳AIへのリクエストに失敗しました。", {
          reason: aiResult.reason,
          publicReason: aiResult.publicReason,
          lang,
          textLength,
        }),
      ),
    );

    return {
      ok: false,
      statusCode: 502,
      source: "ai",
      latencyMs: aiResult.latencyMs,
      publicReason: aiResult.publicReason,
      reason: aiResult.reason,
    };
  }

  if (options.writeCache) {
    await putCachedTranslation(
      env,
      cacheKey,
      lang,
      TRANSLATION_PROMPT_VERSION,
      aiResult.result,
      config.cacheTtlSeconds,
    );
  }

  if (options.recordStats) {
    ctx.waitUntil(
      recordTranslationStats(env, {
        lang,
        textLength,
        cacheHit: false,
        cacheMiss: true,
        aiRequest: true,
        aiSuccess: true,
        aiFailure: false,
      }),
    );
  }

  return {
    ok: true,
    statusCode: 200,
    source: "ai",
    latencyMs: aiResult.latencyMs,
    result: aiResult.result,
  };
}

async function requestTranslationThroughCoordinator(env, payload) {
  const id = env.TRANSLATION_COORDINATOR.idFromName(payload.cacheKey);
  const stub = env.TRANSLATION_COORDINATOR.get(id);
  const response = await stub.fetch("https://translation-coordinator/translate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "translate",
      ...payload,
    }),
  });

  return await response.json();
}

async function recordTranslationOutcome(env, lang, textLength, translation) {
  await recordTranslationStats(env, {
    lang,
    textLength,
    cacheHit: translation.ok && translation.source === "cache",
    cacheMiss: !translation.ok || translation.source === "ai",
    aiRequest: !translation.ok || translation.source === "ai",
    aiSuccess: translation.ok && translation.source === "ai",
    aiFailure: !translation.ok,
  });
}

async function resetTranslationCache(env, triggeredByUserId) {
  const db = getDatabase(env);
  const countRow = await db.prepare("SELECT COUNT(*) AS count FROM translation_cache").first();
  const deletedCount = safeMetricNumber(countRow?.count);
  await db.prepare("DELETE FROM translation_cache").run();

  await recordError(
    env,
    createErrorEntry("info", "CACHE_RESET_COMPLETED", "translation_cache のレコードを全削除しました。", {
      deletedCount,
      triggeredByUserId,
    }),
  );
}

async function recordTranslationStats(env, metric) {
  const keys = buildStatsKeys();
  const updatedAt = new Date().toISOString();
  const db = getDatabase(env);

  await db.batch([
    buildStatsUpsertStatement(db, "day", keys.dayKey, metric, updatedAt),
    buildStatsUpsertStatement(db, "month", keys.monthKey, metric, updatedAt),
  ]);
}

function buildStatsUpsertStatement(db, periodType, periodKey, metric, updatedAt) {
  return db.prepare(
    `INSERT INTO translation_stats (
      period_type,
      period_key,
      lang,
      requests_total,
      total_input_chars,
      cache_hits,
      cache_misses,
      ai_requests,
      ai_successes,
      ai_failures,
      updated_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(period_type, period_key, lang) DO UPDATE SET
      requests_total = translation_stats.requests_total + 1,
      total_input_chars = translation_stats.total_input_chars + excluded.total_input_chars,
      cache_hits = translation_stats.cache_hits + excluded.cache_hits,
      cache_misses = translation_stats.cache_misses + excluded.cache_misses,
      ai_requests = translation_stats.ai_requests + excluded.ai_requests,
      ai_successes = translation_stats.ai_successes + excluded.ai_successes,
      ai_failures = translation_stats.ai_failures + excluded.ai_failures,
      updated_at = excluded.updated_at`,
  ).bind(
    periodType,
    periodKey,
    metric.lang,
    metric.textLength,
    metric.cacheHit ? 1 : 0,
    metric.cacheMiss ? 1 : 0,
    metric.aiRequest ? 1 : 0,
    metric.aiSuccess ? 1 : 0,
    metric.aiFailure ? 1 : 0,
    updatedAt,
  );
}

async function loadTranslationStatsSummary(env) {
  const keys = buildStatsKeys();
  const [dayRows, monthRows] = await Promise.all([
    loadStatsRows(env, "day", keys.dayKey),
    loadStatsRows(env, "month", keys.monthKey),
  ]);

  return {
    day: normalizeStatsRecord(dayRows, "day", keys.dayKey),
    month: normalizeStatsRecord(monthRows, "month", keys.monthKey),
  };
}

function buildStatsKeys() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = String(now.getUTCFullYear()).padStart(4, "0");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");

  return {
    dayKey: `${year}-${month}-${day}`,
    monthKey: `${year}-${month}`,
  };
}

async function loadStatsRows(env, periodType, periodKey) {
  const db = getDatabase(env);
  const result = await db.prepare(
    `SELECT
      lang,
      requests_total,
      total_input_chars,
      cache_hits,
      cache_misses,
      ai_requests,
      ai_successes,
      ai_failures,
      updated_at
    FROM translation_stats
    WHERE period_type = ? AND period_key = ?`,
  ).bind(periodType, periodKey).run();

  return getQueryRows(result);
}

function normalizeStatsRecord(rows, period, periodKey) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const languages = {};
  let updatedAt = "";
  let requestsTotal = 0;
  let totalInputChars = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let aiRequests = 0;
  let aiSuccesses = 0;
  let aiFailures = 0;

  for (const row of sourceRows) {
    const lang = typeof row?.lang === "string" ? row.lang : "";
    const langRequests = safeMetricNumber(row?.requests_total);
    const langChars = safeMetricNumber(row?.total_input_chars);
    const langCacheHits = safeMetricNumber(row?.cache_hits);
    const langCacheMisses = safeMetricNumber(row?.cache_misses);
    const langAiRequests = safeMetricNumber(row?.ai_requests);
    const langAiSuccesses = safeMetricNumber(row?.ai_successes);
    const langAiFailures = safeMetricNumber(row?.ai_failures);

    if (lang.length > 0 && langRequests > 0)
      languages[lang] = (languages[lang] ?? 0) + langRequests;

    requestsTotal += langRequests;
    totalInputChars += langChars;
    cacheHits += langCacheHits;
    cacheMisses += langCacheMisses;
    aiRequests += langAiRequests;
    aiSuccesses += langAiSuccesses;
    aiFailures += langAiFailures;

    if (typeof row?.updated_at === "string" && row.updated_at > updatedAt)
      updatedAt = row.updated_at;
  }

  return {
    period,
    periodKey,
    requestsTotal,
    totalInputChars,
    cacheHits,
    cacheMisses,
    aiRequests,
    aiSuccesses,
    aiFailures,
    languages: normalizeLanguageCounts(languages),
    updatedAt,
  };
}

function normalizeLanguageCounts(languages) {
  const result = {};
  for (const [key, value] of Object.entries(languages)) {
    const count = safeMetricNumber(value);
    if (count > 0)
      result[key] = count;
  }

  return result;
}

function safeMetricNumber(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

async function loadConfig(env) {
  const db = getDatabase(env);
  const stored = await db.prepare(
    `SELECT
      enabled,
      requests_per_minute AS requestsPerMinute,
      max_chars AS maxChars,
      cache_ttl_seconds AS cacheTtlSeconds,
      error_retention_seconds AS errorRetentionSeconds
    FROM service_config
    WHERE config_id = 1`,
  ).first();

  if (!stored || typeof stored !== "object")
    return { ...DEFAULT_CONFIG };

  return {
    ...DEFAULT_CONFIG,
    enabled: normalizeBooleanFlag(stored.enabled, DEFAULT_CONFIG.enabled),
    requestsPerMinute: clampInteger(Number(stored.requestsPerMinute), 1, 60, 6),
    maxChars: clampInteger(Number(stored.maxChars), 1, 1000, 300),
    cacheTtlSeconds: clampInteger(
      Number(stored.cacheTtlSeconds),
      60,
      60 * 60 * 24 * 365,
      DEFAULT_CONFIG.cacheTtlSeconds,
    ),
    errorRetentionSeconds: clampInteger(
      Number(stored.errorRetentionSeconds),
      60,
      60 * 60 * 24 * 365,
      DEFAULT_CONFIG.errorRetentionSeconds,
    ),
  };
}

function getDatabase(env) {
  if (!env.STATE_DB)
    throw new Error("STATE_DB binding is not configured.");

  return env.STATE_DB;
}

function getQueryRows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function normalizeBooleanFlag(value, fallback) {
  if (typeof value === "boolean")
    return value;

  if (value === 1 || value === "1")
    return true;

  if (value === 0 || value === "0")
    return false;

  return fallback;
}

async function upsertConfig(env, config) {
  await getDatabase(env).prepare(
    `INSERT INTO service_config (
      config_id,
      enabled,
      requests_per_minute,
      max_chars,
      cache_ttl_seconds,
      error_retention_seconds,
      updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(config_id) DO UPDATE SET
      enabled = excluded.enabled,
      requests_per_minute = excluded.requests_per_minute,
      max_chars = excluded.max_chars,
      cache_ttl_seconds = excluded.cache_ttl_seconds,
      error_retention_seconds = excluded.error_retention_seconds,
      updated_at = excluded.updated_at`,
  ).bind(
    config.enabled ? 1 : 0,
    config.requestsPerMinute,
    config.maxChars,
    config.cacheTtlSeconds,
    config.errorRetentionSeconds,
    new Date().toISOString(),
  ).run();
}

async function getCachedTranslation(env, cacheKey) {
  const row = await getDatabase(env).prepare(
    `SELECT result
    FROM translation_cache
    WHERE cache_key = ? AND expires_at > ?`,
  ).bind(cacheKey, Date.now()).first();

  if (!row || typeof row.result !== "string")
    return null;

  return row.result;
}

async function putCachedTranslation(env, cacheKey, lang, promptVersion, result, ttlSeconds) {
  const now = Date.now();
  await getDatabase(env).prepare(
    `INSERT INTO translation_cache (
      cache_key,
      lang,
      prompt_version,
      result,
      expires_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      lang = excluded.lang,
      prompt_version = excluded.prompt_version,
      result = excluded.result,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at`,
  ).bind(
    cacheKey,
    lang,
    promptVersion,
    result,
    now + ttlSeconds * 1000,
    new Date(now).toISOString(),
  ).run();
}

async function runDatabaseMaintenance(env) {
  const now = Date.now();
  const db = getDatabase(env);
  await db.batch([
    db.prepare(
      "DELETE FROM translation_cache WHERE cache_key IN (SELECT cache_key FROM translation_cache WHERE expires_at <= ? LIMIT ?)",
    ).bind(now, MAINTENANCE_BATCH_SIZE),
    db.prepare(
      "DELETE FROM rate_limits WHERE window_key IN (SELECT window_key FROM rate_limits WHERE expires_at <= ? LIMIT ?)",
    ).bind(now, MAINTENANCE_BATCH_SIZE),
    db.prepare(
      "DELETE FROM error_logs WHERE error_id IN (SELECT error_id FROM error_logs WHERE expires_at <= ? LIMIT ?)",
    ).bind(now, MAINTENANCE_BATCH_SIZE),
    db.prepare(
      "DELETE FROM llm_request_logs WHERE request_id IN (SELECT request_id FROM llm_request_logs WHERE expires_at <= ? LIMIT ?)",
    ).bind(now, MAINTENANCE_BATCH_SIZE),
  ]);
}

function parseTranslateQuery(url) {
  const entries = Array.from(url.searchParams.entries());
  if (entries.length === 0)
    return null;

  const firstEntry = entries[0];
  const lang = firstEntry[0].trim();
  if (lang.length === 0)
    return null;

  return {
    lang,
    text: firstEntry[1],
  };
}

async function buildCacheKey(lang, text, promptVersion) {
  const source = `${promptVersion}|${lang}|${text}`;
  const data = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  const hash = bytes.map((value) => value.toString(16).padStart(2, "0")).join("");
  return `cache:${lang}:v${promptVersion}:${hash}`;
}

async function checkRateLimit(env, clientIp, requestsPerMinute) {
  const now = Date.now();
  const windowKey = `rate:${clientIp}:${Math.floor(now / 60000)}`;
  const updatedAt = new Date(now).toISOString();
  const expiresAt = now + 90 * 1000;
  const row = await getDatabase(env).prepare(
    `INSERT INTO rate_limits (
      window_key,
      count,
      expires_at,
      updated_at
    ) VALUES (?, 1, ?, ?)
    ON CONFLICT(window_key) DO UPDATE SET
      count = rate_limits.count + 1,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
    RETURNING count`,
  ).bind(windowKey, expiresAt, updatedAt).first();

  const count = safeMetricNumber(row?.count);
  if (count > requestsPerMinute)
    return { allowed: false, remaining: 0 };

  return {
    allowed: true,
    remaining: Math.max(0, requestsPerMinute - count),
  };
}

async function requestAiTranslation(env, lang, text, metadata = {}) {
  const mode = env.AI_PROVIDER_MODE === "openai-chat" ? "openai-chat" : "result-json";
  const input = text;
  const promptText = buildTranslationPromptText(lang);
  const messages = buildTranslationMessages(lang, text);
  const timeoutMs = clampInteger(Number(env.AI_TIMEOUT_MS), 1000, 60000, 10000);
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const startedAt = Date.now();

  try {
    const response =
      mode === "openai-chat"
        ? await fetchOpenAiCompatible(env, controller.signal, messages)
        : await fetchResultJsonProvider(env, controller.signal, promptText, input);

    if (!response.ok) {
      const failed = {
        ...response,
        latencyMs: Date.now() - startedAt,
      };
      await recordLlmRequest(env, buildLlmRequestEntry(metadata, mode, lang, text, failed));
      return failed;
    }

    const cleaned = response.result.trim();
    const succeeded = { ok: true, result: cleaned, latencyMs: Date.now() - startedAt };
    await recordLlmRequest(env, buildLlmRequestEntry(metadata, mode, lang, text, succeeded));
    return succeeded;
  } catch (error) {
    const failed = buildAiFailureResponse(error, Date.now() - startedAt);
    await recordLlmRequest(env, buildLlmRequestEntry(metadata, mode, lang, text, failed));
    return failed;
  } finally {
    clearTimeout(timerId);
  }
}

function buildAiFailureResponse(error, latencyMs) {
  if (
    error === "timeout" ||
    (error instanceof Error && error.name === "AbortError") ||
    String(error).toLowerCase().includes("timeout")
  ) {
    return {
      ok: false,
      reason: "timeout",
      publicReason: "AI request timeout",
      latencyMs,
    };
  }

  const reason = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    reason,
    publicReason: "AI request failed",
    latencyMs,
  };
}

function buildLlmRequestEntry(metadata, providerMode, lang, text, result) {
  return {
    source: typeof metadata?.source === "string" && metadata.source.length > 0
      ? metadata.source
      : "unknown",
    providerMode,
    lang,
    inputChars: countCharacters(text),
    promptVersion: clampInteger(Number(metadata?.promptVersion), 0, 1000000, 0),
    status: result.ok ? "ok" : "error",
    latencyMs: safeMetricNumber(result.latencyMs),
    publicReason: result.ok ? "" : String(result.publicReason ?? ""),
    inputPreview: buildPreviewText(text, 120),
    outputPreview: result.ok ? buildPreviewText(result.result, 120) : "",
    occurredAt: new Date().toISOString(),
  };
}

function buildPreviewText(value, maxLength) {
  const normalized = sanitizeDiscordLine(String(value ?? ""));
  if (normalized.length <= maxLength)
    return normalized;

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

async function fetchResultJsonProvider(env, signal, prompt, input) {
  const response = await fetch(env.AI_API_URL, {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${env.AI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      input,
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: `upstream_status_${response.status}`,
      publicReason: `AI upstream status ${response.status}`,
    };
  }

  const payload = await response.json();
  if (!payload || typeof payload.result !== "string") {
    return {
      ok: false,
      reason: "upstream_result_missing",
      publicReason: "AI result missing",
    };
  }

  return {
    ok: true,
    result: payload.result,
  };
}

async function fetchOpenAiCompatible(env, signal, messages) {
  if (!env.AI_MODEL) {
    return {
      ok: false,
      reason: "AI_MODEL_missing",
      publicReason: "AI model missing",
    };
  }

  const response = await fetch(env.AI_API_URL, {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${env.AI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      temperature: 0,
      messages,
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: `openai_status_${response.status}`,
      publicReason: `AI upstream status ${response.status}`,
    };
  }

  const payload = await response.json();
  const content = extractChatContent(payload);
  if (content === null) {
    return {
      ok: false,
      reason: "openai_content_missing",
      publicReason: "AI content missing",
    };
  }

  return {
    ok: true,
    result: content,
  };
}

function extractChatContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string")
    return content;

  if (Array.isArray(content)) {
    const textParts = content
      .map((item) => (item && typeof item.text === "string" ? item.text : ""))
      .filter((item) => item.length > 0);
    if (textParts.length > 0)
      return textParts.join("");
  }

  return null;
}

async function listRecentErrors(env, limit) {
  const result = await getDatabase(env).prepare(
    `SELECT
      level,
      code,
      message,
      details_json,
      occurred_at
    FROM error_logs
    WHERE expires_at > ?
    ORDER BY occurred_at DESC
    LIMIT ?`,
  ).bind(Date.now(), limit).run();

  return getQueryRows(result).map((row) => ({
    level: typeof row?.level === "string" ? row.level : "error",
    code: typeof row?.code === "string" ? row.code : "",
    message: typeof row?.message === "string" ? row.message : "",
    details: parseStoredJsonObject(row?.details_json),
    occurredAt: typeof row?.occurred_at === "string" ? row.occurred_at : "",
  }));
}

async function listRecentLlmRequests(env, limit) {
  const result = await getDatabase(env).prepare(
    `SELECT
      source,
      provider_mode,
      lang,
      input_chars,
      prompt_version,
      status,
      latency_ms,
      public_reason,
      input_preview,
      output_preview,
      occurred_at
    FROM llm_request_logs
    WHERE expires_at > ?
    ORDER BY occurred_at DESC
    LIMIT ?`,
  ).bind(Date.now(), limit).run();

  return getQueryRows(result).map((row) => ({
    source: typeof row?.source === "string" ? row.source : "unknown",
    providerMode: typeof row?.provider_mode === "string" ? row.provider_mode : "",
    lang: typeof row?.lang === "string" ? row.lang : "",
    inputChars: safeMetricNumber(row?.input_chars),
    promptVersion: safeMetricNumber(row?.prompt_version),
    status: typeof row?.status === "string" ? row.status : "error",
    latencyMs: safeMetricNumber(row?.latency_ms),
    publicReason: typeof row?.public_reason === "string" ? row.public_reason : "",
    inputPreview: typeof row?.input_preview === "string" ? row.input_preview : "",
    outputPreview: typeof row?.output_preview === "string" ? row.output_preview : "",
    occurredAt: typeof row?.occurred_at === "string" ? row.occurred_at : "",
  }));
}

function createErrorEntry(level, code, message, details) {
  return {
    level,
    code,
    message,
    details,
    occurredAt: new Date().toISOString(),
  };
}

async function recordError(env, entry) {
  const retentionSeconds = (await loadConfig(env)).errorRetentionSeconds;
  const now = Date.now();
  const errorId = `error:${now.toString().padStart(13, "0")}:${crypto.randomUUID()}`;
  await getDatabase(env).prepare(
    `INSERT INTO error_logs (
      error_id,
      level,
      code,
      message,
      details_json,
      occurred_at,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    errorId,
    entry.level,
    entry.code,
    entry.message,
    JSON.stringify(entry.details ?? {}),
    entry.occurredAt,
    now + retentionSeconds * 1000,
  ).run();
}

async function recordLlmRequest(env, entry) {
  try {
    const retentionSeconds = (await loadConfig(env)).errorRetentionSeconds;
    const now = Date.now();
    const requestId = `llm:${now.toString().padStart(13, "0")}:${crypto.randomUUID()}`;
    await getDatabase(env).prepare(
      `INSERT INTO llm_request_logs (
        request_id,
        source,
        provider_mode,
        lang,
        input_chars,
        prompt_version,
        status,
        latency_ms,
        public_reason,
        input_preview,
        output_preview,
        occurred_at,
        expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      requestId,
      entry.source,
      entry.providerMode,
      entry.lang,
      entry.inputChars,
      entry.promptVersion,
      entry.status,
      entry.latencyMs,
      entry.publicReason,
      entry.inputPreview,
      entry.outputPreview,
      entry.occurredAt,
      now + retentionSeconds * 1000,
    ).run();
  } catch (error) {
    console.error("LLM リクエスト記録の保存に失敗しました。", error);
  }
}

function parseStoredJsonObject(value) {
  if (typeof value !== "string" || value.length === 0)
    return {};

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed;
  } catch {
  }

  return {};
}

async function notifyCriticalError(env, entry) {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_TMP_U_CHANNEL_ID)
    return;

  try {
    await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_TMP_U_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        content: buildDiscordAlertMessage(entry),
      }),
    });
  } catch (error) {
    console.error("重大エラー通知の送信に失敗しました。", error);
  }
}

function countCharacters(text) {
  return Array.from(text).length;
}

function clampInteger(value, min, max, fallback) {
  if (!Number.isInteger(value))
    return fallback;

  return Math.max(min, Math.min(max, value));
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}
