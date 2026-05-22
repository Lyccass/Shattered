import { requireElement } from '../../domUtils';

export class MinimapPanel {
  private readonly root: HTMLElement;
  private readonly locationLabel: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpValue: HTMLElement;
  private readonly stamFill: HTMLElement;
  private readonly stamValue: HTMLElement;

  constructor(overlay: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'ui-minimap';

    this.root.innerHTML = `
      <div class="minimap-orb-col">
        <div class="minimap-orb orb-hp">
          <div class="orb-fill"></div>
          <span class="orb-icon">♥</span>
          <span class="orb-value">100</span>
        </div>
        <div class="minimap-orb orb-stam">
          <div class="orb-fill"></div>
          <span class="orb-icon">⚡</span>
          <span class="orb-value">100</span>
        </div>
      </div>
      <div class="minimap-ring">
        <div class="minimap-location-inside"></div>
        <div class="minimap-player-dot"></div>
      </div>
      <div class="minimap-zoom-col">
        <button class="minimap-zoom-btn" title="Zoom in">+</button>
        <button class="minimap-zoom-btn" title="Zoom out">−</button>
      </div>
    `;

    this.locationLabel = requireElement(this.root, '.minimap-location-inside');
    this.hpFill        = requireElement(this.root, '.orb-hp .orb-fill');
    this.hpValue       = requireElement(this.root, '.orb-hp .orb-value');
    this.stamFill      = requireElement(this.root, '.orb-stam .orb-fill');
    this.stamValue     = requireElement(this.root, '.orb-stam .orb-value');

    this.setLocation('The Veil');

    overlay.appendChild(this.root);
  }

  setLocation(name: string): void {
    this.locationLabel.textContent = name;
  }

  updatePlayerStats(
    hp: number | null,
    maxHp: number | null,
    stamina: number | null,
    maxStamina: number | null,
  ): void {
    const hpRatio  = (hp != null && maxHp  != null && maxHp  > 0) ? Math.max(0, Math.min(1, hp  / maxHp))  : 1;
    const stamRatio = (stamina != null && maxStamina != null && maxStamina > 0) ? Math.max(0, Math.min(1, stamina / maxStamina)) : 1;

    this.hpFill.style.height   = `${hpRatio * 100}%`;
    this.stamFill.style.height = `${stamRatio * 100}%`;

    this.hpValue.textContent   = hp   != null ? String(Math.round(hp))      : '–';
    this.stamValue.textContent = stamina != null ? String(Math.round(stamina)) : '–';
  }

  destroy(): void {
    this.root.remove();
  }
}
