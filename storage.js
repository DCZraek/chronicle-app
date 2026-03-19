const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')

// ═══════════════════════════════════════════════════════════
// STORAGE — Local SQLite database for Chronicle saves
// Lives at ~/Chronicle/chronicle.db
// ═══════════════════════════════════════════════════════════

const DATA_DIR = path.join(app.getPath('home'), 'Chronicle')
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

`)

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
}