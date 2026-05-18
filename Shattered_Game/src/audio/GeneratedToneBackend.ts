import type { AudioPlaybackBackend, GeneratedToneClipDefinition } from './AudioTypes';
import type { SfxEventId } from './SfxTypes';

export class GeneratedToneBackend implements AudioPlaybackBackend {
  readonly name = 'generated-tone-buffer';
  private bufferContext: AudioContext | null = null;
  private readonly toneBufferCache = new Map<SfxEventId, AudioBuffer>();

  supports(definition: GeneratedToneClipDefinition): boolean {
    return definition.kind === 'generated_tone';
  }

  reset(): void {
    this.bufferContext = null;
    this.toneBufferCache.clear();
  }

  play(
    context: AudioContext,
    eventId: SfxEventId,
    definition: GeneratedToneClipDefinition,
    startTime: number,
  ): void {
    const source = context.createBufferSource();
    const gain = context.createGain();

    source.buffer = this.getOrCreateToneBuffer(context, eventId, definition);
    gain.gain.setValueAtTime(definition.volume, startTime);
    source.connect(gain);
    gain.connect(context.destination);
    source.start(startTime);
  }

  private getOrCreateToneBuffer(
    context: AudioContext,
    eventId: SfxEventId,
    definition: GeneratedToneClipDefinition,
  ): AudioBuffer {
    if (this.bufferContext !== context) {
      this.bufferContext = context;
      this.toneBufferCache.clear();
    }

    const cached = this.toneBufferCache.get(eventId);

    if (cached) {
      return cached;
    }

    const durationSeconds = definition.durationMs / 1000;
    const sampleRate = context.sampleRate;
    const frameCount = Math.max(1, Math.ceil(durationSeconds * sampleRate));
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      const time = index / sampleRate;
      const phase = time * definition.frequency;
      const waveform = generateWaveSample(definition.type, phase);
      const envelope = buildEnvelope(index, frameCount);
      channel[index] = waveform * envelope;
    }

    this.toneBufferCache.set(eventId, buffer);
    return buffer;
  }
}

function generateWaveSample(type: OscillatorType, phase: number): number {
  switch (type) {
    case 'square':
      return Math.sign(Math.sin(2 * Math.PI * phase)) || 1;
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * phase));
    case 'sawtooth': {
      const wrapped = phase - Math.floor(phase + 0.5);
      return 2 * wrapped;
    }
    case 'sine':
    default:
      return Math.sin(2 * Math.PI * phase);
  }
}

function buildEnvelope(index: number, frameCount: number): number {
  const attackFrames = Math.max(1, Math.floor(frameCount * 0.08));
  const releaseFrames = Math.max(1, Math.floor(frameCount * 0.24));

  if (index < attackFrames) {
    return index / attackFrames;
  }

  if (index > frameCount - releaseFrames) {
    return Math.max(0, (frameCount - index) / releaseFrames);
  }

  return 1;
}
