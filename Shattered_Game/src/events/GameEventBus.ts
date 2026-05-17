import Phaser from 'phaser';
import type { SfxEventId, SfxEventPayload } from '../audio/SfxTypes';

const AUDIO_EVENT = 'audio:sfx';

export class GameEventBus {
  private readonly emitter = new Phaser.Events.EventEmitter();

  emitSfx(id: SfxEventId): void {
    const payload: SfxEventPayload = { id };
    this.emitter.emit(AUDIO_EVENT, payload);
  }

  onSfx(listener: (payload: SfxEventPayload) => void): void {
    this.emitter.on(AUDIO_EVENT, listener);
  }

  offSfx(listener: (payload: SfxEventPayload) => void): void {
    this.emitter.off(AUDIO_EVENT, listener);
  }
}
