import { requireElement } from '../../domUtils';
import type { MinimapSnapshot } from '../../UiTypes';

export class MinimapPanel {
  private readonly root: HTMLElement;
  private readonly locationLabel: HTMLElement;
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly hpFill: HTMLElement;
  private readonly hpValue: HTMLElement;
  private readonly stamFill: HTMLElement;
  private readonly stamValue: HTMLElement;
  private readonly playerDot: HTMLElement;
  private lastRenderedMapKey = '';

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
        <canvas class="minimap-map-canvas" width="160" height="160"></canvas>
        <div class="minimap-location-inside"></div>
        <div class="minimap-player-dot"></div>
      </div>
      <div class="minimap-zoom-col">
        <button class="minimap-zoom-btn" title="Zoom in">+</button>
        <button class="minimap-zoom-btn" title="Zoom out">−</button>
      </div>
    `;

    this.locationLabel = requireElement(this.root, '.minimap-location-inside');
    this.mapCanvas     = requireElement(this.root, '.minimap-map-canvas') as HTMLCanvasElement;
    this.hpFill        = requireElement(this.root, '.orb-hp .orb-fill');
    this.hpValue       = requireElement(this.root, '.orb-hp .orb-value');
    this.stamFill      = requireElement(this.root, '.orb-stam .orb-fill');
    this.stamValue     = requireElement(this.root, '.orb-stam .orb-value');
    this.playerDot     = requireElement(this.root, '.minimap-player-dot');

    this.setLocation('The Veil');
    this.renderEmptyMap();

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

  updateMap(snapshot: MinimapSnapshot | null): void {
    if (!snapshot || snapshot.mapWidth <= 0 || snapshot.mapHeight <= 0) {
      this.playerDot.style.left = '50%';
      this.playerDot.style.top = '50%';
      return;
    }

    this.setLocation(snapshot.mapName);
    const mapKey = `${snapshot.mapId}:${snapshot.mapWidth}x${snapshot.mapHeight}`;
    if (this.lastRenderedMapKey !== mapKey) {
      this.renderTerrain(snapshot);
      this.lastRenderedMapKey = mapKey;
    }
    const xRatio = Math.max(0, Math.min(1, (snapshot.playerTileX + 0.5) / snapshot.mapWidth));
    const yRatio = Math.max(0, Math.min(1, (snapshot.playerTileY + 0.5) / snapshot.mapHeight));
    this.playerDot.style.left = `${xRatio * 100}%`;
    this.playerDot.style.top = `${yRatio * 100}%`;
  }

  private renderEmptyMap(): void {
    const ctx = this.mapCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
    ctx.fillStyle = '#102015';
    ctx.fillRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
  }

  private renderTerrain(snapshot: MinimapSnapshot): void {
    const ctx = this.mapCanvas.getContext('2d');
    if (!ctx) return;

    const width = this.mapCanvas.width;
    const height = this.mapCanvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#102015';
    ctx.fillRect(0, 0, width, height);

    // Streaming worlds have no static terrain data — skip the per-tile loop.
    if (snapshot.terrain.length === 0) return;

    const tileW = width / Math.max(1, snapshot.mapWidth);
    const tileH = height / Math.max(1, snapshot.mapHeight);
    for (let y = 0; y < snapshot.mapHeight; y += 1) {
      const row = snapshot.terrain[y];
      for (let x = 0; x < snapshot.mapWidth; x += 1) {
        ctx.fillStyle = getTerrainColor(row?.[x]);
        ctx.fillRect(
          Math.floor(x * tileW),
          Math.floor(y * tileH),
          Math.ceil(tileW),
          Math.ceil(tileH),
        );
      }
    }
  }

  destroy(): void {
    this.root.remove();
  }
}

function getTerrainColor(family: string | undefined): string {
  switch (family) {
    case 'grass': return '#42723a';
    case 'dirt':  return '#8a6941';
    case 'stone': return '#7c8490';
    case 'water': return '#256d8f';
    case 'sand':  return '#c9b36b';
    default:      return '#102015';
  }
}
