import { BaseComponent, Component } from "@flamework/components";
import type { OnStart } from "@flamework/core";
import Maid from "@rbxts/maid";
import { Debris, Players, TweenService } from "@rbxts/services";
import type { LeaderboardService } from "server/services/LeaderboardService";

interface CoinInstance extends BasePart {
	CollectSound: Sound;
}

type Attributes = {};

@Component({
	tag: "Coin",
})
export class Coin
	extends BaseComponent<Attributes, CoinInstance>
	implements OnStart
{
	private readonly SCORE_VALUE = 10;
	private readonly maid = new Maid();

	constructor(private leaderboardService: LeaderboardService) {
		super();
	}

	onStart() {
		this.spinCoin();
		this.instance.Touched.Connect((otherPart) => this.onTouched(otherPart));
		this.instance.Destroying.Connect(() => this.onDestroy());
	}

	private onTouched(otherPart: BasePart) {
		const character = otherPart.Parent;
		if (!character) return;

		const player = Players.GetPlayerFromCharacter(character);
		if (!player) return;

		this.leaderboardService.changeScore(player, this.SCORE_VALUE);
		this.instance.CollectSound.Play();
		this.instance.Transparency = 1;

		Debris.AddItem(this.instance, this.instance.CollectSound.TimeLength);
	}

	private spinCoin() {
		const tween = TweenService.Create(
			this.instance,
			new TweenInfo(
				5,
				Enum.EasingStyle.Linear,
				Enum.EasingDirection.InOut,
				-1,
				true,
			),
			{
				CFrame: this.instance.CFrame.mul(CFrame.Angles(0, math.rad(180), 0)),
			},
		);
		tween.Play();

		this.maid.GiveTask(tween);
	}

	private onDestroy() {
		this.maid.DoCleaning();
	}
}
