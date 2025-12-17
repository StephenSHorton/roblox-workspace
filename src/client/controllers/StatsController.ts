/**
 * StatsController - Client-side stat state management.
 *
 * Subscribes to server stat events and maintains local state.
 * Provides stat values for UI binding and manages stat popups.
 */

import { Controller, type OnStart } from "@flamework/core";
import Roact from "@rbxts/roact";
import { Players } from "@rbxts/services";
import Signal from "@rbxts/signal";
import { Events } from "client/network";
import { StatsHud } from "client/ui/StatsHud";
import { BASE_STATS, type PlayerStats } from "shared/types/stats";

@Controller()
export class StatsController implements OnStart {
	private currentStats: PlayerStats = { ...BASE_STATS };
	private hudHandle?: Roact.Tree;

	/**
	 * Fired when a stat is gained (for popup animations).
	 */
	readonly onStatGained = new Signal<
		(statName: keyof PlayerStats, amount: number) => void
	>();

	/**
	 * Fired when stats are updated.
	 */
	readonly onStatsUpdated = new Signal<(stats: PlayerStats) => void>();

	onStart(): void {
		// Subscribe to server events
		Events.StatsUpdated.connect((stats) => {
			this.currentStats = stats;
			this.onStatsUpdated.Fire(stats);
		});

		Events.StatGained.connect((statName, amount) => {
			this.onStatGained.Fire(statName, amount);
		});

		// Mount HUD
		this.mountHud();
	}

	// ==================== Public API ====================

	/**
	 * Get current player stats.
	 */
	getStats(): Readonly<PlayerStats> {
		return this.currentStats;
	}

	/**
	 * Get a specific stat value.
	 */
	getStat(stat: keyof PlayerStats): number {
		return this.currentStats[stat];
	}

	// ==================== UI Management ====================

	private mountHud(): void {
		const player = Players.LocalPlayer;
		const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

		const element = Roact.createElement(StatsHud, {
			controller: this,
		});

		this.hudHandle = Roact.mount(element, playerGui, "StatsHud");
	}

	/**
	 * Unmount the HUD (for cleanup or hiding during certain game phases).
	 */
	unmountHud(): void {
		if (this.hudHandle) {
			Roact.unmount(this.hudHandle);
			this.hudHandle = undefined;
		}
	}

	/**
	 * Remount the HUD (for showing after hidden).
	 */
	remountHud(): void {
		if (!this.hudHandle) {
			this.mountHud();
		}
	}
}
