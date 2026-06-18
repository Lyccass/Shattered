import type { ActiveEffectSnapshot } from '../effects/EffectTypes';
import type { TurnCombatUiSnapshot } from '../combat/CombatUiTypes';
import type { ChoiceMenuStateSnapshot } from '../interactions/ChoiceMenuTypes';
import type { ActiveInteraction } from '../interactions/InteractionTypes';
import type { PlacementPreviewState } from '../interactions/PlacementModeSystem';
import { getItem } from '../items/ItemRegistry';
import type { ItemCategory } from '../items/ItemTypes';
import type { CurrencySnapshot } from '../player/PlayerCurrencyState';
import type { PlayerInventorySnapshot } from '../player/PlayerInventoryState';
import type { ReputationSnapshot } from '../player/PlayerReputationState';
import type { SkillId, SkillSnapshot, SkillXpDelta } from '../skills/SkillTypes';
import type { TaskJournalEntry } from '../tasks/TaskJournalTypes';

const SKILL_SHORT_NAMES: Record<SkillId, string> = {
  melee:          'Melee',
  ranged:         'Ranged',
  magic:          'Magic',
  devotion:       'Devotion',
  metalworking:   'Metalworking',
  woodworking:    'Woodworking',
  leatherworking: 'Leatherworking',
  alchemy:        'Alchemy',
  trade:          'Trade',
};

export function formatPromptPanelText(
  activeInteraction: ActiveInteraction | null,
  placementState: PlacementPreviewState | null,
): string {
  if (placementState) {
    if (placementState.invalidReason) {
      return `${placementState.promptText}\n${placementState.invalidReason}`;
    }

    return placementState.promptText;
  }

  if (!activeInteraction) {
    return '';
  }

  const actionLabel = activeInteraction.promptText.includes(':')
    ? activeInteraction.promptText.split(':').slice(1).join(':').trim()
    : 'Interact';

  return `Press E: Interact\n${actionLabel} / Inspect`;
}

export function formatHudPanelText(
  inventory: PlayerInventorySnapshot,
  activeEffects: ActiveEffectSnapshot[],
): string {
  const lines: string[] = [];

  if (activeEffects.length > 0) {
    lines.push(
      `Effects ${activeEffects
        .map((effect) => `${effect.displayName} ${Math.ceil(effect.remainingMs / 1000)}s`)
        .join('   ')}`,
    );
  }

  const hints = ['[I Inventory]', '[J Journal]', '[P Skills]'];

  hints.push('[Space Sprint]');

  if ((inventory.stacks['firestarter_set'] ?? 0) > 0) {
    hints.push('[Inventory: Place Firestarter]');
  }

  if ((inventory.stacks['warm_tea'] ?? 0) > 0) {
    hints.push('[Inventory: Drink Tea]');
  }

  lines.push(hints.join('   '));

  return lines.join('\n');
}

const CATEGORY_ORDER: ItemCategory[] = [
  'equipment', 'material', 'consumable', 'tool', 'ammo', 'readable', 'misc',
];

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  equipment:  'Equipment',
  material:   'Materials',
  consumable: 'Consumables',
  tool:       'Tools',
  ammo:       'Ammo',
  readable:   'Books',
  misc:       'Misc',
};

export function formatInventoryPanelText(
  inventory: PlayerInventorySnapshot,
  currency: CurrencySnapshot,
): string {
  const lines = ['[Inventory]'];

  // Group occupied items by category
  const groups = new Map<ItemCategory, Array<{ name: string; count: number; stackable: boolean }>>();
  for (const [id, count] of Object.entries(inventory.stacks)) {
    if (count <= 0) continue;
    const def = getItem(id);
    const category = (def?.category ?? 'misc') as ItemCategory;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push({ name: def?.name ?? id, count, stackable: def?.stackable ?? false });
  }

  let hasItems = false;
  for (const cat of CATEGORY_ORDER) {
    const entries = groups.get(cat);
    if (!entries?.length) continue;
    hasItems = true;
    lines.push('', CATEGORY_LABELS[cat]);
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const { name, count, stackable } of entries) {
      if (stackable) {
        lines.push(`- ${name} ×${count}`);
      } else {
        for (let i = 0; i < count; i++) lines.push(`- ${name}`);
      }
    }
  }

  if (!hasItems) lines.push('', '(empty)');

  lines.push(
    '',
    'Currency',
    `- Copper: ${currency.copper}`,
    `- Silver: ${currency.silver}`,
    `- Gold: ${currency.gold}`,
    `- Platinum: ${currency.platinum}`,
  );

  return lines.join('\n');
}

