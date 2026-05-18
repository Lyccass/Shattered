import type { PlayerItemKey } from '../player/PlayerInventoryState';

// Modes determine which key bindings are active each frame.
// GameScene computes the active mode from WorldRuntimeCoordinator state
// and calls InputSystem.setMode() before update runs.
export type InputMode = 'normal' | 'menu' | 'placement' | 'action_progress' | 'combat';

// Callbacks injected at construction time. Each represents one user action
// that GameScene/coordinator knows how to handle. No Phaser types here.
export type InputCallbacks = {
  // Normal-mode interactions
  onInteract: () => void;
  onStartPlacement: () => void;
  onUseItem: (itemId: PlayerItemKey) => void;
  onCancelAction: () => void;
  onCombatDodge: () => void;
  onToggleSprint: () => void;

  // Menu mode
  onMenuMoveUp: () => void;
  onMenuMoveDown: () => void;
  onMenuConfirm: () => void;
  onMenuCancel: () => void;

  // Placement mode
  onPlacementConfirm: () => void;
  onPlacementCancel: () => void;

  // Toggle panels (available in all non-combat modes)
  onToggleInventory: () => void;
  onToggleJournal: () => void;
  onToggleSkills: () => void;

  // Local persistence controls
  onSaveNow: () => void;
  onLoadSave: () => void;
  onClearSave: () => void;

  // Debug (always active)
  onDebugCycleZoom: () => void;
  onDebugToggleGrid: () => void;
  onDebugToggleChunk: () => void;
  onDebugToggleObjects: () => void;
  onDebugLogPlacement: () => void;
};
