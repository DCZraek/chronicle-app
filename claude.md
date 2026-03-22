# CLAUDE.md — The Chronicle Project Context
# This file is the single source of truth for Claude Code.
# Read it fully before making any changes to this project.

---

## What This Project Is

The Chronicle is a local AI-powered tabletop RPG narrator. The player types or 
speaks actions. An AI game master narrates the world's response. A text-to-speech 
system reads the response aloud. A network of AI agents maintains the game world 
state in a SQLite database between exchanges.

This is a personal project running entirely on a home PC. It is not a SaaS 
product. There is no multi-user requirement. Performance optimization is for 
cost and responsiveness, not scale.

---

## Current Build Status

### Complete and working:
- `storage.js` — SQLite database layer, 29 tables, full CRUD
- `chronicle-server.js` — Express web server, REST API, token auth
- `public/index.html` — Desktop UI, fully migrated from Electron
- `tray.js` — System tray icon, starts/stops servers
- `start.bat` — Manual launch script
- `start-silent.vbs` — Silent auto-start on Windows boot
- `package.json` — Clean, no Electron dependencies
- Kokoro TTS — working through Express proxy at /api/tts
- Token authentication — working, token stored in .env
- All prompts written and saved in prompts/ folder including
  sync_prompt.txt

### Not yet built:
- Agent architecture (agents.js) — Phase 3
- Heuristics engine (heuristics.js) — Phase 2
- Tag system (new database tables) — Phase 1
- Mechanics tables (new database tables) — Phase 1
- Sync pass prompt (prompts/sync_prompt.txt) — complete
- Interview prompt update (seeds tag and mechanics system) — Phase 4
- Narrative call (replacement for current sendMessage) — Phase 4
- Import pipeline — Phase 5
- Mobile UI (public/mobile.html) — future
- Cloudflare tunnel setup — future

### Known technical debt:
- INTERVIEW_SYSTEM in index.html needs updating in Phase 4
  to seed the tag system and mechanics tables from interview data
- GM_SYSTEM_PROMPT in index.html is the old prompt — replaced
  by prompts/narrator_prompt.txt in Phase 4

---

## Architecture Overview

```
Player input arrives
        ↓
Claude receives: player input + ambient index + 
                 mechanics state + recent history
        ↓
Claude decides: DIRECT or NEEDS_AGENTS

DIRECT PATH (simple continuation):
        ↓
Claude writes prose + SCENE_TAGS → shown to player
Kokoro reads response aloud
Sync pass runs in background during audio

NEEDS_AGENTS PATH (significant scene):
        ↓
Claude declares intent (scene_type, active_tags, 
narrative_direction)
        ↓
Agent calls (Ollama llama3.1:8b, parallel, free)
Each agent reads intent + their full domain records
Each agent returns curated brief
        ↓
Brief assembled
        ↓
Claude receives brief + history → writes prose + SCENE_TAGS
Kokoro reads response aloud
Sync pass runs in background during audio
```

Every exchange goes through the same entry point. Claude decides 
whether agents are needed. No routing logic in the server beyond 
parsing Claude's response prefix ([DIRECT] or [NEEDS_AGENTS]).

---

## Tech Stack

- **Node.js v20** — server runtime
- **Express 5** — web server
- **better-sqlite3** — SQLite database layer
- **dotenv** — environment variables
- **systray2** — system tray icon
- **Ollama (local)** — llama3.1:8b for agents
- **Anthropic API** — Claude Opus 4.6 for narrative calls
- **Kokoro TTS** — local text-to-speech on port 5050
- **Python (py)** — runs kokoro_server.py

---

## File Structure

```
chronicle-app/
├── public/
│   └── index.html              Desktop UI
├── prompts/
│   ├── narrator_prompt.txt     Full narrator system prompt
│   ├── agent_character.txt     Character agent prompt
│   ├── agent_npc.txt           NPC agent prompt
│   ├── agent_plot.txt          Plot agent prompt
│   ├── agent_world.txt         World agent prompt
│   ├── agent_mechanics.txt     Mechanics agent prompt
│   └── sync_prompt.txt         Sync pass prompt (NOT BUILT YET)
├── chronicle-server.js         Express server + REST API
├── storage.js                  SQLite database layer
├── tray.js                     System tray icon
├── agents.js                   Agent architecture (NOT BUILT YET)
├── heuristics.js               Mechanics engine (NOT BUILT YET)
├── start.bat                   Manual launch
├── start-silent.vbs            Silent auto-start
├── package.json
├── .env                        CHRONICLE_TOKEN (never commit)
└── CLAUDE.md                   This file
```

Database lives at: `C:\Users\dzrik\Chronicle\chronicle.db`
Kokoro lives at: `C:\Users\dzrik\kokoro_server.py`

