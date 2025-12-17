/**
 * StatsService - Server-authoritative player stat management.
 *
 * Manages player stats that affect gameplay during a run:
 * damage, attackSpeed, moveSpeed, maxHealth.
 *
 * This is the SINGLE SOURCE OF TRUTH for player stats.
 * CombatService queries this service for stat values.
 *
 * All stats are additive only and reset between runs.
 */

import { Dependency, type OnStart, Service } from "@flamework/core";
import { Players } from "@rbxts/services";
import { Events } from "server/network";
import { BASE_STATS, type PlayerStats } from "shared/types/stats";
import type { CombatService } from "./CombatService";

@Service()
export class StatsService implements OnStart {
	private playerStats = new Map<Player, PlayerStats>();
	private combatService!: CombatService;

	onStart(): void {
		// Use Dependency() to break circular dependency with CombatService
		this.combatService = Dependency<CombatService>();

		Players.PlayerAdded.Connect((player) => this.initializePlayer(player));
		Players.PlayerRemoving.Connect((player) => this.cleanupPlayer(player));

		// Handle existing players (in case service starts after players join)
		for (const player of Players.GetPlayers()) {
			this.initializePlayer(player);
		}
	}

	// ==================== Player Lifecycle ====================

	private initializePlayer(player: Player): void {
		// Don't re-initialize if already exists
		if (this.playerStats.has(player)) return;

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
	 * - maxHealth: notifies CombatService and heals player by the gained amount
	 */
	modifyStat(player: Player, stat: keyof PlayerStats, amount: number): void {
		const stats = this.playerStats.get(player);
		if (!stats) return;

		// Validate amount: must be finite and non-negative for loot gains
		const isInvalidNumber =
			!typeIs(amount, "number") ||
			tostring(amount) === "nan" ||
			amount === math.huge ||
			amount < 0;
		if (isInvalidNumber) {
			warn(
				`[StatsService] Invalid stat modification: ${stat} by ${amount} for ${player.Name}`,
			);
			return;
		}

		// Cap stat values to reasonable maximums to prevent exploits
		const MAX_STAT_VALUES: Record<keyof PlayerStats, number> = {
			damage: 10000,
			attackSpeed: 10,
			moveSpeed: 100,
			maxHealth: 100000,
		};

		const newValue = math.min(stats[stat] + amount, MAX_STAT_VALUES[stat]);
		stats[stat] = newValue;

		// Handle stat-specific side effects
		if (stat === "maxHealth") {
			// Notify CombatService about max health change (for clamping)
			this.combatService.onMaxHealthChanged(player, stats.maxHealth);
			// Also heal by the amount gained
			this.combatService.healPlayer(player, amount);
		}
		if (stat === "moveSpeed") {
			this.applyMoveSpeed(player, stats.moveSpeed);
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
