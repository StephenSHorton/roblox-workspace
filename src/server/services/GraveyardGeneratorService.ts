import { type OnStart, Service } from "@flamework/core";
import { Players, RunService, ServerStorage, Workspace } from "@rbxts/services";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface GraveyardConfig {
	/** Size of the graveyard in studs (width x depth) */
	size: Vector2;
	/** Seed for reproducible generation (optional) */
	seed?: number;
	/** Position to generate the graveyard */
	origin: Vector3;
	/** Enable chunk-based loading */
	useChunks: boolean;
	/** Chunk size in studs (only used if useChunks is true) */
	chunkSize: number;
	/** Distance at which chunks load/unload */
	loadDistance: number;
	/** Enable biome zones */
	useBiomes: boolean;
	/** Generate paths between sections */
	generatePaths: boolean;
	/** Use row-based headstone placement */
	useRows: boolean;
}

interface BiomeZone {
	name: string;
	bounds: { min: Vector2; max: Vector2 };
	headstoneDensity: number;
	treeDensity: number;
	rowSpacing?: number;
	rowEnabled: boolean;
	hasCrypt?: boolean;
}

interface CryptPlacement {
	position: Vector2;
	rotation: number;
}

interface Chunk {
	x: number;
	z: number;
	folder?: Folder;
	loaded: boolean;
}

interface PathSegment {
	start: Vector2;
	end: Vector2;
	width: number;
}

const DEFAULT_CONFIG: GraveyardConfig = {
	size: new Vector2(300, 300),
	origin: new Vector3(0, 0, 0),
	useChunks: true,
	chunkSize: 50,
	loadDistance: 100,
	useBiomes: true,
	generatePaths: true,
	useRows: true,
};

// ============================================================================
// Service
// ============================================================================

@Service()
export class GraveyardGeneratorService implements OnStart {
	private prefabsFolder?: Folder;
	private headstones: Model[] = [];
	private deadTrees: Model[] = [];
	private groundTemplate?: Instance;

	private chunks: Map<string, Chunk> = new Map();
	private biomeZones: BiomeZone[] = [];
	private paths: PathSegment[] = [];
	private cryptPlacements: CryptPlacement[] = [];
	private currentConfig?: GraveyardConfig;
	private graveyardFolder?: Folder;
	private chunkUpdateConnection?: RBXScriptConnection;

	onStart() {
		this.loadPrefabs();
	}

	private loadPrefabs() {
		this.prefabsFolder = ServerStorage.FindFirstChild("Graveyard") as Folder;

		if (!this.prefabsFolder) {
			warn("GraveyardGenerator: No 'Graveyard' folder found in ServerStorage!");
			warn("Please move your Graveyard folder to ServerStorage for the generator to work.");
			return;
		}

		for (const child of this.prefabsFolder.GetChildren()) {
			const name = child.Name;

			if (name === "Headstone" || name === "HeadStone") {
				this.headstones.push(child as Model);
			} else if (name === "DeadTree") {
				this.deadTrees.push(child as Model);
			} else if (name === "GraveyardGround") {
				this.groundTemplate = child;
			}
		}

		print(`GraveyardGenerator: Loaded ${this.headstones.size()} headstones, ${this.deadTrees.size()} trees`);
	}

	// ============================================================================
	// Main Generation
	// ============================================================================

	/**
	 * Generate a new graveyard with the given configuration
	 */
	generateGraveyard(config: Partial<GraveyardConfig> = {}): Folder {
		const finalConfig = { ...DEFAULT_CONFIG, ...config };
		this.currentConfig = finalConfig;

		// Create container folder
		this.graveyardFolder = new Instance("Folder");
		this.graveyardFolder.Name = "GeneratedGraveyard";
		this.graveyardFolder.Parent = Workspace;

		// Generate biome zones if enabled
		if (finalConfig.useBiomes) {
			this.generateBiomeZones(finalConfig);
		}

		// Generate paths if enabled
		if (finalConfig.generatePaths) {
			this.generatePaths(finalConfig);
		}

		// Generate ground (always full, not chunked)
		this.generateGround(this.graveyardFolder, finalConfig);

		// Render paths on ground
		if (finalConfig.generatePaths) {
			this.renderPaths(this.graveyardFolder, finalConfig);
		}

		// Generate crypts (always full, not chunked)
		if (finalConfig.useBiomes) {
			this.generateCrypts(this.graveyardFolder, finalConfig);
		}

		if (finalConfig.useChunks) {
			// Initialize chunk system
			this.initializeChunks(finalConfig);
			this.startChunkUpdates();
		} else {
			// Generate everything at once
			this.generateAllContent(this.graveyardFolder, finalConfig);
		}

		print(`GraveyardGenerator: Graveyard initialized`);

		return this.graveyardFolder;
	}

	// ============================================================================
	// Biome Zones
	// ============================================================================

	private generateBiomeZones(config: GraveyardConfig) {
		this.biomeZones = [];
		const halfWidth = config.size.X / 2;
		const halfDepth = config.size.Y / 2;

		// Old Section (dense, row-based, northwest)
		this.biomeZones.push({
			name: "OldSection",
			bounds: {
				min: new Vector2(-halfWidth, -halfDepth),
				max: new Vector2(0, 0),
			},
			headstoneDensity: 0.25,
			treeDensity: 0.04,
			rowSpacing: 12,
			rowEnabled: config.useRows,
		});

		// New Section (sparse, organized rows, northeast)
		this.biomeZones.push({
			name: "NewSection",
			bounds: {
				min: new Vector2(0, -halfDepth),
				max: new Vector2(halfWidth, 0),
			},
			headstoneDensity: 0.12,
			treeDensity: 0.01,
			rowSpacing: 15,
			rowEnabled: config.useRows,
		});

		// Overgrown Section (medium density, lots of trees, southwest)
		this.biomeZones.push({
			name: "OvergrownSection",
			bounds: {
				min: new Vector2(-halfWidth, 0),
				max: new Vector2(0, halfDepth),
			},
			headstoneDensity: 0.1,
			treeDensity: 0.08,
			rowEnabled: false,
		});

		// Mausoleum Area (sparse headstones, few trees, southeast) - has a crypt
		this.biomeZones.push({
			name: "MausoleumArea",
			bounds: {
				min: new Vector2(0, 0),
				max: new Vector2(halfWidth, halfDepth),
			},
			headstoneDensity: 0.08,
			treeDensity: 0.02,
			rowSpacing: 20,
			rowEnabled: config.useRows,
			hasCrypt: true,
		});

		print(`GraveyardGenerator: Created ${this.biomeZones.size()} biome zones`);
	}

	private getBiomeAt(localX: number, localZ: number): BiomeZone | undefined {
		for (const biome of this.biomeZones) {
			if (
				localX >= biome.bounds.min.X &&
				localX < biome.bounds.max.X &&
				localZ >= biome.bounds.min.Y &&
				localZ < biome.bounds.max.Y
			) {
				return biome;
			}
		}
		return undefined;
	}

	// ============================================================================
	// Path Generation
	// ============================================================================

