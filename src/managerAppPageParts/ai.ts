import { buildPanelHeader } from './shared';

export function buildDashboardPanel() {
	return `<section id="panel-dashboard" class="panel">
  ${buildPanelHeader('Dashboard', 'AI サービスと配布データの状態を確認します。', '<button id="refreshDashboardButton" class="btn btn-soft">更新</button>')}
  <p id="dashboardLoadingText" class="hidden mt-3 text-xs text-[color:var(--mgr-muted)]">Dashboard を読み込み中...</p>
  <div class="section-stack">
    <div class="metric-grid">
      <div class="surface metric"><p class="metric-label">AI サービス状態</p><p id="kpiEnabled" class="metric-value">-</p></div>
      <div class="surface metric"><p class="metric-label">1分上限</p><p id="kpiRpm" class="metric-value">-</p></div>
      <div class="surface metric"><p class="metric-label">最大文字数</p><p id="kpiMaxChars" class="metric-value">-</p></div>
      <div class="surface metric"><p class="metric-label">PromotionList 使用率</p><p id="kpiPromotionUsage" class="metric-value">-</p></div>
    </div>
    <div class="two-column">
      <section class="surface"><h3 class="text-sm font-semibold mb-2">キャッシュ / AI 統計（当日）</h3><canvas id="dayChart" height="220"></canvas></section>
      <section class="surface"><h3 class="text-sm font-semibold mb-2">言語別リクエスト（当日）</h3><canvas id="langChart" height="220"></canvas></section>
    </div>
  </div>
</section>`;
}

export function buildAiConfigPanel() {
	return `<section id="panel-ai-config" class="panel hidden">
  ${buildPanelHeader('AIサービス / サービス設定', '実行可否と基本的な制限値を管理します。')}
  <div class="surface section-stack">
    <div class="field-grid">
      <label class="field-label">稼働状態<select id="enabledInput" class="field-input"><option value="1">ON</option><option value="0">OFF</option></select></label>
      <label class="field-label">1分あたり上限<input id="rpmInput" type="number" min="1" max="60" class="field-input" /></label>
      <label class="field-label">最大文字数<input id="maxCharsInput" type="number" min="1" max="1000" class="field-input" /></label>
    </div>
    <div class="button-row"><button id="saveConfigButton" class="btn btn-primary">設定を保存</button></div>
  </div>
</section>`;
}

export function buildAiOperationPanel() {
	return `<section id="panel-ai-operation" class="panel hidden">
  ${buildPanelHeader('AIサービス / 運用操作', '統計、ログ、キャッシュ操作を実行します。')}
  <div class="surface button-row">
    <button id="statsButton" class="btn btn-soft">統計取得</button>
    <button id="errorsButton" class="btn btn-soft">エラーログ取得</button>
    <button id="llmButton" class="btn btn-soft">LLMログ取得</button>
    <button id="resetCacheButton" class="btn btn-danger">翻訳キャッシュ全削除</button>
  </div>
</section>`;
}

export function buildAiToolsPanel() {
	return `<section id="panel-ai-tools" class="panel hidden">
  ${buildPanelHeader('AIサービス / AI疎通', 'AI API への簡易疎通と simulate を実行します。')}
  <div class="surface section-stack">
    <div class="button-row"><button id="pingButton" class="btn btn-soft">AI Ping</button></div>
    <div class="field-grid">
      <input id="simulateLangInput" placeholder="言語コード (例: ja_JP)" class="field-input" />
      <input id="simulateTextInput" placeholder="翻訳対象テキスト" class="field-input span-2" />
    </div>
    <div class="button-row"><button id="simulateButton" class="btn btn-primary">simulate 実行</button></div>
    <div id="simulateResultBox" class="hidden surface space-y-2">
      <p class="text-sm font-semibold">simulate 結果</p>
      <pre id="simulateResultText" class="text-xs whitespace-pre-wrap break-all text-[color:var(--mgr-text)]"></pre>
    </div>
  </div>
</section>`;
}

export function buildDocsPanels() {
	return `<section id="panel-docs-ai" class="panel hidden">
  ${buildPanelHeader('AIサービス 説明ページ', '現在の管理 API 仕様を確認します。')}
  <div id="docsAiBody" class="surface mt-3 text-sm space-y-1 text-[color:var(--mgr-text)]"></div>
</section>
<section id="panel-docs-promotion" class="panel hidden">
  ${buildPanelHeader('PromotionList 説明ページ', 'PromotionList の管理仕様を確認します。')}
  <div id="docsPromotionBody" class="surface mt-3 text-sm space-y-1 text-[color:var(--mgr-text)]"></div>
</section>`;
}
