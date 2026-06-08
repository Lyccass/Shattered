import type { MinimapSnapshot } from '../UiTypes';

export type MapTileQueryFn = (tileX: number, tileY: number) => { terrain: string | null; walkable: boolean } | null;

const TILE_PX = 5;
const CANVAS_W = 468;  // fills the default 500px popup with 16px body padding each side
const CANVAS_H = 340;

/** Canvas content for the World Map popup. No window chrome — PopupWindow provides that. */
export class MapWindow {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly offscreen: OffscreenCanvas | HTMLCanvasElement;
  private readonly offCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  private centerX = 0;
  private centerY = 0;
  private playerTileX = 0;
  private playerTileY = 0;
  private terrainDirty = true;
  private lastSnapshot: MinimapSnapshot | null = null;

  private mapDrag: { startMouseX: number; startMouseY: number; startCX: number; startCY: number } | null = null;
  private readonly onMouseMove: (e: MouseEvent) => void;
  private readonly onMouseUp:   (e: MouseEvent) => void;

  constructor(private readonly getTile: MapTileQueryFn) {
    this.el = document.createElement('div');
    this.el.className = 'map-window-content';

    // Toolbar (recenter button)
    const toolbar = document.createElement('div');
    toolbar.className = 'map-window-toolbar';
    const recenterBtn = document.createElement('button');
    recenterBtn.className = 'map-window-recenter';
    recenterBtn.textContent = '⊕ Recenter';
    recenterBtn.title = 'Center on player';
    recenterBtn.addEventListener('click', () => {
      this.centerX = this.playerTileX;
      this.centerY = this.playerTileY;
      this.terrainDirty = true;
      this.renderFrame();
    });
    toolbar.appendChild(recenterBtn);

    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width  = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.canvas.className = 'map-window-canvas';

    // Legend
    const legend = document.createElement('div');
    legend.className = 'map-window-legend';
    legend.innerHTML =
      '<span><span class="map-legend-swatch" style="background:#3a7032"></span>Walkable</span>' +
      '<span><span class="map-legend-swatch" style="background:#1a2a17"></span>Blocked</span>' +
      '<span style="color:#fde047">● Player</span>' +
      '<span style="color:#38bdf8">● NPC</span>' +
      '<span style="color:#f87171">● Enemy</span>';

    this.el.append(toolbar, this.canvas, legend);

    // Offscreen terrain cache
    if (typeof OffscreenCanvas !== 'undefined') {
      this.offscreen = new OffscreenCanvas(CANVAS_W, CANVAS_H);
    } else {
      const c = document.createElement('canvas');
      c.width = CANVAS_W; c.height = CANVAS_H;
      this.offscreen = c;
    }
    this.offCtx = this.offscreen.getContext('2d') as CanvasRenderingContext2D;

    // Drag to pan
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.canvas.style.cursor = 'grabbing';
      this.mapDrag = { startMouseX: e.clientX, startMouseY: e.clientY, startCX: this.centerX, startCY: this.centerY };
      e.preventDefault();
    });

    this.onMouseMove = (e: MouseEvent) => {
      if (!this.mapDrag) return;
      const newCX = this.mapDrag.startCX + (this.mapDrag.startMouseX - e.clientX) / TILE_PX;
      const newCY = this.mapDrag.startCY + (this.mapDrag.startMouseY - e.clientY) / TILE_PX;
      if (Math.abs(newCX - this.centerX) > 0.05 || Math.abs(newCY - this.centerY) > 0.05) {
        this.centerX = newCX;
        this.centerY = newCY;
        this.terrainDirty = true;
        this.renderFrame();
      }
    };

    this.onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.mapDrag = null;
      this.canvas.style.cursor = 'grab';
    };

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup',   this.onMouseUp);
  }

  /** Call when the popup opens to center on the player. */
  setCenter(playerTileX: number, playerTileY: number): void {
    this.playerTileX = playerTileX;
    this.playerTileY = playerTileY;
    this.centerX     = playerTileX;
    this.centerY     = playerTileY;
    this.terrainDirty = true;
    this.renderFrame();
  }

  /** Call every frame while the popup is open. */
  update(snapshot: MinimapSnapshot | null): void {
    if (snapshot) {
      this.playerTileX = snapshot.playerTileX;
      this.playerTileY = snapshot.playerTileY;
      this.lastSnapshot = snapshot;
    }
    this.renderFrame();
  }

  destroy(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup',   this.onMouseUp);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private renderFrame(): void {
    if (this.terrainDirty) {
      this.renderTerrain();
      this.terrainDirty = false;
    }

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(this.offscreen as CanvasImageSource, 0, 0);

    const halfW = CANVAS_W / 2;
    const halfH = CANVAS_H / 2;

    // Player dot
    const px = halfW + (this.playerTileX - this.centerX) * TILE_PX;
    const py = halfH + (this.playerTileY - this.centerY) * TILE_PX;
    this.drawDot(ctx, px, py, 5, '#fde047', '#1a1a1a');

    // Entity dots from snapshot viewport (radius-limited)
    const vp = this.lastSnapshot?.viewport;
    if (vp) {
      for (const { dx, dy } of vp.npcs) {
        const ex = halfW + (this.playerTileX + dx - this.centerX) * TILE_PX;
        const ey = halfH + (this.playerTileY + dy - this.centerY) * TILE_PX;
        if (this.inView(ex, ey)) this.drawDot(ctx, ex, ey, 3, '#38bdf8');
      }
      for (const { dx, dy } of vp.enemies) {
        const ex = halfW + (this.playerTileX + dx - this.centerX) * TILE_PX;
        const ey = halfH + (this.playerTileY + dy - this.centerY) * TILE_PX;
        if (this.inView(ex, ey)) this.drawDot(ctx, ex, ey, 3, '#f87171');
      }
    }
  }

  private renderTerrain(): void {
    const ctx = this.offCtx;
    ctx.fillStyle = '#0a1010';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const cx0     = Math.round(this.centerX);
    const cy0     = Math.round(this.centerY);
    const originX = CANVAS_W / 2 + (cx0 - this.centerX) * TILE_PX;
    const originY = CANVAS_H / 2 + (cy0 - this.centerY) * TILE_PX;
    const halfCols = Math.ceil(CANVAS_W / TILE_PX / 2) + 1;
    const halfRows = Math.ceil(CANVAS_H / TILE_PX / 2) + 1;

    const buckets = new Map<string, Array<[number, number]>>();
    for (let dy = -halfRows; dy <= halfRows; dy++) {
      for (let dx = -halfCols; dx <= halfCols; dx++) {
        const info  = this.getTile(cx0 + dx, cy0 + dy);
        const color = info ? getMapColor(info.terrain, info.walkable) : '#0a1010';
        if (color === '#0a1010') continue;
        const px = Math.round(originX + dx * TILE_PX);
        const py = Math.round(originY + dy * TILE_PX);
        let bucket = buckets.get(color);
        if (!bucket) { bucket = []; buckets.set(color, bucket); }
        bucket.push([px, py]);
      }
    }

    for (const [color, positions] of buckets) {
      ctx.fillStyle = color;
      for (const [px, py] of positions) ctx.fillRect(px, py, TILE_PX, TILE_PX);
    }
  }

  private drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke?: string): void {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  private inView(px: number, py: number): boolean {
    return px >= 0 && px <= CANVAS_W && py >= 0 && py <= CANVAS_H;
  }
}

function getMapColor(terrain: string | null, walkable: boolean): string {
  if (!walkable) {
    switch (terrain) {
      case 'grass': return '#1a2a17';
      case 'dirt':  return '#2a1e12';
      case 'stone': return '#252a2e';
      case 'water': return '#0e2535';
      case 'sand':  return '#2a2314';
      default:      return '#0e1410';
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
