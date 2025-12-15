import { BaseComponent, Component } from "@flamework/components";
import type { OnStart, OnTick } from "@flamework/core";
import Maid from "@rbxts/maid";
import { Players, Workspace } from "@rbxts/services";
import { Events } from "client/network";

interface TelekenesisStaffInstance extends Tool {
	Handle: Part;
}

interface Attributes {}

@Component({
	tag: "TelekenesisStaff",
})
export class TelekenesisStaff
	extends BaseComponent<Attributes, TelekenesisStaffInstance>
	implements OnStart, OnTick
{
	private readonly UPDATE_INTERVAL = 0.1;

	private readonly localPlayer = Players.LocalPlayer;
	private readonly maid = new Maid();

	private elapsedTime = 0;

	onStart() {
		this.instance.Destroying.Connect(() => this.onDestroy());

		this.instance.Equipped.Connect(() => {
			const mouse = this.localPlayer.GetMouse();

			const mouseTargetPart = new Instance("Part");
			mouseTargetPart.Name = "MouseTargetPart";
			mouseTargetPart.Size = new Vector3(1, 1, 1);
			mouseTargetPart.BrickColor = new BrickColor("Bright red");
			mouseTargetPart.CanCollide = false;
			mouseTargetPart.Anchored = true;

			mouse.TargetFilter = mouseTargetPart;

			mouseTargetPart.Parent = Workspace;

			const moveConnection = mouse.Move.Connect(() => {
				if (!mouse.Target) return;
				if (this.elapsedTime < this.UPDATE_INTERVAL) return;

				this.elapsedTime = 0;

				Events.mouseTargetUpdated.fire(mouse.Hit.Position);
			});

			const clickConnection = mouse.Button1Down.Connect(() => {
				if (!mouse.Target) return;

				Events.mouseTargetClicked.fire(mouse.Hit.Position);
			});

			this.maid.GiveTask(mouseTargetPart);
			this.maid.GiveTask(moveConnection);
			this.maid.GiveTask(clickConnection);
		});
	}

	onTick(dt: number): void {
		this.elapsedTime += dt;
	}

	private onDestroy() {
		this.maid.DoCleaning();
	}
}
