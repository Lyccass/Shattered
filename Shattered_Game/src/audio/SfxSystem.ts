import Phaser from 'phaser';
import type { GameEventBus } from '../events/GameEventBus';
import type { SfxEventId, SfxEventPayload } from './SfxTypes';

type SfxTone = {
  frequency: number;
  durationMs: number;
  volume: number;
  type: OscillatorType;
};

const SFX_TONES: Record<SfxEventId, SfxTone> = {
  menu_open: { frequency: 420, durationMs: 55, volume: 0.018, type: 'triangle' },
  menu_select: { frequency: 500, durationMs: 40, volume: 0.015, type: 'triangle' },
  menu_confirm: { frequency: 640, durationMs: 70, volume: 0.02, type: 'square' },
  menu_cancel: { frequency: 260, durationMs: 70, volume: 0.02, type: 'sawtooth' },
  gather_start: { frequency: 320, durationMs: 60, volume: 0.018, type: 'triangle' },
  gather_success: { frequency: 560, durationMs: 90, volume: 0.022, type: 'triangle' },
  craft_start: { frequency: 360, durationMs: 70, volume: 0.018, type: 'square' },
  craft_success: { frequency: 690, durationMs: 110, volume: 0.024, type: 'square' },
  craft_failed: { frequency: 180, durationMs: 120, volume: 0.02, type: 'sawtooth' },
  action_cancelled: { frequency: 210, durationMs: 85, volume: 0.018, type: 'triangle' },
  item_placed: { frequency: 430, durationMs: 75, volume: 0.018, type: 'square' },
  fire_lit: { frequency: 740, durationMs: 130, volume: 0.024, type: 'triangle' },
  tea_brewed: { frequency: 620, durationMs: 120, volume: 0.022, type: 'triangle' },
  tea_consumed: { frequency: 520, durationMs: 90, volume: 0.02, type: 'triangle' },
  contract_accepted: { frequency: 450, durationMs: 90, volume: 0.019, type: 'square' },
  contract_completed: { frequency: 780, durationMs: 140, volume: 0.024, type: 'square' },
  xp_gain: { frequency: 860, durationMs: 80, volume: 0.015, type: 'triangle' },
  invalid_action: { frequency: 150, durationMs: 100, volume: 0.018, type: 'sawtooth' },
  map_transition: { frequency: 300, durationMs: 150, volume: 0.02, type: 'triangle' },
};

export type SfxSystemStatus = 'locked' | 'ready' | 'failed' | 'unsupported';

export class SfxSystem {
  private audioContext: AudioContext | null = null;
  private status: SfxSystemStatus = 'locked';
  private failureReason: string | null = null;
  private lastWarning: string | null = null;
  private readonly handleSfxEvent = (payload: SfxEventPayload) => {
    void this.play(payload.id);
  };
  private readonly handleUnlockGesture = () => {
    void this.unlockFromGesture();
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
  ) {
    this.eventBus.onSfx(this.handleSfxEvent);
    this.registerUnlockListeners();
  }

  destroy(): void {
    this.eventBus.offSfx(this.handleSfxEvent);
    this.unregisterUnlockListeners();

    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
  }

  private async play(eventId: SfxEventId): Promise<void> {
    const tone = SFX_TONES[eventId];
    const context = await this.ensureContextReady('playback');

    if (!context) {
      if (this.status === 'locked') {
        this.warnOnce('Audio is locked. Click or tap the game once to enable sound.');
      }
      return;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.frequency, now);

    gain.gain.setValueAtTime(tone.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.durationMs / 1000);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + tone.durationMs / 1000);
  }

  getStatus(): SfxSystemStatus {
    return this.status;
  }

  getFailureReason(): string | null {
    return this.failureReason;
  }

  private async unlockFromGesture(): Promise<void> {
    await this.ensureContextReady('gesture');
  }

  private async ensureContextReady(trigger: 'gesture' | 'playback'): Promise<AudioContext | null> {
    const context = this.getOrCreateContext();

    if (!context || this.status === 'failed' || this.status === 'unsupported') {
      return null;
    }

    const resumedState = context.state;

    if (resumedState === 'running') {
      this.markReady();
      return context;
    }

    try {
      await context.resume();
    } catch (error) {
      if (trigger === 'gesture') {
        this.warnOnce(this.formatResumeBlockedMessage(error));
      }
      return null;
    }

    if (context.state === 'running') {
      this.markReady();
      return context;
    }

    if (trigger === 'gesture') {
      this.warnOnce('Audio is still locked. Click or tap the game once to enable sound.');
    }

    this.status = 'locked';
    return null;
  }

  private getOrCreateContext(): AudioContext | null {
    if (!this.audioContext) {
      const extendedGlobal = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
      const View = extendedGlobal.AudioContext ?? extendedGlobal.webkitAudioContext;

      if (!View) {
        this.status = 'unsupported';
        this.failureReason = 'Web Audio API is unavailable in this browser.';
        this.unregisterUnlockListeners();
        this.warnOnce(this.failureReason);
        return null;
      }

      try {
        this.audioContext = new View();
      } catch (error) {
        this.markFailed(this.formatResumeFailure(error));
        return null;
      }
    }

    return this.audioContext;
  }

  private registerUnlockListeners(): void {
    this.scene.input.on('pointerdown', this.handleUnlockGesture);
    this.scene.input.keyboard?.on('keydown', this.handleUnlockGesture);
  }

  private unregisterUnlockListeners(): void {
    this.scene.input.off('pointerdown', this.handleUnlockGesture);
    this.scene.input.keyboard?.off('keydown', this.handleUnlockGesture);
  }

  private markReady(): void {
    this.status = 'ready';
    this.failureReason = null;
    this.unregisterUnlockListeners();
  }

  private markFailed(reason: string): null {
    this.status = 'failed';
    this.failureReason = reason;
    this.unregisterUnlockListeners();
    this.warnOnce(reason);
    return null;
  }

  private formatResumeFailure(error: unknown): string {
    if (error instanceof Error && error.message) {
      return `Failed to start browser audio: ${error.message}`;
    }

    return 'Failed to start browser audio.';
  }

  private formatResumeBlockedMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return `Audio unlock was blocked. Click or tap the game once to enable sound. (${error.message})`;
    }

    return 'Audio unlock was blocked. Click or tap the game once to enable sound.';
  }

  private warnOnce(message: string): void {
    if (this.lastWarning === message) {
      return;
    }

    this.lastWarning = message;
    console.warn(`[SfxSystem] ${message}`);
  }
}
