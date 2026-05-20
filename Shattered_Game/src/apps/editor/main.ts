import Phaser from 'phaser';
import { EditorScene } from '../../editor/EditorScene';

const editorConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'editor',
  width: 1280,
  height: 720,
  backgroundColor: '#07111f',
  pixelArt: true,
  roundPixels: true,
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
    powerPreference: 'high-performance',
    desynchronized: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [EditorScene],
};

new Phaser.Game(editorConfig);
