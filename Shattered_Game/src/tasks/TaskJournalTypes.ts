export type ContractJournalEntry = {
  id: string;
  kind?: 'contract';
  displayName: string;
  requirementSummary: string;
  rewardSummary: string;
  requirementsMet: boolean;
};

export type QuestJournalEntry = {
  id: string;
  kind: 'quest';
  displayName: string;
  status: 'active' | 'ready' | 'completed';
  completedLogs: string[];
  activeHint?: string;
  rewardSummary: string;
};

export type TaskJournalEntry = ContractJournalEntry | QuestJournalEntry;
