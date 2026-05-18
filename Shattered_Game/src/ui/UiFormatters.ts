import type { ActiveEffectSnapshot } from '../effects/EffectTypes';
import type { CombatUiSnapshot } from '../combat/CombatUiTypes';
import type { ChoiceMenuStateSnapshot } from '../interactions/ChoiceMenuTypes';
import type { ActiveInteraction } from '../interactions/InteractionTypes';
import type { PlacementPreviewState } from '../interactions/PlacementModeSystem';
import type { CurrencySnapshot } from '../player/PlayerCurrencyState';
import type { PlayerInventorySnapshot } from '../player/PlayerInventoryState';
import type { ReputationSnapshot } from '../player/PlayerReputationState';
import type { SkillId, SkillSnapshot, SkillXpDelta } from '../skills/SkillTypes';
import type { TaskJournalEntry } from '../tasks/TaskJournalTypes';

const SKILL_SHORT_NAMES: Record<SkillId, string> = {
  gathering: 'Gathering',
  crafting: 'Crafting',
  survival: 'Survival',
  trade: 'Trade',
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

  return activeInteraction?.promptText ?? '';
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

  hints.push('[Shift Sprint]', '[Space Dodge]');

  if (inventory.items.firestarter_set > 0) {
    hints.push('[B Place]');
  }

  if (inventory.items.warm_tea > 0) {
    hints.push('[T Drink]');
  }

  lines.push(hints.join('   '));

  return lines.join('\n');
}

export function formatInventoryPanelText(
  inventory: PlayerInventorySnapshot,
  currency: CurrencySnapshot,
): string {
  const lines = [
    '[Inventory]',
    '',
    'Resources',
    `- Wood: ${inventory.resources.wood}`,
    `- Stone: ${inventory.resources.stone}`,
    `- Herb: ${inventory.resources.herb}`,
    '',
    'Items',
    `- Firestarter Set: ${inventory.items.firestarter_set}`,
    `- Warm Tea: ${inventory.items.warm_tea}`,
    `- Wooden Marker: ${inventory.items.wooden_marker}`,
    `- Camp Supplies: ${inventory.items.camp_supplies}`,
    '',
    'Currency',
    `- Copper: ${currency.copper}`,
    `- Silver: ${currency.silver}`,
    `- Gold: ${currency.gold}`,
    `- Platinum: ${currency.platinum}`,
  ];

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
    lines.push(`- ${entry.displayName}`);
    lines.push(`  Need: ${entry.requirementSummary}`);
    lines.push(`  Reward: ${entry.rewardSummary}`);
    lines.push(`  Status: ${entry.requirementsMet ? 'Ready to turn in' : 'In progress'}`);
  });

  return lines.join('\n');
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

export function formatCombatPanelText(snapshot: CombatUiSnapshot | null): string {
  if (!snapshot) {
    return '';
  }

  const statusParts = [snapshot.player.isSprinting ? 'Sprint on' : 'Sprint off'];

  if (snapshot.player.isGuardBroken) {
    statusParts.push('Guard broken');
  } else if (snapshot.player.isGuarding) {
    statusParts.push('Guard up');
  }

  if (snapshot.player.isDowned) {
    statusParts.push('Downed');
  }

  const lines = [
    '[Stats]',
    `HP ${snapshot.player.currentHp}/${snapshot.player.maxHp}`,
    `Stamina ${snapshot.player.stamina}/${snapshot.player.maxStamina}   ${statusParts.join('   ')}`,
    `Combat ${snapshot.active ? 'active' : 'idle'}`,
  ];

  if (snapshot.active) {
    const enemyLine = snapshot.enemy
      ? `Enemy ${snapshot.enemy.name}   State ${snapshot.enemy.state}${snapshot.enemy.activeAttackName ? `   Attack ${snapshot.enemy.activeAttackName}` : ''}`
      : 'Enemy none';
    if (snapshot.enemy) {
      lines.push(`Enemy HP ${snapshot.enemy.health}/${snapshot.enemy.maxHealth}`);
    }
    lines.push(enemyLine);
  }

  return lines.join('\n');
}
