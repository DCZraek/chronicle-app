// ═══════════════════════════════════════════════════════════
// CHRONICLE SERVER — Express web server
// Serves the UI and exposes storage.js as a REST API
// Replaces Electron's main.js + IPC bridge
// ═══════════════════════════════════════════════════════════

require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const path    = require('path')
const http    = require('http')

const storage = require('./storage')
const app     = express()

const PORT  = process.env.PORT || 3000
const TOKEN = process.env.CHRONICLE_TOKEN

if (!TOKEN) {
  console.error('ERROR: CHRONICLE_TOKEN not set in .env — server will not start.')
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════

app.use(cors())
app.use(express.json())

// ── Auth ─────────────────────────────────────────────────
// Every request must carry the token in the Authorization header.
// Exception: the root HTML page itself (so the browser can load the UI)

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token === TOKEN) return next()
  res.status(403).json({ error: 'Forbidden' })
}

// ── Static files ─────────────────────────────────────────
// Serve index.html from /public (we'll move it there during migration)
// For now serve from project root so nothing breaks immediately
app.use(express.static(path.join(__dirname, 'public')))
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// ── TTS Proxy ─────────────────────────────────────────────
// Forwards audio requests to Kokoro running on localhost:5050
// Auth required — this keeps the TTS endpoint locked too

app.post('/api/tts', requireAuth, express.raw({ type: '*/*', limit: '10mb' }), (req, res) => {
  const options = {
    hostname: 'localhost',
    port: 5050,
    path: '/tts',
    method: 'POST',
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'Content-Length': req.body.length
    }
  }
  const proxy = http.request(options, (kokoroRes) => {
    res.set('Content-Type', kokoroRes.headers['content-type'] || 'audio/wav')
    kokoroRes.pipe(res)
  })
  proxy.on('error', () => res.status(503).json({ error: 'TTS unavailable' }))
  proxy.write(req.body)
  proxy.end()
})

// ═══════════════════════════════════════════════════════════
// API ROUTES — all require auth
// Mirror every IPC handler from the old main.js exactly
// ═══════════════════════════════════════════════════════════

const api = express.Router()
api.use(requireAuth)

// ── Core — Games ─────────────────────────────────────────
api.get   ('/games',                  (req, res) => res.json(storage.listGames()))
api.get   ('/games/:id',              (req, res) => res.json(storage.getGame(req.params.id)))
api.post  ('/games',                  (req, res) => {
  storage.createGame(req.body)
  storage.initializeGameRows(req.body.id)
  res.json({ ok: true })
})
api.patch ('/games/:id/last-played',  (req, res) => {
  storage.updateGameLastPlayed(req.params.id)
  res.json({ ok: true })
})
api.patch ('/games/:id/agents',       (req, res) => {
  storage.updateGameAgents(req.params.id, req.body.power, req.body.enterprise)
  res.json({ ok: true })
})
api.delete('/games/:id',              (req, res) => {
  storage.deleteGame(req.params.id)
  res.json({ ok: true })
})

// ── Core — Files ─────────────────────────────────────────
api.get ('/games/:id/files',          (req, res) => res.json(storage.readAllFiles(req.params.id)))
api.get ('/games/:id/files/:name',    (req, res) => res.json(storage.readFile(req.params.id, req.params.name)))
api.post('/games/:id/files/:name',    (req, res) => {
  storage.writeFile(req.params.id, req.params.name, req.body.content)
  res.json({ ok: true })
})

// ── Session Memory ────────────────────────────────────────
api.get ('/games/:id/compression',         (req, res) => res.json(storage.getCompressionLog(req.params.id)))
api.post('/games/:id/compression',         (req, res) => {
  storage.appendCompressionEntry(req.params.id, req.body.mechanical, req.body.literary)
  res.json({ ok: true })
})
api.get ('/games/:id/chronicle-log',       (req, res) => res.json(storage.getChronicleLog(req.params.id)))
api.post('/games/:id/chronicle-log',       (req, res) => {
  storage.appendChronicleEntry(req.params.id, req.body.entry)
  res.json({ ok: true })
})

