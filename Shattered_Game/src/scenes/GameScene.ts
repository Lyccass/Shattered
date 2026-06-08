import Phaser from 'phaser';
import { SfxSystem } from '../audio/SfxSystem';
import { CameraSystem } from '../camera/CameraSystem';
import { createEnemyAnimations, preloadEnemyAssets } from '../combat/EnemyAssets';
import { TurnCombatSession } from '../combat/turn/TurnCombatSession';
import { DebugOverlaySystem } from '../debug/DebugOverlaySystem';
import { GameEventBus } from '../events/GameEventBus';
import { GameInteractionController } from '../game/input/GameInteractionController';
import { GameSaveController } from '../game/persistence/GameSaveController';
import { InputSystem } from '../input/InputSystem';
import type { InputCallbacks, InputMode } from '../input/InputTypes';
import { preloadObjectAssets } from '../objects/ObjectAssets';
import { RENDER_DEPTHS } from '../render/RenderLayers';
import {
  createPlayerAnimations,
  PLAYER_TEXTURE_KEY,
  preloadPlayerAssets,
} from '../player/PlayerAssets';
import { PLAYER_CONFIG } from '../player/PlayerConfig';
import { PlayerController } from '../player/PlayerController';
import { UiManager } from '../ui/UiManager';
import { emptyUiStateSnapshot, type MinimapSnapshot } from '../ui/UiTypes';
import type { LoadedMapRuntime } from '../world/maps/MapRuntime';
import { getPublishedEditorMapId } from '../world/maps/MapDefinitions';
import {
  type DeferredInteractionAction,
  WorldRuntimeCoordinator,
} from '../world/maps/WorldRuntimeCoordinator';
import { createTerrainRenderTextures, preloadTerrainAssets } from '../world/TerrainAssets';
import type { InteractionResult } from '../interactions/InteractionTypes';
import { GroundItemSystem } from '../world/items/GroundItemSystem';
import { ENEMY_DEFINITIONS } from '../combat/EnemyDefinitions';
import { STARTING_WEAPON_IDS } from '../items/definitions/equipment/weapons';
import { WorldEncounterPopulationTracker } from '../combat/WorldEncounterPopulationTracker';

export class GameScene extends Phaser.Scene {
  private readonly gameEventBus = new GameEventBus();
  private player?: Phaser.GameObjects.Sprite;
  private playerController?: PlayerController;
  private cameraSystem?: CameraSystem;
  private turnCombatSession?: TurnCombatSession;
  private debugOverlaySystem?: DebugOverlaySystem;
  private uiManager?: UiManager;
  private interactionController?: GameInteractionController;
  private saveController?: GameSaveController;
  private sfxSystem?: SfxSystem;
  private worldRuntimeCoordinator?: WorldRuntimeCoordinator;
  private inputSystem?: InputSystem;
  private groundItemSystem?: GroundItemSystem;
  private tileHighlight?: Phaser.GameObjects.Graphics;
  private isSprinting = false;
  private isCombatStance = false;
  private hasShutdown = false;
  private mapLoadSerial = 0;
  private isRespawningAfterDeath = false;
  private readonly encounterPopulation = new WorldEncounterPopulationTracker();

  constructor() {
    super('GameScene');
  }

  preload(): void {
    preloadPlayerAssets(this);
    preloadEnemyAssets(this);
    preloadTerrainAssets(this);
    preloadObjectAssets(this);
  }

