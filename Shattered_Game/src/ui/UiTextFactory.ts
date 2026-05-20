import Phaser from 'phaser';
import { RENDER_DEPTHS } from '../render/RenderLayers';

type UiTextVariant = 'panel' | 'menu' | 'toast';

const FONT = '"Asimovian", "Palatino Linotype", serif';

const UI_TEXT_STYLES: Record<UiTextVariant, Phaser.Types.GameObjects.Text.TextStyle> = {
  panel: {
    color: '#FFFCC3',
    fontFamily: FONT,
    fontSize: '18px',
    backgroundColor: '#0c0702ee',
    padding: { x: 12, y: 9 },
    stroke: '#3a2209',
    strokeThickness: 1,
  },
  menu: {
    color: '#FFFCC3',
    fontFamily: FONT,
    fontSize: '18px',
    backgroundColor: '#0c0702f0',
    padding: { x: 16, y: 12 },
    wordWrap: { width: 680 },
    stroke: '#3a2209',
    strokeThickness: 1,
  },
  toast: {
    color: '#FFFCC3',
    fontFamily: FONT,
    fontSize: '18px',
    backgroundColor: '#0c0702f0',
    padding: { x: 14, y: 9 },
    align: 'center',
    stroke: '#613C18',
    strokeThickness: 1,
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
