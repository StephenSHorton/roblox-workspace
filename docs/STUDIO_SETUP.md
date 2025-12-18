# Loot Goblin - Roblox Studio Setup Guide

This document describes everything that must be built in Roblox Studio to support the compiled TypeScript/Flamework code. Follow this guide to set up the place file with all required instances, tags, and attributes.

---

## Quick Reference Checklist

### Prerequisites
- [ ] Rojo VS Code extension installed
- [ ] `bun run build` completed successfully
- [ ] Rojo sync connected to Studio

### ServerStorage
- [ ] `Enemies` folder created
- [ ] `Goblin` model with Humanoid + HumanoidRootPart
- [ ] `Skeleton` model with Humanoid + HumanoidRootPart
- [ ] `Ogre` model with Humanoid + HumanoidRootPart
- [ ] `Boss` model with Humanoid + HumanoidRootPart

### Lobby Area
- [ ] 2-4 parts tagged `LobbySpawn`
- [ ] Lobby geometry/platforms

### Dungeon Rooms (repeat for rooms 0-3)
- [ ] Room spawn parts tagged `Room` with `RoomIndex` attribute
- [ ] Enemy spawn parts tagged `EnemySpawn` with `RoomId` + `EnemyType` attributes
- [ ] Door part tagged `Door` with `RoomIndex` attribute
- [ ] Trigger part tagged `RoomTrigger`

### Boss Arena
- [ ] 1 part tagged `BossSpawn`
- [ ] 2-4 parts tagged `BossRoom`
- [ ] Boss arena geometry

---

## 1. ServerStorage Setup

Create the following folder structure in ServerStorage:

```
ServerStorage/
└── Enemies/
    ├── Goblin    (Model)
    ├── Skeleton  (Model)
    ├── Ogre      (Model)
    └── Boss      (Model)
```

### Enemy Model Requirements

Each enemy model **must** have:
- `Humanoid` instance (for health tracking and death detection)
- `HumanoidRootPart` (BasePart for positioning)
- `PrimaryPart` property set (or code will use HumanoidRootPart)

| Model | HP | Damage | Speed | Attack Windup | Suggested Scale |
|-------|-----|--------|-------|---------------|-----------------|
| Goblin | 30 | 8 | 18 studs/s | 0.3s | Small (0.8x) |
| Skeleton | 50 | 12 | 14 studs/s | 0.5s | Normal (1x) |
| Ogre | 100 | 20 | 10 studs/s | 0.8s | Large (1.5x) |
| Boss | 500 | 25 | 8 studs/s | 1.0s | Very Large (2.5x) |

**Note:** You can use simple R6/R15 rigs or custom meshes. The code only requires the Humanoid and HumanoidRootPart to function.

---

## 2. Tag Reference

### Tags You Create in Studio

These tags must be added manually to parts in your place file:

| Tag | Instance Type | Required Attributes | Purpose |
|-----|--------------|---------------------|---------|
| `LobbySpawn` | BasePart | — | Player spawn points in lobby |
| `Room` | BasePart | `RoomIndex`: number | Player spawn points in dungeon rooms |
| `EnemySpawn` | BasePart | `RoomId`: string, `EnemyType`: string | Where enemies spawn |
| `Door` | BasePart | `RoomIndex`: number | Barriers between rooms |
| `RoomTrigger` | BasePart | — | Invisible triggers to advance rooms |
| `BossRoom` | BasePart | — | Player spawn points in boss arena |
| `BossSpawn` | BasePart | — | Where the boss spawns (exactly 1) |

### Tags Added by Code (Runtime)

These are managed automatically - do NOT create these manually:

| Tag | Instance Type | Attributes Set by Code |
|-----|--------------|------------------------|
| `Enemy` | Model | `EnemyId`, `EnemyType`, `RoomId` |
| `Boss` | Model | `EnemyId`, `EnemyType` |
| `Loot` | Part | `LootId`, `Stat`, `Amount`, `Rarity` |

