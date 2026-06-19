import type { ChatChannel, ChatMessage } from '../UITokens';
import { requireElement } from '../../domUtils';

const MAX_MESSAGES = 200;

export class ChatPanel {
  private readonly root: HTMLElement;
  private readonly logEl: HTMLElement;
  private readonly messages: ChatMessage[] = [];
  private activeChannel: ChatChannel = 'all';

  constructor(overlay: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'ui-chat';

    this.root.innerHTML = `
      <div class="chat-log"></div>
      <div class="chat-tabs-row">
        <button class="chat-toggle" title="Toggle log">Hide</button>
        <button class="chat-tab is-active" data-channel="all">All</button>
        <button class="chat-tab" data-channel="game">Game</button>
        <button class="chat-tab" data-channel="combat">Combat</button>
        <button class="chat-tab" data-channel="system">System</button>
        <button class="chat-tab chat-tab--report">Report</button>
      </div>
    `;

    this.logEl = requireElement(this.root, '.chat-log');
    this.bindTabs();

    overlay.appendChild(this.root);
  }

  push(text: string, channel: ChatMessage['channel'] = 'game'): void {
    const msg: ChatMessage = { text, channel, timestamp: Date.now() };
    this.messages.push(msg);

    if (this.messages.length > MAX_MESSAGES) {
      this.messages.shift();
    }

    if (this.shouldShow(msg)) {
      this.appendLine(msg);
    }
  }

  private shouldShow(msg: ChatMessage): boolean {
    if (this.activeChannel === 'all') return true;
    if (this.activeChannel === 'game' && (msg.channel === 'game' || msg.channel === 'reward')) return true;
    if (this.activeChannel === 'combat' && msg.channel === 'combat') return true;
    if (this.activeChannel === 'system' && msg.channel === 'system') return true;
    return false;
  }

  private appendLine(msg: ChatMessage): void {
    const p = document.createElement('p');
    p.className = `chat-line chat-line--${msg.channel}`;
    p.textContent = msg.text;
    this.logEl.appendChild(p);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  private rebuildLog(): void {
    this.logEl.innerHTML = '';
    const visible = this.messages.filter((m) => this.shouldShow(m));
    visible.forEach((m) => this.appendLine(m));
  }

  private bindTabs(): void {
    const toggle = this.root.querySelector<HTMLButtonElement>('.chat-toggle');
    toggle?.addEventListener('click', () => {
      this.root.classList.toggle('is-collapsed');
      toggle.textContent = this.root.classList.contains('is-collapsed') ? 'Log' : 'Hide';
    });

    const tabs = this.root.querySelectorAll<HTMLButtonElement>('.chat-tab[data-channel]');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.activeChannel = tab.dataset.channel as ChatChannel;
        tabs.forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        this.rebuildLog();
      });
    });
  }

  destroy(): void {
    this.root.remove();
  }
}
