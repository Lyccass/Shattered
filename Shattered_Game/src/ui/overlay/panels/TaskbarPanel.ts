import type { CurrencySnapshot } from '../../../player/PlayerCurrencyState';
import type { PlayerInventorySnapshot } from '../../../player/PlayerInventoryState';
import type { ReputationSnapshot } from '../../../player/PlayerReputationState';
import type { TaskJournalEntry } from '../../../tasks/TaskJournalTypes';
import { UI_TOKENS, type TabId } from '../UITokens';
import { EquipmentTabContent } from './EquipmentTabContent';
import { InventoryTabContent } from './InventoryTabContent';
import { JournalTabContent } from './JournalTabContent';
import { MapTabContent } from './MapTabContent';
import { SettingsTabContent } from './SettingsTabContent';

interface TabDef {
  id: TabId;
  label: string;
  iconUrl: string;
}

const TABS_TOP: TabDef[] = [
  { id: 'equipment', label: 'Equipment', iconUrl: UI_TOKENS.icons.equipment },
  { id: 'inventory', label: 'Inventory', iconUrl: UI_TOKENS.icons.inventory },
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
  private readonly journalContent: JournalTabContent;
  private readonly mapContent: MapTabContent;
  private readonly settingsContent: SettingsTabContent;

  constructor(
    overlay: HTMLElement,
    private readonly onCombatToggle: () => void,
    private readonly onSprintToggle: () => void,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'ui-sidebar';

    // Panel content area (above taskbar)
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

    // Main tab buttons
    TABS_TOP.forEach(({ id, label, iconUrl }) => {
      const btn = this.createIconBtn(label, iconUrl);
      btn.dataset.tab = id;
      btn.addEventListener('click', () => this.handleTabClick(id));
      this.tabButtons.set(id, btn);
      taskbar.appendChild(btn);
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
    this.inventoryContent = new InventoryTabContent();
    this.equipmentContent = new EquipmentTabContent();
    this.journalContent   = new JournalTabContent();
    this.mapContent       = new MapTabContent();
    this.settingsContent  = new SettingsTabContent();
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
      // Same tab: toggle off (close panel)
      this.activeTab = null;
      this.panelArea.classList.add('ui-hidden');
      this.panelArea.innerHTML = '';
      this.tabButtons.get(tabId)?.classList.remove('is-active');
      return;
    }

    // Deactivate previous
    if (this.activeTab) {
      this.tabButtons.get(this.activeTab)?.classList.remove('is-active');
    }

    this.activeTab = tabId;
    this.tabButtons.get(tabId)?.classList.add('is-active');

    // Swap content
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

  setCombatMode(active: boolean): void {
    this.combatBtn.classList.toggle('combat-on', active);
    this.combatBtn.title = active ? 'Combat: ON' : 'Combat: OFF';
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
  ): void {
    // Always update active content so data is fresh when panel opens
    this.inventoryContent.update(inventory, currency);
    this.journalContent.update(journalEntries, reputation, activeTaskCount);
    this.equipmentContent.update();
    this.mapContent.update();
    this.settingsContent.update();
  }

  destroy(): void {
    this.root.remove();
  }
}
