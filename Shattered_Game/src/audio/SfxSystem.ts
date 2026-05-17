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

export class SfxSystem {
  private audioContext: AudioContext | null = null;
  private readonly handleSfxEvent = (payload: SfxEventPayload) => {
    void this.play(payload.id);
  };

  constructor(
    _scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
  ) {
    this.eventBus.onSfx(this.handleSfxEvent);
  }

  destroy(): void {
    this.eventBus.offSfx(this.handleSfxEvent);
  }

  private async play(eventId: SfxEventId): Promise<void> {
    const tone = SFX_TONES[eventId];
    const context = await this.ensureContext();

    if (!context) {
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

  private async ensureContext(): Promise<AudioContext | null> {
    if (!this.audioContext) {
      const extendedGlobal = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
      const View = extendedGlobal.AudioContext ?? extendedGlobal.webkitAudioContext;

      if (!View) {
        return null;
      }

      this.audioContext = new View();
    }

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {
        return null;
      }
    }

    if (this.audioContext.state !== 'running') {
      return null;
    }

    return this.audioContext;
  }
}