---

## 3. Attribute Specifications

### RoomIndex (number)
- **Used by:** `Room`, `Door` tags
- **Type:** Number (integer)
- **Valid values:** `0`, `1`, `2`, `3`
- **Purpose:** Links spawn points and doors to specific rooms
- **Example:** Room 0 spawns link to Door 0

### RoomId (string)
- **Used by:** `EnemySpawn` tag
- **Type:** String
- **Format:** `"room_X"` where X is the room index
- **Valid values:** `"room_0"`, `"room_1"`, `"room_2"`, `"room_3"`
- **Purpose:** Links enemy spawns to rooms for the spawning system

### EnemyType (string)
- **Used by:** `EnemySpawn` tag
- **Type:** String
- **Valid values:** `"Goblin"`, `"Skeleton"`, `"Ogre"`
- **Purpose:** Determines which enemy model spawns at this point
- **Case sensitive:** Must match exactly

---

## 4. Workspace Layout - Lobby Area

The lobby is where players spawn and ready up before entering the dungeon.

### Required Instances

| Instance | Tag | Attributes | Quantity |
|----------|-----|------------|----------|
| Spawn points | `LobbySpawn` | — | 2-4 |
| Platform/ground | — | — | As needed |

### Setup Steps

1. Create a Part or multiple Parts for your lobby floor/platform
2. Create 2-4 small Parts (e.g., 2x1x2 studs) as spawn markers
3. Add the `LobbySpawn` tag to each spawn marker
4. Position spawn markers on the lobby floor, spaced 5+ studs apart
5. Set spawn markers to `Transparency = 1` and `CanCollide = false` if you want them invisible

### Level Design Recommendations

- **Size:** ~50x50 studs minimum
- **Spawn spacing:** 5+ studs apart
- **Visual identity:** Make it visually distinct from the dungeon
- **Safe zone:** No enemies spawn here

---

## 5. Workspace Layout - Dungeon Rooms

The dungeon consists of 3-4 connected rooms, each with enemies to defeat.

### Room Structure

Each room needs:

| Instance | Tag | Attributes | Purpose |
|----------|-----|------------|---------|
| Player spawns | `Room` | `RoomIndex = N` | Where players teleport when entering room |
| Enemy spawns | `EnemySpawn` | `RoomId = "room_N"`, `EnemyType = "..."` | Where enemies spawn |
| Exit door | `Door` | `RoomIndex = N` | Blocks path to next room |
| Room trigger | `RoomTrigger` | — | Advances to next room when touched |

### Room-by-Room Setup

#### Room 0 (First Room)
```
Parts needed:
├── Spawn1    [Tag: Room, RoomIndex=0]
├── Spawn2    [Tag: Room, RoomIndex=0]  (optional, for multiplayer spread)
├── EnemySpawn1 [Tag: EnemySpawn, RoomId="room_0", EnemyType="Goblin"]
├── EnemySpawn2 [Tag: EnemySpawn, RoomId="room_0", EnemyType="Goblin"]
├── Door0     [Tag: Door, RoomIndex=0]
└── Trigger0  [Tag: RoomTrigger]
```

#### Room 1
```
Parts needed:
├── Spawn1    [Tag: Room, RoomIndex=1]
├── EnemySpawn1 [Tag: EnemySpawn, RoomId="room_1", EnemyType="Goblin"]
├── EnemySpawn2 [Tag: EnemySpawn, RoomId="room_1", EnemyType="Skeleton"]
├── Door1     [Tag: Door, RoomIndex=1]
└── Trigger1  [Tag: RoomTrigger]
```

#### Room 2
```
Parts needed:
├── Spawn1    [Tag: Room, RoomIndex=2]
├── EnemySpawn1 [Tag: EnemySpawn, RoomId="room_2", EnemyType="Skeleton"]
├── EnemySpawn2 [Tag: EnemySpawn, RoomId="room_2", EnemyType="Skeleton"]
├── EnemySpawn3 [Tag: EnemySpawn, RoomId="room_2", EnemyType="Ogre"]
├── Door2     [Tag: Door, RoomIndex=2]
└── Trigger2  [Tag: RoomTrigger]
```

