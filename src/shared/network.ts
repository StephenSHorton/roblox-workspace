import { Networking } from "@flamework/networking";
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
	return enemyId as EntityId;
}

interface ClientToServerEvents {
	/**
	 * Player requests an attack in the given direction.
	 * Server validates cooldown (0.5s base) - rapid requests are ignored.
	 */
	RequestAttack: (direction: Vector3) => void;
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
