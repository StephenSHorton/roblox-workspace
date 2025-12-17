/**
 * Enemy configuration for the dungeon combat system.
 * Used by EnemyService to spawn enemies with correct stats.
 */

export interface EnemyConfig {
	/** Base health points */
	readonly health: number;
	/** Damage dealt per attack */
	readonly damage: number;
	/** Movement speed in studs/sec */
	readonly speed: number;
	/** Attack windup time in seconds before damage is dealt */
	readonly attackWindup: number;
}

/**
 * Configuration for all enemy types in the dungeon.
 * Goblin: Fast, weak - swarm enemy
 * Skeleton: Balanced - standard enemy
 * Ogre: Slow, tanky - heavy enemy
 */
export const ENEMIES: Record<string, EnemyConfig> = {
	Goblin: { health: 30, damage: 8, speed: 18, attackWindup: 0.3 },
	Skeleton: { health: 50, damage: 12, speed: 14, attackWindup: 0.5 },
	Ogre: { health: 100, damage: 20, speed: 10, attackWindup: 0.8 },
};

/** Valid enemy type identifiers (derived from ENEMIES keys) */
export type EnemyType = keyof typeof ENEMIES;

/**
 * Boss configuration - spawns at end of dungeon.
 * High HP, triggers PvP phase on death.
 */
export const BOSS = {
	health: 500,
	damage: 25,
	speed: 8,
	attackWindup: 1.0,
} as const satisfies EnemyConfig;

/** Template name for boss model in ServerStorage/Enemies */
export const BOSS_TEMPLATE_NAME = "Boss";
