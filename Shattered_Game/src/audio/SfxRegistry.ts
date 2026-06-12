import type { SfxClipDefinition } from './AudioTypes';
import type { SfxEventId } from './SfxTypes';

const DEFAULT_SFX_CLIPS: Record<SfxEventId, SfxClipDefinition> = {
  menu_open: { kind: 'generated_tone', frequency: 420, durationMs: 55, volume: 0.018, type: 'triangle' },
  menu_select: { kind: 'generated_tone', frequency: 500, durationMs: 40, volume: 0.015, type: 'triangle' },
  menu_confirm: { kind: 'generated_tone', frequency: 640, durationMs: 70, volume: 0.02, type: 'square' },
  menu_cancel: { kind: 'generated_tone', frequency: 260, durationMs: 70, volume: 0.02, type: 'sawtooth' },
  ui_tab_open: { kind: 'generated_tone', frequency: 460, durationMs: 48, volume: 0.014, type: 'triangle' },
  ui_tab_close: { kind: 'generated_tone', frequency: 300, durationMs: 48, volume: 0.014, type: 'triangle' },
  ui_button: { kind: 'generated_tone', frequency: 580, durationMs: 42, volume: 0.013, type: 'triangle' },
  gather_start: { kind: 'generated_tone', frequency: 320, durationMs: 60, volume: 0.018, type: 'triangle' },
  gather_success: { kind: 'generated_tone', frequency: 560, durationMs: 90, volume: 0.022, type: 'triangle' },
  craft_start: { kind: 'generated_tone', frequency: 360, durationMs: 70, volume: 0.018, type: 'square' },
  craft_success: { kind: 'generated_tone', frequency: 690, durationMs: 110, volume: 0.024, type: 'square' },
  craft_failed: { kind: 'generated_tone', frequency: 180, durationMs: 120, volume: 0.02, type: 'sawtooth' },
  action_cancelled: { kind: 'generated_tone', frequency: 210, durationMs: 85, volume: 0.018, type: 'triangle' },
  item_placed: { kind: 'generated_tone', frequency: 430, durationMs: 75, volume: 0.018, type: 'square' },
  fire_lit: { kind: 'generated_tone', frequency: 740, durationMs: 130, volume: 0.024, type: 'triangle' },
  tea_brewed: { kind: 'generated_tone', frequency: 620, durationMs: 120, volume: 0.022, type: 'triangle' },
  tea_consumed: { kind: 'generated_tone', frequency: 520, durationMs: 90, volume: 0.02, type: 'triangle' },
  footstep_walk: { kind: 'generated_tone', frequency: 95, durationMs: 34, volume: 0.010, type: 'triangle' },
  footstep_run: { kind: 'generated_tone', frequency: 120, durationMs: 30, volume: 0.012, type: 'triangle' },
  combat_start: { kind: 'generated_tone', frequency: 180, durationMs: 180, volume: 0.022, type: 'sawtooth' },
  dodge: { kind: 'generated_tone', frequency: 680, durationMs: 80, volume: 0.02, type: 'triangle' },
  player_attack: { kind: 'generated_tone', frequency: 540, durationMs: 85, volume: 0.02, type: 'square' },
  guard_block: { kind: 'generated_tone', frequency: 300, durationMs: 95, volume: 0.022, type: 'square' },
  guard_break: { kind: 'generated_tone', frequency: 150, durationMs: 150, volume: 0.024, type: 'sawtooth' },
  combat_hit: { kind: 'generated_tone', frequency: 160, durationMs: 110, volume: 0.024, type: 'sawtooth' },
  combat_miss: { kind: 'generated_tone', frequency: 420, durationMs: 90, volume: 0.018, type: 'triangle' },
  enemy_down: { kind: 'generated_tone', frequency: 220, durationMs: 170, volume: 0.024, type: 'triangle' },
  contract_accepted: { kind: 'generated_tone', frequency: 450, durationMs: 90, volume: 0.019, type: 'square' },
  contract_completed: { kind: 'generated_tone', frequency: 780, durationMs: 140, volume: 0.024, type: 'square' },
  xp_gain: { kind: 'generated_tone', frequency: 860, durationMs: 80, volume: 0.015, type: 'triangle' },
  invalid_action: { kind: 'generated_tone', frequency: 150, durationMs: 100, volume: 0.018, type: 'sawtooth' },
  map_transition: { kind: 'generated_tone', frequency: 300, durationMs: 150, volume: 0.02, type: 'triangle' },
};

export class SfxRegistry {
  constructor(private readonly clips: Record<SfxEventId, SfxClipDefinition>) {}

  get(eventId: SfxEventId): SfxClipDefinition {
    return this.clips[eventId];
  }

  getAllIds(): SfxEventId[] {
    return Object.keys(this.clips) as SfxEventId[];
  }
}

export const DEFAULT_SFX_REGISTRY = new SfxRegistry(DEFAULT_SFX_CLIPS);
