import { requireElement } from '../../domUtils';
import type { MinimapSnapshot, MinimapViewport } from '../../UiTypes';


export class MinimapPanel {
  private readonly root: HTMLElement;
  private readonly locationLabel: HTMLElement;
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly hpFill: HTMLElement;
  private readonly hpValue: HTMLElement;
  private readonly stamFill: HTMLElement;
  private readonly stamValue: HTMLElement;
  private readonly magicFill: HTMLElement;
  private readonly magicValue: HTMLElement;
  private readonly devotionFill: HTMLElement;
  private readonly devotionValue: HTMLElement;
  private readonly playerDot: HTMLElement;
  private lastRenderedMapKey = '';

  constructor(
    overlay: HTMLElement,
    private readonly onMinimapClick: () => void,
    private readonly onMinimapZoom: (delta: number) => void,
  ) {
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
        <div class="minimap-orb orb-magic" title="Magic">
          <div class="orb-fill"></div>
          <span class="orb-icon">✦</span>
          <span class="orb-value">–</span>
        </div>
        <div class="minimap-orb orb-devotion" title="Devotion">
          <div class="orb-fill"></div>
          <span class="orb-icon">✚</span>
          <span class="orb-value">–</span>
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
    this.magicFill     = requireElement(this.root, '.orb-magic .orb-fill');
    this.magicValue    = requireElement(this.root, '.orb-magic .orb-value');
    this.devotionFill  = requireElement(this.root, '.orb-devotion .orb-fill');
    this.devotionValue = requireElement(this.root, '.orb-devotion .orb-value');
    this.playerDot     = requireElement(this.root, '.minimap-player-dot');

    // Clicking the minimap ring opens/closes the map window
    const ring = requireElement(this.root, '.minimap-ring');
    ring.style.cursor = 'pointer';
    ring.addEventListener('click', () => this.onMinimapClick());

    // Zoom buttons
    const [zoomInBtn, zoomOutBtn] = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.minimap-zoom-btn'));
    zoomInBtn?.addEventListener('click',  (e) => { e.stopPropagation(); this.onMinimapZoom(-1); });
    zoomOutBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.onMinimapZoom(+1); });

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
    magic: number | null = null,
    maxMagic: number | null = null,
    devotion: number | null = null,
    maxDevotion: number | null = null,
  ): void {
    const hpRatio  = (hp != null && maxHp  != null && maxHp  > 0) ? Math.max(0, Math.min(1, hp  / maxHp))  : 1;
    const stamRatio = (stamina != null && maxStamina != null && maxStamina > 0) ? Math.max(0, Math.min(1, stamina / maxStamina)) : 1;
    const magicRatio = (magic != null && maxMagic != null && maxMagic > 0) ? Math.max(0, Math.min(1, magic / maxMagic)) : 0;
    const devotionRatio = (devotion != null && maxDevotion != null && maxDevotion > 0) ? Math.max(0, Math.min(1, devotion / maxDevotion)) : 0;

    this.hpFill.style.height   = `${hpRatio * 100}%`;
    this.stamFill.style.height = `${stamRatio * 100}%`;
    this.magicFill.style.height = `${magicRatio * 100}%`;
    this.devotionFill.style.height = `${devotionRatio * 100}%`;

    this.hpValue.textContent   = hp   != null ? String(Math.round(hp))      : '–';
    this.stamValue.textContent = stamina != null ? String(Math.round(stamina)) : '–';
    this.magicValue.textContent = magic != null ? String(Math.round(magic)) : '–';
    this.devotionValue.textContent = devotion != null ? String(Math.round(devotion)) : '–';
  }

  updateMap(snapshot: MinimapSnapshot | null): void {
    if (!snapshot || snapshot.mapWidth <= 0 || snapshot.mapHeight <= 0) {
      this.playerDot.style.display = '';
      this.playerDot.style.left = '50%';
      this.playerDot.style.top = '50%';
      return;
    }

    this.setLocation(snapshot.mapName);

    if (snapshot.viewport) {
      this.playerDot.style.display = 'none';
      this.renderViewport(snapshot.viewport);
      return;
    }

    // Legacy path: static-world terrain stored in definition.terrain
    this.playerDot.style.display = '';
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

  private renderViewport(vp: MinimapViewport): void {
    const ctx = this.mapCanvas.getContext('2d');
    if (!ctx) return;

    const cw = this.mapCanvas.width;
    const ch = this.mapCanvas.height;
    const cx = cw / 2;
    const cy = ch / 2;

    // Scale so the 4 cardinal tiles (dx=R,dy=0) etc. project exactly to the
    // circle edge, while diagonal corners extend beyond and get CSS-clipped.
    // This guarantees the full circle is covered with no dark crescents.
    // 2:1 ratio (sw:sh) matches game tileWidth:tileHeight (64:32).
    // sh uses the original formula — guarantees the circle is fully covered at
    // all angles including the 45° corners. sw is doubled for the 2:1 ratio.
    const s  = cw / (2 * Math.SQRT2 * vp.radius);
    const sw = 2 * s;
    const sh = s;

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#0a1410';
    ctx.fillRect(0, 0, cw, ch);

    // ── Batch terrain tiles by color (isometric diamond per tile) ─────────────
    const diam = vp.radius * 2 + 1;
    const colorPaths = new Map<string, Path2D>();

    for (let row = 0; row < diam; row++) {
      for (let col = 0; col < diam; col++) {
        const t  = vp.tiles[row]?.[col];
        const dx = col - vp.radius;
        const dy = row - vp.radius;
        const px = cx + (dx - dy) * sw;
        const py = cy + (dx + dy) * sh;

        const color = t ? getViewportTileColor(t.terrain, t.walkable) : '#0a1410';
        let path = colorPaths.get(color);
        if (!path) { path = new Path2D(); colorPaths.set(color, path); }

        path.moveTo(px,       py - sh);
        path.lineTo(px + sw,  py);
        path.lineTo(px,       py + sh);
        path.lineTo(px - sw,  py);
        path.closePath();
      }
    }

    for (const [color, path] of colorPaths) {
      ctx.fillStyle = color;
      ctx.fill(path);
    }

    // ── Entity dots ───────────────────────────────────────────────────────────
    const dotR = Math.max(2, sw * 0.6);

    ctx.fillStyle = '#38bdf8';
    for (const { dx, dy } of vp.npcs) {
      ctx.beginPath();
      ctx.arc(cx + (dx - dy) * sw, cy + (dx + dy) * sh, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#f87171';
    for (const { dx, dy } of vp.enemies) {
      ctx.beginPath();
      ctx.arc(cx + (dx - dy) * sw, cy + (dx + dy) * sh, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Player dot — always at canvas centre ──────────────────────────────────
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, dotR * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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

function getViewportTileColor(terrain: string | null, walkable: boolean): string {
  if (!walkable) {
    switch (terrain) {
      case 'grass': return '#1a2a17';
      case 'dirt':  return '#2a1e12';
      case 'stone': return '#252a2e';
      case 'water': return '#0e2535';
      case 'sand':  return '#2a2314';
      default:      return '#111111';
    }
  }
  switch (terrain) {
    case 'grass': return '#3a7032';
    case 'dirt':  return '#7a5c38';
    case 'stone': return '#5a6570';
    case 'water': return '#1a5a7a';
    case 'sand':  return '#b8a050';
    default:      return '#2a3a2a';
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
