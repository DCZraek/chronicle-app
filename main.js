const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let storage = null
let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'The Chronicle',
    backgroundColor: '#0d0b08',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
  win.setMenuBarVisibility(false)
}

app.whenReady().then(() => {
  // Load storage after app is ready so app.getPath works
  storage = require('./storage')

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ═══════════════════════════════════════════════════════════
// IPC HANDLERS — bridge between renderer and storage
// ═══════════════════════════════════════════════════════════

// ── Core — Games ─────────────────────────────────────────
ipcMain.handle('listGames',            () => storage.listGames())
ipcMain.handle('getGame',              (e, id) => storage.getGame(id))
ipcMain.handle('createGame',           (e, game) => {
  storage.createGame(game)
  storage.initializeGameRows(game.id)  // seed default rows for all agents
})
ipcMain.handle('updateGameLastPlayed', (e, id) => storage.updateGameLastPlayed(id))
ipcMain.handle('updateGameAgents',     (e, id, power, enterprise) => storage.updateGameAgents(id, power, enterprise))
ipcMain.handle('deleteGame',           (e, id) => storage.deleteGame(id))

// ── Core — Files ─────────────────────────────────────────
ipcMain.handle('readFile',     (e, gameId, fileName) => storage.readFile(gameId, fileName))
ipcMain.handle('writeFile',    (e, gameId, fileName, content) => storage.writeFile(gameId, fileName, content))
ipcMain.handle('readAllFiles', (e, gameId) => storage.readAllFiles(gameId))

// ── Session Memory ────────────────────────────────────────
ipcMain.handle('getCompressionLog',       (e, gameId) => storage.getCompressionLog(gameId))
ipcMain.handle('appendCompressionEntry',  (e, gameId, mechanical, literary) => storage.appendCompressionEntry(gameId, mechanical, literary))
ipcMain.handle('getChronicleLog',         (e, gameId) => storage.getChronicleLog(gameId))
ipcMain.handle('appendChronicleEntry',    (e, gameId, entry) => storage.appendChronicleEntry(gameId, entry))

// ── Passive — Character ───────────────────────────────────
ipcMain.handle('getCharacter',    (e, gameId) => storage.getCharacter(gameId))
ipcMain.handle('upsertCharacter', (e, gameId, fields) => storage.upsertCharacter(gameId, fields))

// ── Passive — NPCs ────────────────────────────────────────
ipcMain.handle('getNpcs',    (e, gameId) => storage.getNpcs(gameId))
ipcMain.handle('getNpc',     (e, gameId, name) => storage.getNpc(gameId, name))
ipcMain.handle('upsertNpc',  (e, gameId, fields) => storage.upsertNpc(gameId, fields))
ipcMain.handle('deleteNpc',  (e, gameId, name) => storage.deleteNpc(gameId, name))

// ── Passive — Threads ─────────────────────────────────────
ipcMain.handle('getThreads',   (e, gameId, status) => storage.getThreads(gameId, status))
ipcMain.handle('getThread',    (e, gameId, id) => storage.getThread(gameId, id))
ipcMain.handle('upsertThread', (e, gameId, fields) => storage.upsertThread(gameId, fields))

// ── Passive — World ───────────────────────────────────────
ipcMain.handle('getWorldOverview',    (e, gameId) => storage.getWorldOverview(gameId))
ipcMain.handle('upsertWorldOverview', (e, gameId, fields) => storage.upsertWorldOverview(gameId, fields))

// ── Passive — Locations ───────────────────────────────────
ipcMain.handle('getLocations',   (e, gameId) => storage.getLocations(gameId))
ipcMain.handle('getLocation',    (e, gameId, name) => storage.getLocation(gameId, name))
ipcMain.handle('upsertLocation', (e, gameId, fields) => storage.upsertLocation(gameId, fields))

// ── Passive — Factions ────────────────────────────────────
ipcMain.handle('getFactions',   (e, gameId) => storage.getFactions(gameId))
ipcMain.handle('getFaction',    (e, gameId, name) => storage.getFaction(gameId, name))
ipcMain.handle('upsertFaction', (e, gameId, fields) => storage.upsertFaction(gameId, fields))

// ── Passive — Mechanics ───────────────────────────────────
ipcMain.handle('getMechanics',   (e, gameId) => storage.getMechanics(gameId))
ipcMain.handle('getMechanic',    (e, gameId, name) => storage.getMechanic(gameId, name))
ipcMain.handle('upsertMechanic', (e, gameId, fields) => storage.upsertMechanic(gameId, fields))

// ── Power Agent ───────────────────────────────────────────
ipcMain.handle('getPowerAuthority',       (e, gameId) => storage.getPowerAuthority(gameId))
ipcMain.handle('upsertPowerAuthority',    (e, gameId, fields) => storage.upsertPowerAuthority(gameId, fields))
ipcMain.handle('getPowerUnits',           (e, gameId) => storage.getPowerUnits(gameId))
ipcMain.handle('upsertPowerUnit',         (e, gameId, fields) => storage.upsertPowerUnit(gameId, fields))
ipcMain.handle('getPowerRelationships',   (e, gameId) => storage.getPowerRelationships(gameId))
ipcMain.handle('upsertPowerRelationship', (e, gameId, fields) => storage.upsertPowerRelationship(gameId, fields))
ipcMain.handle('getPowerObligations',     (e, gameId) => storage.getPowerObligations(gameId))
ipcMain.handle('upsertPowerObligation',   (e, gameId, fields) => storage.upsertPowerObligation(gameId, fields))
ipcMain.handle('getPowerHoldings',        (e, gameId) => storage.getPowerHoldings(gameId))
ipcMain.handle('upsertPowerHolding',      (e, gameId, fields) => storage.upsertPowerHolding(gameId, fields))
ipcMain.handle('getPowerResources',       (e, gameId) => storage.getPowerResources(gameId))
ipcMain.handle('upsertPowerResource',     (e, gameId, type, fields) => storage.upsertPowerResource(gameId, type, fields))
ipcMain.handle('getPowerIntelligence',    (e, gameId) => storage.getPowerIntelligence(gameId))
ipcMain.handle('addPowerIntelligence',    (e, gameId, fields) => storage.addPowerIntelligence(gameId, fields))

// ── Enterprise Agent ──────────────────────────────────────
ipcMain.handle('getEnterprise',       (e, gameId) => storage.getEnterprise(gameId))
ipcMain.handle('upsertEnterprise',    (e, gameId, fields) => storage.upsertEnterprise(gameId, fields))
ipcMain.handle('getInventory',        (e, gameId) => storage.getInventory(gameId))
ipcMain.handle('upsertInventoryItem', (e, gameId, fields) => storage.upsertInventoryItem(gameId, fields))
ipcMain.handle('getRoutes',           (e, gameId) => storage.getRoutes(gameId))
ipcMain.handle('upsertRoute',         (e, gameId, fields) => storage.upsertRoute(gameId, fields))
ipcMain.handle('getMarkets',          (e, gameId) => storage.getMarkets(gameId))
ipcMain.handle('upsertMarket',        (e, gameId, fields) => storage.upsertMarket(gameId, fields))
ipcMain.handle('getContracts',        (e, gameId, status) => storage.getContracts(gameId, status))
ipcMain.handle('upsertContract',      (e, gameId, fields) => storage.upsertContract(gameId, fields))
ipcMain.handle('getEmployees',        (e, gameId) => storage.getEmployees(gameId))
ipcMain.handle('upsertEmployee',      (e, gameId, fields) => storage.upsertEmployee(gameId, fields))
ipcMain.handle('getLedger',           (e, gameId, limit) => storage.getLedger(gameId, limit))
ipcMain.handle('appendLedgerEntry',   (e, gameId, fields) => storage.appendLedgerEntry(gameId, fields))

// ── Event Queue ───────────────────────────────────────────
ipcMain.handle('getQueuedEvents',   (e, gameId) => storage.getQueuedEvents(gameId))
ipcMain.handle('addEvent',          (e, gameId, fields) => storage.addEvent(gameId, fields))
ipcMain.handle('updateEventStatus', (e, eventId, status, reason) => storage.updateEventStatus(eventId, status, reason))
ipcMain.handle('escalateEvents',    (e, gameId, settings) => storage.escalateEvents(gameId, settings))

// ── System — Clock ────────────────────────────────────────
ipcMain.handle('getGameClock',    (e, gameId) => storage.getGameClock(gameId))
ipcMain.handle('upsertGameClock', (e, gameId, fields) => storage.upsertGameClock(gameId, fields))

// ── System — Agent Settings ───────────────────────────────
ipcMain.handle('getAgentSettings',    (e, gameId) => storage.getAgentSettings(gameId))
ipcMain.handle('upsertAgentSettings', (e, gameId, fields) => storage.upsertAgentSettings(gameId, fields))

// ── System — Sync Log ─────────────────────────────────────
ipcMain.handle('appendSyncEntry',   (e, gameId, fields) => storage.appendSyncEntry(gameId, fields))
ipcMain.handle('getRecentSyncLog',  (e, gameId, limit) => storage.getRecentSyncLog(gameId, limit))