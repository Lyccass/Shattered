import type { EquipmentSnapshot } from '../../../equipment/EquipmentTypes';
import type { CurrencySnapshot } from '../../../player/PlayerCurrencyState';
import type { PlayerInventorySnapshot } from '../../../player/PlayerInventoryState';
import type { ReputationSnapshot } from '../../../player/PlayerReputationState';
import type { SkillSnapshot } from '../../../skills/SkillTypes';
import type { TaskJournalEntry } from '../../../tasks/TaskJournalTypes';
import type { MinimapSnapshot } from '../../UiTypes';
import { UI_TOKENS, type TabId } from '../UITokens';
import { EquipmentTabContent } from './EquipmentTabContent';
import { InventoryTabContent } from './InventoryTabContent';
import { JournalTabContent } from './JournalTabContent';
import { MapTabContent } from './MapTabContent';
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
  private readonly tabButtons: Map<TabId, HTMLElement> = new Map();
  private readonly combatBtn: HTMLElement;
  private readonly sprintBtn: HTMLElement;

  private activeTab: TabId | null = null;

  private readonly inventoryContent: InventoryTabContent;
  private readonly equipmentContent: EquipmentTabContent;
  private readonly skillsContent: SkillsTabContent;
  private readonly journalContent: JournalTabContent;
  private readonly mapContent: MapTabContent;
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
    private readonly onSkillOpen: (skill: SkillSnapshot) => void,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'ui-sidebar';

    this.panelArea = document.createElement('div');
    this.panelArea.className = 'ui-panel-area ui-hidden';

    // Taskbar icon row
    const taskbar = document.createElement('div');
    taskbar.className = 'ui-taskbar';

    // Combat toggle button FIRST (top of list)
    this.combatBtn = this.createIconBtn('Combat', UI_TOKENS.icons.combatOff);
    this.combatBtn.classList.add('taskbar-btn--combat');
    this.combatBtn.addEventListener('click', () => { this.onCombatToggle(); });
    taskbar.appendChild(this.combatBtn);

    // Sprint toggle button (second)
    this.sprintBtn = this.createIconBtn('Sprint', UI_TOKENS.icons.sprint);
    this.sprintBtn.classList.add('taskbar-btn--sprint');
    this.sprintBtn.addEventListener('click', () => { this.onSprintToggle(); });
    taskbar.appendChild(this.sprintBtn);

    // Divider: combat controls / panel tabs
    taskbar.appendChild(this.createDivider());

    // Main tab buttons — insert dividers to isolate the skills tab
    TABS_TOP.forEach(({ id, label, iconUrl }) => {
      if (id === 'skills') taskbar.appendChild(this.createDivider());
      const btn = this.createIconBtn(label, iconUrl);
      btn.dataset.tab = id;
      btn.addEventListener('click', () => this.handleTabClick(id));
      this.tabButtons.set(id, btn);
      taskbar.appendChild(btn);
      if (id === 'skills') taskbar.appendChild(this.createDivider());
    });

    // Spacer pushes Settings to the bottom
    const spacer = document.createElement('div');
    spacer.className = 'taskbar-spacer';
    taskbar.appendChild(spacer);

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
    overlay.appendChild(this.root);

    // Build tab content instances
    this.inventoryContent = new InventoryTabContent({
      onItemUse:     this.onInventoryItemUse,
      onItemDrop:    this.onInventoryItemDrop,
      onItemInspect: this.onInventoryItemInspect,
      onItemCombine: this.onInventoryItemCombine,
    });
    this.equipmentContent = new EquipmentTabContent(this.onEquipmentUnequip);
    this.skillsContent    = new SkillsTabContent(this.onSkillOpen);
    this.journalContent   = new JournalTabContent();
    this.mapContent       = new MapTabContent();
    this.settingsContent  = new SettingsTabContent();
  }

  private createDivider(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'taskbar-divider';
    return el;
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
    if (this.activeTab === tabId) {
      this.activeTab = null;
      this.panelArea.classList.add('ui-hidden');
      this.panelArea.innerHTML = '';
      this.tabButtons.get(tabId)?.classList.remove('is-active');
      return;
    }

    if (this.activeTab) {
      this.tabButtons.get(this.activeTab)?.classList.remove('is-active');
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
      case 'skills':     return this.skillsContent.el;
      case 'journal':    return this.journalContent.el;
      case 'map':        return this.mapContent.el;
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
    minimap: MinimapSnapshot | null = null,
  ): void {
    this.inventoryContent.update(inventory, currency);
    this.skillsContent.update(skills);
    this.journalContent.update(journalEntries, reputation, activeTaskCount);
    this.equipmentContent.update(equipment);
    this.mapContent.update(minimap);
    this.settingsContent.update();
  }

  destroy(): void {
    this.root.remove();
  }
}
