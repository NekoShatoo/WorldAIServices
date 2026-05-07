export function buildPanelHeader(title: string, subtitle: string, actions = '') {
	return `<div class="panel-header">
  <div>
    <h2 class="panel-title">${title}</h2>
    <p class="panel-subtitle">${subtitle}</p>
  </div>
  ${actions}
</div>`;
}

export function buildPlatformUsage(prefix: 'promotion' | 'advertisement') {
	const title = 'API 使用率（上限 100MB）';
	const refreshId = prefix === 'promotion' ? 'refreshPromotionUsageButton' : 'refreshAdvertisementUsageButton';
	const textPrefix = prefix === 'promotion' ? 'promotion' : 'advertisement';
	return `<section class="surface">
  <div class="section-header">
    <h3 class="text-sm font-semibold">${title}</h3>
    <button id="${refreshId}" class="btn btn-soft">再計算</button>
  </div>
  <div class="progress-row mt-3">
    ${buildPlatformUsageRow('PC', `${textPrefix}UsageTextPc`, `${textPrefix}UsageBarPc`, 'bg-sky-500')}
    ${buildPlatformUsageRow('Android', `${textPrefix}UsageTextAndroid`, `${textPrefix}UsageBarAndroid`, 'bg-emerald-500')}
    ${buildPlatformUsageRow('iOS', `${textPrefix}UsageTextIos`, `${textPrefix}UsageBarIos`, 'bg-amber-500')}
  </div>
  <p id="${textPrefix}UsageTextTotal" class="mt-3 text-xs text-[color:var(--mgr-muted)]">合計: 0 / 300MB 相当</p>
</section>`;
}

function buildPlatformUsageRow(label: string, textId: string, barId: string, colorClass: string) {
	return `<div>
  <div class="progress-label"><span>${label}</span><span id="${textId}">0 / 100MB</span></div>
  <div class="progress-track"><div id="${barId}" class="${colorClass}" style="width: 0%"></div></div>
</div>`;
}

export function buildGistDistributionSection(config: {
	statusListId: string;
	uploadButtonId: string;
	logClearButtonId: string;
	logId: string;
	description: string;
	buttonText: string;
}) {
	return `<section class="surface">
  <div class="section-header">
    <div>
      <h3 class="text-sm font-semibold">Gistfs 配布</h3>
      <p class="text-xs text-[color:var(--mgr-muted)]">${config.description}</p>
    </div>
    <button id="${config.uploadButtonId}" class="btn btn-info">${config.buttonText}</button>
  </div>
  <div id="${config.statusListId}" class="grid md:grid-cols-3 gap-3 mt-3"></div>
  <div class="mt-3">
    <div class="section-header mb-2">
      <p class="text-sm font-semibold">アップロードログ</p>
      <button id="${config.logClearButtonId}" class="btn btn-soft">ログを清空</button>
    </div>
    <pre id="${config.logId}" class="log-box"></pre>
  </div>
</section>`;
}

export function buildMigrationSection(prefix: 'promotion' | 'advertisement') {
	const textPrefix = prefix === 'promotion' ? 'promotion' : 'advertisement';
	return `<section class="surface">
  <div class="section-header">
    <div>
      <h3 class="text-sm font-semibold">データ移行</h3>
      <p class="text-xs text-[color:var(--mgr-muted)]">PromotionList / Advertisement の全データを JSON で export / import します。</p>
    </div>
    <div class="button-row">
      <button id="${textPrefix}MigrationExportButton" class="btn btn-soft">JSON をエクスポート</button>
      <button id="${textPrefix}MigrationImportButton" class="btn btn-danger">JSON をインポート</button>
      <input id="${textPrefix}MigrationImportInput" type="file" accept="application/json,.json" class="hidden" />
    </div>
  </div>
</section>`;
}

export function buildImagePreviewModal(prefix: 'promotion' | 'advertisement') {
	const label = prefix === 'promotion' ? 'promotion' : 'advertisement';
	return `<div id="${prefix}ImagePreviewModal" class="modal-backdrop hidden">
  <div class="w-full h-full p-4 flex flex-col gap-3">
    <div class="flex justify-end">
      <button id="${prefix}ImagePreviewCloseButton" class="btn btn-soft">閉じる</button>
    </div>
    <div class="flex-1 overflow-auto flex items-center justify-center">
      <img id="${prefix}ImagePreviewLarge" class="max-w-full max-h-full object-contain" alt="${label}-preview-large" />
    </div>
  </div>
</div>`;
}

