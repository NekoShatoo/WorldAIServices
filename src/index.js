import { DISCORD_COMMANDS } from "./discordCommands.js";

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
  prompt:
    "あなたは翻訳専用APIです。入力は先頭に[言語コード]が付いた短文です。説明や補足は返さず、翻訳結果の本文だけを返してください。原文が空なら空文字を返してください。",
  promptVersion: 1,
  requestsPerMinute: 6,
  maxChars: 300,
  cacheTtlSeconds: 60 * 60 * 24 * 180,
  errorRetentionSeconds: 60 * 60 * 24 * 14,
});

const CONFIG_KEY = "config:service";
const STATS_DAY_PREFIX = "stats:day:";
const STATS_MONTH_PREFIX = "stats:month:";
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
      promptVersion: config.promptVersion,
      requestsPerMinute: config.requestsPerMinute,
      maxChars: config.maxChars,
    },
  });
}

async function handleTranslate(request, env, ctx, url) {
  const config = await loadConfig(env);
  if (!config.enabled)
    return jsonResponse({ status: "error", result: "服务器已关闭" }, 503);

  const parsed = parseTranslateQuery(url);
  if (!parsed)
    return jsonResponse({ status: "error", result: "Invalid request" }, 400);

  const text = parsed.text.trim();
  if (text.length === 0)
    return jsonResponse({ status: "ok", result: "" });

  if (countCharacters(text) > config.maxChars)
    return jsonResponse({ status: "error", result: "Text too long" }, 400);

  const cacheKey = await buildCacheKey(parsed.lang, text, config.promptVersion);
  const cached = await env.STATE_KV.get(cacheKey);
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

  const aiResult = await requestAiTranslation(env, config.prompt, parsed.lang, text);
  if (!aiResult.ok) {
    ctx.waitUntil(
      recordTranslationStats(env, {
        lang: parsed.lang,
        textLength: countCharacters(text),
        cacheHit: false,
        cacheMiss: true,
        aiRequest: true,
        aiSuccess: false,
        aiFailure: true,
      }),
    );

    ctx.waitUntil(
      recordError(
        env,
        createErrorEntry("error", "AI_REQUEST_FAILED", "翻訳AIへのリクエストに失敗しました。", {
          reason: aiResult.reason,
          lang: parsed.lang,
          textLength: countCharacters(text),
        }),
      ),
    );

    return jsonResponse({ status: "error", result: "Server error" }, 502);
  }

  await env.STATE_KV.put(cacheKey, aiResult.result, {
    expirationTtl: config.cacheTtlSeconds,
  });

  ctx.waitUntil(
    recordTranslationStats(env, {
      lang: parsed.lang,
      textLength: countCharacters(text),
      cacheHit: false,
      cacheMiss: true,
      aiRequest: true,
      aiSuccess: true,
      aiFailure: false,
    }),
  );

  return jsonResponse({ status: "ok", result: aiResult.result });
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

  if (commandName === "prompt") {
    const current = await loadConfig(env);
    const text = String(options.text ?? "").trim();
    if (text.length === 0)
      return discordMessageResponse("prompt は空文字にできません。", false);

    const next = await updateConfig(env, {
      prompt: text,
      promptVersion: current.promptVersion + 1,
    });
    return discordMessageResponse(
      `prompt を更新しました。promptVersion は ${next.promptVersion} です。`,
      false,
    );
  }

  if (commandName === "errors") {
    const limit = clampInteger(Number(options.limit), 1, 10, 5);
    const errors = await listRecentErrors(env, limit);
    return discordMessageResponse(buildDiscordErrorsMessage(errors), false);
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
    "/prompt text:<新しい prompt> - 翻訳 prompt を更新します。",
    "/errors [limit] - 最近のエラーログを表示します。",
    "/stats - 当日と当月の翻訳統計を表示します。",
  ].join("\n");
}

