import { type OnStart, Service } from "@flamework/core";
import { Lighting } from "@rbxts/services";
import type { GraveyardGeneratorService } from "./GraveyardGeneratorService";

@Service()
export class GameService implements OnStart {
	constructor(private graveyardGenerator: GraveyardGeneratorService) {}

	onStart() {
		// Set up nighttime atmosphere
		this.setupNightLighting();

		// Generate graveyard on server start
		this.graveyardGenerator.generateGraveyard({
			size: new Vector2(300, 300),
			seed: 12345,
			useChunks: true,
			useBiomes: true,
			generatePaths: true,
			useRows: true,
		});
	}

	private setupNightLighting() {
		// Set time to 7pm (dusk/evening)
		Lighting.ClockTime = 19;

		// Brighter ambient lighting for better visibility
		Lighting.Ambient = Color3.fromRGB(120, 125, 140);
		Lighting.OutdoorAmbient = Color3.fromRGB(140, 145, 170);
		Lighting.Brightness = 3;
		Lighting.EnvironmentDiffuseScale = 1;
		Lighting.EnvironmentSpecularScale = 1;

		// Lighter fog for atmosphere
		Lighting.FogColor = Color3.fromRGB(50, 55, 70);
		Lighting.FogStart = 100;
		Lighting.FogEnd = 500;

		// Color correction for eerie feel
		const colorCorrection = new Instance("ColorCorrectionEffect");
		colorCorrection.Brightness = -0.05;
		colorCorrection.Contrast = 0.1;
		colorCorrection.Saturation = -0.2;
		colorCorrection.TintColor = Color3.fromRGB(200, 210, 255);
		colorCorrection.Parent = Lighting;

		// Bloom for moonlight glow
		const bloom = new Instance("BloomEffect");
		bloom.Intensity = 0.3;
		bloom.Size = 24;
		bloom.Threshold = 0.9;
		bloom.Parent = Lighting;

		// Atmosphere for realistic sky
		const atmosphere = new Instance("Atmosphere");
		atmosphere.Density = 0.4;
		atmosphere.Offset = 0.25;
		atmosphere.Color = Color3.fromRGB(100, 110, 150);
		atmosphere.Decay = Color3.fromRGB(60, 70, 100);
		atmosphere.Glare = 0;
		atmosphere.Haze = 2;
		atmosphere.Parent = Lighting;

		// Night sky with moon
		const sky = new Instance("Sky");
		sky.MoonAngularSize = 15; // Larger moon
		sky.MoonTextureId = "rbxassetid://6444320592"; // Default moon texture
		sky.SkyboxBk = "rbxassetid://1012890/" ;
		sky.SkyboxDn = "rbxassetid://1012891";
		sky.SkyboxFt = "rbxassetid://1012887";
		sky.SkyboxLf = "rbxassetid://1012889";
		sky.SkyboxRt = "rbxassetid://1012888";
		sky.SkyboxUp = "rbxassetid://1014449";
		sky.StarCount = 3000;
		sky.Parent = Lighting;

		print("GameService: Night lighting configured");
	}
}
