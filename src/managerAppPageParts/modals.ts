import { buildConvertModal, buildImageEditorFields, buildImagePreviewModal } from './shared';

export function buildPromotionModal() {
	return `<div id="promotionModal" class="modal-backdrop hidden">
  <div class="card modal-card-scroll w-full max-w-3xl p-5 space-y-4">
    <div class="section-header">
      <h3 id="promotionModalTitle" class="text-lg font-bold">PromotionList 追加</h3>
      <button id="promotionModalCloseButton" class="btn btn-soft">閉じる</button>
    </div>
    <p id="promotionPredictionText" class="text-xs text-[color:var(--mgr-muted)]">追加予測: 0MB</p>
    <div class="form-grid">
      <label class="field-label">Type<select id="promotionTypeInput" class="field-input"><option value="Avatar">Avatar</option><option value="World">World</option></select></label>
      <label class="field-label">ID<input id="promotionIdInput" class="field-input" /></label>
      <label class="field-label">Title<input id="promotionTitleInput" class="field-input" /></label>
      <label class="field-label">Anchor<input id="promotionAnchorInput" class="field-input" /></label>
      <label class="field-label span-2">Description<textarea id="promotionDescriptionInput" rows="3" class="field-input"></textarea></label>
      <label class="field-label span-2">Link<input id="promotionLinkInput" class="field-input" /></label>
      ${buildImageEditorFields('promotion')}
    </div>
    ${buildSubmitFooter('promotion')}
  </div>
</div>`;
}

export function buildAdvertisementModal() {
	return `<div id="advertisementModal" class="modal-backdrop hidden">
  <div class="card modal-card-scroll w-full max-w-3xl p-5 space-y-4">
    <div class="section-header">
      <h3 id="advertisementModalTitle" class="text-lg font-bold">Advertisement 追加</h3>
      <button id="advertisementModalCloseButton" class="btn btn-soft">閉じる</button>
    </div>
    <p id="advertisementPredictionText" class="text-xs text-[color:var(--mgr-muted)]">追加予測: 0MB</p>
    <div class="form-grid">
      <label class="field-label">Title<input id="advertisementTitleInput" class="field-input" /></label>
      <label class="field-label">Group（任意）<input id="advertisementGroupInput" class="field-input" placeholder="grp_caa820c4-7aa6-48bc-a7bc-593376245419" /></label>
      <label class="field-label">URL<input id="advertisementUrlInput" class="field-input" /></label>
      ${buildImageEditorFields('advertisement')}
    </div>
    ${buildSubmitFooter('advertisement')}
  </div>
</div>`;
}

function buildSubmitFooter(prefix: 'promotion' | 'advertisement') {
	return `<div class="flex justify-end gap-2">
  <div id="${prefix}SubmitProgressBox" class="hidden flex-1 max-w-xs self-center">
    <div class="w-full space-y-1">
      <p id="${prefix}SubmitProgressText" class="text-xs text-[color:var(--mgr-muted)]">送信準備中...</p>
      <div class="progress-track">
        <div id="${prefix}SubmitProgressBar" class="bg-emerald-500 transition-all duration-200" style="width: 0%"></div>
      </div>
    </div>
  </div>
  <button id="${prefix}ModalCancelButton" class="btn btn-soft">キャンセル</button>
  <button id="${prefix}ModalSubmitButton" class="btn btn-primary">保存</button>
</div>`;
}

export function buildManagerModals() {
	return `${buildPromotionModal()}
${buildImagePreviewModal('promotion')}
${buildAdvertisementModal()}
${buildImagePreviewModal('advertisement')}
${buildConvertModal('advertisement')}
${buildConvertModal('promotion')}`;
}
