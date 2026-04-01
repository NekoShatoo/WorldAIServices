const JSON_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,x-bot-key",
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

  if (url.pathname.startsWith("/trans/")) {
    if (request.method !== "GET")
      return jsonResponse({ status: "error", result: "Invalid method" }, 405);

    return handleTranslate(request, env, ctx, url.pathname);
  }

  if (url.pathname === "/bot/config")
    return handleBotConfig(request, env, ctx);

  if (url.pathname === "/bot/errors")
    return handleBotErrors(request, env);

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

async function handleTranslate(request, env, ctx, pathname) {
  const config = await loadConfig(env);
  if (!config.enabled)
    return jsonResponse({ status: "error", result: "服务器已关闭" }, 503);

  const parsed = parseTranslatePath(pathname);
  if (!parsed)
    return jsonResponse({ status: "error", result: "Invalid request" }, 400);

  const text = parsed.text.trim();
  if (text.length === 0)
    return jsonResponse({ status: "ok", result: "" });

  if (countCharacters(text) > config.maxChars)
    return jsonResponse({ status: "error", result: "Text too long" }, 400);

  const cacheKey = await buildCacheKey(parsed.lang, text, config.promptVersion);
  const cached = await env.STATE_KV.get(cacheKey);
  if (cached !== null)
    return jsonResponse({ status: "ok", result: cached });

  const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rateLimit = await checkRateLimit(env, clientIp, config.requestsPerMinute);
  if (!rateLimit.allowed)
    return jsonResponse({ status: "error", result: "Rate limit exceeded" }, 429);

  const aiResult = await requestAiTranslation(env, config.prompt, parsed.lang, text);
  if (!aiResult.ok) {
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

  return jsonResponse({ status: "ok", result: aiResult.result });
}

async function handleBotConfig(request, env, ctx) {
  if (!isAuthorizedBotRequest(request, env))
    return jsonResponse({ status: "error", result: "Unauthorized" }, 401);

  if (request.method === "GET") {
    const config = await loadConfig(env);
    return jsonResponse({ status: "ok", result: config });
  }

  if (request.method !== "POST")
    return jsonResponse({ status: "error", result: "Invalid method" }, 405);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ status: "error", result: "Invalid JSON" }, 400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return jsonResponse({ status: "error", result: "Invalid JSON body" }, 400);

  const current = await loadConfig(env);
  const next = { ...current };

  if (Object.prototype.hasOwnProperty.call(payload, "enabled")) {
    if (typeof payload.enabled !== "boolean")
      return jsonResponse({ status: "error", result: "enabled must be boolean" }, 400);

    next.enabled = payload.enabled;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "prompt")) {
    if (typeof payload.prompt !== "string")
      return jsonResponse({ status: "error", result: "prompt must be string" }, 400);

    const prompt = payload.prompt.trim();
    if (prompt.length === 0)
      return jsonResponse({ status: "error", result: "prompt must not be empty" }, 400);

    if (prompt !== current.prompt) {
      next.prompt = prompt;
      next.promptVersion = current.promptVersion + 1;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "requestsPerMinute")) {
    const value = Number(payload.requestsPerMinute);
    if (!Number.isInteger(value) || value < 1 || value > 60)
      return jsonResponse(
        { status: "error", result: "requestsPerMinute must be 1-60" },
        400,
      );

    next.requestsPerMinute = value;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "maxChars")) {
    const value = Number(payload.maxChars);
    if (!Number.isInteger(value) || value < 1 || value > 1000)
      return jsonResponse({ status: "error", result: "maxChars must be 1-1000" }, 400);

    next.maxChars = value;
  }

  await env.STATE_KV.put(CONFIG_KEY, JSON.stringify(next));

  return jsonResponse({ status: "ok", result: next });
}

async function handleBotErrors(request, env) {
  if (!isAuthorizedBotRequest(request, env))
    return jsonResponse({ status: "error", result: "Unauthorized" }, 401);

  if (request.method !== "GET")
    return jsonResponse({ status: "error", result: "Invalid method" }, 405);

  const url = new URL(request.url);
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "20"), 1, 50, 20);
  const errors = await listRecentErrors(env, limit);

  return jsonResponse({ status: "ok", result: errors });
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

function parseTranslatePath(pathname) {
  const raw = pathname.slice("/trans/".length);
  const index = raw.indexOf("=");
  if (index <= 0)
    return null;

  const lang = raw.slice(0, index).trim();
  if (lang.length === 0)
    return null;

  const encodedText = raw.slice(index + 1);
  try {
    return {
      lang,
      text: decodeURIComponent(encodedText),
    };
  } catch {
    return {
      lang,
      text: encodedText,
    };
  }
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

function isAuthorizedBotRequest(request, env) {
  const key = request.headers.get("x-bot-key");
  return Boolean(env.BOT_CONTROL_KEY) && key === env.BOT_CONTROL_KEY;
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
  if (!env.BOT_NOTIFY_URL)
    return;

  const headers = {
    "content-type": "application/json",
  };

  if (env.BOT_NOTIFY_KEY)
    headers["x-bot-key"] = env.BOT_NOTIFY_KEY;

  try {
    await fetch(env.BOT_NOTIFY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        channel: "tmp-u",
        type: "critical_error",
        payload: entry,
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
