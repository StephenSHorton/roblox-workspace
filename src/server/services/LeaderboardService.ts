import { OnStart, Service } from "@flamework/core";
import { Players } from "@rbxts/services";

@Service()
export class LeaderboardService implements OnStart {
	/**
	 * Called when the service starts
	 */
	onStart() {
		// Set up leaderboard for existing players
		Players.GetPlayers().forEach((player) => {
			this.setupLeaderboard(player);
		});

		// Set up leaderboard for new players
		Players.PlayerAdded.Connect((player) => {
			this.setupLeaderboard(player);
		});
	}

	/**
	 * Creates a leaderboard for a player with initial stats
	 */
	private setupLeaderboard(player: Player) {
		// Create leaderstats folder (required by Roblox)
		const leaderstats = new Instance("Folder");
		leaderstats.Name = "leaderstats";
		leaderstats.Parent = player;

		// Add Points stat
		const points = new Instance("IntValue");
		points.Name = "Points";
		points.Value = 0; // Starting at 0
		points.Parent = leaderstats;

		print("Leaderboard created for " + player.Name + " with " + points.Value + " points");
	}

	/**
	 * Add points to a player
	 */
	addPoints(player: Player, amount: number) {
		const leaderstats = player.FindFirstChild("leaderstats") as Folder;
		if (!leaderstats) return;

		const points = leaderstats.FindFirstChild("Points") as IntValue;
		if (points) {
			points.Value += amount;
		}
	}

	/**
	 * Get a player's points
	 */
	getPoints(player: Player): number {
		const leaderstats = player.FindFirstChild("leaderstats") as Folder;
		if (!leaderstats) return 0;

		const points = leaderstats.FindFirstChild("Points") as IntValue;
		return points ? points.Value : 0;
	}
}
