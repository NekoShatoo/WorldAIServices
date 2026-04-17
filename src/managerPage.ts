const COMMON_STYLE = `
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --mgr-bg: #f6f1ff;
      --mgr-surface: #ffffff;
      --mgr-border: #ddd0ff;
      --mgr-primary: #8b5cf6;
      --mgr-primary-soft: #efe7ff;
      --mgr-text: #2c1d49;
      --mgr-muted: #6e5d8f;
    }
    body {
      margin: 0;
      background: linear-gradient(165deg, #f8f4ff 0%, #f1eaff 100%);
      color: var(--mgr-text);
      min-height: 100vh;
    }
    .card {
      background: var(--mgr-surface);
      border: 1px solid var(--mgr-border);
      border-radius: 16px;
      box-shadow: 0 8px 30px rgba(139, 92, 246, 0.12);
    }
    .nav-item {
      width: 100%;
      text-align: left;
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 14px;
      color: var(--mgr-text);
    }
    .nav-item:hover { background: var(--mgr-primary-soft); }
    .nav-item.active { background: #8b5cf6; color: #fff; }
    .chip {
      border-radius: 999px;
      padding: 2px 10px;
      font-size: 12px;
      background: var(--mgr-primary-soft);
      color: var(--mgr-primary);
    }
  </style>
`;

export function buildManagerLoginPageHtml() {
	return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Manager Login</title>
  ${COMMON_STYLE}
</head>
<body class="font-sans">
  <main class="min-h-screen flex items-center justify-center px-4">
    <section class="card w-full max-w-md p-6 space-y-4">
      <h1 class="text-2xl font-bold">管理画面ログイン</h1>
      <p class="text-sm text-[color:var(--mgr-muted)]">World AI Services /mgr</p>
      <label class="block text-sm font-semibold">管理パスワード</label>
      <input id="passwordInput" type="password" class="w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)] focus:outline-none focus:ring-2 focus:ring-violet-400" />
      <button id="loginButton" class="w-full px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">ログイン</button>
      <p id="notice" class="text-sm text-[color:var(--mgr-muted)]"></p>
    </section>
  </main>
  <script>
    const token = localStorage.getItem("mgr_token") || "";
    if (token) location.href = "/mgr/app";

    const ui = {
      passwordInput: document.getElementById("passwordInput"),
      loginButton: document.getElementById("loginButton"),
      notice: document.getElementById("notice"),
    };

    async function login() {
      const password = ui.passwordInput.value;
      const response = await fetch("/mgr/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({ status: "error", result: "Invalid JSON" }));
      if (data.status !== "ok") {
        ui.notice.textContent = "ログインに失敗しました。";
        return;
      }
      localStorage.setItem("mgr_token", data.result.token);
      location.href = "/mgr/app";
    }

    ui.loginButton.addEventListener("click", login);
    ui.passwordInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") login();
    });
  </script>