#### Room 3 (Optional - leads to boss)
```
Parts needed:
├── Spawn1    [Tag: Room, RoomIndex=3]
├── EnemySpawn1 [Tag: EnemySpawn, RoomId="room_3", EnemyType="Ogre"]
├── EnemySpawn2 [Tag: EnemySpawn, RoomId="room_3", EnemyType="Ogre"]
├── Door3     [Tag: Door, RoomIndex=3]
└── Trigger3  [Tag: RoomTrigger]
```

### Door Behavior

Doors are controlled by the game code:
- **Initial state:** `CanCollide = true`, `Transparency = 0` (solid, blocking)
- **When room cleared:** `CanCollide = false`, `Transparency = 0.8` (passable)

Set your door parts with the initial state. The code handles unlocking.

### RoomTrigger Placement

- Place RoomTrigger parts **after** the door (on the exit side)
- Make them invisible: `Transparency = 1`
- Make them non-solid: `CanCollide = false`
- Size them to cover the passageway (e.g., 10x10x2 studs)

When a player touches the RoomTrigger, they advance to the next room.

### Level Design Recommendations

**Room Dimensions:**
- Size: ~60x40 studs per room
- Height: 15+ studs ceiling

**Enemy Spawns:**
- 2-4 per room
- Spacing: 8+ studs apart (prevents overlap)
- Place strategically for combat flow

**Doors:**
- Width: ~10 studs
- Clearly visible as a barrier

**Corridors:**
- Length: ~20 studs between rooms
- RoomTrigger covers the corridor

---

## 6. Workspace Layout - Boss Arena

The final area where players fight the boss before PvP.

### Required Instances

| Instance | Tag | Attributes | Quantity |
|----------|-----|------------|----------|
| Boss spawn | `BossSpawn` | — | Exactly 1 |
| Player spawns | `BossRoom` | — | 2-4 |
| Arena geometry | — | — | As needed |

### Setup Steps

1. Create a large open arena (80x80 studs recommended)
2. Place a single Part and tag it `BossSpawn` - this is where the boss appears
3. Create 2-4 Parts tagged `BossRoom` for player spawn points
4. Spread `BossRoom` spawns around the arena edges
5. Make spawn points invisible (`Transparency = 1`, `CanCollide = false`)

### Level Design Recommendations

**Arena Size:**
- Minimum: 80x80 studs
- Open center for boss movement
- Room for 6 players to maneuver

**Boss Spawn:**
- Place at center or far end of arena
- Clear line of sight from all player spawns

**Player Spawns:**
- Distribute around arena perimeter
- 10+ studs apart
- Face toward arena center

---

## 7. Room Progression Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GAME FLOW DIAGRAM                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    LOBBY                         DUNGEON                           BOSS
  ┌───────┐     ┌───────┐     ┌───────┐     ┌───────┐     ┌───────┐
  │       │     │ Room  │     │ Room  │     │ Room  │     │ Boss  │
  │ Lobby │────►│   0   │────►│   1   │────►│   2   │────►│ Arena │
  │       │     │       │     │       │     │       │     │       │
  └───────┘     └───┬───┘     └───┬───┘     └───┬───┘     └───────┘
                    │             │             │              │
                 Door 0        Door 1        Door 2         Boss Dies
                    │             │             │              │
                    ▼             ▼             ▼              ▼
               [Unlocks      [Unlocks      [Unlocks        [PvP Phase
               when room     when room     when room        Begins]
               cleared]      cleared]      cleared]

Phase Transitions:
  Lobby ─────► Countdown (10s) ─────► Dungeon ─────► Boss ─────► PvP ─────► Victory
     ▲                                                                         │
     └─────────────────────────────────────────────────────────────────────────┘
                                   (10s reset)
