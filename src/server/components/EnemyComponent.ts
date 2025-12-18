import { BaseComponent, Component } from "@flamework/components";
import type { OnStart } from "@flamework/core";
import { RunService } from "@rbxts/services";
import { Events } from "server/network";
import type { CombatService } from "server/services/CombatService";
import { ENEMY_AI } from "shared/config/combat";
import {
	BOSS,
	ENEMIES,
	type EnemyConfig,
	type EnemyType,
	type EntityType,
} from "shared/config/enemies";
import { createEnemyEntityId, type EntityId } from "shared/network";

/**
 * Enemy AI states.
 */
export enum EnemyState {
	Idle = "Idle",
	Chase = "Chase",
	Attack = "Attack",
}

/**
 * Attributes stored on enemy model instances.
 */
interface EnemyAttributes {
	EnemyId: string;
	EnemyType: string;
	RoomId?: string;
}

/**
 * EnemyComponent - Manages AI behavior for individual enemy instances.
 *
 * Attaches to any model tagged with "Enemy" and handles:
 * - AI state machine (Idle, Chase, Attack)
 * - Target acquisition and tracking
 * - Damage and death handling
 *
 * For boss enemies (also tagged with "Boss"), fires BossHealthChanged events.
 */
@Component({ tag: "Enemy" })
export class EnemyComponent
	extends BaseComponent<EnemyAttributes, Model>
	implements OnStart
{
	// Component state
	private health = 0;
	private maxHealth = 0;
	private config!: EnemyConfig;
	private state = EnemyState.Idle;
	private target?: Player;
	private attackStartTime?: number;
	private isBoss = false;
	private roomId?: string;
	private heartbeatConnection?: RBXScriptConnection;

	constructor(private combatService: CombatService) {
		super();
	}

	onStart() {
		// Read attributes from model - can be EnemyType or "Boss"
		const enemyType = this.attributes.EnemyType as EntityType;
		this.roomId = this.attributes.RoomId;

		// Determine if this is a boss (check tag OR attribute - tag takes precedence)
		this.isBoss = this.instance.HasTag("Boss") || enemyType === "Boss";

		// Get config based on enemy type
		if (this.isBoss) {
			this.config = BOSS;
		} else if (enemyType in ENEMIES) {
			this.config = ENEMIES[enemyType as EnemyType];
		} else {
			warn(`Unknown enemy type: ${enemyType}, using default config`);
			this.config = { health: 50, damage: 10, speed: 12, attackWindup: 0.5 };
		}

		// Initialize health from config
		this.health = this.config.health;
		this.maxHealth = this.config.health;

		// Fire initial boss health if this is a boss
		if (this.isBoss) {
			Events.BossHealthChanged.broadcast(this.health, this.maxHealth);
		}

		// Start AI heartbeat loop
		this.heartbeatConnection = RunService.Heartbeat.Connect(() =>
			this.updateAI(),
		);
	}

	/**
	 * Called when the component is destroyed (model removed).
	 * Cleans up the heartbeat connection.
	 */
	override destroy() {
		if (this.heartbeatConnection) {
			this.heartbeatConnection.Disconnect();
			this.heartbeatConnection = undefined;
		}
		super.destroy();
	}

	// ==================== Public API ====================

	/**
	 * Get the enemy's unique ID.
	 */
	getEnemyId(): string {
		return this.attributes.EnemyId;
	}

	/**
	 * Get the enemy's entity ID for network events.
	 */
	getEntityId(): EntityId {
		return createEnemyEntityId(this.attributes.EnemyId);
	}

	/**
	 * Get the room this enemy belongs to.
	 */
	getRoomId(): string | undefined {
		return this.roomId;
	}

	/**
	 * Check if this enemy is a boss.
	 */
	getIsBoss(): boolean {
		return this.isBoss;
	}

	/**
	 * Check if enemy is alive.
	 */
	isAlive(): boolean {
		return this.health > 0;
	}

	/**
	 * Get current health.
	 */
	getHealth(): number {
		return this.health;
	}

	/**
	 * Get maximum health.
	 */
	getMaxHealth(): number {
		return this.maxHealth;
	}

	/**
	 * Deal damage to this enemy.
	 * @param amount Damage amount
	 * @param attacker Optional attacking player for kill credit
	 */
	takeDamage(amount: number, attacker?: Player): void {
		if (this.health <= 0) return;

		this.health = math.max(0, this.health - amount);

		// Fire hit effect for damage numbers
		Events.HitEffect.broadcast(this.getEntityId(), amount);

		// Boss health bar update
		if (this.isBoss) {
			Events.BossHealthChanged.broadcast(this.health, this.maxHealth);
		}

		// Check for death
		if (this.health <= 0) {
			this.handleDeath(attacker);
		}
	}

	/**
	 * Clear target reference if it matches the given player.
	 * Called when a player leaves to prevent stale references.
	 */
	clearTargetIfPlayer(player: Player): void {
		if (this.target === player) {
			this.target = undefined;
			this.state = EnemyState.Idle;
		}
	}

	// ==================== AI State Machine ====================

	private updateAI(): void {
		if (this.health <= 0) return;

		const humanoid = this.instance.FindFirstChild("Humanoid") as
			| Humanoid
			| undefined;
		const rootPart = this.instance.FindFirstChild("HumanoidRootPart") as
			| BasePart
			| undefined;

		if (!humanoid || !rootPart) return;

		const position = rootPart.Position;

		switch (this.state) {
			case EnemyState.Idle:
				this.handleIdleState(position);
				break;

			case EnemyState.Chase:
				this.handleChaseState(position, humanoid);
				break;

			case EnemyState.Attack:
				this.handleAttackState(position, humanoid);
				break;
		}
	}

	private handleIdleState(position: Vector3): void {
		// Look for nearby players
		const target = this.findNearestPlayer(position, ENEMY_AI.detectionRange);
		if (target) {
			this.target = target;
			this.state = EnemyState.Chase;
		}
	}

	private handleChaseState(position: Vector3, humanoid: Humanoid): void {
		// Check if target is still valid
		if (!this.target || !this.combatService.isPlayerAlive(this.target)) {
			this.target = undefined;
			this.state = EnemyState.Idle;
			return;
		}

		const targetCharacter = this.target.Character;
		const targetRootPart = targetCharacter?.FindFirstChild(
			"HumanoidRootPart",
		) as BasePart | undefined;
		if (!targetRootPart) {
			this.target = undefined;
			this.state = EnemyState.Idle;
			return;
		}

		const targetPosition = targetRootPart.Position;
		const distance = position.sub(targetPosition).Magnitude;

		// Check if in attack range
		if (distance <= ENEMY_AI.attackRange) {
			this.state = EnemyState.Attack;
			this.attackStartTime = os.clock();
			return;
		}

		// Check if target escaped detection range
		if (distance > ENEMY_AI.detectionRange * ENEMY_AI.loseTargetMultiplier) {
			this.target = undefined;
			this.state = EnemyState.Idle;
			return;
		}

		// Move towards target
		humanoid.WalkSpeed = this.config.speed;
		humanoid.MoveTo(targetPosition);
	}

	private handleAttackState(position: Vector3, humanoid: Humanoid): void {
		// Stop moving during attack
		humanoid.MoveTo(position);

		// Check if windup is complete
		const attackStartTime = this.attackStartTime ?? os.clock();
		const elapsed = os.clock() - attackStartTime;

		if (elapsed < this.config.attackWindup) {
			return; // Still winding up
		}

		// Attack complete, deal damage if target still in range
		if (this.target && this.combatService.isPlayerAlive(this.target)) {
			const targetCharacter = this.target.Character;
			const targetRootPart = targetCharacter?.FindFirstChild(
				"HumanoidRootPart",
			) as BasePart | undefined;

			if (targetRootPart) {
				const targetPosition = targetRootPart.Position;
				const distance = position.sub(targetPosition).Magnitude;

				if (distance <= ENEMY_AI.attackRange) {
					// Deal damage
					this.combatService.dealDamageToPlayer(
						this.target,
						this.config.damage,
					);
				}
			}
		}

		// Return to chase state
		this.state = EnemyState.Chase;
		this.attackStartTime = undefined;
	}

	private findNearestPlayer(
		position: Vector3,
		range: number,
	): Player | undefined {
		let nearest: Player | undefined;
		let nearestDistance = range;

		for (const player of this.combatService.getAlivePlayers()) {
			const character = player.Character;
			const rootPart = character?.FindFirstChild("HumanoidRootPart") as
				| BasePart
				| undefined;
			if (!rootPart) continue;

			const distance = position.sub(rootPart.Position).Magnitude;
			if (distance < nearestDistance) {
				nearest = player;
				nearestDistance = distance;
			}
		}

		return nearest;
	}

	// ==================== Death Handling ====================

	private handleDeath(attacker?: Player): void {
		const position = this.instance.GetPivot().Position;
		const enemyType = this.attributes.EnemyType;
		const entityType = this.isBoss
			? "Boss"
			: enemyType !== undefined && enemyType !== ""
				? enemyType
				: "Enemy";

		// Fire network event
		Events.EntityDied.broadcast(this.getEntityId(), attacker?.UserId);

		// Fire signal for loot drops and game flow
		this.combatService.onEntityDied.Fire(
			this.getEntityId(),
			position,
			entityType,
			attacker,
		);

		// Cleanup - destroy the model which will also destroy this component
		this.instance.Destroy();
	}
}
