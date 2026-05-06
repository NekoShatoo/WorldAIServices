export const MANAGER_APP_SCRIPT_CORE = `
    const MAX_PROMOTION_BYTES = 100 * 1024 * 1024;
    const PANEL_KEYS = {
      dashboard: "dashboard",
      aiConfig: "ai-config",
      aiOperation: "ai-operation",
      aiTools: "ai-tools",
      promotionManage: "promotion-manage",
      advertisementManage: "advertisement-manage",
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
      advertisementUsage: {
        maxBytes: MAX_PROMOTION_BYTES,
        total: { usedBytes: 0, usedPercent: 0 },
        platforms: {
          pc: { usedBytes: 0, usedPercent: 0 },
          android: { usedBytes: 0, usedPercent: 0 },
          ios: { usedBytes: 0, usedPercent: 0 },
        },
      },
      advertisementScopes: [],
      advertisementScopeId: "",
      advertisementItems: [],
      advertisementModalMode: PROMOTION_MODAL_MODE.create,
      advertisementEditingId: "",
      advertisementUploadedImageDataUrl: "",
      advertisementSortEditMode: false,
      advertisementSortDraftIds: [],
      currentAdvertisementDetail: null,
      currentAdvertisementConvertHasAlpha: false,
      advertisementConvertBusy: false,
      advertisementGistStatus: {
        sourceKey: "Advertisement",
        platforms: {
          pc: null,
          android: null,
          ios: null,
        },
      },
      advertisementGistUploadBusy: false,
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
        [PANEL_KEYS.advertisementManage]: document.getElementById("panel-advertisement-manage"),
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
      refreshAdvertisementUsageButton: document.getElementById("refreshAdvertisementUsageButton"),
      advertisementUsageBarPc: document.getElementById("advertisementUsageBarPc"),
      advertisementUsageBarAndroid: document.getElementById("advertisementUsageBarAndroid"),
      advertisementUsageBarIos: document.getElementById("advertisementUsageBarIos"),
      advertisementUsageTextPc: document.getElementById("advertisementUsageTextPc"),
      advertisementUsageTextAndroid: document.getElementById("advertisementUsageTextAndroid"),
      advertisementUsageTextIos: document.getElementById("advertisementUsageTextIos"),
      advertisementUsageTextTotal: document.getElementById("advertisementUsageTextTotal"),
      advertisementScopeSelect: document.getElementById("advertisementScopeSelect"),
      advertisementScopeCreateButton: document.getElementById("advertisementScopeCreateButton"),
      advertisementScopeRenameButton: document.getElementById("advertisementScopeRenameButton"),
      advertisementScopeDeleteButton: document.getElementById("advertisementScopeDeleteButton"),
      advertisementGistUploadButton: document.getElementById("advertisementGistUploadButton"),
      advertisementGistStatusList: document.getElementById("advertisementGistStatusList"),
      advertisementGistUploadLog: document.getElementById("advertisementGistUploadLog"),
      advertisementGistLogClearButton: document.getElementById("advertisementGistLogClearButton"),
      advertisementLoadingText: document.getElementById("advertisementLoadingText"),
      advertisementItemsList: document.getElementById("advertisementItemsList"),
      advertisementSortEditButton: document.getElementById("advertisementSortEditButton"),
      advertisementSortSaveButton: document.getElementById("advertisementSortSaveButton"),
      advertisementSortCancelButton: document.getElementById("advertisementSortCancelButton"),
      advertisementSortHint: document.getElementById("advertisementSortHint"),
      advertisementCreateOpenButton: document.getElementById("advertisementCreateOpenButton"),
      advertisementReloadButton: document.getElementById("advertisementReloadButton"),
      advertisementModal: document.getElementById("advertisementModal"),
      advertisementModalTitle: document.getElementById("advertisementModalTitle"),
      advertisementModalCloseButton: document.getElementById("advertisementModalCloseButton"),
      advertisementModalCancelButton: document.getElementById("advertisementModalCancelButton"),
      advertisementModalSubmitButton: document.getElementById("advertisementModalSubmitButton"),
      advertisementSubmitProgressBox: document.getElementById("advertisementSubmitProgressBox"),
      advertisementSubmitProgressText: document.getElementById("advertisementSubmitProgressText"),
      advertisementSubmitProgressBar: document.getElementById("advertisementSubmitProgressBar"),
      advertisementPredictionText: document.getElementById("advertisementPredictionText"),
      advertisementCompressEnabled: document.getElementById("advertisementCompressEnabled"),
      advertisementCompressMaxSize: document.getElementById("advertisementCompressMaxSize"),
      advertisementImageSizeWarning: document.getElementById("advertisementImageSizeWarning"),
      advertisementImageMultipleOf4Status: document.getElementById("advertisementImageMultipleOf4Status"),
      advertisementResizeToMultipleOf4Button: document.getElementById("advertisementResizeToMultipleOf4Button"),
      advertisementImageDimensionText: document.getElementById("advertisementImageDimensionText"),
      advertisementTitleInput: document.getElementById("advertisementTitleInput"),
      advertisementUrlInput: document.getElementById("advertisementUrlInput"),
      advertisementImageInput: document.getElementById("advertisementImageInput"),
      advertisementImageFileInput: document.getElementById("advertisementImageFileInput"),
      advertisementImagePreviewContainer: document.getElementById("advertisementImagePreviewContainer"),
      advertisementImagePreview: document.getElementById("advertisementImagePreview"),
      advertisementImageMagnifierLens: document.getElementById("advertisementImageMagnifierLens"),
      advertisementImagePreviewOpenButton: document.getElementById("advertisementImagePreviewOpenButton"),
      advertisementImagePreviewModal: document.getElementById("advertisementImagePreviewModal"),
      advertisementImagePreviewLarge: document.getElementById("advertisementImagePreviewLarge"),
      advertisementImagePreviewCloseButton: document.getElementById("advertisementImagePreviewCloseButton"),
      advertisementConvertModal: document.getElementById("advertisementConvertModal"),
      advertisementConvertModalTitle: document.getElementById("advertisementConvertModalTitle"),
      advertisementConvertModalMeta: document.getElementById("advertisementConvertModalMeta"),
      advertisementConvertModalCloseButton: document.getElementById("advertisementConvertModalCloseButton"),
      advertisementConvertResizeButton: document.getElementById("advertisementConvertResizeButton"),
      advertisementConvertClearButton: document.getElementById("advertisementConvertClearButton"),
      advertisementConvertRunButton: document.getElementById("advertisementConvertRunButton"),
      advertisementConvertHasAlphaInput: document.getElementById("advertisementConvertHasAlphaInput"),
      advertisementConvertEncoderSummary: document.getElementById("advertisementConvertEncoderSummary"),
      advertisementConvertDownloadSection: document.getElementById("advertisementConvertDownloadSection"),
      advertisementConvertDownloadPcButton: document.getElementById("advertisementConvertDownloadPcButton"),
      advertisementConvertDownloadAndroidButton: document.getElementById("advertisementConvertDownloadAndroidButton"),
      advertisementConvertDownloadIosButton: document.getElementById("advertisementConvertDownloadIosButton"),
      advertisementConvertLog: document.getElementById("advertisementConvertLog"),
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

`;