```

---

## 8. Complete Instance Tree

Recommended folder organization in Workspace:

```
Workspace/
├── Lobby/
│   ├── Floor (Part - lobby platform)
│   ├── LobbySpawn1 (Part) [Tag: LobbySpawn]
│   ├── LobbySpawn2 (Part) [Tag: LobbySpawn]
│   ├── LobbySpawn3 (Part) [Tag: LobbySpawn]
│   └── Decorations/ (optional)
│
├── Dungeon/
│   ├── Room0/
│   │   ├── Floor (Part)
│   │   ├── Walls (Model/Parts)
│   │   ├── PlayerSpawn1 (Part) [Tag: Room, RoomIndex=0]
│   │   ├── PlayerSpawn2 (Part) [Tag: Room, RoomIndex=0]
│   │   ├── EnemySpawn1 (Part) [Tag: EnemySpawn, RoomId="room_0", EnemyType="Goblin"]
│   │   ├── EnemySpawn2 (Part) [Tag: EnemySpawn, RoomId="room_0", EnemyType="Goblin"]
│   │   └── EnemySpawn3 (Part) [Tag: EnemySpawn, RoomId="room_0", EnemyType="Goblin"]
│   │
│   ├── Corridor0/
│   │   ├── Floor (Part)
│   │   ├── Door0 (Part) [Tag: Door, RoomIndex=0]
│   │   └── RoomTrigger0 (Part) [Tag: RoomTrigger]
│   │
│   ├── Room1/
│   │   ├── Floor (Part)
│   │   ├── Walls (Model/Parts)
│   │   ├── PlayerSpawn1 (Part) [Tag: Room, RoomIndex=1]
│   │   ├── EnemySpawn1 (Part) [Tag: EnemySpawn, RoomId="room_1", EnemyType="Goblin"]
│   │   ├── EnemySpawn2 (Part) [Tag: EnemySpawn, RoomId="room_1", EnemyType="Skeleton"]
│   │   └── EnemySpawn3 (Part) [Tag: EnemySpawn, RoomId="room_1", EnemyType="Skeleton"]
│   │
│   ├── Corridor1/
│   │   ├── Floor (Part)
│   │   ├── Door1 (Part) [Tag: Door, RoomIndex=1]
│   │   └── RoomTrigger1 (Part) [Tag: RoomTrigger]
│   │
│   ├── Room2/
│   │   ├── Floor (Part)
│   │   ├── Walls (Model/Parts)
│   │   ├── PlayerSpawn1 (Part) [Tag: Room, RoomIndex=2]
│   │   ├── EnemySpawn1 (Part) [Tag: EnemySpawn, RoomId="room_2", EnemyType="Skeleton"]
│   │   ├── EnemySpawn2 (Part) [Tag: EnemySpawn, RoomId="room_2", EnemyType="Skeleton"]
│   │   └── EnemySpawn3 (Part) [Tag: EnemySpawn, RoomId="room_2", EnemyType="Ogre"]
│   │
│   ├── Corridor2/
│   │   ├── Floor (Part)
│   │   ├── Door2 (Part) [Tag: Door, RoomIndex=2]
│   │   └── RoomTrigger2 (Part) [Tag: RoomTrigger]
│   │
│   └── Room3/ (optional)
│       ├── Floor (Part)
│       ├── Walls (Model/Parts)
│       ├── PlayerSpawn1 (Part) [Tag: Room, RoomIndex=3]
│       ├── EnemySpawn1 (Part) [Tag: EnemySpawn, RoomId="room_3", EnemyType="Ogre"]
│       ├── EnemySpawn2 (Part) [Tag: EnemySpawn, RoomId="room_3", EnemyType="Ogre"]
│       ├── Door3 (Part) [Tag: Door, RoomIndex=3]
│       └── RoomTrigger3 (Part) [Tag: RoomTrigger]
│
└── BossArena/
    ├── Floor (Part - large arena floor)
    ├── Walls (Model/Parts)
    ├── BossSpawnPoint (Part) [Tag: BossSpawn]
    ├── PlayerSpawn1 (Part) [Tag: BossRoom]
    ├── PlayerSpawn2 (Part) [Tag: BossRoom]
    ├── PlayerSpawn3 (Part) [Tag: BossRoom]
    └── PlayerSpawn4 (Part) [Tag: BossRoom]

