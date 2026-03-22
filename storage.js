const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const os = require('os')

// ═══════════════════════════════════════════════════════════
// STORAGE — Local SQLite database for Chronicle saves
// Lives at ~/Chronicle/chronicle.db
// ═══════════════════════════════════════════════════════════

const DATA_DIR = path.join(os.homedir(), 'Chronicle')
const DB_PATH  = path.join(DATA_DIR, 'chronicle.db')


if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Schema ───────────────────────────────────────────────────

db.exec(`

  CREATE TABLE IF NOT EXISTS games (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    character         TEXT DEFAULT '',
    created_at        TEXT NOT NULL,
    last_played       TEXT NOT NULL,
    imported          INTEGER DEFAULT 0,
    power_active      INTEGER DEFAULT 0,
    enterprise_active INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS game_files (
    game_id     TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    content     TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (game_id, file_name),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS compression_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    mechanical  TEXT NOT NULL,
    literary    TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chronicle_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    entry       TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS character (
    game_id       TEXT PRIMARY KEY,
    full_name     TEXT NOT NULL DEFAULT '',
    appearance    TEXT DEFAULT '',
    background    TEXT DEFAULT '',
    personality   TEXT DEFAULT '',
    abilities     TEXT DEFAULT '',
    equipment     TEXT DEFAULT '',
    condition     TEXT DEFAULT '',
    resources     TEXT DEFAULT '',
    obligations   TEXT DEFAULT '',
    notes         TEXT DEFAULT '',
    updated_at    TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS npcs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    name              TEXT NOT NULL,
    title             TEXT DEFAULT '',
    appearance        TEXT DEFAULT '',
    personality       TEXT DEFAULT '',
    role              TEXT DEFAULT '',
    relationship      TEXT DEFAULT '',
    history           TEXT DEFAULT '',
    current_status    TEXT DEFAULT '',
    current_location  TEXT DEFAULT '',
    attitude          TEXT DEFAULT '',
    secrets           TEXT DEFAULT '',
    debts_tensions    TEXT DEFAULT '',
    first_appeared    TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    updated_at        TEXT NOT NULL,
    disposition       INTEGER DEFAULT 0,
    loyalty           INTEGER DEFAULT 50,
    awareness         TEXT DEFAULT 'unaware',
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_npcs_game_name ON npcs(game_id, name);

  CREATE TABLE IF NOT EXISTS threads (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    name              TEXT NOT NULL,
    status            TEXT DEFAULT 'active',
    thread_type       TEXT DEFAULT 'quest',
    background        TEXT DEFAULT '',
    current_state     TEXT DEFAULT '',
    involved_npcs     TEXT DEFAULT '',
    stakes            TEXT DEFAULT '',
    next_steps        TEXT DEFAULT '',
    resolved_outcome  TEXT DEFAULT '',
    opened_at         TEXT DEFAULT '',
    resolved_at       TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    updated_at        TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS world_overview (
    game_id           TEXT PRIMARY KEY,
    world_name        TEXT DEFAULT '',
    overview          TEXT DEFAULT '',
    history           TEXT DEFAULT '',
    politics          TEXT DEFAULT '',
    tone              TEXT DEFAULT '',
    magic_system      TEXT DEFAULT '',
    religion          TEXT DEFAULT '',
    current_tensions  TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    updated_at        TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS locations (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    name              TEXT NOT NULL,
    location_type     TEXT DEFAULT '',
    description       TEXT DEFAULT '',
    atmosphere        TEXT DEFAULT '',
    current_state     TEXT DEFAULT '',
    significance      TEXT DEFAULT '',
    known_residents   TEXT DEFAULT '',
    dangers           TEXT DEFAULT '',
    player_visited    INTEGER DEFAULT 0,
    last_visited      TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    updated_at        TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_game_name ON locations(game_id, name);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_factions_game_name ON factions(game_id, name);

  CREATE TABLE IF NOT EXISTS factions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    name              TEXT NOT NULL,
    faction_type      TEXT DEFAULT '',
    description       TEXT DEFAULT '',
    power_level       TEXT DEFAULT '',
    goals             TEXT DEFAULT '',
    methods           TEXT DEFAULT '',
    relationship      TEXT DEFAULT '',
    key_members       TEXT DEFAULT '',
    resources         TEXT DEFAULT '',
    current_actions   TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    updated_at        TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mechanics (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    name              TEXT NOT NULL,
    mechanic_type     TEXT DEFAULT '',
    description       TEXT DEFAULT '',
    current_state     TEXT DEFAULT '',
    known_behaviors   TEXT DEFAULT '',
    limitations       TEXT DEFAULT '',
    progression       TEXT DEFAULT '',
    last_used         TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    updated_at        TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS power_authority (
    game_id         TEXT PRIMARY KEY,
    scope           TEXT DEFAULT 'none',
    authority_name  TEXT DEFAULT '',
    authority_type  TEXT DEFAULT '',
    granted_by      TEXT DEFAULT '',
    conditions      TEXT DEFAULT '',
    current_status  TEXT DEFAULT '',
    reputation      INTEGER DEFAULT 50,
    notes           TEXT DEFAULT '',
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS power_units (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    name              TEXT NOT NULL,
    unit_type         TEXT DEFAULT '',
    commander         TEXT DEFAULT '',
    size              INTEGER DEFAULT 0,
    quality           TEXT DEFAULT '',
    composition       TEXT DEFAULT '',
    morale            INTEGER DEFAULT 70,
    supply_days       INTEGER DEFAULT 30,
    current_location  TEXT DEFAULT '',
    current_status    TEXT DEFAULT '',
    destination       TEXT DEFAULT '',
    arrival_days      INTEGER DEFAULT 0,
    monthly_cost      INTEGER DEFAULT 0,
    reports_to        TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    updated_at        TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS power_relationships (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    name              TEXT NOT NULL,
    relationship_type TEXT DEFAULT '',
    their_power_level TEXT DEFAULT '',
    our_relationship  TEXT DEFAULT '',
    loyalty           INTEGER DEFAULT 50,
    what_they_want    TEXT DEFAULT '',
    what_they_fear    TEXT DEFAULT '',
    what_they_owe_us  TEXT DEFAULT '',
    what_we_owe_them  TEXT DEFAULT '',
    grievances        TEXT DEFAULT '',
    ambitions         TEXT DEFAULT '',
    history           TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    updated_at        TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS power_obligations (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    counterparty      TEXT NOT NULL,
    obligation_type   TEXT DEFAULT '',
    we_must           TEXT DEFAULT '',
    they_must         TEXT DEFAULT '',
    terms             TEXT DEFAULT '',
    signed_date       TEXT DEFAULT '',
    deadline          TEXT DEFAULT '',
    status            TEXT DEFAULT 'active',
    notes             TEXT DEFAULT '',
    updated_at        TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS power_holdings (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    name              TEXT NOT NULL,
    holding_type      TEXT DEFAULT '',
    location          TEXT DEFAULT '',
    population        INTEGER DEFAULT 0,
    loyalty           INTEGER DEFAULT 50,
    garrison_size     INTEGER DEFAULT 0,
    defenses          TEXT DEFAULT '',
    produces          TEXT DEFAULT '',
    tax_rate          INTEGER DEFAULT 20,
    tax_income        INTEGER DEFAULT 0,
    current_condition TEXT DEFAULT '',
    local_authority   TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    updated_at        TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS power_resources (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id            TEXT NOT NULL,
    resource_type      TEXT NOT NULL,
    current_amount     REAL DEFAULT 0,
    monthly_change     REAL DEFAULT 0,
    critical_threshold REAL DEFAULT 0,
    notes              TEXT DEFAULT '',
    updated_at         TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS power_intelligence (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id       TEXT NOT NULL,
    subject       TEXT NOT NULL,
    source        TEXT DEFAULT '',
    information   TEXT NOT NULL,
    confidence    TEXT DEFAULT 'rumor',
    gathered_date TEXT DEFAULT '',
    still_valid   INTEGER DEFAULT 1,
    notes         TEXT DEFAULT '',
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS enterprise (
    game_id         TEXT PRIMARY KEY,
    scope           TEXT DEFAULT 'none',
    company_name    TEXT DEFAULT '',
    treasury_coin   REAL DEFAULT 0,
    reputation      INTEGER DEFAULT 50,
    headquarters    TEXT DEFAULT '',
    specialty       TEXT DEFAULT '',
    credit_rating   TEXT DEFAULT '',
    notes           TEXT DEFAULT '',
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS enterprise_inventory (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    good_name         TEXT NOT NULL,
    quantity          REAL DEFAULT 0,
    unit              TEXT DEFAULT '',
    purchase_price    REAL DEFAULT 0,
    purchase_location TEXT DEFAULT '',
    purchase_date     TEXT DEFAULT '',
    condition         TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS enterprise_routes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id         TEXT NOT NULL,
    origin          TEXT NOT NULL,
    destination     TEXT NOT NULL,
    distance_days   INTEGER DEFAULT 1,
    danger_level    TEXT DEFAULT 'low',
    route_type      TEXT DEFAULT '',
    status          TEXT DEFAULT 'unknown',
    last_traveled   TEXT DEFAULT '',
    notes           TEXT DEFAULT '',
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS enterprise_markets (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    location_name     TEXT NOT NULL,
    market_type       TEXT DEFAULT '',
    specialty_goods   TEXT DEFAULT '',
    demand_goods      TEXT DEFAULT '',
    current_prices    TEXT DEFAULT '',
    market_conditions TEXT DEFAULT 'normal',
    season_modifiers  TEXT DEFAULT '',
    key_merchants     TEXT DEFAULT '',
    last_updated      TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_markets_game_location
    ON enterprise_markets(game_id, location_name);

  CREATE TABLE IF NOT EXISTS enterprise_contracts (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    counterparty      TEXT NOT NULL,
    contract_type     TEXT DEFAULT '',
    description       TEXT DEFAULT '',
    good_name         TEXT DEFAULT '',
    quantity          REAL DEFAULT 0,
    price_per_unit    REAL DEFAULT 0,
    total_value       REAL DEFAULT 0,
    delivery_location TEXT DEFAULT '',
    deadline          TEXT DEFAULT '',
    penalty_clause    TEXT DEFAULT '',
    status            TEXT DEFAULT 'active',
    signed_date       TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS enterprise_employees (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    name              TEXT NOT NULL,
    role              TEXT DEFAULT '',
    current_location  TEXT DEFAULT '',
    current_task      TEXT DEFAULT '',
    loyalty           INTEGER DEFAULT 70,
    competence        INTEGER DEFAULT 50,
    monthly_cost      REAL DEFAULT 0,
    notes             TEXT DEFAULT '',
    updated_at        TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS enterprise_ledger (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    transaction_type  TEXT NOT NULL,
    description       TEXT NOT NULL,
    amount            REAL NOT NULL,
    location          TEXT DEFAULT '',
    in_world_date     TEXT DEFAULT '',
    balance_after     REAL DEFAULT 0,
    notes             TEXT DEFAULT '',
    created_at        TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subgame_events (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           TEXT NOT NULL,
    agent             TEXT NOT NULL,
    event_type        TEXT DEFAULT '',
    description       TEXT NOT NULL,
    narrative_hook    TEXT DEFAULT '',
    relevance_tags    TEXT DEFAULT '',
    urgency           TEXT DEFAULT 'low',
    expires_after     INTEGER DEFAULT NULL,
    sessions_held     INTEGER DEFAULT 0,
    escalation_note   TEXT DEFAULT '',
    status            TEXT DEFAULT 'queued',
    created_at        TEXT NOT NULL,
    delivered_at      TEXT DEFAULT NULL,
    dismissed_reason  TEXT DEFAULT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS game_clock (
    game_id         TEXT PRIMARY KEY,
    in_world_date   TEXT DEFAULT '',
    year            INTEGER DEFAULT 1,
    season          TEXT DEFAULT 'spring',
    day_of_season   INTEGER DEFAULT 1,
    total_days      INTEGER DEFAULT 1,
    last_updated    TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_settings (
    game_id                   TEXT PRIMARY KEY,
    max_events_per_session    INTEGER DEFAULT 2,
    min_exchanges_between     INTEGER DEFAULT 5,
    critical_bypass           INTEGER DEFAULT 1,
    power_tick_days           INTEGER DEFAULT 3,
    enterprise_tick_days      INTEGER DEFAULT 7,
    max_events_per_tick       INTEGER DEFAULT 2,
    max_queue_depth           INTEGER DEFAULT 8,
    hold_before_escalate      INTEGER DEFAULT 2,
    hold_before_critical      INTEGER DEFAULT 5,
    auto_dismiss_after        INTEGER DEFAULT 10,
    simulation_intensity      TEXT DEFAULT 'moderate',
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id               TEXT NOT NULL,
    created_at            TEXT NOT NULL,
    scene_type            TEXT DEFAULT 'unknown',
    player_reachable      INTEGER DEFAULT 1,
    in_world_time_elapsed TEXT DEFAULT '0 hours',
    changes               TEXT DEFAULT '',
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_npcs_game ON npcs(game_id);
  CREATE INDEX IF NOT EXISTS idx_threads_game_status ON threads(game_id, status);
  CREATE INDEX IF NOT EXISTS idx_locations_game ON locations(game_id);
  CREATE INDEX IF NOT EXISTS idx_factions_game ON factions(game_id);
  CREATE INDEX IF NOT EXISTS idx_mechanics_game ON mechanics(game_id);
  CREATE INDEX IF NOT EXISTS idx_power_units_game ON power_units(game_id);
  CREATE INDEX IF NOT EXISTS idx_power_relationships_game ON power_relationships(game_id);
  CREATE INDEX IF NOT EXISTS idx_power_holdings_game ON power_holdings(game_id);
  CREATE INDEX IF NOT EXISTS idx_enterprise_inventory_game ON enterprise_inventory(game_id);
  CREATE INDEX IF NOT EXISTS idx_enterprise_contracts_game ON enterprise_contracts(game_id, status);
  CREATE INDEX IF NOT EXISTS idx_subgame_events_game_status ON subgame_events(game_id, status);
  CREATE INDEX IF NOT EXISTS idx_sync_log_game ON sync_log(game_id);
  CREATE INDEX IF NOT EXISTS idx_chronicle_log_game ON chronicle_log(game_id);
  CREATE INDEX IF NOT EXISTS idx_compression_log_game ON compression_log(game_id);

  -- ─── Phase 1 New Tables ──────────────────────────────────

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

  CREATE TABLE IF NOT EXISTS tag_aliases (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_id   TEXT NOT NULL,
    game_id  TEXT NOT NULL,
    alias    TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

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

  CREATE TABLE IF NOT EXISTS faction_heat (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id    TEXT NOT NULL,
    tag_id     TEXT NOT NULL,
    heat       INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

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

  -- ─── Phase 1 Indexes ─────────────────────────────────────

  CREATE INDEX IF NOT EXISTS idx_tags_game ON tags(game_id);
  CREATE INDEX IF NOT EXISTS idx_tags_game_type ON tags(game_id, tag_type);
  CREATE INDEX IF NOT EXISTS idx_tag_aliases_game ON tag_aliases(game_id);
  CREATE INDEX IF NOT EXISTS idx_tag_aliases_lookup ON tag_aliases(game_id, alias);
  CREATE INDEX IF NOT EXISTS idx_tag_relationships_game ON tag_relationships(game_id);
  CREATE INDEX IF NOT EXISTS idx_tag_relationships_a ON tag_relationships(game_id, tag_id_a);
  CREATE INDEX IF NOT EXISTS idx_tag_relationships_b ON tag_relationships(game_id, tag_id_b);
  CREATE INDEX IF NOT EXISTS idx_pending_tags_game ON pending_tags(game_id);
  CREATE INDEX IF NOT EXISTS idx_pending_relationships_game ON pending_relationships(game_id);
  CREATE INDEX IF NOT EXISTS idx_skill_ranks_game ON skill_ranks(game_id);
  CREATE INDEX IF NOT EXISTS idx_milestone_log_game ON milestone_log(game_id);
  CREATE INDEX IF NOT EXISTS idx_companion_state_game ON companion_state(game_id);
  CREATE INDEX IF NOT EXISTS idx_consequence_ledger_game ON consequence_ledger(game_id, status);
  CREATE INDEX IF NOT EXISTS idx_pending_flags_game ON pending_flags(game_id, status);
  CREATE INDEX IF NOT EXISTS idx_faction_heat_game ON faction_heat(game_id);
  CREATE INDEX IF NOT EXISTS idx_knowledge_scope_game ON knowledge_scope(game_id, tag_id);

`)

