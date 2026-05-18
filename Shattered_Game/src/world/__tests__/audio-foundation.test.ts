import { describe, expect, it } from 'vitest';
import { GeneratedToneBackend } from '../../audio/GeneratedToneBackend';
import { DEFAULT_SFX_REGISTRY } from '../../audio/SfxRegistry';
import type { SfxEventId } from '../../audio/SfxTypes';

describe('SfxRegistry', () => {
  it('contains generated clip definitions for every known SFX id', () => {
    const expectedIds: SfxEventId[] = [
      'menu_open',
      'menu_select',
      'menu_confirm',
      'menu_cancel',
      'gather_start',
      'gather_success',
      'craft_start',
      'craft_success',
      'craft_failed',
      'action_cancelled',
      'item_placed',
      'fire_lit',
      'tea_brewed',
      'tea_consumed',
      'dodge',
      'player_attack',
      'guard_block',
      'guard_break',
      'combat_hit',
      'combat_miss',
      'enemy_down',
      'contract_accepted',
      'contract_completed',
      'xp_gain',
      'invalid_action',
      'map_transition',
    ];

    expect(DEFAULT_SFX_REGISTRY.getAllIds()).toEqual(expectedIds);

    expectedIds.forEach((id) => {
      const definition = DEFAULT_SFX_REGISTRY.get(id);
      expect(definition.kind).toBe('generated_tone');
      expect(definition.durationMs).toBeGreaterThan(0);
      expect(definition.volume).toBeGreaterThan(0);
    });
  });
});

describe('GeneratedToneBackend', () => {
  it('supports generated tone clip definitions', () => {
    const backend = new GeneratedToneBackend();

    expect(
      backend.supports({
        kind: 'generated_tone',
        frequency: 440,
        durationMs: 80,
        volume: 0.02,
        type: 'triangle',
      }),
    ).toBe(true);
  });
});