export function formatChoiceMenuText(state: ChoiceMenuStateSnapshot | null): string {
  if (!state) {
    return '';
  }

  const selectedOption = state.options[state.selectedIndex];
  const lines = [
    `[${state.title}]`,
    '',
    ...state.options.map((option, index) => {
      const prefix = index === state.selectedIndex ? '> ' : '  ';
      const statusSuffix = option.disabledReason ? ` [${option.disabledReason}]` : '';
      return `${prefix}${option.label}${statusSuffix}`;
    }),
    '',
    '[Selection]',
    ...(selectedOption?.details
      ? selectedOption.details.split('\n').map((detailLine) => `  ${detailLine}`)
      : ['  No details.']),
    '',
    '[W/S or Up/Down] Move   [E/Enter] Confirm   [Esc] Cancel',
  ];

  return lines.join('\n');
}

export function formatJournalPanelText(
  entries: TaskJournalEntry[],
  reputation: ReputationSnapshot,
  activeTaskCount: number,
): string {
  const lines = [
    '[Journal]',
    `Harbor reputation: ${reputation.harborReputation}`,
    `Active tasks: ${activeTaskCount}`,
    '',
  ];

  if (entries.length === 0) {
    lines.push('No active tasks.');
    return lines.join('\n');
  }

  entries.forEach((entry) => {
    if (entry.kind === 'quest') {
      lines.push(`- ${entry.displayName}`);
      entry.completedLogs.forEach((log) => {
        lines.push(`  ${log}`);
      });
      if (entry.activeHint) {
        lines.push(`  ${entry.activeHint}`);
      }
      lines.push(`  Reward: ${entry.rewardSummary}`);
      lines.push(`  Status: ${formatQuestStatus(entry.status)}`);
      return;
    }

    lines.push(`- ${entry.displayName}`);
    lines.push(`  Need: ${entry.requirementSummary}`);
    lines.push(`  Reward: ${entry.rewardSummary}`);
    lines.push(`  Status: ${entry.requirementsMet ? 'Ready to turn in' : 'In progress'}`);
  });

  return lines.join('\n');
}

function formatQuestStatus(status: 'active' | 'ready' | 'completed'): string {
  switch (status) {
    case 'active': return 'In progress';
    case 'ready': return 'Ready to continue';
    case 'completed': return 'Done';
  }
}

export function formatSkillPanelText(skills: SkillSnapshot[]): string {
  const lines = ['[Skills]'];

  if (skills.length === 0) {
    lines.push('No tracked skills.');
    return lines.join('\n');
  }

  skills.forEach((skill) => {
    lines.push(`${skill.displayName}   XP ${skill.xp}   Lv ${skill.level}`);
  });

  return lines.join('\n');
}

export function formatSkillXpToastLines(delta: SkillXpDelta | undefined): string[] {
  if (!delta) {
    return [];
  }

  return (Object.entries(delta) as Array<[SkillId, number | undefined]>)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([skillId, amount]) => `+${amount} ${SKILL_SHORT_NAMES[skillId]} XP`);
}

export function formatCombatPanelText(snapshot: TurnCombatUiSnapshot | null): string {
  if (!snapshot?.active) return '';

  const player = snapshot.player;
  const lines = [
    '[Turn Combat]',
    player
      ? `HP ${player.hp}/${player.maxHp}   Main ${player.apRemaining}/${player.apMax}   Sec ${player.secondaryActionRemaining}/${player.secondaryActionMax}   Move ${player.mpRemaining}/${player.mpMax}`
      : 'HP ???',
    `Round ${snapshot.round} — ${snapshot.phase === 'player_turn' ? 'Your turn' : 'Enemy turn'}`,
  ];

  for (const p of snapshot.turnOrder) {
    if (p.kind === 'enemy') {
      lines.push(`${p.name}   HP ${p.hp}/${p.maxHp}${p.isActive ? '  ◀' : ''}`);
    }
  }

  return lines.join('\n');
}
