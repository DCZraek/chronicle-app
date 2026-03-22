const storage    = require('./storage')
const heuristics = require('./heuristics')
const fs         = require('fs')
const path       = require('path')

// ═══════════════════════════════════════════════════════════
// AGENTS — Agent architecture for The Chronicle
// Orchestrates Ollama calls, tag detection, and the sync pass.
// Node.js v20 — uses built-in fetch.
// ═══════════════════════════════════════════════════════════

const OLLAMA_MODEL    = 'llama3.1:8b-instruct-q8_0'
const OLLAMA_ENDPOINT = 'http://localhost:11434/api/chat'

const PROMPTS = {
  character: fs.readFileSync(path.join(__dirname, 'prompts/agent_character.txt'), 'utf8'),
  npc:       fs.readFileSync(path.join(__dirname, 'prompts/agent_npc.txt'), 'utf8'),
  plot:      fs.readFileSync(path.join(__dirname, 'prompts/agent_plot.txt'), 'utf8'),
  world:     fs.readFileSync(path.join(__dirname, 'prompts/agent_world.txt'), 'utf8'),
  mechanics: fs.readFileSync(path.join(__dirname, 'prompts/agent_mechanics.txt'), 'utf8'),
  sync:      fs.readFileSync(path.join(__dirname, 'prompts/sync_prompt.txt'), 'utf8'),
}

// ─────────────────────────────────────────────────────────
// callOllama
// ─────────────────────────────────────────────────────────