---

## Environment

- **OS:** Windows 11
- **Python launcher:** `py` (not `python`)
- **Project path:** `C:\Users\dzrik\chronicle-app`
- **Database path:** `C:\Users\dzrik\Chronicle\chronicle.db`
- **Token:** stored in `.env` as `CHRONICLE_TOKEN`

---

## Critical Constraints

### Never do these:
- Modify storage.js schema without updating all dependent functions
- Change API endpoint paths without updating the bridge in index.html
- Add new npm packages without checking they work on Windows
- Use `python` to launch anything — always use `py`
- Commit .env to git
- Break the existing working game loop while building new features
- Touch GM_SYSTEM_PROMPT in index.html — it stays until Phase 4

### Always do these:
- Add new database tables in storage.js alongside existing ones
- Export every new storage function at the bottom of storage.js
- Add corresponding API endpoints in chronicle-server.js for every 
  new storage function
- Keep the window.chronicle bridge in index.html in sync with new endpoints
- Test that the server starts cleanly after any changes
- Follow the existing upsert pattern in storage.js for new tables

---

## Prompts

All prompts are saved in the prompts/ folder.

### narrator_prompt.txt
The full narrator system prompt. Loaded and sent with every narrative
call with 1-hour cache TTL:
```javascript
cache_control: { type: "ephemeral", ttl: "1h" }
```
Contains these sections in order:
- <role> — prose style, player character rules
- <pacing> — response length calibration
- <world_philosophy> — world rules, danger telegraphing
- <player_agency> — freedom of action, world resistance
- <mechanics_compliance> — rank system, wounds, directives, NPC knowledge
- <growth_rules> — rank increases, skills, companion growth
- <tag_responsibilities> — narrator as author, agents as librarians
- <scene_tags_format> — full SCENE_TAGS specification with examples
- <exchange_routing> — DIRECT vs NEEDS_AGENTS decision
      (subsection of output_rules)
- <speech_tagging> — Kokoro voice tagging format
- <output_rules> — absolute never/always list

### agent_character.txt
Character Agent — owns game_mechanics, skill_ranks, character table.
Returns player state and capability as narrator-ready context.
Runs on Ollama llama3.1:8b.

### agent_npc.txt
NPC Agent — owns npcs, knowledge_scope tables.
Returns NPC records with structural knowledge limits applied.
Runs on Ollama llama3.1:8b.

### agent_plot.txt
Plot Agent — owns threads table.
Returns thread implications and dormant connections.
Runs on Ollama llama3.1:8b.

### agent_world.txt
World Agent — owns world_overview, locations, factions,
environmental_state, faction_heat tables.
Returns location context, faction heat, environmental state.
Runs on Ollama llama3.1:8b.

### agent_mechanics.txt
Mechanics Agent — owns difficulty_tracker, consequence_ledger,
game_mechanics, milestone_log, pending_flags, companion_state,
skill_ranks tables.
Returns rank assessments, directives, consequences, growth validations.
Runs on Ollama llama3.1:8b.

### sync_prompt.txt
Sync pass prompt — used after narrative call to extract changes
from the SCENE_TAGS block and update all database records.

---

## Database — Existing Tables (storage.js)

These tables exist and work. Do not modify their schema.

```
games                 — game records
game_files            — per-game file storage
compression_log       — mechanical session summaries
chronicle_log         — literary session summaries
character             — player character record
npcs                  — NPC records
threads               — plot thread records
world_overview        — world state record
locations             — location records
factions              — faction records
mechanics             — game mechanic records
power_authority       — power subgame
power_units           — military units
power_relationships   — political relationships
power_obligations     — contracts and obligations
power_holdings        — territory and holdings
power_resources       — resource tracking
power_intelligence    — gathered intelligence
enterprise            — enterprise subgame
enterprise_inventory  — trade goods
enterprise_routes     — trade routes
enterprise_markets    — market data
enterprise_contracts  — trade contracts
enterprise_employees  — staff
enterprise_ledger     — financial records
subgame_events        — event queue
game_clock            — in-world time
agent_settings        — agent configuration
sync_log              — sync pass history
```

---

## Database — New Tables (TO BE BUILT — Phase 1)

These tables do not exist yet. They need to be added to storage.js
following the existing patterns exactly.

