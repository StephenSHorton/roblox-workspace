import { BaseComponent, Component } from "@flamework/components";
import type { OnStart } from "@flamework/core";
import Maid from "@rbxts/maid";
import { Debris, Players, TweenService } from "@rbxts/services";
import type { LeaderboardService } from "server/services/LeaderboardService";

interface CoinInstance extends BasePart {
	CollectSound: Sound;
}

type Attributes = {};

/**
 * Coin is a collectible component that awards points when touched by a player.
 */
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
		// Start the coin spinning animation
		this.spinCoin();

		// Connect touch and destroy event handlers
		this.instance.Touched.Connect((otherPart) => this.onTouched(otherPart));
		this.instance.Destroying.Connect(() => this.onDestroy());
	}

	/**
	 * onTouched handles when something touches the coin.
	 * @param otherPart the part that touched the coin
	 */
	private onTouched(otherPart: BasePart) {
		// Get the character from the touched part
		const character = otherPart.Parent;
		if (!character) return;

		// Verify a player touched the coin
		const player = Players.GetPlayerFromCharacter(character);
		if (!player) return;

		// Award points to the player
		this.leaderboardService.changeScore(player, this.SCORE_VALUE);

		// Play collect sound and hide the coin
		this.instance.CollectSound.Play();
		this.instance.Transparency = 1;

		// Destroy the coin after the sound finishes
		Debris.AddItem(this.instance, this.instance.CollectSound.TimeLength);
	}

	/**
	 * spinCoin creates and starts a continuous rotation animation for the coin.
	 */
	private spinCoin() {
		// Create a tween that rotates the coin 180 degrees
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

		// Track the tween for cleanup
		this.maid.GiveTask(tween);
	}

	/**
	 * onDestroy cleans up resources when the coin is destroyed.
	 */
	private onDestroy() {
		this.maid.DoCleaning();
	}
}
