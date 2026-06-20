export type EditorEnemyCatalogEntry = {
  id: string;
  displayName: string;
};

export const EDITOR_ENEMY_CATALOG: EditorEnemyCatalogEntry[] = [
  { id: 'badger_aggressive', displayName: 'Aggressive Badger' },
  { id: 'badger_passive', displayName: 'Passive Badger' },
  { id: 'boar_aggressive', displayName: 'Aggressive Boar' },
  { id: 'boar_boss', displayName: 'Tuskuss' },
  { id: 'boar_passive', displayName: 'Passive Boar' },
  { id: 'stag_aggressive', displayName: 'Aggressive Stag' },
  { id: 'stag_passive', displayName: 'Passive Stag' },
  { id: 'wolf_aggressive', displayName: 'Aggressive Wolf' },
  { id: 'wolf_passive', displayName: 'Passive Wolf' },
];
