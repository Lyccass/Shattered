import type { AbilitySlotType } from '../../../combat/abilities/CombatAbilityDefinitions';
import type { SpellbookAbilityOptionSnapshot, SpellbookSnapshot } from '../../../player/PlayerSpellbookState';

const SPELL_ICONS: Record<string, string> = {
  spell_spark: 'SP',
  spell_barrier: 'BR',
  utility_identify: 'ID',
  utility_homeward_mark: 'HM',
  utility_waystep: 'WS',
  utility_camp_recall: 'CR',
};

export class MagicTabContent {
  readonly el: HTMLElement;
  private snapshot: SpellbookSnapshot | null = null;

  constructor(
    private readonly onSpellbookEquip: (slotType: AbilitySlotType, slotIndex: number, abilityId: string | null) => void,
    private readonly onUtilitySpellUse: (abilityId: string) => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'magic-book-tab';
  }

  update(snapshot: SpellbookSnapshot): void {
    this.snapshot = snapshot;
    this.render();
  }

  private render(): void {
    if (!this.snapshot) return;
    this.el.innerHTML = '';

    const page = document.createElement('div');
    page.className = 'spellbook-page spellbook-page--magic';

    const title = document.createElement('div');
    title.className = 'spellbook-title';
    title.textContent = 'Magic';
    page.appendChild(title);

    const combatOptions = this.snapshot.options.filter((option) => option.slotType === 'combat_spell');
    const utilityOptions = this.snapshot.options.filter((option) => option.slotType === 'utility_spell');
    page.appendChild(this.buildSpellGrid('Combat Spells', combatOptions, 'combat_spell'));
    page.appendChild(this.buildSpellGrid('Utility Spells', utilityOptions, 'utility_spell'));

    this.el.appendChild(page);
  }

  private buildSpellGrid(title: string, options: SpellbookAbilityOptionSnapshot[], slotType: AbilitySlotType): HTMLElement {
    const section = document.createElement('div');
    section.className = 'spellbook-grid-section';

    const label = document.createElement('div');
    label.className = 'spellbook-book-label';
    label.textContent = title;
    section.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'spellbook-icon-grid';

    for (const option of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = [
        'spellbook-icon-btn',
        option.unlocked ? 'is-unlocked' : 'is-locked',
        option.equipped ? 'is-equipped' : '',
      ].filter(Boolean).join(' ');
      button.disabled = !option.unlocked;
      button.title = option.unlocked
        ? option.equipped
          ? slotType === 'utility_spell'
            ? `${option.displayName} - click to use${formatUtilityCost(option)}`
            : `${option.displayName} - click to clear`
          : `${option.displayName} - click to equip${formatUtilityCost(option)}`
        : `${option.displayName} - requires Magic level ${option.levelRequired}`;
      button.innerHTML = `
        <span class="spellbook-rune-icon">${iconFor(option.id)}</span>
        <span class="spellbook-rune-name">${option.displayName}</span>
        <span class="spellbook-rune-meta">${formatMeta(option)}</span>
      `;
      button.addEventListener('click', () => this.toggle(option.id, slotType));
      grid.appendChild(button);
    }

    section.appendChild(grid);
    return section;
  }

  private toggle(abilityId: string, slotType: AbilitySlotType): void {
    if (!this.snapshot) return;
    const existingSlot = this.findEquippedSlot(abilityId, slotType);
    if (existingSlot !== null) {
      if (slotType === 'utility_spell') {
        this.onUtilitySpellUse(abilityId);
        return;
      }
      this.onSpellbookEquip(slotType, existingSlot, null);
      return;
    }
    const slotIndex = this.findFirstOpenSlot(slotType);
    this.onSpellbookEquip(slotType, slotIndex, abilityId);
  }

  private findFirstOpenSlot(slotType: AbilitySlotType): number {
    if (!this.snapshot) return 0;
    const slots = slotType === 'combat_spell'
      ? this.snapshot.combatSlots
      : this.snapshot.utilitySlots;
    return slots.find((slot) => !slot.abilityId)?.slotIndex ?? 0;
  }

  private findEquippedSlot(abilityId: string, slotType: AbilitySlotType): number | null {
    if (!this.snapshot) return null;
    const slots = slotType === 'combat_spell'
      ? this.snapshot.combatSlots
      : this.snapshot.utilitySlots;
    return slots.find((slot) => slot.abilityId === abilityId)?.slotIndex ?? null;
  }

}

function iconFor(abilityId: string): string {
  return SPELL_ICONS[abilityId] ?? '?';
}

function formatMeta(option: SpellbookAbilityOptionSnapshot): string {
  if (!option.unlocked) return `Lv ${option.levelRequired}`;
  if (option.equipped) return 'Set';
  if (option.slotType === 'utility_spell') return formatUtilityCost(option).trim();
  return '';
}

function formatUtilityCost(option: SpellbookAbilityOptionSnapshot): string {
  if (option.slotType !== 'utility_spell') return '';
  const cost = option.utilityMagicCost ?? 0;
  return cost > 0 ? ` ${cost} MP` : ' Free';
}
