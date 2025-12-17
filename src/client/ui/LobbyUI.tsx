/**
 * LobbyUI - Lobby screen with ready system.
 *
 * Displays:
 * - Ready/Unready button
 * - Player count (ready / total)
 * - Countdown when starting
 */

import Roact from "@rbxts/roact";
import { useEffect, useState, withHooks } from "@rbxts/roact-hooked";
import type { UIController } from "../controllers/UIController";

interface LobbyUIProps {
	controller: UIController;
}

function LobbyUIComponent({ controller }: LobbyUIProps): Roact.Element {
	const [isReady, setIsReady] = useState(controller.isPlayerReady());
	const [countdown, setCountdown] = useState(0);
	const [phase, setPhase] = useState(controller.getPhase());
	const [playersReady, setPlayersReady] = useState(
		controller.getPhaseData().playersReady ?? 0,
	);
	const [playersTotal, setPlayersTotal] = useState(
		controller.getPhaseData().playersTotal ?? 0,
	);

	useEffect(() => {
		const phaseConn = controller.onPhaseChanged.Connect((newPhase, data) => {
			setPhase(newPhase);
			setPlayersReady(data.playersReady ?? 0);
			setPlayersTotal(data.playersTotal ?? 0);
		});

		const countdownConn = controller.onCountdownTick.Connect((seconds) => {
			setCountdown(seconds);
		});

		const readyConn = controller.onPlayerReadyChanged.Connect(() => {
			// Update counts when any player's ready state changes
			const data = controller.getPhaseData();
			setPlayersReady(data.playersReady ?? 0);
			setPlayersTotal(data.playersTotal ?? 0);
		});

		return () => {
			phaseConn.Disconnect();
			countdownConn.Disconnect();
			readyConn.Disconnect();
		};
	}, [controller]);

	const toggleReady = () => {
		const newReady = !isReady;
		setIsReady(newReady);
		controller.setReady(newReady);
	};

	const isCountingDown = phase === "Countdown";

	return (
		<screengui ResetOnSpawn={false} ZIndexBehavior="Sibling">
			{/* Center panel */}
			<frame
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				Size={new UDim2(0, 400, 0, 300)}
				BackgroundColor3={Color3.fromRGB(30, 30, 40)}
				BackgroundTransparency={0.2}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 12)} />
				<uipadding
					PaddingTop={new UDim(0, 20)}
					PaddingBottom={new UDim(0, 20)}
					PaddingLeft={new UDim(0, 20)}
					PaddingRight={new UDim(0, 20)}
				/>

				{/* Title */}
				<textlabel
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(1, 0, 0, 40)}
					BackgroundTransparency={1}
					TextColor3={Color3.fromRGB(255, 255, 255)}
					TextSize={28}
					Font="GothamBold"
					Text="DUNGEON LOBBY"
				/>

				{/* Subtitle */}
				<textlabel
					Position={new UDim2(0, 0, 0, 45)}
					Size={new UDim2(1, 0, 0, 20)}
					BackgroundTransparency={1}
					TextColor3={Color3.fromRGB(150, 150, 150)}
					TextSize={14}
					Font="Gotham"
					Text="Survive the dungeon, defeat the boss, then fight!"
				/>

				{/* Player count */}
				<textlabel
					Position={new UDim2(0, 0, 0, 90)}
					Size={new UDim2(1, 0, 0, 30)}
					BackgroundTransparency={1}
					TextColor3={Color3.fromRGB(200, 200, 200)}
					TextSize={18}
					Font="Gotham"
					Text={`Players Ready: ${playersReady} / ${playersTotal}`}
				/>

				{/* Countdown or ready button */}
				{isCountingDown ? (
					<frame
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={new UDim2(0.5, 0, 0.6, 0)}
						Size={new UDim2(0, 200, 0, 120)}
						BackgroundTransparency={1}
					>
						<textlabel
							Size={new UDim2(1, 0, 0, 30)}
							BackgroundTransparency={1}
							TextColor3={Color3.fromRGB(180, 180, 180)}
							TextSize={16}
							Font="Gotham"
							Text="Starting in..."
						/>
						<textlabel
							Position={new UDim2(0, 0, 0, 30)}
							Size={new UDim2(1, 0, 0, 80)}
							BackgroundTransparency={1}
							TextColor3={Color3.fromRGB(255, 200, 100)}
							TextSize={72}
							Font="GothamBold"
							Text={tostring(countdown)}
						/>
					</frame>
				) : (
					<textbutton
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={new UDim2(0.5, 0, 0.65, 0)}
						Size={new UDim2(0.7, 0, 0, 60)}
						BackgroundColor3={
							isReady
								? Color3.fromRGB(80, 180, 80)
								: Color3.fromRGB(80, 100, 180)
						}
						BorderSizePixel={0}
						TextColor3={Color3.fromRGB(255, 255, 255)}
						TextSize={22}
						Font="GothamBold"
						Text={isReady ? "READY!" : "Click to Ready Up"}
						Event={{ MouseButton1Click: toggleReady }}
					>
						<uicorner CornerRadius={new UDim(0, 10)} />
					</textbutton>
				)}

				{/* Instructions */}
				<textlabel
					AnchorPoint={new Vector2(0.5, 1)}
					Position={new UDim2(0.5, 0, 1, -10)}
					Size={new UDim2(0.9, 0, 0, 20)}
					BackgroundTransparency={1}
					TextColor3={Color3.fromRGB(120, 120, 120)}
					TextSize={12}
					Font="Gotham"
					Text="Left-click to attack enemies"
				/>
			</frame>
		</screengui>
	);
}

export const LobbyUI = withHooks(LobbyUIComponent);