// ── Passive — Character ───────────────────────────────────
api.get  ('/games/:id/character',     (req, res) => res.json(storage.getCharacter(req.params.id)))
api.patch('/games/:id/character',     (req, res) => {
  storage.upsertCharacter(req.params.id, req.body)
  res.json({ ok: true })
})

// ── Passive — NPCs ────────────────────────────────────────
api.get   ('/games/:id/npcs',         (req, res) => res.json(storage.getNpcs(req.params.id)))
api.get   ('/games/:id/npcs/:name',   (req, res) => res.json(storage.getNpc(req.params.id, req.params.name)))
api.post  ('/games/:id/npcs',         (req, res) => {
  storage.upsertNpc(req.params.id, req.body)
  res.json({ ok: true })
})
api.delete('/games/:id/npcs/:name',   (req, res) => {
  storage.deleteNpc(req.params.id, req.params.name)
  res.json({ ok: true })
})

// ── Passive — Threads ─────────────────────────────────────
api.get ('/games/:id/threads',        (req, res) => res.json(storage.getThreads(req.params.id, req.query.status)))
api.get ('/games/:id/threads/:tid',   (req, res) => res.json(storage.getThread(req.params.id, req.params.tid)))
api.post('/games/:id/threads',        (req, res) => {
  storage.upsertThread(req.params.id, req.body)
  res.json({ ok: true })
})

// ── Passive — World ───────────────────────────────────────
api.get  ('/games/:id/world',         (req, res) => res.json(storage.getWorldOverview(req.params.id)))
api.patch('/games/:id/world',         (req, res) => {
  storage.upsertWorldOverview(req.params.id, req.body)
  res.json({ ok: true })
})

// ── Passive — Locations ───────────────────────────────────
api.get ('/games/:id/locations',           (req, res) => res.json(storage.getLocations(req.params.id)))
api.get ('/games/:id/locations/:name',     (req, res) => res.json(storage.getLocation(req.params.id, req.params.name)))
api.post('/games/:id/locations',           (req, res) => {
  storage.upsertLocation(req.params.id, req.body)
  res.json({ ok: true })
})

// ── Passive — Factions ────────────────────────────────────
api.get ('/games/:id/factions',            (req, res) => res.json(storage.getFactions(req.params.id)))
api.get ('/games/:id/factions/:name',      (req, res) => res.json(storage.getFaction(req.params.id, req.params.name)))
api.post('/games/:id/factions',            (req, res) => {
  storage.upsertFaction(req.params.id, req.body)
  res.json({ ok: true })
})

// ── Passive — Mechanics ───────────────────────────────────
api.get ('/games/:id/mechanics',           (req, res) => res.json(storage.getMechanics(req.params.id)))
api.get ('/games/:id/mechanics/:name',     (req, res) => res.json(storage.getMechanic(req.params.id, req.params.name)))
api.post('/games/:id/mechanics',           (req, res) => {
  storage.upsertMechanic(req.params.id, req.body)
  res.json({ ok: true })
})