async function callOllama(systemPrompt, userMessage, options = {}) {
  const body = {
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    stream: false,
    options: {
      temperature: options.temperature ?? 0.3,
      num_predict: options.max_tokens  ?? 1000,
    },
  }

  let res
  try {
    res = await fetch(OLLAMA_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
  } catch (err) {
    throw new Error(`Ollama unavailable at ${OLLAMA_ENDPOINT}: ${err.message}`)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama returned HTTP ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.message?.content ?? ''
}

// ─────────────────────────────────────────────────────────
// detectTags
// Scans player input for known tag aliases — no AI.
// ─────────────────────────────────────────────────────────

function detectTags(gameId, playerInput) {
  const allAliases = storage.db.prepare(
    'SELECT tag_id, alias FROM tag_aliases WHERE game_id = ?'
  ).all(gameId)

  const lower = playerInput.toLowerCase()
  const matched = new Set()

  for (const { tag_id, alias } of allAliases) {
    if (lower.includes(alias.toLowerCase())) {
      matched.add(tag_id)
    }
  }

  const detected_tag_ids = Array.from(matched)
  const detected_tags    = detected_tag_ids
    .map(id => storage.getTag(gameId, id))
    .filter(Boolean)

  return { detected_tag_ids, detected_tags }
}

// ─────────────────────────────────────────────────────────
// parseIntent
// Parses Claude's NEEDS_AGENTS structured response.
// Returns null for [DIRECT] or malformed responses.
// ─────────────────────────────────────────────────────────

function parseIntent(intentResponse) {
  if (!intentResponse || !intentResponse.trimStart().startsWith('[NEEDS_AGENTS]')) {
    return null
  }

  const result = {
    scene_type:          null,
    location:            null,
    active_tags:         [],
    connected_tags:      [],
    narrative_direction: null,
    tone:                null,
  }

  for (const raw of intentResponse.split('\n')) {
    const line = raw.trim()
    const ci   = line.indexOf(':')
    if (ci < 0) continue
    const key = line.slice(0, ci).trim()
    const val = line.slice(ci + 1).trim()

    if (key === 'scene_type')          result.scene_type          = val
    if (key === 'location')            result.location            = val
    if (key === 'narrative_direction') result.narrative_direction = val
    if (key === 'tone')                result.tone                = val
    if (key === 'active_tags')
      result.active_tags    = val.split(',').map(s => s.trim()).filter(Boolean)
    if (key === 'connected_tags')
      result.connected_tags = val.split(',').map(s => s.trim()).filter(Boolean)
  }

  if (!result.scene_type) return null
  return result
}

// ─────────────────────────────────────────────────────────
// buildAgentUserMessage  (private)
// Assembles domain records + intent for each passive agent.
// ─────────────────────────────────────────────────────────

function buildAgentUserMessage(agentName, gameId, intent) {
  const intentText = `INTENT:
scene_type: ${intent.scene_type || 'unknown'}
location: ${intent.location || 'unknown'}
active_tags: ${(intent.active_tags || []).join(', ')}
connected_tags: ${(intent.connected_tags || []).join(', ')}
narrative_direction: ${intent.narrative_direction || ''}
tone: ${intent.tone || ''}`.trim()

  const allTagIds = [
    ...(intent.active_tags    || []),
    ...(intent.connected_tags || []),
  ]
  const tagRecords = allTagIds
    .map(id => storage.getTag(gameId, id))
    .filter(Boolean)

  let records = ''

  // ── CHARACTER ──────────────────────────────────────────
  if (agentName === 'character') {
    const char   = storage.getCharacter(gameId)
    const mech   = storage.getGameMechanics(gameId)
    const skills = storage.getSkillRanks(gameId)
    const eff    = heuristics.calculateEffectiveRanks(gameId)

    records = `RECORDS:

CHARACTER:
${char ? JSON.stringify(char, null, 2) : 'none'}

GAME MECHANICS:
${mech ? JSON.stringify(mech, null, 2) : 'none'}

SKILL RANKS:
${skills.length ? skills.map(s => `${s.skill_name}: rank ${s.rank} (ceiling ${s.ceiling}, activity ${s.activity_count})`).join('\n') : 'none'}

EFFECTIVE RANKS (calculated):
Combat: base ${eff.base.combat} → effective ${eff.effective.combat}${eff.penalties.wound ? ` (wound -${eff.penalties.wound})` : ''}${eff.penalties.exhaustion ? ` (exhaustion -${eff.penalties.exhaustion})` : ''}${eff.penalties.hunger ? ` (hunger -${eff.penalties.hunger})` : ''}
Social: base ${eff.base.social} → effective ${eff.effective.social}
Magic:  base ${eff.base.magic}  → effective ${eff.effective.magic}`
  }

  // ── NPC ────────────────────────────────────────────────
  if (agentName === 'npc') {
    const npcTags  = tagRecords.filter(t => t.tag_type === 'npc')
    const allNpcs  = storage.getNpcs(gameId)

    const fullRecords = npcTags.map(tag => {
      const npc   = storage.getNpc(gameId, tag.canonical_name)
      const scope = storage.getKnowledgeScope(gameId, tag.id)
      return `NPC: ${tag.canonical_name}\n${npc ? JSON.stringify(npc, null, 2) : 'no record'}\n\nKNOWLEDGE SCOPE:\n${scope ? JSON.stringify(scope, null, 2) : 'none — flag this'}`
    }).join('\n\n---\n\n')

    const summaries = allNpcs
      .filter(n => !npcTags.some(t => t.canonical_name === n.name))
      .map(n => `${n.name}: ${n.role || 'unknown role'} — ${n.attitude || 'unknown attitude'}`)
      .join('\n')

    records = `RECORDS:

FULL RECORDS (present / directly relevant NPCs):
${fullRecords || 'none'}

ONE-LINE SUMMARIES (all other NPCs):
${summaries || 'none'}`
  }

  // ── PLOT ───────────────────────────────────────────────
  if (agentName === 'plot') {
    const threads = storage.getThreads(gameId)
    records = `RECORDS:

ALL THREADS:
${threads.length ? threads.map(t => JSON.stringify(t, null, 2)).join('\n\n') : 'none'}`
  }

  // ── WORLD ──────────────────────────────────────────────
  if (agentName === 'world') {
    const worldOv  = storage.getWorldOverview(gameId)
    const locTags  = tagRecords.filter(t => t.tag_type === 'location')
    const factions = storage.getFactions(gameId)
    const envState = storage.getEnvironmentalState(gameId)
    const heat     = storage.getFactionHeat(gameId)

    const locRecords = locTags.map(tag => {
      const loc = storage.getLocation(gameId, tag.canonical_name)
      return `LOCATION: ${tag.canonical_name}\n${loc ? JSON.stringify(loc, null, 2) : 'no record'}`
    }).join('\n\n---\n\n')

    records = `RECORDS:

WORLD OVERVIEW:
${worldOv ? JSON.stringify(worldOv, null, 2) : 'none'}

LOCATION RECORDS:
${locRecords || 'none'}

ALL FACTIONS:
${factions.length ? factions.map(f => JSON.stringify(f, null, 2)).join('\n\n') : 'none'}

ENVIRONMENTAL STATE:
${envState ? JSON.stringify(envState, null, 2) : 'none'}

FACTION HEAT:
${heat.length ? heat.map(h => `${h.tag_id}: ${h.heat}`).join('\n') : 'none'}`
  }

  // ── MECHANICS ──────────────────────────────────────────
  if (agentName === 'mechanics') {
    const tracker     = storage.getDifficultyTracker(gameId)
    const directives  = storage.getActiveDirectives(gameId)
    const consequences = storage.getOpenConsequences(gameId)
    const mech        = storage.getGameMechanics(gameId)
    const eff         = heuristics.calculateEffectiveRanks(gameId)
    const reqRank     = heuristics.calculateRequiredEncounterRank(gameId)
    const flags       = storage.getPendingFlags(gameId)
    const companions  = storage.getCompanionStates(gameId)

    const npcTags = tagRecords.filter(t => t.tag_type === 'npc' && t.combat_rank > 0)
    const differentials = npcTags.map(tag => {
      const diff = heuristics.calculateRankDifferential(tag.combat_rank, eff.effective.combat)
      return `${tag.canonical_name} (combat_rank ${tag.combat_rank}): ${diff.outcome} — ${diff.description}`
    }).join('\n')

    records = `RECORDS:

DIFFICULTY TRACKER:
${tracker ? JSON.stringify(tracker, null, 2) : 'none'}

ACTIVE DIRECTIVES:
${directives.length ? JSON.stringify(directives, null, 2) : 'none'}

REQUIRED ENCOUNTER RANK: ${reqRank}

OPEN CONSEQUENCES:
${consequences.length ? consequences.map(c => JSON.stringify(c, null, 2)).join('\n\n') : 'none'}

GAME MECHANICS:
${mech ? JSON.stringify(mech, null, 2) : 'none'}

EFFECTIVE RANKS:
Combat ${eff.effective.combat} / Social ${eff.effective.social} / Magic ${eff.effective.magic}

NPC RANK DIFFERENTIALS:
${differentials || 'none'}

PENDING FLAGS:
${flags.length ? flags.map(f => `[${f.id}] ${f.source_agent} (${f.exchanges_held} exchanges): ${f.flag_content}`).join('\n') : 'none'}

COMPANION STATES:
${companions.length ? companions.map(c => JSON.stringify(c, null, 2)).join('\n\n') : 'none'}`
  }

  return `${records}

${intentText}

Produce your structured response now. Follow the output format in your system prompt exactly.`
}

// ─────────────────────────────────────────────────────────
// runAgents
// Runs all five passive agents in parallel via Ollama.
// ─────────────────────────────────────────────────────────

async function runAgents(gameId, intent) {
  const agentNames = ['character', 'npc', 'plot', 'world', 'mechanics']

  const calls = agentNames.map(name => {
    const systemPrompt = PROMPTS[name]
    const userMessage  = buildAgentUserMessage(name, gameId, intent)
    return callOllama(systemPrompt, userMessage)
      .catch(err => {
        console.error(`[AGENTS] ${name} agent failed: ${err.message}`)
        return `[${name.toUpperCase()} AGENT ERROR]\n${err.message}`
      })
  })

  const [character, npc, plot, world, mechanics] = await Promise.all(calls)
  return { character, npc, plot, world, mechanics }
}

// ─────────────────────────────────────────────────────────
// buildNarratorBrief
// Prepends the ambient index to heuristics.assembleBrief output.
// ─────────────────────────────────────────────────────────

function buildNarratorBrief(gameId, agentResponses, ambientIndex) {
  const brief = heuristics.assembleBrief(gameId, agentResponses)
  const idx   = ambientIndex || heuristics.buildAmbientIndex(gameId)
  return `${idx}\n\n${brief}`
}

// ─────────────────────────────────────────────────────────
// parseSceneTags
// Parses the raw SCENE_TAGS block into structured data.
// Exported for testing.
// ─────────────────────────────────────────────────────────

function parseSceneTags(sceneTagsBlock) {
  const result = {
    present:              [],
    scene_type:           null,
    time_advance:         null,
    modified:             [],   // [{tag_id, fields:[]}]
    new_tags:             [],   // [{id, tag_type, description, aliases, ...}]
    new_relationships:    [],   // [{tag_id_a, relationship, tag_id_b, context_note}]
    knowledge:            [],   // [{tag_id, fields:{}}]
    encounter_rank:       null,
    encounter_outcome:    null,
    wound_inflicted:      null,
    wound_source:         null,
    essence_spent:        null,
    resource_changes:     [],
    equipment_changes:    [],
    faction_heat_changes: [],
    disposition_changes:  [],
    player_milestones:    [],
    new_skills:           [],
    skill_increases:      [],
    companion_rankups:    [],
    new_consequences:     [],
    dismiss_flags:        [],
    directive_fulfilled:  [],
  }

  if (!sceneTagsBlock) return result

  for (const rawLine of sceneTagsBlock.split('\n')) {
    const line = rawLine.trim()
    if (!line || line === 'SCENE_TAGS') continue

    const ci = line.indexOf(':')
    if (ci < 0) continue

    const key = line.slice(0, ci).trim()
    const val = line.slice(ci + 1).trim()

    switch (key) {

      case 'present':
        result.present = val.split(',').map(s => s.trim()).filter(Boolean)
        break

      case 'scene_type':
        result.scene_type = val
        break

      case 'time_advance': {
        const parts  = val.split(/\s+/)
        const amount = parseInt(parts[0], 10)
        const unit   = (parts[1] || 'hours').toLowerCase().replace(/s$/, '') // normalize
        if (!isNaN(amount)) result.time_advance = { amount, unit }
        break
      }

      case 'modified': {
        // Format: tag_id(field, field)  or  tag_id(*)
        const m = val.match(/^(\S+)\(([^)]+)\)$/)
        if (m) {
          const fields = m[2] === '*'
            ? ['*']
            : m[2].split(',').map(s => s.trim()).filter(Boolean)
          result.modified.push({ tag_id: m[1], fields })
        }
        break
      }

      case 'new': {
        // Format: id | type | description | aliases: "a","b" | combat_rank: N | ...
        const parts = val.split('|').map(s => s.trim())
        if (parts.length >= 2) {
          const entry = {
            id:          parts[0],
            tag_type:    parts[1],
            description: parts[2] || '',
            aliases:     [],
            combat_rank: 0,
            social_rank: 0,
            magic_rank:  0,
            entity_tier: 'human',
          }
          for (let i = 3; i < parts.length; i++) {
            const p = parts[i]
            if (p.startsWith('aliases:')) {
              const ms = p.slice('aliases:'.length).trim().match(/"([^"]+)"/g)
              if (ms) entry.aliases = ms.map(s => s.replace(/"/g, ''))
            } else if (p.startsWith('combat_rank:')) {
              entry.combat_rank = parseInt(p.split(':')[1], 10) || 0
            } else if (p.startsWith('social_rank:')) {
              entry.social_rank = parseInt(p.split(':')[1], 10) || 0
            } else if (p.startsWith('magic_rank:')) {
              entry.magic_rank  = parseInt(p.split(':')[1], 10) || 0
            } else if (p.startsWith('entity_tier:')) {
              entry.entity_tier = p.split(':').slice(1).join(':').trim()
            }
          }
          result.new_tags.push(entry)
        }
        break
      }

      case 'new_relationship': {
        // Format: tag_id_a — relationship — tag_id_b | "note"
        const pipeIdx = val.indexOf('|')
        const main    = (pipeIdx >= 0 ? val.slice(0, pipeIdx) : val).trim()
        const note    = pipeIdx >= 0
          ? val.slice(pipeIdx + 1).trim().replace(/^"|"$/g, '')
          : ''
        // Split on em-dash or double-dash, allowing spaces
        const parts = main.split(/\s+[—\-]{1,2}\s+/)
        if (parts.length === 3) {
          result.new_relationships.push({
            tag_id_a:     parts[0].trim(),
            relationship: parts[1].trim(),
            tag_id_b:     parts[2].trim(),
            context_note: note,
          })
        }
        break
      }

      case 'knowledge': {
        // Format: tag_id | field: value | field: value
        const parts = val.split('|').map(s => s.trim())
        if (parts.length >= 2) {
          const fields = {}
          for (let i = 1; i < parts.length; i++) {
            const ci2 = parts[i].indexOf(':')
            if (ci2 >= 0) {
              fields[parts[i].slice(0, ci2).trim()] = parts[i].slice(ci2 + 1).trim()
            }
          }
          result.knowledge.push({ tag_id: parts[0], fields })
        }
        break
      }

      case 'encounter_rank':
        result.encounter_rank = parseInt(val, 10) || null
        break

      case 'encounter_outcome':
        result.encounter_outcome = val
        break

      case 'wound_inflicted':
        result.wound_inflicted = val
        break

      case 'wound_source':
        result.wound_source = val
        break

      case 'essence_spent':
        result.essence_spent = parseInt(val, 10) || null
        break

      case 'resource_change': {
        const parts = val.split('|').map(s => s.trim())
        if (parts.length >= 3) {
          result.resource_changes.push({ name: parts[0], old: parts[1], new: parts[2], reason: parts[3] || '' })
        }
        break
      }

      case 'equipment_change': {
        const parts = val.split('|').map(s => s.trim())
        if (parts.length >= 2) {
          result.equipment_changes.push({ item: parts[0], old: parts[1], new: parts[2] || '' })
        }
        break
      }

      case 'faction_heat_change': {
        const parts = val.split('|').map(s => s.trim())
        if (parts.length >= 3) {
          result.faction_heat_changes.push({
            tag_id: parts[0],
            old:    parseInt(parts[1], 10),
            new:    parseInt(parts[2], 10),
            reason: parts[3] || '',
          })
        }
        break
      }

      case 'disposition_change': {
        const parts = val.split('|').map(s => s.trim())
        if (parts.length >= 3) {
          result.disposition_changes.push({
            tag_id: parts[0],
            old:    parseInt(parts[1], 10),
            new:    parseInt(parts[2], 10),
            reason: parts[3] || '',
          })
        }
        break
      }

      case 'player_milestone': {
        const parts = val.split('|').map(s => s.trim())
        result.player_milestones.push({ type: parts[0], reason: parts[1] || '' })
        break
      }

      case 'new_skill': {
        const parts = val.split('|').map(s => s.trim())
        if (parts.length >= 2) {
          result.new_skills.push({ name: parts[0], rank: parseInt(parts[1], 10) || 0, reason: parts[2] || '' })
        }
        break
      }

      case 'skill_increase': {
        const parts = val.split('|').map(s => s.trim())
        if (parts.length >= 3) {
          result.skill_increases.push({
            name: parts[0],
            old:  parseInt(parts[1], 10),
            new:  parseInt(parts[2], 10),
            reason: parts[3] || '',
          })
        }
        break
      }

      case 'companion_rankup': {
        const parts = val.split('|').map(s => s.trim())
        if (parts.length >= 4) {
          result.companion_rankups.push({
            tag_id:    parts[0],
            rank_type: parts[1],
            old:       parseInt(parts[2], 10),
            new:       parseInt(parts[3], 10),
            reason:    parts[4] || '',
          })
        }
        break
      }

      case 'new_consequence': {
        const parts = val.split('|').map(s => s.trim())
        if (parts.length >= 2) {
          result.new_consequences.push({
            type:        parts[0],
            description: parts[1],
            severity:    parts[2] || 'medium',
          })
        }
        break
      }

      case 'dismiss_flag': {
        const parts = val.split('|').map(s => s.trim())
        result.dismiss_flags.push({ flag_id: parseInt(parts[0], 10), reason: parts[1] || '' })
        break
      }

      case 'directive_fulfilled':
        result.directive_fulfilled.push(val)
        break

      case 'next_call':
        // Ignored — routing removed
        break
    }
  }

  return result
}

// ─────────────────────────────────────────────────────────
// parseSyncResponse
// Parses a sync agent's structured output.
// ─────────────────────────────────────────────────────────

function parseSyncResponse(syncResponse) {
  if (!syncResponse) {
    return { sync_failed: true, failure_reason: 'empty response', writes: [], skipped: [], new_records: [] }
  }

  if (syncResponse.includes('SYNC_FAILED')) {
    const m = syncResponse.match(/reason:\s*"?([^"\n]+)"?/)
    return {
      sync_failed:    true,
      failure_reason: m ? m[1].trim() : 'unknown reason',
      writes:         [],
      skipped:        [],
      new_records:    [],
    }
  }

  return {
    sync_failed:    false,
    failure_reason: null,
    writes:         parseWriteBlocks(extractSection(syncResponse, '[WRITES]',      '[SKIPPED]')),
    skipped:        parseSkipBlocks(extractSection(syncResponse,  '[SKIPPED]',     '[NEW_RECORDS]')),
    new_records:    parseNewRecordBlocks(extractSection(syncResponse, '[NEW_RECORDS]', null)),
  }
}

function extractSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker)
  if (start < 0) return ''
  const after = text.slice(start + startMarker.length)
  if (!endMarker) return after.trim()
  const end = after.indexOf(endMarker)
  return end >= 0 ? after.slice(0, end).trim() : after.trim()
}

