import { describe, expect, it } from 'vitest';
import { ToastQueue } from '../../ui/ToastQueue';
import {
  formatChoiceMenuText,
  formatHudPanelText,
  formatInventoryPanelText,
  formatJournalPanelText,
  formatSkillPanelText,
} from '../../ui/UiFormatters';

describe('UiFormatters', () => {
  it('formats HUD pouch data for player-facing resources and currency', () => {
    const text = formatHudPanelText(
      {
        stacks: { wood: 3, stone: 2, herb: 1, firestarter_set: 1, wooden_marker: 0, camp_supplies: 0, warm_tea: 2 },
      },
      [{ id: 'warm_tea_warmth', displayName: 'Warmth', remainingMs: 59_000 }],
    );

    expect(text).not.toContain('Copper');
    expect(text).not.toContain('Harbor Rep');
    expect(text).not.toContain('Firestarter 1');
    expect(text).toContain('Effects Warmth 59s');
    expect(text).toContain('[I Inventory]');
    expect(text).toContain('[B Place]');
    expect(text).toContain('[T Drink]');
  });

  it('formats the dedicated inventory panel with full pouch contents', () => {
    const text = formatInventoryPanelText(
      {
        stacks: { wood: 3, stone: 2, herb: 1, firestarter_set: 1, wooden_marker: 0, camp_supplies: 0, warm_tea: 2 },
      },
      { copper: 55, silver: 1, gold: 0, platinum: 0 },
    );

    expect(text).toContain('[Inventory]');
    expect(text).toContain('- Wood: 3');
    expect(text).toContain('- Firestarter Set: 1');
    expect(text).toContain('- Warm Tea: 2');
    expect(text).toContain('- Copper: 55');
    expect(text).not.toContain('Harbor reputation');
  });

  it('formats choice menu options with details and disabled reasons', () => {
    const text = formatChoiceMenuText({
      title: 'Workbench Recipes',
      selectedIndex: 0,
      options: [
        {
          id: 'firestarter',
          label: 'Firestarter Set',
          details: 'Need: 1 wood\nMakes: 1 firestarter set\nXP: +10 crafting',
          disabledReason: 'Need 1 wood.',
        },
      ],
    });

    expect(text).toContain('[Workbench Recipes]');
    expect(text).toContain('> Firestarter Set [Need 1 wood.]');
    expect(text).toContain('[Selection]');
    expect(text).toContain('  Need: 1 wood');
    expect(text).toContain('  XP: +10 crafting');
  });

  it('formats journal entries with readiness state', () => {
    const text = formatJournalPanelText([
      {
        id: 'warmth_for_the_dockhands',
        displayName: 'Warmth for the Dockhands',
        requirementSummary: '1 warm tea',
        rewardSummary: '55 copper',
        requirementsMet: true,
      },
    ], { harborReputation: 4 }, 1);

    expect(text).toContain('[Journal]');
    expect(text).toContain('Harbor reputation: 4');
    expect(text).toContain('Active tasks: 1');
    expect(text).toContain('Warmth for the Dockhands');
    expect(text).toContain('Need: 1 warm tea');
    expect(text).toContain('Status: Ready to turn in');
  });

  it('formats skill panel data from XP snapshots', () => {
    const snap = (id: string, displayName: string, xp: number) => ({
      id, displayName, xp, level: 1, rank: 1, stage: 1, xpIntoStage: xp, xpForStage: 50,
    } as import('../../skills/SkillTypes').SkillSnapshot);

    const text = formatSkillPanelText([
      snap('woodworking', 'Woodworking', 15),
      snap('trade',       'Trade',       10),
    ]);

    expect(text).toContain('[Skills]');
    expect(text).toContain('Woodworking   XP 15   Lv 1');
    expect(text).toContain('Trade   XP 10   Lv 1');
  });
});

describe('ToastQueue', () => {
  it('keeps active toasts and expires them over time', () => {
    const queue = new ToastQueue();
    queue.push('Gathered 1 wood.', 'success', 1_000, 1_200);
    queue.push('+5 Gathering XP', 'reward', 1_000, 1_200);

    expect(queue.getEntries()).toHaveLength(2);

    queue.update(1_500);
    expect(queue.getEntries()).toHaveLength(2);

    queue.update(2_300);
    expect(queue.getEntries()).toHaveLength(0);
  });
});
