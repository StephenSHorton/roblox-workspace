/**
 * StatsHud - Always-visible panel showing current player stats.
 *
 * Displays: damage, attackSpeed, moveSpeed, maxHealth
 * Updates when StatsUpdated event fires.
 */

import Roact from "@rbxts/roact";
import { useEffect, useState, withHooks } from "@rbxts/roact-hooked";
import type { PlayerStats } from "shared/types/stats";
import type { StatsController } from "../controllers/StatsController";
import { StatPopup } from "./StatPopup";

interface StatsHudProps {
	controller: StatsController;
}

const STAT_LABELS: Record<keyof PlayerStats, string> = {
	damage: "DMG",
	attackSpeed: "SPD",
	moveSpeed: "MOV",
	maxHealth: "HP",
};

const STAT_ORDER: (keyof PlayerStats)[] = [
	"damage",
	"attackSpeed",
	"moveSpeed",
	"maxHealth",
];

function StatsHudComponent({ controller }: StatsHudProps): Roact.Element {
	const [stats, setStats] = useState(controller.getStats());
	const [popups, setPopups] = useState<
		Array<{ id: string; stat: keyof PlayerStats; amount: number }>
	>([]);

	useEffect(() => {
		const statsConnection = controller.onStatsUpdated.Connect((newStats) => {
			setStats({ ...newStats });
		});

		const gainConnection = controller.onStatGained.Connect((stat, amount) => {
			const id = `${stat}_${os.clock()}`;
			setPopups((prev) => [...prev, { id, stat, amount }]);

			// Remove popup after animation (2 seconds)
			task.delay(2, () => {
				setPopups((prev) => prev.filter((p) => p.id !== id));
			});
		});

		return () => {
			statsConnection.Disconnect();
			gainConnection.Disconnect();
		};
	}, [controller]);

	const formatStat = (stat: keyof PlayerStats, value: number): string => {
		if (stat === "attackSpeed") {
			return string.format("%.2f", value);
		}
		return tostring(math.floor(value));
	};

	return (
		<screengui Key="StatsHud" ResetOnSpawn={false} ZIndexBehavior="Sibling">
			{/* Stats Panel */}
			<frame
				Key="StatsPanel"
				AnchorPoint={new Vector2(0, 0)}
				Position={new UDim2(0, 10, 0, 10)}
				Size={new UDim2(0, 150, 0, 120)}
				BackgroundColor3={Color3.fromRGB(30, 30, 30)}
				BackgroundTransparency={0.3}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				<uipadding
					PaddingTop={new UDim(0, 8)}
					PaddingBottom={new UDim(0, 8)}
					PaddingLeft={new UDim(0, 12)}
					PaddingRight={new UDim(0, 12)}
				/>
				<uilistlayout SortOrder="LayoutOrder" Padding={new UDim(0, 4)} />

				{/* Title */}
				<textlabel
					Key="Title"
					LayoutOrder={0}
					Size={new UDim2(1, 0, 0, 20)}
					BackgroundTransparency={1}
					TextColor3={Color3.fromRGB(255, 255, 255)}
					TextSize={14}
					Font="GothamBold"
					Text="STATS"
					TextXAlignment="Left"
				/>

				{/* Stat Rows */}
				{STAT_ORDER.map((stat, index) => (
					<frame
						Key={stat}
						LayoutOrder={index + 1}
						Size={new UDim2(1, 0, 0, 18)}
						BackgroundTransparency={1}
					>
						<textlabel
							Key="Label"
							Size={new UDim2(0.4, 0, 1, 0)}
							BackgroundTransparency={1}
							TextColor3={Color3.fromRGB(180, 180, 180)}
							TextSize={12}
							Font="Gotham"
							Text={STAT_LABELS[stat]}
							TextXAlignment="Left"
						/>
						<textlabel
							Key="Value"
							Position={new UDim2(0.4, 0, 0, 0)}
							Size={new UDim2(0.6, 0, 1, 0)}
							BackgroundTransparency={1}
							TextColor3={Color3.fromRGB(255, 255, 255)}
							TextSize={12}
							Font="GothamBold"
							Text={formatStat(stat, stats[stat])}
							TextXAlignment="Right"
						/>
					</frame>
				))}
			</frame>

			{/* Stat Popups Container */}
			<frame
				Key="PopupsContainer"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.4, 0)}
				Size={new UDim2(0, 300, 0, 200)}
				BackgroundTransparency={1}
			>
				{popups.map((popup, index) => (
					<StatPopup
						Key={popup.id}
						stat={popup.stat}
						amount={popup.amount}
						index={index}
					/>
				))}
			</frame>
		</screengui>
	);
}

export const StatsHud = withHooks(StatsHudComponent);
