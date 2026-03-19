const { contextBridge, ipcRenderer } = require('electron')

// ═══════════════════════════════════════════════════════════
// PRELOAD — Securely exposes storage functions to the renderer
// index.html calls window.chronicle.* to access local storage
// ═══════════════════════════════════════════════════════════

contextBridge.exposeInMainWorld('chronicle', {

  // ── Core — Games ───────────────────────────────────────
  listGames:            ()                              => ipcRenderer.invoke('listGames'),
  getGame:              (id)                            => ipcRenderer.invoke('getGame', id),
  createGame:           (game)                          => ipcRenderer.invoke('createGame', game),
  updateGameLastPlayed: (id)                            => ipcRenderer.invoke('updateGameLastPlayed', id),
  updateGameAgents:     (id, power, enterprise)         => ipcRenderer.invoke('updateGameAgents', id, power, enterprise),
  deleteGame:           (id)                            => ipcRenderer.invoke('deleteGame', id),

  // ── Core — Files ───────────────────────────────────────
  readFile:             (gameId, fileName)              => ipcRenderer.invoke('readFile', gameId, fileName),
  writeFile:            (gameId, fileName, content)     => ipcRenderer.invoke('writeFile', gameId, fileName, content),
  readAllFiles:         (gameId)                        => ipcRenderer.invoke('readAllFiles', gameId),

  // ── Session Memory ─────────────────────────────────────
  getCompressionLog:       (gameId)                        => ipcRenderer.invoke('getCompressionLog', gameId),
  appendCompressionEntry:  (gameId, mechanical, literary)  => ipcRenderer.invoke('appendCompressionEntry', gameId, mechanical, literary),
  getChronicleLog:         (gameId)                        => ipcRenderer.invoke('getChronicleLog', gameId),
  appendChronicleEntry:    (gameId, entry)                 => ipcRenderer.invoke('appendChronicleEntry', gameId, entry),

  // ── Passive — Character ────────────────────────────────
  getCharacter:            (gameId)                        => ipcRenderer.invoke('getCharacter', gameId),
  upsertCharacter:         (gameId, fields)                => ipcRenderer.invoke('upsertCharacter', gameId, fields),

  // ── Passive — NPCs ─────────────────────────────────────
  getNpcs:                 (gameId)                        => ipcRenderer.invoke('getNpcs', gameId),
  getNpc:                  (gameId, name)                  => ipcRenderer.invoke('getNpc', gameId, name),
  upsertNpc:               (gameId, fields)                => ipcRenderer.invoke('upsertNpc', gameId, fields),
  deleteNpc:               (gameId, name)                  => ipcRenderer.invoke('deleteNpc', gameId, name),

  // ── Passive — Threads ──────────────────────────────────
  getThreads:              (gameId, status)                => ipcRenderer.invoke('getThreads', gameId, status),
  getThread:               (gameId, id)                    => ipcRenderer.invoke('getThread', gameId, id),
  upsertThread:            (gameId, fields)                => ipcRenderer.invoke('upsertThread', gameId, fields),

  // ── Passive — World ────────────────────────────────────
  getWorldOverview:        (gameId)                        => ipcRenderer.invoke('getWorldOverview', gameId),
  upsertWorldOverview:     (gameId, fields)                => ipcRenderer.invoke('upsertWorldOverview', gameId, fields),

  // ── Passive — Locations ────────────────────────────────
  getLocations:            (gameId)                        => ipcRenderer.invoke('getLocations', gameId),
  getLocation:             (gameId, name)                  => ipcRenderer.invoke('getLocation', gameId, name),
  upsertLocation:          (gameId, fields)                => ipcRenderer.invoke('upsertLocation', gameId, fields),

  // ── Passive — Factions ─────────────────────────────────
  getFactions:             (gameId)                        => ipcRenderer.invoke('getFactions', gameId),
  getFaction:              (gameId, name)                  => ipcRenderer.invoke('getFaction', gameId, name),
  upsertFaction:           (gameId, fields)                => ipcRenderer.invoke('upsertFaction', gameId, fields),

  // ── Passive — Mechanics ────────────────────────────────
  getMechanics:            (gameId)                        => ipcRenderer.invoke('getMechanics', gameId),
  getMechanic:             (gameId, name)                  => ipcRenderer.invoke('getMechanic', gameId, name),
  upsertMechanic:          (gameId, fields)                => ipcRenderer.invoke('upsertMechanic', gameId, fields),

  // ── Power Agent ────────────────────────────────────────
  getPowerAuthority:       (gameId)                        => ipcRenderer.invoke('getPowerAuthority', gameId),
  upsertPowerAuthority:    (gameId, fields)                => ipcRenderer.invoke('upsertPowerAuthority', gameId, fields),
  getPowerUnits:           (gameId)                        => ipcRenderer.invoke('getPowerUnits', gameId),
  upsertPowerUnit:         (gameId, fields)                => ipcRenderer.invoke('upsertPowerUnit', gameId, fields),
  getPowerRelationships:   (gameId)                        => ipcRenderer.invoke('getPowerRelationships', gameId),
  upsertPowerRelationship: (gameId, fields)                => ipcRenderer.invoke('upsertPowerRelationship', gameId, fields),
  getPowerObligations:     (gameId)                        => ipcRenderer.invoke('getPowerObligations', gameId),
  upsertPowerObligation:   (gameId, fields)                => ipcRenderer.invoke('upsertPowerObligation', gameId, fields),
  getPowerHoldings:        (gameId)                        => ipcRenderer.invoke('getPowerHoldings', gameId),
  upsertPowerHolding:      (gameId, fields)                => ipcRenderer.invoke('upsertPowerHolding', gameId, fields),
  getPowerResources:       (gameId)                        => ipcRenderer.invoke('getPowerResources', gameId),
  upsertPowerResource:     (gameId, type, fields)          => ipcRenderer.invoke('upsertPowerResource', gameId, type, fields),
  getPowerIntelligence:    (gameId)                        => ipcRenderer.invoke('getPowerIntelligence', gameId),
  addPowerIntelligence:    (gameId, fields)                => ipcRenderer.invoke('addPowerIntelligence', gameId, fields),

  // ── Enterprise Agent ───────────────────────────────────
  getEnterprise:           (gameId)                        => ipcRenderer.invoke('getEnterprise', gameId),
  upsertEnterprise:        (gameId, fields)                => ipcRenderer.invoke('upsertEnterprise', gameId, fields),
  getInventory:            (gameId)                        => ipcRenderer.invoke('getInventory', gameId),
  upsertInventoryItem:     (gameId, fields)                => ipcRenderer.invoke('upsertInventoryItem', gameId, fields),
  getRoutes:               (gameId)                        => ipcRenderer.invoke('getRoutes', gameId),
  upsertRoute:             (gameId, fields)                => ipcRenderer.invoke('upsertRoute', gameId, fields),
  getMarkets:              (gameId)                        => ipcRenderer.invoke('getMarkets', gameId),
  upsertMarket:            (gameId, fields)                => ipcRenderer.invoke('upsertMarket', gameId, fields),
  getContracts:            (gameId, status)                => ipcRenderer.invoke('getContracts', gameId, status),
  upsertContract:          (gameId, fields)                => ipcRenderer.invoke('upsertContract', gameId, fields),
  getEmployees:            (gameId)                        => ipcRenderer.invoke('getEmployees', gameId),
  upsertEmployee:          (gameId, fields)                => ipcRenderer.invoke('upsertEmployee', gameId, fields),
  getLedger:               (gameId, limit)                 => ipcRenderer.invoke('getLedger', gameId, limit),
  appendLedgerEntry:       (gameId, fields)                => ipcRenderer.invoke('appendLedgerEntry', gameId, fields),

  // ── Event Queue ────────────────────────────────────────
  getQueuedEvents:         (gameId)                        => ipcRenderer.invoke('getQueuedEvents', gameId),
  addEvent:                (gameId, fields)                => ipcRenderer.invoke('addEvent', gameId, fields),
  updateEventStatus:       (eventId, status, reason)       => ipcRenderer.invoke('updateEventStatus', eventId, status, reason),
  escalateEvents:          (gameId, settings)              => ipcRenderer.invoke('escalateEvents', gameId, settings),

  // ── System — Clock ─────────────────────────────────────
  getGameClock:            (gameId)                        => ipcRenderer.invoke('getGameClock', gameId),
  upsertGameClock:         (gameId, fields)                => ipcRenderer.invoke('upsertGameClock', gameId, fields),

  // ── System — Agent Settings ────────────────────────────
  getAgentSettings:        (gameId)                        => ipcRenderer.invoke('getAgentSettings', gameId),
  upsertAgentSettings:     (gameId, fields)                => ipcRenderer.invoke('upsertAgentSettings', gameId, fields),

  // ── System — Sync Log ──────────────────────────────────
  appendSyncEntry:         (gameId, fields)                => ipcRenderer.invoke('appendSyncEntry', gameId, fields),
  getRecentSyncLog:        (gameId, limit)                 => ipcRenderer.invoke('getRecentSyncLog', gameId, limit),

})