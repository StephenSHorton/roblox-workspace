import { Dependency, type OnStart, Service } from "@flamework/core";
import { CollectionService, Players } from "@rbxts/services";
import Signal from "@rbxts/signal";
import { Events } from "server/network";
import { PLAYER, PLAYER_ATTACK } from "shared/config/combat";
import { createPlayerEntityId, type EntityId } from "shared/network";

/**
 * Combat state tracked for each player.
 * Managed by CombatService as the single source of truth.
 */
interface PlayerCombatState {
	health: number;
	maxHealth: number;
	damage: number;
	attackSpeed: number;
	lastAttackTime: number;
	isAlive: boolean;
	invulnerable: boolean;
}

/**
 * CombatService - Server-authoritative combat system.
 *
 * Manages all player combat state, damage dealing, and attack validation.
 * Fires signals when entities die (used by loot and game flow systems).
 */
@Service()
export class CombatService implements OnStart {
	private playerStates = new Map<Player, PlayerCombatState>();
	private pvpEnabled = false;
	private enemyService!: import("./EnemyService").EnemyService;

	/**
	 * Fired when any entity (player or enemy) dies.
	 * Used by Dev B for loot drops and Dev C for game progression.
	 */
	readonly onEntityDied = new Signal<
		(
			entityId: EntityId,
			position: Vector3,
			entityType: string,
			killer?: Player,
		) => void
	>();

	onStart() {
		// Initialize dependencies after Flamework ignites
		this.enemyService = Dependency<import("./EnemyService").EnemyService>();

		// Initialize state for players already in game
		for (const player of Players.GetPlayers()) {
			this.initializePlayer(player);
		}

		// Handle player join/leave
		Players.PlayerAdded.Connect((player) => this.initializePlayer(player));
		Players.PlayerRemoving.Connect((player) => this.cleanupPlayer(player));

		// Listen for attack requests
		Events.RequestAttack.connect((player, direction) => {
			this.handleAttackRequest(player, direction);
		});
	}

	// ==================== DEVA-003: Player State Management ====================

	private initializePlayer(player: Player): void {
		this.playerStates.set(player, {
			health: PLAYER.health,
			maxHealth: PLAYER.maxHealth,
			damage: PLAYER.damage,
			attackSpeed: PLAYER.attackSpeed,
			lastAttackTime: 0,
			isAlive: true,
			invulnerable: false,
		});

		// Fire initial health state
		const state = this.playerStates.get(player);
		if (state) {
			Events.HealthChanged.fire(
				player,
				this.getEntityId(player),
				state.health,
				state.maxHealth,
			);
		}
	}

	private cleanupPlayer(player: Player): void {
		this.playerStates.delete(player);
		// Notify EnemyService to clear any stale target references
		this.enemyService.clearTargetReferences(player);
	}

	private getEntityId(player: Player): EntityId {
		return createPlayerEntityId(player.UserId);
	}

	// ==================== DEVA-004: Player Stats Public API ====================

	/**
	 * Get player's current damage value.
	 * Used by loot system to display/modify damage.
	 */
	getPlayerDamage(player: Player): number {
		return this.playerStates.get(player)?.damage ?? PLAYER.damage;
	}

	/**
	 * Get player's current health.
	 */
	getPlayerHealth(player: Player): number {
		return this.playerStates.get(player)?.health ?? 0;
	}

	/**
	 * Get player's maximum health.
	 */
	getMaxHealth(player: Player): number {
		return this.playerStates.get(player)?.maxHealth ?? PLAYER.maxHealth;
	}

	/**
	 * Get player's attack speed multiplier.
	 */
	getAttackSpeed(player: Player): number {
		return this.playerStates.get(player)?.attackSpeed ?? PLAYER.attackSpeed;
	}

	/**
	 * Set player's damage value.
	 * Called by loot system when player picks up damage boost.
	 */
	setPlayerDamage(player: Player, damage: number): void {
		const state = this.playerStates.get(player);
		if (state) {
			state.damage = damage;
		}
	}

