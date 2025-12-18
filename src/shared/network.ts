import { Networking } from "@flamework/networking";
import type { GamePhase, PhaseData } from "./types/gameState";
import type { LootRarity, PlayerStats } from "./types/stats";

/**
 * Branded type for entity identifiers.
 * Prevents accidental use of arbitrary strings as EntityIds.
 *
 * Format:
 * - Players: `player_${UserId}` (e.g., "player_12345")
 * - Enemies: `enemy_${instanceId}` (e.g., "enemy_1")
 */
declare const EntityIdBrand: unique symbol;
export type EntityId = string & { readonly [EntityIdBrand]: never };

/**
 * Create an EntityId for a player.
 * @param userId The player's UserId
 * @returns Branded EntityId in format "player_{userId}"
 */
export function createPlayerEntityId(userId: number): EntityId {
	return `player_${userId}` as EntityId;
}

/**
 * Create an EntityId for an enemy.
 * @param enemyId The enemy's internal ID (e.g., "1", "2")
 * @returns Branded EntityId in format "enemy_{enemyId}"
 */
export function createEnemyEntityId(enemyId: string): EntityId {
	return `enemy_${enemyId}` as EntityId;
}

/**
 * Check if an EntityId represents a player.
 * @param id The EntityId to check
 * @returns true if the EntityId is for a player
 */
export function isPlayerEntityId(id: EntityId | string): boolean {
	return id.sub(1, 7) === "player_";
}

/**
 * Check if an EntityId represents an enemy.
 * @param id The EntityId to check
 * @returns true if the EntityId is for an enemy
 */
export function isEnemyEntityId(id: EntityId | string): boolean {
	return id.sub(1, 6) === "enemy_";
}

/**
 * Extract the UserId from a player EntityId.
 * @param id The player EntityId
 * @returns The UserId or undefined if invalid
 */
export function getPlayerUserIdFromEntityId(
	id: EntityId | string,
): number | undefined {
	if (!isPlayerEntityId(id)) return undefined;
	return tonumber(id.sub(8));
}

/**
 * Extract the enemy ID from an enemy EntityId.
 * @param id The enemy EntityId
 * @returns The enemy ID string or undefined if invalid
 */
export function getEnemyIdFromEntityId(
	id: EntityId | string,
): string | undefined {
	if (!isEnemyEntityId(id)) return undefined;
	return id.sub(7);
}

interface ClientToServerEvents {
	/**
	 * Player requests an attack in the given direction.
	 * Server validates cooldown (0.5s base) - rapid requests are ignored.
	 */
	RequestAttack: (direction: Vector3) => void;

	// Game State events
	/** Player marks themselves ready in lobby */
	PlayerReady: () => void;
	/** Player marks themselves unready in lobby */
	PlayerUnready: () => void;
}

interface ServerToClientEvents {
	// Combat events (from PR #7)
	/** Entity health changed (player or enemy) */
	HealthChanged: (entityId: EntityId, current: number, max: number) => void;
	/** Entity died (player or enemy) */
	EntityDied: (entityId: EntityId, killerUserId?: number) => void;
	/** Player performed an attack (for VFX). Uses UserId directly since only players attack. */
	AttackEffect: (userId: number, position: Vector3, direction: Vector3) => void;
	/** Entity was hit (for damage numbers) */
	HitEffect: (entityId: EntityId, damage: number) => void;
	/** Boss health changed (for boss health bar UI) */
	BossHealthChanged: (current: number, max: number) => void;

	// Stats & Loot events
	/** Full stats update sent when stats change */
	StatsUpdated: (stats: PlayerStats) => void;
	/** Individual stat gain notification for UI popups */
	StatGained: (statName: keyof PlayerStats, amount: number) => void;
	/** Loot spawned in the world */
	LootSpawned: (lootId: string, position: Vector3, rarity: LootRarity) => void;
	/** Loot was collected by a player */
	LootCollected: (lootId: string, collectorUserId: number) => void;

	// Game State events
	/** Game phase changed - sent when transitioning between phases */
	PhaseChanged: (phase: GamePhase, data: PhaseData) => void;
	/** Countdown tick - sent every second during countdown phases */
	CountdownTick: (seconds: number) => void;
	/** Room cleared - sent when all enemies in a room are killed */
	RoomCleared: (roomIndex: number) => void;
	/** Player ready state changed - for lobby UI */
	PlayerReadyChanged: (userId: number, isReady: boolean) => void;
	/** Players alive count changed - for tracking during dungeon/pvp */
	PlayersAliveChanged: (alive: number, total: number) => void;
}

interface ClientToServerFunctions {}

interface ServerToClientFunctions {}

export const GlobalEvents = Networking.createEvent<
	ClientToServerEvents,
	ServerToClientEvents
>();
export const GlobalFunctions = Networking.createFunction<
	ClientToServerFunctions,
	ServerToClientFunctions
>();
