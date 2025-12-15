import { PhysicsService } from "@rbxts/services";

export const CollisionGroups = {
	Props: "Props",
	ActiveProps: "Active Props",
} as const;

PhysicsService.RegisterCollisionGroup(CollisionGroups.Props);
PhysicsService.RegisterCollisionGroup(CollisionGroups.ActiveProps);
PhysicsService.CollisionGroupSetCollidable(
	CollisionGroups.Props,
	CollisionGroups.ActiveProps,
	false,
);
