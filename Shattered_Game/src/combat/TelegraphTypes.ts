export type TelegraphShape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rectangle'; width: number; height: number; rotationRad?: number }
  | { kind: 'line'; length: number; thickness: number; rotationRad?: number }
  | { kind: 'polygon'; points: Array<{ x: number; y: number }> };

export type TelegraphDefinition = {
  id: string;
  worldX: number;
  worldY: number;
  shape: TelegraphShape;
  durationMs: number;
  startedAtMs: number;
  warningColor?: number;
  fadeOutMs?: number;
};

export type TelegraphSnapshot = TelegraphDefinition & {
  remainingMs: number;
  alpha: number;
};
