/**
 * LootService - Manages loot drops, spawning, and collection.
 *
 * Listens to CombatService.onEntityDied for enemy deaths.
 * Spawns loot with physics, handles collection on touch,
 * and manages despawn timers.
 */

import { type OnStart, Service } from "@flamework/core";
import {
	CollectionService,
	HttpService,
	Players,
	Workspace,
} from "@rbxts/services";
import { Events } from "server/network";
import {
	BOSS_DROP_COUNT,
	LOOT_DESPAWN_TIME,
	LOOT_TABLES,
	type LootTableEntry,
	RARITY_MULTIPLIERS,
} from "shared/config/loot";
import type { LootRarity, PlayerStats } from "shared/types/stats";
import type { CombatService } from "./CombatServiceStub";
import type { StatsService } from "./StatsService";

interface ActiveLoot {
	part: Part;
	stat: keyof PlayerStats;
	amount: number;
	rarity: LootRarity;
	despawnThread?: thread;
}

@Service()
export class LootService implements OnStart {
	private activeLoot = new Map<string, ActiveLoot>();

	constructor(
		private combatService: CombatService,
		private statsService: StatsService,
	) {}

	onStart(): void {
		// Subscribe to entity deaths for loot drops
		this.combatService.onEntityDied.Connect(
			(_entityId, position, entityType, _killer) => {
				if (entityType === "Boss") {
					this.spawnBossLoot(position);
				} else {
					this.rollAndSpawnLoot(position, entityType);
				}
			},
		);
	}

	// ==================== Public API ====================

	/**
	 * Roll for and spawn loot at position based on enemy type.
	 * Called internally when enemy dies.
	 */
	rollAndSpawnLoot(position: Vector3, enemyType: string): void {
		const lootTable = LOOT_TABLES[enemyType];
		if (!lootTable) {
			warn(`[LootService] No loot table for enemy type: ${enemyType}`);
			return;
		}

		// Roll against drop chance
		if (math.random() > lootTable.dropChance) {
			return; // No drop this time
		}

		// Pick stat and rarity, then spawn
		const stat = this.pickWeightedStat(lootTable.drops);
		const rarity = this.pickWeightedRarity(lootTable.rarityWeights);
		const entry = lootTable.drops.find((d) => d.stat === stat);
		if (!entry) return;

		const baseAmount = math.random() * (entry.max - entry.min) + entry.min;
		const finalAmount = baseAmount * RARITY_MULTIPLIERS[rarity];

		this.spawnLoot(position, stat, finalAmount, rarity);
	}

	/**
	 * Spawn guaranteed boss loot (2-3 drops).
	 * Called by Game Flow after boss death.
	 */
	spawnBossLoot(position: Vector3): void {
		const lootTable = LOOT_TABLES.Boss;
		if (!lootTable) {
			warn("[LootService] No loot table for Boss");
			return;
		}

		const dropCount = math.random(BOSS_DROP_COUNT.min, BOSS_DROP_COUNT.max);

		for (let i = 0; i < dropCount; i++) {
			const stat = this.pickWeightedStat(lootTable.drops);
			const rarity = this.pickWeightedRarity(lootTable.rarityWeights);
			const entry = lootTable.drops.find((d) => d.stat === stat);
			if (!entry) continue;

			const baseAmount = math.random() * (entry.max - entry.min) + entry.min;
			const finalAmount = baseAmount * RARITY_MULTIPLIERS[rarity];

			// Offset position slightly for multiple drops
			const offset = new Vector3(
				math.random() * 4 - 2,
				0,
				math.random() * 4 - 2,
			);
			this.spawnLoot(position.add(offset), stat, finalAmount, rarity);
		}
	}

	/**
	 * Despawn all active loot.
	 * Called by Game Flow on reset.
	 */
	despawnAllLoot(): void {
		for (const [lootId, loot] of this.activeLoot) {
			if (loot.despawnThread) {
				task.cancel(loot.despawnThread);
			}
			loot.part.Destroy();
			this.activeLoot.delete(lootId);
		}
	}

	// ==================== Private Methods ====================

