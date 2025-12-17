import type { Components } from "@flamework/components";
import { type OnStart, Service } from "@flamework/core";
import { CollectionService, ServerStorage, Workspace } from "@rbxts/services";
import type { EnemyComponent } from "server/components/EnemyComponent";
import {
	BOSS_TEMPLATE_NAME,
	ENEMIES,
	type EnemyType,
} from "shared/config/enemies";

/** Enemy models folder in ServerStorage. Loaded once at module initialization. */
const EnemyModels = ServerStorage.WaitForChild("Enemies") as Folder;

/**
 * EnemyService - Manages enemy spawning and despawning in the dungeon.
 *
 * Handles:
 * - Enemy/Boss spawning at designated spawn points
 * - Despawning all enemies (game reset, room clear)
 * - Querying enemy counts and boss status
 * - Routing damage to enemy components
 *
 * AI behavior is handled by EnemyComponent which auto-attaches to spawned enemies.
 * Note: Enemy IDs are never reset, even after despawnAllEnemies().
 * This ensures IDs remain unique across the entire game session.
 */
@Service()
export class EnemyService implements OnStart {
	private nextEnemyId = 0;

	constructor(private components: Components) {}

	onStart() {
		// AI is now handled by EnemyComponent via Heartbeat
		// No central AI loop needed
	}

	// ==================== ID Generation ====================

	private generateEnemyId(): string {
		this.nextEnemyId += 1;
		return `enemy_${this.nextEnemyId}`;
	}

	// ==================== Target Clearing ====================

	/**
	 * Clear all enemy target references to a specific player.
	 * Called when a player leaves to prevent stale references.
	 */
	clearTargetReferences(player: Player): void {
		const enemyComponents = this.components.getAllComponents<EnemyComponent>();
		for (const component of enemyComponents) {
			component.clearTargetIfPlayer(player);
		}
	}

	// ==================== Enemy Spawning System ====================

	/**
	 * Spawn a single enemy at position.
	 * @returns Enemy ID if successful, undefined if template not found
	 */
	spawnEnemy(
		enemyType: EnemyType,
		position: Vector3,
		roomId?: string,
	): string | undefined {
		const config = ENEMIES[enemyType];
		if (!config) {
			warn(`Unknown enemy type: ${enemyType}`);
			return undefined;
		}

		const template = EnemyModels.FindFirstChild(enemyType) as Model | undefined;
		if (!template) {
			warn(`Enemy template not found: ${enemyType}`);
			return undefined;
		}

		const enemyId = this.generateEnemyId();
		const model = template.Clone();
		model.Name = `${enemyType}_${enemyId}`;
		model.SetAttribute("EnemyId", enemyId);
		model.SetAttribute("EnemyType", enemyType);
		if (roomId !== undefined) {
			model.SetAttribute("RoomId", roomId);
		}

		// Position the enemy
		model.PivotTo(new CFrame(position));

		// Tag for component auto-attachment and hit detection
		CollectionService.AddTag(model, "Enemy");

		// Parent to workspace (this triggers component attachment)
		model.Parent = Workspace;

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

			const enemyType = spawn.GetAttribute("EnemyType") as
				| EnemyType
				| undefined;
			if (
				enemyType === undefined ||
				enemyType === "" ||
				!(enemyType in ENEMIES)
			) {
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
		const enemyComponents = this.components.getAllComponents<EnemyComponent>();
		for (const component of enemyComponents) {
			// Destroy the model, which will also destroy the component
			component.instance.Destroy();
		}
	}

	/**
	 * Get count of alive enemies in a room.
	 * Used by Game Flow to determine when room is cleared.
	 */
	getAliveEnemyCount(roomId?: string): number {
		const enemyComponents = this.components.getAllComponents<EnemyComponent>();
		let count = 0;
		for (const component of enemyComponents) {
			if (!component.isAlive()) continue;
			if (roomId === undefined || component.getRoomId() === roomId) {
				count += 1;
			}
		}
		return count;
	}

	// ==================== Enemy Damage ====================

	/**
	 * Deal damage to an enemy.
	 * Called by CombatService when player attacks hit.
	 */
	dealDamageToEnemy(enemyId: string, amount: number, attacker?: Player): void {
		// Find the component with the matching enemy ID
		const enemyComponents = this.components.getAllComponents<EnemyComponent>();
		for (const component of enemyComponents) {
			if (component.getEnemyId() === enemyId) {
				component.takeDamage(amount, attacker);
				return;
			}
		}
	}

	// ==================== Boss Implementation ====================

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
			warn(
				`Multiple BossSpawn points found (${bossSpawns.size()}), using first one`,
			);
		}

		const spawnPoint = bossSpawns[0] as BasePart;

		const template = EnemyModels.FindFirstChild(BOSS_TEMPLATE_NAME) as
			| Model
			| undefined;
		if (!template) {
			warn(
				`Boss template "${BOSS_TEMPLATE_NAME}" not found in ServerStorage/Enemies`,
			);
			return undefined;
		}

		const enemyId = this.generateEnemyId();
		const model = template.Clone();
		model.Name = `Boss_${enemyId}`;
		model.SetAttribute("EnemyId", enemyId);
		model.SetAttribute("EnemyType", "Boss");

		// Position the boss
		model.PivotTo(new CFrame(spawnPoint.Position));

		// Tag for component auto-attachment and hit detection
		CollectionService.AddTag(model, "Enemy");
		CollectionService.AddTag(model, "Boss");

		// Parent to workspace (this triggers component attachment)
		model.Parent = Workspace;

		return enemyId;
	}

	/**
	 * Check if boss is alive.
	 */
	isBossAlive(): boolean {
		const enemyComponents = this.components.getAllComponents<EnemyComponent>();
		for (const component of enemyComponents) {
			if (component.getIsBoss() && component.isAlive()) {
				return true;
			}
		}
		return false;
	}
}
