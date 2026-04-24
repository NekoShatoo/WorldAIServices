export const MANAGER_APP_SCRIPT = `
    const MAX_PROMOTION_BYTES = 100 * 1024 * 1024;
    const PANEL_KEYS = {
      dashboard: "dashboard",
      aiConfig: "ai-config",
      aiOperation: "ai-operation",
      aiTools: "ai-tools",
      promotionManage: "promotion-manage",
      promotionApiSetting: "promotion-api-setting",
      docsAi: "docs-ai",
      docsPromotion: "docs-promotion",
    };
    const PROMOTION_MODAL_MODE = {
      create: "create",
      edit: "edit",
    };

    const state = {
      token: localStorage.getItem("mgr_token") || "",
      globalLoadingCount: 0,
      globalLoadingMessage: "",
      loadedPanels: {},
      dayChart: null,
      langChart: null,
      promotionUsage: { usedBytes: 0, maxBytes: MAX_PROMOTION_BYTES, usedPercent: 0 },
      promotionItems: [],
      promotionModalMode: PROMOTION_MODAL_MODE.create,
      promotionEditingId: "",
      promotionUploadedImageDataUrl: "",
      promotionSortEditMode: false,
      promotionSortDraftIds: [],
      promotionDragAutoScrollRaf: 0,
      promotionDragAutoScrollSpeed: 0,
      promotionThumbRenderToken: 0,
      promotionApiConfig: { includeImageInResponse: true },
    };
    if (!state.token) location.href = "/mgr";

    const ui = {
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
      simulateResultBox: document.getElementById("simulateResultBox"),
      simulateResultText: document.getElementById("simulateResultText"),
      dayChartCanvas: document.getElementById("dayChart"),
      langChartCanvas: document.getElementById("langChart"),
      dashboardLoadingText: document.getElementById("dashboardLoadingText"),
      navItems: Array.from(document.querySelectorAll(".nav-item")),
      panels: {
        [PANEL_KEYS.dashboard]: document.getElementById("panel-dashboard"),
        [PANEL_KEYS.aiConfig]: document.getElementById("panel-ai-config"),
        [PANEL_KEYS.aiOperation]: document.getElementById("panel-ai-operation"),
        [PANEL_KEYS.aiTools]: document.getElementById("panel-ai-tools"),
        [PANEL_KEYS.promotionManage]: document.getElementById("panel-promotion-manage"),
        [PANEL_KEYS.promotionApiSetting]: document.getElementById("panel-promotion-api-setting"),
        [PANEL_KEYS.docsAi]: document.getElementById("panel-docs-ai"),
        [PANEL_KEYS.docsPromotion]: document.getElementById("panel-docs-promotion"),
      },
      refreshPromotionUsageButton: document.getElementById("refreshPromotionUsageButton"),
      promotionUsageBar: document.getElementById("promotionUsageBar"),
      promotionUsageText: document.getElementById("promotionUsageText"),
      promotionLoadingText: document.getElementById("promotionLoadingText"),
      promotionItemsList: document.getElementById("promotionItemsList"),
      promotionCreateOpenButton: document.getElementById("promotionCreateOpenButton"),
      promotionReloadButton: document.getElementById("promotionReloadButton"),
      promotionFilterType: document.getElementById("promotionFilterType"),
      promotionSortEditButton: document.getElementById("promotionSortEditButton"),
      promotionSortSaveButton: document.getElementById("promotionSortSaveButton"),
      promotionSortCancelButton: document.getElementById("promotionSortCancelButton"),
      promotionSortHint: document.getElementById("promotionSortHint"),
      promotionIncludeImageInput: document.getElementById("promotionIncludeImageInput"),
      promotionSaveApiSettingButton: document.getElementById("promotionSaveApiSettingButton"),
      docsAiBody: document.getElementById("docsAiBody"),
      docsPromotionBody: document.getElementById("docsPromotionBody"),
      promotionModal: document.getElementById("promotionModal"),
      promotionModalTitle: document.getElementById("promotionModalTitle"),
      promotionModalCloseButton: document.getElementById("promotionModalCloseButton"),
      promotionModalCancelButton: document.getElementById("promotionModalCancelButton"),
      promotionModalSubmitButton: document.getElementById("promotionModalSubmitButton"),
      promotionSubmitProgressBox: document.getElementById("promotionSubmitProgressBox"),
      promotionSubmitProgressText: document.getElementById("promotionSubmitProgressText"),
      promotionSubmitProgressBar: document.getElementById("promotionSubmitProgressBar"),
      promotionPredictionText: document.getElementById("promotionPredictionText"),
      promotionCompressEnabled: document.getElementById("promotionCompressEnabled"),
      promotionCompressMaxSize: document.getElementById("promotionCompressMaxSize"),
      promotionImageSizeWarning: document.getElementById("promotionImageSizeWarning"),
      promotionTypeInput: document.getElementById("promotionTypeInput"),
      promotionIdInput: document.getElementById("promotionIdInput"),
      promotionTitleInput: document.getElementById("promotionTitleInput"),
      promotionAnchorInput: document.getElementById("promotionAnchorInput"),
      promotionDescriptionInput: document.getElementById("promotionDescriptionInput"),
      promotionLinkInput: document.getElementById("promotionLinkInput"),
      promotionImageInput: document.getElementById("promotionImageInput"),
      promotionImageFileInput: document.getElementById("promotionImageFileInput"),
      promotionImagePreviewContainer: document.getElementById("promotionImagePreviewContainer"),
      promotionImagePreview: document.getElementById("promotionImagePreview"),
      promotionImageMagnifierLens: document.getElementById("promotionImageMagnifierLens"),
      promotionImagePreviewOpenButton: document.getElementById("promotionImagePreviewOpenButton"),
      promotionImagePreviewModal: document.getElementById("promotionImagePreviewModal"),
      promotionImagePreviewLarge: document.getElementById("promotionImagePreviewLarge"),
      promotionImagePreviewCloseButton: document.getElementById("promotionImagePreviewCloseButton"),
      globalLoadingOverlay: document.getElementById("globalLoadingOverlay"),
      globalLoadingText: document.getElementById("globalLoadingText"),
    };

    function invalidatePanels() {
      for (const panelKey of arguments) delete state.loadedPanels[panelKey];
    }

    async function withButtonDisabled(button, callback) {
      button.disabled = true;
      try {
        await callback();
      } finally {
        button.disabled = false;
      }
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
      if (state.globalLoadingCount > 0) {
        setGlobalLoadingVisible(true);
        return;
      }
      state.globalLoadingMessage = "";
      setGlobalLoadingVisible(false);
    }

    function setSectionLoading(element, loadingTextElement, loading, text) {
      if (element) element.classList.toggle("section-loading", !!loading);
      if (!loadingTextElement) return;
      loadingTextElement.classList.toggle("hidden", !loading);
      if (loading && text) loadingTextElement.textContent = text;
    }

    async function callApi(path, options = {}) {
      const requestOptions = Object.assign({}, options);
      const loadingMessage = requestOptions.loadingMessage || "読み込み中...";
      const skipGlobalLoading = !!requestOptions.skipGlobalLoading;
      delete requestOptions.loadingMessage;
      delete requestOptions.skipGlobalLoading;

      const headers = Object.assign({ "content-type": "application/json", authorization: "Bearer " + state.token }, requestOptions.headers || {});
      if (!skipGlobalLoading) beginGlobalLoading(loadingMessage);
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
        if (!skipGlobalLoading) endGlobalLoading();
      }
    }

    function switchPanel(panelKey) {
      for (const [key, panel] of Object.entries(ui.panels)) panel.classList.toggle("hidden", key !== panelKey);
      for (const item of ui.navItems) item.classList.toggle("active", item.dataset.panel === panelKey);
    }

    async function switchPanelAndLoad(panelKey, forceReload) {
      switchPanel(panelKey);
      await ensurePanelData(panelKey, !!forceReload);
    }

    function showSimulateResult(data) {
      ui.simulateResultBox.classList.remove("hidden");
      ui.simulateResultText.textContent = JSON.stringify(data, null, 2);
    }

    function getPromotionItemDataUrl(item) {
      const raw = String(item && item.Image ? item.Image : "").trim();
      if (!raw) return "";
      if (raw.startsWith("data:image/")) return raw;
      return "data:image/*;base64," + raw;
    }

    function estimatePromotionBytes(payload) {
      return new Blob([JSON.stringify(payload)]).size;
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

    function refreshPromotionPrediction() {
      const payload = readPromotionForm().item;
      const predicted = estimatePromotionBytes(payload);
      const total = state.promotionUsage.usedBytes + predicted;
      ui.promotionPredictionText.textContent = "追加予測: " + (predicted / (1024 * 1024)).toFixed(2) + "MB / 追加後合計: " + (total / (1024 * 1024)).toFixed(2) + "MB";
      ui.promotionPredictionText.style.color = total > MAX_PROMOTION_BYTES ? "var(--mgr-danger)" : "var(--mgr-muted)";
      return { predicted, total };
    }

    function setPromotionImagePreview(base64Text) {
      const normalized = String(base64Text || "").trim();
      if (!normalized) {
        ui.promotionImagePreviewContainer.classList.add("hidden");
        ui.promotionImagePreviewOpenButton.classList.add("hidden");
        ui.promotionImagePreview.removeAttribute("src");
        ui.promotionImagePreviewLarge.removeAttribute("src");
        hidePromotionMagnifier();
        return;
      }
      const source = "data:image/*;base64," + normalized;
      ui.promotionImagePreview.src = source;
      ui.promotionImagePreviewLarge.src = source;
      ui.promotionImagePreviewContainer.classList.remove("hidden");
      ui.promotionImagePreviewOpenButton.classList.remove("hidden");
      hidePromotionMagnifier();
    }

    function hidePromotionMagnifier() {
      ui.promotionImageMagnifierLens.classList.add("hidden");
    }

    function handlePromotionMagnifierMove(event) {
      if (!ui.promotionImagePreview.getAttribute("src")) return;

      const rect = ui.promotionImagePreview.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        hidePromotionMagnifier();
        return;
      }

      const lens = ui.promotionImageMagnifierLens;
      const lensSize = 112;
      const zoom = 2.5;
      const half = lensSize / 2;
      const boundedLeft = Math.max(0, Math.min(rect.width - lensSize, x - half));
      const boundedTop = Math.max(0, Math.min(rect.height - lensSize, y - half));
      lens.style.left = boundedLeft + "px";
      lens.style.top = boundedTop + "px";
      lens.style.backgroundImage = "url('" + ui.promotionImagePreview.src + "')";
      lens.style.backgroundSize = (rect.width * zoom) + "px " + (rect.height * zoom) + "px";
      lens.style.backgroundPosition = (-(x * zoom - half)) + "px " + (-(y * zoom - half)) + "px";
      lens.style.backgroundColor = "#ffffffdd";
      lens.classList.remove("hidden");
    }

    function updatePromotionImageSizeWarning() {
      const selectedMax = Number(ui.promotionCompressMaxSize.value || "512");
      ui.promotionImageSizeWarning.classList.toggle("hidden", selectedMax <= 512);
    }

    function normalizeImageValueToDataUrl(value) {
      const normalized = String(value || "").trim();
      if (!normalized) return "";
      if (normalized.startsWith("data:image/")) return normalized;
      return "data:image/*;base64," + normalized;
    }

    async function fileToDataUrl(file) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
      return "data:image/*;base64," + btoa(binary);
    }

    async function dataUrlToImage(source) {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("image_load_failed"));
        image.src = source;
      });
    }

    function imageToBase64(image, maxSize, enableCompress) {
      const sourceWidth = Number(image.width);
      const sourceHeight = Number(image.height);
      const sourceLong = Math.max(sourceWidth, sourceHeight);
      let targetWidth = sourceWidth;
      let targetHeight = sourceHeight;
      if (enableCompress && sourceLong > maxSize) {
        const ratio = maxSize / sourceLong;
        targetWidth = Math.max(1, Math.round(sourceWidth * ratio));
        targetHeight = Math.max(1, Math.round(sourceHeight * ratio));
      }
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas_context_missing");
      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      return canvas.toDataURL("image/png").split(",")[1] || "";
    }

    async function reapplyImageCompression() {
      const source = state.promotionUploadedImageDataUrl || normalizeImageValueToDataUrl(ui.promotionImageInput.value);
      if (!source) return;

      const maxSize = Number(ui.promotionCompressMaxSize.value || "512");
      const enableCompress = ui.promotionCompressEnabled.checked;
      try {
        const image = await dataUrlToImage(source);
        ui.promotionImageInput.value = imageToBase64(image, maxSize, enableCompress);
      } catch (error) {
        console.error("[mgr] 画像再圧縮に失敗しました", error);
      }
      setPromotionImagePreview(ui.promotionImageInput.value);
      refreshPromotionPrediction();
    }

    function renderPromotionUsage() {
      ui.promotionUsageText.textContent = (state.promotionUsage.usedBytes / (1024 * 1024)).toFixed(2) + "MB / " + (state.promotionUsage.maxBytes / (1024 * 1024)).toFixed(0) + "MB";
      ui.promotionUsageBar.style.width = Math.min(100, state.promotionUsage.usedPercent) + "%";
      ui.kpiPromotionUsage.textContent = state.promotionUsage.usedPercent.toFixed(2) + "%";
    }

    function setPromotionSubmitProgress(percent, text) {
      const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
      ui.promotionSubmitProgressBox.classList.remove("hidden");
      ui.promotionSubmitProgressBar.style.width = normalized + "%";
      ui.promotionSubmitProgressText.textContent = text;
    }

    function beginPromotionSubmitProgress() {
      ui.promotionModalSubmitButton.disabled = true;
      ui.promotionModalCancelButton.disabled = true;
      ui.promotionModalCloseButton.disabled = true;
      ui.promotionModalSubmitButton.classList.add("opacity-70", "cursor-not-allowed");
      setPromotionSubmitProgress(8, "送信を開始しています...");
    }

    function endPromotionSubmitProgress() {
      ui.promotionModalSubmitButton.disabled = false;
      ui.promotionModalCancelButton.disabled = false;
      ui.promotionModalCloseButton.disabled = false;
      ui.promotionModalSubmitButton.classList.remove("opacity-70", "cursor-not-allowed");
      ui.promotionSubmitProgressBar.style.width = "0%";
      ui.promotionSubmitProgressText.textContent = "送信準備中...";
      ui.promotionSubmitProgressBox.classList.add("hidden");
    }

    function getPromotionSourceItems() {
      return state.promotionSortEditMode
        ? state.promotionSortDraftIds.map((id) => state.promotionItems.find((item) => item.ID === id)).filter(Boolean)
        : state.promotionItems;
    }

    function buildPromotionThumbUi(imageDataUrl, itemId) {
      if (!imageDataUrl) return '<div class="w-14 h-14 rounded-lg border border-[color:var(--mgr-border)] bg-violet-50 text-[10px] text-[color:var(--mgr-muted)] flex items-center justify-center flex-shrink-0">NoImg</div>';
      return '<div class="relative w-14 h-14 rounded-lg border border-[color:var(--mgr-border)] overflow-hidden bg-violet-50 flex-shrink-0" data-thumb-id="' + encodeURIComponent(itemId) + '"><div class="absolute inset-0 flex items-center justify-center" data-thumb-spinner><span class="inline-block w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin"></span></div><img class="hidden w-full h-full object-cover" data-thumb-img alt="thumb" /></div>';
    }

    function buildPromotionItemCard(item) {
      const imageDataUrl = getPromotionItemDataUrl(item);
      const dragAttrs = state.promotionSortEditMode ? ' draggable="true" data-promotion-drag-id="' + item.ID + '"' : "";
      const moveUi = state.promotionSortEditMode ? '<span class="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 cursor-grab">ドラッグ</span>' : "";
      const previewUi = imageDataUrl ? '<button class="px-2 py-1 rounded bg-violet-100 text-violet-700 text-xs" data-promotion-preview="' + item.ID + '">画像</button>' : "";
      const thumbUi = buildPromotionThumbUi(imageDataUrl, item.ID);
      return '<div class="card p-3" ' + dragAttrs + '><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2">' + moveUi + thumbUi + '<div><p class="font-semibold">' + item.Type + ' / ' + (item.Title || "(no title)") + '</p><p class="text-xs text-[color:var(--mgr-muted)]">ID: ' + item.ID + '</p></div></div><div class="flex gap-2">' + previewUi + '<button class="px-2 py-1 rounded bg-violet-100 text-violet-700 text-xs" data-promotion-edit="' + item.ID + '">編集</button><button class="px-2 py-1 rounded bg-red-100 text-red-700 text-xs" data-promotion-delete="' + item.ID + '">削除</button></div></div><p class="text-xs mt-2 text-[color:var(--mgr-muted)]">' + (item.Description || "(no description)") + '</p></div>';
    }

    function renderPromotionItems() {
      if (!state.promotionItems.length) {
        ui.promotionItemsList.innerHTML = '<p class="text-sm text-[color:var(--mgr-muted)]">登録項目はありません。</p>';
        return;
      }

      const sourceItems = getPromotionSourceItems();
      ui.promotionItemsList.innerHTML = sourceItems.map((item) => buildPromotionItemCard(item)).join("");
      state.promotionThumbRenderToken += 1;
      hydratePromotionListThumbnails(sourceItems, state.promotionThumbRenderToken);
      if (state.promotionSortEditMode) bindPromotionSortDragEvents();
    }

    function waitImageReady(image) {
      if (image.decode) return image.decode().catch(() => null);
      return new Promise((resolve) => {
        if (image.complete) {
          resolve(null);
          return;
        }
        image.onload = () => resolve(null);
        image.onerror = () => resolve(null);
      });
    }

    async function hydratePromotionListThumbnails(items, renderToken) {
      const imageMap = {};
      items.forEach((item) => {
        const source = getPromotionItemDataUrl(item);
        if (source) imageMap[item.ID] = source;
      });

      const hosts = Array.from(ui.promotionItemsList.querySelectorAll("[data-thumb-id]"));
      for (const host of hosts) {
        if (renderToken !== state.promotionThumbRenderToken) return;

        const encodedId = String(host.getAttribute("data-thumb-id") || "");
        const id = decodeURIComponent(encodedId);
        const source = imageMap[id];
        if (!source) continue;

        const spinner = host.querySelector("[data-thumb-spinner]");
        const target = host.querySelector("[data-thumb-img]");
        const loader = new Image();
        loader.decoding = "async";
        loader.src = source;
        await waitImageReady(loader);
        if (renderToken !== state.promotionThumbRenderToken) return;
        target.src = source;
        target.classList.remove("hidden");
        if (spinner) spinner.classList.add("hidden");
        await new Promise((resolve) => setTimeout(resolve, 24));
      }
    }

    function bindPromotionSortDragEvents() {
      let draggingId = "";

      function stopPromotionDragAutoScroll() {
        state.promotionDragAutoScrollSpeed = 0;
        if (!state.promotionDragAutoScrollRaf) return;
        cancelAnimationFrame(state.promotionDragAutoScrollRaf);
        state.promotionDragAutoScrollRaf = 0;
      }

      function ensurePromotionDragAutoScroll() {
        if (state.promotionDragAutoScrollRaf) return;
        const tick = () => {
          state.promotionDragAutoScrollRaf = 0;
          if (!state.promotionDragAutoScrollSpeed) return;
          ui.promotionItemsList.scrollTop += state.promotionDragAutoScrollSpeed;
          ensurePromotionDragAutoScroll();
        };
        state.promotionDragAutoScrollRaf = requestAnimationFrame(tick);
      }

      function updatePromotionDragAutoScroll(clientY) {
        const rect = ui.promotionItemsList.getBoundingClientRect();
        const edge = 52;
        let speed = 0;
        if (clientY < rect.top + edge) speed = -Math.min(20, Math.max(4, Math.floor((rect.top + edge - clientY) / 3)));
        else if (clientY > rect.bottom - edge) speed = Math.min(20, Math.max(4, Math.floor((clientY - (rect.bottom - edge)) / 3)));
        state.promotionDragAutoScrollSpeed = speed;
        if (speed) ensurePromotionDragAutoScroll();
        else stopPromotionDragAutoScroll();
      }

      ui.promotionItemsList.addEventListener("dragover", (event) => {
        event.preventDefault();
        updatePromotionDragAutoScroll(event.clientY);
      });
      ui.promotionItemsList.addEventListener("dragleave", () => stopPromotionDragAutoScroll());
      ui.promotionItemsList.addEventListener("drop", () => stopPromotionDragAutoScroll());

      Array.from(ui.promotionItemsList.querySelectorAll("[data-promotion-drag-id]")).forEach((element) => {
        element.addEventListener("dragstart", () => {
          draggingId = String(element.getAttribute("data-promotion-drag-id") || "");
          element.classList.add("opacity-60");
        });
        element.addEventListener("dragend", () => {
          element.classList.remove("opacity-60");
          draggingId = "";
          stopPromotionDragAutoScroll();
        });
        element.addEventListener("dragover", (event) => {
          event.preventDefault();
          updatePromotionDragAutoScroll(event.clientY);
        });
        element.addEventListener("drop", (event) => {
          event.preventDefault();
          const targetId = String(element.getAttribute("data-promotion-drag-id") || "");
          if (!draggingId || !targetId || draggingId === targetId) return;
          const ids = state.promotionSortDraftIds.slice();
          const from = ids.indexOf(draggingId);
          const to = ids.indexOf(targetId);
          if (from < 0 || to < 0) return;
          ids.splice(from, 1);
          ids.splice(to, 0, draggingId);
          state.promotionSortDraftIds = ids;
          renderPromotionItems();
        });
      });
    }

    function syncPromotionSortEditUi() {
      ui.promotionSortEditButton.classList.toggle("hidden", state.promotionSortEditMode);
      ui.promotionSortSaveButton.classList.toggle("hidden", !state.promotionSortEditMode);
      ui.promotionSortCancelButton.classList.toggle("hidden", !state.promotionSortEditMode);
      ui.promotionSortHint.classList.toggle("hidden", !state.promotionSortEditMode);
      ui.promotionFilterType.disabled = state.promotionSortEditMode;
    }

    function setPromotionSortEditMode(enabled) {
      state.promotionSortEditMode = enabled;
      state.promotionSortDraftIds = state.promotionItems.map((item) => item.ID);
      syncPromotionSortEditUi();
      renderPromotionItems();
    }

    async function loadPromotionUsage() {
      const usageResult = (await callApi("/promotion/usage", { loadingMessage: "PromotionList の使用率を計算しています..." })).data;
      if (usageResult.status === "ok") {
        state.promotionUsage = usageResult.result;
        renderPromotionUsage();
      }
    }

    async function loadPromotionItems() {
      setSectionLoading(ui.promotionItemsList, ui.promotionLoadingText, true, "一覧を読み込み中...");
      try {
        const selectedType = ui.promotionFilterType.value;
        const itemsResult = (await callApi("/promotion/items?type=" + encodeURIComponent(selectedType), { loadingMessage: selectedType + " の一覧を読み込んでいます..." })).data;
        if (itemsResult.status === "ok") {
          state.promotionItems = itemsResult.result;
          if (!state.promotionSortEditMode) state.promotionSortDraftIds = state.promotionItems.map((item) => item.ID);
          renderPromotionItems();
        }
      } finally {
        setSectionLoading(ui.promotionItemsList, ui.promotionLoadingText, false);
      }
    }

    async function loadPromotionManageData(forceReloadUsage) {
      if (forceReloadUsage) await loadPromotionUsage();
      await loadPromotionItems();
    }

    async function loadPromotionApiConfig() {
      const apiConfigResult = (await callApi("/promotion/api-config", { loadingMessage: "PromotionList の設定を読み込んでいます..." })).data;
      if (apiConfigResult.status === "ok") {
        state.promotionApiConfig = apiConfigResult.result;
        ui.promotionIncludeImageInput.checked = !!state.promotionApiConfig.includeImageInResponse;
      }
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

    const panelLoaders = {
      [PANEL_KEYS.dashboard]: loadDashboard,
      [PANEL_KEYS.aiConfig]: loadStatus,
      [PANEL_KEYS.promotionManage]: async () => await loadPromotionManageData(true),
      [PANEL_KEYS.promotionApiSetting]: loadPromotionApiConfig,
      [PANEL_KEYS.docsAi]: createDocsLoader(ui.docsAiBody, "/docs/ai", "AIサービスの説明を読み込んでいます..."),
      [PANEL_KEYS.docsPromotion]: createDocsLoader(ui.docsPromotionBody, "/docs/promotion", "PromotionList の説明を読み込んでいます..."),
    };

    async function ensurePanelData(panelKey, forceReload) {
      if (!forceReload && state.loadedPanels[panelKey]) return;
      const loader = panelLoaders[panelKey];
      if (!loader) return;
      await loader();
      state.loadedPanels[panelKey] = true;
    }

    async function refreshPromotionManagePanel() {
      invalidatePanels(PANEL_KEYS.promotionManage, PANEL_KEYS.dashboard);
      await ensurePanelData(PANEL_KEYS.promotionManage, true);
    }

    function resetPromotionForm() {
      ui.promotionTypeInput.value = "Avatar";
      ui.promotionIdInput.value = "";
      ui.promotionTitleInput.value = "";
      ui.promotionAnchorInput.value = "";
      ui.promotionDescriptionInput.value = "";
      ui.promotionLinkInput.value = "";
      ui.promotionImageInput.value = "";
      ui.promotionImageFileInput.value = "";
      ui.promotionCompressEnabled.checked = true;
      ui.promotionCompressMaxSize.value = "512";
      updatePromotionImageSizeWarning();
      setPromotionImagePreview("");
      endPromotionSubmitProgress();
      state.promotionEditingId = "";
      state.promotionUploadedImageDataUrl = "";
    }

    function fillPromotionForm(item) {
      state.promotionEditingId = item.ID;
      ui.promotionTypeInput.value = item.Type;
      ui.promotionIdInput.value = item.ID;
      ui.promotionTitleInput.value = item.Title;
      ui.promotionAnchorInput.value = item.Anchor;
      ui.promotionDescriptionInput.value = item.Description;
      ui.promotionLinkInput.value = item.Link;
      ui.promotionImageInput.value = item.Image;
      setPromotionImagePreview(item.Image);
      state.promotionUploadedImageDataUrl = "";
    }

    function openPromotionModal(mode, item) {
      state.promotionModalMode = mode;
      switch (mode) {
        case PROMOTION_MODAL_MODE.create:
          resetPromotionForm();
          ui.promotionModalTitle.textContent = "PromotionList 追加";
          ui.promotionIdInput.disabled = false;
          ui.promotionTypeInput.value = ui.promotionFilterType.value;
          break;
        case PROMOTION_MODAL_MODE.edit:
          ui.promotionModalTitle.textContent = "PromotionList 編集";
          ui.promotionIdInput.disabled = true;
          fillPromotionForm(item);
          break;
        default:
          throw new Error("unsupported_promotion_modal_mode");
      }
      ui.promotionModal.classList.remove("hidden");
      refreshPromotionPrediction();
    }

    function closePromotionModal() {
      ui.promotionModal.classList.add("hidden");
      resetPromotionForm();
    }

    function buildPromotionSubmitRequest(payload, prediction) {
      switch (state.promotionModalMode) {
        case PROMOTION_MODAL_MODE.create:
          setPromotionSubmitProgress(35, "追加データを送信しています...");
          return {
            path: "/promotion/items",
            failureMessage: "追加に失敗しました。",
            loadingMessage: "PromotionList 項目を追加しています...",
            body: {
              type: payload.type,
              item: payload.item,
              predictedBytes: prediction.predicted,
            },
          };
        case PROMOTION_MODAL_MODE.edit:
          setPromotionSubmitProgress(35, "更新データを送信しています...");
          return {
            path: "/promotion/items/update",
            failureMessage: "更新に失敗しました。",
            loadingMessage: "PromotionList 項目を更新しています...",
            body: {
              id: state.promotionEditingId,
              type: payload.type,
              item: payload.item,
              predictedBytes: prediction.predicted,
            },
          };
        default:
          throw new Error("unsupported_promotion_modal_mode");
      }
    }

    async function submitPromotionModal() {
      const payload = readPromotionForm();
      const prediction = refreshPromotionPrediction();
      if (prediction.total > MAX_PROMOTION_BYTES) {
        alert("予測サイズが 100MB を超えるため保存できません。");
        return;
      }

      beginPromotionSubmitProgress();
      const request = buildPromotionSubmitRequest(payload, prediction);
      const result = (await callApi(request.path, { method: "POST", body: JSON.stringify(request.body), loadingMessage: request.loadingMessage })).data;
      if (result.status !== "ok") {
        endPromotionSubmitProgress();
        alert(request.failureMessage);
        return;
      }

      setPromotionSubmitProgress(75, "一覧を更新しています...");
      await refreshPromotionManagePanel();
      setPromotionSubmitProgress(100, "完了しました。");
      closePromotionModal();
    }

    function getPromotionItemById(id) {
      return state.promotionItems.find((item) => item.ID === id) || null;
    }

    function openPromotionPreviewById(id) {
      const item = getPromotionItemById(id);
      if (!item) return;
      const source = getPromotionItemDataUrl(item);
      if (!source) return;
      ui.promotionImagePreviewLarge.src = source;
      ui.promotionImagePreviewModal.classList.remove("hidden");
    }

    async function deletePromotionItemById(id) {
      if (!id || !confirm("ID " + id + " を削除しますか？")) return;
      await callApi("/promotion/items/delete", { method: "POST", body: JSON.stringify({ id }), loadingMessage: "項目を削除しています..." });
      await refreshPromotionManagePanel();
    }

    function openPromotionEditorById(id) {
      const item = getPromotionItemById(id);
      if (!item) return;
      openPromotionModal(PROMOTION_MODAL_MODE.edit, item);
    }

    async function handlePromotionListClick(event) {
      const actionButton = event.target.closest("[data-promotion-delete], [data-promotion-preview], [data-promotion-edit]");
      if (!actionButton) return;

      const deleteId = actionButton.getAttribute("data-promotion-delete");
      if (deleteId) {
        await deletePromotionItemById(deleteId);
        return;
      }

      const previewId = actionButton.getAttribute("data-promotion-preview");
      if (previewId) {
        openPromotionPreviewById(previewId);
        return;
      }

      const editId = actionButton.getAttribute("data-promotion-edit");
      if (editId) openPromotionEditorById(editId);
    }

    function bindNavigationEvents() {
      ui.navItems.forEach((item) => item.addEventListener("click", async () => {
        const panelKey = item.dataset.panel;
        if (!panelKey) return;
        await switchPanelAndLoad(panelKey, false);
      }));
      ui.logoutButton.addEventListener("click", () => {
        localStorage.removeItem("mgr_token");
        location.href = "/mgr";
      });
    }

    function bindAiEvents() {
      ui.refreshDashboardButton.addEventListener("click", async () => await withButtonDisabled(ui.refreshDashboardButton, async () => {
        await switchPanelAndLoad(PANEL_KEYS.dashboard, true);
      }));
      ui.saveConfigButton.addEventListener("click", async () => await withButtonDisabled(ui.saveConfigButton, async () => {
        await callApi("/config", { method: "POST", body: JSON.stringify({ enabled: ui.enabledInput.value === "1", requestsPerMinute: Number(ui.rpmInput.value), maxChars: Number(ui.maxCharsInput.value) }), loadingMessage: "設定を保存しています..." });
        invalidatePanels(PANEL_KEYS.aiConfig, PANEL_KEYS.dashboard);
        await ensurePanelData(PANEL_KEYS.aiConfig, true);
        if (!ui.panels[PANEL_KEYS.dashboard].classList.contains("hidden")) await ensurePanelData(PANEL_KEYS.dashboard, true);
      }));
      ui.statsButton.addEventListener("click", async () => callApi("/stats", { loadingMessage: "統計情報を取得しています..." }));
      ui.errorsButton.addEventListener("click", async () => callApi("/errors?limit=10", { loadingMessage: "エラーログを取得しています..." }));
      ui.llmButton.addEventListener("click", async () => callApi("/llmrequests?limit=10", { loadingMessage: "LLMログを取得しています..." }));
      ui.resetCacheButton.addEventListener("click", async () => confirm("translation_cache を全削除します。よろしいですか？") ? callApi("/resetcache", { method: "POST", body: "{}", loadingMessage: "翻訳キャッシュ削除を開始しています..." }) : null);
      ui.pingButton.addEventListener("click", async () => callApi("/ping", { method: "POST", body: "{}", loadingMessage: "AI へ疎通確認しています..." }));
      ui.simulateButton.addEventListener("click", async () => await withButtonDisabled(ui.simulateButton, async () => {
        ui.simulateResultBox.classList.remove("hidden");
        ui.simulateResultText.textContent = "実行中...";
        const result = await callApi("/simulate", { method: "POST", body: JSON.stringify({ lang: ui.simulateLangInput.value, text: ui.simulateTextInput.value }), loadingMessage: "simulate を実行しています..." });
        showSimulateResult(result.data);
      }));
    }

    function bindPromotionEvents() {
      ui.promotionItemsList.addEventListener("click", handlePromotionListClick);
      ui.promotionCreateOpenButton.addEventListener("click", () => openPromotionModal(PROMOTION_MODAL_MODE.create));
      ui.promotionSortEditButton.addEventListener("click", () => setPromotionSortEditMode(true));
      ui.promotionSortCancelButton.addEventListener("click", () => setPromotionSortEditMode(false));
      ui.promotionSortSaveButton.addEventListener("click", async () => {
        const payload = { type: ui.promotionFilterType.value, orderedIds: state.promotionSortDraftIds };
        const result = (await callApi("/promotion/items/reorder", { method: "POST", body: JSON.stringify(payload), loadingMessage: "並び順を保存しています..." })).data;
        if (result.status !== "ok") {
          alert("並び順の保存に失敗しました。");
          return;
        }
        setPromotionSortEditMode(false);
        await refreshPromotionManagePanel();
      });
      ui.promotionReloadButton.addEventListener("click", async () => {
        invalidatePanels(PANEL_KEYS.promotionManage);
        await ensurePanelData(PANEL_KEYS.promotionManage, true);
      });
      ui.refreshPromotionUsageButton.addEventListener("click", async () => {
        await loadPromotionUsage();
      });
      ui.promotionSaveApiSettingButton.addEventListener("click", async () => {
        const includeImageInResponse = !!ui.promotionIncludeImageInput.checked;
        const result = (await callApi("/promotion/api-config", { method: "POST", body: JSON.stringify({ includeImageInResponse }), loadingMessage: "API設定を保存しています..." })).data;
        if (result.status !== "ok") {
          alert("API設定の保存に失敗しました。");
          return;
        }
        state.promotionApiConfig.includeImageInResponse = includeImageInResponse;
        invalidatePanels(PANEL_KEYS.promotionApiSetting);
        await ensurePanelData(PANEL_KEYS.promotionApiSetting, true);
      });
      ui.promotionFilterType.addEventListener("change", async () => {
        state.promotionSortEditMode = false;
        syncPromotionSortEditUi();
        await loadPromotionItems();
      });
      ui.promotionModalCloseButton.addEventListener("click", closePromotionModal);
      ui.promotionModalCancelButton.addEventListener("click", closePromotionModal);
      ui.promotionModalSubmitButton.addEventListener("click", submitPromotionModal);
      ui.promotionModal.addEventListener("click", (event) => {
        if (event.target === ui.promotionModal) closePromotionModal();
      });
      ui.promotionImagePreviewOpenButton.addEventListener("click", () => ui.promotionImagePreviewModal.classList.remove("hidden"));
      ui.promotionImagePreviewCloseButton.addEventListener("click", () => ui.promotionImagePreviewModal.classList.add("hidden"));
      ui.promotionImagePreviewModal.addEventListener("click", (event) => {
        if (event.target === ui.promotionImagePreviewModal) ui.promotionImagePreviewModal.classList.add("hidden");
      });
      ui.promotionImagePreviewContainer.addEventListener("mousemove", handlePromotionMagnifierMove);
      ui.promotionImagePreviewContainer.addEventListener("mouseleave", hidePromotionMagnifier);
      ui.promotionCompressEnabled.addEventListener("change", () => {
        updatePromotionImageSizeWarning();
        reapplyImageCompression();
      });
      ui.promotionCompressMaxSize.addEventListener("change", () => {
        updatePromotionImageSizeWarning();
        reapplyImageCompression();
      });
      ui.promotionImageFileInput.addEventListener("change", async () => {
        const file = ui.promotionImageFileInput.files && ui.promotionImageFileInput.files[0];
        if (!file) return;
        beginGlobalLoading("画像を読み込んでいます...");
        try {
          state.promotionUploadedImageDataUrl = await fileToDataUrl(file);
          state.globalLoadingMessage = "画像を圧縮しています...";
          await reapplyImageCompression();
        } catch (error) {
          console.error("[mgr] 画像読込に失敗しました", error);
        } finally {
          endGlobalLoading();
        }
      });
      [ui.promotionTypeInput, ui.promotionTitleInput, ui.promotionAnchorInput, ui.promotionDescriptionInput, ui.promotionLinkInput, ui.promotionImageInput].forEach((input) => input.addEventListener("input", () => {
        if (input === ui.promotionImageInput) setPromotionImagePreview(ui.promotionImageInput.value);
        refreshPromotionPrediction();
      }));
      ui.promotionIdInput.addEventListener("input", refreshPromotionPrediction);
    }

    function initializePage() {
      bindNavigationEvents();
      bindAiEvents();
      bindPromotionEvents();
      updatePromotionImageSizeWarning();
      syncPromotionSortEditUi();
      switchPanel(PANEL_KEYS.dashboard);
      ensurePanelData(PANEL_KEYS.dashboard, false);
    }

    initializePage();
`;
