export const MANAGER_APP_SCRIPT = `
    const MAX_PROMOTION_BYTES = 100 * 1024 * 1024;
    const state = {
      token: localStorage.getItem("mgr_token") || "",
      dayChart: null,
      langChart: null,
      promotionUsage: { usedBytes: 0, maxBytes: MAX_PROMOTION_BYTES, usedPercent: 0 },
      promotionItems: [],
      promotionModalMode: "create",
      promotionEditingId: "",
      promotionUploadedImageDataUrl: "",
      promotionSortEditMode: false,
      promotionSortDraftIds: [],
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
    };

    function getPromotionItemDataUrl(item) {
      const raw = String(item && item.Image ? item.Image : "").trim();
      if (!raw) return "";
      if (raw.startsWith("data:image/")) return raw;
      return "data:image/*;base64," + raw;
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
      if (data.status !== "ok") console.error("[mgr]", path, data);
      return { response, data };
    }

    function upsertDayChart(day) {
      const labels = ["Cache Hit", "Cache Miss", "AI Success", "AI Failure"];
      const values = [day.cacheHits, day.cacheMisses, day.aiSuccesses, day.aiFailures];
      if (!state.dayChart) {
        state.dayChart = new Chart(ui.dayChartCanvas, { type: "line", data: { labels, datasets: [{ data: values, borderColor: "#8b5cf6", backgroundColor: "rgba(139,92,246,0.18)", fill: true, tension: 0.3 }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
      } else {
        state.dayChart.data.labels = labels;
        state.dayChart.data.datasets[0].data = values;
        state.dayChart.update();
      }
    }

    function upsertLangChart(day) {
      const entries = Object.entries(day.languages || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const labels = entries.map((item) => item[0]);
      const values = entries.map((item) => item[1]);
      if (!state.langChart) {
        state.langChart = new Chart(ui.langChartCanvas, { type: "bar", data: { labels, datasets: [{ data: values, backgroundColor: "#a78bfa" }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
      } else {
        state.langChart.data.labels = labels;
        state.langChart.data.datasets[0].data = values;
        state.langChart.update();
      }
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

    function renderPromotionItems() {
      if (!state.promotionItems.length) {
        ui.promotionItemsList.innerHTML = '<p class="text-sm text-[color:var(--mgr-muted)]">登録項目はありません。</p>';
        return;
      }
      const sourceItems = state.promotionSortEditMode
        ? state.promotionSortDraftIds.map((id) => state.promotionItems.find((item) => item.ID === id)).filter(Boolean)
        : state.promotionItems;
      ui.promotionItemsList.innerHTML = sourceItems.map((item) => {
        const imageDataUrl = getPromotionItemDataUrl(item);
        const dragAttrs = state.promotionSortEditMode ? ' draggable="true" data-promotion-drag-id="' + item.ID + '"' : '';
        const moveUi = state.promotionSortEditMode
          ? '<span class="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 cursor-grab">ドラッグ</span>'
          : '';
        const previewUi = imageDataUrl
          ? '<button class="px-2 py-1 rounded bg-violet-100 text-violet-700 text-xs" data-promotion-preview="' + item.ID + '">画像</button>'
          : '';
        return '<div class="card p-3" ' + dragAttrs + '><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2">' + moveUi + '<div><p class="font-semibold">' + item.Type + ' / ' + (item.Title || "(no title)") + '</p><p class="text-xs text-[color:var(--mgr-muted)]">ID: ' + item.ID + '</p></div></div><div class="flex gap-2">' + previewUi + '<button class="px-2 py-1 rounded bg-violet-100 text-violet-700 text-xs" data-promotion-edit="' + item.ID + '">編集</button><button class="px-2 py-1 rounded bg-red-100 text-red-700 text-xs" data-promotion-delete="' + item.ID + '">削除</button></div></div><p class="text-xs mt-2 text-[color:var(--mgr-muted)]">' + (item.Description || "(no description)") + '</p></div>';
      }).join("");
      Array.from(ui.promotionItemsList.querySelectorAll("[data-promotion-delete]")).forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.getAttribute("data-promotion-delete");
          if (!id || !confirm("ID " + id + " を削除しますか？")) return;
          await callApi("/promotion/items/delete", { method: "POST", body: JSON.stringify({ id }) });
          await loadPromotionData();
        });
      });
      Array.from(ui.promotionItemsList.querySelectorAll("[data-promotion-preview]")).forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.getAttribute("data-promotion-preview");
          const item = state.promotionItems.find((entry) => entry.ID === id);
          if (!item) return;
          const source = getPromotionItemDataUrl(item);
          if (!source) return;
          ui.promotionImagePreviewLarge.src = source;
          ui.promotionImagePreviewModal.classList.remove("hidden");
        });
      });
      Array.from(ui.promotionItemsList.querySelectorAll("[data-promotion-edit]")).forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.getAttribute("data-promotion-edit");
          if (!id) return;
          const item = state.promotionItems.find((entry) => entry.ID === id);
          if (!item) return;
          openPromotionModal("edit", item);
        });
      });
      if (state.promotionSortEditMode) bindPromotionSortDragEvents();
    }

    function bindPromotionSortDragEvents() {
      let draggingId = "";
      Array.from(ui.promotionItemsList.querySelectorAll("[data-promotion-drag-id]")).forEach((element) => {
        element.addEventListener("dragstart", () => {
          draggingId = String(element.getAttribute("data-promotion-drag-id") || "");
          element.classList.add("opacity-60");
        });
        element.addEventListener("dragend", () => {
          element.classList.remove("opacity-60");
          draggingId = "";
        });
        element.addEventListener("dragover", (event) => event.preventDefault());
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

    async function loadPromotionData() {
      const usageResult = (await callApi("/promotion/usage")).data;
      if (usageResult.status === "ok") {
        state.promotionUsage = usageResult.result;
        renderPromotionUsage();
      }
      const selectedType = ui.promotionFilterType.value;
      const itemsResult = (await callApi("/promotion/items?type=" + encodeURIComponent(selectedType))).data;
      if (itemsResult.status === "ok") {
        state.promotionItems = itemsResult.result;
        if (!state.promotionSortEditMode) state.promotionSortDraftIds = state.promotionItems.map((item) => item.ID);
        renderPromotionItems();
      }
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

    function openPromotionModal(mode, item) {
      state.promotionModalMode = mode;
      if (mode === "create") {
        resetPromotionForm();
        ui.promotionModalTitle.textContent = "PromotionList 追加";
        ui.promotionIdInput.disabled = false;
        ui.promotionTypeInput.value = ui.promotionFilterType.value;
      } else {
        ui.promotionModalTitle.textContent = "PromotionList 編集";
        state.promotionEditingId = item.ID;
        ui.promotionTypeInput.value = item.Type;
        ui.promotionIdInput.value = item.ID;
        ui.promotionIdInput.disabled = true;
        ui.promotionTitleInput.value = item.Title;
        ui.promotionAnchorInput.value = item.Anchor;
        ui.promotionDescriptionInput.value = item.Description;
        ui.promotionLinkInput.value = item.Link;
        ui.promotionImageInput.value = item.Image;
        setPromotionImagePreview(item.Image);
        state.promotionUploadedImageDataUrl = "";
      }
      ui.promotionModal.classList.remove("hidden");
      refreshPromotionPrediction();
    }

    function closePromotionModal() {
      ui.promotionModal.classList.add("hidden");
      resetPromotionForm();
    }

    async function submitPromotionModal() {
      const payload = readPromotionForm();
      const prediction = refreshPromotionPrediction();
      if (prediction.total > MAX_PROMOTION_BYTES) {
        alert("予測サイズが 100MB を超えるため保存できません。");
        return;
      }
      beginPromotionSubmitProgress();
      if (state.promotionModalMode === "create") {
        setPromotionSubmitProgress(35, "追加データを送信しています...");
        const result = (await callApi("/promotion/items", { method: "POST", body: JSON.stringify({ type: payload.type, item: payload.item, predictedBytes: prediction.predicted }) })).data;
        if (result.status !== "ok") {
          endPromotionSubmitProgress();
          alert("追加に失敗しました。");
          return;
        }
      } else {
        setPromotionSubmitProgress(35, "更新データを送信しています...");
        const result = (await callApi("/promotion/items/update", { method: "POST", body: JSON.stringify({ id: state.promotionEditingId, type: payload.type, item: payload.item, predictedBytes: prediction.predicted }) })).data;
        if (result.status !== "ok") {
          endPromotionSubmitProgress();
          alert("更新に失敗しました。");
          return;
        }
      }
      setPromotionSubmitProgress(75, "一覧を更新しています...");
      await loadPromotionData();
      setPromotionSubmitProgress(100, "完了しました。");
      closePromotionModal();
    }

    async function loadDocs() {
      const aiDocs = (await callApi("/docs/ai")).data;
      if (aiDocs.status === "ok") ui.docsAiBody.innerHTML = aiDocs.result.body.map((line) => '<p>' + line + '</p>').join('');
      const promotionDocs = (await callApi("/docs/promotion")).data;
      if (promotionDocs.status === "ok") ui.docsPromotionBody.innerHTML = promotionDocs.result.body.map((line) => '<p>' + line + '</p>').join('');
    }

    async function loadStatus() {
      const result = (await callApi("/status")).data;
      if (result.status !== "ok") return null;
      ui.kpiEnabled.textContent = result.result.enabled ? "ON" : "OFF";
      ui.kpiRpm.textContent = String(result.result.requestsPerMinute);
      ui.kpiMaxChars.textContent = String(result.result.maxChars);
      ui.enabledInput.value = result.result.enabled ? "1" : "0";
      ui.rpmInput.value = String(result.result.requestsPerMinute);
      ui.maxCharsInput.value = String(result.result.maxChars);
      return result.result;
    }

    async function loadDashboard() {
      const status = await loadStatus();
      const stats = (await callApi("/stats")).data;
      if (stats.status === "ok" && status) {
        upsertDayChart(stats.result.day);
        upsertLangChart(stats.result.day);
      }
      await loadPromotionData();
    }

    ui.navItems.forEach((item) => item.addEventListener("click", () => switchPanel(item.dataset.panel)));
    ui.logoutButton.addEventListener("click", () => { localStorage.removeItem("mgr_token"); location.href = "/mgr"; });
    ui.refreshDashboardButton.addEventListener("click", loadDashboard);
    ui.saveConfigButton.addEventListener("click", async () => {
      await callApi("/config", { method: "POST", body: JSON.stringify({ enabled: ui.enabledInput.value === "1", requestsPerMinute: Number(ui.rpmInput.value), maxChars: Number(ui.maxCharsInput.value) }) });
      await loadDashboard();
    });
    ui.statsButton.addEventListener("click", async () => callApi("/stats"));
    ui.errorsButton.addEventListener("click", async () => callApi("/errors?limit=10"));
    ui.llmButton.addEventListener("click", async () => callApi("/llmrequests?limit=10"));
    ui.resetCacheButton.addEventListener("click", async () => confirm("translation_cache を全削除します。よろしいですか？") ? callApi("/resetcache", { method: "POST", body: "{}" }) : null);
    ui.pingButton.addEventListener("click", async () => callApi("/ping", { method: "POST", body: "{}" }));
    ui.simulateButton.addEventListener("click", async () => callApi("/simulate", { method: "POST", body: JSON.stringify({ lang: ui.simulateLangInput.value, text: ui.simulateTextInput.value }) }));

    ui.promotionCreateOpenButton.addEventListener("click", () => openPromotionModal("create"));
    ui.promotionSortEditButton.addEventListener("click", () => {
      state.promotionSortEditMode = true;
      state.promotionSortDraftIds = state.promotionItems.map((item) => item.ID);
      syncPromotionSortEditUi();
      renderPromotionItems();
    });
    ui.promotionSortCancelButton.addEventListener("click", () => {
      state.promotionSortEditMode = false;
      state.promotionSortDraftIds = state.promotionItems.map((item) => item.ID);
      syncPromotionSortEditUi();
      renderPromotionItems();
    });
    ui.promotionSortSaveButton.addEventListener("click", async () => {
      const payload = { type: ui.promotionFilterType.value, orderedIds: state.promotionSortDraftIds };
      const result = (await callApi("/promotion/items/reorder", { method: "POST", body: JSON.stringify(payload) })).data;
      if (result.status !== "ok") {
        alert("並び順の保存に失敗しました。");
        return;
      }
      state.promotionSortEditMode = false;
      syncPromotionSortEditUi();
      await loadPromotionData();
    });
    ui.promotionReloadButton.addEventListener("click", loadPromotionData);
    ui.refreshPromotionUsageButton.addEventListener("click", loadPromotionData);
    ui.promotionFilterType.addEventListener("change", () => {
      state.promotionSortEditMode = false;
      syncPromotionSortEditUi();
      loadPromotionData();
    });
    ui.promotionModalCloseButton.addEventListener("click", closePromotionModal);
    ui.promotionModalCancelButton.addEventListener("click", closePromotionModal);
    ui.promotionModalSubmitButton.addEventListener("click", submitPromotionModal);
    ui.promotionModal.addEventListener("click", (event) => { if (event.target === ui.promotionModal) closePromotionModal(); });
    ui.promotionImagePreviewOpenButton.addEventListener("click", () => ui.promotionImagePreviewModal.classList.remove("hidden"));
    ui.promotionImagePreviewCloseButton.addEventListener("click", () => ui.promotionImagePreviewModal.classList.add("hidden"));
    ui.promotionImagePreviewModal.addEventListener("click", (event) => { if (event.target === ui.promotionImagePreviewModal) ui.promotionImagePreviewModal.classList.add("hidden"); });
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
      try {
        state.promotionUploadedImageDataUrl = await fileToDataUrl(file);
      } catch (error) {
        console.error("[mgr] 画像読込に失敗しました", error);
      }
      await reapplyImageCompression();
    });
    [ui.promotionTypeInput, ui.promotionTitleInput, ui.promotionAnchorInput, ui.promotionDescriptionInput, ui.promotionLinkInput, ui.promotionImageInput].forEach((input) => input.addEventListener("input", () => {
      if (input === ui.promotionImageInput) setPromotionImagePreview(ui.promotionImageInput.value);
      refreshPromotionPrediction();
    }));
    ui.promotionIdInput.addEventListener("input", refreshPromotionPrediction);
    updatePromotionImageSizeWarning();
    syncPromotionSortEditUi();

    switchPanel("dashboard");
    loadDashboard();
    loadDocs();
`;
