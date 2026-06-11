import type { AbilitySlotType } from '../../../combat/abilities/CombatAbilityDefinitions';
import type { SpellbookAbilityOptionSnapshot, SpellbookSnapshot } from '../../../player/PlayerSpellbookState';

const DEVOTION_ICONS: Record<string, string> = {
  devotion_mend: 'ME',
  devotion_ward: 'WA',
};

export class DevotionTabContent {
  readonly el: HTMLElement;
  private snapshot: SpellbookSnapshot | null = null;

  constructor(
    private readonly onSpellbookEquip: (slotType: AbilitySlotType, slotIndex: number, abilityId: string | null) => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'devotion-book-tab';
  }

  update(snapshot: SpellbookSnapshot): void {
    this.snapshot = snapshot;
    this.render();
  }

  private render(): void {
    if (!this.snapshot) return;
    this.el.innerHTML = '';

    const page = document.createElement('div');
    page.className = 'spellbook-page spellbook-page--devotion';

    const title = document.createElement('div');
    title.className = 'spellbook-title';
    title.textContent = 'Devotion';
    page.appendChild(title);

    page.appendChild(this.buildGrid(this.snapshot.options.filter((option) => option.slotType === 'devotion')));
    this.el.appendChild(page);
  }

  private buildGrid(options: SpellbookAbilityOptionSnapshot[]): HTMLElement {
    const section = document.createElement('div');
    section.className = 'spellbook-grid-section';

    const label = document.createElement('div');
    label.className = 'spellbook-book-label';
    label.textContent = 'Devotion Book';
    section.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'spellbook-icon-grid devotion-icon-grid';
    for (const option of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = [
        'spellbook-icon-btn',
        'devotion-icon-btn',
        option.unlocked ? 'is-unlocked' : 'is-locked',
        option.equipped ? 'is-equipped' : '',
      ].filter(Boolean).join(' ');
      button.disabled = !option.unlocked;
      button.title = option.unlocked
        ? option.equipped
          ? `${option.displayName} - click to clear`
          : `${option.displayName} - click to equip`
        : `${option.displayName} - requires Devotion level ${option.levelRequired}`;
      button.innerHTML = `
        <span class="spellbook-rune-icon">${iconFor(option.id)}</span>
        <span class="spellbook-rune-name">${option.displayName}</span>
        <span class="spellbook-rune-meta">${option.equipped ? 'Set' : option.unlocked ? '' : `Lv ${option.levelRequired}`}</span>
      `;
      button.addEventListener('click', () => this.equip(option.id));
      grid.appendChild(button);
    }
    section.appendChild(grid);
    return section;
  }

  private equip(abilityId: string): void {
    if (!this.snapshot) return;
    const existingSlot = this.snapshot.devotionSlots.find((slot) => slot.abilityId === abilityId);
    if (existingSlot) {
      this.onSpellbookEquip('devotion', existingSlot.slotIndex, null);
      return;
    }
    const slotIndex = this.snapshot.devotionSlots.find((slot) => !slot.abilityId)?.slotIndex ?? 0;
    this.onSpellbookEquip('devotion', slotIndex, abilityId);
  }
}

function iconFor(abilityId: string): string {
  return DEVOTION_ICONS[abilityId] ?? '?';
}
