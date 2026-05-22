export type EditorAssetKind = 'object' | 'terrainTile';

export type PreparedDefinitionImage = {
  dataUrl: string;
  height: number;
  width: number;
};

export type DefinitionFitDraft = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

export type DefinitionFitProjection = {
  anchorX: number;
  anchorY: number;
  imageHeight: number;
  imageWidth: number;
  imageX: number;
  imageY: number;
  zoom: number;
};

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

export function getDefaultDefinitionFitScale(
  textureWidth: number,
  textureHeight: number,
  assetKind: EditorAssetKind,
): number {
  const targetWidth = assetKind === 'terrainTile' ? TILE_WIDTH : TILE_WIDTH * 2;
  const targetHeight = assetKind === 'terrainTile' ? TILE_HEIGHT : TILE_HEIGHT * 3;
  const scale = Math.min(targetWidth / textureWidth, targetHeight / textureHeight);
  return Number(Math.max(0.05, Math.min(4, scale)).toFixed(2));
}

export function getDefinitionFitFootprint(
  assetKind: EditorAssetKind,
  footprintWidthInput: HTMLInputElement,
  footprintHeightInput: HTMLInputElement,
): { height: number; width: number } {
  if (assetKind === 'terrainTile') {
    return { height: 1, width: 1 };
  }

  return {
    height: clamp(parseIntegerInput(footprintHeightInput.value, 1), 1, 16),
    width: clamp(parseIntegerInput(footprintWidthInput.value, 1), 1, 16),
  };
}

export function drawDefinitionFitPreview(
  preview: HTMLDivElement,
  gridCanvas: HTMLCanvasElement,
  previewImg: HTMLImageElement,
  resizeHandle: HTMLDivElement,
  scaleInput: HTMLInputElement,
  offsetXInput: HTMLInputElement,
  offsetYInput: HTMLInputElement,
  image: PreparedDefinitionImage | null,
  footprint: { height: number; width: number },
): DefinitionFitProjection {
  const width = preview.clientWidth || 156;
  const height = preview.clientHeight || 132;
  const dpr = window.devicePixelRatio || 1;

  gridCanvas.width = Math.round(width * dpr);
  gridCanvas.height = Math.round(height * dpr);
  gridCanvas.style.width = `${width}px`;
  gridCanvas.style.height = `${height}px`;

  const ctx = gridCanvas.getContext('2d');
  const bounds = getIsoFootprintBounds(footprint.width, footprint.height);
  const zoom = Math.min(
    2,
    (width - 20) / Math.max(1, bounds.maxX - bounds.minX),
    (height - 20) / Math.max(1, bounds.maxY - bounds.minY),
  );
  const originX = width / 2 - ((bounds.minX + bounds.maxX) / 2) * zoom;
  const originY = height / 2 - ((bounds.minY + bounds.maxY) / 2) * zoom;
  const center = getDefinitionFootprintCenterOffset(footprint.width, footprint.height);
  const anchorX = originX + center.x * zoom;
  const anchorY = originY + center.y * zoom;

  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;

    drawFitGrid(ctx, footprint, originX, originY, zoom, 'rgba(66, 107, 52, 0.32)', 'rgba(215, 243, 255, 0.68)');

    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
  }

  const scale = clamp(parseNumberInput(scaleInput.value, 1), 0.05, 4);
  const offsetX = parseNumberInput(offsetXInput.value, 0);
  const offsetY = parseNumberInput(offsetYInput.value, 0);
  const imageX = anchorX + offsetX * zoom;
  const imageY = anchorY + offsetY * zoom;
  const imageWidth = image ? image.width * scale * zoom : 0;
  const imageHeight = image ? image.height * scale * zoom : 0;

  previewImg.style.transform = `translate(-50%, -50%) translate(${imageX - width / 2}px, ${imageY - height / 2}px) scale(${scale * zoom})`;

  if (image) {
    resizeHandle.classList.remove('editor-hidden');
    resizeHandle.style.left = `${imageX + imageWidth / 2 - 5}px`;
    resizeHandle.style.top = `${imageY + imageHeight / 2 - 5}px`;
  } else {
    resizeHandle.classList.add('editor-hidden');
  }

  return { anchorX, anchorY, imageHeight, imageWidth, imageX, imageY, zoom };
}