	private generatePaths(config: GraveyardConfig) {
		this.paths = [];
		const halfWidth = config.size.X / 2;
		const halfDepth = config.size.Y / 2;

		// Main cross paths
		this.paths.push({
			start: new Vector2(-halfWidth, 0),
			end: new Vector2(halfWidth, 0),
			width: 8,
		});

		this.paths.push({
			start: new Vector2(0, -halfDepth),
			end: new Vector2(0, halfDepth),
			width: 8,
		});

		// Diagonal paths from corners to center
		this.paths.push({
			start: new Vector2(-halfWidth * 0.8, -halfDepth * 0.8),
			end: new Vector2(0, 0),
			width: 5,
		});

		this.paths.push({
			start: new Vector2(halfWidth * 0.8, -halfDepth * 0.8),
			end: new Vector2(0, 0),
			width: 5,
		});

		// Perimeter path
		const perimeterInset = 10;
		const corners = [
			new Vector2(-halfWidth + perimeterInset, -halfDepth + perimeterInset),
			new Vector2(halfWidth - perimeterInset, -halfDepth + perimeterInset),
			new Vector2(halfWidth - perimeterInset, halfDepth - perimeterInset),
			new Vector2(-halfWidth + perimeterInset, halfDepth - perimeterInset),
		];

		for (let i = 0; i < corners.size(); i++) {
			this.paths.push({
				start: corners[i],
				end: corners[(i + 1) % corners.size()],
				width: 4,
			});
		}

		print(`GraveyardGenerator: Created ${this.paths.size()} path segments`);
	}

	private renderPaths(parent: Folder, config: GraveyardConfig) {
		const pathsFolder = new Instance("Folder");
		pathsFolder.Name = "Paths";
		pathsFolder.Parent = parent;

		for (const segment of this.paths) {
			const start3D = new Vector3(
				config.origin.X + segment.start.X,
				config.origin.Y + 0.05,
				config.origin.Z + segment.start.Y,
			);
			const end3D = new Vector3(
				config.origin.X + segment.end.X,
				config.origin.Y + 0.05,
				config.origin.Z + segment.end.Y,
			);

			const length = end3D.sub(start3D).Magnitude;
			const midpoint = start3D.add(end3D).div(2);

			const path = new Instance("Part");
			path.Name = "Path";
			path.Size = new Vector3(segment.width, 0.1, length);
			path.Anchored = true;
			path.Color = Color3.fromRGB(80, 60, 45);
			path.Material = Enum.Material.Cobblestone;
			path.CFrame = CFrame.lookAt(midpoint, end3D).mul(CFrame.Angles(math.rad(-90), 0, 0));
			path.Parent = pathsFolder;
		}
	}

	private isOnPath(localX: number, localZ: number): boolean {
		for (const segment of this.paths) {
			const dist = this.pointToSegmentDistance(new Vector2(localX, localZ), segment.start, segment.end);
			if (dist < segment.width / 2 + 2) {
				return true;
			}
		}
		return false;
	}

	private pointToSegmentDistance(point: Vector2, segStart: Vector2, segEnd: Vector2): number {
		const segVec = segEnd.sub(segStart);
		const pointVec = point.sub(segStart);
		const segLenSq = segVec.Magnitude * segVec.Magnitude;

		if (segLenSq === 0) return pointVec.Magnitude;

		const t = math.clamp(pointVec.Dot(segVec) / segLenSq, 0, 1);
		const projection = segStart.add(segVec.mul(t));

		return point.sub(projection).Magnitude;
	}

	// ============================================================================
	// Chunk System
	// ============================================================================

	private initializeChunks(config: GraveyardConfig) {
		this.chunks.clear();

		const chunksX = math.ceil(config.size.X / config.chunkSize);
		const chunksZ = math.ceil(config.size.Y / config.chunkSize);

		for (let x = 0; x < chunksX; x++) {
			for (let z = 0; z < chunksZ; z++) {
				const key = `${x},${z}`;
				this.chunks.set(key, {
					x,
					z,
					loaded: false,
				});
			}
		}

		print(`GraveyardGenerator: Initialized ${this.chunks.size()} chunks`);
	}

	private startChunkUpdates() {
		if (this.chunkUpdateConnection) {
			this.chunkUpdateConnection.Disconnect();
		}

		let updateTimer = 0;
		this.chunkUpdateConnection = RunService.Heartbeat.Connect((dt) => {
			updateTimer += dt;
			if (updateTimer >= 0.5) {
				updateTimer = 0;
				this.updateChunks();
			}
		});
	}

	private updateChunks() {
		if (!this.currentConfig || !this.graveyardFolder) return;

		const config = this.currentConfig;
		const playerPositions: Vector3[] = [];

		for (const player of Players.GetPlayers()) {
			const character = player.Character;
			if (character) {
				const rootPart = character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
				if (rootPart) {
					playerPositions.push(rootPart.Position);
				}
			}
		}

		for (const [_key, chunk] of this.chunks) {
			const chunkWorldX =
				config.origin.X - config.size.X / 2 + chunk.x * config.chunkSize + config.chunkSize / 2;
			const chunkWorldZ =
				config.origin.Z - config.size.Y / 2 + chunk.z * config.chunkSize + config.chunkSize / 2;
			const chunkPos = new Vector3(chunkWorldX, config.origin.Y, chunkWorldZ);

			let shouldLoad = false;
			for (const playerPos of playerPositions) {
				const distance = playerPos.sub(chunkPos).Magnitude;
				if (distance < config.loadDistance) {
					shouldLoad = true;
					break;
				}
			}

			if (shouldLoad && !chunk.loaded) {
				this.loadChunk(chunk, config);
			} else if (!shouldLoad && chunk.loaded) {
				this.unloadChunk(chunk);
			}
		}
	}

	private loadChunk(chunk: Chunk, config: GraveyardConfig) {
		if (chunk.loaded || !this.graveyardFolder) return;

		const random = new Random((config.seed ?? 0) + chunk.x * 1000 + chunk.z);

		chunk.folder = new Instance("Folder");
		chunk.folder.Name = `Chunk_${chunk.x}_${chunk.z}`;
		chunk.folder.Parent = this.graveyardFolder;

		const chunkStartX = -config.size.X / 2 + chunk.x * config.chunkSize;
		const chunkStartZ = -config.size.Y / 2 + chunk.z * config.chunkSize;

		this.generateChunkContent(chunk.folder, chunkStartX, chunkStartZ, config, random);

		chunk.loaded = true;
	}

	private unloadChunk(chunk: Chunk) {
		if (!chunk.loaded || !chunk.folder) return;

		chunk.folder.Destroy();
		chunk.folder = undefined;
		chunk.loaded = false;
	}

