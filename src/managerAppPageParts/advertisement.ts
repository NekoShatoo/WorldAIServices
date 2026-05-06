import { buildGistDistributionSection, buildPanelHeader, buildPlatformUsage } from './shared';

export function buildAdvertisementPanel() {
	const actions = `<div class="button-row">
  <select id="advertisementScopeSelect" class="field-input w-auto mt-0"></select>
  <button id="advertisementScopeCreateButton" class="btn btn-primary">Scope 追加</button>
  <button id="advertisementScopeRenameButton" class="btn btn-soft">Scope 名変更</button>
  <button id="advertisementScopeDeleteButton" class="btn btn-danger">Scope 削除</button>
</div>`;
	return `<section id="panel-advertisement-manage" class="panel hidden">
  ${buildPanelHeader('Advertisement / 項目管理', 'Scope ごとの広告項目を編集し、分区ごとに gistfs へ配布します。', actions)}
  <div class="section-stack">
    ${buildPlatformUsage('advertisement')}
    ${buildGistDistributionSection({
		statusListId: 'advertisementGistStatusList',
		uploadButtonId: 'advertisementGistUploadButton',
		logClearButtonId: 'advertisementGistLogClearButton',
		logId: 'advertisementGistUploadLog',
		description: '選択中 Scope の pc / android / ios JSON を順番に gistfs へアップロードします。',
		buttonText: '選択 Scope を gistfs へアップロード',
	})}
    <section class="surface">
      <div class="section-header">
        <div class="button-row">
          <h3 class="text-sm font-semibold">登録済み項目</h3>
          <p id="advertisementLoadingText" class="hidden text-xs text-[color:var(--mgr-muted)]">一覧を読み込み中...</p>
        </div>
        <div class="button-row">
          <button id="advertisementSortEditButton" class="btn btn-soft">並び替え編集</button>
          <button id="advertisementSortSaveButton" class="hidden btn btn-primary">並び順を保存</button>
          <button id="advertisementSortCancelButton" class="hidden btn btn-soft">編集終了</button>
          <button id="advertisementCreateOpenButton" class="btn btn-primary">新規追加</button>
          <button id="advertisementReloadButton" class="btn btn-soft">一覧再読込</button>
        </div>
      </div>
      <p id="advertisementSortHint" class="hidden mt-2 text-xs text-[color:var(--mgr-muted)]">並び替え編集中です。項目をドラッグして順番を調整し、最後に保存してください。</p>
      <div id="advertisementItemsList" class="mt-2 space-y-2 text-sm max-h-[28rem] overflow-y-auto pr-1"></div>
    </section>
  </div>
</section>`;
}