  create(): void {
    createTerrainRenderTextures(this);
    createPlayerAnimations(this);
    createEnemyAnimations(this);

    this.sfxSystem = new SfxSystem(this, this.gameEventBus);
    this.groundItemSystem = new GroundItemSystem(this);

    this.turnCombatSession = new TurnCombatSession(this, this.gameEventBus);
    this.turnCombatSession.onEnd((evt) => {
      if (evt.reason === 'player_died') {
        this.handlePlayerDied();
      }
    });
    this.turnCombatSession.onXp((delta) =>
      this.worldRuntimeCoordinator?.addCombatXp(delta) ?? [],
    );
    this.turnCombatSession.onEnemyKilled(
      (spawnId, areaId, definitionId, worldX, worldY) =>
        this.handleEnemyKilledForLoot(spawnId, areaId, definitionId, worldX, worldY),
    );

    this.worldRuntimeCoordinator = new WorldRuntimeCoordinator(this, this.gameEventBus);
    this.worldRuntimeCoordinator.setGroundItemCollector(
      (id) => this.groundItemSystem?.collectDrop(id) ?? null,
    );
    const publishedEditorMapId = getPublishedEditorMapId();
    const worldManifestUrl = getWorldManifestUrl()
      ?? (publishedEditorMapId ? null : '/data/worlds/the_wake/world.manifest.json');
    if (worldManifestUrl) {
      this.initializeWorldManifestRuntime(worldManifestUrl, getRequestedSpawnId());
    } else {
      const initialMapId = publishedEditorMapId ?? 'test_home_island';
      this.initializeWorldRuntime(initialMapId, 'default');
    }
    this.uiManager = new UiManager(this, {
      onCombatToggle:         () => this.toggleCombatStance(),
      onCombatEndTurn:        () => this.turnCombatSession?.tryPlayerEndTurn(),
      onCombatAttackMode:     (attackId) => this.turnCombatSession?.toggleAttackMode(attackId),
      onCombatGuard:          () => this.turnCombatSession?.tryPlayerGuard(),
      onCombatCleanse:        () => this.turnCombatSession?.tryPlayerCleanse(),
      onSprintToggle:         () => this.tryToggleSprint(),
      onInventoryItemUse:     (itemId) => this.tryUseItem(itemId),
      onInventoryItemDrop:    (itemId) => this.tryDropItem(itemId),
      onInventoryItemInspect: (itemId) => this.tryInspectItem(itemId),
      onInventoryItemCombine: (sourceId, targetId) => this.tryCombineItems(sourceId, targetId),
      onEquipmentUnequip:     (slot) => {
        const result = this.worldRuntimeCoordinator?.unequipSlot(slot as import('../equipment/EquipmentTypes').EquipmentSlot);
        if (result) this.uiManager?.handleResult(result);
      },
      onChoiceMenuSelect:     (i) => this.worldRuntimeCoordinator?.setChoiceMenuSelection(i),
      onChoiceMenuConfirm:    () => this.tryConfirmChoiceMenu(),
      onChoiceMenuCancel:     () => {
        const msg = this.worldRuntimeCoordinator?.cancelChoiceMenu();
        if (msg) this.uiManager?.showInfo(msg);
      },
      onMinimapClick: () => {
        const snap = this.buildMinimapSnapshot();
        this.uiManager?.toggleMapWindow(snap?.playerTileX ?? 0, snap?.playerTileY ?? 0);
      },
      onMapTileQuery: (tileX, tileY) => {
        const iso = this.worldRuntimeCoordinator?.getIsoTilemap();
        if (!iso) return null;
        return {
          terrain:  iso.getTerrainFamilyAtTile(tileX, tileY),
          walkable: iso.isTileWalkable(tileX, tileY),
        };
      },
    });
    this.saveController = new GameSaveController(this);
    this.interactionController = new GameInteractionController(this, {
      getWorldRuntimeCoordinator: () => this.worldRuntimeCoordinator,
      getPlayerController: () => this.playerController,
      getUiManager: () => this.uiManager,
      getControlMode: () => this.turnCombatSession?.isInCombat() ? 'combat' : 'explore',
      handleGameplayResult: (result, options) => this.handleGameplayResult(result, options),
    });
    this.tileHighlight = this.add.graphics();
    this.tileHighlight.setDepth(RENDER_DEPTHS.GRID + 1);

    this.inputSystem = new InputSystem(this, this.buildInputCallbacks());
    this.input.mouse?.disableContextMenu();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleShutdown, this);
    this.tryAutoLoadSave();
  }

  update(_time: number, delta: number): void {
    this.inputSystem?.setMode(this.computeInputMode());

    // Always run player controller — click-move must process even during combat turns.
    this.playerController?.update(delta, this.time.now);

    this.groundItemSystem?.tick(this.time.now);
    this.refreshGroundItemTargets();

    if (this.turnCombatSession && this.worldRuntimeCoordinator?.hasActiveRuntime()) {
      const derived = this.worldRuntimeCoordinator.getDerivedStats();
      this.turnCombatSession.setDerivedStats(derived);
    }

    this.turnCombatSession?.update(this.time.now);

    const uiResults = this.worldRuntimeCoordinator?.updatePlayerRuntimeState(delta) ?? [];
    this.interactionController?.resolvePendingPointerInteraction();
    uiResults.forEach((result) => this.handleGameplayResult(result, { allowAutosave: true }));

    this.worldRuntimeCoordinator?.getObjectOcclusionSystem()?.update(delta);
    const isInCombat = this.turnCombatSession?.isInCombat() ?? false;
    this.uiManager?.update(
      this.worldRuntimeCoordinator?.getUiState() ?? emptyUiStateSnapshot(),
      this.turnCombatSession?.getUiSnapshot() ?? null,
      isInCombat ? 'combat' : 'explore',
      this.isCombatStance,
      this.buildMinimapSnapshot(),
    );
    this.updateTileHighlight();
    this.debugOverlaySystem?.update();
  }

  private updateTileHighlight(): void {
    const g = this.tileHighlight;
    if (!g) return;
    g.clear();

    const tiles = this.worldRuntimeCoordinator?.getActiveInteractionTiles();
    const transform = this.worldRuntimeCoordinator?.getIsoTransform();
    if (!tiles || !transform) return;

    g.lineStyle(2, 0xe8a045, 0.90);
    g.fillStyle(0xe8a045, 0.15);
    tiles.forEach(({ x, y }) => {
      const pts = transform.getTileDiamondPoints(x, y);
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
    });
  }

  private computeInputMode(): InputMode {
    if (this.worldRuntimeCoordinator?.isChoiceMenuOpen()) return 'menu';
    if (this.worldRuntimeCoordinator?.isPlacementModeActive()) return 'placement';
    if (this.worldRuntimeCoordinator?.isActionInProgress()) return 'action_progress';
    return (this.turnCombatSession?.isInCombat() ?? false) ? 'combat' : 'normal';
  }

  private handleShutdown(): void {
    if (this.hasShutdown) {
      return;
    }

    this.hasShutdown = true;
    this.inputSystem?.destroy();
    this.inputSystem = undefined;
    this.debugOverlaySystem?.destroy();
    this.debugOverlaySystem = undefined;
    this.tileHighlight?.destroy();
    this.tileHighlight = undefined;
    this.turnCombatSession?.destroy();
    this.turnCombatSession = undefined;
    this.groundItemSystem?.destroy();
    this.groundItemSystem = undefined;
    this.uiManager?.destroy();
    this.uiManager = undefined;
    this.interactionController = undefined;
    this.saveController = undefined;
    this.sfxSystem?.destroy();
    this.sfxSystem = undefined;
    this.worldRuntimeCoordinator?.destroy();
    this.worldRuntimeCoordinator = undefined;
    this.cameraSystem?.destroy();
    this.cameraSystem = undefined;
  }

  private buildInputCallbacks(): InputCallbacks {
    return {
      onInteract: () => this.interactionController?.triggerActiveInteraction(),
      onCancelAction: () => this.cancelActiveActionForUi(),
      onToggleSprint: () => this.tryToggleSprint(),
      onCombatEndTurn: () => this.turnCombatSession?.tryPlayerEndTurn(),
      onCombatFlee: () => this.turnCombatSession?.tryPlayerFlee(),
      onMoveToPointer: (worldX, worldY) => this.interactionController?.moveToPointer(worldX, worldY),
      onPointerInteract: (worldX, worldY) => {
        const tilemap = this.worldRuntimeCoordinator?.getIsoTilemap();

        if (this.turnCombatSession?.isInCombat()) {
          if (tilemap) {
            const tile = tilemap.transform.worldToTile(worldX, worldY);
            this.turnCombatSession.handleTileClick(tile.x, tile.y);
          }
          return;
        }

        // Combat stance: player can click enemies to start combat with passive mobs
        if (this.isCombatStance && tilemap) {
          const tile = tilemap.transform.worldToTile(worldX, worldY);
          const triggered = this.turnCombatSession?.tryTriggerCombatAtTile(
            tile.x, tile.y, this.time.now,
          );
          if (triggered) return;
        }

        this.interactionController?.pointerInteraction(worldX, worldY);
      },
      onPointerContext: (worldX, worldY) =>
        this.interactionController?.pointerContext(worldX, worldY),
      onMenuMoveUp:   () => this.worldRuntimeCoordinator?.moveChoiceMenuSelection(-1),
      onMenuMoveDown: () => this.worldRuntimeCoordinator?.moveChoiceMenuSelection(1),
      onMenuConfirm:  () => this.tryConfirmChoiceMenu(),
      onMenuPointer:  () => { /* handled by HTML popup click events */ },
      onMenuCancel:   () => {
        const msg = this.worldRuntimeCoordinator?.cancelChoiceMenu();
        if (msg) this.uiManager?.showInfo(msg);
      },
      onPlacementConfirm: () => this.interactionController?.confirmPlacementMode(),
      onPlacementCancel: () => {
        const msg = this.worldRuntimeCoordinator?.cancelPlacementMode();
        if (msg) this.uiManager?.showInfo(msg);
      },
      onToggleInventory: () => this.uiManager?.toggleInventory(),
      onToggleJournal: () => this.uiManager?.toggleJournal(),
      onToggleSkills: () => this.uiManager?.toggleSkills(),
      onSaveNow: () => this.saveController?.saveNow(this.getSaveControllerContext()),
      onLoadSave: () => this.saveController?.loadSavedGame(this.getSaveControllerContext()),
      onClearSave: () => this.saveController?.clearSavedGame(this.getSaveControllerContext()),
      onDebugCycleZoom: () => this.cameraSystem?.cycleZoom(),
      onDebugToggleGrid: () => this.worldRuntimeCoordinator?.getIsoTilemap()?.cycleGridMode(),
      onDebugToggleChunk: () => this.worldRuntimeCoordinator?.getIsoTilemap()?.toggleChunkDebug(),
      onDebugToggleObjects: () => this.worldRuntimeCoordinator?.getObjectDebugRenderer()?.toggle(),
      onDebugLogPlacement: () => {},
    };
  }

  private async initializeWorldRuntime(mapId: string, spawnId: string): Promise<void> {
    const coordinator = this.worldRuntimeCoordinator;
    const loadSerial = this.mapLoadSerial + 1;
    this.mapLoadSerial = loadSerial;

    if (!coordinator) return;

    try {
      await coordinator.prepareMapAssets(mapId);

      if (this.hasShutdown) return;
      if (this.mapLoadSerial !== loadSerial) return;
      if (this.worldRuntimeCoordinator !== coordinator) return;

      const loadedMap = coordinator.loadMap(mapId, spawnId);
      this.bindPlayerAndCamera(loadedMap);
      this.bindRuntimeSupportSystems();
      coordinator.updatePlayerRuntimeState();
    } catch (error) {
      console.error(`[GameScene] Failed to load map "${mapId}":`, error);
      if (mapId !== 'test_home_island') {
        await this.initializeWorldRuntime('test_home_island', 'default');
      }
    }
  }

  private async initializeWorldManifestRuntime(manifestUrl: string, spawnId: string): Promise<void> {
    const coordinator = this.worldRuntimeCoordinator;
    const loadSerial = this.mapLoadSerial + 1;
    this.mapLoadSerial = loadSerial;

    if (!coordinator) return;

    try {
      const loadedMap = await coordinator.loadWorldManifest(manifestUrl, spawnId);

      if (this.hasShutdown) return;
      if (this.mapLoadSerial !== loadSerial) return;
      if (this.worldRuntimeCoordinator !== coordinator) return;

      this.bindPlayerAndCamera(loadedMap);
      this.bindRuntimeSupportSystems();
      coordinator.updatePlayerRuntimeState();
    } catch (error) {
      console.error(`[GameScene] Failed to load world manifest "${manifestUrl}":`, error);
      this.uiManager?.showInfo(`Failed to load world manifest: ${manifestUrl}`);
    }
  }

  private bindPlayerAndCamera(loadedMap: LoadedMapRuntime): void {
    const spawnPoint = this.worldRuntimeCoordinator?.getCurrentSpawnWorldPoint();

    if (!spawnPoint) return;

    if (!this.player) {
      this.player = this.add.sprite(spawnPoint.x, spawnPoint.y, PLAYER_TEXTURE_KEY);
      this.player.setScale(PLAYER_CONFIG.visualScale);
    }

    if (!this.playerController) {
      this.playerController = new PlayerController(this, this.player, loadedMap.isoTilemap);
    }

    if (!this.player) {
      return;
    }

    if (!this.cameraSystem) {
      this.cameraSystem = new CameraSystem({
        scene: this,
        camera: this.cameras.main,
        bounds: loadedMap.worldBounds,
        followTarget: this.player,
      });
    } else {
      this.cameraSystem.setBounds(loadedMap.worldBounds);
    }

    this.worldRuntimeCoordinator?.bindSceneSystems({
      player: this.player,
      playerController: this.playerController,
      cameraSystem: this.cameraSystem,
    });
  }

  private bindDebugOverlayToRuntime(): void {
    if (!this.playerController || !this.cameraSystem || !this.worldRuntimeCoordinator) {
      return;
    }

    const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
    if (!isoTilemap) return;
    const mapLoader = this.worldRuntimeCoordinator.getMapLoader();
    const mapTransitionSystem = this.worldRuntimeCoordinator.getMapTransitionSystem();
    const objectPlacementSystem = this.worldRuntimeCoordinator.getObjectPlacementSystem();
    const objectDebugRenderer = this.worldRuntimeCoordinator.getObjectDebugRenderer();

    if (!this.debugOverlaySystem) {
      this.debugOverlaySystem = new DebugOverlaySystem({
        scene: this,
        worldCamera: this.cameras.main,
        cameraSystem: this.cameraSystem,
        playerController: this.playerController,
        isoTilemap,
        mapLoader,
        mapTransitionSystem,
        objectPlacementSystem,
        objectDebugRenderer,
        getAudioDiagnostics: () => this.sfxSystem?.getDiagnostics() ?? null,
      });
      return;
    }

    this.debugOverlaySystem.setWorldContext({
      isoTilemap,
      mapLoader,
      mapTransitionSystem,
      objectPlacementSystem,
      objectDebugRenderer,
    });
  }

  private bindTurnCombatToRuntime(): void {
    if (!this.playerController || !this.worldRuntimeCoordinator || !this.turnCombatSession) {
      return;
    }

    const runtime = this.worldRuntimeCoordinator.getCurrentRuntime();
    this.turnCombatSession.setMapContext(
      runtime.definition.id,
      runtime.isoTilemap,
      runtime.enemySpawns,
    );
    this.turnCombatSession.setPlayerController(this.playerController);
    this.encounterPopulation.registerSpawns(runtime.enemySpawns);
  }

  private bindRuntimeSupportSystems(): void {
    this.bindDebugOverlayToRuntime();
    this.bindTurnCombatToRuntime();
    const mapId = this.worldRuntimeCoordinator?.getCurrentRuntime().definition.id ?? '';
    this.groundItemSystem?.setActiveMap(mapId);
  }

  private tryUseItem(itemId: string): void {
    if (!this.worldRuntimeCoordinator || !this.uiManager) {
      return;
    }

    const result = this.worldRuntimeCoordinator.useItem(itemId);
    this.handleGameplayResult(result, { allowAutosave: false });
  }

  private tryDropItem(itemId: string): void {
    if (!this.worldRuntimeCoordinator || !this.groundItemSystem) return;
    const drop = this.worldRuntimeCoordinator.dropItemFromInventory(itemId);
    if (drop.ok) {
      const mapId = this.worldRuntimeCoordinator.getCurrentRuntime().definition.id;
      const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
      if (!isoTilemap) return;
      const tile = isoTilemap.transform.worldToTile(drop.worldX, drop.worldY);
      const center = isoTilemap.transform.getTileCenterWorld(tile.x, tile.y);
      this.groundItemSystem.spawnDrop(mapId, itemId, 1, center.x, center.y, this.time.now, this.time.now + 60_000);
      this.uiManager?.showInfo('Dropped item.');
    }
  }

  private tryInspectItem(itemId: string): void {
    if (!this.worldRuntimeCoordinator) return;
    const data = this.worldRuntimeCoordinator.getItemDisplayData(itemId);
    if (data) {
      this.uiManager?.showInfo(`${data.displayName}: ${data.description}`);
    }
  }

  private tryCombineItems(sourceId: string, targetId: string): void {
    if (!this.worldRuntimeCoordinator) return;
    const result = this.worldRuntimeCoordinator.tryHandCraft(sourceId, targetId);
    this.uiManager?.handleResult(result);
  }

  private toggleCombatStance(): void {
    if (this.turnCombatSession?.isInCombat()) return;
    this.isCombatStance = !this.isCombatStance;
    this.uiManager?.showInfo(
      this.isCombatStance ? 'Combat stance ON — click an enemy to engage.' : 'Combat stance OFF.',
    );
  }

  private tryToggleSprint(): void {
    if (this.turnCombatSession?.isInCombat()) return;
    this.isSprinting = !this.isSprinting;
    const multiplier = this.isSprinting ? 1.6 : 1.0;
    this.playerController?.setMovementSpeedMultiplier(multiplier);
    this.turnCombatSession?.setSprinting(this.isSprinting);
  }

  private handlePlayerDied(): void {
    if (this.isRespawningAfterDeath) return;
    if (!this.worldRuntimeCoordinator || !this.groundItemSystem) return;
    this.isRespawningAfterDeath = true;

    const deathRuntime = this.worldRuntimeCoordinator.getCurrentRuntime();
    const deathMapId = deathRuntime.definition.id;
    const deathWorldManifestUrl = typeof deathRuntime.definition.metadata?.worldManifestUrl === 'string'
      ? deathRuntime.definition.metadata.worldManifestUrl
      : null;
    const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
    if (!isoTilemap) return;

    const playerPos = this.playerController?.getFeetPoint() ?? { x: 0, y: 0 };
    const tile = isoTilemap.transform.worldToTile(playerPos.x, playerPos.y);
    const center = isoTilemap.transform.getTileCenterWorld(tile.x, tile.y);
    const despawnAtMs = this.time.now + 900_000;

    for (const { id, count } of this.worldRuntimeCoordinator.drainAllInventoryItems()) {
      this.groundItemSystem.spawnDrop(deathMapId, id, count, center.x, center.y, this.time.now, despawnAtMs);
    }

    this.isSprinting = false;
    this.playerController?.setMovementSpeedMultiplier(1.0);
    this.uiManager?.showInfo('You were downed. Your items were left behind.');
    void this.respawnPlayerAfterDeath({
      mapId: deathMapId,
      worldManifestUrl: deathWorldManifestUrl,
    });
  }

  private async respawnPlayerAfterDeath(options: {
    mapId: string;
    worldManifestUrl: string | null;
  }): Promise<void> {
    try {
      this.playerController?.resetCombatVisual();
      if (options.worldManifestUrl) {
        await this.initializeWorldManifestRuntime(options.worldManifestUrl, 'default');
      } else {
        await this.initializeWorldRuntime(options.mapId, 'default');
      }

      if (this.hasShutdown) return;

      this.playerController?.resetCombatVisual();
      this.turnCombatSession?.resetPlayerHp();
    } catch (error) {
      console.error('Failed to respawn player after death.', error);
      this.uiManager?.showInfo('Respawn failed. Please reload if the world did not recover.');
    } finally {
      this.isRespawningAfterDeath = false;
    }
  }

  private buildMinimapSnapshot(): MinimapSnapshot | null {
    if (!this.worldRuntimeCoordinator?.hasActiveRuntime()) return null;
    const runtime = this.worldRuntimeCoordinator.getCurrentRuntime();
    const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
    const playerPos = this.playerController?.getFeetPoint();
    if (!playerPos) return null;

    const tile = isoTilemap.transform.worldToTile(playerPos.x, playerPos.y);

    const RADIUS = 12;
    const diam = RADIUS * 2 + 1;
    const vpTiles = Array.from({ length: diam }, (_, row) => {
      const dy = row - RADIUS;
      return Array.from({ length: diam }, (_, col) => {
        const dx = col - RADIUS;
        const tx = tile.x + dx;
        const ty = tile.y + dy;
        return {
          terrain: isoTilemap.getTerrainFamilyAtTile(tx, ty),
          walkable: isoTilemap.isTileWalkable(tx, ty),
        };
      });
    });

    const npcWorldPositions = this.worldRuntimeCoordinator.getNpcWorldPositions();
    const vpNpcs = npcWorldPositions.flatMap(({ worldX, worldY }) => {
      const npcTile = isoTilemap.transform.worldToTile(worldX, worldY);
      const dx = npcTile.x - tile.x;
      const dy = npcTile.y - tile.y;
      return Math.abs(dx) <= RADIUS && Math.abs(dy) <= RADIUS ? [{ dx, dy }] : [];
    });

    const enemyTiles = this.turnCombatSession?.getEnemyTiles() ?? [];
    const vpEnemies = enemyTiles.flatMap(({ tileX, tileY }) => {
      const dx = tileX - tile.x;
      const dy = tileY - tile.y;
      return Math.abs(dx) <= RADIUS && Math.abs(dy) <= RADIUS ? [{ dx, dy }] : [];
    });

    return {
      mapId: runtime.definition.id,
      mapName: runtime.definition.displayName,
      playerTileX: tile.x,
      playerTileY: tile.y,
      mapWidth: runtime.definition.width,
      mapHeight: runtime.definition.height,
      terrain: runtime.definition.terrain,
      viewport: { radius: RADIUS, tiles: vpTiles, npcs: vpNpcs, enemies: vpEnemies },
    };
  }

  private handleEnemyKilledForLoot(
    spawnId: string,
    areaId: string | undefined,
    definitionId: string | undefined,
    worldX: number,
    worldY: number,
  ): void {
    if (areaId) {
      this.encounterPopulation.recordKill(spawnId, areaId);
      if (this.encounterPopulation.isAreaCleared(areaId)) {
        this.worldRuntimeCoordinator?.applyAreaCleared(1);
      }
    }
    if (!this.groundItemSystem || !this.worldRuntimeCoordinator) return;
    const enemyDef = ENEMY_DEFINITIONS.find((d) => d.id === definitionId);
    const lootTables = enemyDef?.lootTables;
    if (!lootTables || lootTables.length === 0) return;
    const mapId = this.worldRuntimeCoordinator.getCurrentRuntime().definition.id;
    const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
    if (!isoTilemap) return;
    const rawTile = isoTilemap.transform.worldToTile(worldX, worldY);
    const dropTile = findNearestWalkableTile(rawTile, isoTilemap) ?? rawTile;
    const center = isoTilemap.transform.getTileCenterWorld(dropTile.x, dropTile.y);
    this.groundItemSystem.spawnFromLootTable(mapId, lootTables, center.x, center.y, this.time.now);
  }

  private refreshGroundItemTargets(): void {
    if (!this.groundItemSystem || !this.worldRuntimeCoordinator?.hasActiveRuntime()) return;
    const isoTilemap = this.worldRuntimeCoordinator.getIsoTilemap();
    if (!isoTilemap) return;
    const targets = this.groundItemSystem.buildDynamicTargets(
      (wx, wy) => isoTilemap.transform.worldToTile(wx, wy),
    );
    this.worldRuntimeCoordinator.setDynamicInteractionTargets(targets);
  }

  private tryConfirmChoiceMenu(): void {
    if (!this.worldRuntimeCoordinator || !this.uiManager) {
      return;
    }

    const result = this.worldRuntimeCoordinator.confirmChoiceMenu();

    if (!result) {
      return;
    }

    if (isDeferredInteractionAction(result)) {
      this.interactionController?.beginDeferredInteractionAction(result);
      return;
    }

    this.handleGameplayResult(result, { allowAutosave: true });
  }

  private cancelActiveActionForUi(): boolean {
    const message = this.worldRuntimeCoordinator?.cancelActiveAction('Action cancelled.');

    if (!message) {
      return false;
    }

    this.uiManager?.showInfo(message);
    return true;
  }

  private tryAutoLoadSave(): void {
    const hasSave = this.saveController?.hasSave() ?? false;
    this.saveController?.tryAutoLoadSave(this.getSaveControllerContext());
    if (!hasSave) {
      this.worldRuntimeCoordinator?.seedStartingInventory(STARTING_WEAPON_IDS);
    }
  }

  private getSaveControllerContext() {
    return {
      uiManager: this.uiManager,
      worldRuntimeCoordinator: this.worldRuntimeCoordinator,
      onRestored: () => this.bindRuntimeSupportSystems(),
    };
  }

  private handleGameplayResult(
    result: InteractionResult | null,
    { allowAutosave }: { allowAutosave: boolean },
  ): void {
    if (!result || !this.uiManager || !this.worldRuntimeCoordinator) {
      return;
    }

    this.uiManager.handleResult(result);

    if (result.transitionRequest) {
      this.bindRuntimeSupportSystems();
    }

    if (result.openShopId) {
      this.openShopPopup(result.openShopId);
    }

    this.worldRuntimeCoordinator.updatePlayerRuntimeState();

    if (allowAutosave) {
      this.saveController?.maybeAutosaveForResult(result, this.getSaveControllerContext());
    }
  }

  private openShopPopup(shopId: string): void {
    const coordinator = this.worldRuntimeCoordinator;
    const uiManager = this.uiManager;
    if (!coordinator || !uiManager) return;

    const shopSnapshot = coordinator.getShopSnapshot(shopId);
    if (!shopSnapshot) return;

    const getRefreshedState = () => ({
      shop: coordinator.getShopSnapshot(shopId)!,
      inventory: coordinator.getPlayerInventorySnapshot(),
      currency: coordinator.getPlayerCurrencySnapshot(),
    });

    uiManager.openShop(
      shopId,
      shopSnapshot,
      coordinator.getPlayerInventorySnapshot(),
      coordinator.getPlayerCurrencySnapshot(),
      {
        onBuy: (itemId, qty) => {
          const r = coordinator.tryBuyFromShop(shopId, itemId, qty);
          if (r.ok) coordinator.updatePlayerRuntimeState();
          return r;
        },
        onSell: (itemId, qty) => {
          const r = coordinator.trySellToShop(shopId, itemId, qty);
          if (r.ok) coordinator.updatePlayerRuntimeState();
          return r;
        },
        getRefreshedState,
        onMessage: (msg, ok) => {
          uiManager.pushMessage(msg, ok ? 'game' : 'error');
        },
      },
    );
  }
}

function getWorldManifestUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return new URLSearchParams(window.location.search).get('worldManifest');
}

function getRequestedSpawnId(): string {
  if (typeof window === 'undefined') {
    return 'default';
  }

  return new URLSearchParams(window.location.search).get('spawnId') ?? 'default';
}

function findNearestWalkableTile(
  origin: { x: number; y: number },
  tilemap: { isTileWalkable: (x: number, y: number) => boolean; isTileInBounds: (x: number, y: number) => boolean },
): { x: number; y: number } | null {
  const offsets = [
    { x: 0, y: 0 },
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 },
  ];
  for (const off of offsets) {
    const tx = origin.x + off.x;
    const ty = origin.y + off.y;
    if (tilemap.isTileInBounds(tx, ty) && tilemap.isTileWalkable(tx, ty)) {
      return { x: tx, y: ty };
    }
  }
  return null;
}

function isDeferredInteractionAction(
  value: InteractionResult | DeferredInteractionAction,
): value is DeferredInteractionAction {
  return 'kind' in value && value.kind === 'deferred_interaction_action';
}