// ── Migrations — add columns to existing tables if not present ──
try { db.exec(`ALTER TABLE npcs ADD COLUMN disposition INTEGER DEFAULT 0`) } catch(e) {}
try { db.exec(`ALTER TABLE npcs ADD COLUMN loyalty INTEGER DEFAULT 50`) } catch(e) {}
try { db.exec(`ALTER TABLE npcs ADD COLUMN awareness TEXT DEFAULT 'unaware'`) } catch(e) {}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function now() { return new Date().toISOString() }

function nowDisplay() {
  return new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

// ═══════════════════════════════════════════════════════════
// CORE — GAMES
// ═══════════════════════════════════════════════════════════

function listGames() {
  return db.prepare(`
    SELECT id, name, character, created_at, last_played,
           imported, power_active, enterprise_active
    FROM games ORDER BY last_played DESC
  `).all()
}

function getGame(gameId) {
  return db.prepare('SELECT * FROM games WHERE id = ?').get(gameId)
}

function createGame(game) {
  const ts = nowDisplay()
  db.prepare(`
    INSERT INTO games
      (id, name, character, created_at, last_played, imported,
       power_active, enterprise_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    game.id, game.name, game.character || '', ts, ts,
    game.imported ? 1 : 0,
    game.power_active ? 1 : 0,
    game.enterprise_active ? 1 : 0
  )
}

function updateGameLastPlayed(gameId) {
  db.prepare('UPDATE games SET last_played = ? WHERE id = ?')
    .run(nowDisplay(), gameId)
}

function updateGameAgents(gameId, powerActive, enterpriseActive) {
  db.prepare('UPDATE games SET power_active = ?, enterprise_active = ? WHERE id = ?')
    .run(powerActive ? 1 : 0, enterpriseActive ? 1 : 0, gameId)
}

function deleteGame(gameId) {
  db.prepare('DELETE FROM games WHERE id = ?').run(gameId)
}

// ═══════════════════════════════════════════════════════════
// CORE — GAME FILES
// ═══════════════════════════════════════════════════════════

function readFile(gameId, fileName) {
  const row = db.prepare(
    'SELECT content FROM game_files WHERE game_id = ? AND file_name = ?'
  ).get(gameId, fileName)
  return row ? row.content : null
}

function writeFile(gameId, fileName, content) {
  db.prepare(`
    INSERT INTO game_files (game_id, file_name, content, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(game_id, file_name) DO UPDATE SET
      content = excluded.content,
      updated_at = excluded.updated_at
  `).run(gameId, fileName, content, now())
}

function readAllFiles(gameId) {
  const rows = db.prepare(
    'SELECT file_name, content FROM game_files WHERE game_id = ?'
  ).all(gameId)
  const result = {}
  for (const row of rows) result[row.file_name] = row.content
  return result
}

// ═══════════════════════════════════════════════════════════
// SESSION MEMORY
// ═══════════════════════════════════════════════════════════

function getCompressionLog(gameId) {
  return db.prepare(`
    SELECT mechanical, literary, created_at FROM compression_log
    WHERE game_id = ? ORDER BY id ASC
  `).all(gameId)
}

function appendCompressionEntry(gameId, mechanical, literary) {
  db.prepare(`
    INSERT INTO compression_log (game_id, created_at, mechanical, literary)
    VALUES (?, ?, ?, ?)
  `).run(gameId, now(), mechanical, literary)
}

function getChronicleLog(gameId) {
  return db.prepare(
    'SELECT entry, created_at FROM chronicle_log WHERE game_id = ? ORDER BY id ASC'
  ).all(gameId)
}

function appendChronicleEntry(gameId, entry) {
  db.prepare(
    'INSERT INTO chronicle_log (game_id, created_at, entry) VALUES (?, ?, ?)'
  ).run(gameId, now(), entry)
}

// ═══════════════════════════════════════════════════════════
// PASSIVE — CHARACTER
// ═══════════════════════════════════════════════════════════

function getCharacter(gameId) {
  return db.prepare('SELECT * FROM character WHERE game_id = ?').get(gameId)
}

function upsertCharacter(gameId, fields) {
  const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  const changed = db.prepare(
    `UPDATE character SET ${cols}, updated_at = ? WHERE game_id = ?`
  ).run(...Object.values(fields), now(), gameId).changes
  if (!changed) {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO character (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

// ═══════════════════════════════════════════════════════════
// PASSIVE — NPCS
// ═══════════════════════════════════════════════════════════

function getNpcs(gameId) {
  return db.prepare('SELECT * FROM npcs WHERE game_id = ? ORDER BY name').all(gameId)
}

function getNpc(gameId, name) {
  return db.prepare('SELECT * FROM npcs WHERE game_id = ? AND name = ?').get(gameId, name)
}

function upsertNpc(gameId, fields) {
  const existing = getNpc(gameId, fields.name)
  if (existing) {
    const { name, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE npcs SET ${cols}, updated_at = ? WHERE game_id = ? AND name = ?`)
      .run(...Object.values(rest), now(), gameId, name)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO npcs (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function deleteNpc(gameId, name) {
  db.prepare('DELETE FROM npcs WHERE game_id = ? AND name = ?').run(gameId, name)
}

// ═══════════════════════════════════════════════════════════
// PASSIVE — THREADS
// ═══════════════════════════════════════════════════════════

function getThreads(gameId, status = null) {
  if (status) {
    return db.prepare(
      'SELECT * FROM threads WHERE game_id = ? AND status = ? ORDER BY id ASC'
    ).all(gameId, status)
  }
  return db.prepare('SELECT * FROM threads WHERE game_id = ? ORDER BY id ASC').all(gameId)
}

function getThread(gameId, id) {
  return db.prepare('SELECT * FROM threads WHERE game_id = ? AND id = ?').get(gameId, id)
}

function upsertThread(gameId, fields) {
  if (fields.id) {
    const { id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE threads SET ${cols}, updated_at = ? WHERE game_id = ? AND id = ?`)
      .run(...Object.values(rest), now(), gameId, id)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO threads (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

// ═══════════════════════════════════════════════════════════
// PASSIVE — WORLD OVERVIEW
// ═══════════════════════════════════════════════════════════

function getWorldOverview(gameId) {
  return db.prepare('SELECT * FROM world_overview WHERE game_id = ?').get(gameId)
}

function upsertWorldOverview(gameId, fields) {
  const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  const changed = db.prepare(
    `UPDATE world_overview SET ${cols}, updated_at = ? WHERE game_id = ?`
  ).run(...Object.values(fields), now(), gameId).changes
  if (!changed) {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO world_overview (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

// ═══════════════════════════════════════════════════════════
// PASSIVE — LOCATIONS
// ═══════════════════════════════════════════════════════════

function getLocations(gameId) {
  return db.prepare('SELECT * FROM locations WHERE game_id = ? ORDER BY name').all(gameId)
}

function getLocation(gameId, name) {
  return db.prepare('SELECT * FROM locations WHERE game_id = ? AND name = ?').get(gameId, name)
}

function upsertLocation(gameId, fields) {
  const existing = getLocation(gameId, fields.name)
  if (existing) {
    const { name, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE locations SET ${cols}, updated_at = ? WHERE game_id = ? AND name = ?`)
      .run(...Object.values(rest), now(), gameId, name)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO locations (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

// ═══════════════════════════════════════════════════════════
// PASSIVE — FACTIONS
// ═══════════════════════════════════════════════════════════

function getFactions(gameId) {
  return db.prepare('SELECT * FROM factions WHERE game_id = ? ORDER BY name').all(gameId)
}

function getFaction(gameId, name) {
  return db.prepare('SELECT * FROM factions WHERE game_id = ? AND name = ?').get(gameId, name)
}

function upsertFaction(gameId, fields) {
  const existing = getFaction(gameId, fields.name)
  if (existing) {
    const { name, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE factions SET ${cols}, updated_at = ? WHERE game_id = ? AND name = ?`)
      .run(...Object.values(rest), now(), gameId, name)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO factions (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

// ═══════════════════════════════════════════════════════════
// PASSIVE — MECHANICS
// ═══════════════════════════════════════════════════════════

function getMechanics(gameId) {
  return db.prepare('SELECT * FROM mechanics WHERE game_id = ? ORDER BY name').all(gameId)
}

function getMechanic(gameId, name) {
  return db.prepare('SELECT * FROM mechanics WHERE game_id = ? AND name = ?').get(gameId, name)
}

function upsertMechanic(gameId, fields) {
  const existing = getMechanic(gameId, fields.name)
  if (existing) {
    const { name, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE mechanics SET ${cols}, updated_at = ? WHERE game_id = ? AND name = ?`)
      .run(...Object.values(rest), now(), gameId, name)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO mechanics (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

// ═══════════════════════════════════════════════════════════
// POWER AGENT
// ═══════════════════════════════════════════════════════════

function getPowerAuthority(gameId) {
  return db.prepare('SELECT * FROM power_authority WHERE game_id = ?').get(gameId)
}

function upsertPowerAuthority(gameId, fields) {
  const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  const changed = db.prepare(
    `UPDATE power_authority SET ${cols}, updated_at = ? WHERE game_id = ?`
  ).run(...Object.values(fields), now(), gameId).changes
  if (!changed) {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO power_authority (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getPowerUnits(gameId) {
  return db.prepare('SELECT * FROM power_units WHERE game_id = ? ORDER BY name').all(gameId)
}

function upsertPowerUnit(gameId, fields) {
  if (fields.id) {
    const { id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE power_units SET ${cols}, updated_at = ? WHERE game_id = ? AND id = ?`)
      .run(...Object.values(rest), now(), gameId, id)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO power_units (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getPowerRelationships(gameId) {
  return db.prepare('SELECT * FROM power_relationships WHERE game_id = ? ORDER BY name').all(gameId)
}

function upsertPowerRelationship(gameId, fields) {
  if (fields.id) {
    const { id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE power_relationships SET ${cols}, updated_at = ? WHERE game_id = ? AND id = ?`)
      .run(...Object.values(rest), now(), gameId, id)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO power_relationships (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getPowerObligations(gameId) {
  return db.prepare('SELECT * FROM power_obligations WHERE game_id = ? ORDER BY id ASC').all(gameId)
}

function upsertPowerObligation(gameId, fields) {
  if (fields.id) {
    const { id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE power_obligations SET ${cols}, updated_at = ? WHERE game_id = ? AND id = ?`)
      .run(...Object.values(rest), now(), gameId, id)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO power_obligations (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getPowerHoldings(gameId) {
  return db.prepare('SELECT * FROM power_holdings WHERE game_id = ? ORDER BY name').all(gameId)
}

function upsertPowerHolding(gameId, fields) {
  if (fields.id) {
    const { id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE power_holdings SET ${cols}, updated_at = ? WHERE game_id = ? AND id = ?`)
      .run(...Object.values(rest), now(), gameId, id)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO power_holdings (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getPowerResources(gameId) {
  return db.prepare('SELECT * FROM power_resources WHERE game_id = ?').all(gameId)
}

function upsertPowerResource(gameId, resourceType, fields) {
  const existing = db.prepare(
    'SELECT id FROM power_resources WHERE game_id = ? AND resource_type = ?'
  ).get(gameId, resourceType)
  if (existing) {
    const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE power_resources SET ${cols}, updated_at = ? WHERE game_id = ? AND resource_type = ?`)
      .run(...Object.values(fields), now(), gameId, resourceType)
  } else {
    const all = { game_id: gameId, resource_type: resourceType, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO power_resources (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getPowerIntelligence(gameId) {
  return db.prepare(
    'SELECT * FROM power_intelligence WHERE game_id = ? AND still_valid = 1 ORDER BY id DESC'
  ).all(gameId)
}

function addPowerIntelligence(gameId, fields) {
  const all = { game_id: gameId, ...fields }
  db.prepare(
    `INSERT INTO power_intelligence (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
  ).run(...Object.values(all))
}

// ═══════════════════════════════════════════════════════════
// ENTERPRISE AGENT
// ═══════════════════════════════════════════════════════════

function getEnterprise(gameId) {
  return db.prepare('SELECT * FROM enterprise WHERE game_id = ?').get(gameId)
}

function upsertEnterprise(gameId, fields) {
  const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  const changed = db.prepare(
    `UPDATE enterprise SET ${cols}, updated_at = ? WHERE game_id = ?`
  ).run(...Object.values(fields), now(), gameId).changes
  if (!changed) {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO enterprise (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getInventory(gameId) {
  return db.prepare('SELECT * FROM enterprise_inventory WHERE game_id = ?').all(gameId)
}

function upsertInventoryItem(gameId, fields) {
  if (fields.id) {
    const { id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE enterprise_inventory SET ${cols} WHERE game_id = ? AND id = ?`)
      .run(...Object.values(rest), gameId, id)
  } else {
    const all = { game_id: gameId, ...fields }
    db.prepare(
      `INSERT INTO enterprise_inventory (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getRoutes(gameId) {
  return db.prepare('SELECT * FROM enterprise_routes WHERE game_id = ?').all(gameId)
}

function upsertRoute(gameId, fields) {
  if (fields.id) {
    const { id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE enterprise_routes SET ${cols} WHERE game_id = ? AND id = ?`)
      .run(...Object.values(rest), gameId, id)
  } else {
    const all = { game_id: gameId, ...fields }
    db.prepare(
      `INSERT INTO enterprise_routes (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getMarkets(gameId) {
  return db.prepare('SELECT * FROM enterprise_markets WHERE game_id = ? ORDER BY location_name').all(gameId)
}

function upsertMarket(gameId, fields) {
  const existing = db.prepare(
    'SELECT id FROM enterprise_markets WHERE game_id = ? AND location_name = ?'
  ).get(gameId, fields.location_name)
  if (existing) {
    const { location_name, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE enterprise_markets SET ${cols} WHERE game_id = ? AND location_name = ?`)
      .run(...Object.values(rest), gameId, location_name)
  } else {
    const all = { game_id: gameId, ...fields }
    db.prepare(
      `INSERT INTO enterprise_markets (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getContracts(gameId, status = null) {
  if (status) {
    return db.prepare(
      'SELECT * FROM enterprise_contracts WHERE game_id = ? AND status = ? ORDER BY id ASC'
    ).all(gameId, status)
  }
  return db.prepare('SELECT * FROM enterprise_contracts WHERE game_id = ? ORDER BY id ASC').all(gameId)
}

function upsertContract(gameId, fields) {
  if (fields.id) {
    const { id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE enterprise_contracts SET ${cols} WHERE game_id = ? AND id = ?`)
      .run(...Object.values(rest), gameId, id)
  } else {
    const all = { game_id: gameId, ...fields }
    db.prepare(
      `INSERT INTO enterprise_contracts (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getEmployees(gameId) {
  return db.prepare('SELECT * FROM enterprise_employees WHERE game_id = ? ORDER BY name').all(gameId)
}

function upsertEmployee(gameId, fields) {
  if (fields.id) {
    const { id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE enterprise_employees SET ${cols}, updated_at = ? WHERE game_id = ? AND id = ?`)
      .run(...Object.values(rest), now(), gameId, id)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO enterprise_employees (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getLedger(gameId, limit = 50) {
  return db.prepare(
    'SELECT * FROM enterprise_ledger WHERE game_id = ? ORDER BY id DESC LIMIT ?'
  ).all(gameId, limit)
}

function appendLedgerEntry(gameId, fields) {
  const all = { game_id: gameId, ...fields, created_at: now() }
  db.prepare(
    `INSERT INTO enterprise_ledger (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
  ).run(...Object.values(all))
}

// ═══════════════════════════════════════════════════════════
// EVENT QUEUE
// ═══════════════════════════════════════════════════════════

function getQueuedEvents(gameId) {
  return db.prepare(`
    SELECT * FROM subgame_events
    WHERE game_id = ? AND status = 'queued'
    ORDER BY
      CASE urgency
        WHEN 'critical' THEN 0
        WHEN 'high'     THEN 1
        WHEN 'medium'   THEN 2
        WHEN 'low'      THEN 3
        ELSE 4
      END, id ASC
  `).all(gameId)
}

function addEvent(gameId, fields) {
  const all = { game_id: gameId, ...fields, created_at: now() }
  db.prepare(
    `INSERT INTO subgame_events (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
  ).run(...Object.values(all))
}

function updateEventStatus(eventId, status, reason = null) {
  if (status === 'delivered') {
    db.prepare("UPDATE subgame_events SET status = 'delivered', delivered_at = ? WHERE id = ?")
      .run(now(), eventId)
  } else if (status === 'dismissed') {
    db.prepare("UPDATE subgame_events SET status = 'dismissed', dismissed_reason = ? WHERE id = ?")
      .run(reason || '', eventId)
  } else if (status === 'held') {
    db.prepare("UPDATE subgame_events SET sessions_held = sessions_held + 1 WHERE id = ?")
      .run(eventId)
  }
}

function escalateEvents(gameId, settings) {
  const {
    hold_before_escalate = 2,
    hold_before_critical = 5,
    auto_dismiss_after = 10
  } = settings || {}

  const events = db.prepare(
    "SELECT * FROM subgame_events WHERE game_id = ? AND status = 'queued'"
  ).all(gameId)

  for (const e of events) {
    if (e.sessions_held >= auto_dismiss_after) {
      updateEventStatus(e.id, 'dismissed', 'auto-dismissed: held too long')
    } else if (e.sessions_held >= hold_before_critical && e.urgency !== 'critical') {
      db.prepare("UPDATE subgame_events SET urgency = 'critical', escalation_note = ? WHERE id = ?")
        .run(`Escalated to CRITICAL after ${e.sessions_held} sessions`, e.id)
    } else if (e.sessions_held >= hold_before_escalate && e.urgency === 'medium') {
      db.prepare("UPDATE subgame_events SET urgency = 'high', escalation_note = ? WHERE id = ?")
        .run(`Escalated from medium after ${e.sessions_held} sessions`, e.id)
    } else if (e.sessions_held >= hold_before_escalate && e.urgency === 'low') {
      db.prepare("UPDATE subgame_events SET urgency = 'medium', escalation_note = ? WHERE id = ?")
        .run(`Escalated from low after ${e.sessions_held} sessions`, e.id)
    }
  }
}

// ═══════════════════════════════════════════════════════════
// SYSTEM — GAME CLOCK
// ═══════════════════════════════════════════════════════════

function getGameClock(gameId) {
  return db.prepare('SELECT * FROM game_clock WHERE game_id = ?').get(gameId)
}

function upsertGameClock(gameId, fields) {
  const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  const changed = db.prepare(
    `UPDATE game_clock SET ${cols}, last_updated = ? WHERE game_id = ?`
  ).run(...Object.values(fields), now(), gameId).changes
  if (!changed) {
    const all = { game_id: gameId, ...fields, last_updated: now() }
    db.prepare(
      `INSERT INTO game_clock (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

// ═══════════════════════════════════════════════════════════
// SYSTEM — AGENT SETTINGS
// ═══════════════════════════════════════════════════════════

function getAgentSettings(gameId) {
  return db.prepare('SELECT * FROM agent_settings WHERE game_id = ?').get(gameId)
}

function upsertAgentSettings(gameId, fields) {
  const changed = db.prepare(
    `UPDATE agent_settings SET ${Object.keys(fields).map(k => `${k} = ?`).join(', ')} WHERE game_id = ?`
  ).run(...Object.values(fields), gameId).changes
  if (!changed) {
    const all = { game_id: gameId, ...fields }
    db.prepare(
      `INSERT INTO agent_settings (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

// ═══════════════════════════════════════════════════════════
// SYSTEM — SYNC LOG
// ═══════════════════════════════════════════════════════════

function appendSyncEntry(gameId, fields) {
  const all = { game_id: gameId, ...fields, created_at: now() }
  db.prepare(
    `INSERT INTO sync_log (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
  ).run(...Object.values(all))
}

function getRecentSyncLog(gameId, limit = 10) {
  return db.prepare(
    'SELECT * FROM sync_log WHERE game_id = ? ORDER BY id DESC LIMIT ?'
  ).all(gameId, limit)
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — TAGS
// ═══════════════════════════════════════════════════════════

function getTags(gameId) {
  return db.prepare(
    "SELECT * FROM tags WHERE game_id = ? AND confirmed = 1 ORDER BY canonical_name"
  ).all(gameId)
}

function getTag(gameId, tagId) {
  return db.prepare('SELECT * FROM tags WHERE game_id = ? AND id = ?').get(gameId, tagId)
}

function upsertTag(gameId, fields) {
  const existing = getTag(gameId, fields.id)
  if (existing) {
    const { id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE tags SET ${cols}, updated_at = ? WHERE game_id = ? AND id = ?`)
      .run(...Object.values(rest), now(), gameId, id)
  } else {
    const all = { game_id: gameId, ...fields, created_at: now(), updated_at: now() }
    db.prepare(
      `INSERT INTO tags (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function deleteTag(gameId, tagId) {
  db.prepare('DELETE FROM tags WHERE game_id = ? AND id = ?').run(gameId, tagId)
}

function getTagByAlias(gameId, alias) {
  const row = db.prepare(`
    SELECT t.* FROM tags t
    JOIN tag_aliases a ON t.id = a.tag_id AND t.game_id = a.game_id
    WHERE t.game_id = ? AND LOWER(a.alias) = LOWER(?)
  `).get(gameId, alias)
  return row || null
}

function findTagByAlias(gameId, alias) {
  return getTagByAlias(gameId, alias)
}

function getAmbientIndex(gameId) {
  const tags = db.prepare(
    "SELECT * FROM tags WHERE game_id = ? AND status = 'active' AND confirmed = 1 ORDER BY canonical_name"
  ).all(gameId)
  return tags.map(t => `${t.canonical_name}: ${t.tag_type}, ${t.status}`)
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — TAG ALIASES
// ═══════════════════════════════════════════════════════════

function getAliases(gameId, tagId) {
  return db.prepare(
    'SELECT * FROM tag_aliases WHERE game_id = ? AND tag_id = ?'
  ).all(gameId, tagId)
}

function addAlias(gameId, tagId, alias) {
  db.prepare(
    'INSERT INTO tag_aliases (tag_id, game_id, alias) VALUES (?, ?, ?)'
  ).run(tagId, gameId, alias)
}

function deleteAlias(gameId, aliasId) {
  db.prepare('DELETE FROM tag_aliases WHERE id = ? AND game_id = ?').run(aliasId, gameId)
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — TAG RELATIONSHIPS
// ═══════════════════════════════════════════════════════════

function getRelationships(gameId, tagId) {
  return db.prepare(`
    SELECT * FROM tag_relationships
    WHERE game_id = ? AND (tag_id_a = ? OR tag_id_b = ?)
    ORDER BY id ASC
  `).all(gameId, tagId, tagId)
}

function getAllRelationships(gameId) {
  return db.prepare(
    'SELECT * FROM tag_relationships WHERE game_id = ? ORDER BY id ASC'
  ).all(gameId)
}

function upsertRelationship(gameId, fields) {
  if (fields.id) {
    const { id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE tag_relationships SET ${cols}, updated_at = ? WHERE game_id = ? AND id = ?`)
      .run(...Object.values(rest), now(), gameId, id)
  } else {
    const all = { game_id: gameId, ...fields, created_at: now(), updated_at: now() }
    db.prepare(
      `INSERT INTO tag_relationships (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function deleteRelationship(gameId, id) {
  db.prepare('DELETE FROM tag_relationships WHERE game_id = ? AND id = ?').run(gameId, id)
}

function getTagMap(gameId, tagIds) {
  if (!tagIds || tagIds.length === 0) return []
  const placeholders = tagIds.map(() => '?').join(', ')
  return db.prepare(`
    SELECT * FROM tag_relationships
    WHERE game_id = ?
    AND (tag_id_a IN (${placeholders}) OR tag_id_b IN (${placeholders}))
    ORDER BY id ASC
  `).all(gameId, ...tagIds, ...tagIds)
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — PENDING TAGS
// ═══════════════════════════════════════════════════════════

function getPendingTags(gameId) {
  return db.prepare(
    'SELECT * FROM pending_tags WHERE game_id = ? ORDER BY created_at ASC'
  ).all(gameId)
}

function addPendingTag(gameId, fields) {
  const all = { game_id: gameId, ...fields, created_at: now() }
  db.prepare(
    `INSERT INTO pending_tags (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
  ).run(...Object.values(all))
}

function confirmPendingTag(gameId, id) {
  const pending = db.prepare(
    'SELECT * FROM pending_tags WHERE game_id = ? AND id = ?'
  ).get(gameId, id)
  if (!pending) return
  upsertTag(gameId, {
    id:             pending.id,
    tag_type:       pending.tag_type,
    canonical_name: pending.canonical_name,
    description:    pending.description || '',
    confirmed:      1,
  })
  db.prepare('DELETE FROM pending_tags WHERE game_id = ? AND id = ?').run(gameId, id)
}

function dismissPendingTag(gameId, id) {
  db.prepare('DELETE FROM pending_tags WHERE game_id = ? AND id = ?').run(gameId, id)
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — PENDING RELATIONSHIPS
// ═══════════════════════════════════════════════════════════

function getPendingRelationships(gameId) {
  return db.prepare(
    'SELECT * FROM pending_relationships WHERE game_id = ? ORDER BY created_at ASC'
  ).all(gameId)
}

function addPendingRelationship(gameId, fields) {
  const all = { game_id: gameId, ...fields, created_at: now() }
  db.prepare(
    `INSERT INTO pending_relationships (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
  ).run(...Object.values(all))
}

function confirmPendingRelationship(gameId, id) {
  const pending = db.prepare(
    'SELECT * FROM pending_relationships WHERE game_id = ? AND id = ?'
  ).get(gameId, id)
  if (!pending) return
  upsertRelationship(gameId, {
    tag_id_a:     pending.tag_id_a,
    tag_id_b:     pending.tag_id_b,
    relationship: pending.relationship,
    context_note: pending.context_note || '',
  })
  db.prepare('DELETE FROM pending_relationships WHERE game_id = ? AND id = ?').run(gameId, id)
}

function dismissPendingRelationship(gameId, id) {
  db.prepare('DELETE FROM pending_relationships WHERE game_id = ? AND id = ?').run(gameId, id)
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — GAME MECHANICS
// ═══════════════════════════════════════════════════════════

function getGameMechanics(gameId) {
  return db.prepare('SELECT * FROM game_mechanics WHERE game_id = ?').get(gameId)
}

function upsertGameMechanics(gameId, fields) {
  const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  const changed = db.prepare(
    `UPDATE game_mechanics SET ${cols}, updated_at = ? WHERE game_id = ?`
  ).run(...Object.values(fields), now(), gameId).changes
  if (!changed) {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO game_mechanics (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getEffectiveRanks(gameId) {
  const m = getGameMechanics(gameId)
  if (!m) return { combat: 0, social: 0, magic: 0, wound_penalty: 0 }
  const wp = m.wound_penalty || 0
  return {
    combat:        m.player_combat_rank - wp,
    social:        m.player_social_rank,
    magic:         m.player_magic_rank - Math.floor(wp / 2),
    wound_penalty: wp,
  }
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — SKILL RANKS
// ═══════════════════════════════════════════════════════════

function getSkillRanks(gameId) {
  return db.prepare(
    'SELECT * FROM skill_ranks WHERE game_id = ? ORDER BY skill_name'
  ).all(gameId)
}

function getSkillRank(gameId, skillName) {
  return db.prepare(
    'SELECT * FROM skill_ranks WHERE game_id = ? AND skill_name = ?'
  ).get(gameId, skillName)
}

function upsertSkillRank(gameId, fields) {
  const existing = getSkillRank(gameId, fields.skill_name)
  if (existing) {
    const { skill_name, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE skill_ranks SET ${cols}, updated_at = ? WHERE game_id = ? AND skill_name = ?`)
      .run(...Object.values(rest), now(), gameId, skill_name)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO skill_ranks (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function incrementSkillActivity(gameId, skillName) {
  const existing = getSkillRank(gameId, skillName)
  if (existing) {
    db.prepare(
      'UPDATE skill_ranks SET activity_count = activity_count + 1, updated_at = ? WHERE game_id = ? AND skill_name = ?'
    ).run(now(), gameId, skillName)
  } else {
    const all = { game_id: gameId, skill_name: skillName, activity_count: 1, updated_at: now() }
    db.prepare(
      `INSERT INTO skill_ranks (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — DIFFICULTY TRACKER
// ═══════════════════════════════════════════════════════════

function getDifficultyTracker(gameId) {
  return db.prepare('SELECT * FROM difficulty_tracker WHERE game_id = ?').get(gameId)
}

function upsertDifficultyTracker(gameId, fields) {
  const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  const changed = db.prepare(
    `UPDATE difficulty_tracker SET ${cols}, updated_at = ? WHERE game_id = ?`
  ).run(...Object.values(fields), now(), gameId).changes
  if (!changed) {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO difficulty_tracker (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function getActiveDirectives(gameId) {
  const row = getDifficultyTracker(gameId)
  if (!row || !row.active_directives) return []
  try {
    return JSON.parse(row.active_directives)
  } catch (e) {
    return []
  }
}

function addDirective(gameId, directive) {
  const directives = getActiveDirectives(gameId)
  directives.push(directive)
  db.prepare(
    'UPDATE difficulty_tracker SET active_directives = ?, updated_at = ? WHERE game_id = ?'
  ).run(JSON.stringify(directives), now(), gameId)
}

function removeDirective(gameId, directiveType) {
  const directives = getActiveDirectives(gameId)
  const filtered = directives.filter(d => d.type !== directiveType)
  db.prepare(
    'UPDATE difficulty_tracker SET active_directives = ?, updated_at = ? WHERE game_id = ?'
  ).run(JSON.stringify(filtered), now(), gameId)
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — ENVIRONMENTAL STATE
// ═══════════════════════════════════════════════════════════

function getEnvironmentalState(gameId) {
  return db.prepare('SELECT * FROM environmental_state WHERE game_id = ?').get(gameId)
}

function upsertEnvironmentalState(gameId, fields) {
  const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  const changed = db.prepare(
    `UPDATE environmental_state SET ${cols}, updated_at = ? WHERE game_id = ?`
  ).run(...Object.values(fields), now(), gameId).changes
  if (!changed) {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO environmental_state (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — MILESTONE LOG
// ═══════════════════════════════════════════════════════════

function getMilestones(gameId) {
  return db.prepare(
    'SELECT * FROM milestone_log WHERE game_id = ? ORDER BY id ASC'
  ).all(gameId)
}

function addMilestone(gameId, fields) {
  const all = { game_id: gameId, ...fields, created_at: now() }
  db.prepare(
    `INSERT INTO milestone_log (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
  ).run(...Object.values(all))
}

function getExchangesSinceLastMilestone(gameId, rankType) {
  const row = db.prepare(
    'SELECT exchange_number FROM milestone_log WHERE game_id = ? AND rank_type = ? ORDER BY id DESC LIMIT 1'
  ).get(gameId, rankType)
  return row ? row.exchange_number : 0
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — COMPANION STATE
// ═══════════════════════════════════════════════════════════

function getCompanionStates(gameId) {
  return db.prepare(
    'SELECT * FROM companion_state WHERE game_id = ? ORDER BY id ASC'
  ).all(gameId)
}

function getCompanionState(gameId, tagId) {
  return db.prepare(
    'SELECT * FROM companion_state WHERE game_id = ? AND tag_id = ?'
  ).get(gameId, tagId)
}

function upsertCompanionState(gameId, fields) {
  const existing = getCompanionState(gameId, fields.tag_id)
  if (existing) {
    const { tag_id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE companion_state SET ${cols}, updated_at = ? WHERE game_id = ? AND tag_id = ?`)
      .run(...Object.values(rest), now(), gameId, tag_id)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO companion_state (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

function incrementCompanionActivity(gameId, tagId, activityType) {
  const colMap = {
    combat:    'exchanges_in_combat',
    base:      'exchanges_at_base',
    traveling: 'exchanges_traveling',
  }
  const col = colMap[activityType]
  if (!col) return
  db.prepare(
    `UPDATE companion_state SET ${col} = ${col} + 1, updated_at = ? WHERE game_id = ? AND tag_id = ?`
  ).run(now(), gameId, tagId)
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — CONSEQUENCE LEDGER
// ═══════════════════════════════════════════════════════════

function getOpenConsequences(gameId) {
  return db.prepare(
    "SELECT * FROM consequence_ledger WHERE game_id = ? AND status = 'open' ORDER BY id ASC"
  ).all(gameId)
}

function addConsequence(gameId, fields) {
  const all = { game_id: gameId, ...fields, created_at: now() }
  db.prepare(
    `INSERT INTO consequence_ledger (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
  ).run(...Object.values(all))
}

function surfaceConsequence(gameId, id) {
  db.prepare(
    "UPDATE consequence_ledger SET status = 'surfaced', surfaced_at = ? WHERE game_id = ? AND id = ?"
  ).run(now(), gameId, id)
}

function dismissConsequence(gameId, id) {
  db.prepare(
    "UPDATE consequence_ledger SET status = 'dismissed' WHERE game_id = ? AND id = ?"
  ).run(gameId, id)
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — PENDING FLAGS
// ═══════════════════════════════════════════════════════════

function getPendingFlags(gameId) {
  return db.prepare(
    "SELECT * FROM pending_flags WHERE game_id = ? AND status = 'pending' ORDER BY id ASC"
  ).all(gameId)
}

function addPendingFlag(gameId, fields) {
  const all = { game_id: gameId, ...fields, created_at: now() }
  db.prepare(
    `INSERT INTO pending_flags (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
  ).run(...Object.values(all))
}

function incrementFlagAge(gameId) {
  db.prepare(
    "UPDATE pending_flags SET exchanges_held = exchanges_held + 1 WHERE game_id = ? AND status = 'pending'"
  ).run(gameId)
}

function dismissFlag(gameId, id, reason) {
  db.prepare(
    "UPDATE pending_flags SET status = 'dismissed', dismissed_reason = ? WHERE game_id = ? AND id = ?"
  ).run(reason || '', gameId, id)
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — FACTION HEAT
// ═══════════════════════════════════════════════════════════

function getFactionHeat(gameId) {
  return db.prepare(
    'SELECT * FROM faction_heat WHERE game_id = ? ORDER BY heat DESC'
  ).all(gameId)
}

function getFactionHeatByTag(gameId, tagId) {
  return db.prepare(
    'SELECT * FROM faction_heat WHERE game_id = ? AND tag_id = ?'
  ).get(gameId, tagId)
}

function upsertFactionHeat(gameId, tagId, heat) {
  const existing = getFactionHeatByTag(gameId, tagId)
  if (existing) {
    db.prepare(
      'UPDATE faction_heat SET heat = ?, updated_at = ? WHERE game_id = ? AND tag_id = ?'
    ).run(heat, now(), gameId, tagId)
  } else {
    db.prepare(
      'INSERT INTO faction_heat (game_id, tag_id, heat, updated_at) VALUES (?, ?, ?, ?)'
    ).run(gameId, tagId, heat, now())
  }
}

function getHighHeatFactions(gameId, threshold = 50) {
  return db.prepare(
    'SELECT * FROM faction_heat WHERE game_id = ? AND heat >= ? ORDER BY heat DESC'
  ).all(gameId, threshold)
}

// ═══════════════════════════════════════════════════════════
// PHASE 1 — KNOWLEDGE SCOPE
// ═══════════════════════════════════════════════════════════

function getKnowledgeScope(gameId, tagId) {
  return db.prepare(
    'SELECT * FROM knowledge_scope WHERE game_id = ? AND tag_id = ?'
  ).get(gameId, tagId)
}

function upsertKnowledgeScope(gameId, fields) {
  const existing = getKnowledgeScope(gameId, fields.tag_id)
  if (existing) {
    const { tag_id, ...rest } = fields
    const cols = Object.keys(rest).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE knowledge_scope SET ${cols}, updated_at = ? WHERE game_id = ? AND tag_id = ?`)
      .run(...Object.values(rest), now(), gameId, tag_id)
  } else {
    const all = { game_id: gameId, ...fields, updated_at: now() }
    db.prepare(
      `INSERT INTO knowledge_scope (${Object.keys(all).join(', ')}) VALUES (${Object.keys(all).map(() => '?').join(', ')})`
    ).run(...Object.values(all))
  }
}

// ═══════════════════════════════════════════════════════════
// INITIALIZE DEFAULT ROWS
// Call after createGame() — seeds single-row-per-game tables
// so all subsequent calls can use UPDATE safely.
// ═══════════════════════════════════════════════════════════

function initializeGameRows(gameId) {
  const ts = now()
  db.prepare('INSERT OR IGNORE INTO character (game_id, updated_at) VALUES (?, ?)').run(gameId, ts)
  db.prepare('INSERT OR IGNORE INTO world_overview (game_id, updated_at) VALUES (?, ?)').run(gameId, ts)
  db.prepare('INSERT OR IGNORE INTO game_clock (game_id, last_updated) VALUES (?, ?)').run(gameId, ts)
  db.prepare('INSERT OR IGNORE INTO agent_settings (game_id) VALUES (?)').run(gameId)
  db.prepare('INSERT OR IGNORE INTO game_mechanics (game_id, updated_at) VALUES (?, ?)').run(gameId, ts)
  db.prepare('INSERT OR IGNORE INTO difficulty_tracker (game_id, updated_at) VALUES (?, ?)').run(gameId, ts)
  db.prepare('INSERT OR IGNORE INTO environmental_state (game_id, updated_at) VALUES (?, ?)').run(gameId, ts)
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  db,

  // Core
  listGames, getGame, createGame, updateGameLastPlayed,
  updateGameAgents, deleteGame, initializeGameRows,

  // Files
  readFile, writeFile, readAllFiles,

  // Session memory
  getCompressionLog, appendCompressionEntry,
  getChronicleLog, appendChronicleEntry,

  // Passive — Character
  getCharacter, upsertCharacter,

  // Passive — NPCs
  getNpcs, getNpc, upsertNpc, deleteNpc,

  // Passive — Threads
  getThreads, getThread, upsertThread,

  // Passive — World
  getWorldOverview, upsertWorldOverview,

  // Passive — Locations
  getLocations, getLocation, upsertLocation,

  // Passive — Factions
  getFactions, getFaction, upsertFaction,

  // Passive — Mechanics
  getMechanics, getMechanic, upsertMechanic,

  // Power Agent
  getPowerAuthority, upsertPowerAuthority,
  getPowerUnits, upsertPowerUnit,
  getPowerRelationships, upsertPowerRelationship,
  getPowerObligations, upsertPowerObligation,
  getPowerHoldings, upsertPowerHolding,
  getPowerResources, upsertPowerResource,
  getPowerIntelligence, addPowerIntelligence,

  // Enterprise Agent
  getEnterprise, upsertEnterprise,
  getInventory, upsertInventoryItem,
  getRoutes, upsertRoute,
  getMarkets, upsertMarket,
  getContracts, upsertContract,
  getEmployees, upsertEmployee,
  getLedger, appendLedgerEntry,

  // Event queue
  getQueuedEvents, addEvent, updateEventStatus, escalateEvents,

  // System — Clock
  getGameClock, upsertGameClock,

  // System — Settings
  getAgentSettings, upsertAgentSettings,

  // System — Sync log
  appendSyncEntry, getRecentSyncLog,

  // Tags
  getTags, getTag, upsertTag, deleteTag,
  getTagByAlias, findTagByAlias, getAmbientIndex,

  // Tag Aliases
  getAliases, addAlias, deleteAlias,

  // Tag Relationships
  getRelationships, getAllRelationships, upsertRelationship,
  deleteRelationship, getTagMap,

  // Pending Tags
  getPendingTags, addPendingTag, confirmPendingTag,
  dismissPendingTag,

  // Pending Relationships
  getPendingRelationships, addPendingRelationship,
  confirmPendingRelationship, dismissPendingRelationship,

  // Game Mechanics
  getGameMechanics, upsertGameMechanics, getEffectiveRanks,

  // Skill Ranks
  getSkillRanks, getSkillRank, upsertSkillRank,
  incrementSkillActivity,

  // Difficulty Tracker
  getDifficultyTracker, upsertDifficultyTracker,
  getActiveDirectives, addDirective, removeDirective,

  // Environmental State
  getEnvironmentalState, upsertEnvironmentalState,

  // Milestone Log
  getMilestones, addMilestone, getExchangesSinceLastMilestone,

  // Companion State
  getCompanionStates, getCompanionState, upsertCompanionState,
  incrementCompanionActivity,

  // Consequence Ledger
  getOpenConsequences, addConsequence, surfaceConsequence,
  dismissConsequence,

  // Pending Flags
  getPendingFlags, addPendingFlag, incrementFlagAge, dismissFlag,

  // Faction Heat
  getFactionHeat, getFactionHeatByTag, upsertFactionHeat,
  getHighHeatFactions,

  // Knowledge Scope
  getKnowledgeScope, upsertKnowledgeScope,
}