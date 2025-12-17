import { BaseComponent, Component } from "@flamework/components";
import { Dependency, type OnStart } from "@flamework/core";
import type { GameStateService } from "server/services/GameStateService";

/**
 * RoomTriggerComponent - Detects when players enter the next room area.
 *
 * Attach to a Part with the "RoomTrigger" tag.
 *
 * When a player touches the trigger, it calls GameStateService.advanceToNextRoom()
 * to spawn enemies and update the game state. The GameStateService tracks the
 * current room index internally.
 */
@Component({ tag: "RoomTrigger" })
export class RoomTriggerComponent
	extends BaseComponent<{}, BasePart>
	implements OnStart
{
	private gameStateService!: GameStateService;
	private touchedPlayers = new Set<Player>();

	onStart(): void {
		// Defer to avoid circular dependency
		this.gameStateService = Dependency<GameStateService>();

		// Listen for touch events
		this.instance.Touched.Connect((hit) => {
			this.handleTouch(hit);
		});

		// Reset touched players when they leave
		this.instance.TouchEnded.Connect((hit) => {
			this.handleTouchEnded(hit);
		});
	}

	private handleTouch(hit: BasePart): void {
		const player = this.getPlayerFromPart(hit);
		if (!player) return;

		// Only trigger once per player until they leave
		if (this.touchedPlayers.has(player)) return;
		this.touchedPlayers.add(player);

		// Advance to the next room
		this.gameStateService.advanceToNextRoom();
	}

	private handleTouchEnded(hit: BasePart): void {
		const player = this.getPlayerFromPart(hit);
		if (!player) return;

		this.touchedPlayers.delete(player);
	}

	private getPlayerFromPart(part: BasePart): Player | undefined {
		const character = part.Parent;
		if (!character?.IsA("Model")) return undefined;

		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!humanoid) return undefined;

		const player = game.GetService("Players").GetPlayerFromCharacter(character);
		return player ?? undefined;
	}
}
