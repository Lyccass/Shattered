import type { EquipmentSnapshot } from '../../../equipment/EquipmentTypes';
import type { CompanionSnapshot } from '../../../companions/CompanionTypes';
import type { CurrencySnapshot } from '../../../player/PlayerCurrencyState';
import type { PlayerInventorySnapshot } from '../../../player/PlayerInventoryState';
import type { ReputationSnapshot } from '../../../player/PlayerReputationState';
import type { SpellbookSnapshot } from '../../../player/PlayerSpellbookState';
import type { SkillSnapshot } from '../../../skills/SkillTypes';
import type { TaskJournalEntry } from '../../../tasks/TaskJournalTypes';
import type { AbilitySlotType } from '../../../combat/abilities/CombatAbilityDefinitions';
import type { AudioMixerSettings } from '../../../audio/AudioTypes';
import type { SfxEventId } from '../../../audio/SfxTypes';
import { UI_TOKENS, type TabId } from '../UITokens';
import { EquipmentTabContent } from './EquipmentTabContent';
import { DevotionTabContent } from './DevotionTabContent';
import { InventoryTabContent } from './InventoryTabContent';
import { JournalTabContent } from './JournalTabContent';
import { MagicTabContent } from './MagicTabContent';
import { SettingsTabContent } from './SettingsTabContent';
import { SkillsTabContent } from './SkillsTabContent';

interface TabDef {
  id: TabId;
  label: string;
  iconUrl: string;
}

const TABS_TOP: TabDef[] = [
  { id: 'equipment', label: 'Equipment', iconUrl: UI_TOKENS.icons.equipment },
  { id: 'inventory', label: 'Inventory', iconUrl: UI_TOKENS.icons.inventory },
  { id: 'magic',     label: 'Magic',     iconUrl: UI_TOKENS.icons.magic },
  { id: 'devotion',  label: 'Devotion',  iconUrl: UI_TOKENS.icons.devotion },
  { id: 'skills',    label: 'Skills',    iconUrl: UI_TOKENS.icons.skills },
  { id: 'journal',   label: 'Journal',   iconUrl: UI_TOKENS.icons.journal },
  { id: 'map',       label: 'Map',       iconUrl: UI_TOKENS.icons.map },
];

const TABS_BOTTOM: TabDef[] = [
  { id: 'settings',  label: 'Settings',  iconUrl: UI_TOKENS.icons.settings },
];

export class TaskbarPanel {
  private readonly root: HTMLElement;
  private readonly panelArea: HTMLElement;
  private readonly utilityBar: HTMLElement;
  private readonly tabButtons: Map<TabId, HTMLElement> = new Map();
  private readonly combatBtn: HTMLElement;
  private readonly sprintBtn: HTMLElement;

  private activeTab: TabId | null = null;

  private readonly inventoryContent: InventoryTabContent;
  private readonly equipmentContent: EquipmentTabContent;
  private readonly magicContent: MagicTabContent;
  private readonly devotionContent: DevotionTabContent;
  private readonly skillsContent: SkillsTabContent;
  private readonly journalContent: JournalTabContent;
  private readonly settingsContent: SettingsTabContent;

