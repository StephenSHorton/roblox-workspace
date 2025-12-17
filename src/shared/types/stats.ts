/**
 * Player stat types for the progression system.
 * Used by StatsService (server) and StatsController (client).
 */

export interface PlayerStats {
	damage: number;
	attackSpeed: number;
	moveSpeed: number;
	maxHealth: number;
}

export const BASE_STATS: Readonly<PlayerStats> = {
	damage: 10,
	attackSpeed: 1.0,
	moveSpeed: 16,
	maxHealth: 100,
};

export type LootRarity = "Common" | "Rare" | "Epic";

export interface LootDrop {
	stat: keyof PlayerStats;
	amount: number;
	rarity: LootRarity;
}