	private generateChunkContent(folder: Folder, startX: number, startZ: number, config: GraveyardConfig, random: Random) {
		// Grid spacing for headstones
		const gridSpacingX = 6; // Space between headstones in a row
		const gridSpacingZ = 8; // Space between rows

		const cellsX = math.floor(config.chunkSize / gridSpacingX);
		const cellsZ = math.floor(config.chunkSize / gridSpacingZ);

		for (let cx = 0; cx < cellsX; cx++) {
			for (let cz = 0; cz < cellsZ; cz++) {
				const localX = startX + cx * gridSpacingX;
				const localZ = startZ + cz * gridSpacingZ;

				// Skip if on a path or near a crypt
				if (this.isOnPath(localX, localZ)) continue;
				if (this.isNearCrypt(localX, localZ)) continue;

				// Get biome for this position
				const biome = config.useBiomes ? this.getBiomeAt(localX, localZ) : undefined;
				const headstoneDensity = biome?.headstoneDensity ?? 0.15;
				const treeDensity = biome?.treeDensity ?? 0.02;

				const worldX = config.origin.X + localX;
				const worldZ = config.origin.Z + localZ;

				// Use noise to decide if this grid spot gets a headstone (creates some gaps)
				const noiseValue = math.noise(localX * 0.1, localZ * 0.1, (config.seed ?? 0) * 0.01);

				// Trees go at edges or randomly scattered
				const isEdge = cx === 0 || cx === cellsX - 1 || cz === 0 || cz === cellsZ - 1;
				const treeRoll = random.NextNumber();

				if (isEdge && treeRoll < treeDensity * 3) {
					// Small random offset for trees
					const treeOffsetX = random.NextNumber(-2, 2);
					const treeOffsetZ = random.NextNumber(-2, 2);
					const treePosition = new Vector3(worldX + treeOffsetX, config.origin.Y, worldZ + treeOffsetZ);
					this.placeTree(folder, treePosition, random);
				} else if (noiseValue > -0.5 && random.NextNumber() < headstoneDensity * 2) {
					// Grid-aligned headstone with tiny offset for realism
					const smallOffsetX = random.NextNumber(-0.3, 0.3);
					const smallOffsetZ = random.NextNumber(-0.2, 0.2);
					const position = new Vector3(worldX + smallOffsetX, config.origin.Y, worldZ + smallOffsetZ);
					this.placeHeadstone(folder, position, random, true);
				}
			}
		}
	}

	// ============================================================================
	// Non-Chunked Generation
	// ============================================================================

	private generateAllContent(parent: Folder, config: GraveyardConfig) {
		const random = new Random(config.seed ?? os.time());

		// Grid spacing for headstones
		const gridSpacingX = 6; // Space between headstones in a row
		const gridSpacingZ = 8; // Space between rows

		const gridWidth = math.floor(config.size.X / gridSpacingX);
		const gridDepth = math.floor(config.size.Y / gridSpacingZ);

		for (let x = 0; x < gridWidth; x++) {
			for (let z = 0; z < gridDepth; z++) {
				const localX = -config.size.X / 2 + x * gridSpacingX;
				const localZ = -config.size.Y / 2 + z * gridSpacingZ;

				if (this.isOnPath(localX, localZ)) continue;
				if (this.isNearCrypt(localX, localZ)) continue;

				const biome = config.useBiomes ? this.getBiomeAt(localX, localZ) : undefined;
				const headstoneDensity = biome?.headstoneDensity ?? 0.15;
				const treeDensity = biome?.treeDensity ?? 0.02;

				const worldX = config.origin.X + localX;
				const worldZ = config.origin.Z + localZ;

				// Use noise to decide if this grid spot gets a headstone
				const noiseValue = math.noise(localX * 0.1, localZ * 0.1, (config.seed ?? 0) * 0.01);

				// Trees go at edges or randomly scattered
				const isEdge = x === 0 || x === gridWidth - 1 || z === 0 || z === gridDepth - 1;
				const treeRoll = random.NextNumber();

				if (isEdge && treeRoll < treeDensity * 3) {
					const treeOffsetX = random.NextNumber(-2, 2);
					const treeOffsetZ = random.NextNumber(-2, 2);
					const treePosition = new Vector3(worldX + treeOffsetX, config.origin.Y, worldZ + treeOffsetZ);
					this.placeTree(parent, treePosition, random);
				} else if (noiseValue > -0.5 && random.NextNumber() < headstoneDensity * 2) {
					// Grid-aligned headstone with tiny offset for realism
					const smallOffsetX = random.NextNumber(-0.3, 0.3);
					const smallOffsetZ = random.NextNumber(-0.2, 0.2);
					const position = new Vector3(worldX + smallOffsetX, config.origin.Y, worldZ + smallOffsetZ);
					this.placeHeadstone(parent, position, random, true);
				}
			}
		}
	}

	// ============================================================================
	// Crypt Generation
	// ============================================================================

	private generateCrypts(parent: Folder, config: GraveyardConfig) {
		this.cryptPlacements = [];
		const random = new Random((config.seed ?? 0) + 9999);

		// Place crypts in biomes that have them
		for (const biome of this.biomeZones) {
			if (!biome.hasCrypt) continue;

			// Place crypt in center of biome
			const centerX = (biome.bounds.min.X + biome.bounds.max.X) / 2;
			const centerZ = (biome.bounds.min.Y + biome.bounds.max.Y) / 2;

			const rotation = random.NextInteger(0, 3) * 90; // Face one of 4 directions

			this.cryptPlacements.push({
				position: new Vector2(centerX, centerZ),
				rotation: rotation,
			});

			const worldPos = new Vector3(
				config.origin.X + centerX,
				config.origin.Y,
				config.origin.Z + centerZ,
			);

			this.buildCrypt(parent, worldPos, rotation);
		}

		print(`GraveyardGenerator: Created ${this.cryptPlacements.size()} crypts`);
	}

