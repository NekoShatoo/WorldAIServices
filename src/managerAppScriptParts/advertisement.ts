export const MANAGER_APP_SCRIPT_ADVERTISEMENT = `
    function getAdvertisementItemById(id) {
      return state.advertisementItems.find((item) => item.ID === id) || null;
    }

    async function loadAdvertisementScopes() {
      const result = (await callApi("/advertisement/scopes", { loadingMessage: "Advertisement Scope 一覧を読み込んでいます..." })).data;
      if (result.status !== "ok") return;
      state.advertisementScopes = result.result;
      if (!state.advertisementScopes.length) {
        state.advertisementScopeId = "";
        ui.advertisementScopeSelect.innerHTML = "";
        return;
      }
      if (!state.advertisementScopes.some((scope) => scope.ID === state.advertisementScopeId)) state.advertisementScopeId = state.advertisementScopes[0].ID;
      ui.advertisementScopeSelect.innerHTML = state.advertisementScopes.map((scope) => '<option value="' + escapeHtml(scope.ID) + '">' + escapeHtml(scope.ScopeKey + " / " + scope.Name) + '</option>').join("");
      ui.advertisementScopeSelect.value = state.advertisementScopeId;
    }

    async function loadAdvertisementUsage() {
      const usageResult = (await callApi("/advertisement/usage", { loadingMessage: "Advertisement の使用率を計算しています..." })).data;
      if (usageResult.status === "ok") {
        state.advertisementUsage = usageResult.result;
        renderAdvertisementUsage();
      }
    }

    function renderAdvertisementUsage() {
      const maxBytesText = (state.advertisementUsage.maxBytes / (1024 * 1024)).toFixed(0) + "MB";
      ui.advertisementUsageTextPc.textContent = (state.advertisementUsage.platforms.pc.usedBytes / (1024 * 1024)).toFixed(2) + "MB / " + maxBytesText;
      ui.advertisementUsageTextAndroid.textContent = (state.advertisementUsage.platforms.android.usedBytes / (1024 * 1024)).toFixed(2) + "MB / " + maxBytesText;
      ui.advertisementUsageTextIos.textContent = (state.advertisementUsage.platforms.ios.usedBytes / (1024 * 1024)).toFixed(2) + "MB / " + maxBytesText;
      ui.advertisementUsageBarPc.style.width = Math.min(100, state.advertisementUsage.platforms.pc.usedPercent) + "%";
      ui.advertisementUsageBarAndroid.style.width = Math.min(100, state.advertisementUsage.platforms.android.usedPercent) + "%";
      ui.advertisementUsageBarIos.style.width = Math.min(100, state.advertisementUsage.platforms.ios.usedPercent) + "%";
      ui.advertisementUsageTextTotal.textContent = "合計: " + (state.advertisementUsage.total.usedBytes / (1024 * 1024)).toFixed(2) + "MB";
    }

    async function loadAdvertisementItems() {
      if (!state.advertisementScopeId) {
        state.advertisementItems = [];
        ui.advertisementItemsList.innerHTML = '<p class="text-sm text-[color:var(--mgr-muted)]">Scope がありません。</p>';
        return;
      }
      setSectionLoading(ui.advertisementItemsList, ui.advertisementLoadingText, true, "一覧を読み込み中...");
      try {
        const itemsResult = (await callApi("/advertisement/items?scopeId=" + encodeURIComponent(state.advertisementScopeId), { loadingMessage: "Advertisement 一覧を読み込んでいます..." })).data;
        if (itemsResult.status === "ok") {
          state.advertisementItems = itemsResult.result;
          if (!state.advertisementSortEditMode) state.advertisementSortDraftIds = state.advertisementItems.map((item) => item.ID);
          renderAdvertisementItems();
        }
      } finally {
        setSectionLoading(ui.advertisementItemsList, ui.advertisementLoadingText, false);
      }
    }

    async function loadAdvertisementItemDetail(id) {
      const result = (await callApi("/advertisement/items/detail?id=" + encodeURIComponent(id), { loadingMessage: "項目詳細を読み込んでいます..." })).data;
      if (result.status !== "ok") return null;
      state.currentAdvertisementDetail = result.result;
      return result.result;
    }

    async function loadAdvertisementGistStatus() {
      if (!state.advertisementScopeId) {
        state.advertisementGistStatus.platforms = { pc: null, android: null, ios: null };
        renderAdvertisementGistStatus();
        return;
      }
      setSectionLoading(ui.advertisementGistStatusList, null, true);
      try {
        const result = (await callApi("/advertisement/gist/status?scopeId=" + encodeURIComponent(state.advertisementScopeId), { loadingMessage: "Advertisement の Gist 状態を読み込んでいます...", skipGlobalLoading: true })).data;
        if (result.status !== "ok") return;
        state.advertisementGistStatus = result.result;
        renderAdvertisementGistStatus();
      } finally {
        setSectionLoading(ui.advertisementGistStatusList, null, false);
      }
    }

    async function loadAdvertisementManageData(forceReloadUsage) {
      await loadAdvertisementScopes();
      if (forceReloadUsage) await loadAdvertisementUsage();
      await loadAdvertisementGistStatus();
      await loadAdvertisementItems();
    }

    async function loadStatus() {
      const result = (await callApi("/status", { loadingMessage: "設定情報を読み込んでいます..." })).data;
      if (result.status !== "ok") return null;
      ui.kpiEnabled.textContent = result.result.enabled ? "ON" : "OFF";
      ui.kpiRpm.textContent = String(result.result.requestsPerMinute);
      ui.kpiMaxChars.textContent = String(result.result.maxChars);
      ui.enabledInput.value = result.result.enabled ? "1" : "0";
      ui.rpmInput.value = String(result.result.requestsPerMinute);
      ui.maxCharsInput.value = String(result.result.maxChars);
      return result.result;
    }

    function upsertDayChart(day) {
      const labels = ["Cache Hit", "Cache Miss", "AI Success", "AI Failure"];
      const values = [day.cacheHits, day.cacheMisses, day.aiSuccesses, day.aiFailures];
      if (!state.dayChart) {
        state.dayChart = new Chart(ui.dayChartCanvas, { type: "line", data: { labels, datasets: [{ data: values, borderColor: "#8b5cf6", backgroundColor: "rgba(139,92,246,0.18)", fill: true, tension: 0.3 }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
        return;
      }
      state.dayChart.data.labels = labels;
      state.dayChart.data.datasets[0].data = values;
      state.dayChart.update();
    }

    function upsertLangChart(day) {
      const entries = Object.entries(day.languages || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const labels = entries.map((item) => item[0]);
      const values = entries.map((item) => item[1]);
      if (!state.langChart) {
        state.langChart = new Chart(ui.langChartCanvas, { type: "bar", data: { labels, datasets: [{ data: values, backgroundColor: "#a78bfa" }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
        return;
      }
      state.langChart.data.labels = labels;
      state.langChart.data.datasets[0].data = values;
      state.langChart.update();
    }

    async function loadDashboard() {
      setSectionLoading(ui.dayChartCanvas, ui.dashboardLoadingText, true, "Dashboard を読み込み中...");
      setSectionLoading(ui.langChartCanvas, null, true);
      try {
        const status = await loadStatus();
        const stats = (await callApi("/stats", { loadingMessage: "統計情報を読み込んでいます..." })).data;
        if (stats.status === "ok" && status) {
          upsertDayChart(stats.result.day);
          upsertLangChart(stats.result.day);
        }
        await loadPromotionUsage();
      } finally {
        setSectionLoading(ui.dayChartCanvas, ui.dashboardLoadingText, false);
        setSectionLoading(ui.langChartCanvas, null, false);
      }
    }

    function createDocsLoader(targetElement, path, loadingMessage) {
      return async function() {
        setSectionLoading(targetElement, null, true);
        targetElement.innerHTML = '<p class="text-[color:var(--mgr-muted)]">説明を読み込み中...</p>';
        try {
          const result = (await callApi(path, { loadingMessage })).data;
          if (result.status === "ok") targetElement.innerHTML = result.result.body.map((line) => '<p>' + line + '</p>').join('');
        } finally {
          setSectionLoading(targetElement, null, false);
        }
      };
    }

`;
