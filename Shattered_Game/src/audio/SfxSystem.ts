import Phaser from 'phaser';
import type { GameEventBus } from '../events/GameEventBus';
import { AudioUnlockGate } from './AudioUnlockGate';
import type { AudioDiagnosticsSnapshot, AudioPlaybackBackend, AudioSystemStatus } from './AudioTypes';
import { GeneratedToneBackend } from './GeneratedToneBackend';
import { DEFAULT_SFX_REGISTRY, type SfxRegistry } from './SfxRegistry';
import type { SfxEventId, SfxEventPayload } from './SfxTypes';

export type SfxSystemStatus = AudioSystemStatus;

export class SfxSystem {
  private readonly registry: SfxRegistry;
  private readonly backend: AudioPlaybackBackend;
  private readonly unlockGate: AudioUnlockGate;
  private readonly pendingEventIds: SfxEventId[] = [];
  private lastEventId: SfxEventId | null = null;
  private lastWarning: string | null = null;
  private readonly handleSfxEvent = (payload: SfxEventPayload) => {
    void this.play(payload.id);
  };

  constructor(
    scene: Phaser.Scene,
    private readonly eventBus: GameEventBus,
    registry: SfxRegistry = DEFAULT_SFX_REGISTRY,
    backend: AudioPlaybackBackend = new GeneratedToneBackend(),
  ) {
    this.registry = registry;
    this.backend = backend;
    this.unlockGate = new AudioUnlockGate(scene, (context) => {
      this.flushPending(context);
    });
    this.eventBus.onSfx(this.handleSfxEvent);
  }

  destroy(): void {
    this.eventBus.offSfx(this.handleSfxEvent);
    this.unlockGate.destroy();
    this.backend.reset();
  }

  getStatus(): SfxSystemStatus {
    return this.unlockGate.getStatus();
  }

  getFailureReason(): string | null {
    return this.unlockGate.getFailureReason();
  }

  getDiagnostics(): AudioDiagnosticsSnapshot {
    return {
      status: this.unlockGate.getStatus(),
      backendName: this.backend.name,
      contextState: this.unlockGate.getContextState(),
      pendingCount: this.pendingEventIds.length,
      lastEventId: this.lastEventId,
      failureReason: this.unlockGate.getFailureReason(),
    };
  }

  private async play(eventId: SfxEventId): Promise<void> {
    this.lastEventId = eventId;
    const context = await this.unlockGate.ensureReady('playback');

    if (!context) {
      if (this.unlockGate.getStatus() === 'locked') {
        this.queuePending(eventId);
        this.warnOnce('Audio is locked. Click or tap the game once to enable sound.');
      }
      return;
    }

    this.playNow(context, eventId, context.currentTime);
  }

  private playNow(context: AudioContext, eventId: SfxEventId, startTime: number): void {
    const definition = this.registry.get(eventId);

    if (!this.backend.supports(definition)) {
      this.warnOnce(`No audio backend can play SFX id "${eventId}".`);
      return;
    }

    this.backend.play(context, eventId, definition, startTime);
  }

  private queuePending(eventId: SfxEventId): void {
    if (this.pendingEventIds.length >= 8) {
      return;
    }

    this.pendingEventIds.push(eventId);
  }

  private flushPending(context: AudioContext): void {
    if (this.pendingEventIds.length === 0) {
      return;
    }

    const queued = this.pendingEventIds.splice(0, this.pendingEventIds.length);
    queued.forEach((eventId, index) => {
      this.playNow(context, eventId, context.currentTime + (index * 18) / 1000);
    });
  }

  private warnOnce(message: string): void {
    if (this.lastWarning === message) {
      return;
    }

    this.lastWarning = message;
    console.warn(`[SfxSystem] ${message}`);
  }
}
