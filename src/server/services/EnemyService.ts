import { Dependency, type OnStart, Service } from "@flamework/core";
import { CollectionService, RunService, ServerStorage, Workspace } from "@rbxts/services";
import { Events } from "server/network";
import { ENEMY_AI } from "shared/config/combat";
import { BOSS, BOSS_TEMPLATE_NAME, ENEMIES, type EnemyConfig, type EnemyType } from "shared/config/enemies";
import { createEnemyEntityId } from "shared/network";
import type { CombatService } from "./CombatService";

/**
 * Enemy AI states.
 */
export enum EnemyState {
	Idle = "Idle",
	Chase = "Chase",
	Attack = "Attack",
}

/**
 * Runtime data for an active enemy instance.
 */
interface EnemyInstance {
	id: string;
	model: Model;
	config: EnemyConfig;
	health: number;
	maxHealth: number;
	state: EnemyState;
	target?: Player;
	roomId?: string;
	isBoss: boolean;
	attackStartTime?: number;
}

/**
 * EnemyService - Manages all enemy instances in the dungeon.
 *
 * Handles spawning, AI behavior, and damage/death.
 * Fires CombatService.onEntityDied for loot drops.
 *
 * Note: Enemy IDs are never reset, even after despawnAllEnemies().
 * This ensures IDs remain unique across the entire game session.
 */
@Service()
export class EnemyService implements OnStart {
	private activeEnemies = new Map<string, EnemyInstance>();
	private nextEnemyId = 0;
	private combatService!: CombatService;

	onStart() {
		// Initialize dependencies after Flamework ignites
		this.combatService = Dependency<CombatService>();

		// Run AI loop on heartbeat
		RunService.Heartbeat.Connect((dt) => this.updateAI(dt));
	}

	// ==================== DEVA-009: Core Setup ====================

	private generateEnemyId(): string {
		this.nextEnemyId += 1;
		return `enemy_${this.nextEnemyId}`;
	}

	private getEntityId(enemyId: string) {
		return createEnemyEntityId(enemyId);
	}

	/**
	 * Clear all enemy target references to a specific player.
	 * Called when a player leaves to prevent stale references.
	 */
	clearTargetReferences(player: Player): void {
		for (const [, instance] of this.activeEnemies) {
			if (instance.target === player) {
				instance.target = undefined;
				instance.state = EnemyState.Idle;
			}
		}
	}

	// ==================== DEVA-010: Enemy Spawning System ====================

	/**
	 * Spawn a single enemy at position.
	 * @returns Enemy ID if successful, undefined if template not found
	 */
	spawnEnemy(enemyType: EnemyType, position: Vector3, roomId?: string): string | undefined {
		const config = ENEMIES[enemyType];

		// Clone enemy model from ServerStorage
		const enemyModels = ServerStorage.FindFirstChild("Enemies") as Folder | undefined;
		const template = enemyModels?.FindFirstChild(enemyType) as Model | undefined;

		if (!template) {
			warn(`Enemy template not found: ${enemyType}`);
			return undefined;
		}

		const enemyId = this.generateEnemyId();
		const model = template.Clone();
		model.Name = `${enemyType}_${enemyId}`;
		model.SetAttribute("EnemyId", enemyId);
		model.SetAttribute("EnemyType", enemyType);

		// Position the enemy
		model.PivotTo(new CFrame(position));

		// Tag for hit detection
		CollectionService.AddTag(model, "Enemy");

		// Parent to workspace
		model.Parent = Workspace;

		// Create instance data
		const instance: EnemyInstance = {
			id: enemyId,
			model,
			config,
			health: config.health,
			maxHealth: config.health,
			state: EnemyState.Idle,
			roomId,
			isBoss: false,
		};

		this.activeEnemies.set(enemyId, instance);

		return enemyId;
	}

	/**
	 * Spawn enemies for a dungeon room.
	 * Finds all spawn points tagged with "EnemySpawn" that have matching roomId attribute.
	 */
	spawnEnemiesForRoom(roomId: string): void {
		const spawnPoints = CollectionService.GetTagged("EnemySpawn");

		for (const spawn of spawnPoints) {
			if (!spawn.IsA("BasePart")) continue;

			const spawnRoomId = spawn.GetAttribute("RoomId") as string | undefined;
			if (spawnRoomId !== roomId) continue;

			const enemyType = spawn.GetAttribute("EnemyType") as EnemyType | undefined;
			if (!enemyType || !(enemyType in ENEMIES)) {
				warn(`Invalid enemy type on spawn point: ${enemyType}`);
				continue;
			}

			this.spawnEnemy(enemyType, spawn.Position, roomId);
		}
	}

