import Phaser from 'phaser';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import type { ChoiceMenuStateSnapshot } from './ChoiceMenuTypes';

export class InteractionChoiceMenuSystem {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly menuText: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    this.uiCamera = this.scene.cameras.add(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.menuText = this.scene.add.text(0, 0, '', {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '18px',
      backgroundColor: '#07111fe6',
      padding: {
        x: 14,
        y: 10,
      },
      wordWrap: {
        width: 520,
      },
    });
    this.menuText.setDepth(RENDER_DEPTHS.UI + 2);
    this.menuText.setVisible(false);
    this.scene.cameras.main.ignore(this.menuText);
    this.ignoreWorldForUiCamera();
    this.registerResizeHandler();
    this.layout();
  }

  update(state: ChoiceMenuStateSnapshot | null): void {
    if (!state) {
      this.menuText.setVisible(false);
      this.menuText.setText('');
      return;
    }

    const lines = [
      `[${state.title}]`,
      '',
      ...state.options.flatMap((option, index) => {
        const prefix = index === state.selectedIndex ? '> ' : '  ';
        const suffix = option.disabledReason ? ` [${option.disabledReason}]` : '';
        const optionLines = [`${prefix}${option.label}${suffix}`];

        if (option.details) {
          optionLines.push(`    ${option.details}`);
        }

        return optionLines;
      }),
      '',
      '[W/S or Up/Down] Select   [E/Enter] Confirm   [Esc] Cancel',
    ];

    this.menuText.setText(lines.join('\n'));
    this.menuText.setVisible(true);
    this.layout();
  }

  private registerResizeHandler(): void {
    this.scene.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.uiCamera.setViewport(0, 0, gameSize.width, gameSize.height);
      this.layout();
    });
  }

  private ignoreWorldForUiCamera(): void {
    const existing = this.scene.children.getChildren().filter((child) => child !== this.menuText);
    this.uiCamera.ignore(existing);

    this.scene.events.on(
      Phaser.Scenes.Events.ADDED_TO_SCENE,
      (child: Phaser.GameObjects.GameObject) => {
        if (child !== this.menuText) {
          this.uiCamera.ignore(child);
        }
      },
    );
  }

  private layout(): void {
    this.menuText.setPosition(this.scene.scale.width / 2, this.scene.scale.height / 2);
    this.menuText.setOrigin(0.5, 0.5);
  }
}
