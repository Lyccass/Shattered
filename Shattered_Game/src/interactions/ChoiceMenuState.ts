import type { ChoiceMenuOption, ChoiceMenuStateSnapshot } from './ChoiceMenuTypes';

export class ChoiceMenuState {
  private title = '';
  private options: ChoiceMenuOption[] = [];
  private selectedIndex = 0;

  open(title: string, options: ChoiceMenuOption[]): ChoiceMenuStateSnapshot | null {
    this.title = title;
    this.options = [...options];
    this.selectedIndex = this.getFirstSelectableIndex();
    return this.getSnapshot();
  }

  isOpen(): boolean {
    return this.options.length > 0;
  }

  moveSelection(delta: number): ChoiceMenuStateSnapshot | null {
    if (!this.isOpen()) {
      return null;
    }

    const optionCount = this.options.length;

    for (let step = 0; step < optionCount; step += 1) {
      const nextIndex = (this.selectedIndex + delta + optionCount) % optionCount;
      this.selectedIndex = nextIndex;

      if (!this.options[nextIndex]?.disabledReason) {
        break;
      }
    }

    return this.getSnapshot();
  }

  getSelectedOption(): ChoiceMenuOption | null {
    if (!this.isOpen()) {
      return null;
    }

    return this.options[this.selectedIndex] ?? null;
  }

  confirmSelection(): ChoiceMenuOption | null {
    const selectedOption = this.getSelectedOption();

    if (!selectedOption || selectedOption.disabledReason) {
      return null;
    }

    return selectedOption;
  }

  cancel(): void {
    this.title = '';
    this.options = [];
    this.selectedIndex = 0;
  }

  getSnapshot(): ChoiceMenuStateSnapshot | null {
    if (!this.isOpen()) {
      return null;
    }

    return {
      title: this.title,
      options: [...this.options],
      selectedIndex: this.selectedIndex,
    };
  }

  private getFirstSelectableIndex(): number {
    const firstEnabledIndex = this.options.findIndex((option) => !option.disabledReason);
    return firstEnabledIndex >= 0 ? firstEnabledIndex : 0;
  }
}