	private buildCrypt(parent: Folder, position: Vector3, rotation: number): Model {
		const crypt = new Instance("Model");
		crypt.Name = "Crypt";

		// Crypt dimensions
		const width = 16;
		const depth = 20;
		const wallHeight = 10;
		const wallThickness = 1.5;
		const roofHeight = 6;
		const hillHeight = 12; // Height of the hill the crypt sits on

		const stoneColor = Color3.fromRGB(70, 70, 75);
		const darkStoneColor = Color3.fromRGB(50, 50, 55);
		const roofColor = Color3.fromRGB(45, 45, 50);
		const dirtColor = Color3.fromRGB(65, 50, 35);

		// Hill/mound that the crypt sits on
		const hillBase = new Instance("Part");
		hillBase.Name = "HillBase";
		hillBase.Size = new Vector3(width + 20, hillHeight, depth + 25);
		hillBase.Color = dirtColor;
		hillBase.Material = Enum.Material.Ground;
		hillBase.Anchored = true;
		hillBase.Parent = crypt;

		// Sloped front of hill (ramp up to crypt entrance)
		const hillRamp = new Instance("WedgePart");
		hillRamp.Name = "HillRamp";
		hillRamp.Size = new Vector3(width + 10, hillHeight, 15);
		hillRamp.Color = dirtColor;
		hillRamp.Material = Enum.Material.Ground;
		hillRamp.Anchored = true;
		hillRamp.Parent = crypt;

		// Floor/Foundation - split into sections with hole for stairs
		// Stair opening dimensions (must match stair dimensions below)
		const stairWidth = 6;
		const stairOpeningDepth = 4; // Opening at floor level for stairs
		const stairOpeningZ = -depth / 2 + 3; // Where the stair opening is (near back wall)

		// Front section of foundation (from front to stair opening)
		const foundationFront = new Instance("Part");
		foundationFront.Name = "FoundationFront";
		const frontSectionDepth = depth / 2 + stairOpeningZ + stairOpeningDepth / 2;
		foundationFront.Size = new Vector3(width + 2, 0.5, frontSectionDepth);
		foundationFront.Color = darkStoneColor;
		foundationFront.Material = Enum.Material.Slate;
		foundationFront.Anchored = true;
		foundationFront.Parent = crypt;

		// Back section of foundation (behind stair opening)
		const foundationBack = new Instance("Part");
		foundationBack.Name = "FoundationBack";
		const backSectionDepth = depth / 2 - (stairOpeningZ - stairOpeningDepth / 2);
		foundationBack.Size = new Vector3(width + 2, 0.5, backSectionDepth);
		foundationBack.Color = darkStoneColor;
		foundationBack.Material = Enum.Material.Slate;
		foundationBack.Anchored = true;
		foundationBack.Parent = crypt;

		// Left section of foundation (next to stair opening)
		const foundationLeft = new Instance("Part");
		foundationLeft.Name = "FoundationLeft";
		foundationLeft.Size = new Vector3((width + 2 - stairWidth) / 2, 0.5, stairOpeningDepth);
		foundationLeft.Color = darkStoneColor;
		foundationLeft.Material = Enum.Material.Slate;
		foundationLeft.Anchored = true;
		foundationLeft.Parent = crypt;

		// Right section of foundation (next to stair opening)
		const foundationRight = new Instance("Part");
		foundationRight.Name = "FoundationRight";
		foundationRight.Size = new Vector3((width + 2 - stairWidth) / 2, 0.5, stairOpeningDepth);
		foundationRight.Color = darkStoneColor;
		foundationRight.Material = Enum.Material.Slate;
		foundationRight.Anchored = true;
		foundationRight.Parent = crypt;

		// Back wall
		const backWall = new Instance("Part");
		backWall.Name = "BackWall";
		backWall.Size = new Vector3(width, wallHeight, wallThickness);
		backWall.Color = stoneColor;
		backWall.Material = Enum.Material.Slate;
		backWall.Anchored = true;
		backWall.Parent = crypt;

		// Left wall
		const leftWall = new Instance("Part");
		leftWall.Name = "LeftWall";
		leftWall.Size = new Vector3(wallThickness, wallHeight, depth);
		leftWall.Color = stoneColor;
		leftWall.Material = Enum.Material.Slate;
		leftWall.Anchored = true;
		leftWall.Parent = crypt;

		// Right wall
		const rightWall = new Instance("Part");
		rightWall.Name = "RightWall";
		rightWall.Size = new Vector3(wallThickness, wallHeight, depth);
		rightWall.Color = stoneColor;
		rightWall.Material = Enum.Material.Slate;
		rightWall.Anchored = true;
		rightWall.Parent = crypt;

		// Front wall left section
		const frontWallLeft = new Instance("Part");
		frontWallLeft.Name = "FrontWallLeft";
		frontWallLeft.Size = new Vector3((width - 6) / 2, wallHeight, wallThickness);
		frontWallLeft.Color = stoneColor;
		frontWallLeft.Material = Enum.Material.Slate;
		frontWallLeft.Anchored = true;
		frontWallLeft.Parent = crypt;

		// Front wall right section
		const frontWallRight = new Instance("Part");
		frontWallRight.Name = "FrontWallRight";
		frontWallRight.Size = new Vector3((width - 6) / 2, wallHeight, wallThickness);
		frontWallRight.Color = stoneColor;
		frontWallRight.Material = Enum.Material.Slate;
		frontWallRight.Anchored = true;
		frontWallRight.Parent = crypt;

		// Front wall top (above doorway)
		const frontWallTop = new Instance("Part");
		frontWallTop.Name = "FrontWallTop";
		frontWallTop.Size = new Vector3(6, wallHeight - 7, wallThickness);
		frontWallTop.Color = stoneColor;
		frontWallTop.Material = Enum.Material.Slate;
		frontWallTop.Anchored = true;
		frontWallTop.Parent = crypt;

		// Left column
		const leftColumn = new Instance("Part");
		leftColumn.Name = "LeftColumn";
		leftColumn.Size = new Vector3(1.5, wallHeight + 1, 1.5);
		leftColumn.Color = darkStoneColor;
		leftColumn.Material = Enum.Material.Slate;
		leftColumn.Anchored = true;
		leftColumn.Parent = crypt;

		// Right column
		const rightColumn = new Instance("Part");
		rightColumn.Name = "RightColumn";
		rightColumn.Size = new Vector3(1.5, wallHeight + 1, 1.5);
		rightColumn.Color = darkStoneColor;
		rightColumn.Material = Enum.Material.Slate;
		rightColumn.Anchored = true;
		rightColumn.Parent = crypt;

		// Roof - main triangular section (using wedges)
		const roofLeft = new Instance("WedgePart");
		roofLeft.Name = "RoofLeft";
		roofLeft.Size = new Vector3(depth + 2, roofHeight, width / 2 + 1.5);
		roofLeft.Color = roofColor;
		roofLeft.Material = Enum.Material.Slate;
		roofLeft.Anchored = true;
		roofLeft.Parent = crypt;

		const roofRight = new Instance("WedgePart");
		roofRight.Name = "RoofRight";
		roofRight.Size = new Vector3(depth + 2, roofHeight, width / 2 + 1.5);
		roofRight.Color = roofColor;
		roofRight.Material = Enum.Material.Slate;
		roofRight.Anchored = true;
		roofRight.Parent = crypt;

		// Iron gate (as a model for animation)
		const gate = new Instance("Model");
		gate.Name = "Gate";

		const gateColor = Color3.fromRGB(30, 30, 35);

		// Gate hinge part (invisible, used as pivot point)
		const gateHinge = new Instance("Part");
		gateHinge.Name = "GateHinge";
		gateHinge.Size = new Vector3(0.5, 7, 0.5);
		gateHinge.Transparency = 1;
		gateHinge.CanCollide = false;
		gateHinge.Anchored = true;
		gateHinge.Parent = gate;

		// Gate bars
		for (let i = 0; i < 5; i++) {
			const bar = new Instance("Part");
			bar.Name = `GateBar${i}`;
			bar.Size = new Vector3(0.3, 7, 0.3);
			bar.Color = gateColor;
			bar.Material = Enum.Material.Metal;
			bar.Anchored = true;
			bar.Parent = gate;
		}

		// Gate crossbar
		const crossbar = new Instance("Part");
		crossbar.Name = "GateCrossbar";
		crossbar.Size = new Vector3(5, 0.3, 0.3);
		crossbar.Color = gateColor;
		crossbar.Material = Enum.Material.Metal;
		crossbar.Anchored = true;
		crossbar.Parent = gate;

		gate.PrimaryPart = gateHinge;
		gate.Parent = crypt;

		// Proximity detector (invisible part in front of gate)
		const proximityDetector = new Instance("Part");
		proximityDetector.Name = "GateProximityDetector";
		proximityDetector.Size = new Vector3(8, 8, 6);
		proximityDetector.Transparency = 1;
		proximityDetector.CanCollide = false;
		proximityDetector.Anchored = true;
		proximityDetector.Parent = crypt;

		// Decorative skull above entrance
		const skullMount = new Instance("Part");
		skullMount.Name = "SkullMount";
		skullMount.Size = new Vector3(3, 2, 1);
		skullMount.Color = darkStoneColor;
		skullMount.Material = Enum.Material.Slate;
		skullMount.Anchored = true;
		skullMount.Parent = crypt;

		// Steps leading to entrance
		for (let i = 0; i < 3; i++) {
			const step = new Instance("Part");
			step.Name = `Step${i}`;
			step.Size = new Vector3(8 - i, 0.5, 2);
			step.Color = darkStoneColor;
			step.Material = Enum.Material.Slate;
			step.Anchored = true;
			step.Parent = crypt;
		}

		// Torches on columns
		const torchColor = Color3.fromRGB(60, 40, 20);
		for (let side = -1; side <= 1; side += 2) {
			// Torch handle
			const torchHandle = new Instance("Part");
			torchHandle.Name = `Torch${side === -1 ? "Left" : "Right"}`;
			torchHandle.Size = new Vector3(0.4, 2, 0.4);
			torchHandle.Color = torchColor;
			torchHandle.Material = Enum.Material.Wood;
			torchHandle.Anchored = true;
			torchHandle.Parent = crypt;

			// Torch head (where fire sits)
			const torchHead = new Instance("Part");
			torchHead.Name = `TorchHead${side === -1 ? "Left" : "Right"}`;
			torchHead.Size = new Vector3(0.6, 0.4, 0.6);
			torchHead.Color = Color3.fromRGB(40, 30, 15);
			torchHead.Material = Enum.Material.Wood;
			torchHead.Anchored = true;
			torchHead.Parent = crypt;

			// Fire particle effect
			const fire = new Instance("Fire");
			fire.Name = "TorchFire";
			fire.Heat = 5;
			fire.Size = 3;
			fire.Color = Color3.fromRGB(255, 150, 50);
			fire.SecondaryColor = Color3.fromRGB(255, 80, 20);
			fire.Parent = torchHead;

			// Point light for illumination
			const torchLight = new Instance("PointLight");
			torchLight.Name = "TorchLight";
			torchLight.Color = Color3.fromRGB(255, 180, 100);
			torchLight.Brightness = 1.5;
			torchLight.Range = 20;
			torchLight.Shadows = true;
			torchLight.Parent = torchHead;
		}

		// ============================================
		// Underground Room and Stairs
		// ============================================
		const undergroundDepth = 12; // How deep the room goes
		const undergroundWidth = width - 2;
		const undergroundLength = depth - 4;
		// stairWidth is already defined above (6)
		const stairDepth = 10;
		const numStairs = 10;

		// Underground room floor
		const undergroundFloor = new Instance("Part");
		undergroundFloor.Name = "UndergroundFloor";
		undergroundFloor.Size = new Vector3(undergroundWidth, 0.5, undergroundLength);
		undergroundFloor.Color = darkStoneColor;
		undergroundFloor.Material = Enum.Material.Slate;
		undergroundFloor.Anchored = true;
		undergroundFloor.Parent = crypt;

		// Underground room walls
		const undergroundBackWall = new Instance("Part");
		undergroundBackWall.Name = "UndergroundBackWall";
		undergroundBackWall.Size = new Vector3(undergroundWidth, undergroundDepth, wallThickness);
		undergroundBackWall.Color = stoneColor;
		undergroundBackWall.Material = Enum.Material.Slate;
		undergroundBackWall.Anchored = true;
		undergroundBackWall.Parent = crypt;

		const undergroundLeftWall = new Instance("Part");
		undergroundLeftWall.Name = "UndergroundLeftWall";
		undergroundLeftWall.Size = new Vector3(wallThickness, undergroundDepth, undergroundLength);
		undergroundLeftWall.Color = stoneColor;
		undergroundLeftWall.Material = Enum.Material.Slate;
		undergroundLeftWall.Anchored = true;
		undergroundLeftWall.Parent = crypt;

		const undergroundRightWall = new Instance("Part");
		undergroundRightWall.Name = "UndergroundRightWall";
		undergroundRightWall.Size = new Vector3(wallThickness, undergroundDepth, undergroundLength);
		undergroundRightWall.Color = stoneColor;
		undergroundRightWall.Material = Enum.Material.Slate;
		undergroundRightWall.Anchored = true;
		undergroundRightWall.Parent = crypt;

		// Front wall of underground (with opening for stairs)
		const undergroundFrontLeft = new Instance("Part");
		undergroundFrontLeft.Name = "UndergroundFrontLeft";
		undergroundFrontLeft.Size = new Vector3((undergroundWidth - stairWidth) / 2, undergroundDepth, wallThickness);
		undergroundFrontLeft.Color = stoneColor;
		undergroundFrontLeft.Material = Enum.Material.Slate;
		undergroundFrontLeft.Anchored = true;
		undergroundFrontLeft.Parent = crypt;

		const undergroundFrontRight = new Instance("Part");
		undergroundFrontRight.Name = "UndergroundFrontRight";
		undergroundFrontRight.Size = new Vector3((undergroundWidth - stairWidth) / 2, undergroundDepth, wallThickness);
		undergroundFrontRight.Color = stoneColor;
		undergroundFrontRight.Material = Enum.Material.Slate;
		undergroundFrontRight.Anchored = true;
		undergroundFrontRight.Parent = crypt;

		// Staircase going down
		const stairHeight = undergroundDepth / numStairs;
		const stairStepDepth = stairDepth / numStairs;
		for (let i = 0; i < numStairs; i++) {
			const stair = new Instance("Part");
			stair.Name = `DownStair${i}`;
			stair.Size = new Vector3(stairWidth, stairHeight, stairStepDepth);
			stair.Color = darkStoneColor;
			stair.Material = Enum.Material.Slate;
			stair.Anchored = true;
			stair.Parent = crypt;
		}

		// Stair walls (railings/sides)
		const stairLeftWall = new Instance("Part");
		stairLeftWall.Name = "StairLeftWall";
		stairLeftWall.Size = new Vector3(wallThickness / 2, undergroundDepth + 2, stairDepth);
		stairLeftWall.Color = stoneColor;
		stairLeftWall.Material = Enum.Material.Slate;
		stairLeftWall.Anchored = true;
		stairLeftWall.Parent = crypt;

		const stairRightWall = new Instance("Part");
		stairRightWall.Name = "StairRightWall";
		stairRightWall.Size = new Vector3(wallThickness / 2, undergroundDepth + 2, stairDepth);
		stairRightWall.Color = stoneColor;
		stairRightWall.Material = Enum.Material.Slate;
		stairRightWall.Anchored = true;
		stairRightWall.Parent = crypt;

		// Underground ceiling (the floor above, with hole for stairs)
		const undergroundCeilingBack = new Instance("Part");
		undergroundCeilingBack.Name = "UndergroundCeilingBack";
		undergroundCeilingBack.Size = new Vector3(undergroundWidth, 0.5, undergroundLength - stairDepth);
		undergroundCeilingBack.Color = darkStoneColor;
		undergroundCeilingBack.Material = Enum.Material.Slate;
		undergroundCeilingBack.Anchored = true;
		undergroundCeilingBack.Parent = crypt;

		const undergroundCeilingLeft = new Instance("Part");
		undergroundCeilingLeft.Name = "UndergroundCeilingLeft";
		undergroundCeilingLeft.Size = new Vector3((undergroundWidth - stairWidth) / 2, 0.5, stairDepth);
		undergroundCeilingLeft.Color = darkStoneColor;
		undergroundCeilingLeft.Material = Enum.Material.Slate;
		undergroundCeilingLeft.Anchored = true;
		undergroundCeilingLeft.Parent = crypt;

		const undergroundCeilingRight = new Instance("Part");
		undergroundCeilingRight.Name = "UndergroundCeilingRight";
		undergroundCeilingRight.Size = new Vector3((undergroundWidth - stairWidth) / 2, 0.5, stairDepth);
		undergroundCeilingRight.Color = darkStoneColor;
		undergroundCeilingRight.Material = Enum.Material.Slate;
		undergroundCeilingRight.Anchored = true;
		undergroundCeilingRight.Parent = crypt;

		// Torch in underground room
		const undergroundTorchHead = new Instance("Part");
		undergroundTorchHead.Name = "UndergroundTorchHead";
		undergroundTorchHead.Size = new Vector3(0.6, 0.4, 0.6);
		undergroundTorchHead.Color = Color3.fromRGB(40, 30, 15);
		undergroundTorchHead.Material = Enum.Material.Wood;
		undergroundTorchHead.Anchored = true;
		undergroundTorchHead.Parent = crypt;

		const undergroundFire = new Instance("Fire");
		undergroundFire.Name = "UndergroundFire";
		undergroundFire.Heat = 5;
		undergroundFire.Size = 3;
		undergroundFire.Color = Color3.fromRGB(255, 150, 50);
		undergroundFire.SecondaryColor = Color3.fromRGB(255, 80, 20);
		undergroundFire.Parent = undergroundTorchHead;

		const undergroundLight = new Instance("PointLight");
		undergroundLight.Name = "UndergroundLight";
		undergroundLight.Color = Color3.fromRGB(255, 180, 100);
		undergroundLight.Brightness = 1;
		undergroundLight.Range = 25;
		undergroundLight.Shadows = true;
		undergroundLight.Parent = undergroundTorchHead;

		// Position all parts relative to crypt center
		// The crypt sits on top of the hill, so we add hillHeight to Y positions
		const baseCFrame = new CFrame(position.X, position.Y + hillHeight, position.Z).mul(
			CFrame.Angles(0, math.rad(rotation), 0),
		);

		// Position hill (at ground level, not elevated)
		const groundCFrame = new CFrame(position.X, position.Y, position.Z).mul(
			CFrame.Angles(0, math.rad(rotation), 0),
		);
		hillBase.CFrame = groundCFrame.mul(new CFrame(0, hillHeight / 2, -5));
		// Ramp goes in front of the hill, sloping up to the entrance
		hillRamp.CFrame = groundCFrame.mul(
			new CFrame(0, hillHeight / 2, depth / 2 + 7.5).mul(CFrame.Angles(0, math.rad(180), 0)),
		);

		// Position foundation sections around the stair opening
		const frontSectionZ = depth / 2 - frontSectionDepth / 2 + 1; // +1 for the extra width
		foundationFront.CFrame = baseCFrame.mul(new CFrame(0, 0.25, frontSectionZ));

		const backSectionZ = -depth / 2 + backSectionDepth / 2 - 1;
		foundationBack.CFrame = baseCFrame.mul(new CFrame(0, 0.25, backSectionZ));

		const foundationSideX = (width + 2 - stairWidth) / 4 + stairWidth / 2;
		foundationLeft.CFrame = baseCFrame.mul(new CFrame(-foundationSideX, 0.25, stairOpeningZ));
		foundationRight.CFrame = baseCFrame.mul(new CFrame(foundationSideX, 0.25, stairOpeningZ));
		backWall.CFrame = baseCFrame.mul(new CFrame(0, wallHeight / 2, -depth / 2 + wallThickness / 2));
		leftWall.CFrame = baseCFrame.mul(new CFrame(-width / 2 + wallThickness / 2, wallHeight / 2, 0));
		rightWall.CFrame = baseCFrame.mul(new CFrame(width / 2 - wallThickness / 2, wallHeight / 2, 0));

		const frontZ = depth / 2 - wallThickness / 2;
		frontWallLeft.CFrame = baseCFrame.mul(
			new CFrame(-width / 4 - 1.5, wallHeight / 2, frontZ),
		);
		frontWallRight.CFrame = baseCFrame.mul(
			new CFrame(width / 4 + 1.5, wallHeight / 2, frontZ),
		);
		frontWallTop.CFrame = baseCFrame.mul(new CFrame(0, wallHeight - 1.5, frontZ));

		leftColumn.CFrame = baseCFrame.mul(new CFrame(-3.5, (wallHeight + 1) / 2, frontZ + 0.5));
		rightColumn.CFrame = baseCFrame.mul(new CFrame(3.5, (wallHeight + 1) / 2, frontZ + 0.5));

		// Roof positioning - wedges sit on top of walls forming a peaked roof
		// Left wedge slopes down to the left (wedge point faces center)
		roofLeft.CFrame = baseCFrame.mul(
			new CFrame(-(width / 4) - 0.25, wallHeight + roofHeight / 2, 0).mul(
				CFrame.Angles(0, math.rad(90), 0),
			),
		);
		// Right wedge slopes down to the right (flipped 180 on X to mirror)
		roofRight.CFrame = baseCFrame.mul(
			new CFrame((width / 4) + 0.25, wallHeight + roofHeight / 2, 0).mul(
				CFrame.Angles(0, math.rad(-90), 0),
			),
		);

		// Gate positioning - position hinge on left side of doorway
		const hingeCFrame = baseCFrame.mul(new CFrame(-2.5, 3.5, frontZ + 0.8));
		gateHinge.CFrame = hingeCFrame;

		// Position gate bars relative to hinge
		const gateBars = gate.GetChildren().filter((c) => c.Name.find("GateBar")[0] !== undefined);
		for (let i = 0; i < gateBars.size(); i++) {
			const bar = gateBars[i] as Part;
			bar.CFrame = hingeCFrame.mul(new CFrame(0.5 + i * 1, 0, 0));
		}

		crossbar.CFrame = hingeCFrame.mul(new CFrame(2.5, 2.5, 0));

		// Position proximity detector in front of gate
		proximityDetector.CFrame = baseCFrame.mul(new CFrame(0, 4, frontZ + 4));
		skullMount.CFrame = baseCFrame.mul(new CFrame(0, wallHeight - 2, frontZ + 0.5));

		// Steps positioning - these connect the hill ramp to the crypt entrance
		const stepParts = crypt.GetChildren().filter((c) => c.Name.find("Step")[0] !== undefined);
		for (let i = 0; i < stepParts.size(); i++) {
			const step = stepParts[i] as Part;
			step.CFrame = baseCFrame.mul(new CFrame(0, 0.25 + i * 0.5, frontZ + 2 + i * 2));
		}

		// Torch positioning (by the door entrance)
		const torchLeft = crypt.FindFirstChild("TorchLeft") as Part;
		const torchHeadLeft = crypt.FindFirstChild("TorchHeadLeft") as Part;
		const torchRight = crypt.FindFirstChild("TorchRight") as Part;
		const torchHeadRight = crypt.FindFirstChild("TorchHeadRight") as Part;

		if (torchLeft && torchHeadLeft) {
			torchLeft.CFrame = baseCFrame.mul(new CFrame(-5.5, 6, frontZ + 1));
			torchHeadLeft.CFrame = baseCFrame.mul(new CFrame(-5.5, 7.2, frontZ + 1));
		}
		if (torchRight && torchHeadRight) {
			torchRight.CFrame = baseCFrame.mul(new CFrame(5.5, 6, frontZ + 1));
			torchHeadRight.CFrame = baseCFrame.mul(new CFrame(5.5, 7.2, frontZ + 1));
		}

		// Underground room positioning - room is inside the hill, below the crypt floor
		// Since baseCFrame is already at hillHeight, underground positions are relative to that
		const undergroundY = -undergroundDepth + 0.25;
		const undergroundCenterZ = -depth / 2 - stairDepth / 2;

		undergroundFloor.CFrame = baseCFrame.mul(new CFrame(0, undergroundY, undergroundCenterZ));
		undergroundBackWall.CFrame = baseCFrame.mul(
			new CFrame(0, undergroundY + undergroundDepth / 2, undergroundCenterZ - undergroundLength / 2 + wallThickness / 2),
		);
		undergroundLeftWall.CFrame = baseCFrame.mul(
			new CFrame(-undergroundWidth / 2 + wallThickness / 2, undergroundY + undergroundDepth / 2, undergroundCenterZ),
		);
		undergroundRightWall.CFrame = baseCFrame.mul(
			new CFrame(undergroundWidth / 2 - wallThickness / 2, undergroundY + undergroundDepth / 2, undergroundCenterZ),
		);

		// Front walls of underground (with stair opening)
		const frontWallX = (undergroundWidth - stairWidth) / 4 + stairWidth / 2;
		const undergroundFrontZ = undergroundCenterZ + undergroundLength / 2 - wallThickness / 2;
		undergroundFrontLeft.CFrame = baseCFrame.mul(
			new CFrame(-frontWallX, undergroundY + undergroundDepth / 2, undergroundFrontZ),
		);
		undergroundFrontRight.CFrame = baseCFrame.mul(
			new CFrame(frontWallX, undergroundY + undergroundDepth / 2, undergroundFrontZ),
		);

		// Position stairs going down - starts at floor level and descends into underground
		const downStairs = crypt.GetChildren().filter((c) => c.Name.find("DownStair")[0] !== undefined);
		for (let i = 0; i < downStairs.size(); i++) {
			const stair = downStairs[i] as Part;
			// Start at floor level (0.25) and go down with each step
			const stairY = 0.25 - stairHeight * (i + 0.5);
			// Start near the back of the crypt and go further back with each step
			const stairZ = -depth / 2 + 3 - stairStepDepth * i;
			stair.CFrame = baseCFrame.mul(new CFrame(0, stairY, stairZ));
		}

		// Stair side walls - positioned along the staircase
		const stairCenterZ = -depth / 2 + 3 - stairDepth / 2;
		stairLeftWall.CFrame = baseCFrame.mul(
			new CFrame(-stairWidth / 2 - wallThickness / 4, -undergroundDepth / 2, stairCenterZ),
		);
		stairRightWall.CFrame = baseCFrame.mul(
			new CFrame(stairWidth / 2 + wallThickness / 4, -undergroundDepth / 2, stairCenterZ),
		);

		// Underground ceiling pieces (floor of upper level with hole for stairs)
		// Back portion of ceiling
		undergroundCeilingBack.CFrame = baseCFrame.mul(
			new CFrame(0, 0.25, undergroundCenterZ),
		);
		// Left and right ceiling pieces next to stair opening
		undergroundCeilingLeft.CFrame = baseCFrame.mul(
			new CFrame(-undergroundWidth / 4 - stairWidth / 4, 0.25, stairCenterZ),
		);
		undergroundCeilingRight.CFrame = baseCFrame.mul(
			new CFrame(undergroundWidth / 4 + stairWidth / 4, 0.25, stairCenterZ),
		);

		// Underground torch on back wall
		undergroundTorchHead.CFrame = baseCFrame.mul(
			new CFrame(0, undergroundY + undergroundDepth - 2, undergroundCenterZ - undergroundLength / 2 + 2),
		);

		// Set primary part and parent
		crypt.PrimaryPart = foundationFront;
		crypt.Parent = parent;

		// Add CollectionService tag AFTER parenting (so Flamework can detect it)
		const collectionService = game.GetService("CollectionService");
		collectionService.AddTag(crypt, "CryptGate");
		print("GraveyardGenerator: Added CryptGate tag to", crypt.Name);

		return crypt;
	}