	/**
	 * Spawn a loot drop at position.
	 */
	private spawnLoot(
		position: Vector3,
		stat: keyof PlayerStats,
		amount: number,
		rarity: LootRarity,
	): void {
		const lootId = HttpService.GenerateGUID(false);

		// Create loot part
		const loot = new Instance("Part");
		loot.Name = `Loot_${lootId}`;
		loot.Size = new Vector3(1, 1, 1);
		loot.Position = position.add(new Vector3(0, 2, 0));
		loot.Anchored = false;
		loot.CanCollide = true;
		loot.Shape = Enum.PartType.Ball;

		// Store data as attributes
		loot.SetAttribute("LootId", lootId);
		loot.SetAttribute("Stat", stat);
		loot.SetAttribute("Amount", amount);
		loot.SetAttribute("Rarity", rarity);

		// Tag for identification
		CollectionService.AddTag(loot, "Loot");

		// Apply upward impulse for physics
		loot.AssemblyLinearVelocity = new Vector3(
			math.random() * 4 - 2,
			8,
			math.random() * 4 - 2,
		);

		// Parent to workspace
		loot.Parent = Workspace;

		// Set up touch collection
		const _connection = loot.Touched.Connect((hit) => {
			this.handleLootTouch(lootId, hit);
		});

		// Store active loot
		const activeLoot: ActiveLoot = {
			part: loot,
			stat,
			amount,
			rarity,
		};

		// Set up despawn timer
		activeLoot.despawnThread = task.delay(LOOT_DESPAWN_TIME, () => {
			this.despawnLoot(lootId);
		});

		this.activeLoot.set(lootId, activeLoot);

		// Fire spawn event to clients
		Events.LootSpawned.broadcast(lootId, loot.Position, rarity);
	}

	/**
	 * Handle touch event on loot.
	 */
	private handleLootTouch(lootId: string, hit: BasePart): void {
		const loot = this.activeLoot.get(lootId);
		if (!loot) return; // Already collected

		// Check if touched by player character
		const character = hit.Parent as Model | undefined;
		if (!character) return;

		const player = Players.GetPlayerFromCharacter(character);
		if (!player) return;

		// Collect the loot
		this.collectLoot(lootId, player);
	}

	/**
	 * Player collects loot - apply stats and destroy.
	 */
	private collectLoot(lootId: string, player: Player): void {
		const loot = this.activeLoot.get(lootId);
		if (!loot) return; // Already collected

		// Remove from active loot first (prevents double collection)
		this.activeLoot.delete(lootId);

		// Cancel despawn timer
		if (loot.despawnThread) {
			task.cancel(loot.despawnThread);
		}

		// Apply stat to player
		this.statsService.modifyStat(player, loot.stat, loot.amount);

		// Fire collection event to all clients
		Events.LootCollected.broadcast(lootId, player.UserId);

		// Destroy the part
		loot.part.Destroy();
	}

	/**
	 * Despawn loot after timeout.
	 */
	private despawnLoot(lootId: string): void {
		const loot = this.activeLoot.get(lootId);
		if (!loot) return;

		this.activeLoot.delete(lootId);
		loot.part.Destroy();
	}

	/**
	 * Pick a stat from the loot table using weighted random.
	 */
	private pickWeightedStat(drops: LootTableEntry[]): keyof PlayerStats {
		const totalWeight = drops.reduce((sum, d) => sum + d.weight, 0);
		let roll = math.random() * totalWeight;

		for (const drop of drops) {
			roll -= drop.weight;
			if (roll <= 0) {
				return drop.stat;
			}
		}

		// Fallback to first entry
		return drops[0].stat;
	}

	/**
	 * Pick a rarity using weighted random.
	 */
	private pickWeightedRarity(weights: Record<LootRarity, number>): LootRarity {
		const totalWeight = weights.Common + weights.Rare + weights.Epic;
		let roll = math.random() * totalWeight;

		if (roll <= weights.Common) return "Common";
		roll -= weights.Common;
		if (roll <= weights.Rare) return "Rare";
		return "Epic";
	}
}
