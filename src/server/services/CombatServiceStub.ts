/**
 * CombatService stub - Temporary placeholder until PR #7 merges.
 * TODO: Remove this file and update imports when PR #7 (CombatService) merges.
 *
 * This stub provides the minimal API surface that StatsService and LootService
 * depend on, allowing development to proceed in parallel.
 */

import { Service } from "@flamework/core";
import Signal from "@rbxts/signal";

/**
 * Entity identifier type matching PR #7's branded EntityId.
 * TODO: Import from shared/network.ts when PR #7 merges.
 */
export type EntityId = string;

/**
 * Stub CombatService that provides the signals and methods our services need.
 * The real CombatService from PR #7 will replace this.
 */
@Service()
export class CombatService {
	/**
	 * Fired when any entity (player or enemy) dies.
	 * LootService listens to this for spawning drops.
	 */
	readonly onEntityDied = new Signal<
		(
			entityId: EntityId,
			position: Vector3,
			entityType: string,
			killer?: Player,
		) => void
	>();

	/**
	 * Heal a player by the specified amount.
	 * Called by StatsService when maxHealth increases.
	 *
	 * Stub implementation: logs to console.
	 * TODO: Real implementation handles actual healing with health cap.
	 */
	healPlayer(player: Player, amount: number): void {
		// Stub: In the real implementation, this heals the player
		// and fires HealthChanged events. For now, just log.
		print(
			`[CombatServiceStub] healPlayer called: ${player.Name} +${amount} HP`,
		);
	}

	/**
	 * Test helper: Manually fire onEntityDied for testing loot drops.
	 * TODO: Remove when real CombatService is available.
	 */
	testFireEntityDied(
		entityId: EntityId,
		position: Vector3,
		entityType: string,
		killer?: Player,
	): void {
		this.onEntityDied.Fire(entityId, position, entityType, killer);
	}
}