</body>
</html>`;
}

export function buildManagerAppPageHtml() {
	return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Manager Console</title>
  ${COMMON_STYLE}
</head>
<body class="font-sans">
  <div class="min-h-screen grid grid-cols-12 gap-4 p-4">
    <aside class="col-span-12 md:col-span-3 lg:col-span-2 card p-4 space-y-3">
      <div>
        <h1 class="text-lg font-bold">管理ページ</h1>
        <p class="text-xs text-[color:var(--mgr-muted)]">Tree View</p>
      </div>
      <nav class="space-y-1">
        <button class="nav-item active" data-panel="dashboard">Dashboard</button>
        <button class="nav-item" data-panel="service">サービス設定</button>
        <button class="nav-item" data-panel="operation">運用操作</button>
      </nav>
      <div class="pt-2 border-t border-violet-100">
        <p class="text-xs font-semibold text-[color:var(--mgr-muted)] mb-1">AIサービス</p>
        <button class="nav-item" data-panel="ai">AI疎通 / simulate</button>
      </div>
      <button id="logoutButton" class="mt-3 px-3 py-2 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold">ログアウト</button>
    </aside>

    <main class="col-span-12 md:col-span-9 lg:col-span-10 space-y-4">
      <section id="panel-dashboard" class="card p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold">Dashboard</h2>
          <button id="refreshDashboardButton" class="px-3 py-2 rounded-xl bg-violet-100 text-violet-700 text-sm font-semibold">更新</button>
        </div>
        <div class="grid md:grid-cols-4 gap-3">
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">サービス状態</p><p id="kpiEnabled" class="text-lg font-bold">-</p></div>
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">1分上限</p><p id="kpiRpm" class="text-lg font-bold">-</p></div>
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">最大文字数</p><p id="kpiMaxChars" class="text-lg font-bold">-</p></div>
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">当日リクエスト</p><p id="kpiDayRequests" class="text-lg font-bold">-</p></div>
        </div>
        <div class="grid lg:grid-cols-2 gap-4">
          <section class="card p-4">
            <h3 class="text-sm font-semibold mb-2">キャッシュ / AI 統計（当日）</h3>
            <canvas id="dayChart" height="220"></canvas>
          </section>
          <section class="card p-4">
            <h3 class="text-sm font-semibold mb-2">言語別リクエスト（当日）</h3>
            <canvas id="langChart" height="220"></canvas>
          </section>
        </div>
      </section>

      <section id="panel-service" class="card p-5 space-y-4 hidden">
        <h2 class="text-xl font-bold">サービス設定</h2>
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

      <section id="panel-operation" class="card p-5 space-y-3 hidden">
        <h2 class="text-xl font-bold">運用操作</h2>
        <div class="flex flex-wrap gap-2">
          <button id="statsButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">統計取得</button>
          <button id="errorsButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">エラーログ取得</button>
          <button id="llmButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">LLMログ取得</button>
          <button id="resetCacheButton" class="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold">キャッシュ全削除</button>
        </div>
      </section>

      <section id="panel-ai" class="card p-5 space-y-3 hidden">
        <h2 class="text-xl font-bold">AIサービス</h2>
        <div class="flex gap-2">
          <button id="pingButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">AI Ping</button>
        </div>
        <div class="grid md:grid-cols-3 gap-3">
          <input id="simulateLangInput" placeholder="言語コード (例: ja_JP)" class="border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
          <input id="simulateTextInput" placeholder="翻訳対象テキスト" class="md:col-span-2 border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
        </div>
        <button id="simulateButton" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">simulate 実行</button>
      </section>

      <section class="card p-5">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-xl font-bold">結果</h2>
          <span class="chip">API Response</span>
        </div>
        <pre id="output" class="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs overflow-x-auto whitespace-pre-wrap"></pre>
      </section>
    </main>
  </div>

  <script>
    const state = {
      token: localStorage.getItem("mgr_token") || "",
      dayChart: null,
      langChart: null,
    };
    if (!state.token) location.href = "/mgr";

    const ui = {
      output: document.getElementById("output"),
      logoutButton: document.getElementById("logoutButton"),
      refreshDashboardButton: document.getElementById("refreshDashboardButton"),
      kpiEnabled: document.getElementById("kpiEnabled"),
      kpiRpm: document.getElementById("kpiRpm"),
      kpiMaxChars: document.getElementById("kpiMaxChars"),
      kpiDayRequests: document.getElementById("kpiDayRequests"),
      enabledInput: document.getElementById("enabledInput"),
      rpmInput: document.getElementById("rpmInput"),
      maxCharsInput: document.getElementById("maxCharsInput"),
      saveConfigButton: document.getElementById("saveConfigButton"),
      statsButton: document.getElementById("statsButton"),
      errorsButton: document.getElementById("errorsButton"),
      llmButton: document.getElementById("llmButton"),
      resetCacheButton: document.getElementById("resetCacheButton"),
      pingButton: document.getElementById("pingButton"),
      simulateLangInput: document.getElementById("simulateLangInput"),
      simulateTextInput: document.getElementById("simulateTextInput"),
      simulateButton: document.getElementById("simulateButton"),
      dayChartCanvas: document.getElementById("dayChart"),
      langChartCanvas: document.getElementById("langChart"),
      navItems: Array.from(document.querySelectorAll(".nav-item")),
      panels: {
        dashboard: document.getElementById("panel-dashboard"),
        service: document.getElementById("panel-service"),
        operation: document.getElementById("panel-operation"),
        ai: document.getElementById("panel-ai"),
      },
    };

    function setOutput(payload) {
      ui.output.textContent = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    }

    function switchPanel(panelKey) {
      for (const [key, panel] of Object.entries(ui.panels)) panel.classList.toggle("hidden", key !== panelKey);
      for (const item of ui.navItems) item.classList.toggle("active", item.dataset.panel === panelKey);
    }

    async function callApi(path, options = {}) {
      const headers = Object.assign({ "content-type": "application/json", authorization: "Bearer " + state.token }, options.headers || {});
      const response = await fetch("/mgr/api" + path, Object.assign({}, options, { headers }));
      const data = await response.json().catch(() => ({ status: "error", result: "Invalid JSON" }));
      if (response.status === 401) {
        localStorage.removeItem("mgr_token");
        location.href = "/mgr";
      }
      return { response, data };
    }

    function upsertDayChart(day) {
      const chartData = [day.cacheHits, day.cacheMisses, day.aiSuccesses, day.aiFailures];
      const labels = ["Cache Hit", "Cache Miss", "AI Success", "AI Failure"];
      if (!state.dayChart) {
        state.dayChart = new Chart(ui.dayChartCanvas, {
          type: "line",
          data: { labels, datasets: [{ label: "当日", data: chartData, borderColor: "#8b5cf6", backgroundColor: "rgba(139,92,246,0.18)", fill: true, tension: 0.3 }] },
          options: { responsive: true, plugins: { legend: { display: false } } },
        });
        return;
      }
      state.dayChart.data.labels = labels;
      state.dayChart.data.datasets[0].data = chartData;
      state.dayChart.update();
    }

    function upsertLangChart(day) {
      const entries = Object.entries(day.languages || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const labels = entries.map((entry) => entry[0]);
      const values = entries.map((entry) => entry[1]);
      if (!state.langChart) {
        state.langChart = new Chart(ui.langChartCanvas, {
          type: "bar",
          data: { labels, datasets: [{ label: "requests", data: values, backgroundColor: "#a78bfa" }] },
          options: { responsive: true, plugins: { legend: { display: false } } },
        });
        return;
      }
      state.langChart.data.labels = labels;
      state.langChart.data.datasets[0].data = values;
      state.langChart.update();
    }

    async function loadStatus() {
      const { data } = await callApi("/status");
      if (data.status !== "ok") {
        setOutput(data);
        return null;
      }
      ui.kpiEnabled.textContent = data.result.enabled ? "ON" : "OFF";
      ui.kpiRpm.textContent = String(data.result.requestsPerMinute);
      ui.kpiMaxChars.textContent = String(data.result.maxChars);
      ui.enabledInput.value = data.result.enabled ? "1" : "0";
      ui.rpmInput.value = String(data.result.requestsPerMinute);
      ui.maxCharsInput.value = String(data.result.maxChars);
      return data.result;
    }

    async function loadDashboard() {
      const status = await loadStatus();
      const stats = (await callApi("/stats")).data;
      if (stats.status !== "ok" || !status) {
        setOutput(stats);
        return;
      }
      ui.kpiDayRequests.textContent = String(stats.result.day.requestsTotal);
      upsertDayChart(stats.result.day);
      upsertLangChart(stats.result.day);
      setOutput({ status: "ok", result: { status, stats: stats.result } });
    }

    ui.navItems.forEach((item) => item.addEventListener("click", () => switchPanel(item.dataset.panel)));
    ui.logoutButton.addEventListener("click", () => {
      localStorage.removeItem("mgr_token");
      location.href = "/mgr";
    });
    ui.refreshDashboardButton.addEventListener("click", loadDashboard);

    ui.saveConfigButton.addEventListener("click", async () => {
      const payload = {
        enabled: ui.enabledInput.value === "1",
        requestsPerMinute: Number(ui.rpmInput.value),
        maxChars: Number(ui.maxCharsInput.value),
      };
      setOutput((await callApi("/config", { method: "POST", body: JSON.stringify(payload) })).data);
      await loadDashboard();
    });

    ui.statsButton.addEventListener("click", async () => setOutput((await callApi("/stats")).data));
    ui.errorsButton.addEventListener("click", async () => setOutput((await callApi("/errors?limit=10")).data));
    ui.llmButton.addEventListener("click", async () => setOutput((await callApi("/llmrequests?limit=10")).data));
    ui.resetCacheButton.addEventListener("click", async () => {
      if (!confirm("translation_cache を全削除します。よろしいですか？")) return;
      setOutput((await callApi("/resetcache", { method: "POST", body: "{}" })).data);
    });
    ui.pingButton.addEventListener("click", async () => setOutput((await callApi("/ping", { method: "POST", body: "{}" })).data));
    ui.simulateButton.addEventListener("click", async () => {
      const payload = {
        lang: ui.simulateLangInput.value,
        text: ui.simulateTextInput.value,
      };
      setOutput((await callApi("/simulate", { method: "POST", body: JSON.stringify(payload) })).data);
    });

    switchPanel("dashboard");
    loadDashboard();
  </script>
</body>
</html>`;
}
