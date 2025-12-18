import { Dependency, type OnStart, Service } from "@flamework/core";
import { CollectionService, Players } from "@rbxts/services";
import Signal from "@rbxts/signal";
import { Events } from "server/network";
import {
	GAME_CONFIG,
	type GamePhase,
	type PhaseData,
} from "shared/types/gameState";
import type { CombatService } from "./CombatService";
import type { EnemyService } from "./EnemyService";
import type { LootService } from "./LootService";
import type { StatsService } from "./StatsService";

/**
 * Room state tracking for dungeon progression.
 */
interface RoomState {
	roomId: string;
	isCleared: boolean;
}

/**
 * GameStateService - Phase state machine and session orchestration.
 *
 * Manages:
 * - Game phases (Lobby → Countdown → Dungeon → Boss → PvPCountdown → PvP → Victory)
 * - Player ready system in lobby
 * - Room progression and door unlocking
 * - Victory/defeat conditions
 * - Reset flow between rounds
 */
@Service()
export class GameStateService implements OnStart {
	// Dependencies - use Dependency() for CombatService to avoid circular ref
	private combatService!: CombatService;

	constructor(
		private enemyService: EnemyService,
		private lootService: LootService,
		private statsService: StatsService,
	) {}

	// ==================== State ====================
	private phase: GamePhase = "Lobby";
	private readyPlayers = new Set<Player>();
	private currentRoomIndex = 0;
	private totalRooms = 0;
	private rooms: RoomState[] = [];
	private countdownThread?: thread;
	private isAdvancingRoom = false;
	private lastReadyToggle = new Map<Player, number>();

	// ==================== Signals ====================
	/**
	 * Fired when game phase changes.
	 * Used by other services to react to phase transitions.
	 */
	readonly onPhaseChanged = new Signal<
		(phase: GamePhase, data: PhaseData) => void
	>();

	onStart(): void {
		// Defer CombatService to avoid circular dependency
		this.combatService = Dependency<CombatService>();

		// Listen for entity deaths (enemies and players)
		this.combatService.onEntityDied.Connect(
			(entityId, _position, entityType, killer) => {
				this.handleEntityDeath(entityId, entityType, killer);
			},
		);

		// Handle player events
		Players.PlayerAdded.Connect((player) => this.handlePlayerJoined(player));
		Players.PlayerRemoving.Connect((player) => this.handlePlayerLeft(player));

		// Handle existing players (in case service starts after players join)
		for (const player of Players.GetPlayers()) {
			this.handlePlayerJoined(player);
		}

		// Handle ready/unready events
		Events.PlayerReady.connect((player) => this.handlePlayerReady(player));
		Events.PlayerUnready.connect((player) => this.handlePlayerUnready(player));

		// Initialize rooms from workspace
		this.initializeRooms();
	}

	// ==================== Public API ====================

	/**
	 * Get the current game phase.
	 */
	getCurrentPhase(): GamePhase {
		return this.phase;
	}

	/**
	 * Check if currently in a combat phase (Dungeon, Boss, or PvP).
	 */
	isInCombatPhase(): boolean {
		return (
			this.phase === "Dungeon" || this.phase === "Boss" || this.phase === "PvP"
		);
	}

	/**
	 * Check if currently in PvP phase.
	 */
	isPvPPhase(): boolean {
		return this.phase === "PvP";
	}

	/**
	 * Get current phase data for UI.
	 */
	getPhaseData(): PhaseData {
		return {
			roomIndex: this.currentRoomIndex,
			totalRooms: this.totalRooms,
			playersAlive: this.combatService.getAlivePlayers().size(),
			playersReady: this.readyPlayers.size(),
			playersTotal: Players.GetPlayers().size(),
		};
	}

	/**
	 * Called by external systems when boss is defeated.
	 * Triggers transition to PvP countdown.
	 */
	onBossDefeated(): void {
		if (this.phase === "Boss") {
			this.transitionTo("PvPCountdown");
		}
	}

	/**
	 * Called by external systems when a player dies.
	 * Checks victory conditions.
	 */
	onPlayerDied(player: Player): void {
		this.handlePlayerDeath(player);
	}

	// ==================== Phase Transitions ====================

