import type { SfxEventId } from './SfxTypes';

export type AudioSystemStatus = 'locked' | 'ready' | 'failed' | 'unsupported';

export type GeneratedToneClipDefinition = {
  kind: 'generated_tone';
  frequency: number;
  durationMs: number;
  volume: number;
  type: OscillatorType;
};

export type SfxClipDefinition = GeneratedToneClipDefinition;

export type AudioDiagnosticsSnapshot = {
  status: AudioSystemStatus;
  backendName: string;
  contextState: string;
  pendingCount: number;
  lastEventId: SfxEventId | null;
  failureReason: string | null;
};

export interface AudioPlaybackBackend {
  readonly name: string;
  supports(definition: SfxClipDefinition): boolean;
  play(
    context: AudioContext,
    eventId: SfxEventId,
    definition: SfxClipDefinition,
    startTime: number,
  ): void;
  reset(): void;
}