	/**
	 * Set player's maximum health.
	 * Clamps current health if it exceeds new max.
	 */
	setMaxHealth(player: Player, maxHealth: number): void {
		const state = this.playerStates.get(player);
		if (state) {
			state.maxHealth = maxHealth;
			if (state.health > maxHealth) {
				state.health = maxHealth;
				Events.HealthChanged.fire(
					player,
					this.getEntityId(player),
					state.health,
					state.maxHealth,
				);
			}
		}
	}

	/**
	 * Set player's attack speed multiplier.
	 * Higher values = faster attacks.
	 */
	setAttackSpeed(player: Player, attackSpeed: number): void {
		const state = this.playerStates.get(player);
		if (state) {
			state.attackSpeed = attackSpeed;
		}
	}

	/**
	 * Heal player by amount, capped at max health.
	 */
	healPlayer(player: Player, amount: number): void {
		const state = this.playerStates.get(player);
		if (state?.isAlive) {
			state.health = math.min(state.health + amount, state.maxHealth);
			Events.HealthChanged.fire(
				player,
				this.getEntityId(player),
				state.health,
				state.maxHealth,
			);
		}
	}

	// ==================== DEVA-005: Player Damage & Death System ====================

	/**
	 * Deal damage to a player. Server-authoritative.
	 * @param player Target player
	 * @param amount Damage amount
	 * @param attacker Optional attacker for kill credit
	 */
	dealDamageToPlayer(player: Player, amount: number, attacker?: Player): void {
		const state = this.playerStates.get(player);
		if (!state || !state.isAlive || state.invulnerable) {
			return;
		}

		state.health = math.max(0, state.health - amount);
		Events.HealthChanged.fire(
			player,
			this.getEntityId(player),
			state.health,
			state.maxHealth,
		);
		Events.HitEffect.fire(player, this.getEntityId(player), amount);

		// Check for death
		if (state.health <= 0) {
			state.isAlive = false;

			const character = player.Character;
			const position = character?.GetPivot().Position ?? Vector3.zero;

			// Fire network event
			Events.EntityDied.broadcast(this.getEntityId(player), attacker?.UserId);

			// Fire signal for other services
			this.onEntityDied.Fire(
				this.getEntityId(player),
				position,
				"Player",
				attacker,
			);

			// Handle character death
			const humanoid = character?.FindFirstChild("Humanoid") as
				| Humanoid
				| undefined;
			if (humanoid) {
				humanoid.Health = 0;
			}
		}
	}

	/**
	 * Check if player is alive.
	 */
	isPlayerAlive(player: Player): boolean {
		return this.playerStates.get(player)?.isAlive ?? false;
	}

	// ==================== DEVA-006: Melee Attack System ====================

	private handleAttackRequest(player: Player, direction: Vector3): void {
		const state = this.playerStates.get(player);
		if (!state || !state.isAlive) {
			return;
		}

		// Validate direction (prevent NaN from zero vector or malformed input)
		const magnitude = direction.Magnitude;
		if (
			magnitude === 0 ||
			tostring(magnitude) === "nan" ||
			magnitude === math.huge
		) {
			return;
		}

		// Validate cooldown
		const now = os.clock();
		const cooldown = PLAYER_ATTACK.cooldown / state.attackSpeed;
		if (now - state.lastAttackTime < cooldown) {
			return; // Rapid request ignored
		}
		state.lastAttackTime = now;

		const character = player.Character;
		const rootPart = character?.FindFirstChild("HumanoidRootPart") as
			| BasePart
			| undefined;
		if (!rootPart) {
			return;
		}

		const attackPosition = rootPart.Position;
		const normalizedDirection = direction.Unit;

		// Fire attack effect for VFX
		Events.AttackEffect.broadcast(
			player.UserId,
			attackPosition,
			normalizedDirection,
		);

		// Find and damage enemies in attack arc
		this.performMeleeAttack(
			player,
			attackPosition,
			normalizedDirection,
			state.damage,
		);
	}