  constructor(
    overlay: HTMLElement,
    private readonly onCombatToggle: () => void,
    private readonly onSprintToggle: () => void,
    private readonly onInventoryItemUse: (itemId: string) => void,
    private readonly onInventoryItemDrop: (itemId: string) => void,
    private readonly onInventoryItemInspect: (itemId: string) => void,
    private readonly onInventoryItemCombine: (sourceId: string, targetId: string) => void,
    private readonly onEquipmentUnequip: (slot: string) => void,
    private readonly onSpellbookEquip: (slotType: AbilitySlotType, slotIndex: number, abilityId: string | null) => void,
    private readonly onUtilitySpellUse: (abilityId: string) => void,
    private readonly onCompanionEquip: (slot: string, definitionId: string) => void,
    private readonly onCompanionUnequip: (slot: string) => void,
    private readonly onSkillOpen: (skill: SkillSnapshot) => void,
    private readonly onMapOpen: () => void,
    private readonly onClearSave: () => void,
    private readonly onUiSfx: (id: SfxEventId) => void,
    private readonly getAudioSettings: () => AudioMixerSettings,
    private readonly onAudioSettingsChange: (settings: Partial<AudioMixerSettings>) => void,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'ui-sidebar';

    this.panelArea = document.createElement('div');
    this.panelArea.className = 'ui-panel-area ui-hidden';

    this.utilityBar = document.createElement('div');
    this.utilityBar.id = 'ui-utility-bar';
    this.utilityBar.className = 'ui-hidden';

    // Taskbar icon row
    const taskbar = document.createElement('div');
    taskbar.className = 'ui-taskbar';

    // Combat toggle button FIRST (top of list)
    this.combatBtn = this.createIconBtn('Combat', UI_TOKENS.icons.combatOff);
    this.combatBtn.classList.add('taskbar-btn--combat');
    this.combatBtn.addEventListener('click', () => {
      this.onUiSfx('ui_button');
      this.onCombatToggle();
    });
    taskbar.appendChild(this.combatBtn);

    // Sprint toggle button (second)
    this.sprintBtn = this.createIconBtn('Sprint', UI_TOKENS.icons.sprint);
    this.sprintBtn.classList.add('taskbar-btn--sprint');
    this.sprintBtn.addEventListener('click', () => {
      this.onUiSfx('ui_button');
      this.onSprintToggle();
    });
    taskbar.appendChild(this.sprintBtn);

    // Main tab buttons
    TABS_TOP.forEach(({ id, label, iconUrl }) => {
      const btn = this.createIconBtn(label, iconUrl);
      btn.dataset.tab = id;
      btn.addEventListener('click', () => this.handleTabClick(id));
      this.tabButtons.set(id, btn);
      taskbar.appendChild(btn);
    });

    // Settings LAST (bottom)
    TABS_BOTTOM.forEach(({ id, label, iconUrl }) => {
      const btn = this.createIconBtn(label, iconUrl);
      btn.dataset.tab = id;
      btn.addEventListener('click', () => this.handleTabClick(id));
      this.tabButtons.set(id, btn);
      taskbar.appendChild(btn);
    });

    this.root.appendChild(this.panelArea);
    this.root.appendChild(taskbar);
    overlay.appendChild(this.utilityBar);
    overlay.appendChild(this.root);

    // Build tab content instances
    this.inventoryContent = new InventoryTabContent({
      onItemUse:     this.onInventoryItemUse,
      onItemDrop:    this.onInventoryItemDrop,
      onItemInspect: this.onInventoryItemInspect,
      onItemCombine: this.onInventoryItemCombine,
    });
    this.equipmentContent = new EquipmentTabContent(
      this.onEquipmentUnequip,
      this.onCompanionEquip,
      this.onCompanionUnequip,
    );
    this.magicContent     = new MagicTabContent(this.onSpellbookEquip, this.onUtilitySpellUse);
    this.devotionContent  = new DevotionTabContent(this.onSpellbookEquip);
    this.skillsContent    = new SkillsTabContent(this.onSkillOpen);
    this.journalContent   = new JournalTabContent();
    this.settingsContent  = new SettingsTabContent(
      this.onClearSave,
      this.onUiSfx,
      this.getAudioSettings,
      this.onAudioSettingsChange,
    );
  }

  private createIconBtn(label: string, iconUrl: string): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'taskbar-btn';
    btn.title = label;

    const icon = document.createElement('span');
    icon.className = 'taskbar-icon';
    icon.style.setProperty('--icon-url', `url('${iconUrl}')`);