	private isNearCrypt(localX: number, localZ: number): boolean {
		const clearanceRadius = 15; // Keep area around crypts clear
		for (const placement of this.cryptPlacements) {
			const dist = math.sqrt(
				math.pow(localX - placement.position.X, 2) + math.pow(localZ - placement.position.Y, 2),
			);
			if (dist < clearanceRadius) {
				return true;
			}
		}
		return false;
	}

	// ============================================================================
	// Object Placement
	// ============================================================================

	private generateGround(parent: Folder, config: GraveyardConfig) {
		if (!this.groundTemplate) {
			const ground = new Instance("Part");
			ground.Name = "GraveyardGround";
			ground.Size = new Vector3(config.size.X, 1, config.size.Y);
			ground.Position = config.origin.sub(new Vector3(0, 0.4, 0));
			ground.Anchored = true;
			ground.Color = Color3.fromRGB(45, 35, 25);
			ground.Material = Enum.Material.Ground;
			ground.Parent = parent;
		} else {
			const ground = this.groundTemplate.Clone();
			ground.Parent = parent;

			if (ground.IsA("BasePart")) {
				ground.Size = new Vector3(config.size.X, ground.Size.Y, config.size.Y);
				ground.Position = config.origin.sub(new Vector3(0, ground.Size.Y / 2 - 0.1, 0));
			}
		}

		// Add invisible boundary walls to keep players in the play area
		this.generateBoundaryWalls(parent, config);
	}

