/**
 * GameHUD - Main gameplay overlay.
 *
 * Displays:
 * - Phase indicator (top center): "Room 1/4", "BOSS FIGHT", "PVP"
 * - Players alive count (top right, during PvP only)
 * - Countdown during PvPCountdown phase
 */

import Roact from "@rbxts/roact";
import { useEffect, useState, withHooks } from "@rbxts/roact-hooked";
import type { GamePhase } from "shared/types/gameState";
import type { UIController } from "../controllers/UIController";

interface GameHUDProps {
	controller: UIController;
}

function GameHUDComponent({ controller }: GameHUDProps): Roact.Element {
	const [phase, setPhase] = useState<GamePhase>(controller.getPhase());
	const [currentRoom, setCurrentRoom] = useState(
		controller.getPhaseData().roomIndex ?? 0,
	);
	const [totalRooms, setTotalRooms] = useState(
		controller.getPhaseData().totalRooms ?? 0,
	);
	const [countdown, setCountdown] = useState(0);
	const [playersAlive, setPlayersAlive] = useState(
		controller.getPhaseData().playersAlive ?? 0,
	);
	const [playersTotal, setPlayersTotal] = useState(
		controller.getPhaseData().playersTotal ?? 0,
	);

	// Health state
	const initialHealth = controller.getHealth();
	const [health, setHealth] = useState(initialHealth.current);
	const [maxHealth, setMaxHealth] = useState(initialHealth.max);

	useEffect(() => {
		const phaseConn = controller.onPhaseChanged.Connect((newPhase, data) => {
			setPhase(newPhase);
			setCurrentRoom(data.roomIndex ?? 0);
			setTotalRooms(data.totalRooms ?? 0);
			setPlayersAlive(data.playersAlive ?? 0);
			setPlayersTotal(data.playersTotal ?? 0);
		});

		const countdownConn = controller.onCountdownTick.Connect((seconds) => {
			setCountdown(seconds);
		});

		const aliveConn = controller.onPlayersAliveChanged.Connect(
			(alive, total) => {
				setPlayersAlive(alive);
				setPlayersTotal(total);
			},
		);

		const healthConn = controller.onHealthChanged.Connect((current, max) => {
			setHealth(current);
			setMaxHealth(max);
		});

		return () => {
			phaseConn.Disconnect();
			countdownConn.Disconnect();
			aliveConn.Disconnect();
			healthConn.Disconnect();
		};
	}, [controller]);

	const getPhaseText = (): string => {
		switch (phase) {
			case "Dungeon":
				return `ROOM ${currentRoom + 1} / ${totalRooms}`;
			case "Boss":
				return "BOSS FIGHT";
			case "PvPCountdown":
				return `PVP STARTING IN ${countdown}...`;
			case "PvP":
				return "LAST ONE STANDING";
			default:
				return "";
		}
	};

	const getPhaseColor = (): Color3 => {
		switch (phase) {
			case "Dungeon":
				return Color3.fromRGB(100, 180, 255);
			case "Boss":
				return Color3.fromRGB(255, 100, 100);
			case "PvPCountdown":
				return Color3.fromRGB(255, 200, 100);
			case "PvP":
				return Color3.fromRGB(255, 80, 80);
			default:
				return Color3.fromRGB(255, 255, 255);
		}
	};

	const showAliveCount = phase === "PvP" || phase === "PvPCountdown";
	const healthPercent = maxHealth > 0 ? health / maxHealth : 0;

	return (
		<screengui ResetOnSpawn={false} ZIndexBehavior="Sibling">
			{/* Bottom left - Health bar */}
			<frame
				AnchorPoint={new Vector2(0, 1)}
				Position={new UDim2(0, 10, 1, -10)}
				Size={new UDim2(0, 250, 0, 35)}
				BackgroundColor3={Color3.fromRGB(30, 30, 35)}
				BackgroundTransparency={0.3}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 6)} />

				{/* Health bar fill */}
				<frame
					Position={new UDim2(0, 4, 0, 4)}
					Size={new UDim2(healthPercent, -8, 1, -8)}
					BackgroundColor3={Color3.fromRGB(80, 200, 80)}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0, 4)} />
					<uigradient
						Color={
							new ColorSequence([
								new ColorSequenceKeypoint(0, Color3.fromRGB(100, 220, 100)),
								new ColorSequenceKeypoint(1, Color3.fromRGB(60, 160, 60)),
							])
						}
						Rotation={90}
					/>
				</frame>

				{/* Health text */}
				<textlabel
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundTransparency={1}
					TextColor3={Color3.fromRGB(255, 255, 255)}
					TextStrokeColor3={Color3.fromRGB(0, 0, 0)}
					TextStrokeTransparency={0.5}
					TextSize={14}
					Font="GothamBold"
					Text={`HP: ${math.floor(health)} / ${maxHealth}`}
					ZIndex={2}
				/>
			</frame>

			{/* Top center - Phase indicator */}
			<frame
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 10)}
				Size={new UDim2(0, 350, 0, 50)}
				BackgroundColor3={Color3.fromRGB(20, 20, 25)}
				BackgroundTransparency={0.3}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				<textlabel
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundTransparency={1}
					TextColor3={getPhaseColor()}
					TextSize={22}
					Font="GothamBold"
					Text={getPhaseText()}
				/>
			</frame>

			{/* Top right - Players alive (during PvP) */}
			{showAliveCount && (
				<frame
					AnchorPoint={new Vector2(1, 0)}
					Position={new UDim2(1, -10, 0, 10)}
					Size={new UDim2(0, 160, 0, 45)}
					BackgroundColor3={Color3.fromRGB(150, 40, 40)}
					BackgroundTransparency={0.3}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uipadding
						PaddingLeft={new UDim(0, 12)}
						PaddingRight={new UDim(0, 12)}
					/>
					<textlabel
						Size={new UDim2(1, 0, 0.5, 0)}
						BackgroundTransparency={1}
						TextColor3={Color3.fromRGB(200, 200, 200)}
						TextSize={12}
						Font="Gotham"
						Text="PLAYERS ALIVE"
						TextXAlignment="Left"
					/>
					<textlabel
						Position={new UDim2(0, 0, 0.4, 0)}
						Size={new UDim2(1, 0, 0.6, 0)}
						BackgroundTransparency={1}
						TextColor3={Color3.fromRGB(255, 255, 255)}
						TextSize={20}
						Font="GothamBold"
						Text={`${playersAlive} / ${playersTotal}`}
						TextXAlignment="Left"
					/>
				</frame>
			)}
		</screengui>
	);
}

export const GameHUD = withHooks(GameHUDComponent);
