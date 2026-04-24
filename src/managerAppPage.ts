import { MANAGER_COMMON_STYLE } from './managerPageStyle';
import { MANAGER_APP_SCRIPT } from './managerAppScript';

export function buildManagerAppPageHtml() {
	return `<!doctype html>
<html lang="ja"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Manager Console</title>${MANAGER_COMMON_STYLE}</head>
<body class="font-sans">
  <div class="min-h-screen grid grid-cols-12 gap-4 p-4">
    <aside class="col-span-12 md:col-span-3 lg:col-span-2 card p-4 space-y-3">
      <div><h1 class="text-lg font-bold">管理ページ</h1><p class="text-xs text-[color:var(--mgr-muted)]">Tree View</p></div>
      <nav class="space-y-1"><button class="nav-item active" data-panel="dashboard">Dashboard</button></nav>
      <div class="pt-2 border-t border-violet-100">
        <p class="text-xs font-semibold text-[color:var(--mgr-muted)] mb-1">AIサービス</p>
        <button class="nav-item" data-panel="ai-config">サービス設定</button>
        <button class="nav-item" data-panel="ai-operation">運用操作</button>
        <button class="nav-item" data-panel="ai-tools">AI疎通 / simulate</button>
        <button class="nav-item" data-panel="docs-ai">説明ページ</button>
      </div>
      <div class="pt-2 border-t border-violet-100">
        <p class="text-xs font-semibold text-[color:var(--mgr-muted)] mb-1">PromotionList</p>
        <button class="nav-item" data-panel="promotion-manage">項目管理</button>
        <button class="nav-item" data-panel="docs-promotion">説明ページ</button>
      </div>
      <button id="logoutButton" class="mt-3 px-3 py-2 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold">ログアウト</button>
    </aside>

    <main id="managerMainContent" class="relative col-span-12 md:col-span-9 lg:col-span-10 space-y-4">
      <section id="panel-dashboard" class="card p-5 space-y-4">
        <div class="flex items-center justify-between"><h2 class="text-xl font-bold">Dashboard</h2><button id="refreshDashboardButton" class="px-3 py-2 rounded-xl bg-violet-100 text-violet-700 text-sm font-semibold">更新</button></div>
        <p id="dashboardLoadingText" class="hidden text-xs text-[color:var(--mgr-muted)]">Dashboard を読み込み中...</p>
        <div class="grid md:grid-cols-4 gap-3">
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">AI サービス状態</p><p id="kpiEnabled" class="text-lg font-bold">-</p></div>
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">1分上限</p><p id="kpiRpm" class="text-lg font-bold">-</p></div>
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">最大文字数</p><p id="kpiMaxChars" class="text-lg font-bold">-</p></div>
          <div class="card p-3"><p class="text-xs text-[color:var(--mgr-muted)]">PromotionList 使用率</p><p id="kpiPromotionUsage" class="text-lg font-bold">-</p></div>
        </div>
        <div class="grid lg:grid-cols-2 gap-4">
          <section class="card p-4"><h3 class="text-sm font-semibold mb-2">キャッシュ / AI 統計（当日）</h3><canvas id="dayChart" height="220"></canvas></section>
          <section class="card p-4"><h3 class="text-sm font-semibold mb-2">言語別リクエスト（当日）</h3><canvas id="langChart" height="220"></canvas></section>
        </div>
      </section>

      <section id="panel-ai-config" class="card p-5 space-y-4 hidden">
        <h2 class="text-xl font-bold">AIサービス / サービス設定</h2>
        <div class="grid md:grid-cols-3 gap-4">
          <label class="text-sm">稼働状態<select id="enabledInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]"><option value="1">ON</option><option value="0">OFF</option></select></label>
          <label class="text-sm">1分あたり上限<input id="rpmInput" type="number" min="1" max="60" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" /></label>
          <label class="text-sm">最大文字数<input id="maxCharsInput" type="number" min="1" max="1000" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" /></label>
        </div>
        <button id="saveConfigButton" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">設定を保存</button>
      </section>

      <section id="panel-ai-operation" class="card p-5 space-y-3 hidden">
        <h2 class="text-xl font-bold">AIサービス / 運用操作</h2>
        <div class="flex flex-wrap gap-2">
          <button id="statsButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">統計取得</button>
          <button id="errorsButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">エラーログ取得</button>
          <button id="llmButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">LLMログ取得</button>
          <button id="resetCacheButton" class="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold">翻訳キャッシュ全削除</button>
        </div>
      </section>

      <section id="panel-ai-tools" class="card p-5 space-y-3 hidden">
        <h2 class="text-xl font-bold">AIサービス / AI疎通</h2>
        <div class="flex gap-2"><button id="pingButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">AI Ping</button></div>
        <div class="grid md:grid-cols-3 gap-3">
          <input id="simulateLangInput" placeholder="言語コード (例: ja_JP)" class="border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
          <input id="simulateTextInput" placeholder="翻訳対象テキスト" class="md:col-span-2 border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" />
        </div>
        <button id="simulateButton" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">simulate 実行</button>
        <div id="simulateResultBox" class="hidden rounded-xl border border-[color:var(--mgr-border)] bg-violet-50 p-3 space-y-2">
          <p class="text-sm font-semibold">simulate 結果</p>
          <pre id="simulateResultText" class="text-xs whitespace-pre-wrap break-all text-[color:var(--mgr-text)]"></pre>
        </div>
      </section>

      <section id="panel-promotion-manage" class="card p-5 space-y-4 hidden">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold">PromotionList / 項目管理</h2>
          <div class="flex gap-2">
            <select id="promotionFilterType" class="px-3 py-2 rounded-xl border border-[color:var(--mgr-border)] bg-white text-sm">
              <option value="Avatar">Avatar</option>
              <option value="World">World</option>
            </select>
            <button id="promotionSortEditButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">並び替え編集</button>
            <button id="promotionSortSaveButton" class="hidden px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">並び順を保存</button>
            <button id="promotionSortCancelButton" class="hidden px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">編集終了</button>
            <button id="promotionCreateOpenButton" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">新規追加</button>
            <button id="promotionReloadButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">一覧再読込</button>
          </div>
        </div>
        <p id="promotionSortHint" class="hidden text-xs text-[color:var(--mgr-muted)]">並び替え編集中です。項目をドラッグして順番を調整し、最後に保存してください。</p>
        <div class="space-y-2">
          <div class="flex items-center justify-between"><p class="text-sm font-semibold">API 使用率（上限 100MB）</p><button id="refreshPromotionUsageButton" class="px-3 py-1 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold">再計算</button></div>
          <div class="space-y-2">
            <div>
              <div class="flex items-center justify-between text-xs text-[color:var(--mgr-muted)]"><span>PC</span><span id="promotionUsageTextPc">0 / 100MB</span></div>
              <div class="w-full h-4 bg-violet-100 rounded-full overflow-hidden"><div id="promotionUsageBarPc" class="h-full bg-sky-500" style="width: 0%"></div></div>
            </div>
            <div>
              <div class="flex items-center justify-between text-xs text-[color:var(--mgr-muted)]"><span>Android</span><span id="promotionUsageTextAndroid">0 / 100MB</span></div>
              <div class="w-full h-4 bg-violet-100 rounded-full overflow-hidden"><div id="promotionUsageBarAndroid" class="h-full bg-emerald-500" style="width: 0%"></div></div>
            </div>
            <div>
              <div class="flex items-center justify-between text-xs text-[color:var(--mgr-muted)]"><span>iOS</span><span id="promotionUsageTextIos">0 / 100MB</span></div>
              <div class="w-full h-4 bg-violet-100 rounded-full overflow-hidden"><div id="promotionUsageBarIos" class="h-full bg-amber-500" style="width: 0%"></div></div>
            </div>
          </div>
          <p id="promotionUsageTextTotal" class="text-xs text-[color:var(--mgr-muted)]">合計: 0 / 300MB 相当</p>
        </div>
        <div class="card p-3">
          <div class="flex items-center justify-between gap-2 mb-2">
            <h3 class="text-sm font-semibold">登録済み項目</h3>
            <p id="promotionLoadingText" class="hidden text-xs text-[color:var(--mgr-muted)]">一覧を読み込み中...</p>
          </div>
          <div id="promotionItemsList" class="space-y-2 text-sm max-h-[28rem] overflow-y-auto pr-1"></div>
        </div>
      </section>

      <section id="panel-docs-ai" class="card p-5 hidden"><h2 class="text-xl font-bold mb-3">AIサービス 説明ページ</h2><div id="docsAiBody" class="text-sm space-y-1 text-[color:var(--mgr-text)]"></div></section>
      <section id="panel-docs-promotion" class="card p-5 hidden"><h2 class="text-xl font-bold mb-3">PromotionList 説明ページ</h2><div id="docsPromotionBody" class="text-sm space-y-1 text-[color:var(--mgr-text)]"></div></section>
      <div id="globalLoadingOverlay" class="loading-overlay hidden" aria-live="polite" aria-busy="true">
        <div class="card w-full max-w-sm p-5 flex items-center gap-4">
          <div class="loading-spinner flex-shrink-0"></div>
          <div class="min-w-0">
            <p class="text-sm font-semibold">処理中</p>
            <p id="globalLoadingText" class="text-sm text-[color:var(--mgr-muted)]">読み込み中...</p>
          </div>
        </div>
      </div>
    </main>
  </div>

  <div id="promotionModal" class="modal-backdrop hidden">
    <div class="card modal-card-scroll w-full max-w-3xl p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 id="promotionModalTitle" class="text-lg font-bold">PromotionList 追加</h3>
        <button id="promotionModalCloseButton" class="px-3 py-1 rounded bg-violet-100 text-violet-700 text-sm font-semibold">閉じる</button>
      </div>
      <p id="promotionPredictionText" class="text-xs text-[color:var(--mgr-muted)]">追加予測: 0MB</p>
      <div class="grid md:grid-cols-2 gap-3">
        <label class="text-sm">Type<select id="promotionTypeInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]"><option value="Avatar">Avatar</option><option value="World">World</option></select></label>
        <label class="text-sm">ID<input id="promotionIdInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" /></label>
        <label class="text-sm">Title<input id="promotionTitleInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" /></label>
        <label class="text-sm">Anchor<input id="promotionAnchorInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" /></label>
        <label class="text-sm md:col-span-2">Description<textarea id="promotionDescriptionInput" rows="3" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]"></textarea></label>
        <label class="text-sm md:col-span-2">Link<input id="promotionLinkInput" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]" /></label>
        <details class="text-sm md:col-span-2"><summary class="cursor-pointer select-none font-semibold text-[color:var(--mgr-muted)]">Image (Base64) [デバッグ用]</summary><textarea id="promotionImageInput" rows="4" class="mt-2 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)]"></textarea></details>
        <div class="md:col-span-2 grid md:grid-cols-3 gap-3 items-end">
          <label class="text-sm md:col-span-2">画像アップロード<input id="promotionImageFileInput" type="file" accept="image/*" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)] bg-white" /></label>
          <div class="space-y-2">
            <label class="text-sm flex items-center gap-2"><input id="promotionCompressEnabled" type="checkbox" checked /><span>画像圧縮</span></label>
            <label class="text-sm">MaxSize
              <select id="promotionCompressMaxSize" class="mt-1 w-full border rounded-xl px-3 py-2 border-[color:var(--mgr-border)] bg-white">
                <option value="32">32</option><option value="64">64</option><option value="128">128</option><option value="256">256</option><option value="512" selected>512</option><option value="1024">1024</option><option value="2048">2048</option><option value="4096">4096</option><option value="8192">8192</option>
              </select>
            </label>
          </div>
        </div>
        <p id="promotionImageSizeWarning" class="text-xs text-yellow-700 md:col-span-2 hidden">512を超える画像は容量を圧迫する可能性があります。</p>
        <div id="promotionImageMultipleOf4Status" class="hidden md:col-span-2 rounded-xl border px-4 py-3 text-sm font-semibold"></div>
        <div class="md:col-span-2 flex flex-wrap items-center gap-2">
          <button id="promotionResizeToMultipleOf4Button" type="button" class="px-3 py-2 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold">4の倍数へ拡大して保存内容に反映</button>
          <p id="promotionImageDimensionText" class="text-xs text-[color:var(--mgr-muted)]">画像サイズ: -</p>
        </div>
        <div class="md:col-span-2 space-y-2">
          <p class="text-sm font-semibold">圧縮後プレビュー</p>
          <button id="promotionImagePreviewOpenButton" type="button" class="hidden px-3 py-2 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold">プレビューを拡大表示</button>
          <div id="promotionImagePreviewContainer" class="hidden relative inline-block">
            <img id="promotionImagePreview" class="max-h-40 rounded-xl border border-[color:var(--mgr-border)] object-contain bg-white" alt="promotion-preview" />
            <div id="promotionImageMagnifierLens" class="hidden absolute w-28 h-28 rounded-full border-2 border-violet-400 shadow-lg pointer-events-none bg-no-repeat"></div>
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <div id="promotionSubmitProgressBox" class="hidden flex-1 max-w-xs self-center">
          <div class="w-full space-y-1">
            <p id="promotionSubmitProgressText" class="text-xs text-[color:var(--mgr-muted)]">送信準備中...</p>
            <div class="w-full h-2 bg-violet-100 rounded-full overflow-hidden">
              <div id="promotionSubmitProgressBar" class="h-full bg-violet-500 transition-all duration-200" style="width: 0%"></div>
            </div>
          </div>
        </div>
        <button id="promotionModalCancelButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">キャンセル</button>
        <button id="promotionModalSubmitButton" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">保存</button>
      </div>
    </div>
  </div>
  <div id="promotionImagePreviewModal" class="modal-backdrop hidden">
    <div class="w-full h-full p-4 flex flex-col gap-3">
      <div class="flex justify-end">
        <button id="promotionImagePreviewCloseButton" class="px-3 py-1 rounded bg-violet-100 text-violet-700 text-sm font-semibold">閉じる</button>
      </div>
      <div class="flex-1 overflow-auto flex items-center justify-center">
        <img id="promotionImagePreviewLarge" class="max-w-full max-h-full object-contain" alt="promotion-preview-large" />
      </div>
    </div>
  </div>
  <div id="promotionConvertModal" class="modal-backdrop hidden">
    <div class="card modal-card-scroll w-full max-w-3xl p-5 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 id="promotionConvertModalTitle" class="text-lg font-bold">画像変換</h3>
          <p id="promotionConvertModalMeta" class="text-xs text-[color:var(--mgr-muted)]">-</p>
        </div>
        <button id="promotionConvertModalCloseButton" class="px-3 py-1 rounded bg-violet-100 text-violet-700 text-sm font-semibold">閉じる</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button id="promotionConvertResizeButton" class="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 font-semibold">4の倍数へ拡大して保存</button>
        <button id="promotionConvertClearButton" class="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold">変換データを清空</button>
        <button id="promotionConvertRunButton" class="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">変換開始</button>
      </div>
      <div class="grid md:grid-cols-2 gap-3">
        <label class="text-sm flex items-center gap-2">
          <input id="promotionConvertHasAlphaInput" type="checkbox" />
          <span>透明ありとして変換する</span>
        </label>
        <div class="rounded-xl border border-[color:var(--mgr-border)] bg-white p-3">
          <p class="text-sm font-semibold mb-2">使用エンコーダー</p>
          <div id="promotionConvertEncoderSummary" class="text-xs whitespace-pre-wrap text-[color:var(--mgr-text)]"></div>
        </div>
      </div>
      <div class="rounded-xl border border-[color:var(--mgr-border)] bg-violet-50 p-3 space-y-2">
        <p class="text-sm font-semibold">変換ログ</p>
        <pre id="promotionConvertLog" class="text-xs whitespace-pre-wrap break-all text-[color:var(--mgr-text)] min-h-40 max-h-96 overflow-auto"></pre>
      </div>
    </div>
  </div>

  <script>${MANAGER_APP_SCRIPT}</script>
</body></html>`;
}
