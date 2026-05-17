import Phaser from 'phaser';
import { RENDER_DEPTHS } from '../render/RenderLayers';

type UiTextVariant = 'panel' | 'menu' | 'toast';

const UI_TEXT_STYLES: Record<UiTextVariant, Phaser.Types.GameObjects.Text.TextStyle> = {
  panel: {
    color: '#f8fafc',
    fontFamily: 'monospace',
    fontSize: '16px',
    backgroundColor: '#07111fdc',
    padding: { x: 10, y: 8 },
  },
  menu: {
    color: '#f8fafc',
    fontFamily: 'monospace',
    fontSize: '18px',
    backgroundColor: '#07111fe8',
    padding: { x: 14, y: 10 },
    wordWrap: { width: 680 },
  },
  toast: {
    color: '#f8fafc',
    fontFamily: 'monospace',
    fontSize: '16px',
    backgroundColor: '#07111fe6',
    padding: { x: 12, y: 8 },
    align: 'center',
  },
};

export function createUiText(
  scene: Phaser.Scene,
  variant: UiTextVariant,
): Phaser.GameObjects.Text {
  const text = scene.add.text(0, 0, '', UI_TEXT_STYLES[variant]);
  text.setScrollFactor(0);
  text.setDepth(RENDER_DEPTHS.UI + (variant === 'menu' ? 2 : 1));
  text.setVisible(false);
  return text;
}
