import { MANAGER_APP_SCRIPT } from './managerAppScript';
import { buildAdvertisementPanel } from './managerAppPageParts/advertisement';
import { buildAiConfigPanel, buildAiOperationPanel, buildAiToolsPanel, buildDashboardPanel, buildDocsPanels } from './managerAppPageParts/ai';
import { buildGistPanel } from './managerAppPageParts/gist';
import { buildManagerModals } from './managerAppPageParts/modals';
import { buildPromotionPanel } from './managerAppPageParts/promotion';
import { MANAGER_COMMON_STYLE } from './managerPageStyle';

export function buildManagerAppPageHtml() {
	return `<!doctype html>
<html lang="ja"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Manager Console</title>${MANAGER_COMMON_STYLE}</head>
<body>
  <div class="app-shell">
    ${buildSidebar()}
    <main id="managerMainContent" class="workspace">
      ${buildDashboardPanel()}
      ${buildAiConfigPanel()}
      ${buildAiOperationPanel()}
      ${buildAiToolsPanel()}
      ${buildPromotionPanel()}
      ${buildAdvertisementPanel()}
      ${buildGistPanel()}
      ${buildDocsPanels()}
      ${buildGlobalLoadingOverlay()}
    </main>
  </div>
  ${buildManagerModals()}
  <script>${MANAGER_APP_SCRIPT}</script>
</body></html>`;
}

function buildSidebar() {
	return `<aside class="app-sidebar">
  <div class="brand-block">
    <h1 class="brand-title">Manager Console</h1>
    <p class="brand-subtitle">World AI Services</p>
  </div>
  <nav>
    <div class="nav-group">
      <p class="nav-group-title">Overview</p>
      <button class="nav-item active" data-panel="dashboard">Dashboard</button>
    </div>
    <div class="nav-group">
      <p class="nav-group-title">AIサービス</p>
      <button class="nav-item" data-panel="ai-config">サービス設定</button>
      <button class="nav-item" data-panel="ai-operation">運用操作</button>
      <button class="nav-item" data-panel="ai-tools">AI疎通 / simulate</button>
      <button class="nav-item" data-panel="docs-ai">説明ページ</button>
    </div>
    <div class="nav-group">
      <p class="nav-group-title">PromotionList</p>
      <button class="nav-item" data-panel="promotion-manage">項目管理</button>
      <button class="nav-item" data-panel="docs-promotion">説明ページ</button>
    </div>
    <div class="nav-group">
      <p class="nav-group-title">Advertisement</p>
      <button class="nav-item" data-panel="advertisement-manage">項目管理</button>
    </div>
    <div class="nav-group">
      <p class="nav-group-title">Gistfs</p>
      <button class="nav-item" data-panel="gist-manage">Gist 管理</button>
    </div>
  </nav>
  <button id="logoutButton" class="logout-button">ログアウト</button>
</aside>`;
}

function buildGlobalLoadingOverlay() {
	return `<div id="globalLoadingOverlay" class="loading-overlay hidden" aria-live="polite" aria-busy="true">
  <div class="card w-full max-w-sm p-5 flex items-center gap-4">
    <div class="loading-spinner flex-shrink-0"></div>
    <div class="min-w-0">
      <p class="text-sm font-semibold">処理中</p>
      <p id="globalLoadingText" class="text-sm text-[color:var(--mgr-muted)]">読み込み中...</p>
    </div>
  </div>
</div>`;
}
