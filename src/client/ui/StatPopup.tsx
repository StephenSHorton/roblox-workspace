/**
 * StatPopup - Animated "+X Stat!" text on stat gain.
 *
 * Fades in, floats upward, then fades out after 2 seconds.
 */

import Roact from "@rbxts/roact";
import {
	useEffect,
	useMutable,
	useState,
	withHooks,
} from "@rbxts/roact-hooked";
import type { PlayerStats } from "shared/types/stats";

interface StatPopupProps {
	stat: keyof PlayerStats;
	amount: number;
	index: number;
}

const STAT_DISPLAY_NAMES: Record<keyof PlayerStats, string> = {
	damage: "Damage",
	attackSpeed: "Attack Speed",
	moveSpeed: "Move Speed",
	maxHealth: "Max Health",
};

const STAT_COLORS: Record<keyof PlayerStats, Color3> = {
	damage: Color3.fromRGB(255, 100, 100),
	attackSpeed: Color3.fromRGB(255, 200, 100),
	moveSpeed: Color3.fromRGB(100, 200, 255),
	maxHealth: Color3.fromRGB(100, 255, 100),
};

function StatPopupComponent({
	stat,
	amount,
	index,
}: StatPopupProps): Roact.Element {
	const [transparency, setTransparency] = useState(1);
	const [offsetY, setOffsetY] = useState(0);
	const isMounted = useMutable(true);

	const formatAmount = (stat: keyof PlayerStats, value: number): string => {
		if (stat === "attackSpeed") {
			return `+${string.format("%.2f", value)}`;
		}
		return `+${math.floor(value)}`;
	};

	useEffect(() => {
		// Mark as mounted
		isMounted.current = true;

		// Animate in
		task.spawn(() => {
			// Fade in quickly
			for (let i = 0; i <= 10; i++) {
				if (!isMounted.current) return;
				setTransparency(1 - i / 10);
				task.wait(0.02);
			}

			// Float upward slowly
			for (let i = 0; i < 80; i++) {
				if (!isMounted.current) return;
				setOffsetY(-i * 0.5);
				task.wait(0.02);
			}

			// Fade out
			for (let i = 0; i <= 10; i++) {
				if (!isMounted.current) return;
				setTransparency(i / 10);
				task.wait(0.02);
			}
		});

		// Cleanup: mark as unmounted to stop animation
		return () => {
			isMounted.current = false;
		};
	}, []);

	return (
		<textlabel
			Key={`Popup_${stat}_${index}`}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={new UDim2(0.5, 0, 0.5, offsetY - index * 30)}
			Size={new UDim2(1, 0, 0, 30)}
			BackgroundTransparency={1}
			TextColor3={STAT_COLORS[stat]}
			TextTransparency={transparency}
			TextStrokeColor3={Color3.fromRGB(0, 0, 0)}
			TextStrokeTransparency={transparency * 0.5}
			TextSize={20}
			Font="GothamBold"
			Text={`${formatAmount(stat, amount)} ${STAT_DISPLAY_NAMES[stat]}!`}
		/>
	);
}

export const StatPopup = withHooks(StatPopupComponent);
