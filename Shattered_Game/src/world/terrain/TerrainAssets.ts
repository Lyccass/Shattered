import { PROTOTYPE_SCALE } from '../../config/prototypeScale';
import Phaser from 'phaser';

type TerrainSourceAsset = {
  sourceKey: string;
  renderKey: string;
  path: string;
};

const TERRAIN_TARGET_WIDTH = PROTOTYPE_SCALE.tileWidth;
const TERRAIN_TARGET_HEIGHT = PROTOTYPE_SCALE.tileHeight;

const SOURCE_ASSETS: TerrainSourceAsset[] = [
  ...createNumberedTerrainAssets('grassA', '/assets/Grass_A_PNG/Grass_A_', 44),
  ...createNumberedTerrainAssets('groundA', '/assets/Ground_A_PNG/Ground_A_', 48),
  ...createNumberedTerrainAssets('waterBottom', '/assets/Water/Bottom_', 5),
  ...createNumberedTerrainAssets('waterCornerLBottom', '/assets/Water/CornerL_Botom_', 4),
  ...createNumberedTerrainAssets('waterCornerLTop', '/assets/Water/CornerL_Top_', 4),
  ...createNumberedTerrainAssets('waterCornerRBottom', '/assets/Water/CornerR_Bottom_', 4),
  ...createNumberedTerrainAssets('waterCornerRTop', '/assets/Water/CornerR_Top_', 4),
  ...createNumberedTerrainAssets('waterFloat', '/assets/Water/Float_', 12),
  ...createNumberedTerrainAssets('waterJointLCorner', '/assets/Water/JointL_Corner_', 4),
  ...createNumberedTerrainAssets('waterJointRCorner', '/assets/Water/JointR_Corner_', 4),
  ...createNumberedTerrainAssets('waterJointBottom', '/assets/Water/Joint_Bottom_', 6),
  ...createNumberedTerrainAssets('waterJointR', '/assets/Water/Joint_R_', 2),
  ...createNumberedTerrainAssets('waterJointTop', '/assets/Water/Joint_Top_', 2),
  ...createNumberedTerrainAssets('waterLSide', '/assets/Water/L_Side_', 6),
  ...createNumberedTerrainAssets('waterRSide', '/assets/Water/R_Side_', 5),
  ...createNumberedTerrainAssets('waterTop', '/assets/Water/Top_', 6),
  createTerrainAsset('waterCrossWayBottomA', '/assets/Water/CrossWay_Bottom_A.png'),
  createTerrainAsset('waterCrossWayBottomB', '/assets/Water/CrossWay_Bottom_B.png'),
  createTerrainAsset('waterCrossWayL', '/assets/Water/CrossWay_L.png'),
  createTerrainAsset('waterCrossWayRA', '/assets/Water/CrossWay_R_A.png'),
  createTerrainAsset('waterCrossWayRB', '/assets/Water/CrossWay_R_B.png'),
  createTerrainAsset('waterCrossWayTop', '/assets/Water/CrossWay_Top.png'),
  createTerrainAsset('waterA', '/assets/Water/Water_A.png'),
  createTerrainAsset('waterB', '/assets/Water/Water_B.png'),
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

}

function createNumberedTerrainAssets(
  prefix: string,
  pathPrefix: string,
  count: number,
): TerrainSourceAsset[] {
  return Array.from({ length: count }, (_, index) => {
    const number = `${index + 1}`.padStart(2, '0');
    return createTerrainAsset(`${prefix}${number}`, `${pathPrefix}${number}.png`);
  });
}

function createTerrainAsset(id: string, path: string): TerrainSourceAsset {
  return {
    sourceKey: `terrain-source-${id}`,
    renderKey: `terrain-${id}`,
    path,
  };
}

function createScaledTexture(scene: Phaser.Scene, { sourceKey, renderKey }: TerrainSourceAsset): void {
  if (scene.textures.exists(renderKey)) {
    return;
  }

  const sourceImage = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  const width = TERRAIN_TARGET_WIDTH;
  const height = TERRAIN_TARGET_HEIGHT;
  const canvasTexture = scene.textures.createCanvas(renderKey, width, height);

  if (!canvasTexture) {
    return;
  }

  const context = canvasTexture.getContext();
  context.imageSmoothingEnabled = false;
  context.drawImage(sourceImage, 0, 0, width, height);
  canvasTexture.refresh();
}
