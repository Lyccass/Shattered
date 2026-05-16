export type EffectId = 'warm_tea_warmth';

export type EffectDefinition = {
  id: EffectId;
  displayName: string;
  description: string;
  durationMs: number;
};

export type ActiveEffect = {
  id: EffectId;
  displayName: string;
  description: string;
  durationMs: number;
  expiresAtMs: number;
};

export type ActiveEffectSnapshot = {
  id: EffectId;
  displayName: string;
  remainingMs: number;
};
