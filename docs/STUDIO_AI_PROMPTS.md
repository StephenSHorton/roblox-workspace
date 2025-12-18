# Loot Goblin - Roblox Studio AI Prompts

Copy-paste these prompts one at a time into Roblox Studio's AI assistant to build the game infrastructure.

**Run prompts in order.** Each section builds on the previous one.

---

## Section 1: ServerStorage Setup

### Prompt 1.1: Create Enemies Folder

> Create a Folder named "Enemies" inside ServerStorage.

**Expected:** `ServerStorage/Enemies` folder exists

---

### Prompt 1.2: Create Goblin Model

> Inside the ServerStorage/Enemies folder, create a small humanoid enemy model named "Goblin". It should be an R6 rig with a Humanoid and HumanoidRootPart. Scale it to 80% of normal size. Set the PrimaryPart to HumanoidRootPart. Give it a green color scheme.

**Expected:** `ServerStorage/Enemies/Goblin` model with Humanoid + HumanoidRootPart

---

### Prompt 1.3: Create Skeleton Model

> Inside the ServerStorage/Enemies folder, create a humanoid enemy model named "Skeleton". It should be an R6 rig with a Humanoid and HumanoidRootPart. Keep it at normal size. Set the PrimaryPart to HumanoidRootPart. Give it a white/bone color scheme.

**Expected:** `ServerStorage/Enemies/Skeleton` model with Humanoid + HumanoidRootPart

---

### Prompt 1.4: Create Ogre Model

> Inside the ServerStorage/Enemies folder, create a large humanoid enemy model named "Ogre". It should be an R6 rig with a Humanoid and HumanoidRootPart. Scale it to 150% of normal size. Set the PrimaryPart to HumanoidRootPart. Give it a brown/tan color scheme.

**Expected:** `ServerStorage/Enemies/Ogre` model with Humanoid + HumanoidRootPart

---

### Prompt 1.5: Create Boss Model

> Inside the ServerStorage/Enemies folder, create a very large humanoid enemy model named "Boss". It should be an R6 rig with a Humanoid and HumanoidRootPart. Scale it to 250% of normal size. Set the PrimaryPart to HumanoidRootPart. Give it a dark red/black intimidating color scheme.

**Expected:** `ServerStorage/Enemies/Boss` model with Humanoid + HumanoidRootPart

---

## Section 2: Lobby Area

### Prompt 2.1: Create Lobby Folder

> Create a Folder named "Lobby" inside Workspace. This will contain all lobby-related instances.

**Expected:** `Workspace/Lobby` folder exists

---

### Prompt 2.2: Create Lobby Floor

> Inside the Workspace/Lobby folder, create a large Part named "Floor" for the lobby platform. Set its Size to 50, 1, 50 studs. Position it at 0, 0, 0. Set the Material to SmoothPlastic and Color to a light gray. Anchor it.

**Expected:** `Workspace/Lobby/Floor` - a 50x50 stud platform

---

### Prompt 2.3: Create Lobby Spawn Points

> Inside the Workspace/Lobby folder, create 3 small Parts to serve as player spawn points. Name them "LobbySpawn1", "LobbySpawn2", and "LobbySpawn3". Each should be Size 2, 1, 2 studs. Position them spread out on the lobby floor: LobbySpawn1 at -10, 1, 0; LobbySpawn2 at 0, 1, 0; LobbySpawn3 at 10, 1, 0. Set Transparency to 1 and CanCollide to false. Anchor them. Add the tag "LobbySpawn" to each of these 3 parts.

**Expected:** 3 invisible spawn points with `LobbySpawn` tag

---

## Section 3: Dungeon Structure

### Prompt 3.1: Create Dungeon Folder

> Create a Folder named "Dungeon" inside Workspace. This will contain all dungeon rooms.

**Expected:** `Workspace/Dungeon` folder exists

---

## Section 4: Room 0 (First Dungeon Room)

### Prompt 4.1: Create Room 0 Folder and Floor

> Inside the Workspace/Dungeon folder, create a Folder named "Room0". Inside Room0, create a Part named "Floor" with Size 60, 1, 40 studs. Position it at 0, 0, 100 (offset from lobby). Set Material to Brick and Color to dark gray. Anchor it.

**Expected:** `Workspace/Dungeon/Room0/Floor` platform

---

### Prompt 4.2: Create Room 0 Player Spawns

