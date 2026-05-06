export const MANAGER_APP_SCRIPT_BINDINGS = `
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

    function bindAdvertisementEvents() {
      ui.advertisementItemsList.addEventListener("click", handleAdvertisementListClick);
      ui.advertisementCreateOpenButton.addEventListener("click", async () => await openAdvertisementModal(PROMOTION_MODAL_MODE.create));
      ui.advertisementReloadButton.addEventListener("click", async () => await refreshAdvertisementManagePanel());
      ui.advertisementScopeSelect.addEventListener("change", async () => {
        state.advertisementScopeId = ui.advertisementScopeSelect.value;
        state.advertisementSortEditMode = false;
        syncAdvertisementSortEditUi();
        await loadAdvertisementGistStatus();
        await loadAdvertisementItems();
      });
      ui.refreshAdvertisementUsageButton.addEventListener("click", async () => await loadAdvertisementUsage());
      ui.advertisementGistUploadButton.addEventListener("click", uploadAdvertisementGists);
      ui.advertisementGistLogClearButton.addEventListener("click", () => {
        ui.advertisementGistUploadLog.textContent = "";
      });
      ui.advertisementScopeCreateButton.addEventListener("click", async () => {
        const scopeKey = prompt("ScopeKey を入力してください。a-z / 0-9 / _ / -");
        if (!scopeKey) return;
        const name = prompt("表示名を入力してください。", scopeKey);
        if (!name) return;
        const result = (await callApi("/advertisement/scopes", { method: "POST", body: JSON.stringify({ scopeKey, name }), loadingMessage: "Scope を追加しています..." })).data;
        if (result.status !== "ok") {
          alert(String(result.result || "Scope 追加に失敗しました。"));
          return;
        }
        state.advertisementScopeId = result.result.ID;
        await refreshAdvertisementManagePanel();
      });
      ui.advertisementScopeRenameButton.addEventListener("click", async () => {
        if (!state.advertisementScopeId) return;
        const currentScope = state.advertisementScopes.find((scope) => scope.ID === state.advertisementScopeId);
        const name = prompt("新しい表示名を入力してください。", currentScope ? currentScope.Name : "");
        if (!name) return;
        const result = (await callApi("/advertisement/scopes/update", { method: "POST", body: JSON.stringify({ id: state.advertisementScopeId, name }), loadingMessage: "Scope 名を更新しています..." })).data;
        if (result.status !== "ok") {
          alert("Scope 更新に失敗しました。");
          return;
        }
        await refreshAdvertisementManagePanel();
      });
      ui.advertisementScopeDeleteButton.addEventListener("click", async () => {
        if (!state.advertisementScopeId || !confirm("選択中 Scope を削除しますか？")) return;
        await callApi("/advertisement/scopes/delete", { method: "POST", body: JSON.stringify({ id: state.advertisementScopeId }), loadingMessage: "Scope を削除しています..." });
        state.advertisementScopeId = "";
        await refreshAdvertisementManagePanel();
      });
      ui.advertisementSortEditButton.addEventListener("click", () => setAdvertisementSortEditMode(true));
      ui.advertisementSortCancelButton.addEventListener("click", () => setAdvertisementSortEditMode(false));
      ui.advertisementSortSaveButton.addEventListener("click", async () => {
        const result = (await callApi("/advertisement/items/reorder", { method: "POST", body: JSON.stringify({ scopeId: state.advertisementScopeId, orderedIds: state.advertisementSortDraftIds }), loadingMessage: "並び順を保存しています..." })).data;
        if (result.status !== "ok") {
          alert("並び順の保存に失敗しました。");
          return;
        }
        setAdvertisementSortEditMode(false);
        await refreshAdvertisementManagePanel();
      });
      ui.advertisementModalCloseButton.addEventListener("click", closeAdvertisementModal);
      ui.advertisementModalCancelButton.addEventListener("click", closeAdvertisementModal);
      ui.advertisementModalSubmitButton.addEventListener("click", submitAdvertisementModal);
      ui.advertisementModal.addEventListener("click", (event) => {
        if (event.target === ui.advertisementModal) closeAdvertisementModal();
      });
      ui.advertisementCompressEnabled.addEventListener("change", () => {
        ui.advertisementImageSizeWarning.classList.toggle("hidden", Number(ui.advertisementCompressMaxSize.value || "512") <= 512);
        reapplyAdvertisementImageCompression();
      });
      ui.advertisementCompressMaxSize.addEventListener("change", () => {
        ui.advertisementImageSizeWarning.classList.toggle("hidden", Number(ui.advertisementCompressMaxSize.value || "512") <= 512);
        reapplyAdvertisementImageCompression();
      });
      ui.advertisementImageFileInput.addEventListener("change", async () => {
        const file = ui.advertisementImageFileInput.files && ui.advertisementImageFileInput.files[0];
        if (!file) return;
        beginGlobalLoading("画像を読み込んでいます...");
        try {
          state.advertisementUploadedImageDataUrl = await fileToDataUrl(file);
          await reapplyAdvertisementImageCompression();
        } finally {
          endGlobalLoading();
        }
      });
      [ui.advertisementTitleInput, ui.advertisementUrlInput, ui.advertisementImageInput].forEach((input) => input.addEventListener("input", async () => {
        if (input === ui.advertisementImageInput) {
          setAdvertisementImagePreview(ui.advertisementImageInput.value);
          await refreshAdvertisementImageDimensionText();
        }
        refreshAdvertisementPrediction();
      }));
      ui.advertisementResizeToMultipleOf4Button.addEventListener("click", async () => {
        const currentImage = ui.advertisementImageInput.value.trim();
        if (!currentImage) return;
        const meta = await getImageMetaFromBase64(currentImage);
        if (isImageMetaConvertible(meta)) {
          alert("画像サイズは既に 4 の倍数です。");
          return;
        }
        const resized = await resizeBase64ImageToNextMultipleOf4(currentImage);
        ui.advertisementImageInput.value = resized.base64;
        state.advertisementUploadedImageDataUrl = getPromotionItemDataUrl({ Image: resized.base64 });
        setAdvertisementImagePreview(resized.base64);
        refreshAdvertisementPrediction();
        await refreshAdvertisementImageDimensionText();
      });
      ui.advertisementImagePreviewOpenButton.addEventListener("click", () => ui.advertisementImagePreviewModal.classList.remove("hidden"));
      ui.advertisementImagePreviewCloseButton.addEventListener("click", () => ui.advertisementImagePreviewModal.classList.add("hidden"));
      ui.advertisementImagePreviewModal.addEventListener("click", (event) => {
        if (event.target === ui.advertisementImagePreviewModal) ui.advertisementImagePreviewModal.classList.add("hidden");
      });
      ui.advertisementImagePreviewContainer.addEventListener("mousemove", (event) => {
        const rect = ui.advertisementImagePreview.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const lens = ui.advertisementImageMagnifierLens;
        lens.style.left = Math.max(0, Math.min(rect.width - 112, x - 56)) + "px";
        lens.style.top = Math.max(0, Math.min(rect.height - 112, y - 56)) + "px";
        lens.style.backgroundImage = "url('" + ui.advertisementImagePreview.src + "')";
        lens.style.backgroundSize = (rect.width * 2.5) + "px " + (rect.height * 2.5) + "px";
        lens.style.backgroundPosition = (-(x * 2.5 - 56)) + "px " + (-(y * 2.5 - 56)) + "px";
        lens.style.backgroundColor = "#ffffffdd";
        lens.classList.remove("hidden");
      });
      ui.advertisementImagePreviewContainer.addEventListener("mouseleave", () => ui.advertisementImageMagnifierLens.classList.add("hidden"));
      ui.advertisementConvertModalCloseButton.addEventListener("click", closeAdvertisementConvertModal);
      ui.advertisementConvertModal.addEventListener("click", (event) => {
        if (event.target === ui.advertisementConvertModal) closeAdvertisementConvertModal();
      });
      ui.advertisementConvertHasAlphaInput.addEventListener("change", () => {
        state.currentAdvertisementConvertHasAlpha = !!ui.advertisementConvertHasAlphaInput.checked;
        refreshAdvertisementConvertEncoderSummary();
        appendAdvertisementConvertLog("変換設定アルファを " + (state.currentAdvertisementConvertHasAlpha ? "あり" : "なし") + " に変更しました。");
      });
      ui.advertisementConvertDownloadPcButton.addEventListener("click", async () => await downloadAdvertisementConvertedBinary("pc"));
      ui.advertisementConvertDownloadAndroidButton.addEventListener("click", async () => await downloadAdvertisementConvertedBinary("android"));
      ui.advertisementConvertDownloadIosButton.addEventListener("click", async () => await downloadAdvertisementConvertedBinary("ios"));
      ui.advertisementConvertResizeButton.addEventListener("click", resizeCurrentAdvertisementItemToMultipleOf4AndSave);
      ui.advertisementConvertClearButton.addEventListener("click", clearCurrentAdvertisementConvertedData);
      ui.advertisementConvertRunButton.addEventListener("click", runAdvertisementConversion);
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
      bindAdvertisementEvents();
      bindGistManageEvents();
      updatePromotionImageSizeWarning();
      syncPromotionSortEditUi();
      syncAdvertisementSortEditUi();
      switchPanel(PANEL_KEYS.dashboard);
      ensurePanelData(PANEL_KEYS.dashboard, false);
    }

    initializePage();`;