ServerStorage/
└── Enemies/
    ├── Goblin (Model)
    │   ├── Humanoid
    │   ├── HumanoidRootPart
    │   └── (body parts)
    ├── Skeleton (Model)
    │   ├── Humanoid
    │   ├── HumanoidRootPart
    │   └── (body parts)
    ├── Ogre (Model)
    │   ├── Humanoid
    │   ├── HumanoidRootPart
    │   └── (body parts)
    └── Boss (Model)
        ├── Humanoid
        ├── HumanoidRootPart
        └── (body parts)
```

---

## 9. How to Add Tags in Roblox Studio

### Using the Tags Editor (Recommended)

1. Open the **Tags** window: View → Tags
2. Select the Part you want to tag
3. Click **Add Tag** in the Tags window
4. Type the tag name exactly (e.g., `LobbySpawn`)
5. Press Enter

### Using the Properties Panel

1. Select the Part
2. In Properties, find the **Tags** property
3. Click the "..." button
4. Add your tag

### Using the Command Bar

```lua
-- Example: Tag a selected part as LobbySpawn
local CollectionService = game:GetService("CollectionService")
CollectionService:AddTag(game.Selection:Get()[1], "LobbySpawn")
```

---

## 10. How to Add Attributes in Roblox Studio

1. Select the Part with the tag
2. In the Properties panel, scroll to the **Attributes** section
3. Click the **+** button to add a new attribute
4. Enter the attribute name (e.g., `RoomIndex`)
5. Select the type (Number for `RoomIndex`, String for `RoomId` and `EnemyType`)
6. Enter the value

### Attribute Quick Reference

| Attribute | Type | Example Value |
|-----------|------|---------------|
| `RoomIndex` | Number | `0`, `1`, `2`, `3` |
| `RoomId` | String | `"room_0"`, `"room_1"` |
| `EnemyType` | String | `"Goblin"`, `"Skeleton"`, `"Ogre"` |

---

## 11. Testing Checklist

After setup, verify each system works:

### Basic Setup
- [ ] Rojo sync shows no errors
- [ ] Code compiles without errors (`bun run build`)
- [ ] Enemy models exist in ServerStorage/Enemies
- [ ] All 4 enemy models have Humanoid and HumanoidRootPart

### Lobby
- [ ] Player spawns in lobby on join
- [ ] Ready button appears in UI
- [ ] Countdown starts when ready
- [ ] Player teleports to Room 0 after countdown

### Room Progression
- [ ] Enemies spawn in Room 0
- [ ] Killing enemies fires death events
- [ ] Door 0 unlocks when Room 0 cleared
- [ ] RoomTrigger advances to Room 1
- [ ] Process repeats for all rooms

### Boss Phase
- [ ] Boss spawns in arena
- [ ] Boss health bar appears
- [ ] Boss can be damaged and killed
- [ ] PvP countdown starts after boss death

### PvP Phase
- [ ] Players can damage each other
- [ ] Death removes player from alive count
- [ ] Last player triggers Victory screen

### Victory & Reset
- [ ] Winner displayed on Victory screen
- [ ] Countdown shows return to lobby
- [ ] All players teleport to lobby
- [ ] Stats reset for next round

---

## 12. Common Issues & Troubleshooting

### "No spawn points found" / Players don't spawn

**Cause:** Missing or incorrectly tagged spawn points

**Fix:**
- Verify tags are spelled exactly: `LobbySpawn`, `Room`, `BossRoom`
- Check that tagged parts exist in Workspace (not in a disabled folder)
- For `Room` tags, verify `RoomIndex` attribute is set and is a number

### Enemies don't spawn

**Cause:** Missing EnemySpawn points or incorrect attributes

**Fix:**
- Verify `EnemySpawn` tag exists on spawn point parts
- Check `RoomId` attribute format: must be `"room_0"`, `"room_1"`, etc. (string, not number)
- Check `EnemyType` is exactly `"Goblin"`, `"Skeleton"`, or `"Ogre"` (case-sensitive)
- Verify enemy models exist in `ServerStorage/Enemies` with matching names

### Doors don't open

**Cause:** Wrong RoomIndex or enemies not dying properly

**Fix:**
- Verify Door's `RoomIndex` attribute matches the room it blocks
- Check that all enemies in the room are dying (look for death events in output)
- Ensure EnemySpawn points have correct `RoomId` matching the room

### Boss doesn't spawn

**Cause:** Missing or duplicate BossSpawn

**Fix:**
- Verify exactly ONE part has the `BossSpawn` tag
- Check output for warnings about multiple BossSpawn points
- Ensure Boss model exists in `ServerStorage/Enemies/Boss`

### Enemy models error on clone

**Cause:** Missing required children

**Fix:**
- Each enemy model must have a `Humanoid` instance
- Each enemy model must have a `HumanoidRootPart` part
- `PrimaryPart` should be set on the model (or HumanoidRootPart will be used)

### Players stuck / can't progress

**Cause:** Missing RoomTrigger or incorrect door setup

**Fix:**
- Verify RoomTrigger part exists after each door
- RoomTrigger should be `CanCollide = false` (invisible trigger)
- Door should start with `CanCollide = true`

---

## 13. Level Design Tips

### Enemy Distribution by Room

Recommended enemy composition for balanced difficulty:

| Room | Enemies | Suggested Types |
|------|---------|-----------------|
| 0 | 3 | 3x Goblin |
| 1 | 3-4 | 2x Goblin, 2x Skeleton |
| 2 | 3-4 | 2x Skeleton, 1-2x Ogre |
| 3 | 2-3 | 2-3x Ogre |

### Visual Consistency

- Use consistent floor height across all rooms
- Mark doors clearly (different color/material)
- Make spawn points invisible but easy to find in Studio (use naming convention)

### Performance Considerations

- Keep room geometry simple (avoid excessive parts)
- Use MeshParts or Unions for complex geometry
- Enemies are spawned/despawned by code - don't pre-place them

### Multiplayer Considerations

- Spread player spawns to avoid overlap (minimum 3 studs apart)
- Boss arena needs room for 6 players
- Corridors should fit multiple players side-by-side

---

## Summary

### What the Code Needs

| Location | What | Tags/Attributes |
|----------|------|-----------------|
| ServerStorage/Enemies | 4 enemy models | (none - just need Humanoid + HumanoidRootPart) |
| Workspace | Lobby spawns | Tag: `LobbySpawn` |
| Workspace | Room spawns | Tag: `Room`, Attr: `RoomIndex` |
| Workspace | Enemy spawns | Tag: `EnemySpawn`, Attr: `RoomId`, `EnemyType` |
| Workspace | Doors | Tag: `Door`, Attr: `RoomIndex` |
| Workspace | Room triggers | Tag: `RoomTrigger` |
| Workspace | Boss arena spawns | Tag: `BossRoom` |
| Workspace | Boss spawn point | Tag: `BossSpawn` |

### Minimum Viable Setup

For a working game with 3 rooms:
- 4 enemy models in ServerStorage
- 2 LobbySpawn points
- 3 rooms with Room spawns, EnemySpawns, Doors, RoomTriggers
- 1 BossSpawn + 2 BossRoom spawns

Total tagged parts: ~25-30

---

*This document was generated from the Loot Goblin TypeScript codebase. For code details, see the source files in `src/`.*
