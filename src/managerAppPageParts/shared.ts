export function buildPanelHeader(title: string, subtitle: string, actions = '') {
	return `<div class="panel-header">
  <div>
    <h2 class="panel-title">${title}</h2>
    <p class="panel-subtitle">${subtitle}</p>
  </div>
  ${actions}
</div>`;
}
