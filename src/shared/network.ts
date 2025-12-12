import { Networking } from "@flamework/networking";

type ClientToServerEvents = {
	mouseTargetUpdated: (position: Vector3) => void;
	mouseTargetClicked: (position: Vector3) => void;
};

type ServerToClientEvents = {};

type ClientToServerFunctions = {};

type ServerToClientFunctions = {};

export const GlobalEvents = Networking.createEvent<
	ClientToServerEvents,
	ServerToClientEvents
>();
export const GlobalFunctions = Networking.createFunction<
	ClientToServerFunctions,
	ServerToClientFunctions
>();
