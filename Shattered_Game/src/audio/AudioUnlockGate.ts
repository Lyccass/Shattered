import type Phaser from 'phaser';
import type { AudioSystemStatus } from './AudioTypes';

type AudioReadyListener = (context: AudioContext) => void;

export class AudioUnlockGate {
  private audioContext: AudioContext | null = null;
  private status: AudioSystemStatus = 'locked';
  private failureReason: string | null = null;
  private lastWarning: string | null = null;
  private unlockListenersRegistered = false;

  private readonly handleSceneGesture = () => {
    void this.unlockFromGesture();
  };

  private readonly handleWindowGesture = () => {
    void this.unlockFromGesture();
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onReady: AudioReadyListener,
  ) {
    this.registerUnlockListeners();
  }

  destroy(): void {
    this.unregisterUnlockListeners();

    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
  }

  async ensureReady(trigger: 'gesture' | 'playback'): Promise<AudioContext | null> {
    const context = this.getOrCreateContext(trigger);

    if (!context || this.status === 'failed' || this.status === 'unsupported') {
      return null;
    }

    const initialState = context.state as string;

    if (initialState === 'closed') {
      this.audioContext = null;
      this.status = 'locked';
      this.registerUnlockListeners();
      return this.ensureReady(trigger);
    }

    if (initialState === 'running') {
      this.markReady();
      return context;
    }

    this.status = 'locked';
    this.registerUnlockListeners();

    try {
      await context.resume();
    } catch (error) {
      if (trigger === 'gesture') {
        this.warnOnce(this.formatResumeBlockedMessage(error));
      } else {
        this.warnOnce('Audio is locked. Click or tap the game once to enable sound.');
      }
      return null;
    }

    const resumedState = context.state as string;

    if (resumedState === 'running') {
      this.markReady();
      return context;
    }

    if (trigger === 'gesture') {
      this.warnOnce('Audio is still locked. Click or tap the game once to enable sound.');
    }

    this.status = 'locked';
    return null;
  }

  getStatus(): AudioSystemStatus {
    return this.status;
  }

  getFailureReason(): string | null {
    return this.failureReason;
  }

  getContextState(): string {
    return this.audioContext?.state ?? 'missing';
  }

  async recreate(): Promise<void> {
    if (this.audioContext) {
      try {
        if (this.audioContext.state !== 'closed') {
          await this.audioContext.close();
        }
      } catch {
        // Ignore close failures and fall back to a fresh instance.
      }
    }

    this.audioContext = null;
    this.status = 'locked';
    this.failureReason = null;
    this.registerUnlockListeners();
  }

  private async unlockFromGesture(): Promise<void> {
    const context = await this.ensureReady('gesture');

    if (context) {
      this.primeContext(context);
      this.onReady(context);
      return;
    }

    if (this.status === 'locked') {
      await this.recreate();
      const rebuiltContext = await this.ensureReady('gesture');

      if (rebuiltContext) {
        this.primeContext(rebuiltContext);
        this.onReady(rebuiltContext);
      }
    }
  }

  private getOrCreateContext(trigger: 'gesture' | 'playback'): AudioContext | null {
    if (!this.audioContext && trigger !== 'gesture') {
      this.status = 'locked';
      this.registerUnlockListeners();
      return null;
    }

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
    if (this.unlockListenersRegistered) {
      return;
    }

    this.scene.input.on('pointerdown', this.handleSceneGesture);
    this.scene.input.on('pointerup', this.handleSceneGesture);
    this.scene.input.keyboard?.on('keydown', this.handleSceneGesture);

    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.handleWindowGesture, { passive: true });
      window.addEventListener('pointerup', this.handleWindowGesture, { passive: true });
      window.addEventListener('mousedown', this.handleWindowGesture, { passive: true });
      window.addEventListener('mouseup', this.handleWindowGesture, { passive: true });
      window.addEventListener('touchstart', this.handleWindowGesture, { passive: true });
      window.addEventListener('touchend', this.handleWindowGesture, { passive: true });
      window.addEventListener('keydown', this.handleWindowGesture, { passive: true });
    }

    this.unlockListenersRegistered = true;
  }

  private unregisterUnlockListeners(): void {
    if (!this.unlockListenersRegistered) {
      return;
    }

    this.scene.input.off('pointerdown', this.handleSceneGesture);
    this.scene.input.off('pointerup', this.handleSceneGesture);
    this.scene.input.keyboard?.off('keydown', this.handleSceneGesture);

    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.handleWindowGesture);
      window.removeEventListener('pointerup', this.handleWindowGesture);
      window.removeEventListener('mousedown', this.handleWindowGesture);
      window.removeEventListener('mouseup', this.handleWindowGesture);
      window.removeEventListener('touchstart', this.handleWindowGesture);
      window.removeEventListener('touchend', this.handleWindowGesture);
      window.removeEventListener('keydown', this.handleWindowGesture);
    }

    this.unlockListenersRegistered = false;
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

  private primeContext(context: AudioContext): void {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.00001, now);
    gain.gain.exponentialRampToValueAtTime(0.000001, now + 0.02);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.02);
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
    console.warn(`[AudioUnlockGate] ${message}`);
  }
}