// ── Power Agent ───────────────────────────────────────────
api.get  ('/games/:id/power/authority',            (req, res) => res.json(storage.getPowerAuthority(req.params.id)))
api.patch('/games/:id/power/authority',            (req, res) => { storage.upsertPowerAuthority(req.params.id, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/power/units',                (req, res) => res.json(storage.getPowerUnits(req.params.id)))
api.post ('/games/:id/power/units',                (req, res) => { storage.upsertPowerUnit(req.params.id, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/power/relationships',        (req, res) => res.json(storage.getPowerRelationships(req.params.id)))
api.post ('/games/:id/power/relationships',        (req, res) => { storage.upsertPowerRelationship(req.params.id, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/power/obligations',          (req, res) => res.json(storage.getPowerObligations(req.params.id)))
api.post ('/games/:id/power/obligations',          (req, res) => { storage.upsertPowerObligation(req.params.id, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/power/holdings',             (req, res) => res.json(storage.getPowerHoldings(req.params.id)))
api.post ('/games/:id/power/holdings',             (req, res) => { storage.upsertPowerHolding(req.params.id, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/power/resources',            (req, res) => res.json(storage.getPowerResources(req.params.id)))
api.post ('/games/:id/power/resources',            (req, res) => { storage.upsertPowerResource(req.params.id, req.body.type, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/power/intelligence',         (req, res) => res.json(storage.getPowerIntelligence(req.params.id)))
api.post ('/games/:id/power/intelligence',         (req, res) => { storage.addPowerIntelligence(req.params.id, req.body); res.json({ ok: true }) })

// ── Enterprise Agent ──────────────────────────────────────
api.get  ('/games/:id/enterprise',                 (req, res) => res.json(storage.getEnterprise(req.params.id)))
api.patch('/games/:id/enterprise',                 (req, res) => { storage.upsertEnterprise(req.params.id, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/enterprise/inventory',       (req, res) => res.json(storage.getInventory(req.params.id)))
api.post ('/games/:id/enterprise/inventory',       (req, res) => { storage.upsertInventoryItem(req.params.id, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/enterprise/routes',          (req, res) => res.json(storage.getRoutes(req.params.id)))
api.post ('/games/:id/enterprise/routes',          (req, res) => { storage.upsertRoute(req.params.id, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/enterprise/markets',         (req, res) => res.json(storage.getMarkets(req.params.id)))
api.post ('/games/:id/enterprise/markets',         (req, res) => { storage.upsertMarket(req.params.id, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/enterprise/contracts',       (req, res) => res.json(storage.getContracts(req.params.id, req.query.status)))
api.post ('/games/:id/enterprise/contracts',       (req, res) => { storage.upsertContract(req.params.id, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/enterprise/employees',       (req, res) => res.json(storage.getEmployees(req.params.id)))
api.post ('/games/:id/enterprise/employees',       (req, res) => { storage.upsertEmployee(req.params.id, req.body); res.json({ ok: true }) })
api.get  ('/games/:id/enterprise/ledger',          (req, res) => res.json(storage.getLedger(req.params.id, req.query.limit)))
api.post ('/games/:id/enterprise/ledger',          (req, res) => { storage.appendLedgerEntry(req.params.id, req.body); res.json({ ok: true }) })

// ── Event Queue ───────────────────────────────────────────
api.get ('/games/:id/events',         (req, res) => res.json(storage.getQueuedEvents(req.params.id)))
api.post('/games/:id/events',         (req, res) => { storage.addEvent(req.params.id, req.body); res.json({ ok: true }) })
api.patch('/events/:eid/status',      (req, res) => {
  storage.updateEventStatus(req.params.eid, req.body.status, req.body.reason)
  res.json({ ok: true })
})
api.post('/games/:id/events/escalate',(req, res) => {
  storage.escalateEvents(req.params.id, req.body)
  res.json({ ok: true })
})

// ── System — Clock ────────────────────────────────────────
api.get  ('/games/:id/clock',         (req, res) => res.json(storage.getGameClock(req.params.id)))
api.patch('/games/:id/clock',         (req, res) => {
  storage.upsertGameClock(req.params.id, req.body)
  res.json({ ok: true })
})

// ── System — Agent Settings ───────────────────────────────
api.get  ('/games/:id/agent-settings',(req, res) => res.json(storage.getAgentSettings(req.params.id)))
api.patch('/games/:id/agent-settings',(req, res) => {
  storage.upsertAgentSettings(req.params.id, req.body)
  res.json({ ok: true })
})

// ── System — Sync Log ─────────────────────────────────────
api.post('/games/:id/sync-log',       (req, res) => {
  storage.appendSyncEntry(req.params.id, req.body)
  res.json({ ok: true })
})
api.get ('/games/:id/sync-log',       (req, res) => res.json(storage.getRecentSyncLog(req.params.id, req.query.limit)))

// ── Mount all API routes under /api ───────────────────────
app.use('/api', api)

// ═══════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`Chronicle server running on http://localhost:${PORT}`)
  console.log('Token auth active — keep your .env file private')
})