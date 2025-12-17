import { Networking } from "@flamework/networking";
import type { LootRarity, PlayerStats } from "./types/stats";

interface ClientToServerEvents {}

interface ServerToClientEvents {
	/** Full stats update sent when stats change */
	StatsUpdated: (stats: PlayerStats) => void;
	/** Individual stat gain notification for UI popups */
	StatGained: (statName: keyof PlayerStats, amount: number) => void;
	/** Loot spawned in the world */
	LootSpawned: (lootId: string, position: Vector3, rarity: LootRarity) => void;
	/** Loot was collected by a player */
	LootCollected: (lootId: string, collectorUserId: number) => void;
}

interface ClientToServerFunctions {}

interface ServerToClientFunctions {}

export const GlobalEvents = Networking.createEvent<
	ClientToServerEvents,
	ServerToClientEvents
>();
export const GlobalFunctions = Networking.createFunction<
	ClientToServerFunctions,
	ServerToClientFunctions
>();
