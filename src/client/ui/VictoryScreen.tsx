/**
 * VictoryScreen - End game results screen.
 *
 * Displays:
 * - Full screen overlay with dark background
 * - "VICTORY!" title
 * - Winner name (or "Dungeon Complete!" if no PvP winner)
 * - "Returning to lobby in X..." countdown
 */

import Roact from "@rbxts/roact";
import { useEffect, useState, withHooks } from "@rbxts/roact-hooked";
import type { UIController } from "../controllers/UIController";

interface VictoryScreenProps {
	controller: UIController;
}

function VictoryScreenComponent({
	controller,
}: VictoryScreenProps): Roact.Element {
	const phaseData = controller.getPhaseData();
	const [winnerName, setWinnerName] = useState<string | undefined>(
		phaseData.winnerName,
	);
	const [countdown, setCountdown] = useState(10);

	useEffect(() => {
		const phaseConn = controller.onPhaseChanged.Connect((_phase, data) => {
			if (data.winnerName !== undefined) {
				setWinnerName(data.winnerName);
			}
		});

		const countdownConn = controller.onCountdownTick.Connect((seconds) => {
			setCountdown(seconds);
		});

		return () => {
			phaseConn.Disconnect();
			countdownConn.Disconnect();
		};
	}, [controller]);

	return (
		<screengui ResetOnSpawn={false} ZIndexBehavior="Sibling">
			{/* Full screen dark overlay */}
			<frame
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundColor3={Color3.fromRGB(0, 0, 0)}
				BackgroundTransparency={0.4}
				BorderSizePixel={0}
			>
				{/* Victory panel */}
				<frame
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(0, 500, 0, 350)}
					BackgroundColor3={Color3.fromRGB(25, 25, 35)}
					BackgroundTransparency={0.1}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0, 16)} />

					{/* Decorative border */}
					<uistroke
						Color={Color3.fromRGB(255, 215, 0)}
						Thickness={2}
						Transparency={0.5}
					/>

					{/* Victory text */}
					<textlabel
						Position={new UDim2(0, 0, 0, 40)}
						Size={new UDim2(1, 0, 0, 80)}
						BackgroundTransparency={1}
						TextColor3={Color3.fromRGB(255, 215, 0)}
						TextSize={56}
						Font="GothamBold"
						Text="VICTORY!"
					>
						{/* Text stroke for emphasis */}
						<uistroke
							Color={Color3.fromRGB(180, 120, 0)}
							Thickness={2}
							Transparency={0.3}
						/>
					</textlabel>

					{/* Winner info */}
					<frame
						Position={new UDim2(0, 0, 0, 130)}
						Size={new UDim2(1, 0, 0, 80)}
						BackgroundTransparency={1}
					>
						{winnerName !== undefined ? (
							<>
								<textlabel
									Size={new UDim2(1, 0, 0, 25)}
									BackgroundTransparency={1}
									TextColor3={Color3.fromRGB(180, 180, 180)}
									TextSize={16}
									Font="Gotham"
									Text="CHAMPION"
								/>
								<textlabel
									Position={new UDim2(0, 0, 0, 25)}
									Size={new UDim2(1, 0, 0, 45)}
									BackgroundTransparency={1}
									TextColor3={Color3.fromRGB(255, 255, 255)}
									TextSize={32}
									Font="GothamBold"
									Text={winnerName}
								/>
							</>
						) : (
							<textlabel
								Size={new UDim2(1, 0, 1, 0)}
								BackgroundTransparency={1}
								TextColor3={Color3.fromRGB(255, 255, 255)}
								TextSize={28}
								Font="GothamBold"
								Text="Dungeon Complete!"
							/>
						)}
					</frame>

					{/* Divider line */}
					<frame
						AnchorPoint={new Vector2(0.5, 0)}
						Position={new UDim2(0.5, 0, 0, 220)}
						Size={new UDim2(0.7, 0, 0, 2)}
						BackgroundColor3={Color3.fromRGB(80, 80, 90)}
						BorderSizePixel={0}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
					</frame>

					{/* Return countdown */}
					<textlabel
						Position={new UDim2(0, 0, 0, 250)}
						Size={new UDim2(1, 0, 0, 30)}
						BackgroundTransparency={1}
						TextColor3={Color3.fromRGB(150, 150, 150)}
						TextSize={16}
						Font="Gotham"
						Text={`Returning to lobby in ${countdown}...`}
					/>

					{/* Hint text */}
					<textlabel
						Position={new UDim2(0, 0, 0, 290)}
						Size={new UDim2(1, 0, 0, 20)}
						BackgroundTransparency={1}
						TextColor3={Color3.fromRGB(100, 100, 100)}
						TextSize={12}
						Font="Gotham"
						Text="Get ready for the next round!"
					/>
				</frame>
			</frame>
		</screengui>
	);
}

export const VictoryScreen = withHooks(VictoryScreenComponent);