export function buildConvertModal(prefix: 'promotion' | 'advertisement') {
	return `<div id="${prefix}ConvertModal" class="modal-backdrop hidden">
  <div class="card modal-card-scroll w-full max-w-3xl p-5 space-y-4">
    <div class="section-header">
      <div>
        <h3 id="${prefix}ConvertModalTitle" class="text-lg font-bold">画像変換</h3>
        <p id="${prefix}ConvertModalMeta" class="text-xs text-[color:var(--mgr-muted)]">-</p>
      </div>
      <button id="${prefix}ConvertModalCloseButton" class="btn btn-soft">閉じる</button>
    </div>
    <div class="button-row">
      <button id="${prefix}ConvertResizeButton" class="btn btn-soft">4の倍数へ拡大して保存</button>
      <button id="${prefix}ConvertClearButton" class="btn btn-danger">変換データを清空</button>
      <button id="${prefix}ConvertRunButton" class="btn btn-primary">変換開始</button>
    </div>
    <div class="two-column">
      <label class="field-label flex items-center gap-2">
        <input id="${prefix}ConvertHasAlphaInput" type="checkbox" />
        <span>透明ありとして変換する</span>
      </label>
      <div class="surface">
        <p class="text-sm font-semibold mb-2">使用エンコーダー</p>
        <div id="${prefix}ConvertEncoderSummary" class="text-xs whitespace-pre-wrap text-[color:var(--mgr-text)]"></div>
      </div>
    </div>
    <div id="${prefix}ConvertDownloadSection" class="hidden surface space-y-2">
      <p class="text-sm font-semibold">変換済みバイナリをダウンロード</p>
      <div class="button-row">
        <button id="${prefix}ConvertDownloadPcButton" class="hidden btn bg-sky-100 text-sky-700">PC をダウンロード</button>
        <button id="${prefix}ConvertDownloadAndroidButton" class="hidden btn bg-emerald-100 text-emerald-700">Android をダウンロード</button>
        <button id="${prefix}ConvertDownloadIosButton" class="hidden btn bg-amber-100 text-amber-700">iOS をダウンロード</button>
      </div>
    </div>
    <div>
      <p class="text-sm font-semibold mb-2">変換ログ</p>
      <pre id="${prefix}ConvertLog" class="log-box min-h-40 max-h-96"></pre>
    </div>
  </div>
</div>`;
}

export function buildImageEditorFields(prefix: 'promotion' | 'advertisement') {
	return `<details class="field-label span-2">
  <summary class="cursor-pointer select-none text-[color:var(--mgr-muted)]">Image (Base64) [デバッグ用]</summary>
  <textarea id="${prefix}ImageInput" rows="4" class="field-input mt-2"></textarea>
</details>
<div class="span-2 grid md:grid-cols-3 gap-3 items-end">
  <label class="field-label md:col-span-2">画像アップロード<input id="${prefix}ImageFileInput" type="file" accept="image/*" class="field-input bg-white" /></label>
  <div class="space-y-2">
    <label class="field-label flex items-center gap-2"><input id="${prefix}CompressEnabled" type="checkbox" checked /><span>画像圧縮</span></label>
    <label class="field-label">MaxSize
      <select id="${prefix}CompressMaxSize" class="field-input bg-white">
        <option value="32">32</option><option value="64">64</option><option value="128">128</option><option value="256">256</option><option value="512" selected>512</option><option value="1024">1024</option><option value="2048">2048</option><option value="4096">4096</option><option value="8192">8192</option>
      </select>
    </label>
  </div>
</div>
<p id="${prefix}ImageSizeWarning" class="text-xs text-yellow-700 span-2 hidden">512を超える画像は容量を圧迫する可能性があります。</p>
<div id="${prefix}ImageMultipleOf4Status" class="hidden span-2 rounded-xl border px-4 py-3 text-sm font-semibold"></div>
<div class="span-2 button-row">
  <button id="${prefix}ResizeToMultipleOf4Button" type="button" class="btn btn-soft">4の倍数へ拡大して保存内容に反映</button>
  <p id="${prefix}ImageDimensionText" class="text-xs text-[color:var(--mgr-muted)]">画像サイズ: -</p>
</div>
<div class="span-2 space-y-2">
  <p class="text-sm font-semibold">圧縮後プレビュー</p>
  <button id="${prefix}ImagePreviewOpenButton" type="button" class="hidden btn btn-soft">プレビューを拡大表示</button>
  <div id="${prefix}ImagePreviewContainer" class="hidden relative inline-block">
    <img id="${prefix}ImagePreview" class="max-h-40 rounded-xl border border-[color:var(--mgr-border)] object-contain bg-white" alt="${prefix}-preview" />
    <div id="${prefix}ImageMagnifierLens" class="hidden absolute w-28 h-28 rounded-full border-2 border-violet-400 shadow-lg pointer-events-none bg-no-repeat"></div>
  </div>
</div>`;
}