> Inside Workspace/Dungeon/Room0, create 2 Parts named "PlayerSpawn1" and "PlayerSpawn2". Each should be Size 2, 1, 2 studs. Position PlayerSpawn1 at -10, 1, 85; PlayerSpawn2 at 10, 1, 85 (near the entrance of the room). Set Transparency to 1 and CanCollide to false. Anchor them. Add the tag "Room" to both parts. Add a Number attribute named "RoomIndex" with value 0 to both parts.

**Expected:** 2 spawn points with `Room` tag and `RoomIndex = 0` attribute

---

### Prompt 4.3: Create Room 0 Enemy Spawns

> Inside Workspace/Dungeon/Room0, create 3 Parts for enemy spawns named "EnemySpawn1", "EnemySpawn2", and "EnemySpawn3". Each should be Size 2, 1, 2 studs. Position them spread across the room: EnemySpawn1 at -15, 1, 110; EnemySpawn2 at 0, 1, 115; EnemySpawn3 at 15, 1, 110. Set Transparency to 1 and CanCollide to false. Anchor them. Add the tag "EnemySpawn" to all 3 parts. Add a String attribute named "RoomId" with value "room_0" to all 3 parts. Add a String attribute named "EnemyType" with value "Goblin" to all 3 parts.

**Expected:** 3 enemy spawns with `EnemySpawn` tag, `RoomId = "room_0"`, `EnemyType = "Goblin"`

---

### Prompt 4.4: Create Door 0

> Inside Workspace/Dungeon, create a Part named "Door0" that acts as a barrier between Room 0 and Room 1. Set Size to 10, 8, 2 studs. Position it at 0, 4, 130 (at the far end of Room 0). Set Material to Metal and Color to dark red. Anchor it. Add the tag "Door" to this part. Add a Number attribute named "RoomIndex" with value 0.

**Expected:** Door barrier with `Door` tag and `RoomIndex = 0`

---

### Prompt 4.5: Create Room Trigger 0

> Inside Workspace/Dungeon, create a Part named "RoomTrigger0" that will detect when players pass through the door. Set Size to 10, 10, 4 studs. Position it at 0, 5, 135 (just past Door0). Set Transparency to 1 and CanCollide to false. Anchor it. Add the tag "RoomTrigger" to this part.

**Expected:** Invisible trigger zone with `RoomTrigger` tag

---

## Section 5: Room 1 (Second Dungeon Room)

### Prompt 5.1: Create Room 1 Folder and Floor

> Inside the Workspace/Dungeon folder, create a Folder named "Room1". Inside Room1, create a Part named "Floor" with Size 60, 1, 40 studs. Position it at 0, 0, 180 (continuing from Room 0). Set Material to Brick and Color to dark gray. Anchor it.

**Expected:** `Workspace/Dungeon/Room1/Floor` platform

---

### Prompt 5.2: Create Room 1 Player Spawns

> Inside Workspace/Dungeon/Room1, create 2 Parts named "PlayerSpawn1" and "PlayerSpawn2". Each should be Size 2, 1, 2 studs. Position PlayerSpawn1 at -10, 1, 165; PlayerSpawn2 at 10, 1, 165. Set Transparency to 1 and CanCollide to false. Anchor them. Add the tag "Room" to both parts. Add a Number attribute named "RoomIndex" with value 1 to both parts.

**Expected:** 2 spawn points with `Room` tag and `RoomIndex = 1`

---

### Prompt 5.3: Create Room 1 Enemy Spawns

> Inside Workspace/Dungeon/Room1, create 4 Parts for enemy spawns named "EnemySpawn1" through "EnemySpawn4". Each should be Size 2, 1, 2 studs. Position them spread across the room. Set Transparency to 1 and CanCollide to false. Anchor them. Add the tag "EnemySpawn" to all 4 parts. Add a String attribute named "RoomId" with value "room_1" to all 4 parts. For EnemySpawn1 and EnemySpawn2, set the String attribute "EnemyType" to "Goblin". For EnemySpawn3 and EnemySpawn4, set the String attribute "EnemyType" to "Skeleton".

**Expected:** 4 enemy spawns: 2 Goblins + 2 Skeletons

---

### Prompt 5.4: Create Door 1

> Inside Workspace/Dungeon, create a Part named "Door1". Set Size to 10, 8, 2 studs. Position it at 0, 4, 210 (at the far end of Room 1). Set Material to Metal and Color to dark red. Anchor it. Add the tag "Door" to this part. Add a Number attribute named "RoomIndex" with value 1.

