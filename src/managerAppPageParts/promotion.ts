import { buildGistDistributionSection, buildPanelHeader, buildPlatformUsage } from './shared';

export function buildPromotionPanel() {
	const actions = `<div class="button-row">
  <select id="promotionFilterType" class="field-input w-auto mt-0">
    <option value="Avatar">Avatar</option>
    <option value="World">World</option>
  </select>
  <button id="promotionSortEditButton" class="btn btn-soft">並び替え編集</button>
  <button id="promotionSortSaveButton" class="hidden btn btn-primary">並び順を保存</button>
  <button id="promotionSortCancelButton" class="hidden btn btn-soft">編集終了</button>
  <button id="promotionCreateOpenButton" class="btn btn-primary">新規追加</button>
  <button id="promotionReloadButton" class="btn btn-soft">一覧再読込</button>
</div>`;
	return `<section id="panel-promotion-manage" class="panel hidden">
  ${buildPanelHeader('PromotionList / 項目管理', 'Avatar / World の項目を編集し、プラットフォーム別 JSON を gistfs へ更新します。', actions)}
  <p id="promotionSortHint" class="hidden mt-3 text-xs text-[color:var(--mgr-muted)]">並び替え編集中です。項目をドラッグして順番を調整し、最後に保存してください。</p>
  <div class="section-stack">
    ${buildPlatformUsage('promotion')}
    ${buildGistDistributionSection({
		statusListId: 'promotionGistStatusList',
		uploadButtonId: 'promotionGistUploadButton',
		logClearButtonId: 'promotionGistLogClearButton',
		logId: 'promotionGistUploadLog',
		description: 'pc / android / ios の JSON を順番に gistfs へアップロードします。',
		buttonText: '3平台を gistfs へアップロード',
	})}
    <section class="surface">
      <div class="section-header mb-2">
        <h3 class="text-sm font-semibold">登録済み項目</h3>
        <p id="promotionLoadingText" class="hidden text-xs text-[color:var(--mgr-muted)]">一覧を読み込み中...</p>
      </div>
      <div id="promotionItemsList" class="space-y-2 text-sm max-h-[28rem] overflow-y-auto pr-1"></div>
    </section>
  </div>
</section>`;
}
