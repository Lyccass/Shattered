export type ContextMenuOption = {
  label: string;
  action: () => void;
  danger?: boolean;
};

export class ItemContextMenu {
  readonly el: HTMLElement;
  private outsideHandler: (() => void) | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'item-context-menu ui-hidden';
    const overlay = document.getElementById('ui-overlay');
    (overlay ?? document.body).appendChild(this.el);

    // Prevent right-click inside the menu from bubbling
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  show(clientX: number, clientY: number, options: ContextMenuOption[]): void {
    this.clearOutsideHandler();

    this.el.innerHTML = '';
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'item-ctx-btn' + (opt.danger ? ' item-ctx-btn--danger' : '');
      btn.textContent = opt.label;
      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        opt.action();
        this.hide();
      });
      this.el.appendChild(btn);
    }

    // Clamp to viewport
    this.el.classList.remove('ui-hidden');
    const menuW = 148;
    const menuH = options.length * 34 + 8;
    const x = Math.min(clientX, window.innerWidth - menuW - 6);
    const y = Math.min(clientY, window.innerHeight - menuH - 6);
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;

    setTimeout(() => {
      this.outsideHandler = () => this.hide();
      document.addEventListener('mousedown', this.outsideHandler, { once: true });
    }, 0);
  }

  hide(): void {
    this.el.classList.add('ui-hidden');
    this.clearOutsideHandler();
  }

  destroy(): void {
    this.hide();
    this.el.remove();
  }

  private clearOutsideHandler(): void {
    if (this.outsideHandler) {
      document.removeEventListener('mousedown', this.outsideHandler);
      this.outsideHandler = null;
    }
  }
}