function parseWriteBlocks(text) {
  if (!text || text.trim() === '' || text.trim().toLowerCase() === 'none') return []
  const writes = []
  for (const block of text.split(/\n\s*\n/)) {
    const entry = {}
    for (const line of block.split('\n')) {
      const ci = line.indexOf(':')
      if (ci < 0) continue
      const k = line.slice(0, ci).trim()
      const v = line.slice(ci + 1).trim()
      if (['table', 'id', 'field', 'old', 'new', 'evidence'].includes(k)) entry[k] = v
    }
    if (entry.table && entry.field) writes.push(entry)
  }
  return writes
}

function parseSkipBlocks(text) {
  if (!text || text.trim() === '' || text.trim().toLowerCase() === 'none') return []
  const skipped = []
  for (const block of text.split(/\n\s*\n/)) {
    if (!block.trim() || block.trim().toLowerCase() === 'none') continue
    const entry = {}
    for (const line of block.split('\n')) {
      const ci = line.indexOf(':')
      if (ci < 0) continue
      const k = line.slice(0, ci).trim()
      const v = line.slice(ci + 1).trim()
      if (['declaration', 'reason'].includes(k)) entry[k] = v
    }
    if (entry.declaration || entry.reason) skipped.push(entry)
  }
  return skipped
}

