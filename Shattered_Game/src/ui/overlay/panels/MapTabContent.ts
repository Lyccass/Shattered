import type { MinimapSnapshot } from '../../UiTypes';

export class MapTabContent {
  readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private lastRenderedMapKey = '';

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'map-tab';

    this.title = document.createElement('div');
    this.title.className = 'map-title';

    this.detail = document.createElement('div');
    this.detail.className = 'map-detail';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-canvas';
    this.canvas.width = 280;
    this.canvas.height = 220;

    this.el.appendChild(this.title);
    this.el.appendChild(this.detail);
    this.el.appendChild(this.canvas);
  }

  update(snapshot: MinimapSnapshot | null = null): void {
    if (!snapshot) {
      this.title.textContent = 'Map unavailable';
      this.detail.textContent = '';
      this.renderEmpty();
      return;
    }

    this.title.textContent = snapshot.mapName;
    this.detail.textContent = `Tile ${snapshot.playerTileX}, ${snapshot.playerTileY}`;

    const mapKey = `${snapshot.mapId}:${snapshot.mapWidth}x${snapshot.mapHeight}:${snapshot.playerTileX},${snapshot.playerTileY}`;
    if (this.lastRenderedMapKey === mapKey) return;
    this.renderMap(snapshot);
    this.lastRenderedMapKey = mapKey;
  }

  private renderEmpty(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#102015';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private renderMap(snapshot: MinimapSnapshot): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#102015';
    ctx.fillRect(0, 0, width, height);

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

    const playerX = ((snapshot.playerTileX + 0.5) / Math.max(1, snapshot.mapWidth)) * width;
    const playerY = ((snapshot.playerTileY + 0.5) / Math.max(1, snapshot.mapHeight)) * height;
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(playerX, playerY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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
