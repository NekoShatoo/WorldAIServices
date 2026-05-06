import { buildPanelHeader } from './shared';

export function buildGistPanel() {
	return `<section id="panel-gist-manage" class="panel hidden">
  ${buildPanelHeader('Gist / 管理', 'gistfs API から現在の全ファイル一覧を直接取得して管理します。', '<button id="gistManageReloadButton" class="btn btn-soft">一覧再読込</button>')}
  <section class="surface mt-3">
    <div class="section-header mb-2">
      <h3 class="text-sm font-semibold">アップロード済みファイル</h3>
      <p id="gistManageLoadingText" class="hidden text-xs text-[color:var(--mgr-muted)]">一覧を読み込み中...</p>
    </div>
    <div id="gistManageList" class="space-y-2 text-sm"></div>
  </section>
</section>`;
}