function parseNewRecordBlocks(text) {
  if (!text || text.trim() === '' || text.trim().toLowerCase() === 'none') return []
  const records = []
  for (const block of text.split(/\n\s*\n/)) {
    if (!block.trim() || block.trim().toLowerCase() === 'none') continue
    const entry = { table: null, data: {} }
    for (const line of block.split('\n')) {
      const ci = line.indexOf(':')
      if (ci < 0) continue
      const k = line.slice(0, ci).trim()
      const v = line.slice(ci + 1).trim()
      if (k === 'table') {
        entry.table = v
      } else if (k === 'data') {
        for (const pair of v.split('|')) {
          const pi = pair.indexOf(':')
          if (pi >= 0) {
            entry.data[pair.slice(0, pi).trim()] = pair.slice(pi + 1).trim()
          }
        }
      }
    }
    if (entry.table) records.push(entry)
  }
  return records
}

// ─────────────────────────────────────────────────────────
// Sync pass — internal helpers
// ─────────────────────────────────────────────────────────

function applyWound(gameId, severity) {
  if (!severity || severity === 'none' || severity === 'superficial' || severity === 'minor') return
  const PENALTY = { moderate: 5, serious: 10, critical: 15 }
  if (!PENALTY[severity]) return

  const m = storage.getGameMechanics(gameId)
  if (!m) return

  const slots     = ['wound_slot_1', 'wound_slot_2', 'wound_slot_3']
  const emptySlot = slots.find(s => !m[s] || m[s] === 'empty')
  if (!emptySlot) return

  const updates = { [emptySlot]: severity }
  const newPenalty = slots.reduce((sum, s) => {
    const v = s === emptySlot ? severity : (m[s] || 'empty')
    return sum + (PENALTY[v] || 0)
  }, 0)
  updates.wound_penalty = newPenalty

  storage.upsertGameMechanics(gameId, updates)
}

