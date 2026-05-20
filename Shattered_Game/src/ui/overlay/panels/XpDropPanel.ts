const DROP_DURATION_MS = 3500;
const MAX_DROPS = 5;

interface Drop {
  el: HTMLElement;
  bornAt: number;
}

export class XpDropPanel {
  private readonly root: HTMLElement;
  private readonly drops: Drop[] = [];

  constructor(overlay: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'ui-xp-drops';
    overlay.appendChild(this.root);
  }

  push(text: string): void {
    // Remove oldest if at cap
    if (this.drops.length >= MAX_DROPS) {
      const oldest = this.drops.shift();
      oldest?.el.remove();
    }

    const el = document.createElement('div');
    el.className = 'xp-drop';
    el.textContent = text;
    this.root.appendChild(el);

    this.drops.push({ el, bornAt: performance.now() });
  }

  tick(): void {
    const now = performance.now();
    let i = 0;
    while (i < this.drops.length) {
      const drop = this.drops[i];
      const age = now - drop.bornAt;
      if (age >= DROP_DURATION_MS) {
        drop.el.remove();
        this.drops.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  destroy(): void {
    this.root.remove();
  }
}
