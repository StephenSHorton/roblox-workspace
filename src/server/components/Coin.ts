import { BaseComponent, Component } from "@flamework/components";
import type { OnStart } from "@flamework/core";
import Maid from "@rbxts/maid";
import { Debris, Players, TweenService } from "@rbxts/services";
import type { LeaderboardService } from "server/services/LeaderboardService";

interface CoinInstance extends BasePart {
	CollectSound: Sound;
}

type Attributes = {
	/** ScoreValue is the number of points awarded when the coin is collected. */
	ScoreValue: number;
};

/**
 * Coin is a collectible component that awards points when touched by a player.
 */
@Component({
	tag: "Coin",
	defaults: {
		ScoreValue: 10,
	},
})
export class Coin
	extends BaseComponent<Attributes, CoinInstance>
	implements OnStart
{
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
		this.leaderboardService.changeScore(player, this.attributes.ScoreValue);

		// Play collect sound and hide the coin
		this.instance.CollectSound.Play();
		this.instance.Transparency = 1;

		// Destroy the coin after the sound finishes
		Debris.AddItem(this.instance, 2);
	}

	/**
	 * spinCoin creates and starts a continuous rotation animation for the coin.
	 */
	private spinCoin() {
		const info = new TweenInfo(
			5, // Duration of 5 seconds
			Enum.EasingStyle.Linear, // Linear easing for constant speed
			Enum.EasingDirection.InOut, // Easing direction
			-1, // Repeat indefinitely
			true, // Reverse on each repeat
		);

		// Rotate 180 degrees around the Y-axis
		const goal: Parameters<typeof TweenService.Create<CoinInstance>>[2] = {
			CFrame: this.instance.CFrame.mul(CFrame.Angles(0, math.rad(180), 0)),
		};

		const tween = TweenService.Create(this.instance, info, goal);
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