const SEASONS      = ['spring', 'summer', 'autumn', 'winter']
const DAYS_PER_SEA = 91

function advanceTime(gameId, amount, unit) {
  let daysToAdd = 0
  if (unit === 'hour' || unit === 'hours') daysToAdd = amount / 24
  else if (unit === 'day' || unit === 'days') daysToAdd = amount
  if (daysToAdd <= 0) return null

  const clock    = storage.getGameClock(gameId)
  const prevDays = clock?.total_days || 1
  const newDays  = Math.floor(prevDays + daysToAdd)
  const dayOfY   = (newDays - 1) % 365
  const seasonIdx = Math.floor(dayOfY / DAYS_PER_SEA) % 4
  const newSeason = SEASONS[seasonIdx]

  storage.upsertGameClock(gameId, {
    total_days:    newDays,
    season:        newSeason,
    day_of_season: (dayOfY % DAYS_PER_SEA) + 1,
  })

  const envUpdates = { current_day: newDays }
  const env = storage.getEnvironmentalState(gameId)
  if (env?.season !== newSeason) envUpdates.season = newSeason
  storage.upsertEnvironmentalState(gameId, envUpdates)

  return `${amount} ${unit}`
}

function buildSyncSystemPrompt(domain, narrativeResponse, currentRecords) {
  const upper = domain.toUpperCase()
  let p = PROMPTS.sync
  p = p.replace('[CHARACTER | NPC | PLOT | WORLD | MECHANICS]', upper)
  p = p.replace('[domain]', upper)
  p = p.replace(
    '[Filled at runtime with full narrator response including SCENE_TAGS]',
    narrativeResponse
  )
  p = p.replace(
    /\[Filled at runtime with current database records for modified tags[\s\S]*?in this domain\]/,
    currentRecords
  )
  return p
}

function buildSyncCurrentRecords(domain, gameId, parsed) {
  const lines = []

  if (domain === 'character') {
    const char  = storage.getCharacter(gameId)
    const mech  = storage.getGameMechanics(gameId)
    if (char) lines.push('CHARACTER:\n' + JSON.stringify(char, null, 2))
    if (mech) lines.push('GAME MECHANICS:\n' + JSON.stringify(mech, null, 2))
    for (const sk of parsed.skill_increases) {
      const r = storage.getSkillRank(gameId, sk.name)
      if (r) lines.push(`SKILL ${sk.name}:\n` + JSON.stringify(r, null, 2))
    }
  }

  if (domain === 'npc') {
    const npcModIds = parsed.modified
      .filter(m => {
        const tag = storage.getTag(gameId, m.tag_id)
        return tag && tag.tag_type === 'npc'
      })
      .map(m => m.tag_id)
    const dispositionIds = parsed.disposition_changes.map(d => d.tag_id)
    const relevantIds = [...new Set([...npcModIds, ...dispositionIds])]

    for (const tagId of relevantIds) {
      const tag = storage.getTag(gameId, tagId)
      if (!tag) continue
      const npc   = storage.getNpc(gameId, tag.canonical_name)
      const scope = storage.getKnowledgeScope(gameId, tagId)
      if (npc) lines.push(`NPC ${tag.canonical_name}:\n` + JSON.stringify(npc, null, 2))
      if (scope) lines.push(`KNOWLEDGE SCOPE ${tagId}:\n` + JSON.stringify(scope, null, 2))
    }
  }

  if (domain === 'plot') {
    const threadModIds = parsed.modified
      .filter(m => {
        const tag = storage.getTag(gameId, m.tag_id)
        return tag && tag.tag_type === 'thread'
      })
      .map(m => m.tag_id)
    for (const tagId of threadModIds) {
      const tag    = storage.getTag(gameId, tagId)
      const thread = tag ? storage.getThread(gameId, tagId) : null
      if (thread) lines.push(`THREAD ${tagId}:\n` + JSON.stringify(thread, null, 2))
    }
    if (!threadModIds.length) {
      lines.push('(no modified thread records for this exchange)')
    }
  }

  if (domain === 'world') {
    const wo = storage.getWorldOverview(gameId)
    if (wo) lines.push('WORLD OVERVIEW:\n' + JSON.stringify(wo, null, 2))

    const locModIds = parsed.modified
      .filter(m => {
        const tag = storage.getTag(gameId, m.tag_id)
        return tag && tag.tag_type === 'location'
      })
    for (const mod of locModIds) {
      const tag = storage.getTag(gameId, mod.tag_id)
      const loc = tag ? storage.getLocation(gameId, tag.canonical_name) : null
      if (loc) lines.push(`LOCATION ${tag.canonical_name}:\n` + JSON.stringify(loc, null, 2))
    }

    const factionModIds = parsed.modified
      .filter(m => {
        const tag = storage.getTag(gameId, m.tag_id)
        return tag && tag.tag_type === 'faction'
      })
    for (const mod of factionModIds) {
      const tag = storage.getTag(gameId, mod.tag_id)
      const f   = tag ? storage.getFaction(gameId, tag.canonical_name) : null
      if (f) lines.push(`FACTION ${tag.canonical_name}:\n` + JSON.stringify(f, null, 2))
    }

    for (const heat of parsed.faction_heat_changes) {
      const existing = storage.getFactionHeatByTag(gameId, heat.tag_id)
      if (existing) lines.push(`FACTION HEAT ${heat.tag_id}: current ${existing.heat}`)
    }
  }

  if (domain === 'mechanics') {
    const tracker     = storage.getDifficultyTracker(gameId)
    const mech        = storage.getGameMechanics(gameId)
    const consequences = storage.getOpenConsequences(gameId)
    const companions  = storage.getCompanionStates(gameId)
    if (tracker)           lines.push('DIFFICULTY TRACKER:\n'  + JSON.stringify(tracker, null, 2))
    if (mech)              lines.push('GAME MECHANICS:\n'      + JSON.stringify(mech, null, 2))
    if (consequences.length) lines.push('OPEN CONSEQUENCES:\n' + JSON.stringify(consequences, null, 2))
    if (companions.length) lines.push('COMPANION STATES:\n'    + JSON.stringify(companions, null, 2))
  }

  return lines.length ? lines.join('\n\n') : '(no current records for this domain)'
}

