import type { ReputationSnapshot } from '../../../player/PlayerReputationState';
import type { TaskJournalEntry } from '../../../tasks/TaskJournalTypes';

export class JournalTabContent {
  readonly el: HTMLElement;
  private readonly statsRow: HTMLElement;
  private readonly entriesContainer: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'journal-tab';

    this.statsRow = document.createElement('div');
    this.statsRow.className = 'journal-stat-row journal-body';

    this.entriesContainer = document.createElement('div');
    this.entriesContainer.className = 'journal-entries journal-body';

    this.el.appendChild(this.statsRow);
    this.el.appendChild(this.entriesContainer);
  }

  update(
    entries: TaskJournalEntry[],
    reputation: ReputationSnapshot,
    activeTaskCount: number,
  ): void {
    this.statsRow.innerHTML = `
      <span>Reputation <strong class="journal-stat-highlight">${reputation.harborReputation}</strong></span>
      <span>Tasks <strong class="journal-stat-highlight">${activeTaskCount}</strong></span>
    `;

    this.entriesContainer.innerHTML = '';

    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'journal-empty';
      empty.textContent = 'No active tasks.';
      this.entriesContainer.appendChild(empty);
      return;
    }

    entries.forEach((entry) => {
      const div = document.createElement('div');
      div.className = 'journal-entry';

      if (entry.kind === 'quest') {
        div.classList.toggle('is-completed', entry.status === 'completed');
        div.innerHTML = `
          <div class="journal-entry-name">${entry.displayName}</div>
          ${entry.completedLogs.map((log) => `<div class="journal-entry-line">${log}</div>`).join('')}
          ${entry.activeHint ? `<div class="journal-entry-line">${entry.activeHint}</div>` : ''}
          <div class="journal-entry-line">Reward: ${entry.rewardSummary}</div>
          <div class="journal-entry-status ${entry.status === 'ready' ? 'ready' : 'in-progress'}">
            ${entry.status === 'completed' ? '✓ Done' : entry.status === 'ready' ? '✓ Ready to continue' : '· In progress'}
          </div>
        `;
        this.entriesContainer.appendChild(div);
        return;
      }

      const ready = entry.requirementsMet;
      div.innerHTML = `
        <div class="journal-entry-name">${entry.displayName}</div>
        <div class="journal-entry-line">Need: ${entry.requirementSummary}</div>
        <div class="journal-entry-line">Reward: ${entry.rewardSummary}</div>
        <div class="journal-entry-status ${ready ? 'ready' : 'in-progress'}">
          ${ready ? '✓ Ready to turn in' : '· In progress'}
        </div>
      `;
      this.entriesContainer.appendChild(div);
    });
  }
}
