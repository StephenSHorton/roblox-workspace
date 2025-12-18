import { Controller, type OnStart } from "@flamework/core";
import Roact from "@rbxts/roact";
import { Players } from "@rbxts/services";
import Signal from "@rbxts/signal";
import { Events } from "client/network";
import { BossHealthBar } from "client/ui/BossHealthBar";
import { GameHUD } from "client/ui/GameHUD";
import { LobbyUI } from "client/ui/LobbyUI";
import { VictoryScreen } from "client/ui/VictoryScreen";
import { createPlayerEntityId } from "shared/network";
import type { GamePhase, PhaseData } from "shared/types/gameState";

/**
 * UIController - Manages all HUD and UI components.
 *
 * Subscribes to game state events and mounts/unmounts
 * UI components based on the current phase.
 */
@Controller()
export class UIController implements OnStart {
	private playerGui!: PlayerGui;

	// UI handles
	private lobbyHandle?: Roact.Tree;
	private hudHandle?: Roact.Tree;
	private bossHandle?: Roact.Tree;
	private victoryHandle?: Roact.Tree;

	// State
	private currentPhase: GamePhase = "Lobby";
	private currentData: PhaseData = {};
	private isReady = false;

	// Signals for UI components
	readonly onPhaseChanged = new Signal<
		(phase: GamePhase, data: PhaseData) => void
	>();
	readonly onCountdownTick = new Signal<(seconds: number) => void>();
	readonly onPlayersAliveChanged = new Signal<
		(alive: number, total: number) => void
	>();
	readonly onPlayerReadyChanged = new Signal<
		(userId: number, isReady: boolean) => void
	>();
	readonly onHealthChanged = new Signal<
		(current: number, max: number) => void
	>();
	readonly onBossHealthChanged = new Signal<
		(current: number, max: number) => void
	>();

	// Local player health state
	private currentHealth = 100;
	private maxHealth = 100;

	// Boss health state
	private bossHealth = 0;
	private bossMaxHealth = 1;

	onStart(): void {
		this.playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;

		// Subscribe to network events
		Events.PhaseChanged.connect((phase, data) => {
			this.currentPhase = phase;
			this.currentData = data;
			this.updateUIForPhase(phase);
			this.onPhaseChanged.Fire(phase, data);
		});

		Events.CountdownTick.connect((seconds) => {
			this.onCountdownTick.Fire(seconds);
		});

		Events.PlayersAliveChanged.connect((alive, total) => {
			this.onPlayersAliveChanged.Fire(alive, total);
		});

		Events.PlayerReadyChanged.connect((userId, isReady) => {
			this.onPlayerReadyChanged.Fire(userId, isReady);
		});

		// Subscribe to health changes for local player
		const localEntityId = createPlayerEntityId(Players.LocalPlayer.UserId);
		Events.HealthChanged.connect((entityId, current, max) => {
			if (entityId === localEntityId) {
				this.currentHealth = current;
				this.maxHealth = max;
				this.onHealthChanged.Fire(current, max);
			}
		});

		// Subscribe to boss health changes
		Events.BossHealthChanged.connect((current, max) => {
			this.bossHealth = current;
			this.bossMaxHealth = max;
			this.onBossHealthChanged.Fire(current, max);
		});

		// Mount initial UI
		this.updateUIForPhase(this.currentPhase);
	}

	// ==================== Public API ====================

	/**
	 * Get the current game phase.
	 */
	getPhase(): GamePhase {
		return this.currentPhase;
	}

	/**
	 * Get current phase data.
	 */
	getPhaseData(): PhaseData {
		return this.currentData;
	}

	/**
	 * Check if local player is ready.
	 */
	isPlayerReady(): boolean {
		return this.isReady;
	}

	/**
	 * Get local player's current health.
	 */
	getHealth(): { current: number; max: number } {
		return { current: this.currentHealth, max: this.maxHealth };
	}

	/**
	 * Get boss's current health.
	 */
	getBossHealth(): { current: number; max: number } {
		return { current: this.bossHealth, max: this.bossMaxHealth };
	}

	/**
	 * Set the local player's ready state.
	 */
	setReady(ready: boolean): void {
		this.isReady = ready;
		if (ready) {
			Events.PlayerReady.fire();
		} else {
			Events.PlayerUnready.fire();
		}
	}

	// ==================== UI Management ====================

	private updateUIForPhase(phase: GamePhase): void {
		// Unmount phase-specific UIs that shouldn't be visible
		switch (phase) {
			case "Lobby":
			case "Countdown":
				this.mountLobby();
				this.unmountHUD();
				this.unmountBossHealth();
				this.unmountVictory();
				break;
			case "Dungeon":
				this.unmountLobby();
				this.mountHUD();
				this.unmountBossHealth();
				this.unmountVictory();
				break;
			case "Boss":
				this.unmountLobby();
				this.mountHUD();
				this.mountBossHealth();
				this.unmountVictory();
				break;
			case "PvPCountdown":
			case "PvP":
				this.unmountLobby();
				this.mountHUD();
				this.unmountBossHealth();
				this.unmountVictory();
				break;
			case "Victory":
				this.unmountLobby();
				this.unmountHUD();
				this.unmountBossHealth();
				this.mountVictory();
				// Reset ready state for next round
				this.isReady = false;
				break;
		}
	}

	// ==================== Mount/Unmount Methods ====================

	private mountLobby(): void {
		if (this.lobbyHandle) return;

		const element = Roact.createElement(LobbyUI, {
			controller: this,
		});
		this.lobbyHandle = Roact.mount(element, this.playerGui, "LobbyUI");
	}

	private unmountLobby(): void {
		if (this.lobbyHandle) {
			Roact.unmount(this.lobbyHandle);
			this.lobbyHandle = undefined;
		}
	}

	private mountHUD(): void {
		if (this.hudHandle) return;

		const element = Roact.createElement(GameHUD, {
			controller: this,
		});
		this.hudHandle = Roact.mount(element, this.playerGui, "GameHUD");
	}

	private unmountHUD(): void {
		if (this.hudHandle) {
			Roact.unmount(this.hudHandle);
			this.hudHandle = undefined;
		}
	}

	private mountBossHealth(): void {
		if (this.bossHandle) return;

		const element = Roact.createElement(BossHealthBar, {
			controller: this,
		});
		this.bossHandle = Roact.mount(element, this.playerGui, "BossHealthBar");
	}

	private unmountBossHealth(): void {
		if (this.bossHandle) {
			Roact.unmount(this.bossHandle);
			this.bossHandle = undefined;
		}
	}

	private mountVictory(): void {
		if (this.victoryHandle) return;

		const element = Roact.createElement(VictoryScreen, {
			controller: this,
		});
		this.victoryHandle = Roact.mount(element, this.playerGui, "VictoryScreen");
	}

	private unmountVictory(): void {
		if (this.victoryHandle) {
			Roact.unmount(this.victoryHandle);
			this.victoryHandle = undefined;
		}
	}
}