	private generateBoundaryWalls(parent: Folder, config: GraveyardConfig) {
		const wallHeight = 50; // Tall enough to prevent jumping over
		const wallThickness = 2;
		const halfWidth = config.size.X / 2;
		const halfDepth = config.size.Y / 2;

		// North wall (back)
		const northWall = new Instance("Part");
		northWall.Name = "BoundaryNorth";
		northWall.Size = new Vector3(config.size.X + wallThickness * 2, wallHeight, wallThickness);
		northWall.Position = new Vector3(config.origin.X, config.origin.Y + wallHeight / 2, config.origin.Z - halfDepth - wallThickness / 2);
		northWall.Anchored = true;
		northWall.Transparency = 1;
		northWall.CanCollide = true;
		northWall.Parent = parent;

		// South wall (front)
		const southWall = new Instance("Part");
		southWall.Name = "BoundarySouth";
		southWall.Size = new Vector3(config.size.X + wallThickness * 2, wallHeight, wallThickness);
		southWall.Position = new Vector3(config.origin.X, config.origin.Y + wallHeight / 2, config.origin.Z + halfDepth + wallThickness / 2);
		southWall.Anchored = true;
		southWall.Transparency = 1;
		southWall.CanCollide = true;
		southWall.Parent = parent;

		// West wall (left)
		const westWall = new Instance("Part");
		westWall.Name = "BoundaryWest";
		westWall.Size = new Vector3(wallThickness, wallHeight, config.size.Y + wallThickness * 2);
		westWall.Position = new Vector3(config.origin.X - halfWidth - wallThickness / 2, config.origin.Y + wallHeight / 2, config.origin.Z);
		westWall.Anchored = true;
		westWall.Transparency = 1;
		westWall.CanCollide = true;
		westWall.Parent = parent;

		// East wall (right)
		const eastWall = new Instance("Part");
		eastWall.Name = "BoundaryEast";
		eastWall.Size = new Vector3(wallThickness, wallHeight, config.size.Y + wallThickness * 2);
		eastWall.Position = new Vector3(config.origin.X + halfWidth + wallThickness / 2, config.origin.Y + wallHeight / 2, config.origin.Z);
		eastWall.Anchored = true;
		eastWall.Transparency = 1;
		eastWall.CanCollide = true;
		eastWall.Parent = parent;

		print("GraveyardGenerator: Added boundary walls");
	}