**Expected:** Door with `Door` tag and `RoomIndex = 1`

---

### Prompt 5.5: Create Room Trigger 1

> Inside Workspace/Dungeon, create a Part named "RoomTrigger1". Set Size to 10, 10, 4 studs. Position it at 0, 5, 215 (just past Door1). Set Transparency to 1 and CanCollide to false. Anchor it. Add the tag "RoomTrigger" to this part.

**Expected:** Invisible trigger with `RoomTrigger` tag

---

## Section 6: Room 2 (Third Dungeon Room)

### Prompt 6.1: Create Room 2 Folder and Floor

> Inside the Workspace/Dungeon folder, create a Folder named "Room2". Inside Room2, create a Part named "Floor" with Size 60, 1, 40 studs. Position it at 0, 0, 260. Set Material to Brick and Color to dark gray. Anchor it.

**Expected:** `Workspace/Dungeon/Room2/Floor` platform

---

### Prompt 6.2: Create Room 2 Player Spawns

> Inside Workspace/Dungeon/Room2, create 2 Parts named "PlayerSpawn1" and "PlayerSpawn2". Each should be Size 2, 1, 2 studs. Position PlayerSpawn1 at -10, 1, 245; PlayerSpawn2 at 10, 1, 245. Set Transparency to 1 and CanCollide to false. Anchor them. Add the tag "Room" to both parts. Add a Number attribute named "RoomIndex" with value 2 to both parts.

**Expected:** 2 spawn points with `Room` tag and `RoomIndex = 2`

---

### Prompt 6.3: Create Room 2 Enemy Spawns

> Inside Workspace/Dungeon/Room2, create 4 Parts for enemy spawns named "EnemySpawn1" through "EnemySpawn4". Each should be Size 2, 1, 2 studs. Position them spread across the room. Set Transparency to 1 and CanCollide to false. Anchor them. Add the tag "EnemySpawn" to all 4 parts. Add a String attribute named "RoomId" with value "room_2" to all 4 parts. For EnemySpawn1 and EnemySpawn2, set the String attribute "EnemyType" to "Skeleton". For EnemySpawn3 and EnemySpawn4, set the String attribute "EnemyType" to "Ogre".

**Expected:** 4 enemy spawns: 2 Skeletons + 2 Ogres

---

### Prompt 6.4: Create Door 2

> Inside Workspace/Dungeon, create a Part named "Door2". Set Size to 10, 8, 2 studs. Position it at 0, 4, 290 (at the far end of Room 2). Set Material to Metal and Color to dark red. Anchor it. Add the tag "Door" to this part. Add a Number attribute named "RoomIndex" with value 2.

**Expected:** Door with `Door` tag and `RoomIndex = 2`

---

### Prompt 6.5: Create Room Trigger 2

> Inside Workspace/Dungeon, create a Part named "RoomTrigger2". Set Size to 10, 10, 4 studs. Position it at 0, 5, 295 (just past Door2). Set Transparency to 1 and CanCollide to false. Anchor it. Add the tag "RoomTrigger" to this part.

**Expected:** Invisible trigger with `RoomTrigger` tag

---

## Section 7: Boss Arena

### Prompt 7.1: Create Boss Arena Folder and Floor

> Inside Workspace, create a Folder named "BossArena". Inside BossArena, create a Part named "Floor" with Size 80, 1, 80 studs. Position it at 0, 0, 380 (after the dungeon). Set Material to Cobblestone and Color to a dark charcoal gray. Anchor it.

**Expected:** `Workspace/BossArena/Floor` - large 80x80 arena

---

### Prompt 7.2: Create Boss Spawn Point

> Inside Workspace/BossArena, create a Part named "BossSpawn". Set Size to 4, 1, 4 studs. Position it at 0, 1, 400 (center-back of the arena). Set Transparency to 1 and CanCollide to false. Anchor it. Add the tag "BossSpawn" to this part.

**Expected:** Single boss spawn with `BossSpawn` tag

---

### Prompt 7.3: Create Boss Arena Player Spawns

