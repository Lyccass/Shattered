export class MapTabContent {
  readonly el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'map-tab';

    const placeholder = document.createElement('div');
    placeholder.className = 'map-placeholder';
    placeholder.textContent = 'Map Coming Soon';

    this.el.appendChild(placeholder);
  }

  update(): void {
    // Future: render world map tiles
  }
}
