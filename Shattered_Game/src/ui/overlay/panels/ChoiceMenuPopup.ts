import type { ChoiceMenuStateSnapshot } from '../../../interactions/ChoiceMenuTypes';
import { PopupWindow } from '../PopupWindow';

export class ChoiceMenuPopup {
  private readonly popup: PopupWindow;
  private readonly listEl: HTMLElement;
  private readonly detailsEl: HTMLElement;
  private optionEls: HTMLButtonElement[] = [];

  constructor(
    overlay: HTMLElement,
    private readonly onSelect: (index: number) => void,
    private readonly onConfirm: () => void,
    onCancel: () => void,
  ) {
    const content = document.createElement('div');
    content.className = 'choice-menu';

    this.listEl = document.createElement('div');
    this.listEl.className = 'choice-menu-list';

    this.detailsEl = document.createElement('div');
    this.detailsEl.className = 'choice-menu-details';
    this.detailsEl.setAttribute('aria-live', 'polite');

    const footer = document.createElement('div');
    footer.className = 'choice-menu-footer';
    footer.innerHTML =
      '<kbd>W / S</kbd><span>Navigate</span>' +
      '<kbd>E</kbd><span>Confirm</span>' +
      '<kbd>Esc</kbd><span>Cancel</span>';

    content.appendChild(this.listEl);
    content.appendChild(this.detailsEl);
    content.appendChild(footer);

    this.popup = new PopupWindow(overlay, '', onCancel);
    this.popup.setContent(content);
  }

  update(state: ChoiceMenuStateSnapshot | null): void {
    if (!state) {
      if (this.popup.isOpen()) this.popup.close();
      return;
    }

    this.popup.setTitle(state.title);
    if (!this.popup.isOpen()) this.popup.open();

    this.rebuildList(state);
    this.renderDetails(state);
  }

  isOpen(): boolean {
    return this.popup.isOpen();
  }

  getOptionIndexAt(screenX: number, screenY: number): number | null {
    if (!this.popup.isOpen()) {
      return null;
    }

    const element = document.elementFromPoint(screenX, screenY);
    const optionEl = element?.closest<HTMLButtonElement>('.choice-option');

    if (!optionEl) {
      return null;
    }

    const optionIndex = this.optionEls.indexOf(optionEl);
    return optionIndex >= 0 ? optionIndex : null;
  }

  destroy(): void {
    this.popup.destroy();
  }

  private rebuildList(state: ChoiceMenuStateSnapshot): void {
    const needsRebuild = this.optionEls.length !== state.options.length
      || this.optionEls.some((el, i) => el.dataset.id !== state.options[i]?.id);

    if (needsRebuild) {
      this.listEl.innerHTML = '';
      this.optionEls = state.options.map((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'choice-option';
        btn.dataset.id = opt.id;

        const labelEl = document.createElement('span');
        labelEl.className = 'choice-option-label';
        labelEl.textContent = opt.label;

        btn.appendChild(labelEl);

        if (opt.disabledReason) {
          const badge = document.createElement('span');
          badge.className = 'choice-option-badge choice-option-badge--disabled';
          badge.textContent = opt.disabledReason;
          btn.appendChild(badge);
        }

        btn.addEventListener('mouseenter', () => {
          this.onSelect(index);
        });
        btn.addEventListener('click', () => {
          this.onSelect(index);
          if (!opt.disabledReason) this.onConfirm();
        });

        this.listEl.appendChild(btn);
        return btn;
      });
    } else {
      // Update badges only (disabled state may change)
      state.options.forEach((opt, i) => {
        const btn = this.optionEls[i];
        const existingBadge = btn.querySelector('.choice-option-badge');
        if (opt.disabledReason && !existingBadge) {
          const badge = document.createElement('span');
          badge.className = 'choice-option-badge choice-option-badge--disabled';
          badge.textContent = opt.disabledReason;
          btn.appendChild(badge);
        } else if (!opt.disabledReason && existingBadge) {
          existingBadge.remove();
        }
      });
    }

    // Update selection highlight
    this.optionEls.forEach((btn, i) => {
      btn.classList.toggle('is-selected', i === state.selectedIndex);
      btn.classList.toggle('is-disabled', !!state.options[i]?.disabledReason);
    });
  }

  private renderDetails(state: ChoiceMenuStateSnapshot): void {
    const option = state.options[state.selectedIndex];
    if (!option?.details) {
      this.detailsEl.innerHTML = '';
      this.detailsEl.classList.remove('has-content');
      return;
    }

    this.detailsEl.classList.add('has-content');
    this.detailsEl.innerHTML = '';

    option.details.split('\n').forEach((line) => {
      if (!line.trim()) return;
      const colonIdx = line.indexOf(':');
      const row = document.createElement('div');
      row.className = 'choice-detail-row';

      if (colonIdx > 0) {
        const label = document.createElement('span');
        label.className = 'choice-detail-label';
        label.textContent = line.slice(0, colonIdx).trim();

        const value = document.createElement('span');
        value.className = 'choice-detail-value';
        value.textContent = line.slice(colonIdx + 1).trim();

        row.appendChild(label);
        row.appendChild(value);
      } else {
        row.textContent = line;
      }

      this.detailsEl.appendChild(row);
    });
  }
}
