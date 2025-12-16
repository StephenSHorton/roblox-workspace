/**
 * Combat configuration for the dungeon combat system.
 * Centralized constants for tuning combat mechanics.
 */

/** Player combat defaults */
export const PLAYER = {
	/** Default starting health */
	health: 100,
	/** Default starting max health */
	maxHealth: 100,
	/** Default starting damage */
	damage: 10,
	/** Default attack speed multiplier */
	attackSpeed: 1,
} as const;

/** Player attack configuration */
export const PLAYER_ATTACK = {
	/** Base cooldown between attacks in seconds */
	cooldown: 0.5,
	/** Attack range in studs */
	range: 5,
	/** Attack arc in degrees (total cone width) */
	arcDegrees: 90,
} as const;

/** Enemy AI configuration */
export const ENEMY_AI = {
	/** Range at which enemies detect players (studs) */
	detectionRange: 20,
	/** Range at which enemies can attack (studs) */
	attackRange: 4,
	/** Multiplier for losing target (detection * this = lose range) */
	loseTargetMultiplier: 1.5,
} as const;
