import { buildAttackTargetTiles } from './EnemyAttackTiles';
import { buildConeTelegraphPolygon } from './EnemyAttackMath';
import {
  angleTo,
  degreesToRadians,
  tilesToWorldRange,
  tilesToWorldX,
  tilesToWorldY,
} from './EnemyStateMath';
import type { EnemyUpdateContext } from './EnemyStateMachineTypes';
import type { TelegraphShape } from './TelegraphTypes';
import type { EnemyAttackDefinition, EnemyRuntimeState } from './EnemyTypes';

export type AttackTelegraphResult = {
  worldX: number;
  worldY: number;
  rotationRad: number;
  shape: TelegraphShape;
  tiles: Array<{ x: number; y: number }>;
};

export function buildAttackTelegraph(
  state: EnemyRuntimeState,
  attack: EnemyAttackDefinition,
  context: EnemyUpdateContext,
): AttackTelegraphResult {
  const attackRotation = angleTo(state.worldX, state.worldY, context.playerWorldX, context.playerWorldY);

  switch (attack.telegraph.kind) {
    case 'circle': {
      const worldX = context.playerWorldX;
      const worldY = context.playerWorldY;
      const rotationRad = attackRotation;
      const radius = tilesToWorldX(attack.telegraph.radiusTiles, context.tileWidth);
      return {
        worldX,
        worldY,
        rotationRad,
        shape: { kind: 'circle', radius },
        tiles: buildAttackTargetTiles(
          attack,
          { ...state, attackTargetWorldX: worldX, attackTargetWorldY: worldY, attackRotationRad: rotationRad },
          context,
        ),
      };
    }

    case 'ellipse': {
      const worldX = context.playerWorldX;
      const worldY = context.playerWorldY;
      const rotationRad = attackRotation;
      return {
        worldX,
        worldY,
        rotationRad,
        shape: {
          kind: 'ellipse',
          radiusX: tilesToWorldX(attack.telegraph.radiusXTiles, context.tileWidth),
          radiusY: tilesToWorldY(attack.telegraph.radiusYTiles, context.tileHeight),
        },
        tiles: buildAttackTargetTiles(
          attack,
          { ...state, attackTargetWorldX: worldX, attackTargetWorldY: worldY, attackRotationRad: rotationRad },
          context,
        ),
      };
    }

    case 'cone': {
      const rangeWorld = tilesToWorldRange(attack.telegraph.rangeTiles, context.tileWidth, context.tileHeight);
      const minRangeWorld = attack.telegraph.minRangeTiles
        ? tilesToWorldRange(attack.telegraph.minRangeTiles, context.tileWidth, context.tileHeight)
        : 0;
      const angleRad = degreesToRadians(attack.telegraph.angleDeg);
      const worldX = state.worldX;
      const worldY = state.worldY;
      const rotationRad = attackRotation;
      return {
        worldX,
        worldY,
        rotationRad,
        shape: buildConeTelegraphPolygon(rangeWorld, angleRad, attackRotation, 8, minRangeWorld),
        tiles: buildAttackTargetTiles(
          attack,
          { ...state, attackTargetWorldX: worldX, attackTargetWorldY: worldY, attackRotationRad: rotationRad },
          context,
        ),
      };
    }

    case 'rectangle': {
      const lengthWorld = tilesToWorldX(attack.telegraph.lengthTiles, context.tileWidth);
      const widthWorld = tilesToWorldY(attack.telegraph.widthTiles, context.tileHeight);
      const minOffsetWorld = attack.telegraph.minOffsetTiles
        ? tilesToWorldX(attack.telegraph.minOffsetTiles, context.tileWidth)
        : 0;
      const centerOffset = minOffsetWorld + lengthWorld / 2;
      const worldX = state.worldX + Math.cos(attackRotation) * centerOffset;
      const worldY = state.worldY + Math.sin(attackRotation) * centerOffset;
      const rotationRad = attackRotation;
      return {
        worldX,
        worldY,
        rotationRad,
        shape: {
          kind: 'rectangle',
          width: lengthWorld,
          height: widthWorld,
          rotationRad: attackRotation,
        },
        tiles: buildAttackTargetTiles(
          attack,
          { ...state, attackTargetWorldX: worldX, attackTargetWorldY: worldY, attackRotationRad: rotationRad },
          context,
        ),
      };
    }

    case 'line': {
      const lengthWorld = tilesToWorldX(attack.telegraph.lengthTiles, context.tileWidth);
      const thickness = tilesToWorldY(attack.telegraph.widthTiles, context.tileHeight);
      const minOffsetWorld = attack.telegraph.minOffsetTiles
        ? tilesToWorldX(attack.telegraph.minOffsetTiles, context.tileWidth)
        : 0;
      const centerOffset = minOffsetWorld + lengthWorld / 2;
      const worldX = state.worldX + Math.cos(attackRotation) * centerOffset;
      const worldY = state.worldY + Math.sin(attackRotation) * centerOffset;
      const rotationRad = attackRotation;
      return {
        worldX,
        worldY,
        rotationRad,
        shape: { kind: 'line', length: lengthWorld, thickness, rotationRad: attackRotation },
        tiles: buildAttackTargetTiles(
          attack,
          { ...state, attackTargetWorldX: worldX, attackTargetWorldY: worldY, attackRotationRad: rotationRad },
          context,
        ),
      };
    }
  }
}
