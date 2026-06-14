import type { EnemyDefinition } from './EnemyTypes';
import type { TurnDamageType } from './turn/TurnCombatTypes';

const DEFENCE_LABELS: Record<TurnDamageType, string> = {
  slash: 'Slash',
  pierce: 'Pierce',
  crush: 'Crush',
  lightning: 'Lightning',
  fire: 'Fire',
  cold: 'Cold',
  poison: 'Poison',
};

const DEFENCE_KEYS = [
  'slash',
  'pierce',
  'crush',
  'lightning',
  'fire',
  'cold',
  'poison',
] as const satisfies readonly TurnDamageType[];

const PHYSICAL_KEYS = ['slash', 'pierce', 'crush'] as const satisfies readonly TurnDamageType[];

export function formatEnemyIdentifyReadout(
  enemy: EnemyDefinition,
  currentHp: number,
  magicRank: number,
): string {
  const rank = Math.max(1, Math.floor(magicRank));
  const weakest = rank < 4 ? getWeakestFromKeys(enemy, PHYSICAL_KEYS) : getWeakestFromKeys(enemy, DEFENCE_KEYS);
  const lines = [
    `Identify: ${enemy.displayName}`,
    enemy.description ?? 'A hostile creature of the Wake.',
    `Rank ${enemy.tier}. Weakest ${rank < 4 ? 'physical ' : ''}resistance: ${formatDefenceList(weakest)}.`,
  ];

  if (rank >= 4) {
    lines.push(`Health: ${Math.max(0, currentHp)}/${enemy.maxHealth}.`);
    lines.push(`Average landed damage: ${formatAverageDamage(enemy)}.`);
  }

  if (rank >= 7) {
    lines.push(`Armour: ${formatAllDefences(enemy)}.`);
    lines.push(`Weaknesses: ${formatDefenceList(getWeaknessBand(enemy))}.`);
  }

  return lines.join(' ');
}

function getWeakestFromKeys(enemy: EnemyDefinition, keys: readonly TurnDamageType[]): TurnDamageType[] {
  const lowest = Math.min(...keys.map((key) => getDefence(enemy, key)));
  return keys.filter((key) => getDefence(enemy, key) === lowest);
}

function getWeaknessBand(enemy: EnemyDefinition): TurnDamageType[] {
  const lowest = Math.min(...DEFENCE_KEYS.map((key) => getDefence(enemy, key)));
  return DEFENCE_KEYS.filter((key) => getDefence(enemy, key) <= lowest + 2);
}

function getDefence(enemy: EnemyDefinition, damageType: TurnDamageType): number {
  return enemy[`${damageType}Defence`];
}

function formatDefenceList(types: TurnDamageType[]): string {
  return types.map((type) => DEFENCE_LABELS[type]).join(', ');
}

function formatAllDefences(enemy: EnemyDefinition): string {
  return DEFENCE_KEYS
    .map((key) => `${DEFENCE_LABELS[key]} ${getDefence(enemy, key)}`)
    .join(', ');
}

function formatAverageDamage(enemy: EnemyDefinition): string {
  if (enemy.attacks.length === 0) return 'none';
  const average = enemy.attacks.reduce((sum, attack) => sum + ((1 + attack.damage) / 2), 0) / enemy.attacks.length;
  return Number.isInteger(average) ? `${average}` : average.toFixed(1);
}
