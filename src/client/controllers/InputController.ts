import { Controller, type OnStart } from "@flamework/core";
import { Players, UserInputService, Workspace } from "@rbxts/services";
import { Events } from "client/network";

/**
 * InputController - Handles player input for combat actions.
 *
 * Captures mouse clicks and converts them to attack requests
 * sent to the server for validation and processing.
 */
@Controller()
export class InputController implements OnStart {
	private localPlayer = Players.LocalPlayer;

	onStart(): void {
		// Attack input - left mouse button
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed) return;

			if (input.UserInputType === Enum.UserInputType.MouseButton1) {
				this.handleAttackInput();
			}
		});
	}

	private handleAttackInput(): void {
		const direction = this.getAimDirection();
		if (direction) {
			Events.RequestAttack.fire(direction);
		}
	}

	/**
	 * Calculate the direction from the player's character to the mouse position in world space.
	 */
	private getAimDirection(): Vector3 | undefined {
		const character = this.localPlayer.Character;
		if (!character) return undefined;

		const rootPart = character.FindFirstChild("HumanoidRootPart") as
			| BasePart
			| undefined;
		if (!rootPart) return undefined;

		const camera = Workspace.CurrentCamera;
		if (!camera) return undefined;

		const mouse = this.localPlayer.GetMouse();
		const mousePosition = new Vector2(mouse.X, mouse.Y);

		// Create a ray from the camera through the mouse position
		const ray = camera.ViewportPointToRay(mousePosition.X, mousePosition.Y);

		// Raycast to find the world position
		const raycastParams = new RaycastParams();
		raycastParams.FilterType = Enum.RaycastFilterType.Exclude;
		raycastParams.FilterDescendantsInstances = [character];

		const raycastResult = Workspace.Raycast(
			ray.Origin,
			ray.Direction.mul(1000),
			raycastParams,
		);

		let targetPosition: Vector3;
		if (raycastResult) {
			targetPosition = raycastResult.Position;
		} else {
			// If no hit, project to a point 100 studs away
			targetPosition = ray.Origin.add(ray.Direction.mul(100));
		}

		// Calculate direction on XZ plane (ignore Y for horizontal attacks)
		const playerPosition = rootPart.Position;
		const direction = new Vector3(
			targetPosition.X - playerPosition.X,
			0,
			targetPosition.Z - playerPosition.Z,
		);

		// Normalize if not zero
		if (direction.Magnitude > 0) {
			return direction.Unit;
		}

		// Fallback to character's look direction
		return rootPart.CFrame.LookVector;
	}
}
