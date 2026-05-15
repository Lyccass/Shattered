import Phaser from 'phaser';

export const OBJECT_TEXTURES = {
  tree01: 'object-tree-01',
  tree02: 'object-tree-02',
  stone01: 'object-stone-01',
  stone02: 'object-stone-02',
  stone03: 'object-stone-03',
  stone04: 'object-stone-04',
  stone05: 'object-stone-05',
  stone06: 'object-stone-06',
  stone07: 'object-stone-07',
} as const;

const OBJECT_ASSETS: Array<{ key: string; path: string }> = [
  { key: OBJECT_TEXTURES.tree01, path: '/assets/Objects/Tree_01.png' },
  { key: OBJECT_TEXTURES.tree02, path: '/assets/Objects/Tree_02.png' },
  { key: OBJECT_TEXTURES.stone01, path: '/assets/Objects/Stone_01.png' },
  { key: OBJECT_TEXTURES.stone02, path: '/assets/Objects/Stone_02.png' },
  { key: OBJECT_TEXTURES.stone03, path: '/assets/Objects/Stone_03.png' },
  { key: OBJECT_TEXTURES.stone04, path: '/assets/Objects/Stone_04.png' },
  { key: OBJECT_TEXTURES.stone05, path: '/assets/Objects/Stone_05.png' },
  { key: OBJECT_TEXTURES.stone06, path: '/assets/Objects/Stone_06.png' },
  { key: OBJECT_TEXTURES.stone07, path: '/assets/Objects/Stone_07.png' },
];

export function preloadObjectAssets(scene: Phaser.Scene): void {
  OBJECT_ASSETS.forEach(({ key, path }) => {
    if (!scene.textures.exists(key)) {
      scene.load.image(key, path);
    }
  });
}
