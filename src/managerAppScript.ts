export const MANAGER_APP_SCRIPT = `
    const MAX_PROMOTION_BYTES = 100 * 1024 * 1024;
    const PANEL_KEYS = {
      dashboard: "dashboard",
      aiConfig: "ai-config",
      aiOperation: "ai-operation",
      aiTools: "ai-tools",
      promotionManage: "promotion-manage",
      gistManage: "gist-manage",
      docsAi: "docs-ai",
      docsPromotion: "docs-promotion",
    };
    const PROMOTION_MODAL_MODE = {
      create: "create",
      edit: "edit",
    };
    const PROMOTION_PLATFORMS = ["pc", "android", "ios"];

    const state = {
      token: localStorage.getItem("mgr_token") || "",
      globalLoadingCount: 0,
      globalLoadingMessage: "",
      loadedPanels: {},
      dayChart: null,
      langChart: null,
      promotionUsage: {
        maxBytes: MAX_PROMOTION_BYTES,
        total: { usedBytes: 0, usedPercent: 0 },
        platforms: {
          pc: { usedBytes: 0, usedPercent: 0 },
          android: { usedBytes: 0, usedPercent: 0 },
          ios: { usedBytes: 0, usedPercent: 0 },
        },
      },
      promotionItems: [],
      promotionModalMode: PROMOTION_MODAL_MODE.create,
      promotionEditingId: "",
      promotionUploadedImageDataUrl: "",
      promotionSortEditMode: false,
      promotionSortDraftIds: [],
      promotionDragAutoScrollRaf: 0,
      promotionDragAutoScrollSpeed: 0,
      currentConvertItemId: "",
      currentPromotionDetail: null,
      currentConvertHasAlpha: false,
      convertModalBusy: false,
      promotionGistStatus: {
        sourceKey: "PromotionList",
        platforms: {
          pc: null,
          android: null,
          ios: null,
        },
      },
      gistUploads: [],
      promotionGistUploadBusy: false,
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
        [PANEL_KEYS.gistManage]: document.getElementById("panel-gist-manage"),
        [PANEL_KEYS.docsAi]: document.getElementById("panel-docs-ai"),
        [PANEL_KEYS.docsPromotion]: document.getElementById("panel-docs-promotion"),
      },
      refreshPromotionUsageButton: document.getElementById("refreshPromotionUsageButton"),
      promotionUsageBarPc: document.getElementById("promotionUsageBarPc"),
      promotionUsageBarAndroid: document.getElementById("promotionUsageBarAndroid"),
      promotionUsageBarIos: document.getElementById("promotionUsageBarIos"),
      promotionUsageTextPc: document.getElementById("promotionUsageTextPc"),
      promotionUsageTextAndroid: document.getElementById("promotionUsageTextAndroid"),
      promotionUsageTextIos: document.getElementById("promotionUsageTextIos"),
      promotionUsageTextTotal: document.getElementById("promotionUsageTextTotal"),
      promotionGistUploadButton: document.getElementById("promotionGistUploadButton"),
      promotionGistStatusList: document.getElementById("promotionGistStatusList"),
      promotionGistUploadLog: document.getElementById("promotionGistUploadLog"),
      promotionGistLogClearButton: document.getElementById("promotionGistLogClearButton"),
      promotionLoadingText: document.getElementById("promotionLoadingText"),
      promotionItemsList: document.getElementById("promotionItemsList"),
      promotionCreateOpenButton: document.getElementById("promotionCreateOpenButton"),
      promotionReloadButton: document.getElementById("promotionReloadButton"),
      promotionFilterType: document.getElementById("promotionFilterType"),
      promotionSortEditButton: document.getElementById("promotionSortEditButton"),
      promotionSortSaveButton: document.getElementById("promotionSortSaveButton"),
      promotionSortCancelButton: document.getElementById("promotionSortCancelButton"),
      promotionSortHint: document.getElementById("promotionSortHint"),
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
      promotionImageMultipleOf4Status: document.getElementById("promotionImageMultipleOf4Status"),
      promotionResizeToMultipleOf4Button: document.getElementById("promotionResizeToMultipleOf4Button"),
      promotionImageDimensionText: document.getElementById("promotionImageDimensionText"),
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
      promotionConvertModal: document.getElementById("promotionConvertModal"),
      promotionConvertModalTitle: document.getElementById("promotionConvertModalTitle"),
      promotionConvertModalMeta: document.getElementById("promotionConvertModalMeta"),
      promotionConvertModalCloseButton: document.getElementById("promotionConvertModalCloseButton"),
      promotionConvertResizeButton: document.getElementById("promotionConvertResizeButton"),
      promotionConvertClearButton: document.getElementById("promotionConvertClearButton"),
      promotionConvertRunButton: document.getElementById("promotionConvertRunButton"),
      promotionConvertHasAlphaInput: document.getElementById("promotionConvertHasAlphaInput"),
      promotionConvertEncoderSummary: document.getElementById("promotionConvertEncoderSummary"),
      promotionConvertDownloadSection: document.getElementById("promotionConvertDownloadSection"),
      promotionConvertDownloadPcButton: document.getElementById("promotionConvertDownloadPcButton"),
      promotionConvertDownloadAndroidButton: document.getElementById("promotionConvertDownloadAndroidButton"),
      promotionConvertDownloadIosButton: document.getElementById("promotionConvertDownloadIosButton"),
      promotionConvertLog: document.getElementById("promotionConvertLog"),
      gistManageReloadButton: document.getElementById("gistManageReloadButton"),
      gistManageLoadingText: document.getElementById("gistManageLoadingText"),
      gistManageList: document.getElementById("gistManageList"),
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

    function getPromotionItemById(id) {
      return state.promotionItems.find((item) => item.ID === id) || null;
    }

    async function loadPromotionItemDetail(id) {
      const result = (await callApi("/promotion/items/detail?id=" + encodeURIComponent(id), {
        loadingMessage: "項目詳細を読み込んでいます...",
      })).data;
      if (result.status !== "ok") return null;
      state.currentPromotionDetail = result.result;
      return result.result;
    }

    function getPromotionItemDataUrl(item) {
      const raw = String(item && item.Image ? item.Image : "").trim();
      if (!raw) return "";
      if (raw.startsWith("data:image/")) return raw;
      return "data:image/*;base64," + raw;
    }

    async function loadImageElement(source) {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("image_load_failed"));
        image.src = source;
      });
    }

    async function getImageMetaFromBase64(base64Text) {
      const source = getPromotionItemDataUrl({ Image: base64Text });
      if (!source) return null;
      const image = await loadImageElement(source);
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("canvas_context_missing");
      context.drawImage(image, 0, 0, image.width, image.height);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      let hasAlpha = false;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] !== 255) {
          hasAlpha = true;
          break;
        }
      }
      return {
        width: image.width,
        height: image.height,
        hasAlpha,
      };
    }

    function isMultipleOf4(value) {
      return value > 0 && value % 4 === 0;
    }

    function isImageMetaConvertible(meta) {
      return !!meta && isMultipleOf4(meta.width) && isMultipleOf4(meta.height);
    }

    function formatImageMeta(meta) {
      if (!meta) return "画像サイズ: -";
      return "画像サイズ: " + meta.width + " x " + meta.height + " / " + (meta.hasAlpha ? "透明あり" : "透明なし");
    }

    function getPlatformEncoderSummaryText(hasAlpha) {
      return [
        "PC: " + (hasAlpha ? "DXT5Crunched (crn / DXT5)" : "DXT1Crunched (crn / DXT1)"),
        "Android: " + (hasAlpha ? "ETC2_RGBA8Crunched 相当 (ktx / ETC2)" : "ETC_RGB4Crunched (ktx / ETC1)"),
        "iOS: " + (hasAlpha ? "ETC2_RGBA8Crunched (ktx / ETC2)" : "ETC_RGB4Crunched (ktx / ETC1)"),
      ].join("\\n");
    }

    function refreshConvertEncoderSummary() {
      ui.promotionConvertEncoderSummary.textContent = getPlatformEncoderSummaryText(state.currentConvertHasAlpha);
    }

    function refreshConvertDownloadButtons() {
      const convertedPlatforms = new Set(state.currentPromotionDetail?.ConvertedPlatforms || []);
      ui.promotionConvertDownloadPcButton.classList.toggle("hidden", !convertedPlatforms.has("pc"));
      ui.promotionConvertDownloadAndroidButton.classList.toggle("hidden", !convertedPlatforms.has("android"));
      ui.promotionConvertDownloadIosButton.classList.toggle("hidden", !convertedPlatforms.has("ios"));
      ui.promotionConvertDownloadSection.classList.toggle("hidden", convertedPlatforms.size === 0);
    }

    function renderMultipleOf4Status(meta) {
      const element = ui.promotionImageMultipleOf4Status;
      if (!meta) {
        element.classList.add("hidden");
        element.textContent = "";
        element.className = "hidden md:col-span-2 rounded-xl border px-4 py-3 text-sm font-semibold";
        return;
      }

      const passed = isImageMetaConvertible(meta);
      element.className = "md:col-span-2 rounded-xl border px-4 py-3 text-sm font-semibold";
      if (passed) {
        element.classList.add("bg-emerald-50", "border-emerald-200", "text-emerald-700");
        element.textContent = "4の倍数チェック: 通过（この画像はそのまま変換できます）";
        return;
      }

      element.classList.add("bg-red-50", "border-red-200", "text-red-700");
      element.textContent = "4の倍数チェック: 不通过（縦横とも 4 の倍数である必要があります）";
    }

    async function refreshPromotionImageDimensionText() {
      const imageValue = ui.promotionImageInput.value.trim();
      if (!imageValue) {
        ui.promotionImageDimensionText.textContent = "画像サイズ: -";
        renderMultipleOf4Status(null);
        return null;
      }
      try {
        const meta = await getImageMetaFromBase64(imageValue);
        ui.promotionImageDimensionText.textContent = formatImageMeta(meta);
        renderMultipleOf4Status(meta);
        return meta;
      } catch (error) {
        ui.promotionImageDimensionText.textContent = "画像サイズ: 読み取り失敗";
        renderMultipleOf4Status(null);
        console.error("[mgr] 画像メタ取得に失敗しました", error);
        return null;
      }
    }

    async function resizeBase64ImageToNextMultipleOf4(base64Text) {
      const source = getPromotionItemDataUrl({ Image: base64Text });
      if (!source) return { base64: "", width: 0, height: 0 };
      const image = await loadImageElement(source);
      const targetWidth = Math.ceil(image.width / 4) * 4;
      const targetHeight = Math.ceil(image.height / 4) * 4;
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas_context_missing");
      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      return {
        base64: canvas.toDataURL("image/png").split(",")[1] || "",
        width: targetWidth,
        height: targetHeight,
      };
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
      const total = state.promotionUsage.total.usedBytes + predicted;
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
      const source = getPromotionItemDataUrl({ Image: normalized });
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
      return await loadImageElement(source);
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
      if (!source) {
        await refreshPromotionImageDimensionText();
        return;
      }
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
      await refreshPromotionImageDimensionText();
    }

    function renderPromotionUsage() {
      const maxBytesText = (state.promotionUsage.maxBytes / (1024 * 1024)).toFixed(0) + "MB";
      ui.promotionUsageTextPc.textContent = (state.promotionUsage.platforms.pc.usedBytes / (1024 * 1024)).toFixed(2) + "MB / " + maxBytesText;
      ui.promotionUsageTextAndroid.textContent = (state.promotionUsage.platforms.android.usedBytes / (1024 * 1024)).toFixed(2) + "MB / " + maxBytesText;
      ui.promotionUsageTextIos.textContent = (state.promotionUsage.platforms.ios.usedBytes / (1024 * 1024)).toFixed(2) + "MB / " + maxBytesText;
      ui.promotionUsageBarPc.style.width = Math.min(100, state.promotionUsage.platforms.pc.usedPercent) + "%";
      ui.promotionUsageBarAndroid.style.width = Math.min(100, state.promotionUsage.platforms.android.usedPercent) + "%";
      ui.promotionUsageBarIos.style.width = Math.min(100, state.promotionUsage.platforms.ios.usedPercent) + "%";
      ui.promotionUsageTextTotal.textContent = "合計: " + (state.promotionUsage.total.usedBytes / (1024 * 1024)).toFixed(2) + "MB";
      ui.kpiPromotionUsage.textContent = state.promotionUsage.total.usedPercent.toFixed(2) + "%";
    }

    function formatDateTime(value, fallbackText) {
      if (!value) return fallbackText || "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString("ja-JP");
    }

    function formatBytes(bytes) {
      const normalized = Number(bytes) || 0;
      if (normalized >= 1024 * 1024) return (normalized / (1024 * 1024)).toFixed(2) + "MB";
      if (normalized >= 1024) return (normalized / 1024).toFixed(2) + "KB";
      return normalized + "B";
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function appendPromotionGistLog(message) {
      const current = ui.promotionGistUploadLog.textContent || "";
      ui.promotionGistUploadLog.textContent = current + (current ? "\\n" : "") + message;
      ui.promotionGistUploadLog.scrollTop = ui.promotionGistUploadLog.scrollHeight;
    }

    function setPromotionGistUploadBusy(busy) {
      state.promotionGistUploadBusy = busy;
      ui.promotionGistUploadButton.disabled = busy;
      ui.promotionGistUploadButton.classList.toggle("opacity-70", busy);
      ui.promotionGistUploadButton.classList.toggle("cursor-not-allowed", busy);
    }

    function buildPromotionGistStatusCard(platform, record) {
      const platformNameMap = {
        pc: "PC",
        android: "Android",
        ios: "iOS",
      };
      if (!record) {
        return '<div class="rounded-xl border border-[color:var(--mgr-border)] bg-white p-3 space-y-2"><p class="text-sm font-semibold">' + platformNameMap[platform] + '</p><p class="text-xs text-[color:var(--mgr-muted)]">最終更新: 未アップロード</p><p class="text-xs text-[color:var(--mgr-muted)]">Raw URL: 未アップロード</p></div>';
      }
      return '<div class="rounded-xl border border-[color:var(--mgr-border)] bg-white p-3 space-y-2"><p class="text-sm font-semibold">' + platformNameMap[platform] + '</p><p class="text-xs text-[color:var(--mgr-muted)]">最終更新: ' + escapeHtml(formatDateTime(record.uploadedAt, "gistfs API 未提供")) + '</p><a class="text-xs text-sky-700 break-all underline" href="' + escapeHtml(record.rawUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(record.rawUrl) + '</a><p class="text-xs text-[color:var(--mgr-muted)]">サイズ: ' + escapeHtml(formatBytes(record.size)) + '</p></div>';
    }

    function renderPromotionGistStatus() {
      const platforms = state.promotionGistStatus.platforms || {};
      ui.promotionGistStatusList.innerHTML = PROMOTION_PLATFORMS.map((platform) => buildPromotionGistStatusCard(platform, platforms[platform])).join("");
    }

    function buildGistManageItem(record) {
      return '<div class="card p-3"><div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0 flex-1 space-y-1"><p class="font-semibold break-all">' + escapeHtml(record.path) + '</p><p class="text-xs text-[color:var(--mgr-muted)]">Source: ' + escapeHtml(record.sourceKey || "-") + ' / Platform: ' + escapeHtml(record.platform || "-") + '</p><p class="text-xs text-[color:var(--mgr-muted)]">最終更新: ' + escapeHtml(formatDateTime(record.uploadedAt, "gistfs API 未提供")) + ' / サイズ: ' + escapeHtml(formatBytes(record.size)) + '</p><a class="text-xs text-sky-700 break-all underline" href="' + escapeHtml(record.rawUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(record.rawUrl) + '</a></div><button class="px-3 py-2 rounded-xl bg-red-100 text-red-700 text-xs font-semibold" data-gist-delete="' + escapeHtml(record.path) + '">削除</button></div></div>';
    }

    function renderGistUploads() {
      if (!state.gistUploads.length) {
        ui.gistManageList.innerHTML = '<p class="text-sm text-[color:var(--mgr-muted)]">アップロード済みファイルはありません。</p>';
        return;
      }
      ui.gistManageList.innerHTML = state.gistUploads.map(buildGistManageItem).join("");
    }

    async function refreshPromotionManagePanel() {
      invalidatePanels(PANEL_KEYS.promotionManage, PANEL_KEYS.dashboard);
      await ensurePanelData(PANEL_KEYS.promotionManage, true);
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

    function buildPromotionConvertButton(item) {
      if (!item.HasImage) return "";
      const converted = !!item.IsImageConverted;
      const baseClass = converted
        ? "px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs"
        : "px-2 py-1 rounded bg-violet-600 text-white text-xs";
      return '<button class="' + baseClass + '" data-promotion-convert="' + item.ID + '">' + (converted ? "変換済み" : "変換") + '</button>';
    }

    function buildPromotionItemCard(item) {
      const dragAttrs = state.promotionSortEditMode ? ' draggable="true" data-promotion-drag-id="' + item.ID + '"' : "";
      const moveUi = state.promotionSortEditMode ? '<span class="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 cursor-grab">ドラッグ</span>' : "";
      const previewUi = item.HasImage ? '<span class="px-2 py-1 rounded bg-violet-100 text-violet-700 text-xs">画像あり</span>' : '<span class="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs">画像なし</span>';
      const convertUi = buildPromotionConvertButton(item);
      return '<div class="card p-3" ' + dragAttrs + '><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2">' + moveUi + '<div><p class="font-semibold">' + item.Type + ' / ' + (item.Title || "(no title)") + '</p><p class="text-xs text-[color:var(--mgr-muted)]">ID: ' + item.ID + '</p></div></div><div class="flex gap-2">' + previewUi + convertUi + '<button class="px-2 py-1 rounded bg-violet-100 text-violet-700 text-xs" data-promotion-edit="' + item.ID + '">編集</button><button class="px-2 py-1 rounded bg-red-100 text-red-700 text-xs" data-promotion-delete="' + item.ID + '">削除</button></div></div><p class="text-xs mt-2 text-[color:var(--mgr-muted)]">' + (item.Description || "(no description)") + '</p></div>';
    }

    function getPromotionSourceItems() {
      return state.promotionSortEditMode
        ? state.promotionSortDraftIds.map((id) => state.promotionItems.find((item) => item.ID === id)).filter(Boolean)
        : state.promotionItems;
    }

    function renderPromotionItems() {
      if (!state.promotionItems.length) {
        ui.promotionItemsList.innerHTML = '<p class="text-sm text-[color:var(--mgr-muted)]">登録項目はありません。</p>';
        return;
      }
      const sourceItems = getPromotionSourceItems();
      ui.promotionItemsList.innerHTML = sourceItems.map((item) => buildPromotionItemCard(item)).join("");
      if (state.promotionSortEditMode) bindPromotionSortDragEvents();
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

    async function loadPromotionGistStatus() {
      const result = (await callApi("/promotion/gist/status", { loadingMessage: "PromotionList の Gist 状態を読み込んでいます..." })).data;
      if (result.status !== "ok") return;
      state.promotionGistStatus = result.result;
      renderPromotionGistStatus();
    }

    async function loadGistUploads() {
      setSectionLoading(ui.gistManageList, ui.gistManageLoadingText, true, "一覧を読み込み中...");
      try {
        const result = (await callApi("/gistfs/uploads", { loadingMessage: "Gist 一覧を読み込んでいます..." })).data;
        if (result.status !== "ok") return;
        state.gistUploads = result.result;
        renderGistUploads();
      } finally {
        setSectionLoading(ui.gistManageList, ui.gistManageLoadingText, false);
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
      await loadPromotionGistStatus();
      await loadPromotionItems();
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
      [PANEL_KEYS.gistManage]: loadGistUploads,
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
      ui.promotionImageDimensionText.textContent = "画像サイズ: -";
      renderMultipleOf4Status(null);
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

    async function openPromotionModal(mode, item) {
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
      await refreshPromotionImageDimensionText();
    }

    function closePromotionModal() {
      ui.promotionModal.classList.add("hidden");
      resetPromotionForm();
      state.currentPromotionDetail = null;
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

    async function savePromotionItem(item, loadingMessage) {
      const result = (await callApi("/promotion/items/update", {
        method: "POST",
        body: JSON.stringify({
          id: item.ID,
          type: item.Type,
          item: {
            ID: item.ID,
            Title: item.Title,
            Anchor: item.Anchor,
            Description: item.Description,
            Link: item.Link,
            Image: item.Image,
          },
          predictedBytes: estimatePromotionBytes(item),
        }),
        loadingMessage,
      })).data;
      if (result.status !== "ok") throw new Error("promotion_item_save_failed");
      await refreshPromotionManagePanel();
      return await loadPromotionItemDetail(item.ID);
    }

    function appendConvertLog(message) {
      const current = ui.promotionConvertLog.textContent || "";
      ui.promotionConvertLog.textContent = current + (current ? "\\n" : "") + message;
      ui.promotionConvertLog.scrollTop = ui.promotionConvertLog.scrollHeight;
    }

    function setConvertModalBusy(busy) {
      state.convertModalBusy = busy;
      ui.promotionConvertRunButton.disabled = busy;
      ui.promotionConvertResizeButton.disabled = busy;
      ui.promotionConvertClearButton.disabled = busy;
      ui.promotionConvertModalCloseButton.disabled = busy;
      ui.promotionConvertHasAlphaInput.disabled = busy;
      ui.promotionConvertRunButton.classList.toggle("opacity-70", busy);
      ui.promotionConvertResizeButton.classList.toggle("opacity-70", busy);
      ui.promotionConvertClearButton.classList.toggle("opacity-70", busy);
    }

    async function openPromotionConvertModal(id) {
      const item = await loadPromotionItemDetail(id);
      if (!item) return;
      state.currentConvertItemId = id;
      ui.promotionConvertModalTitle.textContent = "画像変換 / " + (item.Title || item.ID);
      const meta = await getImageMetaFromBase64(item.Image);
      state.currentConvertHasAlpha = !!meta?.hasAlpha;
      ui.promotionConvertHasAlphaInput.checked = state.currentConvertHasAlpha;
      refreshConvertEncoderSummary();
      refreshConvertDownloadButtons();
      ui.promotionConvertModalMeta.textContent = formatImageMeta(meta);
      ui.promotionConvertLog.textContent = "";
      appendConvertLog("対象ID: " + item.ID);
      appendConvertLog("現在状態: " + (item.IsImageConverted ? "変換済み" : "未変換"));
      if (meta) {
        appendConvertLog("画像サイズ: " + meta.width + " x " + meta.height);
        appendConvertLog("自動検出アルファ: " + (meta.hasAlpha ? "あり" : "なし"));
        appendConvertLog("変換設定アルファ: " + (state.currentConvertHasAlpha ? "あり" : "なし"));
        if (!isImageMetaConvertible(meta)) appendConvertLog("注意: 画像サイズは縦横とも 4 の倍数である必要があります。");
      }
      ui.promotionConvertModal.classList.remove("hidden");
      setConvertModalBusy(false);
    }

    function closePromotionConvertModal() {
      if (state.convertModalBusy) return;
      ui.promotionConvertModal.classList.add("hidden");
      state.currentConvertItemId = "";
      state.currentPromotionDetail = null;
      state.currentConvertHasAlpha = false;
      refreshConvertDownloadButtons();
      ui.promotionConvertLog.textContent = "";
    }

    async function resizeCurrentConvertItemToMultipleOf4AndSave() {
      const item = state.currentPromotionDetail;
      if (!item || !item.Image) return;
      const meta = await getImageMetaFromBase64(item.Image);
      if (!meta) return;
      if (isImageMetaConvertible(meta)) {
        appendConvertLog("画像サイズは既に 4 の倍数です。保存は不要です。");
        return;
      }
      setConvertModalBusy(true);
      try {
        appendConvertLog("画像を " + meta.width + " x " + meta.height + " から 4 の倍数へ拡大しています...");
        const resized = await resizeBase64ImageToNextMultipleOf4(item.Image);
        const savedItem = await savePromotionItem(Object.assign({}, item, { Image: resized.base64 }), "4 の倍数サイズへ保存しています...");
        appendConvertLog("保存完了: " + resized.width + " x " + resized.height);
        if (savedItem) {
          state.currentPromotionDetail = savedItem;
          refreshConvertDownloadButtons();
          ui.promotionConvertModalMeta.textContent = formatImageMeta(await getImageMetaFromBase64(savedItem.Image));
        }
      } finally {
        setConvertModalBusy(false);
      }
    }

    async function runPromotionConversion() {
      const item = state.currentPromotionDetail;
      if (!item || !item.Image) return;
      const meta = await getImageMetaFromBase64(item.Image);
      if (!isImageMetaConvertible(meta)) {
        appendConvertLog("変換を開始できません。先に画像を 4 の倍数へ拡大して保存してください。");
        return;
      }

      setConvertModalBusy(true);
      try {
        appendConvertLog("変換開始: pc → android → ios");
        for (const platform of PROMOTION_PLATFORMS) {
          appendConvertLog("[" + platform + "] 変換中...");
          const result = (await callApi("/promotion/items/convert", {
            method: "POST",
            body: JSON.stringify({
              id: item.ID,
              platform,
              hasAlpha: state.currentConvertHasAlpha,
              imageWidth: meta.width,
              imageHeight: meta.height,
            }),
            loadingMessage: platform + " 向け画像を変換しています...",
          })).data;
          if (result.status !== "ok") {
            appendConvertLog("[" + platform + "] 失敗: " + result.result);
            return;
          }
          appendConvertLog("[" + platform + "] 完了: " + result.result.textureFormat + " / " + result.result.outputFormat + " / " + result.result.outputBytes + " bytes");
          await loadPromotionItems();
          state.currentPromotionDetail = await loadPromotionItemDetail(item.ID);
          refreshConvertDownloadButtons();
        }
        await loadPromotionUsage();
        invalidatePanels(PANEL_KEYS.dashboard);
        appendConvertLog("全プラットフォームの変換が完了しました。閉じることができます。");
      } finally {
        setConvertModalBusy(false);
      }
    }

    async function clearCurrentPromotionConvertedData() {
      const item = state.currentPromotionDetail;
      if (!item) return;
      if (!confirm("現在の項目の変換済みデータをすべて清空しますか？")) return;
      setConvertModalBusy(true);
      try {
        appendConvertLog("変換済みデータを清空しています...");
        const result = (await callApi("/promotion/items/clear-converted", {
          method: "POST",
          body: JSON.stringify({ id: item.ID }),
          loadingMessage: "変換済みデータを清空しています...",
        })).data;
        if (result.status !== "ok") {
          appendConvertLog("清空失敗: " + result.result);
          return;
        }
        await loadPromotionItems();
        state.currentPromotionDetail = await loadPromotionItemDetail(item.ID);
        refreshConvertDownloadButtons();
        appendConvertLog("清空完了: pc / android / ios の変換データを削除しました。");
      } finally {
        setConvertModalBusy(false);
      }
    }

    async function downloadConvertedBinary(platform) {
      const item = state.currentPromotionDetail;
      if (!item) return;
      const response = await fetch("/mgr/api/promotion/items/download?id=" + encodeURIComponent(item.ID) + "&platform=" + encodeURIComponent(platform), {
        headers: {
          authorization: "Bearer " + state.token,
        },
      });
      if (!response.ok) {
        appendConvertLog("[" + platform + "] ダウンロード失敗: HTTP " + response.status);
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      const fallbackExtension = platform === "pc" ? "crn" : "ktx";
      const contentDisposition = response.headers.get("content-disposition") || "";
      const match = contentDisposition.match(/filename="([^"]+)"/);
      anchor.download = match ? match[1] : (item.ID + "_" + platform + "." + fallbackExtension);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      appendConvertLog("[" + platform + "] バイナリをダウンロードしました。");
    }

    async function deletePromotionItemById(id) {
      if (!id || !confirm("ID " + id + " を削除しますか？")) return;
      await callApi("/promotion/items/delete", { method: "POST", body: JSON.stringify({ id }), loadingMessage: "項目を削除しています..." });
      await refreshPromotionManagePanel();
    }

    async function uploadPromotionGistPlatform(platform) {
      const result = (await callApi("/promotion/gist/upload-platform", {
        method: "POST",
        body: JSON.stringify({ platform }),
        loadingMessage: platform + " の JSON を gistfs へアップロードしています...",
      })).data;
      if (result.status !== "ok") throw new Error(String(result.result || "upload_failed"));
      return result.result;
    }

    async function uploadPromotionGists() {
      if (state.promotionGistUploadBusy) return;
      setPromotionGistUploadBusy(true);
      appendPromotionGistLog("アップロード開始: pc → android → ios");
      try {
        for (const platform of PROMOTION_PLATFORMS) {
          appendPromotionGistLog("[" + platform + "] アップロードを開始します...");
          const uploaded = await uploadPromotionGistPlatform(platform);
          appendPromotionGistLog("[" + platform + "] 完了: " + uploaded.rawUrl + " / " + formatBytes(uploaded.size));
          await loadPromotionGistStatus();
        }
        invalidatePanels(PANEL_KEYS.gistManage);
        if (!ui.panels[PANEL_KEYS.gistManage].classList.contains("hidden")) await loadGistUploads();
        appendPromotionGistLog("3平台すべてのアップロードが完了しました。");
      } catch (error) {
        appendPromotionGistLog("失敗: " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setPromotionGistUploadBusy(false);
      }
    }

    async function deleteGistUpload(path) {
      if (!path || !confirm(path + " を gistfs から削除しますか？")) return;
      const result = (await callApi("/gistfs/uploads/delete", {
        method: "POST",
        body: JSON.stringify({ path }),
        loadingMessage: path + " を gistfs から削除しています...",
      })).data;
      if (result.status !== "ok") {
        alert("削除に失敗しました。");
        return;
      }
      appendPromotionGistLog("削除: " + path);
      await Promise.all([loadPromotionGistStatus(), loadGistUploads()]);
    }

    function openPromotionPreviewById(id) {
      const item = getPromotionItemById(id);
      if (!item) return;
      const source = getPromotionItemDataUrl(item);
      if (!source) return;
      ui.promotionImagePreviewLarge.src = source;
      ui.promotionImagePreviewModal.classList.remove("hidden");
    }

    async function handlePromotionListClick(event) {
      const actionButton = event.target.closest("[data-promotion-delete], [data-promotion-preview], [data-promotion-edit], [data-promotion-convert]");
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
      if (editId) {
        const item = await loadPromotionItemDetail(editId);
        if (item) await openPromotionModal(PROMOTION_MODAL_MODE.edit, item);
        return;
      }

      const convertId = actionButton.getAttribute("data-promotion-convert");
      if (convertId) await openPromotionConvertModal(convertId);
    }

    async function handleGistManageClick(event) {
      const actionButton = event.target.closest("[data-gist-delete]");
      if (!actionButton) return;
      const targetPath = actionButton.getAttribute("data-gist-delete");
      if (targetPath) await deleteGistUpload(targetPath);
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
      ui.promotionCreateOpenButton.addEventListener("click", async () => await openPromotionModal(PROMOTION_MODAL_MODE.create));
      ui.promotionGistUploadButton.addEventListener("click", uploadPromotionGists);
      ui.promotionGistLogClearButton.addEventListener("click", () => {
        ui.promotionGistUploadLog.textContent = "";
      });
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
      ui.promotionResizeToMultipleOf4Button.addEventListener("click", async () => {
        const currentImage = ui.promotionImageInput.value.trim();
        if (!currentImage) return;
        const meta = await getImageMetaFromBase64(currentImage);
        if (isImageMetaConvertible(meta)) {
          alert("画像サイズは既に 4 の倍数です。");
          return;
        }
        beginGlobalLoading("画像を 4 の倍数サイズへ拡大しています...");
        try {
          const resized = await resizeBase64ImageToNextMultipleOf4(currentImage);
          ui.promotionImageInput.value = resized.base64;
          state.promotionUploadedImageDataUrl = getPromotionItemDataUrl({ Image: resized.base64 });
          setPromotionImagePreview(resized.base64);
          refreshPromotionPrediction();
          await refreshPromotionImageDimensionText();
        } finally {
          endGlobalLoading();
        }
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
      [ui.promotionTypeInput, ui.promotionTitleInput, ui.promotionAnchorInput, ui.promotionDescriptionInput, ui.promotionLinkInput, ui.promotionImageInput].forEach((input) => input.addEventListener("input", async () => {
        if (input === ui.promotionImageInput) {
          setPromotionImagePreview(ui.promotionImageInput.value);
          await refreshPromotionImageDimensionText();
        }
        refreshPromotionPrediction();
      }));
      ui.promotionIdInput.addEventListener("input", refreshPromotionPrediction);

      ui.promotionConvertModalCloseButton.addEventListener("click", closePromotionConvertModal);
      ui.promotionConvertModal.addEventListener("click", (event) => {
        if (event.target === ui.promotionConvertModal) closePromotionConvertModal();
      });
      ui.promotionConvertHasAlphaInput.addEventListener("change", () => {
        state.currentConvertHasAlpha = !!ui.promotionConvertHasAlphaInput.checked;
        refreshConvertEncoderSummary();
        appendConvertLog("変換設定アルファを " + (state.currentConvertHasAlpha ? "あり" : "なし") + " に変更しました。");
      });
      ui.promotionConvertDownloadPcButton.addEventListener("click", async () => await downloadConvertedBinary("pc"));
      ui.promotionConvertDownloadAndroidButton.addEventListener("click", async () => await downloadConvertedBinary("android"));
      ui.promotionConvertDownloadIosButton.addEventListener("click", async () => await downloadConvertedBinary("ios"));
      ui.promotionConvertResizeButton.addEventListener("click", resizeCurrentConvertItemToMultipleOf4AndSave);
      ui.promotionConvertClearButton.addEventListener("click", clearCurrentPromotionConvertedData);
      ui.promotionConvertRunButton.addEventListener("click", runPromotionConversion);
    }

    function bindGistManageEvents() {
      ui.gistManageReloadButton.addEventListener("click", async () => {
        invalidatePanels(PANEL_KEYS.gistManage);
        await ensurePanelData(PANEL_KEYS.gistManage, true);
      });
      ui.gistManageList.addEventListener("click", handleGistManageClick);
    }

    function initializePage() {
      bindNavigationEvents();
      bindAiEvents();
      bindPromotionEvents();
      bindGistManageEvents();
      updatePromotionImageSizeWarning();
      syncPromotionSortEditUi();
      switchPanel(PANEL_KEYS.dashboard);
      ensurePanelData(PANEL_KEYS.dashboard, false);
    }

    initializePage();
`;
