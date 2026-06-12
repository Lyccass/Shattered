const BGM_TRACKS = [
  '/assets/bgm/bioluminescence.mp3',
  '/assets/bgm/the-harvest.mp3',
  '/assets/bgm/the-blue-jay.mp3',
];

export class BgmLayer {
  private audio: HTMLAudioElement | null = null;
  private trackIndex = 0;
  private started = false;
  private volume = 0.18;

  start(): void {
    if (this.started || typeof Audio === 'undefined') {
      return;
    }

    this.started = true;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.volume = this.volume;
    this.audio.addEventListener('ended', this.handleEnded);
    this.playCurrentTrack();
  }

  stop(): void {
    if (!this.audio) {
      return;
    }

    this.audio.pause();
    this.audio.removeEventListener('ended', this.handleEnded);
    this.audio = null;
    this.started = false;
  }

  setVolume(volume: number): void {
    this.volume = clamp01(volume);
    if (this.audio) {
      this.audio.volume = this.volume;
      if (this.volume <= 0) {
        this.audio.pause();
      } else if (this.started) {
        void this.audio.play().catch(() => {
          this.started = false;
        });
      }
    }
  }

  private readonly handleEnded = (): void => {
    this.trackIndex = (this.trackIndex + 1) % BGM_TRACKS.length;
    this.playCurrentTrack();
  };

  private playCurrentTrack(): void {
    if (!this.audio) {
      return;
    }

    this.audio.src = BGM_TRACKS[this.trackIndex];
    this.audio.currentTime = 0;
    void this.audio.play().catch(() => {
      this.started = false;
    });
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
