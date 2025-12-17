/**
 * StatsService - Server-authoritative player stat management.
 *
 * Manages player stats that affect gameplay during a run:
 * damage, attackSpeed, moveSpeed, maxHealth.
 *
 * All stats are additive only and reset between runs.
 */

import { type OnStart, Service } from "@flamework/core";
import { Players } from "@rbxts/services";
import { Events } from "server/network";
import { BASE_STATS, type PlayerStats } from "shared/types/stats";
import type { CombatService } from "./CombatService";

@Service()
export class StatsService implements OnStart {
	private playerStats = new Map<Player, PlayerStats>();

	constructor(private combatService: CombatService) {}

	onStart(): void {
		Players.PlayerAdded.Connect((player) => this.initializePlayer(player));
		Players.PlayerRemoving.Connect((player) => this.cleanupPlayer(player));
	}

	// ==================== Player Lifecycle ====================

	private initializePlayer(player: Player): void {
		const stats: PlayerStats = { ...BASE_STATS };
		this.playerStats.set(player, stats);

		// Fire initial stats to client
		Events.StatsUpdated.fire(player, stats);
	}

	private cleanupPlayer(player: Player): void {
		this.playerStats.delete(player);
	}

	// ==================== Public Getters (Contract) ====================

	/**
	 * Get player's current damage value.
	 * Called by CombatService for damage calculations.
	 */
	getPlayerDamage(player: Player): number {
		return this.playerStats.get(player)?.damage ?? BASE_STATS.damage;
	}

	/**
	 * Get player's attack speed multiplier.
	 * Called by CombatService for cooldown calculations.
	 */
	getAttackSpeed(player: Player): number {
		return this.playerStats.get(player)?.attackSpeed ?? BASE_STATS.attackSpeed;
	}

	/**
	 * Get player's maximum health.
	 * Called by CombatService for health cap.
	 */
	getMaxHealth(player: Player): number {
		return this.playerStats.get(player)?.maxHealth ?? BASE_STATS.maxHealth;
	}

	/**
	 * Get player's movement speed.
	 * Called for Humanoid.WalkSpeed calculations.
	 */
	getMoveSpeed(player: Player): number {
		return this.playerStats.get(player)?.moveSpeed ?? BASE_STATS.moveSpeed;
	}

	// ==================== Stat Modification ====================

	/**
	 * Modify a player's stat by the given amount (additive).
	 * Called by LootService when player collects loot.
	 *
	 * Side effects:
	 * - moveSpeed: immediately updates Humanoid.WalkSpeed
	 * - maxHealth: heals player by the gained amount
	 */
	modifyStat(player: Player, stat: keyof PlayerStats, amount: number): void {
		const stats = this.playerStats.get(player);
		if (!stats) return;

		stats[stat] += amount;

		// Side effects based on stat type
		if (stat === "moveSpeed") {
			this.applyMoveSpeed(player, stats.moveSpeed);
		}
		if (stat === "maxHealth") {
			// Heal by the amount gained
			this.combatService.healPlayer(player, amount);
		}

		// Replicate to client
		Events.StatsUpdated.fire(player, stats);
		Events.StatGained.fire(player, stat, amount);
	}

	/**
	 * Apply movement speed to player's Humanoid.
	 */
	private applyMoveSpeed(player: Player, speed: number): void {
		const humanoid = player.Character?.FindFirstChild("Humanoid") as
			| Humanoid
			| undefined;
		if (humanoid) {
			humanoid.WalkSpeed = speed;
		}
	}

	// ==================== Reset Methods ====================

	/**
	 * Reset a single player's stats to base values.
	 * Called by Game Flow on match reset.
	 */
	resetPlayerStats(player: Player): void {
		const stats = this.playerStats.get(player);
		if (!stats) return;

		stats.damage = BASE_STATS.damage;
		stats.attackSpeed = BASE_STATS.attackSpeed;
		stats.moveSpeed = BASE_STATS.moveSpeed;
		stats.maxHealth = BASE_STATS.maxHealth;

		// Apply movement speed
		this.applyMoveSpeed(player, stats.moveSpeed);

		// Replicate to client
		Events.StatsUpdated.fire(player, stats);
	}

	/**
	 * Reset all players' stats to base values.
	 * Called by Game Flow on full game reset.
	 */
	resetAllPlayerStats(): void {
		for (const [player] of this.playerStats) {
			this.resetPlayerStats(player);
		}
	}
}