	/**
	 * Despawn all active enemies.
	 * Used on game reset or room clear.
	 * Note: Enemy IDs are not reset to ensure uniqueness.
	 */
	despawnAllEnemies(): void {
		for (const [, instance] of this.activeEnemies) {
			if (instance.model) {
				instance.model.Destroy();
			}
		}
		this.activeEnemies.clear();
	}

	/**
	 * Get count of alive enemies in a room.
	 * Used by Game Flow to determine when room is cleared.
	 */
	getAliveEnemyCount(roomId?: string): number {
		let count = 0;
		for (const [, instance] of this.activeEnemies) {
			if (roomId === undefined || instance.roomId === roomId) {
				count += 1;
			}
		}
		return count;
	}

	// ==================== DEVA-011: Enemy AI State Machine ====================

	private updateAI(_dt: number): void {
		for (const [, instance] of this.activeEnemies) {
			this.updateEnemyAI(instance);
		}
	}

	private updateEnemyAI(instance: EnemyInstance): void {
		const humanoid = instance.model.FindFirstChild("Humanoid") as Humanoid | undefined;
		const rootPart = instance.model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

		if (!humanoid || !rootPart) return;

		const position = rootPart.Position;

		switch (instance.state) {
			case EnemyState.Idle:
				this.handleIdleState(instance, position);
				break;

			case EnemyState.Chase:
				this.handleChaseState(instance, position, humanoid);
				break;

			case EnemyState.Attack:
				this.handleAttackState(instance, position, humanoid);
				break;
		}
	}

	private handleIdleState(instance: EnemyInstance, position: Vector3): void {
		// Look for nearby players
		const target = this.findNearestPlayer(position, ENEMY_AI.detectionRange);
		if (target) {
			instance.target = target;
			instance.state = EnemyState.Chase;
		}
	}

	private handleChaseState(instance: EnemyInstance, position: Vector3, humanoid: Humanoid): void {
		// Check if target is still valid
		if (!instance.target || !this.combatService.isPlayerAlive(instance.target)) {
			instance.target = undefined;
			instance.state = EnemyState.Idle;
			return;
		}

		const targetCharacter = instance.target.Character;
		const targetRootPart = targetCharacter?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!targetRootPart) {
			instance.target = undefined;
			instance.state = EnemyState.Idle;
			return;
		}

		const targetPosition = targetRootPart.Position;
		const distance = position.sub(targetPosition).Magnitude;

		// Check if in attack range
		if (distance <= ENEMY_AI.attackRange) {
			instance.state = EnemyState.Attack;
			instance.attackStartTime = os.clock();
			return;
		}

		// Check if target escaped detection range
		if (distance > ENEMY_AI.detectionRange * ENEMY_AI.loseTargetMultiplier) {
			instance.target = undefined;
			instance.state = EnemyState.Idle;
			return;
		}

