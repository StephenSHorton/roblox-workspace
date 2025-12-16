import { BaseComponent, Component } from "@flamework/components";
import type { OnStart } from "@flamework/core";
import { TweenService } from "@rbxts/services";

interface CryptGateAttributes {}

@Component({ tag: "CryptGate" })
export class CryptGateComponent extends BaseComponent<CryptGateAttributes, Model> implements OnStart {
	private isOpen = false;
	private isTweening = false;
	private proximityPrompt?: ProximityPrompt;
	private originalPositions = new Map<BasePart, CFrame>();

	onStart() {
		print("CryptGate: Component started on", this.instance.Name);

		const detector = this.instance.FindFirstChild("GateProximityDetector") as Part | undefined;
		if (!detector) {
			warn("CryptGate: No proximity detector found on", this.instance.Name);
			return;
		}

		// Create ProximityPrompt for E key interaction
		const prompt = new Instance("ProximityPrompt");
		prompt.ActionText = "Open";
		prompt.ObjectText = "Gate";
		prompt.KeyboardKeyCode = Enum.KeyCode.E;
		prompt.HoldDuration = 0;
		prompt.MaxActivationDistance = 10;
		prompt.RequiresLineOfSight = false;
		prompt.Parent = detector;

		this.proximityPrompt = prompt;

		// Store original positions of gate parts
		const gate = this.instance.FindFirstChild("Gate") as Model | undefined;
		if (gate) {
			const gateParts = gate.GetDescendants().filter((c) => c.IsA("BasePart")) as BasePart[];
			for (const part of gateParts) {
				this.originalPositions.set(part, part.CFrame);
			}
			print("CryptGate: Found gate with", gateParts.size(), "parts");
		} else {
			warn("CryptGate: No Gate model found");
		}

		// Handle E key press
		prompt.Triggered.Connect((player) => {
			print("CryptGate: Triggered by", player.Name);
			if (this.isOpen) {
				this.closeGate();
			} else {
				this.openGate();
			}
		});

		print("CryptGate: Initialized with ProximityPrompt (Press E)");
	}

	private openGate() {
		if (this.isTweening) return;

		const gate = this.instance.FindFirstChild("Gate") as Model | undefined;
		if (!gate) return;

		this.isTweening = true;
		this.isOpen = true;

		if (this.proximityPrompt) {
			this.proximityPrompt.ActionText = "Close";
		}

		const tweenInfo = new TweenInfo(1.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);

		const gateParts = gate.GetDescendants().filter((c) => c.IsA("BasePart")) as BasePart[];

		// Slide gate down into the ground and fade out
		for (const part of gateParts) {
			const currentCFrame = part.CFrame;
			const targetCFrame = currentCFrame.sub(new Vector3(0, 8, 0)); // Slide down 8 studs

			const tween = TweenService.Create(part, tweenInfo, {
				CFrame: targetCFrame,
				Transparency: 1,
			});
			tween.Play();

			// Disable collision when hidden
			task.delay(1.5, () => {
				part.CanCollide = false;
			});
		}

		task.delay(1.5, () => {
			this.isTweening = false;
		});

		print("CryptGate: Opening gate (sliding down)");
	}

	private closeGate() {
		if (this.isTweening) return;

		const gate = this.instance.FindFirstChild("Gate") as Model | undefined;
		if (!gate) return;

		this.isTweening = true;
		this.isOpen = false;

		if (this.proximityPrompt) {
			this.proximityPrompt.ActionText = "Open";
		}

		const tweenInfo = new TweenInfo(1.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);

		const gateParts = gate.GetDescendants().filter((c) => c.IsA("BasePart")) as BasePart[];

		// Slide gate back up from the ground and fade in
		for (const part of gateParts) {
			// Re-enable collision first
			part.CanCollide = true;

			const originalCFrame = this.originalPositions.get(part);
			if (originalCFrame) {
				const tween = TweenService.Create(part, tweenInfo, {
					CFrame: originalCFrame,
					Transparency: part.Name === "GateHinge" ? 1 : 0, // Keep hinge invisible
				});
				tween.Play();
			}
		}

		task.delay(1.5, () => {
			this.isTweening = false;
		});

		print("CryptGate: Closing gate (sliding up)");
	}
}
