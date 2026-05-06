export const MANAGER_APP_SCRIPT_PROMOTION = `
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
      const usage = state.promotionUsage || {};
      const platforms = usage.platforms || {};
      const total = usage.total || { usedBytes: 0, usedPercent: 0 };
      const pc = platforms.pc || { usedBytes: 0, usedPercent: 0 };
      const android = platforms.android || { usedBytes: 0, usedPercent: 0 };
      const ios = platforms.ios || { usedBytes: 0, usedPercent: 0 };
      const maxBytes = Number(usage.maxBytes || MAX_PROMOTION_BYTES);
      const maxBytesText = (maxBytes / (1024 * 1024)).toFixed(0) + "MB";
      ui.promotionUsageTextPc.textContent = (Number(pc.usedBytes || 0) / (1024 * 1024)).toFixed(2) + "MB / " + maxBytesText;
      ui.promotionUsageTextAndroid.textContent = (Number(android.usedBytes || 0) / (1024 * 1024)).toFixed(2) + "MB / " + maxBytesText;
      ui.promotionUsageTextIos.textContent = (Number(ios.usedBytes || 0) / (1024 * 1024)).toFixed(2) + "MB / " + maxBytesText;
      ui.promotionUsageBarPc.style.width = Math.min(100, Number(pc.usedPercent || 0)) + "%";
      ui.promotionUsageBarAndroid.style.width = Math.min(100, Number(android.usedPercent || 0)) + "%";
      ui.promotionUsageBarIos.style.width = Math.min(100, Number(ios.usedPercent || 0)) + "%";
      ui.promotionUsageTextTotal.textContent = "合計: " + (Number(total.usedBytes || 0) / (1024 * 1024)).toFixed(2) + "MB";
      ui.kpiPromotionUsage.textContent = Number(total.usedPercent || 0).toFixed(2) + "%";
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

    function appendAdvertisementGistLog(message) {
      const current = ui.advertisementGistUploadLog.textContent || "";
      ui.advertisementGistUploadLog.textContent = current + (current ? "\\n" : "") + message;
      ui.advertisementGistUploadLog.scrollTop = ui.advertisementGistUploadLog.scrollHeight;
    }

    function setAdvertisementGistUploadBusy(busy) {
      state.advertisementGistUploadBusy = busy;
      ui.advertisementGistUploadButton.disabled = busy;
      ui.advertisementGistUploadButton.classList.toggle("opacity-70", busy);
      ui.advertisementGistUploadButton.classList.toggle("cursor-not-allowed", busy);
    }

    function buildAdvertisementGistStatusCard(platform, record) {
      const platformNameMap = { pc: "PC", android: "Android", ios: "iOS" };
      if (!record) return '<div class="rounded-xl border border-[color:var(--mgr-border)] bg-white p-3 space-y-2"><p class="text-sm font-semibold">' + platformNameMap[platform] + '</p><p class="text-xs text-[color:var(--mgr-muted)]">最終更新: 未アップロード</p><p class="text-xs text-[color:var(--mgr-muted)]">Raw URL: 未アップロード</p></div>';
      return '<div class="rounded-xl border border-[color:var(--mgr-border)] bg-white p-3 space-y-2"><p class="text-sm font-semibold">' + platformNameMap[platform] + '</p><p class="text-xs text-[color:var(--mgr-muted)]">最終更新: ' + escapeHtml(formatDateTime(record.uploadedAt, "gistfs API 未提供")) + '</p><a class="text-xs text-sky-700 break-all underline" href="' + escapeHtml(record.rawUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(record.rawUrl) + '</a><p class="text-xs text-[color:var(--mgr-muted)]">サイズ: ' + escapeHtml(formatBytes(record.size)) + '</p></div>';
    }

    function renderAdvertisementGistStatus() {
      const platforms = state.advertisementGistStatus.platforms || {};
      ui.advertisementGistStatusList.innerHTML = PROMOTION_PLATFORMS.map((platform) => buildAdvertisementGistStatusCard(platform, platforms[platform])).join("");
    }

    function buildAdvertisementConvertButton(item) {
      if (!item.HasImage) return "";
      const converted = !!item.IsImageConverted;
      const baseClass = converted ? "px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs" : "px-2 py-1 rounded bg-violet-600 text-white text-xs";
      return '<button class="' + baseClass + '" data-advertisement-convert="' + item.ID + '">' + (converted ? "変換済み" : "変換") + '</button>';
    }

    function getAdvertisementSourceItems() {
      return state.advertisementSortEditMode ? state.advertisementSortDraftIds.map((id) => state.advertisementItems.find((item) => item.ID === id)).filter(Boolean) : state.advertisementItems;
    }

    function buildAdvertisementItemCard(item) {
      const dragAttrs = state.advertisementSortEditMode ? ' draggable="true" data-advertisement-drag-id="' + item.ID + '"' : "";
      const moveUi = state.advertisementSortEditMode ? '<span class="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 cursor-grab">ドラッグ</span>' : "";
      const previewUi = item.HasImage ? '<span class="px-2 py-1 rounded bg-violet-100 text-violet-700 text-xs">画像あり</span>' : '<span class="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs">画像なし</span>';
      const convertUi = buildAdvertisementConvertButton(item);
      const groupUi = item.Group ? '<p class="text-xs text-[color:var(--mgr-muted)]">Group: ' + escapeHtml(item.Group) + '</p>' : "";
      return '<div class="card p-3" ' + dragAttrs + '><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2">' + moveUi + '<div><p class="font-semibold">' + (item.Title || "(no title)") + '</p>' + groupUi + '<p class="text-xs text-[color:var(--mgr-muted)]">URL: ' + escapeHtml(item.URL || "-") + '</p></div></div><div class="flex gap-2">' + previewUi + convertUi + '<button class="px-2 py-1 rounded bg-violet-100 text-violet-700 text-xs" data-advertisement-edit="' + item.ID + '">編集</button><button class="px-2 py-1 rounded bg-red-100 text-red-700 text-xs" data-advertisement-delete="' + item.ID + '">削除</button></div></div></div>';
    }

    function renderAdvertisementItems() {
      if (!state.advertisementItems.length) {
        ui.advertisementItemsList.innerHTML = '<p class="text-sm text-[color:var(--mgr-muted)]">登録項目はありません。</p>';
        return;
      }
      ui.advertisementItemsList.innerHTML = getAdvertisementSourceItems().map((item) => buildAdvertisementItemCard(item)).join("");
      if (state.advertisementSortEditMode) bindAdvertisementSortDragEvents();
    }

    function syncAdvertisementSortEditUi() {
      ui.advertisementSortEditButton.classList.toggle("hidden", state.advertisementSortEditMode);
      ui.advertisementSortSaveButton.classList.toggle("hidden", !state.advertisementSortEditMode);
      ui.advertisementSortCancelButton.classList.toggle("hidden", !state.advertisementSortEditMode);
      ui.advertisementSortHint.classList.toggle("hidden", !state.advertisementSortEditMode);
      ui.advertisementScopeSelect.disabled = state.advertisementSortEditMode;
    }

    function setAdvertisementSortEditMode(enabled) {
      state.advertisementSortEditMode = enabled;
      state.advertisementSortDraftIds = state.advertisementItems.map((item) => item.ID);
      syncAdvertisementSortEditUi();
      renderAdvertisementItems();
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

    function bindAdvertisementSortDragEvents() {
      let draggingId = "";

      Array.from(ui.advertisementItemsList.querySelectorAll("[data-advertisement-drag-id]")).forEach((element) => {
        element.addEventListener("dragstart", () => {
          draggingId = String(element.getAttribute("data-advertisement-drag-id") || "");
          element.classList.add("opacity-60");
        });
        element.addEventListener("dragend", () => {
          element.classList.remove("opacity-60");
          draggingId = "";
        });
        element.addEventListener("dragover", (event) => {
          event.preventDefault();
        });
        element.addEventListener("drop", (event) => {
          event.preventDefault();
          const targetId = String(element.getAttribute("data-advertisement-drag-id") || "");
          if (!draggingId || !targetId || draggingId === targetId) return;
          const ids = state.advertisementSortDraftIds.slice();
          const from = ids.indexOf(draggingId);
          const to = ids.indexOf(targetId);
          if (from < 0 || to < 0) return;
          ids.splice(from, 1);
          ids.splice(to, 0, draggingId);
          state.advertisementSortDraftIds = ids;
          renderAdvertisementItems();
        });
      });
    }

    async function loadPromotionUsage(skipGlobalLoading) {
      const usageResult = (await callApi("/promotion/usage", { loadingMessage: "PromotionList の使用率を計算しています...", skipGlobalLoading: !!skipGlobalLoading })).data;
      if (usageResult.status === "ok") {
        state.promotionUsage = usageResult.result;
        renderPromotionUsage();
      }
    }

    async function loadPromotionGistStatus() {
      setSectionLoading(ui.promotionGistStatusList, null, true);
      try {
        const result = (await callApi("/promotion/gist/status", { loadingMessage: "PromotionList の Gist 状態を読み込んでいます...", skipGlobalLoading: true })).data;
        if (result.status !== "ok") return;
        state.promotionGistStatus = result.result;
        renderPromotionGistStatus();
      } finally {
        setSectionLoading(ui.promotionGistStatusList, null, false);
      }
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
      if (forceReloadUsage) await loadPromotionUsage(true);
      await loadPromotionItems();
      loadPromotionGistStatus();
    }

`;