function getRelevantSyncDomains(gameId, parsed) {
  const domains = new Set()

  // CHARACTER
  if (parsed.wound_inflicted || parsed.essence_spent
    || parsed.resource_changes.length || parsed.equipment_changes.length
    || parsed.player_milestones.length || parsed.new_skills.length
    || parsed.skill_increases.length) {
    domains.add('character')
  }

  // NPC
  if (parsed.disposition_changes.length || parsed.knowledge.length
    || parsed.new_tags.some(t => t.tag_type === 'npc')) {
    domains.add('npc')
  }

  // PLOT
  if (parsed.new_tags.some(t => t.tag_type === 'thread')) {
    domains.add('plot')
  }

  // WORLD
  if (parsed.new_relationships.length || parsed.faction_heat_changes.length
    || parsed.new_tags.some(t => ['location', 'faction'].includes(t.tag_type))) {
    domains.add('world')
  }

  // MECHANICS
  if (parsed.encounter_rank !== null || parsed.encounter_outcome
    || parsed.directive_fulfilled.length || parsed.new_consequences.length
    || parsed.dismiss_flags.length || parsed.companion_rankups.length) {
    domains.add('mechanics')
  }

  // For each modified: tag, look up its type and route accordingly
  for (const mod of parsed.modified) {
    const tag = storage.getTag(gameId, mod.tag_id)
    if (!tag) continue
    if (tag.tag_type === 'npc')      domains.add('npc')
    if (tag.tag_type === 'thread')   domains.add('plot')
    if (tag.tag_type === 'location') domains.add('world')
    if (tag.tag_type === 'faction')  domains.add('world')
    if (mod.tag_id === 'character')  domains.add('character')
  }

  return Array.from(domains)
}

function executeSyncWrite(gameId, write) {
  const { table, id, field } = write
  const newVal = write.new

  try {
    switch (table) {

      case 'npcs': {
        const tag  = id ? storage.getTag(gameId, id) : null
        const name = tag ? tag.canonical_name : id
        const npc  = storage.getNpc(gameId, name)
        if (npc) storage.upsertNpc(gameId, { name, [field]: newVal })
        break
      }

      case 'character':
        storage.upsertCharacter(gameId, { [field]: newVal })
        break

      case 'threads': {
        const thread = storage.getThread(gameId, id)
        if (thread) storage.upsertThread(gameId, { id: parseInt(id, 10) || id, [field]: newVal })
        break
      }

      case 'locations': {
        const tag  = id ? storage.getTag(gameId, id) : null
        const name = tag ? tag.canonical_name : id
        storage.upsertLocation(gameId, { name, [field]: newVal })
        break
      }

      case 'factions': {
        const tag  = id ? storage.getTag(gameId, id) : null
        const name = tag ? tag.canonical_name : id
        storage.upsertFaction(gameId, { name, [field]: newVal })
        break
      }

      case 'world_overview':
        storage.upsertWorldOverview(gameId, { [field]: newVal })
        break

      case 'game_mechanics':
        storage.upsertGameMechanics(gameId, { [field]: newVal })
        break

      case 'difficulty_tracker':
        storage.upsertDifficultyTracker(gameId, { [field]: newVal })
        break

      case 'companion_state':
        storage.upsertCompanionState(gameId, { tag_id: id, [field]: newVal })
        break

      case 'skill_ranks':
        storage.upsertSkillRank(gameId, { skill_name: id, [field]: newVal })
        break

      default:
        console.warn(`[SYNC] Unknown table in sync write: ${table}`)
    }
  } catch (err) {
    console.error(`[SYNC] Write failed — table:${table} id:${id} field:${field}: ${err.message}`)
  }
}

// ─────────────────────────────────────────────────────────
// runSyncPass
// Runs the full sync pass after a narrative exchange.
// Called during Kokoro audio playback (non-blocking for UI).
// ─────────────────────────────────────────────────────────