	private performMeleeAttack(
		player: Player,
		position: Vector3,
		direction: Vector3,
		damage: number,
	): void {
		const hitEnemies = new Set<string>();

		// Get all enemies tagged with "Enemy"
		const enemies = CollectionService.GetTagged("Enemy");
		for (const enemy of enemies) {
			if (!enemy.IsA("Model")) continue;

			const primaryPart =
				enemy.PrimaryPart ??
				(enemy.FindFirstChild("HumanoidRootPart") as BasePart | undefined);
			if (!primaryPart) continue;

			if (
				this.isInAttackArc(
					position,
					direction,
					primaryPart.Position,
					PLAYER_ATTACK.range,
					PLAYER_ATTACK.arcDegrees,
				)
			) {
				const enemyId = enemy.GetAttribute("EnemyId") as string | undefined;
				if (
					enemyId !== undefined &&
					enemyId !== "" &&
					!hitEnemies.has(enemyId)
				) {
					hitEnemies.add(enemyId);
					this.enemyService.dealDamageToEnemy(enemyId, damage, player);
				}
			}
		}

		// ==================== DEVA-007: PvP System ====================
		if (this.pvpEnabled) {
			for (const otherPlayer of Players.GetPlayers()) {
				if (otherPlayer === player) continue;
				if (!this.isPlayerAlive(otherPlayer)) continue;

				const otherCharacter = otherPlayer.Character;
				const otherRootPart = otherCharacter?.FindFirstChild(
					"HumanoidRootPart",
				) as BasePart | undefined;
				if (!otherRootPart) continue;

				if (
					this.isInAttackArc(
						position,
						direction,
						otherRootPart.Position,
						PLAYER_ATTACK.range,
						PLAYER_ATTACK.arcDegrees,
					)
				) {
					this.dealDamageToPlayer(otherPlayer, damage, player);
				}
			}
		}
	}

	/**
	 * Enable or disable PvP mode.
	 * Called by Game Flow after boss death to start betrayal phase.
	 */
	setPvPEnabled(enabled: boolean): void {
		this.pvpEnabled = enabled;
	}

	/**
	 * Check if PvP is currently enabled.
	 */
	isPvPEnabled(): boolean {
		return this.pvpEnabled;
	}

	// ==================== DEVA-008: Game Flow Utility Methods ====================

	/**
	 * Set player invulnerability.
	 * Used during room transitions and respawns.
	 */
	setPlayerInvulnerable(player: Player, invulnerable: boolean): void {
		const state = this.playerStates.get(player);
		if (state) {
			state.invulnerable = invulnerable;
		}
	}

	/**
	 * Get all currently alive players.
	 * Used by Game Flow to determine winner in PvP.
	 */
	getAlivePlayers(): Player[] {
		const alive: Player[] = [];
		for (const [player, state] of this.playerStates) {
			if (state.isAlive) {
				alive.push(player);
			}
		}
		return alive;
	}

	/**
	 * Reset player to full health and alive state.
	 * Used between rounds or after death in lobby.
	 */
	resetPlayer(player: Player): void {
		const state = this.playerStates.get(player);
		if (state) {
			state.health = state.maxHealth;
			state.isAlive = true;
			state.invulnerable = false;
			state.lastAttackTime = 0;
			Events.HealthChanged.fire(
				player,
				this.getEntityId(player),
				state.health,
				state.maxHealth,
			);
		}
	}

	/**
	 * Reset all players to default state.
	 * Used at game start or full reset.
	 */
	resetAllPlayers(): void {
		for (const [player] of this.playerStates) {
			this.resetPlayer(player);
		}
	}

	/**
	 * Check if a target position is within attack arc.
	 * @param attackerPos Position of the attacker
	 * @param attackDirection Direction the attacker is facing/attacking
	 * @param targetPos Position of the target
	 * @param range Maximum range in studs
	 * @param arcDegrees Total arc width in degrees
	 * @returns true if target is within the attack arc
	 */
	private isInAttackArc(
		attackerPos: Vector3,
		attackDirection: Vector3,
		targetPos: Vector3,
		range: number,
		arcDegrees: number,
	): boolean {
		const toTarget = targetPos.sub(attackerPos);
		const distance = toTarget.Magnitude;

		if (distance > range || distance === 0) return false;

		const toTargetNormalized = toTarget.Unit;
		const dot = attackDirection.Dot(toTargetNormalized);
		const angleThreshold = math.cos(math.rad(arcDegrees / 2));

		return dot >= angleThreshold;
	}
}
