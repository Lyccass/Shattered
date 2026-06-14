import { describe, expect, it } from 'vitest';
import { WOLF_AGGRESSIVE } from './enemies/wolf_aggressive';
import { formatEnemyIdentifyReadout } from './IdentifyReadout';

describe('formatEnemyIdentifyReadout', () => {
  it('shows a rough rank 1 readout', () => {
    const readout = formatEnemyIdentifyReadout(WOLF_AGGRESSIVE, 5, 1);

    expect(readout).toContain('Identify: Wolf');
    expect(readout).toContain('Rank 1');
    expect(readout).toContain('Weakest resistance: Fire.');
    expect(readout).not.toContain('Health:');
    expect(readout).not.toContain('Armour:');
  });

  it('adds health and average damage at magic rank 4', () => {
    const readout = formatEnemyIdentifyReadout(WOLF_AGGRESSIVE, 3, 4);

    expect(readout).toContain('Health: 3/5.');
    expect(readout).toContain('Average landed damage: 1.8.');
    expect(readout).not.toContain('Armour:');
  });

  it('adds full armour and weakness band at magic rank 7', () => {
    const readout = formatEnemyIdentifyReadout(WOLF_AGGRESSIVE, 3, 7);

    expect(readout).toContain('Armour: Slash 9, Pierce 10, Crush 8, Lightning 12, Fire 3, Cold 7, Poison 6.');
    expect(readout).toContain('Weaknesses: Fire.');
  });
});
