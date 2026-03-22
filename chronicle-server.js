// ═══════════════════════════════════════════════════════════
// CHRONICLE SERVER — Express web server
// Serves the UI and exposes storage.js as a REST API
// Express server + REST API + token auth
// ═══════════════════════════════════════════════════════════

require('dotenv').config()
const express   = require('express')
const cors      = require('cors')
const path      = require('path')
const http      = require('http')
const fs        = require('fs')

const storage   = require('./storage')
const agents    = require('./agents')
const heuristics = require('./heuristics')
const app       = express()

const PORT  = process.env.PORT || 3000
const TOKEN = process.env.CHRONICLE_TOKEN

if (!TOKEN) {
  console.error('ERROR: CHRONICLE_TOKEN not set in .env — server will not start.')
  process.exit(1)
}

let NARRATOR_PROMPT = ''
try {
  NARRATOR_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts/narrator_prompt.txt'), 'utf8')
  console.log('Narrator prompt loaded.')
} catch (e) {
  console.warn('Warning: narrator_prompt.txt not found — narrator calls will use empty system prompt')
}

// ═══════════════════════════════════════════════════════════
// NARRATOR PROVIDER HELPERS
// ═══════════════════════════════════════════════════════════

async function callAnthropicNarrator(systemPrompt, messages, model, apiKey, maxTokens) {
  const body = {
    model:      model || 'claude-opus-4-6',
    max_tokens: maxTokens,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral', ttl: '1h' } }],
    messages
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'x-api-key':        apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta':   'extended-cache-ttl-2025-04-11',
      'content-type':     'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Anthropic API error ${res.status}`)
  }
  const data = await res.json()
  return data.content[0].text
}

async function callOllamaNarrator(systemPrompt, messages, model, endpoint, maxTokens) {
  const res = await fetch(`${endpoint || 'http://localhost:11434'}/api/chat`, {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model:   model || 'llama3.1:8b',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream:  false,
      options: { num_predict: maxTokens, temperature: 0.7 }
    })
  })
  if (!res.ok) throw new Error(`Ollama error ${res.status}`)
  const data = await res.json()
  return data.message?.content || ''
}