	private transitionTo(newPhase: GamePhase, winnerId?: number): void {
		this.phase = newPhase;

		// Cancel any existing countdown
		if (this.countdownThread) {
			pcall(() => task.cancel(this.countdownThread!));
			this.countdownThread = undefined;
		}

		// Execute phase entry logic
		switch (newPhase) {
			case "Lobby":
				this.enterLobby();
				break;
			case "Countdown":
				this.enterCountdown();
				break;
			case "Dungeon":
				this.enterDungeon();
				break;
			case "Boss":
				this.enterBoss();
				break;
			case "PvPCountdown":
				this.enterPvPCountdown();
				break;
			case "PvP":
				this.enterPvP();
				break;
			case "Victory":
				this.enterVictory(winnerId);
				break;
		}

		// Broadcast phase change
		const data = this.getPhaseData();
		if (newPhase === "Victory" && winnerId !== undefined) {
			const winner = Players.GetPlayerByUserId(winnerId);
			data.winnerId = winnerId;
			data.winnerName = winner?.Name;
		}

		Events.PhaseChanged.broadcast(newPhase, data);
		this.onPhaseChanged.Fire(newPhase, data);
	}

	// ==================== Phase Entry Handlers ====================

	private enterLobby(): void {
		// Reset all game state
		this.readyPlayers.clear();
		this.currentRoomIndex = 0;
		this.rooms = [];

		// Reset services
		this.combatService.setPvPEnabled(false);
		this.combatService.resetAllPlayers();
		this.statsService.resetAllPlayerStats();
		this.lootService.despawnAllLoot();
		this.enemyService.despawnAllEnemies();

		// Teleport all players to lobby
		this.teleportAllPlayersToLobby();

		// Re-initialize rooms for next round
		this.initializeRooms();
	}

	private enterCountdown(): void {
		this.startCountdown(GAME_CONFIG.LOBBY_COUNTDOWN, () => {
			this.transitionTo("Dungeon");
		});
	}

	private enterDungeon(): void {
		// Reset players for dungeon run
		this.combatService.resetAllPlayers();

		// Teleport to first room and spawn enemies
		this.currentRoomIndex = 0;
		this.teleportPlayersToRoom(0);
		this.spawnEnemiesForRoom(0);
	}

	private enterBoss(): void {
		// Teleport to boss room
		this.teleportPlayersToBossRoom();

		// Spawn boss
		this.enemyService.spawnBoss();
	}

	private enterPvPCountdown(): void {
		this.startCountdown(GAME_CONFIG.PVP_COUNTDOWN, () => {
			this.transitionTo("PvP");
		});
	}

	private enterPvP(): void {
		this.combatService.setPvPEnabled(true);

		// Update alive count
		const alivePlayers = this.combatService.getAlivePlayers();
		Events.PlayersAliveChanged.broadcast(
			alivePlayers.size(),
			Players.GetPlayers().size(),
		);
	}

	private enterVictory(_winnerId?: number): void {
		this.combatService.setPvPEnabled(false);

		// Start victory timer
		this.startCountdown(GAME_CONFIG.VICTORY_DURATION, () => {
			this.transitionTo("Lobby");
		});
	}

	// ==================== Event Handlers ====================

	private handleEntityDeath(
		_entityId: string,
		entityType: string,
		_killer?: Player,
	): void {
		if (this.phase === "Dungeon") {
			if (entityType !== "Player") {
				// Enemy killed - check room clear
				this.handleEnemyKilled();
			} else {
				// Player died - check all dead
				this.checkAllPlayersDead();
			}
		} else if (this.phase === "Boss") {
			if (entityType === "Boss") {
				// Boss killed - transition to PvP
				this.transitionTo("PvPCountdown");
			} else if (entityType === "Player") {
				this.checkAllPlayersDead();
			}
		} else if (this.phase === "PvP") {
			if (entityType === "Player") {
				this.checkPvPVictory();
			}
		}
	}

	private handleEnemyKilled(): void {
		const room = this.rooms[this.currentRoomIndex];
		if (!room || room.isCleared) return;

		// Check if room is cleared using EnemyService
		const aliveInRoom = this.enemyService.getAliveEnemyCount(room.roomId);
		if (aliveInRoom === 0) {
			room.isCleared = true;

			Events.RoomCleared.broadcast(this.currentRoomIndex);

			// Unlock door instance
			this.unlockDoor(this.currentRoomIndex);

			// Check if should advance to boss
			if (this.currentRoomIndex >= this.totalRooms - 1) {
				// All rooms cleared - go to boss after short delay
				task.delay(2, () => {
					if (this.phase === "Dungeon") {
						this.transitionTo("Boss");
					}
				});
			}
		}
	}

