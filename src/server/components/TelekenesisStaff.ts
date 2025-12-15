import { BaseComponent, Component } from "@flamework/components";
import type { OnStart } from "@flamework/core";
import Maid from "@rbxts/maid";
import { Players, Workspace } from "@rbxts/services";
import { Events } from "server/network";

interface TelekenesisStaffInstance extends Tool {
	Handle: Part;
}

interface Attributes {}

@Component({
	tag: "TelekenesisStaff",
})
export class TelekenesisStaff
	extends BaseComponent<Attributes, TelekenesisStaffInstance>
	implements OnStart
{
	private readonly maid = new Maid();

	private currentTarget?: BasePart;

	onStart() {
		this.instance.Destroying.Connect(() => this.onDestroy());

		this.instance.Equipped.Connect(() => {
			const character = this.instance.Parent;
			if (!character) return;

			const equippedPlayer = Players.GetPlayerFromCharacter(character);
			if (!equippedPlayer) return;

			const attachment = new Instance("Attachment");
			attachment.Name = "TelekenesisAttachment";

			const targetPart = new Instance("Part");
			targetPart.Name = "TelekenesisTargetPart";
			targetPart.Size = new Vector3(0.1, 0.1, 0.1);
			targetPart.BrickColor = new BrickColor("Bright blue");
			targetPart.CanCollide = false;
			targetPart.Shape = Enum.PartType.Ball;
			targetPart.TopSurface = Enum.SurfaceType.Smooth;
			targetPart.BottomSurface = Enum.SurfaceType.Smooth;
			targetPart.Anchored = true;

			attachment.Parent = targetPart;
			targetPart.Parent = Workspace;

			const alignPosition = new Instance("AlignPosition");
			alignPosition.Attachment1 = attachment;
			alignPosition.RigidityEnabled = true;
			alignPosition.MaxForce = 5000;
			alignPosition.Responsiveness = 200;
			alignPosition.Parent = targetPart;

			const targetUpdatedConnection = Events.mouseTargetUpdated.connect(
				(player, position) => {
					if (player !== equippedPlayer) return;

					targetPart.Position = position;
				},
			);

			const targetClickedConnection = Events.mouseTargetClicked.connect(
				(player, position) => {
					if (player !== equippedPlayer) return;

					// Clear previous target highlight
					if (this.currentTarget) {
						const previousHighlight =
							this.currentTarget.FindFirstChildOfClass("Highlight");
						if (previousHighlight) {
							previousHighlight.Destroy();
						}
						const previousAttachment =
							this.currentTarget.FindFirstChildOfClass("Attachment");
						if (previousAttachment) {
							previousAttachment.Destroy();
						}
						this.currentTarget = undefined;

						return;
					}

					// Find something at the position to interact with
					const rayInfo = new RaycastParams();
					rayInfo.FilterDescendantsInstances = [targetPart];
					rayInfo.FilterType = Enum.RaycastFilterType.Exclude;

					const rayResult = Workspace.Raycast(
						position.add(new Vector3(0, 5, 0)),
						new Vector3(0, -10, 0),
						rayInfo,
					);

					if (rayResult?.Instance) {
						const hitPart = rayResult.Instance;

						const highlight = new Instance("Highlight");
						highlight.Adornee = hitPart;
						highlight.FillTransparency = 1;
						highlight.OutlineColor = new BrickColor(
							"Institutional white",
						).Color;
						highlight.Parent = hitPart;

						const attachment = new Instance("Attachment");
						attachment.Parent = hitPart;

						alignPosition.Attachment0 = attachment;

						this.currentTarget = hitPart;
					}
				},
			);

			this.maid.GiveTask(targetUpdatedConnection);
			this.maid.GiveTask(targetClickedConnection);
		});
	}

	private onDestroy() {
		this.maid.DoCleaning();
	}
}