    btn.appendChild(icon);
    return btn;
  }

  private handleTabClick(tabId: TabId): void {
    // Map opens the floating MapWindow — not a sidebar panel.
    if (tabId === 'map') {
      this.onUiSfx('menu_open');
      this.onMapOpen();
      return;
    }

    if (this.activeTab === tabId) {
      this.onUiSfx('ui_tab_close');
      this.activeTab = null;
      this.panelArea.classList.add('ui-hidden');
      this.panelArea.innerHTML = '';
      this.tabButtons.get(tabId)?.classList.remove('is-active');
      return;
    }

    if (this.activeTab) {
      this.tabButtons.get(this.activeTab)?.classList.remove('is-active');
      this.onUiSfx('menu_select');
    } else {
      this.onUiSfx('ui_tab_open');
    }

    this.activeTab = tabId;
    this.tabButtons.get(tabId)?.classList.add('is-active');

    this.panelArea.innerHTML = '';
    this.panelArea.classList.remove('ui-hidden');

    const contentEl = this.getContentEl(tabId);
    if (contentEl) {
      this.panelArea.appendChild(contentEl);
    }
  }

  private getContentEl(tabId: TabId): HTMLElement | null {
    switch (tabId) {
      case 'inventory':  return this.inventoryContent.el;
      case 'equipment':  return this.equipmentContent.el;
      case 'magic':      return this.magicContent.el;
      case 'devotion':   return this.devotionContent.el;
      case 'skills':     return this.skillsContent.el;
      case 'journal':    return this.journalContent.el;
      case 'settings':   return this.settingsContent.el;
      default:           return null;
    }
  }

  /** Open a specific tab programmatically (keyboard shortcut etc.) */
  openTab(tabId: TabId): void {
    if (this.activeTab !== tabId) {
      this.handleTabClick(tabId);
    }
  }

  /** Close the panel area (keeping no tab active). */
  closePanel(): void {
    if (this.activeTab) {
      this.handleTabClick(this.activeTab);
    }
  }

  /** Returns whether the given tab is currently open. */
  isTabOpen(tabId: TabId): boolean {
    return this.activeTab === tabId;
  }

  setCombatMode(mode: 'passive' | 'armed' | 'engaged'): void {
    this.combatBtn.classList.toggle('combat-armed', mode === 'armed');
    this.combatBtn.classList.toggle('combat-engaged', mode === 'engaged');
    this.combatBtn.title = mode === 'engaged'
      ? 'Combat: Engaged'
      : mode === 'armed'
        ? 'Combat Mode: ON'
        : 'Combat: Passive';
  }

  setSprintMode(active: boolean): void {
    this.sprintBtn.classList.toggle('sprint-on', active);
    this.sprintBtn.title = active ? 'Sprint: ON' : 'Sprint: OFF';
  }

  update(
    inventory: PlayerInventorySnapshot,
    currency: CurrencySnapshot,
    journalEntries: TaskJournalEntry[],
    reputation: ReputationSnapshot,
    activeTaskCount: number,
    skills: SkillSnapshot[],
    equipment: EquipmentSnapshot,
    companions: CompanionSnapshot,
    spellbook: SpellbookSnapshot,
    controlMode: 'explore' | 'combat',
  ): void {
    this.inventoryContent.update(inventory, currency);
    this.skillsContent.update(skills);
    this.journalContent.update(journalEntries, reputation, activeTaskCount);
    this.equipmentContent.update(equipment, companions);
    this.magicContent.update(spellbook);
    this.devotionContent.update(spellbook);
    this.settingsContent.update();
    this.updateUtilityBar(spellbook, controlMode);
  }

  setUtilityTargetingMode(active: boolean): void {
    this.utilityBar.classList.toggle('is-targeting', active);
  }

  destroy(): void {
    this.utilityBar.remove();
    this.root.remove();
  }

  private updateUtilityBar(spellbook: SpellbookSnapshot, controlMode: 'explore' | 'combat'): void {
    this.utilityBar.innerHTML = '';

    if (controlMode === 'combat') {
      this.utilityBar.classList.add('ui-hidden');
      return;
    }

    const options = new Map(spellbook.options.map((option) => [option.id, option]));
    const prepared = spellbook.utilitySlots
      .map((slot) => slot.abilityId ? options.get(slot.abilityId) : null)
      .filter((option): option is NonNullable<typeof option> => !!option);

    if (prepared.length === 0) {
      this.utilityBar.classList.add('ui-hidden');
      return;
    }

    this.utilityBar.classList.remove('ui-hidden');
    for (const option of prepared) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'utility-bar-btn';
      const costLabel = formatUtilityCost(option);
      button.title = costLabel ? `${option.displayName} (${costLabel})` : option.displayName;
      button.innerHTML = `
        <span class="utility-bar-name">${option.displayName}</span>
        <span class="utility-bar-cost">${costLabel}</span>
      `;
      // Use pointerdown instead of click: buttons are recreated every frame via innerHTML='',
      // so a click that spans more than one frame (>16ms) has its target destroyed before
      // mouseup fires — meaning click never reaches this element. pointerdown fires on press,
      // before the next frame can recreate the DOM.
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.onUiSfx('ui_button');
        this.onUtilitySpellUse(option.id);
      });
      this.utilityBar.appendChild(button);
    }
  }
}

function formatUtilityCost(option: { utilityMagicCost?: number }): string {
  const cost = option.utilityMagicCost ?? 0;
  return cost > 0 ? `${cost} MP` : 'Free';
}
