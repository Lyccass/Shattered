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
    sprint:     '/assets/Game_icons_test/Skills.svg',
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

export type TabId = 'equipment' | 'inventory' | 'journal' | 'map' | 'settings';
export type ChatChannel = 'all' | 'game' | 'combat' | 'system';

export interface ChatMessage {
  text: string;
  channel: 'game' | 'combat' | 'system' | 'reward' | 'error';
  timestamp: number;
}

export interface UIOverlayCallbacks {
  onCombatToggle: () => void;
  onSprintToggle: () => void;
}
