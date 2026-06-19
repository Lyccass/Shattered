export type ChoiceMenuOption = {
  id: string;
  label: string;
  details?: string;
  disabledReason?: string;
};

export type ChoiceMenuStateSnapshot = {
  title: string;
  promptText?: string;
  options: ChoiceMenuOption[];
  selectedIndex: number;
};