	private handlePlayerDeath(_player: Player): void {
		if (this.phase === "Dungeon" || this.phase === "Boss") {
			this.checkAllPlayersDead();
		} else if (this.phase === "PvP") {
			this.checkPvPVictory();
		}
	}

	private handlePlayerReady(player: Player): void {
		if (this.phase !== "Lobby") return;

		// Rate limit: max 1 toggle per 0.5s
		const now = os.clock();
		const lastToggle = this.lastReadyToggle.get(player) ?? 0;
		if (now - lastToggle < 0.5) return;
		this.lastReadyToggle.set(player, now);

		this.readyPlayers.add(player);
		Events.PlayerReadyChanged.broadcast(player.UserId, true);

		// Check if should start countdown
		this.checkStartConditions();
	}

	private handlePlayerUnready(player: Player): void {
		if (this.phase !== "Lobby" && this.phase !== "Countdown") return;

		// Rate limit: max 1 toggle per 0.5s
		const now = os.clock();
		const lastToggle = this.lastReadyToggle.get(player) ?? 0;
		if (now - lastToggle < 0.5) return;
		this.lastReadyToggle.set(player, now);

		this.readyPlayers.delete(player);
		Events.PlayerReadyChanged.broadcast(player.UserId, false);

		// If in countdown and not enough ready players, cancel
		if (this.phase === "Countdown") {
			if (this.readyPlayers.size() < GAME_CONFIG.MIN_PLAYERS_TO_START) {
				this.transitionTo("Lobby");
			}
		}
	}

	private handlePlayerJoined(player: Player): void {
		// Send current state to joining player after a short delay
		task.delay(0.5, () => {
			if (player.Parent) {
				Events.PhaseChanged.fire(player, this.phase, this.getPhaseData());
			}
		});

		// Teleport to lobby if joining mid-game
		if (this.phase !== "Lobby" && this.phase !== "Countdown") {
			task.delay(1, () => {
				if (player.Parent) {
					this.teleportPlayerToLobby(player);
				}
			});
		}
	}

	private handlePlayerLeft(player: Player): void {
		this.readyPlayers.delete(player);
		this.lastReadyToggle.delete(player);

		// Check game state
		if (this.phase === "Countdown" || this.phase === "Lobby") {
			this.checkStartConditions();
		} else if (this.phase === "PvP") {
			this.checkPvPVictory();
		} else if (this.phase === "Dungeon" || this.phase === "Boss") {
			this.checkAllPlayersDead();
		}
	}

	// ==================== Victory Conditions ====================

	private checkAllPlayersDead(): void {
		const alivePlayers = this.combatService.getAlivePlayers();
		Events.PlayersAliveChanged.broadcast(
			alivePlayers.size(),
			Players.GetPlayers().size(),
		);

		if (alivePlayers.size() === 0 && Players.GetPlayers().size() > 0) {
			// Everyone dead - return to lobby
			this.transitionTo("Lobby");
		}
	}

	private checkPvPVictory(): void {
		const alivePlayers = this.combatService.getAlivePlayers();
		Events.PlayersAliveChanged.broadcast(
			alivePlayers.size(),
			Players.GetPlayers().size(),
		);

		if (alivePlayers.size() <= 1) {
			// Victory - one or zero players left
			const winner = alivePlayers[0];
			this.transitionTo("Victory", winner?.UserId);
		}
	}

	private checkStartConditions(): void {
		if (this.phase === "Lobby") {
			if (this.readyPlayers.size() >= GAME_CONFIG.MIN_PLAYERS_TO_START) {
				this.transitionTo("Countdown");
			}
		} else if (this.phase === "Countdown") {
			if (this.readyPlayers.size() < GAME_CONFIG.MIN_PLAYERS_TO_START) {
				this.transitionTo("Lobby");
			}
		}
	}

	// ==================== Room Management ====================

	private initializeRooms(): void {
		// Find all room spawn points
		const roomParts = CollectionService.GetTagged("Room");
		const roomCount = math.clamp(
			roomParts.size(),
			GAME_CONFIG.MIN_ROOMS,
			GAME_CONFIG.MAX_ROOMS,
		);

		this.totalRooms = math.max(roomCount, 1); // At least 1 room
		this.rooms = [];

		for (let i = 0; i < this.totalRooms; i++) {
			this.rooms.push({
				roomId: `room_${i}`,
				isCleared: false,
			});
		}
	}

