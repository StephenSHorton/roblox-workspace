/**
 * BossHealthBar - Large health bar for boss fights.
 *
 * Displays:
 * - Large centered health bar (below phase indicator)
 * - Boss name and current/max health
 */

import Roact from "@rbxts/roact";
import { useEffect, useState, withHooks } from "@rbxts/roact-hooked";
import type { UIController } from "../controllers/UIController";

interface BossHealthBarProps {
	controller: UIController;
}

function BossHealthBarComponent({
	controller,
}: BossHealthBarProps): Roact.Element {
	const initialHealth = controller.getBossHealth();
	const [health, setHealth] = useState(initialHealth.current);
	const [maxHealth, setMaxHealth] = useState(initialHealth.max);

	useEffect(() => {
		const conn = controller.onBossHealthChanged.Connect((current, max) => {
			setHealth(current);
			setMaxHealth(max);
		});

		return () => conn.Disconnect();
	}, [controller]);

	const healthPercent = maxHealth > 0 ? health / maxHealth : 0;

	return (
		<screengui ResetOnSpawn={false} ZIndexBehavior="Sibling">
			{/* Boss health bar container */}
			<frame
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 70)}
				Size={new UDim2(0, 500, 0, 40)}
				BackgroundTransparency={1}
			>
				{/* Boss name */}
				<textlabel
					Position={new UDim2(0, 0, 0, -25)}
					Size={new UDim2(1, 0, 0, 22)}
					BackgroundTransparency={1}
					TextColor3={Color3.fromRGB(255, 100, 100)}
					TextSize={18}
					Font="GothamBold"
					Text="DUNGEON BOSS"
				/>

				{/* Health bar background */}
				<frame
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={Color3.fromRGB(40, 40, 45)}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0, 6)} />

					{/* Health bar fill */}
					<frame
						Size={new UDim2(healthPercent, 0, 1, 0)}
						BackgroundColor3={Color3.fromRGB(200, 50, 50)}
						BorderSizePixel={0}
					>
						<uicorner CornerRadius={new UDim(0, 6)} />

						{/* Gradient overlay for shine effect */}
						<uigradient
							Color={
								new ColorSequence([
									new ColorSequenceKeypoint(0, Color3.fromRGB(255, 80, 80)),
									new ColorSequenceKeypoint(0.5, Color3.fromRGB(200, 50, 50)),
									new ColorSequenceKeypoint(1, Color3.fromRGB(150, 30, 30)),
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
						TextSize={16}
						Font="GothamBold"
						Text={`${math.floor(health)} / ${maxHealth}`}
						ZIndex={2}
					/>
				</frame>
			</frame>
		</screengui>
	);
}

export const BossHealthBar = withHooks(BossHealthBarComponent);