function buildDiscordStatusMessage(config) {
  return [
    "現在設定:",
    `enabled: ${config.enabled}`,
    `promptVersion: ${config.promptVersion}`,
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

  await env.STATE_KV.put(CONFIG_KEY, JSON.stringify(next));
  return next;
}

async function recordTranslationStats(env, metric) {
  const keys = buildStatsKeys();
  await Promise.all([
    updateStatsRecord(env, `${STATS_DAY_PREFIX}${keys.dayKey}`, "day", keys.dayKey, metric),
    updateStatsRecord(env, `${STATS_MONTH_PREFIX}${keys.monthKey}`, "month", keys.monthKey, metric),
  ]);
}

async function updateStatsRecord(env, key, period, periodKey, metric) {
  const stored = await env.STATE_KV.get(key, "json");
  const next = normalizeStatsRecord(stored, period, periodKey);
  next.requestsTotal += 1;
  next.totalInputChars += metric.textLength;
  next.cacheHits += metric.cacheHit ? 1 : 0;
  next.cacheMisses += metric.cacheMiss ? 1 : 0;
  next.aiRequests += metric.aiRequest ? 1 : 0;
  next.aiSuccesses += metric.aiSuccess ? 1 : 0;
  next.aiFailures += metric.aiFailure ? 1 : 0;
  next.languages[metric.lang] = (next.languages[metric.lang] ?? 0) + 1;
  next.updatedAt = new Date().toISOString();

  await env.STATE_KV.put(key, JSON.stringify(next), {
    expirationTtl: period === "day" ? 60 * 60 * 24 * 400 : 60 * 60 * 24 * 800,
  });
}

async function loadTranslationStatsSummary(env) {
  const keys = buildStatsKeys();
  const [dayRecord, monthRecord] = await Promise.all([
    env.STATE_KV.get(`${STATS_DAY_PREFIX}${keys.dayKey}`, "json"),
    env.STATE_KV.get(`${STATS_MONTH_PREFIX}${keys.monthKey}`, "json"),
  ]);

  return {
    day: normalizeStatsRecord(dayRecord, "day", keys.dayKey),
    month: normalizeStatsRecord(monthRecord, "month", keys.monthKey),
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

function normalizeStatsRecord(record, period, periodKey) {
  const source = record && typeof record === "object" ? record : {};
  const languages =
    source.languages && typeof source.languages === "object" && !Array.isArray(source.languages)
      ? source.languages
      : {};

  return {
    period,
    periodKey,
    requestsTotal: safeMetricNumber(source.requestsTotal),
    totalInputChars: safeMetricNumber(source.totalInputChars),
    cacheHits: safeMetricNumber(source.cacheHits),
    cacheMisses: safeMetricNumber(source.cacheMisses),
    aiRequests: safeMetricNumber(source.aiRequests),
    aiSuccesses: safeMetricNumber(source.aiSuccesses),
    aiFailures: safeMetricNumber(source.aiFailures),
    languages: normalizeLanguageCounts(languages),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
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
  const stored = await env.STATE_KV.get(CONFIG_KEY, "json");
  if (!stored || typeof stored !== "object")
    return { ...DEFAULT_CONFIG };

  const prompt =
    typeof stored.prompt === "string" && stored.prompt.trim().length > 0
      ? stored.prompt.trim()
      : DEFAULT_CONFIG.prompt;

  return {
    ...DEFAULT_CONFIG,
    enabled: typeof stored.enabled === "boolean" ? stored.enabled : DEFAULT_CONFIG.enabled,
    prompt,
    promptVersion: clampInteger(Number(stored.promptVersion), 1, 1000000, 1),
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
  const stored = await env.STATE_KV.get(windowKey, "json");

  const count =
    stored && typeof stored === "object" && Number.isInteger(stored.count) ? stored.count : 0;
  if (count >= requestsPerMinute)
    return { allowed: false, remaining: 0 };

  await env.STATE_KV.put(windowKey, JSON.stringify({ count: count + 1 }), {
    expirationTtl: 90,
  });

  return {
    allowed: true,
    remaining: Math.max(0, requestsPerMinute - count - 1),
  };
}

async function requestAiTranslation(env, prompt, lang, text) {
  const mode = env.AI_PROVIDER_MODE === "openai-chat" ? "openai-chat" : "result-json";
  const input = `[${lang}]${text}`;
  const timeoutMs = clampInteger(Number(env.AI_TIMEOUT_MS), 1000, 60000, 10000);
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    const response =
      mode === "openai-chat"
        ? await fetchOpenAiCompatible(env, controller.signal, prompt, input)
        : await fetchResultJsonProvider(env, controller.signal, prompt, input);

    if (!response.ok)
      return response;

    const cleaned = response.result.trim();
    return { ok: true, result: cleaned };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timerId);
  }
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
    };
  }

  const payload = await response.json();
  if (!payload || typeof payload.result !== "string") {
    return {
      ok: false,
      reason: "upstream_result_missing",
    };
  }

  return {
    ok: true,
    result: payload.result,
  };
}

async function fetchOpenAiCompatible(env, signal, prompt, input) {
  if (!env.AI_MODEL) {
    return {
      ok: false,
      reason: "AI_MODEL_missing",
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
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: input },
      ],
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: `openai_status_${response.status}`,
    };
  }

  const payload = await response.json();
  const content = extractChatContent(payload);
  if (content === null) {
    return {
      ok: false,
      reason: "openai_content_missing",
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
  const listing = await env.STATE_KV.list({ prefix: "error:", limit: 200 });
  const keys = listing.keys
    .map((item) => item.name)
    .sort()
    .slice(-limit)
    .reverse();

  const result = [];
  for (const key of keys) {
    const item = await env.STATE_KV.get(key, "json");
    if (item)
      result.push(item);
  }

  return result;
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
  const key = `error:${Date.now().toString().padStart(13, "0")}:${crypto.randomUUID()}`;
  await env.STATE_KV.put(key, JSON.stringify(entry), {
    expirationTtl: retentionSeconds,
  });
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