	private spawnEnemiesForRoom(roomIndex: number): void {
		const room = this.rooms[roomIndex];
		if (!room) return;

		this.enemyService.spawnEnemiesForRoom(room.roomId);
	}

	private unlockDoor(roomIndex: number): void {
		const doors = CollectionService.GetTagged("Door");
		for (const door of doors) {
			const doorRoomIndex = door.GetAttribute("RoomIndex") as
				| number
				| undefined;
			if (doorRoomIndex === roomIndex && door.IsA("BasePart")) {
				door.CanCollide = false;
				door.Transparency = 0.8;
			}
		}
	}

	/**
	 * Called when player enters next room trigger.
	 * Advances to the next room and spawns enemies.
	 * Guarded against double-activation from simultaneous triggers.
	 */
	advanceToNextRoom(): void {
		if (this.phase !== "Dungeon") return;

		// Guard against double-activation
		if (this.isAdvancingRoom) return;

		const currentRoom = this.rooms[this.currentRoomIndex];
		if (!currentRoom?.isCleared) return;

		const nextIndex = this.currentRoomIndex + 1;
		if (nextIndex < this.totalRooms) {
			// Set guard before advancing
			this.isAdvancingRoom = true;

			this.currentRoomIndex = nextIndex;
			this.spawnEnemiesForRoom(nextIndex);
			Events.PhaseChanged.broadcast(this.phase, this.getPhaseData());

			// Release guard after a short delay to prevent rapid re-triggers
			task.delay(0.5, () => {
				this.isAdvancingRoom = false;
			});
		}
	}

	// ==================== Teleportation ====================

	private teleportAllPlayersToLobby(): void {
		for (const player of Players.GetPlayers()) {
			this.teleportPlayerToLobby(player);
		}
	}

	private teleportPlayerToLobby(player: Player): void {
		const spawns = CollectionService.GetTagged("LobbySpawn").filter(
			(s): s is BasePart => s.IsA("BasePart"),
		);
		if (spawns.size() === 0) return;

		const character = player.Character;
		if (character) {
			const spawn = spawns[math.random(0, spawns.size() - 1)];
			character.PivotTo(spawn.CFrame);
		}
	}

	private teleportPlayersToRoom(roomIndex: number): void {
		const spawns = CollectionService.GetTagged("Room").filter((spawn) => {
			const idx = spawn.GetAttribute("RoomIndex") as number | undefined;
			return idx === roomIndex && spawn.IsA("BasePart");
		}) as BasePart[];

		if (spawns.size() === 0) return;

		// Round-robin spawn assignment to prevent player overlap
		const players = Players.GetPlayers();
		for (let i = 0; i < players.size(); i++) {
			const player = players[i];
			const character = player.Character;
			if (character) {
				// Cycle through spawns to distribute players
				const spawnIndex = i % spawns.size();
				const spawn = spawns[spawnIndex];
				// Add slight offset if multiple players share a spawn
				const offset =
					spawns.size() < players.size()
						? new Vector3(math.floor(i / spawns.size()) * 3, 0, 0)
						: Vector3.zero;
				character.PivotTo(spawn.CFrame.add(offset));
			}
		}
	}

	private teleportPlayersToBossRoom(): void {
		const spawns = CollectionService.GetTagged("BossRoom").filter(
			(s): s is BasePart => s.IsA("BasePart"),
		);
		if (spawns.size() === 0) return;

		// Round-robin spawn assignment to prevent player overlap
		const players = Players.GetPlayers();
		for (let i = 0; i < players.size(); i++) {
			const player = players[i];
			const character = player.Character;
			if (character) {
				// Cycle through spawns to distribute players
				const spawnIndex = i % spawns.size();
				const spawn = spawns[spawnIndex];
				// Add slight offset if multiple players share a spawn
				const offset =
					spawns.size() < players.size()
						? new Vector3(math.floor(i / spawns.size()) * 3, 0, 0)
						: Vector3.zero;
				character.PivotTo(spawn.CFrame.add(offset));
			}
		}
	}

	// ==================== Countdown Utility ====================

	private startCountdown(seconds: number, onComplete: () => void): void {
		this.countdownThread = task.spawn(() => {
			for (let i = seconds; i >= 0; i--) {
				Events.CountdownTick.broadcast(i);

				if (i > 0) {
					task.wait(1);
				}
			}
			onComplete();
		});
	}
}