	private placeHeadstone(parent: Folder, position: Vector3, random: Random, isRow: boolean = false) {
		if (this.headstones.size() === 0) return;

		const template = this.headstones[random.NextInteger(0, this.headstones.size() - 1)];
		const headstone = template.Clone();

		// Row headstones face forward with minimal rotation
		const rotation = isRow ? random.NextNumber(-5, 5) : random.NextNumber(-15, 15);
		headstone.PivotTo(new CFrame(position).mul(CFrame.Angles(0, math.rad(rotation), 0)));

		headstone.Parent = parent;
	}

	private placeTree(parent: Folder, position: Vector3, random: Random) {
		if (this.deadTrees.size() === 0) return;

		const template = this.deadTrees[random.NextInteger(0, this.deadTrees.size() - 1)];
		const tree = template.Clone();

		const rotation = random.NextNumber(0, 360);
		const scale = random.NextNumber(0.7, 1.0);

		tree.PivotTo(new CFrame(position).mul(CFrame.Angles(0, math.rad(rotation), 0)));
		tree.ScaleTo(scale);

		tree.Parent = parent;
	}

	// ============================================================================
	// Public API
	// ============================================================================

	/**
	 * Clear all generated graveyards
	 */
	clearGraveyards() {
		if (this.chunkUpdateConnection) {
			this.chunkUpdateConnection.Disconnect();
			this.chunkUpdateConnection = undefined;
		}

		this.chunks.clear();
		this.biomeZones = [];
		this.paths = [];
		this.cryptPlacements = [];

		if (this.graveyardFolder) {
			this.graveyardFolder.Destroy();
			this.graveyardFolder = undefined;
		}
	}

