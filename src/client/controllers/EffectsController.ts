import { Controller, type OnStart } from "@flamework/core";
import { CollectionService, Players, Workspace } from "@rbxts/services";
import { Events } from "client/network";
import {
	getEnemyIdFromEntityId,
	getPlayerUserIdFromEntityId,
	isEnemyEntityId,
	isPlayerEntityId,
} from "shared/network";

/**
 * EffectsController - Handles visual and audio effects.
 *
 * Subscribes to combat events and creates visual feedback:
 * - Attack VFX when players attack
 * - Damage numbers when entities are hit
 * - Loot visual effects
 */
@Controller()
export class EffectsController implements OnStart {
	onStart(): void {
		// Attack effect - show swing animation/particles
		Events.AttackEffect.connect((userId, position, direction) => {
			this.playAttackEffect(userId, position, direction);
		});

		// Hit effect - show damage numbers
		Events.HitEffect.connect((entityId, damage) => {
			this.playHitEffect(entityId, damage);
		});

		// Loot effects
		Events.LootSpawned.connect((lootId, position, rarity) => {
			this.playLootSpawnEffect(lootId, position, rarity);
		});

		Events.LootCollected.connect((lootId, collectorUserId) => {
			this.playLootCollectEffect(lootId, collectorUserId);
		});
	}

	private playAttackEffect(
		userId: number,
		position: Vector3,
		direction: Vector3,
	): void {
		// Only play for local player or nearby players
		const player = Players.GetPlayerByUserId(userId);
		if (!player) return;

		const character = player.Character;
		if (!character) return;

		// Simple visual feedback - could be expanded with particles/animations
		const rootPart = character.FindFirstChild("HumanoidRootPart") as
			| BasePart
			| undefined;
		if (!rootPart) return;

		// Create a simple slash effect
		const slash = new Instance("Part");
		slash.Name = "SlashEffect";
		slash.Size = new Vector3(0.2, 0.2, 4);
		slash.CFrame = new CFrame(
			position.add(direction.mul(2)),
			position.add(direction.mul(4)),
		);
		slash.Anchored = true;
		slash.CanCollide = false;
		slash.Material = Enum.Material.Neon;
		slash.Color = Color3.fromRGB(255, 200, 100);
		slash.Transparency = 0.3;
		slash.Parent = Workspace;

		// Fade out and destroy with safety check
		task.spawn(() => {
			for (let i = 0; i < 5; i++) {
				task.wait(0.02);
				if (!slash.Parent) return; // Instance was destroyed externally
				slash.Transparency = 0.3 + i * 0.14;
			}
			slash.Destroy();
		});
	}

	private playHitEffect(entityId: string, damage: number): void {
		// Find the entity in workspace
		let targetPosition: Vector3 | undefined;

		if (isPlayerEntityId(entityId) === true) {
			// Player entity - format: "player_{userId}"
			const userId = getPlayerUserIdFromEntityId(entityId);
			if (userId !== undefined) {
				const player = Players.GetPlayerByUserId(userId);
				const character = player?.Character;
				const rootPart = character?.FindFirstChild("HumanoidRootPart") as
					| BasePart
					| undefined;
				targetPosition = rootPart?.Position;
			}
		} else if (isEnemyEntityId(entityId) === true) {
			// Enemy entity - format: "enemy_{enemyId}"
			const enemyId = getEnemyIdFromEntityId(entityId);

			// Use CollectionService for better performance
			for (const instance of CollectionService.GetTagged("Enemy")) {
				if (instance.IsA("Model")) {
					const id = instance.GetAttribute("EnemyId");
					if (id === enemyId) {
						const primaryPart =
							instance.PrimaryPart ??
							(instance.FindFirstChild("HumanoidRootPart") as
								| BasePart
								| undefined);
						targetPosition = primaryPart?.Position;
						break;
					}
				}
			}
		}

		if (!targetPosition) return;

		// Create damage number
		this.createDamageNumber(targetPosition, damage);
	}

	private createDamageNumber(position: Vector3, damage: number): void {
		const billboard = new Instance("BillboardGui");
		billboard.Name = "DamageNumber";
		billboard.Size = new UDim2(0, 100, 0, 50);
		billboard.StudsOffset = new Vector3(0, 2, 0);
		billboard.AlwaysOnTop = true;
		billboard.MaxDistance = 100;

		// Create an attachment point
		const part = new Instance("Part");
		part.Name = "DamageAnchor";
		part.Size = new Vector3(0.1, 0.1, 0.1);
		part.Position = position;
		part.Anchored = true;
		part.CanCollide = false;
		part.Transparency = 1;
		part.Parent = Workspace;

		billboard.Adornee = part;

		const label = new Instance("TextLabel");
		label.Size = new UDim2(1, 0, 1, 0);
		label.BackgroundTransparency = 1;
		label.Text = tostring(math.floor(damage));
		label.TextColor3 = Color3.fromRGB(255, 80, 80);
		label.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
		label.TextStrokeTransparency = 0.5;
		label.TextScaled = true;
		label.Font = Enum.Font.GothamBold;
		label.Parent = billboard;

		billboard.Parent = part;

		// Animate and destroy with safety check
		task.spawn(() => {
			for (let i = 0; i < 20; i++) {
				task.wait(0.05);
				if (!part.Parent) return; // Instance was destroyed externally
				part.Position = part.Position.add(new Vector3(0, 0.1, 0));
				label.TextTransparency = i / 20;
				label.TextStrokeTransparency = 0.5 + (i / 20) * 0.5;
			}
			part.Destroy();
		});
	}

	private playLootSpawnEffect(
		_lootId: string,
		position: Vector3,
		rarity: string,
	): void {
		// Create a sparkle effect based on rarity
		const color =
			rarity === "Epic"
				? Color3.fromRGB(200, 100, 255)
				: rarity === "Rare"
					? Color3.fromRGB(100, 150, 255)
					: Color3.fromRGB(255, 255, 200);

		const sparkle = new Instance("Part");
		sparkle.Name = "LootSparkle";
		sparkle.Size = new Vector3(0.5, 0.5, 0.5);
		sparkle.Position = position;
		sparkle.Anchored = true;
		sparkle.CanCollide = false;
		sparkle.Material = Enum.Material.Neon;
		sparkle.Color = color;
		sparkle.Shape = Enum.PartType.Ball;
		sparkle.Parent = Workspace;

		// Quick flash and destroy with safety check
		task.spawn(() => {
			for (let i = 0; i < 10; i++) {
				task.wait(0.03);
				if (!sparkle.Parent) return; // Instance was destroyed externally
				sparkle.Size = sparkle.Size.mul(1.1);
				sparkle.Transparency = i / 10;
			}
			sparkle.Destroy();
		});
	}

	private playLootCollectEffect(
		_lootId: string,
		collectorUserId: number,
	): void {
		// Only show effect for local player
		if (collectorUserId !== Players.LocalPlayer.UserId) return;

		// Could add a pickup sound or screen flash here
		// For now, the stat popup from StatsController handles the visual feedback
	}
}
