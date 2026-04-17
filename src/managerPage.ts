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
      --mgr-danger: #dc2626;
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
      </nav>
      <div class="pt-2 border-t border-violet-100">
        <p class="text-xs font-semibold text-[color:var(--mgr-muted)] mb-1">AIサービス</p>
        <button class="nav-item" data-panel="ai-config">サービス設定</button>
        <button class="nav-item" data-panel="ai-operation">運用操作</button>
        <button class="nav-item" data-panel="ai-tools">AI疎通 / simulate</button>
        <button class="nav-item" data-panel="docs-ai">説明ページ</button>
      </div>
      <div class="pt-2 border-t border-violet-100">
        <p class="text-xs font-semibold text-[color:var(--mgr-muted)] mb-1">PromotionList</p>
        <button class="nav-item" data-panel="promotion-manage">項目管理</button>
        <button class="nav-item" data-panel="docs-promotion">説明ページ</button>
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
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">AI サービス状態</p><p id="kpiEnabled" class="text-lg font-bold">-</p></div>
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">1分上限</p><p id="kpiRpm" class="text-lg font-bold">-</p></div>
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">最大文字数</p><p id="kpiMaxChars" class="text-lg font-bold">-</p></div>
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">PromotionList 使用率</p><p id="kpiPromotionUsage" class="text-lg font-bold">-</p></div>
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

      <section id="panel-ai-config" class="card p-5 space-y-4 hidden">
        <h2 class="text-xl font-bold">AIサービス / サービス設定</h2>
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

      <section id="panel-ai-operation" class="card p-5 space-y-3 hidden">
        <h2 class="text-xl font-bold">AIサービス / 運用操作</h2>
        <div class="flex flex-wrap gap-2">
          <button id="statsButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">統計取得</button>
          <button id="errorsButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">エラーログ取得</button>
          <button id="llmButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">LLMログ取得</button>
          <button id="resetCacheButton" class="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold">翻訳キャッシュ全削除</button>
        </div>
      </section>

      <section id="panel-ai-tools" class="card p-5 space-y-3 hidden">
        <h2 class="text-xl font-bold">AIサービス / AI疎通</h2>
        <div class="flex gap-2">
          <button id="pingButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">AI Ping</button>
        </div>
        <div class="grid md:grid-cols-3 gap-3">
          <input id="simulateLangInput" placeholder="言語コード (例: ja_JP)" class="border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
          <input id="simulateTextInput" placeholder="翻訳対象テキスト" class="md:col-span-2 border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
        </div>
        <button id="simulateButton" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">simulate 実行</button>
      </section>

      <section id="panel-promotion-manage" class="card p-5 space-y-4 hidden">
        <h2 class="text-xl font-bold">PromotionList / 項目管理</h2>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold">API 使用率（上限 100MB）</p>
            <button id="refreshPromotionUsageButton" class="px-3 py-1 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold">再計算</button>
          </div>
          <div class="w-full h-4 bg-violet-100 rounded-full overflow-hidden">
            <div id="promotionUsageBar" class="h-full bg-violet-500" style="width: 0%"></div>
          </div>
          <p id="promotionUsageText" class="text-xs text-[color:var(--mgr-muted)]">0 / 100MB</p>
          <p id="promotionPredictionText" class="text-xs text-[color:var(--mgr-muted)]">追加予測: 0MB</p>
        </div>

        <div class="grid md:grid-cols-2 gap-3">
          <label class="text-sm">Type
            <select id="promotionTypeInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]">
              <option value="Avatar">Avatar</option>
              <option value="World">World</option>
            </select>
          </label>
          <label class="text-sm">ID
            <input id="promotionIdInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
          </label>
          <label class="text-sm">Title
            <input id="promotionTitleInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
          </label>
          <label class="text-sm">Anchor
            <input id="promotionAnchorInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
          </label>
          <label class="text-sm md:col-span-2">Description
            <textarea id="promotionDescriptionInput" rows="3" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]"></textarea>
          </label>
          <label class="text-sm md:col-span-2">Link
            <input id="promotionLinkInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
          </label>
          <label class="text-sm md:col-span-2">Image (Base64)
            <textarea id="promotionImageInput" rows="4" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]"></textarea>
          </label>
          <label class="text-sm md:col-span-2">画像アップロード
            <input id="promotionImageFileInput" type="file" accept="image/*" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)] bg-white" />
          </label>
        </div>
        <div class="flex gap-2">
          <button id="promotionAddButton" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">追加</button>
          <button id="promotionReloadButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">一覧再読込</button>
        </div>
        <div class="card p-3">
          <h3 class="text-sm font-semibold mb-2">登録済み項目</h3>
          <div id="promotionItemsList" class="space-y-2 text-sm"></div>
        </div>
      </section>

      <section id="panel-docs-ai" class="card p-5 hidden">
        <h2 class="text-xl font-bold mb-3">AIサービス 説明ページ</h2>
        <div id="docsAiBody" class="text-sm space-y-1 text-[color:var(--mgr-text)]"></div>
      </section>

      <section id="panel-docs-promotion" class="card p-5 hidden">
        <h2 class="text-xl font-bold mb-3">PromotionList 説明ページ</h2>
        <div id="docsPromotionBody" class="text-sm space-y-1 text-[color:var(--mgr-text)]"></div>
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
    const MAX_PROMOTION_BYTES = 100 * 1024 * 1024;
    const state = {
      token: localStorage.getItem("mgr_token") || "",
      dayChart: null,
      langChart: null,
      promotionUsage: { usedBytes: 0, maxBytes: MAX_PROMOTION_BYTES, usedPercent: 0 },
      promotionItems: [],
    };
    if (!state.token) location.href = "/mgr";

    const ui = {
      output: document.getElementById("output"),
      logoutButton: document.getElementById("logoutButton"),
      refreshDashboardButton: document.getElementById("refreshDashboardButton"),
      kpiEnabled: document.getElementById("kpiEnabled"),
      kpiRpm: document.getElementById("kpiRpm"),
      kpiMaxChars: document.getElementById("kpiMaxChars"),
      kpiPromotionUsage: document.getElementById("kpiPromotionUsage"),
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
        "ai-config": document.getElementById("panel-ai-config"),
        "ai-operation": document.getElementById("panel-ai-operation"),
        "ai-tools": document.getElementById("panel-ai-tools"),
        "promotion-manage": document.getElementById("panel-promotion-manage"),
        "docs-ai": document.getElementById("panel-docs-ai"),
        "docs-promotion": document.getElementById("panel-docs-promotion"),
      },
      refreshPromotionUsageButton: document.getElementById("refreshPromotionUsageButton"),
      promotionUsageBar: document.getElementById("promotionUsageBar"),
      promotionUsageText: document.getElementById("promotionUsageText"),
      promotionPredictionText: document.getElementById("promotionPredictionText"),
      promotionTypeInput: document.getElementById("promotionTypeInput"),
      promotionIdInput: document.getElementById("promotionIdInput"),
      promotionTitleInput: document.getElementById("promotionTitleInput"),
      promotionAnchorInput: document.getElementById("promotionAnchorInput"),
      promotionDescriptionInput: document.getElementById("promotionDescriptionInput"),
      promotionLinkInput: document.getElementById("promotionLinkInput"),
      promotionImageInput: document.getElementById("promotionImageInput"),
      promotionImageFileInput: document.getElementById("promotionImageFileInput"),
      promotionAddButton: document.getElementById("promotionAddButton"),
      promotionReloadButton: document.getElementById("promotionReloadButton"),
      promotionItemsList: document.getElementById("promotionItemsList"),
      docsAiBody: document.getElementById("docsAiBody"),
      docsPromotionBody: document.getElementById("docsPromotionBody"),
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

    function readPromotionForm() {
      return {
        type: ui.promotionTypeInput.value,
        item: {
          ID: ui.promotionIdInput.value.trim(),
          Title: ui.promotionTitleInput.value.trim(),
          Anchor: ui.promotionAnchorInput.value.trim(),
          Description: ui.promotionDescriptionInput.value.trim(),
          Link: ui.promotionLinkInput.value.trim(),
          Image: ui.promotionImageInput.value.trim(),
        },
      };
    }

    function estimatePromotionBytes(payload) {
      return new Blob([JSON.stringify(payload)]).size;
    }

    function refreshPromotionPrediction() {
      const payload = readPromotionForm().item;
      const predicted = estimatePromotionBytes(payload);
      const total = state.promotionUsage.usedBytes + predicted;
      const totalMB = (total / (1024 * 1024)).toFixed(2);
      const predictedMB = (predicted / (1024 * 1024)).toFixed(2);
      ui.promotionPredictionText.textContent = "追加予測: " + predictedMB + "MB / 追加後合計: " + totalMB + "MB";
      ui.promotionPredictionText.style.color = total > MAX_PROMOTION_BYTES ? "var(--mgr-danger)" : "var(--mgr-muted)";
      return { predicted, total };
    }

    function renderPromotionUsage() {
      const usedMB = (state.promotionUsage.usedBytes / (1024 * 1024)).toFixed(2);
      const maxMB = (state.promotionUsage.maxBytes / (1024 * 1024)).toFixed(0);
      ui.promotionUsageText.textContent = usedMB + "MB / " + maxMB + "MB";
      ui.promotionUsageBar.style.width = Math.min(100, state.promotionUsage.usedPercent) + "%";
      ui.kpiPromotionUsage.textContent = state.promotionUsage.usedPercent.toFixed(2) + "%";
      refreshPromotionPrediction();
    }

    function renderPromotionItems() {
      if (!state.promotionItems.length) {
        ui.promotionItemsList.textContent = "登録項目はありません。";
        return;
      }
      ui.promotionItemsList.innerHTML = state.promotionItems.map((item) => {
        return '<div class="card p-2 flex items-center justify-between gap-2"><div><p class="font-semibold">' + item.Type + ' / ' + item.Title + '</p><p class="text-xs text-[color:var(--mgr-muted)]">ID: ' + item.ID + '</p></div><button class="px-2 py-1 rounded bg-red-100 text-red-700 text-xs" data-promotion-delete="' + item.ID + '">削除</button></div>';
      }).join("");
      Array.from(ui.promotionItemsList.querySelectorAll("[data-promotion-delete]")).forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.getAttribute("data-promotion-delete");
          if (!id) return;
          if (!confirm("ID " + id + " を削除しますか？")) return;
          const result = (await callApi("/promotion/items/delete", { method: "POST", body: JSON.stringify({ id }) })).data;
          setOutput(result);
          await loadPromotionData();
        });
      });
    }

    async function loadPromotionData() {
      const usageResult = (await callApi("/promotion/usage")).data;
      if (usageResult.status === "ok") {
        state.promotionUsage = usageResult.result;
        renderPromotionUsage();
      } else {
        setOutput(usageResult);
      }

      const itemsResult = (await callApi("/promotion/items")).data;
      if (itemsResult.status === "ok") {
        state.promotionItems = itemsResult.result;
        renderPromotionItems();
      } else {
        setOutput(itemsResult);
      }
    }

    async function loadDocs() {
      const aiDocs = (await callApi("/docs/ai")).data;
      if (aiDocs.status === "ok") {
        ui.docsAiBody.innerHTML = aiDocs.result.body.map((line) => '<p>' + line + '</p>').join('');
      }
      const promotionDocs = (await callApi("/docs/promotion")).data;
      if (promotionDocs.status === "ok") {
        ui.docsPromotionBody.innerHTML = promotionDocs.result.body.map((line) => '<p>' + line + '</p>').join('');
      }
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
      upsertDayChart(stats.result.day);
      upsertLangChart(stats.result.day);
      await loadPromotionData();
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

    ui.promotionImageFileInput.addEventListener("change", async () => {
      const file = ui.promotionImageFileInput.files && ui.promotionImageFileInput.files[0];
      if (!file) return;
      const text = await file.arrayBuffer();
      const bytes = new Uint8Array(text);
      let binary = "";
      for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
      ui.promotionImageInput.value = btoa(binary);
      refreshPromotionPrediction();
    });

    [
      ui.promotionIdInput,
      ui.promotionTitleInput,
      ui.promotionAnchorInput,
      ui.promotionDescriptionInput,
      ui.promotionLinkInput,
      ui.promotionImageInput,
    ].forEach((input) => input.addEventListener("input", refreshPromotionPrediction));

    ui.promotionAddButton.addEventListener("click", async () => {
      const payload = readPromotionForm();
      const prediction = refreshPromotionPrediction();
      if (prediction.total > MAX_PROMOTION_BYTES) {
        setOutput({ status: "error", result: "予測サイズが 100MB を超えるため追加を拒否しました。" });
        return;
      }
      const result = (await callApi("/promotion/items", {
        method: "POST",
        body: JSON.stringify({
          type: payload.type,
          item: payload.item,
          predictedBytes: prediction.predicted,
        }),
      })).data;
      setOutput(result);
      if (result.status === "ok") {
        ui.promotionIdInput.value = "";
        ui.promotionTitleInput.value = "";
        ui.promotionAnchorInput.value = "";
        ui.promotionDescriptionInput.value = "";
        ui.promotionLinkInput.value = "";
        ui.promotionImageInput.value = "";
      }
      await loadPromotionData();
    });

    ui.promotionReloadButton.addEventListener("click", loadPromotionData);
    ui.refreshPromotionUsageButton.addEventListener("click", loadPromotionData);

    switchPanel("dashboard");
    loadDashboard();
    loadDocs();
  </script>
</body>
</html>`;
}
