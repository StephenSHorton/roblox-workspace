import { type OnStart, Service } from "@flamework/core";
import { Players } from "@rbxts/services";

/**
 * LeaderboardService manages player scores and leaderstats.
 */
@Service({})
export class LeaderboardService implements OnStart {
	private playerStats: Map<Player, { score: number }> = new Map();

	onStart() {
		// Initialize leaderstats for each player when they join
		Players.PlayerAdded.Connect((player) => {
			// Create leaderstats folder
			const leaderstats = new Instance("Folder");
			leaderstats.Name = "leaderstats";
			leaderstats.Parent = player;

			// Create Score IntValue
			const score = new Instance("IntValue");
			score.Name = "Score";
			score.Value = 0;
			score.Parent = leaderstats;

			// Store initial player statss
			this.playerStats.set(player, { score: score.Value });
		});
	}

	/**
	 * changeScore changes the score of a player by a given amount.
	 * @param player the player whose score is to be changed
	 * @param amount the amount to change the score by
	 */
	changeScore(player: Player, amount: number) {
		// Find the player's stats
		const stats = this.playerStats.get(player);

		// If stats exist, update the score
		if (stats) {
			stats.score += amount;
			const leaderstats = player.FindFirstChild("leaderstats") as Folder;
			const scoreValue = leaderstats.FindFirstChild("Score") as IntValue;
			scoreValue.Value = stats.score;
		}
	}
}