export function drawDefinitionFitStage(
  stage: HTMLDivElement,
  gridCanvas: HTMLCanvasElement,
  fitImage: HTMLImageElement,
  selection: HTMLDivElement,
  image: PreparedDefinitionImage,
  footprint: { height: number; width: number },
  draft: DefinitionFitDraft,
): DefinitionFitProjection {
  const width = stage.clientWidth || 696;
  const height = stage.clientHeight || 430;
  const dpr = window.devicePixelRatio || 1;

  gridCanvas.width = Math.round(width * dpr);
  gridCanvas.height = Math.round(height * dpr);
  gridCanvas.style.width = `${width}px`;
  gridCanvas.style.height = `${height}px`;

  const ctx = gridCanvas.getContext('2d');
  const bounds = getIsoFootprintBounds(footprint.width, footprint.height);
  const zoom = Math.min(
    5,
    (width - 96) / Math.max(1, bounds.maxX - bounds.minX),
    (height - 96) / Math.max(1, bounds.maxY - bounds.minY),
  );
  const originX = width / 2 - ((bounds.minX + bounds.maxX) / 2) * zoom;
  const originY = height / 2 - ((bounds.minY + bounds.maxY) / 2) * zoom;
  const center = getDefinitionFootprintCenterOffset(footprint.width, footprint.height);
  const anchorX = originX + center.x * zoom;
  const anchorY = originY + center.y * zoom;

  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;

    drawFitGrid(ctx, footprint, originX, originY, zoom, 'rgba(66, 107, 52, 0.36)', 'rgba(215, 243, 255, 0.78)');

    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
  }

  const scale = clamp(draft.scale, 0.05, 4);
  const imageX = anchorX + draft.offsetX * zoom;
  const imageY = anchorY + draft.offsetY * zoom;
  const imageWidth = image.width * scale * zoom;
  const imageHeight = image.height * scale * zoom;

  fitImage.classList.remove('editor-hidden');
  fitImage.style.left = `${imageX - imageWidth / 2}px`;
  fitImage.style.top = `${imageY - imageHeight / 2}px`;
  fitImage.style.width = `${imageWidth}px`;
  fitImage.style.height = `${imageHeight}px`;
  fitImage.style.transform = 'none';

  selection.classList.remove('editor-hidden');
  selection.style.left = `${imageX - imageWidth / 2}px`;
  selection.style.top = `${imageY - imageHeight / 2}px`;
  selection.style.width = `${imageWidth}px`;
  selection.style.height = `${imageHeight}px`;

  return { anchorX, anchorY, imageHeight, imageWidth, imageX, imageY, zoom };
}

export function drawDefinitionColorPreview(canvas: HTMLCanvasElement, color: number): void {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return;
  }

  const cssColor = `#${color.toString(16).padStart(6, '0')}`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = cssColor;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 6);
  ctx.lineTo(canvas.width - 6, canvas.height / 2);
  ctx.lineTo(canvas.width / 2, canvas.height - 6);
  ctx.lineTo(6, canvas.height / 2);
  ctx.closePath();
  ctx.fill();
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error(`Could not read ${file.name}.`));
    };
    reader.readAsDataURL(file);
  });
}

export async function prepareDefinitionImageDataUrl(
  dataUrl: string,
  assetKind: EditorAssetKind,
  cleanImage: boolean,
): Promise<PreparedDefinitionImage> {
  if (!cleanImage) {
    const image = await loadImageFromDataUrl(dataUrl);
    return {
      dataUrl,
      height: image.height,
      width: image.width,
    };
  }

  const canvas = await cleanImportedAssetImage(dataUrl, assetKind);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    height: canvas.height,
    width: canvas.width,
  };
}

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load dropped image.'));
    image.src = dataUrl;
  });
}

export function parseIntegerInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function drawFitGrid(
  ctx: CanvasRenderingContext2D,
  footprint: { height: number; width: number },
  originX: number,
  originY: number,
  zoom: number,
  fillStyle: string,
  strokeStyle: string,
): void {
  for (let tileY = 0; tileY < footprint.height; tileY += 1) {
    for (let tileX = 0; tileX < footprint.width; tileX += 1) {
      const points = getIsoDiamondPoints(tileX, tileY)
        .map((point) => ({
          x: originX + point.x * zoom,
          y: originY + point.y * zoom,
        }));

      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.strokeStyle = strokeStyle;
      ctx.fill();
      ctx.stroke();
    }
  }
}