async function callCustomNarrator(systemPrompt, messages, model, endpoint, apiKey, maxTokens) {
  const headers = { 'content-type': 'application/json' }
  if (apiKey) headers['authorization'] = `Bearer ${apiKey}`
  const res = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    })
  })
  if (!res.ok) throw new Error(`Custom provider error ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function callNarratorProvider(systemPrompt, messages, provider, model, apiKey, endpoint, maxTokens = 2048, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (provider === 'anthropic') {
        return await callAnthropicNarrator(systemPrompt, messages, model, apiKey, maxTokens)
      } else if (provider === 'ollama') {
        return await callOllamaNarrator(systemPrompt, messages, model, endpoint, maxTokens)
      } else {
        return await callCustomNarrator(systemPrompt, messages, model, endpoint, apiKey, maxTokens)
      }
    } catch (e) {
      if (attempt === retries) throw e
      await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
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
// Serves the UI from /public
app.use(express.static(path.join(__dirname, 'public')))
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// ── TTS Proxy ─────────────────────────────────────────────
// Forwards audio requests to Kokoro running on localhost:5050
// Auth required — this keeps the TTS endpoint locked too

app.post('/api/tts', requireAuth, (req, res) => {
  const body = JSON.stringify(req.body)
  const options = {
    hostname: 'localhost',
    port: 5050,
    path: '/tts',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    }
  }
  const proxy = http.request(options, (kokoroRes) => {
    res.set('Content-Type', kokoroRes.headers['content-type'] || 'audio/wav')
    kokoroRes.pipe(res)
  })
  proxy.on('error', () => res.status(503).json({ error: 'TTS unavailable' }))
  proxy.write(body)
  proxy.end()
})

// ── TTS Health Proxy ──────────────────────────────────────
app.get('/api/tts/health', requireAuth, (req, res) => {
  const options = {
    hostname: 'localhost',
    port: 5050,
    path: '/health',
    method: 'GET',
  }
  const proxy = http.request(options, (kokoroRes) => {
    res.status(kokoroRes.statusCode).json({ ok: kokoroRes.statusCode === 200 })
  })
  proxy.on('error', () => res.status(503).json({ ok: false }))
  proxy.end()
})

// ═══════════════════════════════════════════════════════════
// API ROUTES — all require auth
// One endpoint per storage function
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
api.get ('/games/:id/sync-log',       (req, res) => res.json(storage.getRecentSyncLog(req.params.id, req.query.n || req.query.limit || 5)))

// ── Phase 1 — Tags ────────────────────────────────────────
api.get   ('/games/:id/tags',                       (req, res) => res.json(storage.getTags(req.params.id)))
api.get   ('/games/:id/tags/alias/:alias',           (req, res) => res.json(storage.getTagByAlias(req.params.id, req.params.alias)))
api.get   ('/games/:id/ambient-index',              (req, res) => res.json(storage.getAmbientIndex(req.params.id)))
api.get   ('/games/:id/tags/:tagId',                (req, res) => res.json(storage.getTag(req.params.id, req.params.tagId)))
api.post  ('/games/:id/tags',                       (req, res) => { storage.upsertTag(req.params.id, req.body); res.json({ ok: true }) })
api.delete('/games/:id/tags/:tagId',                (req, res) => { storage.deleteTag(req.params.id, req.params.tagId); res.json({ ok: true }) })

// ── Phase 1 — Tag Aliases ─────────────────────────────────
api.get   ('/games/:id/tags/:tagId/aliases',        (req, res) => res.json(storage.getAliases(req.params.id, req.params.tagId)))
api.post  ('/games/:id/tags/:tagId/aliases',        (req, res) => { storage.addAlias(req.params.id, req.params.tagId, req.body.alias); res.json({ ok: true }) })
api.delete('/games/:id/aliases/:aliasId',           (req, res) => { storage.deleteAlias(req.params.id, req.params.aliasId); res.json({ ok: true }) })

// ── Phase 1 — Tag Relationships ───────────────────────────
api.get   ('/games/:id/relationships',              (req, res) => res.json(storage.getAllRelationships(req.params.id)))
api.get   ('/games/:id/tags/:tagId/relationships',  (req, res) => res.json(storage.getRelationships(req.params.id, req.params.tagId)))
api.post  ('/games/:id/relationships',              (req, res) => { storage.upsertRelationship(req.params.id, req.body); res.json({ ok: true }) })
api.delete('/games/:id/relationships/:relId',       (req, res) => { storage.deleteRelationship(req.params.id, req.params.relId); res.json({ ok: true }) })
api.post  ('/games/:id/tag-map',                    (req, res) => res.json(storage.getTagMap(req.params.id, req.body.tagIds)))

// ── Phase 1 — Pending Tags ────────────────────────────────
api.get   ('/games/:id/pending-tags',               (req, res) => res.json(storage.getPendingTags(req.params.id)))
api.post  ('/games/:id/pending-tags',               (req, res) => { storage.addPendingTag(req.params.id, req.body); res.json({ ok: true }) })
api.post  ('/games/:id/pending-tags/:ptId/confirm', (req, res) => { storage.confirmPendingTag(req.params.id, req.params.ptId); res.json({ ok: true }) })
api.delete('/games/:id/pending-tags/:ptId',         (req, res) => { storage.dismissPendingTag(req.params.id, req.params.ptId); res.json({ ok: true }) })

// ── Phase 1 — Pending Relationships ──────────────────────
api.get   ('/games/:id/pending-relationships',               (req, res) => res.json(storage.getPendingRelationships(req.params.id)))
api.post  ('/games/:id/pending-relationships',               (req, res) => { storage.addPendingRelationship(req.params.id, req.body); res.json({ ok: true }) })
api.post  ('/games/:id/pending-relationships/:prId/confirm', (req, res) => { storage.confirmPendingRelationship(req.params.id, req.params.prId); res.json({ ok: true }) })
api.delete('/games/:id/pending-relationships/:prId',         (req, res) => { storage.dismissPendingRelationship(req.params.id, req.params.prId); res.json({ ok: true }) })

// ── Phase 1 — Game State (game_mechanics) ─────────────────
api.get  ('/games/:id/game-state',  (req, res) => res.json(storage.getGameMechanics(req.params.id)))
api.patch('/games/:id/game-state',  (req, res) => { storage.upsertGameMechanics(req.params.id, req.body); res.json({ ok: true }) })

// ── Phase 1 — Skill Ranks ─────────────────────────────────
api.get ('/games/:id/skills',       (req, res) => res.json(storage.getSkillRanks(req.params.id)))
api.get ('/games/:id/skills/:name', (req, res) => res.json(storage.getSkillRank(req.params.id, req.params.name)))
api.post('/games/:id/skills',       (req, res) => { storage.upsertSkillRank(req.params.id, req.body); res.json({ ok: true }) })

// ── Phase 1 — Difficulty Tracker ──────────────────────────
api.get  ('/games/:id/difficulty',  (req, res) => res.json(storage.getDifficultyTracker(req.params.id)))
api.patch('/games/:id/difficulty',  (req, res) => { storage.upsertDifficultyTracker(req.params.id, req.body); res.json({ ok: true }) })

// ── Phase 1 — Environmental State ─────────────────────────
api.get  ('/games/:id/environment', (req, res) => res.json(storage.getEnvironmentalState(req.params.id)))
api.patch('/games/:id/environment', (req, res) => { storage.upsertEnvironmentalState(req.params.id, req.body); res.json({ ok: true }) })

// ── Phase 1 — Milestone Log ───────────────────────────────
api.get ('/games/:id/milestones',   (req, res) => res.json(storage.getMilestones(req.params.id)))
api.post('/games/:id/milestones',   (req, res) => { storage.addMilestone(req.params.id, req.body); res.json({ ok: true }) })

// ── Phase 1 — Companion State ─────────────────────────────
api.get ('/games/:id/companions',           (req, res) => res.json(storage.getCompanionStates(req.params.id)))
api.get ('/games/:id/companions/:tagId',    (req, res) => res.json(storage.getCompanionState(req.params.id, req.params.tagId)))
api.post('/games/:id/companions',           (req, res) => { storage.upsertCompanionState(req.params.id, req.body); res.json({ ok: true }) })

// ── Phase 1 — Consequence Ledger ──────────────────────────
api.get   ('/games/:id/consequences',                  (req, res) => res.json(storage.getOpenConsequences(req.params.id)))
api.post  ('/games/:id/consequences',                  (req, res) => { storage.addConsequence(req.params.id, req.body); res.json({ ok: true }) })
api.patch ('/games/:id/consequences/:cId/surface',     (req, res) => { storage.surfaceConsequence(req.params.id, req.params.cId); res.json({ ok: true }) })
api.delete('/games/:id/consequences/:cId',             (req, res) => { storage.dismissConsequence(req.params.id, req.params.cId); res.json({ ok: true }) })

// ── Phase 1 — Pending Flags ───────────────────────────────
api.get   ('/games/:id/flags',        (req, res) => res.json(storage.getPendingFlags(req.params.id)))
api.post  ('/games/:id/flags',        (req, res) => { storage.addPendingFlag(req.params.id, req.body); res.json({ ok: true }) })
api.delete('/games/:id/flags/:fId',   (req, res) => { storage.dismissFlag(req.params.id, req.params.fId, req.body.reason); res.json({ ok: true }) })

// ── Phase 1 — Faction Heat ────────────────────────────────
api.get ('/games/:id/faction-heat',   (req, res) => res.json(storage.getFactionHeat(req.params.id)))
api.post('/games/:id/faction-heat',   (req, res) => { storage.upsertFactionHeat(req.params.id, req.body.tag_id, req.body.heat); res.json({ ok: true }) })

// ── Phase 1 — Knowledge Scope ─────────────────────────────
api.get ('/games/:id/knowledge-scope/:tagId', (req, res) => res.json(storage.getKnowledgeScope(req.params.id, req.params.tagId)))
api.post('/games/:id/knowledge-scope',        (req, res) => { storage.upsertKnowledgeScope(req.params.id, req.body); res.json({ ok: true }) })

// ── Phase 4 — Narrate ─────────────────────────────────────
// Main game loop endpoint. Handles one complete player exchange:
// 1. Build ambient index + mechanics context
// 2. First narrator call → DIRECT or NEEDS_AGENTS
// 3. If NEEDS_AGENTS: run agents, assemble brief, second call
// 4. Parse SCENE_TAGS, trigger sync pass in background
// 5. Return { response, narrativeOnly, sceneTagsBlock, routing, syncTriggered }

api.post('/narrate', async (req, res) => {
  const { gameId, messages, compressionLog, provider, model, apiKey, endpoint } = req.body

  if (!gameId)                                     return res.status(400).json({ error: 'gameId required' })
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages required' })

  const providerName = provider || 'anthropic'
  const modelName    = model    || 'claude-opus-4-6'
  const maxTokens    = 2048

  try {
    // Step 1: Build ambient index and mechanics state
    console.log('[Narrate] Step 1: Building context...')
    const ambientIndex   = heuristics.buildAmbientIndex(gameId)
    const mechanics      = storage.getGameMechanics(gameId)
    const effectiveRanks = heuristics.calculateEffectiveRanks(gameId)  // takes gameId, not mechanics object

    const mechanicsState = mechanics
      ? `[MECHANICS STATE]\ncombat_rank: ${effectiveRanks.effective.combat} (base: ${effectiveRanks.base.combat})\n` +
        `social_rank: ${effectiveRanks.effective.social} (base: ${effectiveRanks.base.social})\n` +
        `magic_rank: ${effectiveRanks.effective.magic} (base: ${effectiveRanks.base.magic})\n` +
        `wounds: ${mechanics.wound_slot_1}/${mechanics.wound_slot_2}/${mechanics.wound_slot_3}\n` +
        `wound_penalty: ${mechanics.wound_penalty}\n` +
        `coin: ${mechanics.coin} | rations: ${mechanics.rations} | ammo: ${mechanics.ammunition}`
      : ''

    // Step 2: Assemble first-call system prompt (narrator prompt + ambient index + mechanics)
    console.log('[Narrate] Step 2: Assembling context messages...')
    const systemWithContext = NARRATOR_PROMPT
      + (ambientIndex   ? '\n\n' + ambientIndex   : '')
      + (mechanicsState ? '\n\n' + mechanicsState : '')

    // Prepend compression log summary as context seed if present
    const contextMessages = []
    if (compressionLog && compressionLog.length > 0) {
      const recent = compressionLog[compressionLog.length - 1]
      const summary = [recent.mechanical, recent.literary].filter(Boolean).join('\n\n')
      if (summary) {
        contextMessages.push({ role: 'user',      content: `[SESSION SUMMARY]\n${summary}` })
        contextMessages.push({ role: 'assistant', content: '[Acknowledged. Continuing from here.]' })
      }
    }
    contextMessages.push(...messages)

    // Step 3: First narrator call — decides DIRECT or NEEDS_AGENTS
    console.log(`[Narrate] Step 3: Calling narrator (provider=${providerName}, model=${modelName}, messages=${contextMessages.length})...`)
    const firstResponse = await callNarratorProvider(
      systemWithContext, contextMessages, providerName, modelName, apiKey, endpoint, maxTokens
    )
    console.log(`[Narrate] Step 3 done: ${firstResponse.slice(0, 60).replace(/\n/g, ' ')}...`)

    // Step 4: Route based on response prefix
    let narrativeResponse
    let routing = 'DIRECT'

    if (firstResponse.trimStart().startsWith('[NEEDS_AGENTS]')) {
      routing = 'NEEDS_AGENTS'
      console.log('[Narrate] Step 4: Routing to NEEDS_AGENTS...')
      const intent = agents.parseIntent(firstResponse)

      if (intent) {
        // Step 5: Run agents in parallel, build brief
        console.log('[Narrate] Step 5: Running agents in parallel...')
        const agentResponses = await agents.runAgents(gameId, intent)
        const brief = agents.buildNarratorBrief(gameId, agentResponses, ambientIndex)

        // Step 6: Second narrator call with brief
        console.log('[Narrate] Step 6: Second narrator call with brief...')
        const briefMessages = [
          ...contextMessages,
          { role: 'assistant', content: firstResponse },
          { role: 'user',      content: brief }
        ]
        narrativeResponse = await callNarratorProvider(
          NARRATOR_PROMPT, briefMessages, providerName, modelName, apiKey, endpoint, maxTokens
        )
      } else {
        // Intent parse failed — treat first response as direct narrative
        console.log('[Narrate] Step 4: NEEDS_AGENTS intent parse failed — falling back to DIRECT')
        narrativeResponse = firstResponse
        routing = 'DIRECT'
      }
    } else {
      // DIRECT path — first response is the complete narrative
      console.log('[Narrate] Step 4: Routing DIRECT.')
      narrativeResponse = firstResponse
    }

    // Step 7: Extract SCENE_TAGS block from narrative
    console.log('[Narrate] Step 7: Extracting SCENE_TAGS...')
    const sceneTagsStart = narrativeResponse.indexOf('[SCENE_TAGS]')
    let narrativeOnly  = narrativeResponse
    let sceneTagsBlock = ''

    if (sceneTagsStart !== -1) {
      narrativeOnly  = narrativeResponse.slice(0, sceneTagsStart).trim()
      sceneTagsBlock = narrativeResponse.slice(sceneTagsStart)
    }

    // Step 8: Trigger sync pass in background (non-blocking — runs during TTS audio)
    let syncTriggered = false
    if (sceneTagsBlock) {
      syncTriggered = true
      console.log('[Narrate] Step 8: Triggering sync pass in background...')
      agents.runSyncPass(gameId, narrativeResponse, sceneTagsBlock).catch(err => {
        console.error('[Narrate] Sync pass error:', err.message)
      })
    }

    console.log(`[Narrate] Done. routing=${routing}, syncTriggered=${syncTriggered}, narrativeOnly length=${narrativeOnly.length}`)
    res.json({ response: narrativeResponse, narrativeOnly, sceneTagsBlock, routing, syncTriggered })

  } catch (err) {
    console.error('[Narrate] ERROR:', err.message)
    console.error('[Narrate] STACK:', err.stack)
    res.status(500).json({ error: err.message, stack: err.stack })
  }
})

// ── Mount all API routes under /api ───────────────────────
app.use('/api', api)

// ═══════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`Chronicle server running on http://localhost:${PORT}`)
  console.log('Token auth active — keep your .env file private')
})