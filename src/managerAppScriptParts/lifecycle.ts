export const MANAGER_APP_SCRIPT_LIFECYCLE = `
    const panelLoaders = {
      [PANEL_KEYS.dashboard]: loadDashboard,
      [PANEL_KEYS.aiConfig]: loadStatus,
      [PANEL_KEYS.promotionManage]: async () => await loadPromotionManageData(true),
      [PANEL_KEYS.advertisementManage]: async () => await loadAdvertisementManageData(true),
      [PANEL_KEYS.gistManage]: loadGistUploads,
      [PANEL_KEYS.docsAi]: createDocsLoader(ui.docsAiBody, "/docs/ai", "AIサービスの説明を読み込んでいます..."),
      [PANEL_KEYS.docsPromotion]: createDocsLoader(ui.docsPromotionBody, "/docs/promotion", "PromotionList の説明を読み込んでいます..."),
      [PANEL_KEYS.docsAdvertisement]: createDocsLoader(ui.docsAdvertisementBody, "/docs/advertisement", "Advertisement の説明を読み込んでいます..."),
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
          resetPromotionForm();
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
      try {
        const request = buildPromotionSubmitRequest(payload, prediction);
        const result = (await callApi(request.path, { method: "POST", body: JSON.stringify(request.body), loadingMessage: request.loadingMessage })).data;
        if (result.status !== "ok") {
          alert(request.failureMessage);
          return;
        }

        setPromotionSubmitProgress(75, "一覧を更新しています...");
        await refreshPromotionManagePanel();
        setPromotionSubmitProgress(100, "完了しました。");
        closePromotionModal();
      } finally {
        endPromotionSubmitProgress();
      }
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

    function resetAdvertisementForm() {
      ui.advertisementTitleInput.value = "";
      ui.advertisementGroupInput.value = "";
      ui.advertisementUrlInput.value = "";
      ui.advertisementImageInput.value = "";
      ui.advertisementImageFileInput.value = "";
      ui.advertisementCompressEnabled.checked = true;
      ui.advertisementCompressMaxSize.value = "512";
      ui.advertisementImageSizeWarning.classList.add("hidden");
      ui.advertisementImageDimensionText.textContent = "画像サイズ: -";
      ui.advertisementImageMultipleOf4Status.classList.add("hidden");
      ui.advertisementImageMultipleOf4Status.textContent = "";
      ui.advertisementImagePreviewContainer.classList.add("hidden");
      ui.advertisementImagePreviewOpenButton.classList.add("hidden");
      ui.advertisementImagePreview.removeAttribute("src");
      ui.advertisementImagePreviewLarge.removeAttribute("src");
      ui.advertisementSubmitProgressBox.classList.add("hidden");
      ui.advertisementSubmitProgressBar.style.width = "0%";
      ui.advertisementSubmitProgressText.textContent = "送信準備中...";
      ui.advertisementModalSubmitButton.disabled = false;
      ui.advertisementModalCancelButton.disabled = false;
      ui.advertisementModalCloseButton.disabled = false;
      ui.advertisementModalSubmitButton.classList.remove("opacity-70", "cursor-not-allowed");
      state.advertisementEditingId = "";
      state.advertisementUploadedImageDataUrl = "";
    }

    function readAdvertisementForm() {
      return {
        item: {
          Title: ui.advertisementTitleInput.value.trim(),
          Group: ui.advertisementGroupInput.value.trim(),
          URL: ui.advertisementUrlInput.value.trim(),
          Image: ui.advertisementImageInput.value.trim(),
        },
      };
    }

    function refreshAdvertisementPrediction() {
      const payload = readAdvertisementForm().item;
      const predicted = estimatePromotionBytes(payload);
      const total = state.advertisementUsage.total.usedBytes + predicted;
      ui.advertisementPredictionText.textContent = "追加予測: " + (predicted / (1024 * 1024)).toFixed(2) + "MB / 追加後合計: " + (total / (1024 * 1024)).toFixed(2) + "MB";
      ui.advertisementPredictionText.style.color = total > MAX_PROMOTION_BYTES ? "var(--mgr-danger)" : "var(--mgr-muted)";
      return { predicted, total };
    }

    function setAdvertisementImagePreview(base64Text) {
      const normalized = String(base64Text || "").trim();
      if (!normalized) {
        ui.advertisementImagePreviewContainer.classList.add("hidden");
        ui.advertisementImagePreviewOpenButton.classList.add("hidden");
        ui.advertisementImagePreview.removeAttribute("src");
        ui.advertisementImagePreviewLarge.removeAttribute("src");
        ui.advertisementImageMagnifierLens.classList.add("hidden");
        return;
      }
      const source = getPromotionItemDataUrl({ Image: normalized });
      ui.advertisementImagePreview.src = source;
      ui.advertisementImagePreviewLarge.src = source;
      ui.advertisementImagePreviewContainer.classList.remove("hidden");
      ui.advertisementImagePreviewOpenButton.classList.remove("hidden");
    }

    async function refreshAdvertisementImageDimensionText() {
      const imageValue = ui.advertisementImageInput.value.trim();
      if (!imageValue) {
        ui.advertisementImageDimensionText.textContent = "画像サイズ: -";
        ui.advertisementImageMultipleOf4Status.classList.add("hidden");
        return null;
      }
      try {
        const meta = await getImageMetaFromBase64(imageValue);
        ui.advertisementImageDimensionText.textContent = formatImageMeta(meta);
        const passed = isImageMetaConvertible(meta);
        ui.advertisementImageMultipleOf4Status.className = "md:col-span-2 rounded-xl border px-4 py-3 text-sm font-semibold";
        if (passed) {
          ui.advertisementImageMultipleOf4Status.classList.add("bg-emerald-50", "border-emerald-200", "text-emerald-700");
          ui.advertisementImageMultipleOf4Status.textContent = "4の倍数チェック: 通过（この画像はそのまま変換できます）";
        } else {
          ui.advertisementImageMultipleOf4Status.classList.add("bg-red-50", "border-red-200", "text-red-700");
          ui.advertisementImageMultipleOf4Status.textContent = "4の倍数チェック: 不通过（縦横とも 4 の倍数である必要があります）";
        }
        return meta;
      } catch (error) {
        ui.advertisementImageDimensionText.textContent = "画像サイズ: 読み取り失敗";
        ui.advertisementImageMultipleOf4Status.classList.add("hidden");
        return null;
      }
    }

    async function reapplyAdvertisementImageCompression() {
      const source = state.advertisementUploadedImageDataUrl || normalizeImageValueToDataUrl(ui.advertisementImageInput.value);
      if (!source) {
        await refreshAdvertisementImageDimensionText();
        return;
      }
      const maxSize = Number(ui.advertisementCompressMaxSize.value || "512");
      const enableCompress = ui.advertisementCompressEnabled.checked;
      try {
        const image = await dataUrlToImage(source);
        ui.advertisementImageInput.value = imageToBase64(image, maxSize, enableCompress);
      } catch (error) {
        console.error("[mgr] 広告画像再圧縮に失敗しました", error);
      }
      setAdvertisementImagePreview(ui.advertisementImageInput.value);
      refreshAdvertisementPrediction();
      await refreshAdvertisementImageDimensionText();
    }

    function fillAdvertisementForm(item) {
      state.advertisementEditingId = item.ID;
      ui.advertisementTitleInput.value = item.Title;
      ui.advertisementGroupInput.value = item.Group || "";
      ui.advertisementUrlInput.value = item.URL;
      ui.advertisementImageInput.value = item.Image;
      setAdvertisementImagePreview(item.Image);
      state.advertisementUploadedImageDataUrl = "";
    }

    async function openAdvertisementModal(mode, item) {
      state.advertisementModalMode = mode;
      if (mode === PROMOTION_MODAL_MODE.create) {
        resetAdvertisementForm();
        ui.advertisementModalTitle.textContent = "Advertisement 追加";
      } else {
        resetAdvertisementForm();
        ui.advertisementModalTitle.textContent = "Advertisement 編集";
        fillAdvertisementForm(item);
      }
      ui.advertisementModal.classList.remove("hidden");
      refreshAdvertisementPrediction();
      await refreshAdvertisementImageDimensionText();
    }

    function closeAdvertisementModal() {
      ui.advertisementModal.classList.add("hidden");
      resetAdvertisementForm();
      state.currentAdvertisementDetail = null;
    }

    function setAdvertisementSubmitProgress(percent, text) {
      const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
      ui.advertisementSubmitProgressBox.classList.remove("hidden");
      ui.advertisementSubmitProgressBar.style.width = normalized + "%";
      ui.advertisementSubmitProgressText.textContent = text;
    }

    function endAdvertisementSubmitProgress() {
      ui.advertisementModalSubmitButton.disabled = false;
      ui.advertisementModalCancelButton.disabled = false;
      ui.advertisementModalCloseButton.disabled = false;
      ui.advertisementModalSubmitButton.classList.remove("opacity-70", "cursor-not-allowed");
      ui.advertisementSubmitProgressBox.classList.add("hidden");
      ui.advertisementSubmitProgressBar.style.width = "0%";
      ui.advertisementSubmitProgressText.textContent = "送信準備中...";
    }

    async function submitAdvertisementModal() {
      if (!state.advertisementScopeId) return;
      const payload = readAdvertisementForm();
      const prediction = refreshAdvertisementPrediction();
      if (prediction.total > MAX_PROMOTION_BYTES) {
        alert("予測サイズが 100MB を超えるため保存できません。");
        return;
      }
      ui.advertisementModalSubmitButton.disabled = true;
      ui.advertisementModalCancelButton.disabled = true;
      ui.advertisementModalCloseButton.disabled = true;
      ui.advertisementModalSubmitButton.classList.add("opacity-70", "cursor-not-allowed");
      const isCreate = state.advertisementModalMode === PROMOTION_MODAL_MODE.create;
      try {
        setAdvertisementSubmitProgress(35, isCreate ? "追加データを送信しています..." : "更新データを送信しています...");
        const result = (await callApi(isCreate ? "/advertisement/items" : "/advertisement/items/update", {
          method: "POST",
          body: JSON.stringify(isCreate ? { scopeId: state.advertisementScopeId, item: payload.item, predictedBytes: prediction.predicted } : { id: state.advertisementEditingId, item: payload.item, predictedBytes: prediction.predicted }),
          loadingMessage: isCreate ? "Advertisement 項目を追加しています..." : "Advertisement 項目を更新しています...",
        })).data;
        if (result.status !== "ok") {
          alert(isCreate ? "追加に失敗しました。" : "更新に失敗しました。");
          return;
        }
        setAdvertisementSubmitProgress(75, "一覧を更新しています...");
        await refreshAdvertisementManagePanel();
        setAdvertisementSubmitProgress(100, "完了しました。");
        closeAdvertisementModal();
      } finally {
        endAdvertisementSubmitProgress();
      }
    }

    async function saveAdvertisementItem(item, loadingMessage) {
      const result = (await callApi("/advertisement/items/update", {
        method: "POST",
        body: JSON.stringify({ id: item.ID, item: { Title: item.Title, Group: item.Group || "", URL: item.URL, Image: item.Image }, predictedBytes: estimatePromotionBytes(item) }),
        loadingMessage,
      })).data;
      if (result.status !== "ok") throw new Error("advertisement_item_save_failed");
      await refreshAdvertisementManagePanel();
      return await loadAdvertisementItemDetail(item.ID);
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

    function appendAdvertisementConvertLog(message) {
      const current = ui.advertisementConvertLog.textContent || "";
      ui.advertisementConvertLog.textContent = current + (current ? "\\n" : "") + message;
      ui.advertisementConvertLog.scrollTop = ui.advertisementConvertLog.scrollHeight;
    }

    function setAdvertisementConvertBusy(busy) {
      state.advertisementConvertBusy = busy;
      ui.advertisementConvertRunButton.disabled = busy;
      ui.advertisementConvertResizeButton.disabled = busy;
      ui.advertisementConvertClearButton.disabled = busy;
      ui.advertisementConvertModalCloseButton.disabled = busy;
      ui.advertisementConvertHasAlphaInput.disabled = busy;
      ui.advertisementConvertRunButton.classList.toggle("opacity-70", busy);
    }

    function refreshAdvertisementConvertEncoderSummary() {
      ui.advertisementConvertEncoderSummary.textContent = getPlatformEncoderSummaryText(state.currentAdvertisementConvertHasAlpha);
    }

    function refreshAdvertisementConvertDownloadButtons() {
      const convertedPlatforms = new Set(state.currentAdvertisementDetail?.ConvertedPlatforms || []);
      ui.advertisementConvertDownloadPcButton.classList.toggle("hidden", !convertedPlatforms.has("pc"));
      ui.advertisementConvertDownloadAndroidButton.classList.toggle("hidden", !convertedPlatforms.has("android"));
      ui.advertisementConvertDownloadIosButton.classList.toggle("hidden", !convertedPlatforms.has("ios"));
      ui.advertisementConvertDownloadSection.classList.toggle("hidden", convertedPlatforms.size === 0);
    }

    async function openAdvertisementConvertModal(id) {
      const item = await loadAdvertisementItemDetail(id);
      if (!item) return;
      const meta = await getImageMetaFromBase64(item.Image);
      state.currentAdvertisementConvertHasAlpha = !!meta?.hasAlpha;
      ui.advertisementConvertHasAlphaInput.checked = state.currentAdvertisementConvertHasAlpha;
      refreshAdvertisementConvertEncoderSummary();
      refreshAdvertisementConvertDownloadButtons();
      ui.advertisementConvertModalTitle.textContent = "画像変換 / " + (item.Title || item.ID);
      ui.advertisementConvertModalMeta.textContent = formatImageMeta(meta);
      ui.advertisementConvertLog.textContent = "";
      appendAdvertisementConvertLog("対象ID: " + item.ID);
      if (meta && !isImageMetaConvertible(meta)) appendAdvertisementConvertLog("注意: 画像サイズは縦横とも 4 の倍数である必要があります。");
      ui.advertisementConvertModal.classList.remove("hidden");
      setAdvertisementConvertBusy(false);
    }

    function closeAdvertisementConvertModal() {
      if (state.advertisementConvertBusy) return;
      ui.advertisementConvertModal.classList.add("hidden");
      state.currentAdvertisementDetail = null;
      refreshAdvertisementConvertDownloadButtons();
      ui.advertisementConvertLog.textContent = "";
    }

    async function resizeCurrentAdvertisementItemToMultipleOf4AndSave() {
      const item = state.currentAdvertisementDetail;
      if (!item || !item.Image) return;
      const meta = await getImageMetaFromBase64(item.Image);
      if (!meta || isImageMetaConvertible(meta)) {
        appendAdvertisementConvertLog("画像サイズは既に 4 の倍数です。保存は不要です。");
        return;
      }
      setAdvertisementConvertBusy(true);
      try {
        const resized = await resizeBase64ImageToNextMultipleOf4(item.Image);
        const savedItem = await saveAdvertisementItem(Object.assign({}, item, { Image: resized.base64 }), "4 の倍数サイズへ保存しています...");
        appendAdvertisementConvertLog("保存完了: " + resized.width + " x " + resized.height);
        if (savedItem) {
          state.currentAdvertisementDetail = savedItem;
          ui.advertisementConvertModalMeta.textContent = formatImageMeta(await getImageMetaFromBase64(savedItem.Image));
          refreshAdvertisementConvertDownloadButtons();
        }
      } finally {
        setAdvertisementConvertBusy(false);
      }
    }

    async function runAdvertisementConversion() {
      const item = state.currentAdvertisementDetail;
      if (!item || !item.Image) return;
      const meta = await getImageMetaFromBase64(item.Image);
      if (!isImageMetaConvertible(meta)) {
        appendAdvertisementConvertLog("変換を開始できません。先に画像を 4 の倍数へ拡大して保存してください。");
        return;
      }
      setAdvertisementConvertBusy(true);
      try {
        appendAdvertisementConvertLog("変換開始: pc → android → ios");
        for (const platform of PROMOTION_PLATFORMS) {
          const result = (await callApi("/advertisement/items/convert", {
            method: "POST",
            body: JSON.stringify({ id: item.ID, platform, hasAlpha: state.currentAdvertisementConvertHasAlpha, imageWidth: meta.width, imageHeight: meta.height }),
            loadingMessage: platform + " 向け広告画像を変換しています...",
          })).data;
          if (result.status !== "ok") {
            appendAdvertisementConvertLog("[" + platform + "] 失敗: " + result.result);
            return;
          }
          appendAdvertisementConvertLog("[" + platform + "] 完了: " + result.result.textureFormat + " / " + result.result.outputFormat + " / " + result.result.outputBytes + " bytes");
          await loadAdvertisementItems();
          state.currentAdvertisementDetail = await loadAdvertisementItemDetail(item.ID);
          refreshAdvertisementConvertDownloadButtons();
        }
        await loadAdvertisementUsage();
        appendAdvertisementConvertLog("全プラットフォームの変換が完了しました。");
      } finally {
        setAdvertisementConvertBusy(false);
      }
    }

    async function clearCurrentAdvertisementConvertedData() {
      const item = state.currentAdvertisementDetail;
      if (!item) return;
      if (!confirm("現在の項目の変換済みデータをすべて清空しますか？")) return;
      setAdvertisementConvertBusy(true);
      try {
        const result = (await callApi("/advertisement/items/clear-converted", {
          method: "POST",
          body: JSON.stringify({ id: item.ID }),
          loadingMessage: "変換済みデータを清空しています...",
        })).data;
        if (result.status !== "ok") {
          appendAdvertisementConvertLog("清空失敗: " + result.result);
          return;
        }
        await loadAdvertisementItems();
        state.currentAdvertisementDetail = await loadAdvertisementItemDetail(item.ID);
        refreshAdvertisementConvertDownloadButtons();
        appendAdvertisementConvertLog("清空完了");
      } finally {
        setAdvertisementConvertBusy(false);
      }
    }

    async function downloadAdvertisementConvertedBinary(platform) {
      const item = state.currentAdvertisementDetail;
      if (!item) return;
      const response = await fetch("/mgr/api/advertisement/items/download?id=" + encodeURIComponent(item.ID) + "&platform=" + encodeURIComponent(platform), {
        headers: { authorization: "Bearer " + state.token },
      });
      if (!response.ok) {
        appendAdvertisementConvertLog("[" + platform + "] ダウンロード失敗: HTTP " + response.status);
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = item.ID + "_" + platform + "." + (platform === "pc" ? "crn" : "ktx");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
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

    async function refreshAdvertisementManagePanel() {
      invalidatePanels(PANEL_KEYS.advertisementManage);
      await ensurePanelData(PANEL_KEYS.advertisementManage, true);
    }

    async function deleteAdvertisementItemById(id) {
      if (!id || !confirm("項目を削除しますか？")) return;
      await callApi("/advertisement/items/delete", { method: "POST", body: JSON.stringify({ id }), loadingMessage: "項目を削除しています..." });
      await refreshAdvertisementManagePanel();
    }

    async function uploadAdvertisementGistPlatform(platform) {
      const result = (await callApi("/advertisement/gist/upload-platform", {
        method: "POST",
        body: JSON.stringify({ scopeId: state.advertisementScopeId, platform }),
        loadingMessage: platform + " の JSON を gistfs へアップロードしています...",
      })).data;
      if (result.status !== "ok") throw new Error(String(result.result || "upload_failed"));
      return result.result;
    }

    async function uploadAdvertisementGists() {
      if (state.advertisementGistUploadBusy || !state.advertisementScopeId) return;
      setAdvertisementGistUploadBusy(true);
      appendAdvertisementGistLog("アップロード開始: pc → android → ios");
      try {
        for (const platform of PROMOTION_PLATFORMS) {
          const uploaded = await uploadAdvertisementGistPlatform(platform);
          appendAdvertisementGistLog("[" + platform + "] 完了: " + uploaded.rawUrl + " / " + formatBytes(uploaded.size));
          await loadAdvertisementGistStatus();
        }
        invalidatePanels(PANEL_KEYS.gistManage);
        if (!ui.panels[PANEL_KEYS.gistManage].classList.contains("hidden")) await loadGistUploads();
        appendAdvertisementGistLog("選択 Scope のアップロードが完了しました。");
      } catch (error) {
        appendAdvertisementGistLog("失敗: " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setAdvertisementGistUploadBusy(false);
      }
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
      await Promise.all([loadPromotionGistStatus(), loadAdvertisementGistStatus(), loadGistUploads()]);
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

    function openAdvertisementPreviewById(id) {
      const item = getAdvertisementItemById(id);
      if (!item) return;
      const source = getPromotionItemDataUrl(item);
      if (!source) return;
      ui.advertisementImagePreviewLarge.src = source;
      ui.advertisementImagePreviewModal.classList.remove("hidden");
    }

    async function handleAdvertisementListClick(event) {
      const actionButton = event.target.closest("[data-advertisement-delete], [data-advertisement-preview], [data-advertisement-edit], [data-advertisement-convert]");
      if (!actionButton) return;
      const deleteId = actionButton.getAttribute("data-advertisement-delete");
      if (deleteId) {
        await deleteAdvertisementItemById(deleteId);
        return;
      }
      const previewId = actionButton.getAttribute("data-advertisement-preview");
      if (previewId) {
        openAdvertisementPreviewById(previewId);
        return;
      }
      const editId = actionButton.getAttribute("data-advertisement-edit");
      if (editId) {
        const item = await loadAdvertisementItemDetail(editId);
        if (item) await openAdvertisementModal(PROMOTION_MODAL_MODE.edit, item);
        return;
      }
      const convertId = actionButton.getAttribute("data-advertisement-convert");
      if (convertId) await openAdvertisementConvertModal(convertId);
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

`;