		// Move towards target
		humanoid.WalkSpeed = instance.config.speed;
		humanoid.MoveTo(targetPosition);
	}

	private handleAttackState(instance: EnemyInstance, position: Vector3, humanoid: Humanoid): void {
		// Stop moving during attack
		humanoid.MoveTo(position);

		// Check if windup is complete
		const attackStartTime = instance.attackStartTime ?? os.clock();
		const elapsed = os.clock() - attackStartTime;

		if (elapsed < instance.config.attackWindup) {
			return; // Still winding up
		}

		// Attack complete, deal damage if target still in range
		if (instance.target && this.combatService.isPlayerAlive(instance.target)) {
			const targetCharacter = instance.target.Character;
			const targetRootPart = targetCharacter?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

			if (targetRootPart) {
				const targetPosition = targetRootPart.Position;
				const distance = position.sub(targetPosition).Magnitude;

				if (distance <= ENEMY_AI.attackRange) {
					// Deal damage
					this.combatService.dealDamageToPlayer(instance.target, instance.config.damage);
				}
			}
		}

		// Return to chase state
		instance.state = EnemyState.Chase;
		instance.attackStartTime = undefined;
	}

	private findNearestPlayer(position: Vector3, range: number): Player | undefined {
		let nearest: Player | undefined;
		let nearestDistance = range;

		for (const player of this.combatService.getAlivePlayers()) {
			const character = player.Character;
			const rootPart = character?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (!rootPart) continue;

			const distance = position.sub(rootPart.Position).Magnitude;
			if (distance < nearestDistance) {
				nearest = player;
				nearestDistance = distance;
			}
		}

		return nearest;
	}

	// ==================== DEVA-012: Enemy Damage & Death ====================

	/**
	 * Deal damage to an enemy.
	 * Called by CombatService when player attacks hit.
	 */
	dealDamageToEnemy(enemyId: string, amount: number, attacker?: Player): void {
		const instance = this.activeEnemies.get(enemyId);
		if (!instance) return;

		instance.health = math.max(0, instance.health - amount);

		// Fire hit effect for damage numbers
		Events.HitEffect.broadcast(this.getEntityId(enemyId), amount);

		// Boss health bar update
		if (instance.isBoss) {
			Events.BossHealthChanged.broadcast(instance.health, instance.maxHealth);
		}

		// Check for death
		if (instance.health <= 0) {
			this.handleEnemyDeath(instance, attacker);
		}
	}

	private handleEnemyDeath(instance: EnemyInstance, attacker?: Player): void {
		const position = instance.model.GetPivot().Position;
		const entityType = instance.isBoss ? "Boss" : (instance.model.GetAttribute("EnemyType") as string) ?? "Enemy";

		// Fire network event
		Events.EntityDied.broadcast(this.getEntityId(instance.id), attacker?.UserId);

		// Fire signal for loot drops and game flow
		this.combatService.onEntityDied.Fire(this.getEntityId(instance.id), position, entityType, attacker);

		// Cleanup
		instance.model.Destroy();
		this.activeEnemies.delete(instance.id);
	}

	// ==================== DEVA-013: Boss Implementation ====================

	/**
	 * Spawn the dungeon boss.
	 * Finds "BossSpawn" tagged part for spawn location.
	 * @returns Boss enemy ID if successful, undefined if spawn point or template not found
	 */
	spawnBoss(): string | undefined {
		const bossSpawns = CollectionService.GetTagged("BossSpawn");

		if (bossSpawns.size() === 0) {
			warn("No BossSpawn point found");
			return undefined;
		}

		if (bossSpawns.size() > 1) {
			warn(`Multiple BossSpawn points found (${bossSpawns.size()}), using first one`);
		}

		const spawnPoint = bossSpawns[0] as BasePart;

		// Clone boss model from ServerStorage
		const enemyModels = ServerStorage.FindFirstChild("Enemies") as Folder | undefined;
		const template = enemyModels?.FindFirstChild(BOSS_TEMPLATE_NAME) as Model | undefined;

		if (!template) {
			warn(`Boss template "${BOSS_TEMPLATE_NAME}" not found in ServerStorage/Enemies`);
			return undefined;
		}

		const enemyId = this.generateEnemyId();
		const model = template.Clone();
		model.Name = `Boss_${enemyId}`;
		model.SetAttribute("EnemyId", enemyId);
		model.SetAttribute("EnemyType", "Boss");

		// Position the boss
		model.PivotTo(new CFrame(spawnPoint.Position));

		// Tag for hit detection
		CollectionService.AddTag(model, "Enemy");
		CollectionService.AddTag(model, "Boss");

		// Parent to workspace
		model.Parent = Workspace;

		// Create instance data with BOSS config
		const instance: EnemyInstance = {
			id: enemyId,
			model,
			config: BOSS,
			health: BOSS.health,
			maxHealth: BOSS.health,
			state: EnemyState.Idle,
			isBoss: true,
		};

		this.activeEnemies.set(enemyId, instance);

		// Fire initial boss health
		Events.BossHealthChanged.broadcast(instance.health, instance.maxHealth);

		return enemyId;
	}

	/**
	 * Check if boss is alive.
	 */
	isBossAlive(): boolean {
		for (const [, instance] of this.activeEnemies) {
			if (instance.isBoss) {
				return true;
			}
		}
		return false;
	}
}