	/**
	 * Regenerate with a new seed
	 */
	regenerate(config: Partial<GraveyardConfig> = {}) {
		this.clearGraveyards();
		return this.generateGraveyard(config);
	}

	/**
	 * Trigger generation for a specific area (useful for expansion unlocks)
	 */
	expandGraveyard(direction: "north" | "south" | "east" | "west", amount: number = 50) {
		if (!this.currentConfig || !this.graveyardFolder) {
			warn("GraveyardGenerator: No graveyard exists to expand!");
			return;
		}

		const config = this.currentConfig;
		const random = new Random((config.seed ?? 0) + os.time());

		let startX: number, startZ: number, width: number, depth: number;

		switch (direction) {
			case "north":
				startX = -config.size.X / 2;
				startZ = -config.size.Y / 2 - amount;
				width = config.size.X;
				depth = amount;
				config.size = new Vector2(config.size.X, config.size.Y + amount);
				config.origin = config.origin.sub(new Vector3(0, 0, amount / 2));
				break;
			case "south":
				startX = -config.size.X / 2;
				startZ = config.size.Y / 2;
				width = config.size.X;
				depth = amount;
				config.size = new Vector2(config.size.X, config.size.Y + amount);
				config.origin = config.origin.add(new Vector3(0, 0, amount / 2));
				break;
			case "east":
				startX = config.size.X / 2;
				startZ = -config.size.Y / 2;
				width = amount;
				depth = config.size.Y;
				config.size = new Vector2(config.size.X + amount, config.size.Y);
				config.origin = config.origin.add(new Vector3(amount / 2, 0, 0));
				break;
			case "west":
				startX = -config.size.X / 2 - amount;
				startZ = -config.size.Y / 2;
				width = amount;
				depth = config.size.Y;
				config.size = new Vector2(config.size.X + amount, config.size.Y);
				config.origin = config.origin.sub(new Vector3(amount / 2, 0, 0));
				break;
		}

		// Generate expansion content
		const expansionFolder = new Instance("Folder");
		expansionFolder.Name = `Expansion_${direction}`;
		expansionFolder.Parent = this.graveyardFolder;

		const cellSize = 8;
		const cellsX = math.floor(width / cellSize);
		const cellsZ = math.floor(depth / cellSize);

		for (let cx = 0; cx < cellsX; cx++) {
			for (let cz = 0; cz < cellsZ; cz++) {
				const localX = startX + cx * cellSize;
				const localZ = startZ + cz * cellSize;

				if (this.isOnPath(localX, localZ)) continue;

				const biome = config.useBiomes ? this.getBiomeAt(localX, localZ) : undefined;
				const headstoneDensity = biome?.headstoneDensity ?? 0.15;
				const treeDensity = biome?.treeDensity ?? 0.02;

				const offsetX = random.NextNumber(-cellSize / 4, cellSize / 4);
				const offsetZ = random.NextNumber(-cellSize / 4, cellSize / 4);

				const worldX = config.origin.X + localX + offsetX;
				const worldZ = config.origin.Z + localZ + offsetZ;
				const position = new Vector3(worldX, config.origin.Y, worldZ);

				const roll = random.NextNumber();

				if (roll < treeDensity) {
					this.placeTree(expansionFolder, position, random);
				} else if (roll < treeDensity + headstoneDensity) {
					this.placeHeadstone(expansionFolder, position, random);
				}
			}
		}

		// Update chunk system if enabled
		if (config.useChunks) {
			this.initializeChunks(config);
		}

		print(`GraveyardGenerator: Expanded graveyard ${direction} by ${amount} studs`);
	}

	/**
	 * Force load all chunks (useful for screenshots or when streaming isn't needed)
	 */
	loadAllChunks() {
		if (!this.currentConfig) return;

		for (const [_, chunk] of this.chunks) {
			if (!chunk.loaded) {
				this.loadChunk(chunk, this.currentConfig);
			}
		}

		print("GraveyardGenerator: All chunks loaded");
	}

	/**
	 * Get stats about the current graveyard
	 */
	getStats(): { totalChunks: number; loadedChunks: number; biomeCount: number; pathCount: number } {
		let loadedChunks = 0;
		for (const [_, chunk] of this.chunks) {
			if (chunk.loaded) loadedChunks++;
		}

		return {
			totalChunks: this.chunks.size(),
			loadedChunks,
			biomeCount: this.biomeZones.size(),
			pathCount: this.paths.size(),
		};
	}
}
