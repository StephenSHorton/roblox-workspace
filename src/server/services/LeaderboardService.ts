import { type OnStart, Service } from "@flamework/core";
import { DataStoreService, Players } from "@rbxts/services";

interface PlayerData {
	score: number;
}

const DEFAULT_PLAYER_DATA: PlayerData = {
	score: 0,
};

/**
 * LeaderboardService manages player scores and leaderstats.
 */
@Service({})
export class LeaderboardService implements OnStart {
	private readonly playerStats: Map<Player, PlayerData> = new Map();
	private readonly dataStore = DataStoreService.GetDataStore("PlayerData");

	onStart() {
		// Initialize leaderstats for each player when they join
		Players.PlayerAdded.Connect((player) => {
			// Load saved data from DataStore
			const playerData = this.loadPlayerData(player);

			// Create leaderstats folder
			const leaderstats = new Instance("Folder");
			leaderstats.Name = "leaderstats";
			leaderstats.Parent = player;

			// Create Score IntValue with loaded value
			const score = new Instance("IntValue");
			score.Name = "Score";
			score.Value = playerData.score;
			score.Parent = leaderstats;

			// Store player stats
			this.playerStats.set(player, playerData);
		});

		// Save data when player leaves
		Players.PlayerRemoving.Connect((player) => {
			this.savePlayerData(player);
			this.playerStats.delete(player);
		});

		// Save all players' data on server shutdown
		game.BindToClose(() => {
			for (const player of Players.GetPlayers()) {
				this.savePlayerData(player);
			}
		});
	}

	/**
	 * changeScore changes the score of a player by a given amount.
	 * @param player the player whose score is to be changed
	 * @param amount the amount to change the score by
	 */
	changeScore(player: Player, amount: number) {
		const stats = this.playerStats.get(player);
		if (!stats) return;

		stats.score += amount;
		const leaderstats = player.FindFirstChild("leaderstats") as Folder;
		const scoreValue = leaderstats.FindFirstChild("Score") as IntValue;
		scoreValue.Value = stats.score;
	}

	/**
	 * Loads player data from the DataStore.
	 * @param player The player whose data to load
	 * @returns The player's saved data, or defaults if none exists
	 */
	private loadPlayerData(player: Player): PlayerData {
		const key = `player_${player.UserId}`;

		const [success, result] = pcall(() => {
			const [data] = this.dataStore.GetAsync(key);
			return data as PlayerData | undefined;
		});

		if (!success) {
			warn(`Failed to load data for ${player.Name}: ${result}`);
			return { ...DEFAULT_PLAYER_DATA };
		}

		if (result === undefined) {
			return { ...DEFAULT_PLAYER_DATA };
		}

		return result;
	}

	/**
	 * Saves player data to the DataStore.
	 * @param player The player whose data to save
	 */
	private savePlayerData(player: Player): void {
		const stats = this.playerStats.get(player);
		if (!stats) return;

		const key = `player_${player.UserId}`;
		const data: PlayerData = {
			score: stats.score,
		};

		const [success, err] = pcall(() => {
			this.dataStore.SetAsync(key, data);
		});

		if (!success) {
			warn(`Failed to save data for ${player.Name}: ${err}`);
		}
	}
}
