import Phaser from 'phaser';
import { PROTOTYPE_SCALE } from '../../config/prototypeScale';

type TerrainSourceAsset = {
  sourceKey: string;
  renderKey: string;
  path: string;
};

const TERRAIN_ASSET_SCALE = 0.5;
const TERRAIN_BASE_PATH = '/assets/isometric-nature-pack';

const SOURCE_ASSETS: TerrainSourceAsset[] = [
  createSourceAsset('dirt1'),
  createSourceAsset('dirt2'),
  createSourceAsset('dirt3'),
  createSourceAsset('dirt4'),
  createSourceAsset('grass1'),
  createSourceAsset('grass2'),
  createSourceAsset('grass3'),
  createSourceAsset('grass4'),
  createSourceAsset('grass5'),
  createSourceAsset('grass6'),
  createSourceAsset('grass7'),
  createSourceAsset('grass8'),
  createSourceAsset('grass9'),
  createSourceAsset('grass10'),
  createSourceAsset('stone1'),
  createSourceAsset('stone2'),
  createSourceAsset('stone3'),
  createSourceAsset('stone4'),
  createSourceAsset('stair_stone1'),
];

export function preloadTerrainAssets(scene: Phaser.Scene): void {
  SOURCE_ASSETS.forEach(({ sourceKey, path }) => {
    if (!scene.textures.exists(sourceKey)) {
      scene.load.image(sourceKey, path);
    }
  });
}

export function createTerrainRenderTextures(scene: Phaser.Scene): void {
  SOURCE_ASSETS.forEach((asset) => {
    createScaledTexture(scene, asset);
  });

  createWaterTexture(scene, 'terrain-water1', false);
  createWaterTexture(scene, 'terrain-water2', true);
}

function createSourceAsset(id: string): TerrainSourceAsset {
  return {
    sourceKey: `terrain-source-${id}`,
    renderKey: `terrain-${id}`,
    path: `${TERRAIN_BASE_PATH}/${id}.png`,
  };
}

function createScaledTexture(scene: Phaser.Scene, { sourceKey, renderKey }: TerrainSourceAsset): void {
  if (scene.textures.exists(renderKey)) {
    return;
  }

  const sourceImage = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  const width = Math.max(1, Math.round(sourceImage.width * TERRAIN_ASSET_SCALE));
  const height = Math.max(1, Math.round(sourceImage.height * TERRAIN_ASSET_SCALE));
  const canvasTexture = scene.textures.createCanvas(renderKey, width, height);

  if (!canvasTexture) {
    return;
  }

  const context = canvasTexture.getContext();
  context.imageSmoothingEnabled = false;
  context.drawImage(sourceImage, 0, 0, width, height);
  canvasTexture.refresh();
}

function createWaterTexture(scene: Phaser.Scene, key: string, hasRipple: boolean): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const width = PROTOTYPE_SCALE.tileWidth;
  const height = PROTOTYPE_SCALE.tileHeight;
  const canvasTexture = scene.textures.createCanvas(key, width, height);

  if (!canvasTexture) {
    return;
  }

  const context = canvasTexture.getContext();
  context.imageSmoothingEnabled = false;

  // Water is generated until we have a matching terrain sprite. Keep it opaque at
  // the tile edge so neighbouring diamonds do not reveal seams while moving.
  drawDiamond(context, width, height, 0, hasRipple ? '#0f7894' : '#0c708b');
  drawDiamond(context, width, height, 3, hasRipple ? '#158eaa' : '#137f9c');

  context.fillStyle = 'rgba(3, 49, 70, 0.28)';
  context.beginPath();
  context.moveTo(5, height / 2);
  context.lineTo(width / 2, height - 5);
  context.lineTo(width - 5, height / 2);
  context.lineTo(width / 2, height - 1);
  context.closePath();
  context.fill();

  context.fillStyle = 'rgba(69, 188, 208, 0.38)';
  context.beginPath();
  context.moveTo(width / 2, 7);
  context.lineTo(width - 16, height / 2);
  context.lineTo(width / 2, height - 10);
  context.lineTo(16, height / 2);
  context.closePath();
  context.fill();

  if (hasRipple) {
    context.strokeStyle = 'rgba(190, 242, 255, 0.72)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(20, 13);
    context.lineTo(27, 11);
    context.lineTo(35, 13);
    context.stroke();

    context.strokeStyle = 'rgba(122, 218, 235, 0.78)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(31, 18);
    context.lineTo(38, 16);
    context.lineTo(46, 18);
    context.stroke();
  } else {
    context.fillStyle = 'rgba(116, 215, 232, 0.38)';
    context.fillRect(26, 13, 12, 1);
    context.fillRect(30, 14, 7, 1);
  }

  canvasTexture.refresh();
}

function drawDiamond(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  inset: number,
  fillStyle: string,
): void {
  context.fillStyle = fillStyle;
  context.beginPath();
  context.moveTo(width / 2, inset);
  context.lineTo(width - inset, height / 2);
  context.lineTo(width / 2, height - inset);
  context.lineTo(inset, height / 2);
  context.closePath();
  context.fill();
}
