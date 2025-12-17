/**
 * Game phase enumeration defining all possible states.
 */
export type GamePhase =
	| "Lobby"
	| "Countdown"
	| "Dungeon"
	| "Boss"
	| "PvPCountdown"
	| "PvP"
	| "Victory";

/**
 * Data associated with the current game phase.
 * Sent to clients for UI rendering.
 */
export interface PhaseData {
	/** Current countdown value (used in Countdown, PvPCountdown, Victory) */
	countdown?: number;
	/** Current dungeon room index (0-based) */
	roomIndex?: number;
	/** Total number of rooms before boss */
	totalRooms?: number;
	/** Number of players currently alive */
	playersAlive?: number;
	/** Number of players marked ready in lobby */
	playersReady?: number;
	/** Total number of players */
	playersTotal?: number;
	/** UserId of the PvP winner */
	winnerId?: number;
	/** Display name of the winner */
	winnerName?: string;
}

/**
 * Configuration constants for game flow.
 * These are locked decisions from the spec.
 */
export const GAME_CONFIG = {
	/** Seconds before game starts after players ready */
	LOBBY_COUNTDOWN: 10,
	/** Seconds before PvP begins after boss death */
	PVP_COUNTDOWN: 3,
	/** Seconds to show victory screen */
	VICTORY_DURATION: 10,
	/** Minimum players required to start countdown */
	MIN_PLAYERS_TO_START: 1,
	/** Minimum dungeon rooms before boss */
	MIN_ROOMS: 3,
	/** Maximum dungeon rooms before boss */
	MAX_ROOMS: 4,
} as const;