### tags
```sql
CREATE TABLE IF NOT EXISTS tags (
  id              TEXT NOT NULL,
  game_id         TEXT NOT NULL,
  tag_type        TEXT NOT NULL,
  canonical_name  TEXT NOT NULL,
  status          TEXT DEFAULT 'active',
  confirmed       INTEGER DEFAULT 1,
  relevance_score INTEGER DEFAULT 50,
  entity_tier     TEXT DEFAULT 'human',
  combat_rank     INTEGER DEFAULT 0,
  social_rank     INTEGER DEFAULT 0,
  magic_rank      INTEGER DEFAULT 0,
  description     TEXT DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (id, game_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### tag_aliases
```sql
CREATE TABLE IF NOT EXISTS tag_aliases (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id   TEXT NOT NULL,
  game_id  TEXT NOT NULL,
  alias    TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### tag_relationships
```sql
CREATE TABLE IF NOT EXISTS tag_relationships (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id          TEXT NOT NULL,
  tag_id_a         TEXT NOT NULL,
  tag_id_b         TEXT NOT NULL,
  relationship     TEXT NOT NULL,
  context_note     TEXT DEFAULT '',
  strength         TEXT DEFAULT 'strong',
  confirmed        INTEGER DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### pending_tags
```sql
CREATE TABLE IF NOT EXISTS pending_tags (
  id              TEXT NOT NULL,
  game_id         TEXT NOT NULL,
  tag_type        TEXT NOT NULL,
  canonical_name  TEXT NOT NULL,
  description     TEXT DEFAULT '',
  proposed_by     TEXT DEFAULT 'narrator',
  created_at      TEXT NOT NULL,
  PRIMARY KEY (id, game_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### pending_relationships
```sql
CREATE TABLE IF NOT EXISTS pending_relationships (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id      TEXT NOT NULL,
  tag_id_a     TEXT NOT NULL,
  tag_id_b     TEXT NOT NULL,
  relationship TEXT NOT NULL,
  context_note TEXT DEFAULT '',
  proposed_by  TEXT DEFAULT 'narrator',
  created_at   TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### game_mechanics
```sql
CREATE TABLE IF NOT EXISTS game_mechanics (
  game_id                    TEXT PRIMARY KEY,
  player_combat_rank         INTEGER DEFAULT 10,
  player_social_rank         INTEGER DEFAULT 10,
  player_magic_rank          INTEGER DEFAULT 0,
  player_effective_combat    INTEGER DEFAULT 10,
  player_effective_social    INTEGER DEFAULT 10,
  player_effective_magic     INTEGER DEFAULT 0,
  wound_slot_1               TEXT DEFAULT 'empty',
  wound_slot_2               TEXT DEFAULT 'empty',
  wound_slot_3               TEXT DEFAULT 'empty',
  wound_penalty              INTEGER DEFAULT 0,
  exhaustion                 TEXT DEFAULT 'none',
  hunger                     TEXT DEFAULT 'none',
  essence_current            INTEGER DEFAULT 0,
  essence_max                INTEGER DEFAULT 0,
  coin                       INTEGER DEFAULT 0,
  rations                    INTEGER DEFAULT 0,
  ammunition                 INTEGER DEFAULT 0,
  global_notoriety           INTEGER DEFAULT 0,
  updated_at                 TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### skill_ranks
```sql
CREATE TABLE IF NOT EXISTS skill_ranks (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id        TEXT NOT NULL,
  skill_name     TEXT NOT NULL,
  rank           INTEGER DEFAULT 0,
  ceiling        INTEGER DEFAULT 40,
  activity_count INTEGER DEFAULT 0,
  updated_at     TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### difficulty_tracker
```sql
CREATE TABLE IF NOT EXISTS difficulty_tracker (
  game_id                        TEXT PRIMARY KEY,
  combat_since_wound             INTEGER DEFAULT 0,
  social_since_setback           INTEGER DEFAULT 0,
  exchanges_since_major_threat   INTEGER DEFAULT 0,
  consecutive_successes          INTEGER DEFAULT 0,
  exchanges_since_challenge      INTEGER DEFAULT 0,
  magic_since_cost               INTEGER DEFAULT 0,
  required_encounter_rank        INTEGER DEFAULT 0,
  wound_threshold                INTEGER DEFAULT 3,
  setback_threshold              INTEGER DEFAULT 3,
  threat_threshold               INTEGER DEFAULT 6,
  success_threshold              INTEGER DEFAULT 4,
  challenge_threshold            INTEGER DEFAULT 6,
  magic_cost_threshold           INTEGER DEFAULT 3,
  escalation_rate                INTEGER DEFAULT 3,
  active_directives              TEXT DEFAULT '[]',
  updated_at                     TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### environmental_state
```sql
CREATE TABLE IF NOT EXISTS environmental_state (
  game_id        TEXT PRIMARY KEY,
  current_day    INTEGER DEFAULT 1,
  season         TEXT DEFAULT 'spring',
  time_of_day    TEXT DEFAULT 'morning',
  weather        TEXT DEFAULT 'clear',
  temperature    TEXT DEFAULT 'mild',
  visibility     TEXT DEFAULT 'full',
  updated_at     TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### milestone_log
```sql
CREATE TABLE IF NOT EXISTS milestone_log (
  id                           INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id                      TEXT NOT NULL,
  milestone_type               TEXT NOT NULL,
  rank_type                    TEXT NOT NULL,
  description                  TEXT NOT NULL,
  validated                    INTEGER DEFAULT 1,
  exchange_number              INTEGER DEFAULT 0,
  exchanges_since_last_combat  INTEGER DEFAULT 0,
  exchanges_since_last_social  INTEGER DEFAULT 0,
  exchanges_since_last_magic   INTEGER DEFAULT 0,
  created_at                   TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### companion_state
```sql
CREATE TABLE IF NOT EXISTS companion_state (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id               TEXT NOT NULL,
  tag_id                TEXT NOT NULL,
  combat_rank           INTEGER DEFAULT 0,
  social_rank           INTEGER DEFAULT 0,
  loyalty               INTEGER DEFAULT 50,
  condition             TEXT DEFAULT 'healthy',
  morale                TEXT DEFAULT 'normal',
  exchanges_in_combat   INTEGER DEFAULT 0,
  exchanges_at_base     INTEGER DEFAULT 0,
  exchanges_traveling   INTEGER DEFAULT 0,
  last_rank_exchange    INTEGER DEFAULT 0,
  updated_at            TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### consequence_ledger
```sql
CREATE TABLE IF NOT EXISTS consequence_ledger (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id          TEXT NOT NULL,
  consequence_type TEXT NOT NULL,
  description      TEXT NOT NULL,
  severity         TEXT DEFAULT 'medium',
  status           TEXT DEFAULT 'open',
  surfaced_at      TEXT DEFAULT NULL,
  created_at       TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### pending_flags
```sql
CREATE TABLE IF NOT EXISTS pending_flags (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id          TEXT NOT NULL,
  source_agent     TEXT NOT NULL,
  flag_content     TEXT NOT NULL,
  exchanges_held   INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'pending',
  dismissed_reason TEXT DEFAULT NULL,
  created_at       TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### faction_heat
```sql
CREATE TABLE IF NOT EXISTS faction_heat (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    TEXT NOT NULL,
  tag_id     TEXT NOT NULL,
  heat       INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

### knowledge_scope
```sql
CREATE TABLE IF NOT EXISTS knowledge_scope (
  id                           INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id                      TEXT NOT NULL,
  tag_id                       TEXT NOT NULL,
  knows_own_role               INTEGER DEFAULT 1,
  knows_immediate_superior     TEXT DEFAULT '',
  knows_organization_structure TEXT DEFAULT 'none',
  knows_other_cells            TEXT DEFAULT 'none',
  knows_finances               TEXT DEFAULT 'own_pay',
  knows_plans                  TEXT DEFAULT 'immediate',
  knows_location_of            TEXT DEFAULT '[]',
  has_met                      TEXT DEFAULT '[]',
  has_heard_of                 TEXT DEFAULT '[]',
  updated_at                   TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

---

## Storage Functions to Build (Phase 1)

For each new table, add CRUD functions following the existing patterns
in storage.js. Every function must be exported at the bottom.

### Tags
- `getTags(gameId)` — all confirmed tags for a game
- `getTag(gameId, tagId)` — single tag by id
- `upsertTag(gameId, fields)` — create or update
- `deleteTag(gameId, tagId)` — delete tag
- `getTagByAlias(gameId, alias)` — find tag by alias string
- `getAmbientIndex(gameId)` — all active tags formatted as 
  one-line index entries for the narrator brief

### Tag Aliases
- `getAliases(gameId, tagId)` — all aliases for a tag
- `addAlias(gameId, tagId, alias)` — add single alias
- `deleteAlias(gameId, aliasId)` — remove alias
- `findTagByAlias(gameId, alias)` — reverse lookup

### Tag Relationships
- `getRelationships(gameId, tagId)` — all relationships for a tag
- `getAllRelationships(gameId)` — full relationship graph
- `upsertRelationship(gameId, fields)` — create or update
- `deleteRelationship(gameId, id)` — remove relationship
- `getTagMap(gameId, tagIds)` — filtered map for given tag ids

### Pending Tags
- `getPendingTags(gameId)` — all pending tags
- `addPendingTag(gameId, fields)` — propose new tag
- `confirmPendingTag(gameId, id)` — promote to confirmed tag
- `dismissPendingTag(gameId, id)` — reject and remove

### Pending Relationships
- `getPendingRelationships(gameId)` — all pending relationships
- `addPendingRelationship(gameId, fields)` — propose relationship
- `confirmPendingRelationship(gameId, id)` — promote to confirmed
- `dismissPendingRelationship(gameId, id)` — reject and remove

### Game Mechanics
- `getGameMechanics(gameId)` — full mechanics record
- `upsertGameMechanics(gameId, fields)` — create or update
- `getEffectiveRanks(gameId)` — calculated effective ranks
  accounting for wound penalty and exhaustion

### Skill Ranks
- `getSkillRanks(gameId)` — all skills for a game
- `getSkillRank(gameId, skillName)` — single skill
- `upsertSkillRank(gameId, fields)` — create or update
- `incrementSkillActivity(gameId, skillName)` — increment counter

### Difficulty Tracker
- `getDifficultyTracker(gameId)` — full tracker record
- `upsertDifficultyTracker(gameId, fields)` — create or update
- `getActiveDirectives(gameId)` — parsed active_directives JSON
- `addDirective(gameId, directive)` — add to active_directives
- `removeDirective(gameId, directiveType)` — mark fulfilled

### Environmental State
- `getEnvironmentalState(gameId)` — current environment
- `upsertEnvironmentalState(gameId, fields)` — create or update

### Milestone Log
- `getMilestones(gameId)` — all milestones
- `addMilestone(gameId, fields)` — record new milestone
- `getExchangesSinceLastMilestone(gameId, rankType)` — cooldown check

### Companion State
- `getCompanionStates(gameId)` — all companions
- `getCompanionState(gameId, tagId)` — single companion
- `upsertCompanionState(gameId, fields)` — create or update
- `incrementCompanionActivity(gameId, tagId, activityType)` — 
  increment exchanges_in_combat | exchanges_at_base | exchanges_traveling

### Consequence Ledger
- `getOpenConsequences(gameId)` — all open consequences
- `addConsequence(gameId, fields)` — add new consequence
- `surfaceConsequence(gameId, id)` — mark as surfaced
- `dismissConsequence(gameId, id)` — close without surfacing

### Pending Flags
- `getPendingFlags(gameId)` — all pending flags
- `addPendingFlag(gameId, fields)` — add flag from agent
- `incrementFlagAge(gameId)` — increment exchanges_held for all pending
- `dismissFlag(gameId, id, reason)` — dismiss flag

### Faction Heat
- `getFactionHeat(gameId)` — all faction heat records
- `getFactionHeatByTag(gameId, tagId)` — single faction heat
- `upsertFactionHeat(gameId, tagId, heat)` — set heat level
- `getHighHeatFactions(gameId, threshold)` — factions above threshold

### Knowledge Scope
- `getKnowledgeScope(gameId, tagId)` — scope for one NPC
- `upsertKnowledgeScope(gameId, fields)` — create or update

---

## API Endpoints to Build (Phase 1)

Add to chronicle-server.js following the existing patterns.
All routes go under the `api` router and require auth.

```
GET    /games/:id/tags                    — getTags
GET    /games/:id/tags/:tagId             — getTag
POST   /games/:id/tags                    — upsertTag
DELETE /games/:id/tags/:tagId             — deleteTag
GET    /games/:id/tags/alias/:alias       — getTagByAlias
GET    /games/:id/ambient-index           — getAmbientIndex

GET    /games/:id/tags/:tagId/aliases     — getAliases
POST   /games/:id/tags/:tagId/aliases     — addAlias
DELETE /games/:id/aliases/:aliasId        — deleteAlias

GET    /games/:id/relationships           — getAllRelationships
GET    /games/:id/tags/:tagId/relationships — getRelationships
POST   /games/:id/relationships           — upsertRelationship
DELETE /games/:id/relationships/:id       — deleteRelationship
POST   /games/:id/tag-map                 — getTagMap (body: tagIds[])

GET    /games/:id/pending-tags            — getPendingTags
POST   /games/:id/pending-tags            — addPendingTag
POST   /games/:id/pending-tags/:id/confirm — confirmPendingTag
DELETE /games/:id/pending-tags/:id        — dismissPendingTag

GET    /games/:id/pending-relationships         — getPendingRelationships
POST   /games/:id/pending-relationships         — addPendingRelationship
POST   /games/:id/pending-relationships/:id/confirm — confirmPendingRelationship
DELETE /games/:id/pending-relationships/:id     — dismissPendingRelationship

GET    /games/:id/game-state              — getGameMechanics
PATCH  /games/:id/game-state              — upsertGameMechanics

GET    /games/:id/skills                  — getSkillRanks
GET    /games/:id/skills/:name            — getSkillRank
POST   /games/:id/skills                  — upsertSkillRank

GET    /games/:id/difficulty              — getDifficultyTracker
PATCH  /games/:id/difficulty              — upsertDifficultyTracker

GET    /games/:id/environment             — getEnvironmentalState
PATCH  /games/:id/environment             — upsertEnvironmentalState

GET    /games/:id/milestones              — getMilestones
POST   /games/:id/milestones              — addMilestone

GET    /games/:id/companions              — getCompanionStates
GET    /games/:id/companions/:tagId       — getCompanionState
POST   /games/:id/companions              — upsertCompanionState

GET    /games/:id/consequences            — getOpenConsequences
POST   /games/:id/consequences            — addConsequence
PATCH  /games/:id/consequences/:id/surface — surfaceConsequence
DELETE /games/:id/consequences/:id        — dismissConsequence

GET    /games/:id/flags                   — getPendingFlags
POST   /games/:id/flags                   — addPendingFlag
DELETE /games/:id/flags/:id               — dismissFlag

GET    /games/:id/faction-heat            — getFactionHeat
POST   /games/:id/faction-heat            — upsertFactionHeat

GET    /games/:id/knowledge-scope/:tagId  — getKnowledgeScope
POST   /games/:id/knowledge-scope         — upsertKnowledgeScope
```

---

## initializeGameRows() Updates (Phase 1)

The existing `initializeGameRows(gameId)` function in storage.js
seeds default rows for single-row-per-game tables when a game is 
created. Add these new tables to it:

```javascript
db.prepare('INSERT OR IGNORE INTO game_mechanics (game_id, updated_at) VALUES (?, ?)').run(gameId, ts)
db.prepare('INSERT OR IGNORE INTO difficulty_tracker (game_id, updated_at) VALUES (?, ?)').run(gameId, ts)
db.prepare('INSERT OR IGNORE INTO environmental_state (game_id, updated_at) VALUES (?, ?)').run(gameId, ts)
```

---

## Agent Architecture (NOT BUILT YET — Phase 3)

### Five Passive Agents
All run on Ollama llama3.1:8b locally. Free, no API tokens.

- **Character Agent** — prompt: prompts/agent_character.txt
  Owns: game_mechanics, skill_ranks, character table
  
- **NPC Agent** — prompt: prompts/agent_npc.txt
  Owns: npcs, knowledge_scope tables
  
- **Plot Agent** — prompt: prompts/agent_plot.txt
  Owns: threads table
  
- **World Agent** — prompt: prompts/agent_world.txt
  Owns: world_overview, locations, factions, 
        environmental_state, faction_heat tables
  
- **Mechanics Agent** — prompt: prompts/agent_mechanics.txt
  Owns: difficulty_tracker, consequence_ledger, game_mechanics,
        milestone_log, pending_flags, companion_state, skill_ranks

### Exchange Flow
1. Player input arrives
2. Claude receives: player input + ambient index + mechanics state 
   + recent history
3. Claude returns [DIRECT] or [NEEDS_AGENTS]
4. If NEEDS_AGENTS: agents run in parallel, brief assembled
5. Claude writes prose + SCENE_TAGS block
6. Kokoro reads response aloud
7. Sync pass runs during audio — parses SCENE_TAGS, updates database

### Sync Pass
Runs during Kokoro audio playback. Parses the SCENE_TAGS block and:
1. Writes new tags and aliases immediately (no AI)
2. Writes new relationships immediately (no AI)
3. Runs five sync agents in parallel (Ollama, using sync_prompt.txt)
4. Each sync agent receives: full narrative + SCENE_TAGS + 
   current records for modified tags in their domain
5. Each sync agent returns confirmed database writes
6. All writes executed
7. Game clock advanced based on time_advance declaration
8. Difficulty tracker counters updated

NOTE: environmental_state is the authoritative source for
season. game_clock.season is updated simultaneously when
time_advance causes a season change. Both must be updated
together — never one without the other.

### Sync Domain Routing
Each sync agent processes only these SCENE_TAGS lines:

CHARACTER AGENT sync:
  modified: character(*) fields
  wound_inflicted, wound_source
  essence_spent, resource_change, equipment_change
  player_milestone, new_skill, skill_increase

NPC AGENT sync:
  modified: npcs(*) fields
  new: npc type tags
  disposition_change
  knowledge: lines

PLOT AGENT sync:
  modified: threads(*) fields
  new: thread type tags

WORLD AGENT sync:
  modified: locations(*), factions(*), world_overview(*) fields
  new: location, faction type tags
  new_relationship: ALL relationship types (world agent owns all)
  faction_heat_change
  time_advance, weather changes

MECHANICS AGENT sync:
  encounter_rank, encounter_outcome
  directive_fulfilled
  new_consequence, dismiss_flag
  companion_rankup
  difficulty tracker updates

---

## Mechanics Design

### Rank Scale (0-100)
```
0-5:   Untrained civilian
6-15:  Trained human, common
16-25: Trained human, exceptional — human ceiling without augmentation
26-40: Augmented human — magic, blessing, artifact, legend
41-60: Lesser supernatural — powerful creatures, minor demons
61-80: Greater supernatural — dragons, ancient powers, major demons
81-95: Divine adjacent — demigods, avatars
96-100: True divine — gods, primordial forces
```

### Rank Differential Outcomes
```
Within 9 ranks:      Outcome uncertain, player decisions matter
10-19 rank gap:      Higher rank has significant advantage
20-34 rank gap:      Direct confrontation loses regardless of approach
35+ rank gap:        Cannot be fought directly — story resolution only
```

### Wound System
```
Three slots: empty | minor | moderate | serious | critical
Minor wounds do not fill a slot
One wound maximum per encounter
Wound penalty: -5 per moderate, -10 per serious, -15 per critical

Severity from rank gap:
Gap 15+ in player favor:  Superficial only — no mechanics
Gap 5-14 in player favor: Minor wound
Within 4 either way:      Moderate wound possible
Gap 5-14 against player:  Serious wound possible
Gap 15+ against player:   Critical wound
```

### Difficulty Tracker
```
Counters increment per exchange. When threshold crossed, 
directive fires in Mechanics Agent brief.

required_encounter_rank calculated as:
  player_effective_combat + (combat_since_wound × escalation_rate)
  escalation_rate default: 3

Resets to player_effective_combat when wound occurs.

Directive is a FLOOR not a ceiling. Story may demand harder encounters.
Applies to PLANNED combat only — not player-initiated brawls.
```

### Tag System
```
Narrator is sole authority on tag creation.
Agents are read-only librarians — they query and report only.
Tags declared in SCENE_TAGS block every exchange.
Aliases enable fuzzy matching in auto-injection check.
Relevance score controls ambient index inclusion.
Knowledge scope governs structural knowledge only — not personal
observations, casual conversation, or general world knowledge.
```

---

## Key Design Decisions

### Why Express instead of Electron
Electron was replaced to allow access from any device on the network
including phone and tablet. The game runs as a local web server.

### Why agents use Ollama
Agents run on llama3.1:8b locally — free, no API tokens. They do
preparation and reasoning work so Claude Opus only handles creative 
writing.

### Why narrator is sole tag authority
Prevents agent hallucination. Agents can only update existing records.
They cannot create new entities. Only the narrator can introduce new
things into the world.

### Why full pipeline every exchange
Cost is low enough (~$0.028/exchange with caching) that routing 
complexity and risk of wrong routing decisions is not worth it.
Claude decides DIRECT vs NEEDS_AGENTS based on scene context.

### Why 1-hour cache TTL for narrator prompt
Players may think for more than 5 minutes between moves. The narrator
system prompt is large (~1,500 tokens) and never changes. 1-hour TTL
ensures it stays cached across long thinking pauses.

### Why knowledge scope is structural only
NPC knowledge scope constrains privileged information — faction secrets,
organizational structure, operational plans. It does not restrict
personal observations, lived experience, or general world knowledge.
A person always knows what they saw and what any resident would know.

### Why wound directive is a floor not a ceiling
The difficulty tracker fires when the world has been too easy. The
directive sets a minimum encounter rank — the narrator may design
harder encounters if the story demands it. A wound must be possible,
not mandatory. Brilliant play can still avoid a wound.

### knowledge_scope.knows_own_role
knowledge_scope.knows_own_role is always 1 (true) and is not
declarable via SCENE_TAGS. An NPC always knows their own role.
This is intentional.

---

## Phase Build Order
```
Phase 1 — Foundation (database)
  Add 14 new tables to storage.js
  Add all CRUD functions
  Add all API endpoints in chronicle-server.js
  Update initializeGameRows()
  Update module.exports

  NOTE: The npcs table requires ALTER TABLE migrations to add
  three new columns. These must run before any new insert or
  upsert attempts use these columns.

Phase 1 Testing
  Verify all tables created correctly
  Verify all CRUD functions work
  Verify all API endpoints return correct data
  Verify initializeGameRows seeds all new tables
  Verify foreign key cascades work on game delete
  Verify existing game loop still works after changes

Phase 2 — Heuristics engine (heuristics.js)
  Rank differential calculator
  Wound math and slot management
  Directive generator and threshold checker
  Required encounter rank calculator
  Growth validator
  Time-based degradation (wounds, flags)
  Ambient index builder
  Brief assembler

Phase 2 Testing
  Rank differential returns correct outcome for all gap values
  Human rank ceiling enforced — cannot exceed 25 without 
    augmented entity_tier
  Wound severity correct for all rank gap scenarios
  Wound slots cap and track correctly
  Difficulty tracker increments correctly per scene type
  Difficulty tracker resets correctly on wound
  Required encounter rank calculates correctly
  Escalation rate applies correctly
  Directive fires at correct threshold
  Directive correctly flagged as floor not ceiling
  Growth validator blocks increase when cooldown not met
  Growth validator blocks increase when conditions not met
  Ambient index correctly excludes dormant tags
  Ambient index correctly excludes pending tags
  Brief assembler produces correct token-efficient format

Phase 3 — Agent architecture (agents.js)
  Tag detection via alias matching
  Per-agent query and prompt assembly
  Parallel agent execution
  SCENE_TAGS parser
  Sync pass executor
  Brief assembly function
  Write prompts/sync_prompt.txt

Phase 3 Testing
  Tag alias lookup returns correct tag
  Auto-injection check detects all known aliases in input
  SCENE_TAGS parser correctly extracts all line types
  SCENE_TAGS parser handles missing optional lines
  SCENE_TAGS parser flags malformed blocks
  Each agent prompt produces correct output format
  Agents refuse to invent information not in records
  Agents produce narrator-ready language not raw fields
  Sync agent correctly extracts from SCENE_TAGS
  Sync agent skips declarations with no narrative evidence
  Sync agent correctly routes domain-specific lines
  Knowledge scope blocks structural knowledge correctly
  Knowledge scope allows personal observations correctly
  Pending tags created for unknown relationship targets
  New aliases written before sync agents run

Phase 4 — Narrator integration
  Replace sendMessage() in index.html
  Wire DIRECT / NEEDS_AGENTS flow
  Load narrator prompt from prompts/narrator_prompt.txt
  Add 1-hour cache to narrator prompt call
  Update INTERVIEW_SYSTEM to seed tags and mechanics
  Add SCENE_TAGS post-processing

Phase 4 Testing
  Narrator correctly produces SCENE_TAGS block on every response
  Narrator correctly identifies DIRECT vs NEEDS_AGENTS
  Narrator correctly applies wound rules in combat scene
  Narrator correctly enforces NPC knowledge scope
  Narrator correctly honors active directives
  Narrator correctly flags player as never speaking
  Full exchange produces valid SCENE_TAGS
  Sync pass correctly updates all relevant tables after exchange
  Ambient index correctly reflects game state after sync
  Difficulty tracker correctly updates after combat exchange
  Faction heat correctly updates after heat change declaration
  Consequence correctly added to ledger after new_consequence
  Directive correctly dismissed after directive_fulfilled
  Rank increase correctly blocked when cooldown not met
  Human rank ceiling enforced end-to-end

Phase 5 — UI additions
  Tag registry panel
  Pending confirmations panel
  Mechanics state display (dev mode only)
  Import pipeline

Phase 5 Testing
  Tag registry displays all confirmed tags
  Pending panel shows unconfirmed tags and relationships
  Confirming pending tag promotes it correctly
  Dismissing pending tag removes it correctly
  Import pipeline correctly seeds all tables from documents
```

---

## Testing Approach

### Mechanical tests (no AI, instant)
Run with: `node tests/mechanical.test.js`
Test all heuristics calculations, rank math, wound math,
difficulty tracker logic. No API calls, no AI.

### Prompt behavior tests (Ollama, free)
Run with: `node tests/prompts.test.js`
Send test scenarios to each agent and verify output format
and content. Uses local Ollama — no cost.

### Integration tests (full server)
Run with: `node tests/integration.test.js`
Spin up the server, create a test game, run full exchanges,
verify database state after each. Requires server running.

### Test files location
```
chronicle-app/
└── tests/
    ├── mechanical.test.js    Phase 2 testing
    ├── prompts.test.js       Phase 3 testing
    └── integration.test.js   Phase 4 testing
```

### What to test after every code change
Before committing any change run:
1. `node chronicle-server.js` — server starts without errors
2. Relevant test file for the phase being worked on
3. Manual smoke test — load the game, send one message

---

## Current Exchange Flow (working — do not break)

```
Player types message
→ index.html sendMessage()
→ buildContext() assembles conversation history
→ callClaude() → callNarrator() → callOllama() or callAnthropic()
→ response displayed and spoken via Kokoro
→ considerCompression() runs in background
→ auto-save every 5 player messages
```

This flow remains active until Phase 4. Do not touch it.

---

## Notes for Claude Code

- Always read this entire file before making any changes
- Check existing patterns in storage.js before writing new functions
- The upsert pattern in storage.js is consistent — follow it exactly
- Every new storage function must be exported at the bottom of storage.js
- Every exported function needs a corresponding API endpoint
- Run `node chronicle-server.js` to test after any server changes
- The .env file contains CHRONICLE_TOKEN — never log it or expose it
- Use `py` not `python` for any Python subprocess calls
- Do not modify any existing table schemas
- Do not modify GM_SYSTEM_PROMPT in index.html
- Do not modify the current sendMessage() flow in index.html
- Phase 1 task: add new tables and functions only — nothing else