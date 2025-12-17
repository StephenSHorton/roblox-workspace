import type { LootRarity, PlayerStats } from "../types/stats";

export interface LootTableEntry {
	stat: keyof PlayerStats;
	weight: number;
	min: number;
	max: number;
}

export interface EnemyLootTable {
	dropChance: number;
	rarityWeights: Record<LootRarity, number>;
	drops: LootTableEntry[];
}

export const RARITY_MULTIPLIERS: Readonly<Record<LootRarity, number>> = {
	Common: 1.0,
	Rare: 1.5,
	Epic: 2.0,
};

export const LOOT_TABLES: Readonly<Record<string, EnemyLootTable>> = {
	Goblin: {
		dropChance: 0.4,
		rarityWeights: { Common: 70, Rare: 25, Epic: 5 },
		drops: [
			{ stat: "damage", weight: 3, min: 1, max: 2 },
			{ stat: "attackSpeed", weight: 2, min: 0.05, max: 0.1 },
			{ stat: "moveSpeed", weight: 1, min: 1, max: 2 },
		],
	},
	Skeleton: {
		dropChance: 0.5,
		rarityWeights: { Common: 60, Rare: 30, Epic: 10 },
		drops: [
			{ stat: "damage", weight: 3, min: 2, max: 3 },
			{ stat: "attackSpeed", weight: 2, min: 0.05, max: 0.15 },
			{ stat: "maxHealth", weight: 2, min: 5, max: 10 },
		],
	},
	Ogre: {
		dropChance: 0.7,
		rarityWeights: { Common: 40, Rare: 40, Epic: 20 },
		drops: [
			{ stat: "damage", weight: 2, min: 3, max: 5 },
			{ stat: "maxHealth", weight: 3, min: 10, max: 20 },
			{ stat: "moveSpeed", weight: 1, min: 1, max: 2 },
		],
	},
	Boss: {
		dropChance: 1.0,
		rarityWeights: { Common: 0, Rare: 50, Epic: 50 },
		drops: [
			{ stat: "damage", weight: 1, min: 5, max: 10 },
			{ stat: "attackSpeed", weight: 1, min: 0.1, max: 0.2 },
			{ stat: "maxHealth", weight: 1, min: 15, max: 30 },
			{ stat: "moveSpeed", weight: 1, min: 2, max: 4 },
		],
	},
};

export const BOSS_DROP_COUNT = { min: 2, max: 3 } as const;
export const LOOT_DESPAWN_TIME = 30; // seconds
