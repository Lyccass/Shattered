
import type { AbilitySlotType } from '../../combat/abilities/CombatAbilityDefinitions';

/**
 * Design tokens mirrored from public/ui.css :root block.
 * Update both files together when changing the theme.
 */
export const UI_TOKENS = {
  colors: {
    primary:        '#FFFCC3',
    primaryDim:     '#CECCA0',
    secondary:      '#613C18',
    secondaryDark:  '#3a2209',
    iconDefault:    '#FFFCC3',
    iconActive:     '#E592DC',
    combatActive:   '#FF0000',
    combatInactive: '#CECCA0',
    panelBg:        'rgba(12, 7, 2, 0.93)',
    panelBorder:    '#613C18',
    text:           '#FFFCC3',
    textDim:        '#CECCA0',
    textMuted:      '#7a6840',
    textSystem:     '#a0c4ff',
    textReward:     '#ffd700',
    textCombat:     '#ff6b6b',
    textError:      '#ff4444',
  },
  fonts: {
    primary: "'Asimovian', 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
  },
  icons: {
    equipment: '/assets/Game_icons_test/Equipment.svg',
    inventory:  '/assets/Game_icons_test/Inventory.svg',
    journal:    '/assets/Game_icons_test/Journal.svg',
    map:        '/assets/Game_icons_test/Map.svg',
    settings:   '/assets/Game_icons_test/Sttings.svg',
    combatOn:   '/assets/Game_icons_test/combat_active.svg',
    combatOff:  '/assets/Game_icons_test/combat_inactive.svg',
    skills:     '/assets/Game_icons_test/Skills.svg',
    magic:      '/assets/Game_icons_test/Magic.svg',
    devotion:   '/assets/Game_icons_test/Devotion.svg',
    sprint:     '/assets/Game_icons_test/Run.svg',
  },
  sizes: {
    sidebarWidth: 196,
    panelHeight:  298,
    taskbarHeight: 50,
    chatWidth:    420,
    chatHeight:   120,
    minimapSize:  148,
    inventorySlots: 28,
    inventoryCols:  4,
    inventoryRows:  7,
  },
} as const;

export type TabId = 'equipment' | 'inventory' | 'magic' | 'devotion' | 'skills' | 'journal' | 'map' | 'settings';
export type ChatChannel = 'all' | 'game' | 'combat' | 'system';

export interface ChatMessage {
  text: string;
  channel: 'game' | 'combat' | 'system' | 'reward' | 'error';
  timestamp: number;
}

export interface UIOverlayCallbacks {
  onCombatToggle: () => void;
  onCombatEndTurn: () => void;
  onCombatMoveMode: () => void;
  onCombatAttackMode: (attackId?: string) => void;
  onCombatAbility: (abilityId: string) => void;
  onSprintToggle: () => void;
  onInventoryItemUse: (itemId: string) => void;
  onInventoryItemDrop: (itemId: string) => void;
  onInventoryItemInspect: (itemId: string) => void;
  onInventoryItemCombine: (sourceId: string, targetId: string) => void;
  onEquipmentUnequip: (slot: string) => void;
  onSpellbookEquip: (slotType: AbilitySlotType, slotIndex: number, abilityId: string | null) => void;
  onUtilitySpellUse: (abilityId: string) => void;
  onCompanionEquip: (slot: string, definitionId: string) => void;
  onCompanionUnequip: (slot: string) => void;
  onChoiceMenuSelect: (index: number) => void;
  onChoiceMenuConfirm: () => void;
  onChoiceMenuCancel: () => void;
  onMinimapClick: () => void;
  onMinimapZoom: (delta: number) => void;
  onMapTileQuery: (tileX: number, tileY: number) => { terrain: string | null; walkable: boolean } | null;
  onClearSave: () => void;
}
