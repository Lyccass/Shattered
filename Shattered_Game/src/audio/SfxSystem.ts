import Phaser from 'phaser';
import type { GameEventBus } from '../events/GameEventBus';
import { AudioUnlockGate } from './AudioUnlockGate';
import type {
  AudioDiagnosticsSnapshot,
  AudioMixerSettings,
  AudioPlaybackBackend,
  AudioSystemStatus,
} from './AudioTypes';
import { BgmLayer } from './BgmLayer';
import { GeneratedToneBackend } from './GeneratedToneBackend';
import { DEFAULT_SFX_REGISTRY, type SfxRegistry } from './SfxRegistry';
import type { SfxEventId, SfxEventPayload } from './SfxTypes';

export type SfxSystemStatus = AudioSystemStatus;

const AUDIO_SETTINGS_STORAGE_KEY = 'shattered.audio.settings.v1';

const DEFAULT_AUDIO_SETTINGS: AudioMixerSettings = {
  masterVolume: 0.8,
  musicVolume: 0.45,
  sfxVolume: 0.8,
  uiVolume: 0.7,
  musicEnabled: true,
  sfxEnabled: true,
  uiEnabled: true,
};

const UI_SFX_IDS = new Set<SfxEventId>([
  'menu_open',
  'menu_select',
  'menu_confirm',
  'menu_cancel',
  'ui_tab_open',
  'ui_tab_close',
  'ui_button',
]);

export class SfxSystem {
  private readonly registry: SfxRegistry;
  private readonly backend: AudioPlaybackBackend;
  private readonly bgmLayer = new BgmLayer();
  private readonly unlockGate: AudioUnlockGate;
  private readonly pendingEventIds: SfxEventId[] = [];
  private mixerSettings = loadAudioSettings();
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
      this.startBgmIfAudible();
    });
    this.applyBgmVolume();
    this.eventBus.onSfx(this.handleSfxEvent);
  }

  destroy(): void {
    this.eventBus.offSfx(this.handleSfxEvent);
    this.bgmLayer.stop();
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

  getMixerSettings(): AudioMixerSettings {
    return { ...this.mixerSettings };
  }

  setMixerSettings(nextSettings: Partial<AudioMixerSettings>): void {
    this.mixerSettings = sanitizeAudioSettings({
      ...this.mixerSettings,
      ...nextSettings,
    });
    saveAudioSettings(this.mixerSettings);
    this.applyBgmVolume();
    if (this.unlockGate.getStatus() === 'ready') {
      this.startBgmIfAudible();
    }
  }

  private async play(eventId: SfxEventId): Promise<void> {
    this.lastEventId = eventId;
    if (this.getEffectiveSfxVolume(eventId) <= 0) {
      return;
    }

    const context = await this.unlockGate.ensureReady('playback');

    if (!context) {
      if (this.unlockGate.getStatus() === 'locked') {
        this.queuePending(eventId);
        this.warnOnce('Audio is locked. Click or tap the game once to enable sound.');
      }
      return;
    }

    if (this.pendingEventIds.length > 0) {
      this.flushPending(context);
    }

    this.startBgmIfAudible();
    this.playNow(context, eventId, context.currentTime);
  }

  private playNow(context: AudioContext, eventId: SfxEventId, startTime: number): void {
    const definition = this.registry.get(eventId);
    const volume = this.getEffectiveSfxVolume(eventId);

    if (volume <= 0) {
      return;
    }

    if (!this.backend.supports(definition)) {
      this.warnOnce(`No audio backend can play SFX id "${eventId}".`);
      return;
    }

    this.backend.play(context, eventId, { ...definition, volume: definition.volume * volume }, startTime);
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

  private getEffectiveSfxVolume(eventId: SfxEventId): number {
    const isUi = UI_SFX_IDS.has(eventId);
    if (isUi && !this.mixerSettings.uiEnabled) return 0;
    if (!isUi && !this.mixerSettings.sfxEnabled) return 0;
    const channelVolume = isUi ? this.mixerSettings.uiVolume : this.mixerSettings.sfxVolume;
    return this.mixerSettings.masterVolume * channelVolume;
  }

  private getEffectiveMusicVolume(): number {
    if (!this.mixerSettings.musicEnabled) return 0;
    return this.mixerSettings.masterVolume * this.mixerSettings.musicVolume;
  }

  private applyBgmVolume(): void {
    this.bgmLayer.setVolume(this.getEffectiveMusicVolume());
  }

  private startBgmIfAudible(): void {
    const musicVolume = this.getEffectiveMusicVolume();
    this.bgmLayer.setVolume(musicVolume);
    if (musicVolume > 0) {
      this.bgmLayer.start();
    }
  }

  private warnOnce(message: string): void {
    if (this.lastWarning === message) {
      return;
    }

    this.lastWarning = message;
    console.warn(`[SfxSystem] ${message}`);
  }
}

export function getDefaultAudioMixerSettings(): AudioMixerSettings {
  return { ...DEFAULT_AUDIO_SETTINGS };
}

function loadAudioSettings(): AudioMixerSettings {
  if (typeof localStorage === 'undefined') {
    return getDefaultAudioMixerSettings();
  }

  try {
    const raw = localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return getDefaultAudioMixerSettings();
    return sanitizeAudioSettings({
      ...DEFAULT_AUDIO_SETTINGS,
      ...(JSON.parse(raw) as Partial<AudioMixerSettings>),
    });
  } catch {
    return getDefaultAudioMixerSettings();
  }
}

function saveAudioSettings(settings: AudioMixerSettings): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Audio settings are convenience state; ignore storage failures.
  }
}

function sanitizeAudioSettings(settings: AudioMixerSettings): AudioMixerSettings {
  return {
    masterVolume: clamp01(settings.masterVolume),
    musicVolume: clamp01(settings.musicVolume),
    sfxVolume: clamp01(settings.sfxVolume),
    uiVolume: clamp01(settings.uiVolume),
    musicEnabled: Boolean(settings.musicEnabled),
    sfxEnabled: Boolean(settings.sfxEnabled),
    uiEnabled: Boolean(settings.uiEnabled),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
