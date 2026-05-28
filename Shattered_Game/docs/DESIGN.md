# Shattered — Game Design & Build Plan

## Vision

A dark isometric MMO where players are **adventurers, not heroes**. The world doesn't revolve around you. Other people are out there doing the same things. The satisfaction comes from your own progression, the marks you leave on the world, and the stories you stumble into — not from being chosen.

Tone: OSRS meets dark fantasy. Grounded, slightly grim, occasionally dry. No destiny. No prophecy. You're a person with a sword trying not to die.

---

## World Structure

### The Overworld
One huge seamless map (~400×400 tiles). Chunk-rendered, no loading screens. The world has distinct terrain regions that imply different dangers and cultures:

```
┌─────────────────────────────────────┐
│  NORTHERN HIGHLANDS                 │
│  (mountain clans, locked — Tier 3)  │
│                    ╔══════╗         │
│  DARK FOREST       ║RUINS ║ (inst.) │
│  (elite enemies)   ╚══════╝         │
│           ┌──────────────┐          │
│  WILDS    │  TOWN        │  COAST   │
│  (wolves, │  (safe zone) │  (ships, │
│   caves)  └──────────────┘   dock)  │
│                    ╔══════╗         │
│  SWAMP             ║DUNGEON║(inst.) │
│  (new enemy type)  ╚══════╝         │
└─────────────────────────────────────┘
```

**Instanced maps** (separate scenes, enter via transition):
- Dungeons (caves, ruins, underground passages)
- Boss lairs
- Locked faction regions (unlocked via Tier 3 quests)

**Safe zones**: Town and adjacent area. No hostile spawns. NPCs live here.

**Progression gating**: Not invisible walls — environmental. The dark forest has enemies 3× stronger. You'll know when you're not ready.

---

## Quest System — Three Tiers

### Tier 1 — Rites of Passage
**What they are**: Milestone quests everyone does. Fixed, authored, mechanics-heavy. The achievement is personal — the world doesn't change, *you* do.

**Philosophy**: The dragon doesn't stay dead. You slew *a* dragon. Your cape proves it. Ten thousand other adventurers also have that cape and it doesn't make yours mean less.

**Examples**:

---

*The Oath*
A weathered gatekeeper outside the Adventurers' Guild turns you away — they don't take just anyone. He tells you three veterans in town can vouch for newcomers, if you impress them. Each veteran has a different standard: one wants to see you fight, one wants to know you can navigate the wilds alone at night, one wants proof you've survived something real. You track them down across the town and surrounding area, earn each signature, return to the gate. The guildmaster looks you over, asks one question, hands you a pin. You're in. The guild unlocks new NPC dialogue, a job board, and marks you as a ranked adventurer to the rest of the world.
*The achievement: recognised rank. The quest: learning what this world considers worthy.*

---

*The Bounty*
A hunter posts a notice — something killed her partner three days ago in the eastern wilds. She can't go back out there alone. You investigate the attack site: scattered gear, deep claw marks on a tree, tracks that lead north. You follow them. Talk to a trapper who's seen the creature before and barely escaped. He tells you what it is, how it hunts, what it fears. You prepare accordingly, go back, find it, kill it. Return to the hunter. She buries her partner's knife. Gives you his pack — he'd have wanted someone good to have it.
*The achievement: first elite enemy killed. The quest: doing right by a stranger's grief.*

---

*Into the Dark*
A miner's family hasn't heard from him in two weeks. The foreman says he went into a deep shaft that the company had marked off-limits — something had been making sounds down there. You descend. Find his camp, still set up. His notes describe going further than anyone else had. The shaft opens into something much older than the mine. You follow his path, find what he found, and make it back out. Whether he did is part of what the quest answers.
*The achievement: first dungeon cleared. The quest: what's actually underneath the world.*

---

*Dragonslayer*
Ships have gone missing on the northern route. A retired admiral is convinced it's the sea dragon — an old story, dismissed as sailor myth. Nobody listens to him. You look into the missing ships anyway: talk to dock workers, find a survivor being treated for burns, track down a fragment of a ship's log that describes something vast and fast beneath the surface. The admiral was right. Now you need to get out there — but no captain will take the route. One will, for the right price, if you can also find the old island chart the admiral swears exists. You sail. You fight. You bring back a scale the size of a door. The admiral laughs for the first time in years.
*The achievement: dragon killed. The quest: proving an old man wasn't lying.*

---

