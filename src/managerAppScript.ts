export const MANAGER_APP_SCRIPT = `
    const PANEL_KEYS = {
      dashboard: "dashboard",
      aiConfig: "ai-config",
      aiOperation: "ai-operation",
      aiTools: "ai-tools",
      docsAi: "docs-ai",
    };

    const state = {
      token: localStorage.getItem("mgr_token") || "",
      globalLoadingCount: 0,
      globalLoadingMessage: "",
      loadedPanels: {},
    };
    if (!state.token) location.href = "/mgr";

    const ui = {
      logoutButton: document.getElementById("logoutButton"),
      refreshDashboardButton: document.getElementById("refreshDashboardButton"),
      kpiEnabled: document.getElementById("kpiEnabled"),
      kpiRpm: document.getElementById("kpiRpm"),
      kpiMaxChars: document.getElementById("kpiMaxChars"),
      kpiRequestsToday: document.getElementById("kpiRequestsToday"),
      statsSummaryText: document.getElementById("statsSummaryText"),
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
      simulateResultBox: document.getElementById("simulateResultBox"),
      simulateResultText: document.getElementById("simulateResultText"),
      dashboardLoadingText: document.getElementById("dashboardLoadingText"),
      docsAiBody: document.getElementById("docsAiBody"),
      navItems: Array.from(document.querySelectorAll(".nav-item")),
      panels: {
        [PANEL_KEYS.dashboard]: document.getElementById("panel-dashboard"),
        [PANEL_KEYS.aiConfig]: document.getElementById("panel-ai-config"),
        [PANEL_KEYS.aiOperation]: document.getElementById("panel-ai-operation"),
        [PANEL_KEYS.aiTools]: document.getElementById("panel-ai-tools"),
        [PANEL_KEYS.docsAi]: document.getElementById("panel-docs-ai"),
      },
      globalLoadingOverlay: document.getElementById("globalLoadingOverlay"),
      globalLoadingText: document.getElementById("globalLoadingText"),
    };

    function invalidatePanels() {
      for (const panelKey of arguments) delete state.loadedPanels[panelKey];
    }

    function setGlobalLoadingVisible(visible) {
      ui.globalLoadingOverlay.classList.toggle("hidden", !visible);
      ui.globalLoadingText.textContent = state.globalLoadingMessage || "読み込み中...";
    }

    function beginGlobalLoading(message) {
      state.globalLoadingCount += 1;
      state.globalLoadingMessage = message || state.globalLoadingMessage || "読み込み中...";
      setGlobalLoadingVisible(true);
    }

    function endGlobalLoading() {
      state.globalLoadingCount = Math.max(0, state.globalLoadingCount - 1);
      if (state.globalLoadingCount > 0) return setGlobalLoadingVisible(true);
      state.globalLoadingMessage = "";
      setGlobalLoadingVisible(false);
    }

    async function callApi(path, options = {}) {
      const requestOptions = Object.assign({}, options);
      const loadingMessage = requestOptions.loadingMessage || "読み込み中...";
      delete requestOptions.loadingMessage;
      const headers = Object.assign({ "content-type": "application/json", authorization: "Bearer " + state.token }, requestOptions.headers || {});
      beginGlobalLoading(loadingMessage);
      try {
        const response = await fetch("/mgr/api" + path, Object.assign({}, requestOptions, { headers }));
        const data = await response.json().catch(() => ({ status: "error", result: "Invalid JSON" }));
        if (response.status === 401) {
          localStorage.removeItem("mgr_token");
          location.href = "/mgr";
        }
        if (data.status !== "ok") console.error("[mgr]", path, data);
        return { response, data };
      } finally {
        endGlobalLoading();
      }
    }

    function switchPanel(panelKey) {
      for (const [key, panel] of Object.entries(ui.panels)) panel.classList.toggle("hidden", key !== panelKey);
      for (const item of ui.navItems) item.classList.toggle("active", item.dataset.panel === panelKey);
    }

    async function switchPanelAndLoad(panelKey, forceReload) {
      switchPanel(panelKey);
      if (!forceReload && state.loadedPanels[panelKey]) return;
      const loader = panelLoaders[panelKey];
      if (!loader) return;
      await loader();
      state.loadedPanels[panelKey] = true;
    }

    async function loadStatus() {
      const result = (await callApi("/status", { loadingMessage: "設定を取得しています..." })).data.result;
      ui.enabledInput.value = result.enabled ? "1" : "0";
      ui.rpmInput.value = String(result.requestsPerMinute);
      ui.maxCharsInput.value = String(result.maxChars);
      return result;
    }

    async function loadStats() {
      return (await callApi("/stats", { loadingMessage: "統計情報を取得しています..." })).data.result;
    }

    async function loadDashboard() {
      ui.dashboardLoadingText.classList.remove("hidden");
      try {
        const [status, stats] = await Promise.all([loadStatus(), loadStats()]);
        ui.kpiEnabled.textContent = status.enabled ? "ON" : "OFF";
        ui.kpiRpm.textContent = String(status.requestsPerMinute);
        ui.kpiMaxChars.textContent = String(status.maxChars);
        ui.kpiRequestsToday.textContent = String(stats.day.requestsTotal || 0);
        ui.statsSummaryText.textContent = JSON.stringify(stats, null, 2);
      } finally {
        ui.dashboardLoadingText.classList.add("hidden");
      }
    }

    async function saveConfig() {
      const result = (await callApi("/config", {
        method: "POST",
        body: JSON.stringify({
          enabled: ui.enabledInput.value === "1",
          requestsPerMinute: Number(ui.rpmInput.value || "6"),
          maxChars: Number(ui.maxCharsInput.value || "300"),
        }),
        loadingMessage: "設定を保存しています...",
      })).data;
      if (result.status !== "ok") return alert("保存に失敗しました。");
      invalidatePanels(PANEL_KEYS.dashboard, PANEL_KEYS.aiConfig);
      await loadStatus();
      alert("設定を保存しました。");
    }

    function showSimulateResult(data) {
      ui.simulateResultBox.classList.remove("hidden");
      ui.simulateResultText.textContent = JSON.stringify(data, null, 2);
    }

    async function loadDocsAi() {
      const result = (await callApi("/docs/ai", { loadingMessage: "説明を取得しています..." })).data.result;
      ui.docsAiBody.innerHTML = "<h3 class='text-sm font-semibold mb-2'>" + result.title + "</h3>" + result.body.map((line) => "<p>" + line + "</p>").join("");
    }

    const panelLoaders = {
      [PANEL_KEYS.dashboard]: loadDashboard,
      [PANEL_KEYS.aiConfig]: loadStatus,
      [PANEL_KEYS.docsAi]: loadDocsAi,
    };

    ui.navItems.forEach((item) => item.addEventListener("click", async () => await switchPanelAndLoad(item.dataset.panel, false)));
    ui.logoutButton.addEventListener("click", () => {
      localStorage.removeItem("mgr_token");
      location.href = "/mgr";
    });
    ui.refreshDashboardButton.addEventListener("click", async () => {
      invalidatePanels(PANEL_KEYS.dashboard);
      await switchPanelAndLoad(PANEL_KEYS.dashboard, true);
    });
    ui.saveConfigButton.addEventListener("click", saveConfig);
    ui.statsButton.addEventListener("click", async () => showSimulateResult(await loadStats()));
    ui.errorsButton.addEventListener("click", async () => showSimulateResult((await callApi("/errors?limit=10", { loadingMessage: "エラーログを取得しています..." })).data.result));
    ui.llmButton.addEventListener("click", async () => showSimulateResult((await callApi("/llmrequests?limit=10", { loadingMessage: "LLMログを取得しています..." })).data.result));
    ui.resetCacheButton.addEventListener("click", async () => confirm("translation_cache を全削除します。よろしいですか？") ? showSimulateResult((await callApi("/resetcache", { method: "POST", body: "{}", loadingMessage: "翻訳キャッシュ削除を開始しています..." })).data.result) : null);
    ui.pingButton.addEventListener("click", async () => showSimulateResult((await callApi("/ping", { method: "POST", body: "{}", loadingMessage: "AI へ疎通確認しています..." })).data.result));
    ui.simulateButton.addEventListener("click", async () => {
      const result = (await callApi("/simulate", {
        method: "POST",
        body: JSON.stringify({ lang: ui.simulateLangInput.value.trim(), text: ui.simulateTextInput.value.trim() }),
        loadingMessage: "simulate を実行しています...",
      })).data;
      showSimulateResult(result);
    });

    switchPanel(PANEL_KEYS.dashboard);
    switchPanelAndLoad(PANEL_KEYS.dashboard, false);
`;
