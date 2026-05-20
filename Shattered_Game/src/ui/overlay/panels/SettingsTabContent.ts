export class SettingsTabContent {
  readonly el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'settings-tab';

    const body = document.createElement('div');
    body.className = 'settings-body';

    body.innerHTML = `
      <div class="settings-group">
        <div class="settings-group-label">Audio</div>
        <div class="settings-row">
          <span class="settings-label">Sound Effects</span>
          <div class="settings-toggle on" data-setting="sfx"></div>
        </div>
        <div class="settings-row">
          <span class="settings-label">Music</span>
          <div class="settings-toggle" data-setting="music"></div>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-label">Display</div>
        <div class="settings-row">
          <span class="settings-label">Show FPS</span>
          <div class="settings-toggle" data-setting="fps"></div>
        </div>
        <div class="settings-row">
          <span class="settings-label">Pixel Art Mode</span>
          <div class="settings-toggle" data-setting="pixel"></div>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-label">Controls</div>
        <div class="settings-row">
          <span class="settings-label">Click to Move</span>
          <div class="settings-toggle on" data-setting="clickmove"></div>
        </div>
      </div>
    `;

    body.querySelectorAll<HTMLElement>('.settings-toggle').forEach((toggle) => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('on');
      });
    });

    this.el.appendChild(body);
  }

  update(): void {}
}