function getDefinitionFootprintCenterOffset(footprintWidth: number, footprintHeight: number): { x: number; y: number } {
  return {
    x: ((footprintWidth - footprintHeight) * TILE_WIDTH) / 4,
    y: ((footprintWidth + footprintHeight - 2) * TILE_HEIGHT) / 4,
  };
}

function getIsoDiamondPoints(tileX: number, tileY: number): Array<{ x: number; y: number }> {
  const centerX = ((tileX - tileY) * TILE_WIDTH) / 2;
  const centerY = ((tileX + tileY) * TILE_HEIGHT) / 2;

  return [
    { x: centerX, y: centerY - TILE_HEIGHT / 2 },
    { x: centerX + TILE_WIDTH / 2, y: centerY },
    { x: centerX, y: centerY + TILE_HEIGHT / 2 },
    { x: centerX - TILE_WIDTH / 2, y: centerY },
  ];
}

function getIsoFootprintBounds(footprintWidth: number, footprintHeight: number): {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
} {
  const points: Array<{ x: number; y: number }> = [];

  for (let tileY = 0; tileY < footprintHeight; tileY += 1) {
    for (let tileX = 0; tileX < footprintWidth; tileX += 1) {
      points.push(...getIsoDiamondPoints(tileX, tileY));
    }
  }

  return {
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
  };
}

async function cleanImportedAssetImage(
  dataUrl: string,
  assetKind: EditorAssetKind,
): Promise<HTMLCanvasElement> {
  const image = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create tile import canvas.');
  }

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  removeEdgeBackgroundPixels(ctx, canvas.width, canvas.height, assetKind);
  removeNearBlackPixels(ctx, canvas.width, canvas.height);
  return cropTransparentBounds(ctx, canvas.width, canvas.height);
}

function removeEdgeBackgroundPixels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  assetKind: EditorAssetKind,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const background = sampleDominantCornerColor(data, width, height);

  if (!background) {
    return;
  }

  const tolerance = assetKind === 'object' ? 26 : 18;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0;

    if (alpha === 0) {
      continue;
    }

    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;

    if (colorDistance(red, green, blue, background.red, background.green, background.blue) <= tolerance) {
      data[index + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function sampleDominantCornerColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { blue: number; green: number; red: number } | null {
  const samples = [
    getPixel(data, width, 0, 0),
    getPixel(data, width, width - 1, 0),
    getPixel(data, width, 0, height - 1),
    getPixel(data, width, width - 1, height - 1),
  ].filter((sample): sample is { blue: number; green: number; red: number } => sample !== null);

  if (samples.length === 0) {
    return null;
  }

  return samples
    .map((sample) => ({
      sample,
      matches: samples.filter((candidate) =>
        colorDistance(sample.red, sample.green, sample.blue, candidate.red, candidate.green, candidate.blue) <= 18,
      ).length,
    }))
    .sort((a, b) => b.matches - a.matches)[0]?.sample ?? null;
}

function getPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): { blue: number; green: number; red: number } | null {
  const index = (y * width + x) * 4;
  const alpha = data[index + 3] ?? 0;

  if (alpha === 0) {
    return null;
  }

  return {
    red: data[index] ?? 0,
    green: data[index + 1] ?? 0,
    blue: data[index + 2] ?? 0,
  };
}

function colorDistance(
  redA: number,
  greenA: number,
  blueA: number,
  redB: number,
  greenB: number,
  blueB: number,
): number {
  return Math.max(Math.abs(redA - redB), Math.abs(greenA - greenB), Math.abs(blueA - blueB));
}

function removeNearBlackPixels(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;

    if (red <= 8 && green <= 8 && blue <= 8) {
      data[index + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function cropTransparentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): HTMLCanvasElement {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3] ?? 0;

      if (alpha <= 0) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    const empty = document.createElement('canvas');
    empty.width = 1;
    empty.height = 1;
    return empty;
  }

  const cropped = document.createElement('canvas');
  cropped.width = maxX - minX + 1;
  cropped.height = maxY - minY + 1;
  const croppedCtx = cropped.getContext('2d');

  if (!croppedCtx) {
    return cropped;
  }

  croppedCtx.imageSmoothingEnabled = false;
  croppedCtx.putImageData(ctx.getImageData(minX, minY, cropped.width, cropped.height), 0, 0);
  return cropped;
}