async function runSyncPass(gameId, narrativeResponse, sceneTagsBlock) {
  const result = {
    success:              false,
    partial_sync:         false,
    scene_type:           null,
    tags_created:         0,
    relationships_created: 0,
    records_updated:      0,
    directives_updated:   false,
    time_advanced:        null,
    errors:               [],
  }

  // ── STEP 1: Parse SCENE_TAGS block ─────────────────────
  if (!sceneTagsBlock || !sceneTagsBlock.includes('SCENE_TAGS')) {
    console.warn('[SYNC] No valid SCENE_TAGS block found — partial sync')
    result.partial_sync = true
    return result
  }

  let parsed
  try {
    parsed = parseSceneTags(sceneTagsBlock)
  } catch (err) {
    console.error('[SYNC] SCENE_TAGS parse error:', err.message)
    result.partial_sync = true
    result.errors.push(`parse error: ${err.message}`)
    return result
  }

  result.scene_type = parsed.scene_type

  // ── STEP 2: Immediate DB writes (no AI) ────────────────

  // New tags + aliases
  for (const entry of parsed.new_tags) {
    try {
      storage.upsertTag(gameId, {
        id:            entry.id,
        tag_type:      entry.tag_type,
        canonical_name: entry.description
          ? entry.id.replace(/^tag_/, '').replace(/_/g, ' ')
          : entry.id,
        description:   entry.description,
        combat_rank:   entry.combat_rank,
        social_rank:   entry.social_rank,
        magic_rank:    entry.magic_rank,
        entity_tier:   entry.entity_tier,
        status:        'active',
        confirmed:     1,
      })
      for (const alias of entry.aliases) {
        storage.addAlias(gameId, entry.id, alias)
      }
      result.tags_created++
    } catch (err) {
      result.errors.push(`new tag ${entry.id}: ${err.message}`)
    }
  }

  // New relationships
  for (const rel of parsed.new_relationships) {
    try {
      storage.upsertRelationship(gameId, {
        tag_id_a:     rel.tag_id_a,
        tag_id_b:     rel.tag_id_b,
        relationship: rel.relationship,
        context_note: rel.context_note,
      })
      result.relationships_created++
    } catch (err) {
      result.errors.push(`relationship ${rel.tag_id_a}→${rel.tag_id_b}: ${err.message}`)
    }
  }

  // Faction heat changes
  for (const hc of parsed.faction_heat_changes) {
    try {
      storage.upsertFactionHeat(gameId, hc.tag_id, hc.new)
    } catch (err) {
      result.errors.push(`faction heat ${hc.tag_id}: ${err.message}`)
    }
  }

  // Disposition changes on tag record
  for (const dc of parsed.disposition_changes) {
    try {
      // Update tags table disposition field if it exists
      const tag = storage.getTag(gameId, dc.tag_id)
      if (tag) {
        // Tags table doesn't have a disposition field - this lives in npcs
        const npc = storage.getNpc(gameId, tag.canonical_name)
        if (npc) storage.upsertNpc(gameId, { name: tag.canonical_name, disposition: dc.new })
      }
    } catch (err) {
      result.errors.push(`disposition ${dc.tag_id}: ${err.message}`)
    }
  }

  // New consequences
  for (const cons of parsed.new_consequences) {
    try {
      storage.addConsequence(gameId, {
        consequence_type: cons.type,
        description:      cons.description,
        severity:         cons.severity,
        status:           'open',
      })
    } catch (err) {
      result.errors.push(`new consequence ${cons.type}: ${err.message}`)
    }
  }

  // Dismiss flags
  for (const df of parsed.dismiss_flags) {
    try {
      storage.dismissFlag(gameId, df.flag_id, df.reason)
    } catch (err) {
      result.errors.push(`dismiss flag ${df.flag_id}: ${err.message}`)
    }
  }

  // Knowledge scope updates
  for (const kn of parsed.knowledge) {
    try {
      storage.upsertKnowledgeScope(gameId, { tag_id: kn.tag_id, ...kn.fields })
    } catch (err) {
      result.errors.push(`knowledge scope ${kn.tag_id}: ${err.message}`)
    }
  }

  // ── STEP 3: Mechanics state (no AI) ────────────────────

  // Wound
  if (parsed.wound_inflicted && parsed.wound_inflicted !== 'none') {
    try {
      applyWound(gameId, parsed.wound_inflicted)
    } catch (err) {
      result.errors.push(`wound apply: ${err.message}`)
    }
  }

  // Essence spent
  if (parsed.essence_spent) {
    try {
      const mech = storage.getGameMechanics(gameId)
      if (mech) {
        const newEssence = Math.max(0, (mech.essence_current || 0) - parsed.essence_spent)
        storage.upsertGameMechanics(gameId, { essence_current: newEssence })
      }
    } catch (err) {
      result.errors.push(`essence: ${err.message}`)
    }
  }

  // Resource changes (coin, rations, ammunition, etc.)
  for (const rc of parsed.resource_changes) {
    try {
      const col = rc.name.toLowerCase().replace(/\s+/g, '_')
      const newAmt = parseInt(rc.new, 10)
      if (!isNaN(newAmt)) {
        storage.upsertGameMechanics(gameId, { [col]: newAmt })
      }
    } catch (err) {
      result.errors.push(`resource ${rc.name}: ${err.message}`)
    }
  }

  // Directives fulfilled
  for (const dtype of parsed.directive_fulfilled) {
    try {
      storage.removeDirective(gameId, dtype)
      result.directives_updated = true
    } catch (err) {
      result.errors.push(`directive ${dtype}: ${err.message}`)
    }
  }

  // Player milestones
  for (const pm of parsed.player_milestones) {
    try {
      const validation = heuristics.validateGrowth(gameId, pm.type, pm.type)
      if (validation.valid) {
        storage.addMilestone(gameId, {
          milestone_type: pm.type,
          rank_type:      pm.type,
          description:    pm.reason,
          validated:      1,
        })
      } else {
        console.warn(`[SYNC] Milestone blocked: ${validation.reason}`)
      }
    } catch (err) {
      result.errors.push(`milestone ${pm.type}: ${err.message}`)
    }
  }

  // New skills
  for (const ns of parsed.new_skills) {
    try {
      storage.upsertSkillRank(gameId, { skill_name: ns.name, rank: ns.rank, activity_count: 0 })
    } catch (err) {
      result.errors.push(`new skill ${ns.name}: ${err.message}`)
    }
  }

  // Skill increases
  for (const si of parsed.skill_increases) {
    try {
      const validation = heuristics.validateGrowth(gameId, 'skill_increase', si.name)
      if (validation.valid) {
        storage.upsertSkillRank(gameId, { skill_name: si.name, rank: si.new, activity_count: 0 })
      } else {
        console.warn(`[SYNC] Skill increase blocked for ${si.name}: ${validation.reason}`)
      }
    } catch (err) {
      result.errors.push(`skill increase ${si.name}: ${err.message}`)
    }
  }

  // ── STEP 4: Update difficulty tracker (no AI) ──────────
  try {
    heuristics.updateDifficultyTracker(gameId, {
      sceneType:      parsed.scene_type || 'other',
      woundOccurred:  !!(parsed.wound_inflicted && parsed.wound_inflicted !== 'none'),
      setbackOccurred: parsed.encounter_outcome === 'failure' || parsed.encounter_outcome === 'setback',
      majorThreat:    parsed.encounter_rank !== null && parsed.encounter_rank >= 40,
      success:        parsed.encounter_outcome === 'success',
      magicUsed:      !!(parsed.essence_spent),
    })
  } catch (err) {
    result.errors.push(`difficulty tracker: ${err.message}`)
  }

  // ── STEP 5: Increment companion activity (no AI) ────────
  try {
    const companions = storage.getCompanionStates(gameId)
    const presentSet = new Set(parsed.present)
    for (const comp of companions) {
      if (!presentSet.has(comp.tag_id)) continue
      const activityType =
        parsed.scene_type === 'combat'  ? 'combat'    :
        parsed.scene_type === 'travel'  ? 'traveling' : 'base'
      storage.incrementCompanionActivity(gameId, comp.tag_id, activityType)
    }
    // Companion rankups
    for (const cr of parsed.companion_rankups) {
      const validation = heuristics.validateGrowth(gameId, 'companion_rankup', cr.tag_id)
      if (validation.valid) {
        const rankField = cr.rank_type === 'social' ? 'social_rank' : 'combat_rank'
        storage.upsertCompanionState(gameId, { tag_id: cr.tag_id, [rankField]: cr.new })
      }
    }
  } catch (err) {
    result.errors.push(`companion activity: ${err.message}`)
  }

  // ── STEP 6: Increment pending flag ages (no AI) ─────────
  try {
    storage.incrementFlagAge(gameId)
  } catch (err) {
    result.errors.push(`flag age: ${err.message}`)
  }

  // ── STEP 7: Advance time (no AI) ─────────────────────────
  if (parsed.time_advance) {
    try {
      result.time_advanced = advanceTime(
        gameId,
        parsed.time_advance.amount,
        parsed.time_advance.unit
      )
    } catch (err) {
      result.errors.push(`time advance: ${err.message}`)
    }
  }

  // ── STEP 8: Run sync agents (Ollama, parallel) ──────────
  const relevantDomains = getRelevantSyncDomains(gameId, parsed)

  if (relevantDomains.length > 0) {
    const syncCalls = relevantDomains.map(domain => {
      const currentRecords = buildSyncCurrentRecords(domain, gameId, parsed)
      const systemPrompt   = buildSyncSystemPrompt(domain, narrativeResponse, currentRecords)
      const userMessage    = 'Produce your sync output now.'
      return callOllama(systemPrompt, userMessage)
        .then(resp => ({ domain, resp }))
        .catch(err => {
          console.error(`[SYNC] ${domain} sync agent failed: ${err.message}`)
          result.errors.push(`sync agent ${domain}: ${err.message}`)
          return { domain, resp: null }
        })
    })

    const agentResults = await Promise.all(syncCalls)

    // ── STEP 9: Execute sync agent writes ──────────────────
    for (const { domain, resp } of agentResults) {
      if (!resp) continue
      const parsed2 = parseSyncResponse(resp)
      if (parsed2.sync_failed) {
        console.warn(`[SYNC] ${domain} sync agent reported failure: ${parsed2.failure_reason}`)
        result.errors.push(`${domain} sync failed: ${parsed2.failure_reason}`)
        continue
      }

      for (const write of parsed2.writes) {
        executeSyncWrite(gameId, write)
        result.records_updated++
      }

      if (parsed2.skipped.length > 0) {
        console.log(`[SYNC] ${domain}: ${parsed2.skipped.length} declarations skipped`)
      }
    }
  }

  // ── STEP 10: Log sync completion ───────────────────────
  try {
    storage.appendSyncEntry(gameId, {
      scene_type:            result.scene_type || 'unknown',
      in_world_time_elapsed: result.time_advanced || '0 hours',
      changes:               JSON.stringify({
        tags_created:         result.tags_created,
        relationships_created: result.relationships_created,
        records_updated:       result.records_updated,
        directives_updated:    result.directives_updated,
        errors:                result.errors.length,
      }),
    })
  } catch (err) {
    console.error('[SYNC] Log entry failed:', err.message)
  }

  result.success = result.errors.length === 0
  return result
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  callOllama,
  detectTags,
  runAgents,
  parseIntent,
  parseSyncResponse,
  runSyncPass,
  buildNarratorBrief,
  parseSceneTags,  // exported for testing
}
