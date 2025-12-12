import { BaseComponent, Component } from "@flamework/components";
import type { OnStart } from "@flamework/core";
import { CollisionGroups } from "server/collision-groups";

interface DoorInstance extends Model {
	Top: Part & {
		HingeConstraint: HingeConstraint;
		Attachment0: Attachment;
	};
	Right: Part;
	Left: Part;
	Door: Part & {
		Close: Sound;
		Open: Sound;
		Attachment1: Attachment;
		ProximityPrompt: ProximityPrompt;
	};
}

interface Attributes {
	/** The maximum angle the door can open to */
	MaxAngle: number;
	/** The direction the door swings */
	SwingDirection: "Left" | "Right";
	/** The speed at which the door swings open/closed */
	SwingSpeed: number;
}

@Component({
	tag: "Door",
	defaults: {
		MaxAngle: 135,
		SwingDirection: "Right",
		SwingSpeed: 2,
	},
})
export class Door
	extends BaseComponent<Attributes, DoorInstance>
	implements OnStart
{
	private isOpen = false;

	onStart() {
		// Set collision groups
		this.instance.Left.CollisionGroup = CollisionGroups.Props;
		this.instance.Right.CollisionGroup = CollisionGroups.Props;

		this.instance.Door.CollisionGroup = CollisionGroups.ActiveProps;

		// Connect proximity prompt to open/close door
		this.setupPrompt();
	}

	/**
	 * Sets up the proximity prompt to open and close the door
	 */
	private setupPrompt() {
		const proximityPrompt = this.instance.Door.ProximityPrompt;
		const hinge = this.instance.Top.HingeConstraint;
		const closeSound = this.instance.Door.Close;
		const openSound = this.instance.Door.Open;

		hinge.GetPropertyChangedSignal("TargetAngle").Connect(() => {
			if (hinge.TargetAngle === 0) {
				task.delay(1, () => {
					if (this.isOpen) return;
					closeSound.Play();
				});
			} else {
				openSound.Play();
			}
		});

		const targetAngle =
			this.attributes.MaxAngle *
			(this.attributes.SwingDirection === "Left" ? -1 : 1);

		hinge.AngularSpeed = this.attributes.SwingSpeed;

		this.instance.Door.ProximityPrompt.Triggered.Connect(() => {
			if (hinge.TargetAngle === 0) {
				this.isOpen = true;
				hinge.TargetAngle = targetAngle;
				proximityPrompt.ActionText = "Close";
			} else {
				this.isOpen = false;
				hinge.TargetAngle = 0;
				proximityPrompt.ActionText = "Open";
			}
		});
	}
}