**Rewards**: Large XP dumps, cosmetic proof (capes, titles, visual unlocks), content gates (you can't access tier 2 content without specific Rites completed).

**Architecture**:
```
QuestDefinition {
  id, stages[], completionFlag, rewards
}
PlayerQuestState {
  [questId]: 'not_started' | 'stage_N' | 'complete'
}
```

---

### Tier 2 — Living World Quests
**What they are**: Structured investigation quests with randomised details. The *type* of quest is the same for every player. The specifics differ. The outcome adds something permanent to the shared world.

**Philosophy**: You investigated footprints, tracked an ogre to a cave, killed it, freed whoever was inside. Someone else did the same thing in a different cave, freed a different person. Both of you changed the world. Neither of you saved *the* person.

**The core loop**:
1. Environmental hook — a notice board, a worried NPC, a blood trail
2. Investigation — follow clues across the overworld
3. Confrontation — kill/sneak/negotiate depending on quest type
4. Resolution — the outcome is permanent, and others see it

**Example — The Ogre Plague**:
- Cave location drawn from a pool (north forest cave / eastern cliffs hollow / swamp den...)
- Captive NPC drawn from a pool (wandering cook / disgraced soldier / travelling merchant / herbalist...)
- On completion, that NPC **appears in the world for all players permanently** — wandering town, working a stall, sitting by the docks
- Their dialogue reflects their experience but doesn't name the rescuer. *"I owe my life to a stranger. Didn't catch their name."*
- Over time, the town fills with survivors. The world is visibly built by player action.

**Other Tier 2 templates**:
- *The Missing Shipment* — cargo raided, investigate, find culprit, choose outcome (report/keep/confront)
- *The Old Wound* — encounter a wounded creature or person, track back to what caused it
- *Strange Lights* — weird phenomenon, investigate source, it leads somewhere nobody expected

**Rewards**: XP (combat + relevant skill), coins, occasionally a unique item tied to that NPC type. The permanence of the NPC in the world is itself a reward.

**Architecture**:
```
QuestTemplate {
  id, structure, locationPool[], npcPool[], rewardPool[]
}
WorldNpcRegistry (shared, persisted server-side) {
  entries: [{ npcId, spawnTile, rescuedBy?: playerId, dialogueVariant }]
}
PlayerQuestState {
  [templateId]: { complete: bool, npcId: string, locationId: string }
}
```

---

### Tier 3 — Diplomatic / World-Unlock Quests
**What they are**: Authored, story-driven, one per major world region. You do a job for a faction — not save them, do *work* for them. Negotiate. Prove yourself in their terms. The reward is access.

**Philosophy**: Song of the Elves. You spent 200 hours earning the right to walk into Prifddinas. The locked gate you couldn't pass for 50 hours finally opens. Nothing hits harder than that.

**Example — The Mountain Accord**:
- The Northern Highlands are locked. Mountain clan sentries turn you away.
- Requires: Dragonslayer complete + reputation threshold with the coastal town faction
- Quest: government official asks you to broker a trade deal. You travel to the clan border, navigate their customs, pass their trial (combat/dialogue/puzzle), return with a signed accord.
- Reward: the northern passes open. New terrain, new enemies, new crafting materials, new NPC types. Clan members in town are now friendly.

**Other Tier 3 examples**:
- *Into the Swamp* — negotiate passage rights with a creature faction (non-human)
- *The Buried City* — unlock a ruined underground city after completing prerequisite quests and a survey mission

**Rewards**: World access (new map regions, new dungeon entrances), faction reputation, unique crafting unlocks, new NPC dialogue everywhere that reflects the changed political reality.

**Architecture**:
```
FactionQuestDefinition {
  id, factionId, stages[], prerequisites[], worldUnlockId, rewards
}
PlayerWorldUnlocks {
  [regionId]: bool
}
```

---

## Repeatable Content — The Slayer Skill

Entirely separate from the quest system. A skill, not a story.

A Slayer master NPC assigns you a task: *kill 40 cave spiders* or *collect 20 wolf pelts for the tanner*. Scales with your Slayer level. Gives Slayer XP + bonus combat XP on completion.

Nobody cares that someone else has the same assignment — it's a grind skill. The engagement is efficiency and the unlock of new task types at higher levels.

**Why this matters**: It gives players something to do between quests without burning quest content. It also provides a natural reason to go to every corner of the world (Slayer sends you everywhere).

---

## NPC System

NPCs have **conditional dialogue** driven by the player's personal quest flags and world state.

```
NpcDialogue {
  conditions: { questFlag?, worldUnlock?, reputationMin? }
  lines: string[]
}
```

The widow is worried if you haven't done her quest. She's relieved if you have. Another player sees her worried — that's their quest to do. Same NPC, same world position, different relationship.

World NPCs (rescued via Tier 2) have a base dialogue set reflecting their history, plus one unique line acknowledging the rescue without naming names.

---

## Build Plan — Phases

### Phase 0 — Editor as a Real Dev Tool
*Goal: Everything in Phase 1 and beyond can be built entirely inside the editor — no hand-editing TypeScript map files to place an NPC or define a zone.*

The editor already handles terrain painting, object placement, and enemy spawns. It needs four more capabilities:

**0a — Map resize UI**
- [ ] Expose `resizeEditorMap` in the editor HUD (width × height input + confirm)
- [ ] Warn if resize would crop existing content
- [ ] Default fill terrain selectable on resize

**0b — Zone painter**
- [ ] New editor tool: Zone Paint (alongside terrain/object tools)
- [ ] Paint rectangular or freehand zone regions onto the map
- [ ] Zone types: `town` (no aggressive spawns — players can still fight), `wilds` (normal hostile spawns), `elite` (stronger enemy spawns), `dungeon` (underground, own spawn table), `locked` (requires world unlock flag to enter)
- [ ] Colour-coded overlay in the editor (semi-transparent, toggleable)
- [ ] Zones exported as part of the published map definition
- [ ] Game engine reads zone tags to govern enemy spawns + minimap colour

**0c — Transition tool**
- [ ] New editor tool: Transition Placer
- [ ] Click a tile to place a transition marker (entry point)
- [ ] Set target map ID + target tile coordinates in a side panel
- [ ] Set transition type: `cave`, `door`, `portal`, `ferry`, `debug`
- [ ] Visual marker on the map (directional arrow or icon)
- [ ] Transitions exported as part of the published map definition
- [ ] Game engine already reads transitions — just needs them authored in the editor

**0d — NPC placer**
- [ ] New editor tool: NPC Placer
- [ ] Click a tile to place an NPC anchor
- [ ] Set NPC ID, display name, facing direction in a side panel
- [ ] Visual sprite placeholder in the editor (generic NPC silhouette)
- [ ] NPC anchors exported as part of the published map definition
- [ ] Game engine reads NPC anchors to spawn NPC entities on map load

**0e — Spawn point editor**
- [ ] Player spawn point visible and draggable in the editor
- [ ] Multiple named spawn points (e.g. `default`, `from_dungeon`, `from_north`)
- [ ] Spawn point exported as part of the published map definition

**End state**: designer opens editor, paints terrain, drops zones, places a cave transition, drops an NPC — hits publish — it all works in the game. No TypeScript editing required for world content.

---

### Phase 1 — World Foundation
*Goal: A real open world with distinct zones and one dungeon — built entirely in the editor.*

- [ ] Expand overworld map to ~400×400 tiles (via Phase 0 resize tool)
- [ ] Paint terrain zones (town area, wilds, forest edge, coastal strip)
- [ ] Design town layout (flat stone terrain, building objects)
- [ ] Place cave entrance transition → instanced dungeon map
- [ ] Paint zone tags (safe zone for town, combat zones for wilds)
- [ ] Minimap reflects zone colours (driven by zone tags)

### Phase 2 — NPC Foundation
*Goal: One NPC you can talk to who remembers your quest state.*

- [ ] NPC entity system (placed via MapNpcAnchor, has sprite, has dialogue)
- [ ] Right-click → interact → ChoiceMenu dialogue flow
- [ ] Conditional dialogue driven by PlayerQuestState flags
- [ ] One NPC in town with 2 dialogue stages (before/after a flag is set)
- [ ] Save/load PlayerQuestState with existing save system

### Phase 3 — First Tier 1 Quest
*Goal: One complete Rite of Passage quest, start to finish.*

- [ ] QuestDefinition + stage system
- [ ] Quest journal displays active quest + current stage
- [ ] Quest: *The Oath* — find a combat master in town, complete their trial (survive X waves in a designated tile area), receive the Oath title
- [ ] On completion: NPC dialogue changes, title appears next to player name, new content gate unlocks

### Phase 4 — First Tier 2 Quest
*Goal: One Living World template with two pool entries each.*

- [ ] QuestTemplate engine with locationPool + npcPool
- [ ] WorldNpcRegistry (persisted in save, visible to all clients)
- [ ] Quest: *The Ogre Plague* — notice board in town, 2 possible cave locations, 2 possible captive NPCs
- [ ] On completion: rescued NPC spawns in town permanently, has dialogue
- [ ] Town visibly populates as more players complete the quest

### Phase 5 — Slayer Skill
*Goal: A Slayer master that gives tasks and tracks progress.*

- [ ] Slayer skill + XP track
- [ ] SlayerMaster NPC in town with task assignment dialogue
- [ ] Task pool: wolf (existing), cave spider (new enemy), swamp crawler (new enemy)
- [ ] Kill counter displayed in UI during active task
- [ ] Completion reward: Slayer XP + bonus combat XP + coins

### Phase 6 — First Tier 3 Quest + World Unlock
*Goal: One world region locked behind a Tier 3 quest.*

- [ ] PlayerWorldUnlocks flag system
- [ ] Lock northern highlands (sentry NPCs block passage, different terrain colour on minimap)
- [ ] Prerequisite check: Dragonslayer complete + reputation threshold
- [ ] Quest: negotiate the highland accord through staged dialogue + a combat trial
- [ ] On completion: sentries become friendly, northern map area becomes traversable, new resources available

---

## Content Locked Behind Progression

| Gate | Requirement |
|------|-------------|
| Dungeon access | Tier 1: *Into the Deep* complete |
| Slayer tasks (advanced) | Slayer level threshold |
| Northern Highlands | Tier 3: *The Mountain Accord* |
| Deep dungeon floor | Tier 1: *Dragonslayer* + specific Slayer level |
| Faction shop inventory | Reputation rank with that faction |
| Crafting recipes (advanced) | Quest completion unlock, not level-gated |

---

## What This Is Not

- Not a game where you save the world
- Not a game where one player's story blocks another's
- Not a game where quests are task lists with objectives
- Not a game where the endgame is a gear treadmill with no story

Players who rush to max combat level miss most of the world. Players who explore find things the combat grinders never see. Both playstyles are valid. Neither is the "right" way to play.