> Inside Workspace/BossArena, create 4 Parts for player spawns named "PlayerSpawn1" through "PlayerSpawn4". Each should be Size 2, 1, 2 studs. Position them around the front/sides of the arena: PlayerSpawn1 at -25, 1, 350; PlayerSpawn2 at 25, 1, 350; PlayerSpawn3 at -25, 1, 370; PlayerSpawn4 at 25, 1, 370. Set Transparency to 1 and CanCollide to false. Anchor them. Add the tag "BossRoom" to all 4 parts.

**Expected:** 4 spawn points with `BossRoom` tag

---

## Section 8: Corridors (Optional Visual Enhancement)

### Prompt 8.1: Create Lobby to Room 0 Corridor

> Create a Part named "Corridor0" inside Workspace/Dungeon. Set Size to 10, 1, 50 studs to connect the lobby to Room 0. Position it at 0, 0, 50. Set Material to Brick and Color to match the dungeon floors. Anchor it.

**Expected:** Walkway connecting Lobby to Room 0

---

### Prompt 8.2: Create Room-to-Room Corridors

> Create Parts for corridors between each room. Create "Corridor1" at position 0, 0, 150 connecting Room 0 to Room 1. Create "Corridor2" at position 0, 0, 230 connecting Room 1 to Room 2. Create "Corridor3" at position 0, 0, 310 connecting Room 2 to Boss Arena. Each corridor should be Size 10, 1, 20 studs. Set Material to Brick. Anchor them.

**Expected:** Corridors connecting all areas

---

## Section 9: Walls (Optional Visual Enhancement)

### Prompt 9.1: Create Lobby Walls

> Inside Workspace/Lobby, create 4 wall Parts to enclose the lobby area. Create "WallNorth" at 0, 5, 25 with Size 50, 10, 1. Create "WallSouth" at 0, 5, -25 with Size 50, 10, 1. Create "WallEast" at 25, 5, 0 with Size 1, 10, 50. Create "WallWest" at -25, 5, 0 with Size 1, 10, 50. Leave an opening in WallNorth for the corridor to the dungeon. Set Material to SmoothPlastic. Anchor them.

**Expected:** Enclosed lobby area

---

### Prompt 9.2: Create Dungeon Room Walls

> For each dungeon room (Room0, Room1, Room2), create wall Parts to enclose the sides. Leave openings for the entrance and exit corridors. Set Material to Brick or Stone. Use a dark color scheme. Anchor all walls.

**Expected:** Enclosed dungeon rooms

---

## Verification Prompts

### Verify: Check Tags

> List all instances in the game that have the following tags: "LobbySpawn", "Room", "EnemySpawn", "Door", "RoomTrigger", "BossRoom", "BossSpawn". Tell me how many of each exist.

**Expected counts:**
- LobbySpawn: 3
- Room: 6 (2 per room × 3 rooms)
- EnemySpawn: 11 (3 + 4 + 4)
- Door: 3
- RoomTrigger: 3
- BossRoom: 4
- BossSpawn: 1

---

### Verify: Check Enemy Models

> Check that the ServerStorage/Enemies folder contains 4 models: Goblin, Skeleton, Ogre, and Boss. Verify each model has a Humanoid and HumanoidRootPart instance.

**Expected:** All 4 models present with required children

---

### Verify: Check Attributes

> Check all Parts with the "EnemySpawn" tag and verify they have both "RoomId" (String) and "EnemyType" (String) attributes set. List any that are missing attributes.

**Expected:** All EnemySpawn parts have both attributes

---

## Quick Reference: All Tags

| Tag | Purpose | Attributes |
|-----|---------|------------|
| `LobbySpawn` | Player spawn in lobby | — |
| `Room` | Player spawn in dungeon room | `RoomIndex` (Number) |
| `EnemySpawn` | Enemy spawn location | `RoomId` (String), `EnemyType` (String) |
| `Door` | Room barrier | `RoomIndex` (Number) |
| `RoomTrigger` | Room progression trigger | — |
| `BossRoom` | Player spawn in boss arena | — |
| `BossSpawn` | Boss spawn location | — |

---

## Quick Reference: Attribute Values

| Attribute | Type | Valid Values |
|-----------|------|--------------|
| `RoomIndex` | Number | `0`, `1`, `2` |
| `RoomId` | String | `"room_0"`, `"room_1"`, `"room_2"` |
| `EnemyType` | String | `"Goblin"`, `"Skeleton"`, `"Ogre"` |

---

*Total prompts: 27 (core) + 4 (optional) + 3 (verification) = 34*
