/** Generic reusable popup window rendered inside the HTML UI overlay. */
export class PopupWindow {
  private readonly backdrop: HTMLElement;
  private readonly el: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly body: HTMLElement;
  private _isOpen = false;

  constructor(
    private readonly overlay: HTMLElement,
    title: string,
    private readonly onClose?: () => void,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'ui-popup-backdrop';
    this.backdrop.addEventListener('click', () => this.close());

    this.el = document.createElement('div');
    this.el.className = 'ui-popup';

    const header = document.createElement('div');
    header.className = 'ui-popup-header';

    this.titleEl = document.createElement('span');
    this.titleEl.className = 'ui-popup-title';
    this.titleEl.textContent = title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ui-popup-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(this.titleEl);
    header.appendChild(closeBtn);

    this.body = document.createElement('div');
    this.body.className = 'ui-popup-body';

    this.el.appendChild(header);
    this.el.appendChild(this.body);
  }

  setTitle(title: string): void {
    this.titleEl.textContent = title;
  }

  /** Replace the popup body content. Can be called while open or closed. */
  setContent(contentEl: HTMLElement): void {
    this.body.innerHTML = '';
    this.body.appendChild(contentEl);
  }

  /** Add a BEM modifier class to the popup root (e.g. 'ui-popup--skill'). */
  addModifier(cls: string): void {
    this.el.classList.add(cls);
  }

  open(contentEl?: HTMLElement): void {
    if (contentEl) this.setContent(contentEl);
    if (this._isOpen) return;
    this._isOpen = true;
    this.overlay.appendChild(this.backdrop);
    this.overlay.appendChild(this.el);
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.backdrop.remove();
    this.el.remove();
    this.onClose?.();
  }

  toggle(contentEl?: HTMLElement): void {
    this._isOpen ? this.close() : this.open(contentEl);
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  destroy(): void {
    this.close();
  }
}
