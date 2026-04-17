export function buildManagerPageHtml() {
	return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>World AI Services Manager</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --mgr-bg: #f7f3ff;
      --mgr-surface: #ffffff;
      --mgr-border: #dfd4ff;
      --mgr-primary: #8b5cf6;
      --mgr-primary-soft: #ede9fe;
      --mgr-text: #2d1f46;
      --mgr-muted: #6d5d86;
    }
    body {
      background: linear-gradient(165deg, #f8f4ff 0%, #f1eaff 100%);
      color: var(--mgr-text);
      min-height: 100vh;
    }
    .card {
      background: var(--mgr-surface);
      border: 1px solid var(--mgr-border);
      border-radius: 16px;
      box-shadow: 0 8px 28px rgba(139, 92, 246, 0.1);
    }
    .chip {
      border-radius: 999px;
      font-size: 12px;
      padding: 2px 10px;
      background: var(--mgr-primary-soft);
      color: var(--mgr-primary);
    }
  </style>
</head>
<body class="font-sans">
  <main class="max-w-6xl mx-auto px-4 py-8 space-y-5">
    <section class="card p-5">
      <h1 class="text-2xl font-bold mb-2">管理ページ</h1>
      <p class="text-sm text-[color:var(--mgr-muted)]">翻訳API管理（/mgr）</p>
      <div id="loginPanel" class="mt-4 space-y-3">
        <label class="block text-sm font-semibold">管理パスワード</label>
        <input id="passwordInput" type="password" class="w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)] focus:outline-none focus:ring-2 focus:ring-violet-400" />
        <button id="loginButton" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">ログイン</button>
      </div>
      <div id="sessionPanel" class="hidden mt-4 flex items-center gap-2">
        <span class="chip">ログイン済み</span>
        <button id="logoutButton" class="px-3 py-1 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold">ログアウト</button>
      </div>
      <p id="notice" class="mt-3 text-sm text-[color:var(--mgr-muted)]"></p>
    </section>

    <section class="card p-5 space-y-4">
      <h2 class="text-xl font-bold">基本設定</h2>
      <div class="grid md:grid-cols-3 gap-4">
        <label class="text-sm">稼働状態
          <select id="enabledInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]">
            <option value="1">ON</option>
            <option value="0">OFF</option>
          </select>
        </label>
        <label class="text-sm">1分あたり上限
          <input id="rpmInput" type="number" min="1" max="60" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
        </label>
        <label class="text-sm">最大文字数
          <input id="maxCharsInput" type="number" min="1" max="1000" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
        </label>
      </div>
      <button id="saveConfigButton" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">設定を保存</button>
    </section>

    <section class="card p-5 space-y-3">
      <h2 class="text-xl font-bold">操作</h2>
      <div class="flex flex-wrap gap-2">
        <button id="reloadButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">再読込</button>
        <button id="statsButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">統計取得</button>
        <button id="errorsButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">エラーログ取得</button>
        <button id="llmButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">LLMログ取得</button>
        <button id="pingButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">AI Ping</button>
        <button id="resetCacheButton" class="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold">キャッシュ全削除</button>
      </div>
      <div class="grid md:grid-cols-3 gap-3">
        <input id="simulateLangInput" placeholder="言語コード (例: ja_JP)" class="border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
        <input id="simulateTextInput" placeholder="翻訳対象テキスト" class="md:col-span-2 border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
      </div>
      <button id="simulateButton" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">simulate 実行</button>
    </section>

    <section class="card p-5">
      <h2 class="text-xl font-bold mb-3">結果</h2>
      <pre id="output" class="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs overflow-x-auto whitespace-pre-wrap"></pre>
    </section>
  </main>

  <script>
    const state = { token: localStorage.getItem("mgr_token") || "" };
    const ui = {
      loginPanel: document.getElementById("loginPanel"),
      sessionPanel: document.getElementById("sessionPanel"),
      passwordInput: document.getElementById("passwordInput"),
      loginButton: document.getElementById("loginButton"),
      logoutButton: document.getElementById("logoutButton"),
      notice: document.getElementById("notice"),
      enabledInput: document.getElementById("enabledInput"),
      rpmInput: document.getElementById("rpmInput"),
      maxCharsInput: document.getElementById("maxCharsInput"),
      saveConfigButton: document.getElementById("saveConfigButton"),
      reloadButton: document.getElementById("reloadButton"),
      statsButton: document.getElementById("statsButton"),
      errorsButton: document.getElementById("errorsButton"),
      llmButton: document.getElementById("llmButton"),
      pingButton: document.getElementById("pingButton"),
      resetCacheButton: document.getElementById("resetCacheButton"),
      simulateLangInput: document.getElementById("simulateLangInput"),
      simulateTextInput: document.getElementById("simulateTextInput"),
      simulateButton: document.getElementById("simulateButton"),
      output: document.getElementById("output"),
    };

    function renderSession() {
      const loggedIn = !!state.token;
      ui.loginPanel.classList.toggle("hidden", loggedIn);
      ui.sessionPanel.classList.toggle("hidden", !loggedIn);
    }

    function setNotice(message) {
      ui.notice.textContent = message;
    }

    function setOutput(payload) {
      ui.output.textContent = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    }

    async function callApi(path, options = {}) {
      const headers = Object.assign({ "content-type": "application/json" }, options.headers || {});
      if (state.token) headers.authorization = "Bearer " + state.token;
      const response = await fetch("/mgr/api" + path, Object.assign({}, options, { headers }));
      const data = await response.json().catch(() => ({ status: "error", result: "Invalid JSON" }));
      if (response.status === 401) {
        state.token = "";
        localStorage.removeItem("mgr_token");
        renderSession();
      }
      return { response, data };
    }

    async function loadStatus() {
      const { data } = await callApi("/status");
      setOutput(data);
      if (data.status === "ok") {
        ui.enabledInput.value = data.result.enabled ? "1" : "0";
        ui.rpmInput.value = String(data.result.requestsPerMinute);
        ui.maxCharsInput.value = String(data.result.maxChars);
      }
    }

    ui.loginButton.addEventListener("click", async () => {
      const password = ui.passwordInput.value;
      const { data } = await callApi("/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      if (data.status !== "ok") {
        setNotice("ログインに失敗しました。");
        setOutput(data);
        return;
      }
      state.token = data.result.token;
      localStorage.setItem("mgr_token", state.token);
      ui.passwordInput.value = "";
      renderSession();
      setNotice("ログイン成功");
      await loadStatus();
    });

    ui.logoutButton.addEventListener("click", () => {
      state.token = "";
      localStorage.removeItem("mgr_token");
      renderSession();
      setNotice("ログアウトしました。");
    });

    ui.saveConfigButton.addEventListener("click", async () => {
      const payload = {
        enabled: ui.enabledInput.value === "1",
        requestsPerMinute: Number(ui.rpmInput.value),
        maxChars: Number(ui.maxCharsInput.value),
      };
      const { data } = await callApi("/config", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOutput(data);
      if (data.status === "ok") setNotice("設定を保存しました。");
    });

    ui.reloadButton.addEventListener("click", loadStatus);
    ui.statsButton.addEventListener("click", async () => setOutput((await callApi("/stats")).data));
    ui.errorsButton.addEventListener("click", async () => setOutput((await callApi("/errors?limit=10")).data));
    ui.llmButton.addEventListener("click", async () => setOutput((await callApi("/llmrequests?limit=10")).data));
    ui.pingButton.addEventListener("click", async () => setOutput((await callApi("/ping", { method: "POST", body: "{}" })).data));
    ui.resetCacheButton.addEventListener("click", async () => {
      if (!confirm("translation_cache を全削除します。よろしいですか？")) return;
      setOutput((await callApi("/resetcache", { method: "POST", body: "{}" })).data);
    });
    ui.simulateButton.addEventListener("click", async () => {
      const payload = {
        lang: ui.simulateLangInput.value,
        text: ui.simulateTextInput.value,
      };
      const { data } = await callApi("/simulate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOutput(data);
    });

    renderSession();
    if (state.token) loadStatus();
  </script>
</body>
</html>`;
}
