import {
  doesCircleIntersectRotatedRectangle,
  doesEllipseIntersectRotatedRectangle,
  isPointInsideRotatedRectangle,
} from './EnemyAttackMath';
import type { TelegraphShape } from './TelegraphTypes';
import type { PlayerFacingDirection } from '../player/PlayerFacing';

export const PLAYER_LIGHT_ATTACK_LENGTH_WORLD = 28;
export const PLAYER_LIGHT_ATTACK_WIDTH_WORLD = 10;
export const PLAYER_LIGHT_ATTACK_START_OFFSET_WORLD = 10;
const PLAYER_GUARD_HALF_ANGLE_RAD = (130 * Math.PI) / 180 / 2;

export function facingDirectionToRotationRad(facing: PlayerFacingDirection): number {
  switch (facing) {
    case 'up':
      return -Math.PI / 2;
    case 'down':
      return Math.PI / 2;
    case 'left':
      return Math.PI;
    case 'right':
      return 0;
  }
}

export function isAttackerInsideGuardFront(
  playerWorldX: number,
  playerWorldY: number,
  playerFacing: PlayerFacingDirection,
  attackerWorldX: number,
  attackerWorldY: number,
): boolean {
  const facingRad = facingDirectionToRotationRad(playerFacing);
  const attackerRad = Math.atan2(attackerWorldY - playerWorldY, attackerWorldX - playerWorldX);
  const delta = normalizeAngle(attackerRad - facingRad);
  return Math.abs(delta) <= PLAYER_GUARD_HALF_ANGLE_RAD;
}

export function isEnemyInsidePlayerLightAttack(
  playerWorldX: number,
  playerWorldY: number,
  playerFacing: PlayerFacingDirection,
  enemyWorldX: number,
  enemyWorldY: number,
): boolean {
  const hitbox = getPlayerLightAttackHitbox(playerWorldX, playerWorldY, playerFacing);

  return isPointInsideRotatedRectangle(
    enemyWorldX,
    enemyWorldY,
    hitbox.worldX,
    hitbox.worldY,
    hitbox.width,
    hitbox.height,
    hitbox.rotationRad,
  );
}

export function isEnemyInsidePlayerLightAttackByRotation(
  playerWorldX: number,
  playerWorldY: number,
  rotationRad: number,
  enemyWorldX: number,
  enemyWorldY: number,
): boolean {
  const hitbox = getPlayerLightAttackHitboxByRotation(playerWorldX, playerWorldY, rotationRad);

  return isPointInsideRotatedRectangle(
    enemyWorldX,
    enemyWorldY,
    hitbox.worldX,
    hitbox.worldY,
    hitbox.width,
    hitbox.height,
    hitbox.rotationRad,
  );
}

export function doesEnemyHitCircleIntersectPlayerLightAttackByRotation(
  playerWorldX: number,
  playerWorldY: number,
  rotationRad: number,
  enemyWorldX: number,
  enemyWorldY: number,
  enemyHitRadius: number,
): boolean {
  const hitbox = getPlayerLightAttackHitboxByRotation(playerWorldX, playerWorldY, rotationRad);

  return doesCircleIntersectRotatedRectangle(
    enemyWorldX,
    enemyWorldY,
    enemyHitRadius,
    hitbox.worldX,
    hitbox.worldY,
    hitbox.width,
    hitbox.height,
    hitbox.rotationRad,
  );
}

export function doesEnemyHitEllipseIntersectPlayerLightAttackByRotation(
  playerWorldX: number,
  playerWorldY: number,
  rotationRad: number,
  enemyHitEllipse: { centerX: number; centerY: number; radiusX: number; radiusY: number },
): boolean {
  const hitbox = getPlayerLightAttackHitboxByRotation(playerWorldX, playerWorldY, rotationRad);

  return doesEllipseIntersectRotatedRectangle(
    enemyHitEllipse.centerX,
    enemyHitEllipse.centerY,
    enemyHitEllipse.radiusX,
    enemyHitEllipse.radiusY,
    hitbox.worldX,
    hitbox.worldY,
    hitbox.width,
    hitbox.height,
    hitbox.rotationRad,
  );
}

export function getPlayerLightAttackHitbox(
  playerWorldX: number,
  playerWorldY: number,
  playerFacing: PlayerFacingDirection,
): {
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  rotationRad: number;
  shape: TelegraphShape;
} {
  const rotationRad = facingDirectionToRotationRad(playerFacing);
  return getPlayerLightAttackHitboxByRotation(playerWorldX, playerWorldY, rotationRad);
}

export function getPlayerLightAttackHitboxByRotation(
  playerWorldX: number,
  playerWorldY: number,
  rotationRad: number,
): {
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  rotationRad: number;
  shape: TelegraphShape;
} {
  const centerOffset = PLAYER_LIGHT_ATTACK_START_OFFSET_WORLD + PLAYER_LIGHT_ATTACK_LENGTH_WORLD / 2;
  const worldX = playerWorldX + Math.cos(rotationRad) * centerOffset;
  const worldY = playerWorldY + Math.sin(rotationRad) * centerOffset;

  return {
    worldX,
    worldY,
    width: PLAYER_LIGHT_ATTACK_LENGTH_WORLD,
    height: PLAYER_LIGHT_ATTACK_WIDTH_WORLD,
    rotationRad,
    shape: {
      kind: 'rectangle',
      width: PLAYER_LIGHT_ATTACK_LENGTH_WORLD,
      height: PLAYER_LIGHT_ATTACK_WIDTH_WORLD,
      rotationRad,
    },
  };
}

export function getPlayerLightAttackSlash(
  playerWorldX: number,
  playerWorldY: number,
  playerFacing: PlayerFacingDirection,
): {
  worldX: number;
  worldY: number;
  shape: TelegraphShape;
} {
  const hitbox = getPlayerLightAttackHitbox(playerWorldX, playerWorldY, playerFacing);
  return getPlayerLightAttackSlashByRotation(hitbox.worldX, hitbox.worldY, hitbox.rotationRad);
}

export function getPlayerLightAttackSlashByRotation(
  worldX: number,
  worldY: number,
  rotationRad: number,
): {
  worldX: number;
  worldY: number;
  shape: TelegraphShape;
} {
  return {
    worldX,
    worldY,
    shape: {
      kind: 'line',
      length: PLAYER_LIGHT_ATTACK_LENGTH_WORLD,
      thickness: 6,
      rotationRad,
    },
  };
}

export function resolvePlayerAttackAimRad(
  playerWorldX: number,
  playerWorldY: number,
  fallbackFacing: PlayerFacingDirection,
  targetWorldX: number | null,
  targetWorldY: number | null,
): number {
  if (targetWorldX === null || targetWorldY === null) {
    return facingDirectionToRotationRad(fallbackFacing);
  }

  const dx = targetWorldX - playerWorldX;
  const dy = targetWorldY - playerWorldY;

  if (Math.hypot(dx, dy) <= 4) {
    return facingDirectionToRotationRad(fallbackFacing);
  }

  return Math.atan2(dy, dx);
}

function normalizeAngle(angleRad: number): number {
  let normalized = angleRad;

  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }

  while (normalized < -Math.PI) {
    normalized += Math.PI * 2;
  }

  return normalized;
}
