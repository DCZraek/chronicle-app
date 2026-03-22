const storage = require('./storage')

// ═══════════════════════════════════════════════════════════
// HEURISTICS — Mechanical calculation engine
// Pure calculations + DB reads via storage.js
// Never writes to the database directly — callers write.
// Exception: updateDifficultyTracker writes via storage.
// ═══════════════════════════════════════════════════════════

// Tier boundaries (inclusive upper bound)
const TIERS = [
  { max: 25,  name: 'human' },
  { max: 40,  name: 'augmented' },
  { max: 60,  name: 'lesser_supernatural' },
  { max: 80,  name: 'greater_supernatural' },
  { max: 95,  name: 'divine_adjacent' },
  { max: 100, name: 'true_divine' },
]

const TIER_BOUNDARIES = [25, 40, 60, 80, 95]

// Map exhaustion/hunger text states to rank penalties
const EXHAUSTION_PENALTY = { none: 0, mild: 2, moderate: 5, severe: 10, critical: 15 }
const HUNGER_PENALTY     = { none: 0, mild: 2, moderate: 5, severe: 10, critical: 15 }

// ─────────────────────────────────────────────────────────
// 1. calculateRankDifferential
// ─────────────────────────────────────────────────────────

function calculateRankDifferential(attackerRank, defenderRank) {
  const gap = attackerRank - defenderRank

  // Count tier boundaries crossed between the two ranks
  const lo = Math.min(attackerRank, defenderRank)
  const hi = Math.max(attackerRank, defenderRank)
  const tier_crossings = TIER_BOUNDARIES.filter(b => b > lo && b <= hi).length

  let outcome, description
  if (gap >= 35) {
    outcome = 'attacker_dominant'
    description = 'Attacker so far above defender that direct resistance is impossible — story resolution only'
  } else if (gap >= 20) {
    outcome = 'attacker_advantage'
    description = 'Attacker significantly outranks defender — direct confrontation loses regardless of approach'
  } else if (gap >= -9) {
    outcome = 'contested'
    description = gap >= 10
      ? 'Attacker has significant advantage — higher rank dominates direct exchanges, but player decisions still matter'
      : 'Outcome uncertain — player decisions and approach determine the result'
  } else if (gap >= -19) {
    outcome = 'defender_advantage'
    description = 'Defender significantly outranks attacker — direct confrontation favors defender, disengagement advised'
  } else if (gap >= -34) {
    outcome = 'defender_dominant'
    description = 'Defender so far above attacker that direct engagement is suicidal — withdraw or find leverage'
  } else {
    outcome = 'impossible_for_attacker'
    description = 'Defender so far above attacker that direct resistance is impossible — story resolution only'
  }

  return { gap, tier_crossings, outcome, description }
}

// ─────────────────────────────────────────────────────────
// 2. calculateWoundSeverity
// ─────────────────────────────────────────────────────────

function calculateWoundSeverity(sourceRank, playerEffectiveRank) {
  const gap = sourceRank - playerEffectiveRank

  if (gap <= -15) {
    return { severity: 'superficial', fills_slot: false, penalty: 0,
             description: 'Source far below player — glancing blow, no mechanical effect' }
  }
  if (gap <= -5) {
    return { severity: 'minor', fills_slot: false, penalty: 0,
             description: 'Player outranks source — minor wound, no slot consumed' }
  }
  if (gap <= 4) {
    return { severity: 'moderate', fills_slot: true, penalty: 5,
             description: 'Roughly matched — moderate wound possible, fills a wound slot' }
  }
  if (gap <= 14) {
    return { severity: 'serious', fills_slot: true, penalty: 10,
             description: 'Source outranks player — serious wound, significant penalty' }
  }
  return { severity: 'critical', fills_slot: true, penalty: 15,
           description: 'Source far above player — critical wound, severe penalty' }
}

// ─────────────────────────────────────────────────────────
// 3. calculateEffectiveRanks
// ─────────────────────────────────────────────────────────

function calculateEffectiveRanks(gameId) {
  const m = storage.getGameMechanics(gameId)
  if (!m) {
    return {
      base:    { combat: 0, social: 0, magic: 0 },
      effective: { combat: 0, social: 0, magic: 0 },
      penalties: { wound: 0, exhaustion: 0, hunger: 0 },
    }
  }

  const woundPenalty     = m.wound_penalty || 0
  const exhaustionPenalty = EXHAUSTION_PENALTY[m.exhaustion] ?? 0
  const hungerPenalty     = HUNGER_PENALTY[m.hunger] ?? 0

  const base = {
    combat: m.player_combat_rank,
    social: m.player_social_rank,
    magic:  m.player_magic_rank,
  }

  const effective = {
    combat: Math.max(0, base.combat - woundPenalty - exhaustionPenalty - hungerPenalty),
    social: Math.max(0, base.social - exhaustionPenalty),
    magic:  Math.max(0, base.magic  - Math.floor(woundPenalty / 2) - exhaustionPenalty),
  }

  return {
    base,
    effective,
    penalties: { wound: woundPenalty, exhaustion: exhaustionPenalty, hunger: hungerPenalty },
  }
}

// ─────────────────────────────────────────────────────────
// 4. getEntityTierForRank
// ─────────────────────────────────────────────────────────

function getEntityTierForRank(rank) {
  for (const tier of TIERS) {
    if (rank <= tier.max) return tier.name
  }
  return 'true_divine'
}

// ─────────────────────────────────────────────────────────
// 5. updateDifficultyTracker
// Accepts sceneData: {
//   sceneType:     'combat' | 'social' | 'magic' | 'travel' | 'other'
//   woundOccurred:  boolean
//   setbackOccurred: boolean
//   majorThreat:   boolean
//   success:       boolean
//   magicUsed:     boolean
// }
// Reads tracker, updates counters, fires directives, writes via storage.
// Returns { directives_fired: [], updates: {} }
// ─────────────────────────────────────────────────────────

function updateDifficultyTracker(gameId, sceneData = {}) {
  const tracker = storage.getDifficultyTracker(gameId)
  if (!tracker) return { directives_fired: [], updates: {} }

  const {
    sceneType = 'other',
    woundOccurred = false,
    setbackOccurred = false,
    majorThreat = false,
    success = false,
    magicUsed = false,
  } = sceneData

  const updates = {}

  // ── Increment counters based on scene type ───────────────
  if (sceneType === 'combat') {
    updates.combat_since_wound = woundOccurred
      ? 0
      : (tracker.combat_since_wound || 0) + 1
    updates.exchanges_since_challenge = (tracker.exchanges_since_challenge || 0) + 1
  }

  if (sceneType === 'social') {
    updates.social_since_setback = setbackOccurred
      ? 0
      : (tracker.social_since_setback || 0) + 1
  }

  if (sceneType === 'magic' && magicUsed) {
    updates.magic_since_cost = (tracker.magic_since_cost || 0) + 1
  }

  if (majorThreat) {
    updates.exchanges_since_major_threat = 0
  } else {
    updates.exchanges_since_major_threat = (tracker.exchanges_since_major_threat || 0) + 1
  }

  if (success && !setbackOccurred) {
    updates.consecutive_successes = (tracker.consecutive_successes || 0) + 1
  } else {
    updates.consecutive_successes = 0
  }

  // Merge updates with current tracker values for threshold checks
  const current = { ...tracker, ...updates }

  // ── Check thresholds and fire directives ─────────────────
  const directives_fired = []
  const existingDirectives = storage.getActiveDirectives(gameId)

  const alreadyHasWound = existingDirectives.some(d => d.type === 'wound')
  if (!alreadyHasWound
      && current.combat_since_wound >= (tracker.wound_threshold || 3)) {
    const requiredRank = calculateRequiredEncounterRank(gameId)
    const directive = {
      type: 'wound',
      minimum_encounter_rank: requiredRank,
      entity_tier: getEntityTierForRank(requiredRank),
      fired_at: new Date().toISOString(),
    }
    storage.addDirective(gameId, directive)
    directives_fired.push(directive)
  }

  const alreadyHasSetback = existingDirectives.some(d => d.type === 'social_setback')
  if (!alreadyHasSetback
      && current.social_since_setback >= (tracker.setback_threshold || 3)) {
    const directive = { type: 'social_setback', fired_at: new Date().toISOString() }
    storage.addDirective(gameId, directive)
    directives_fired.push(directive)
  }

  const alreadyHasThreat = existingDirectives.some(d => d.type === 'major_threat')
  if (!alreadyHasThreat
      && current.exchanges_since_major_threat >= (tracker.threat_threshold || 6)) {
    const directive = { type: 'major_threat', fired_at: new Date().toISOString() }
    storage.addDirective(gameId, directive)
    directives_fired.push(directive)
  }

  const alreadyHasMagicCost = existingDirectives.some(d => d.type === 'magic_cost')
  if (!alreadyHasMagicCost
      && current.magic_since_cost >= (tracker.magic_cost_threshold || 3)) {
    const directive = { type: 'magic_cost', fired_at: new Date().toISOString() }
    storage.addDirective(gameId, directive)
    directives_fired.push(directive)
  }

  // ── Write counter updates ─────────────────────────────────
  if (Object.keys(updates).length > 0) {
    storage.upsertDifficultyTracker(gameId, updates)
  }

  return { directives_fired, updates }
}

// ─────────────────────────────────────────────────────────
// 6. calculateRequiredEncounterRank
// ─────────────────────────────────────────────────────────

function calculateRequiredEncounterRank(gameId) {
  const ranks   = calculateEffectiveRanks(gameId)
  const tracker = storage.getDifficultyTracker(gameId)

  const effectiveCombat   = ranks.effective.combat
  const combatSinceWound  = tracker ? (tracker.combat_since_wound || 0) : 0
  const escalationRate    = tracker ? (tracker.escalation_rate    || 3) : 3

  const required = effectiveCombat + (combatSinceWound * escalationRate)
  return Math.min(required, 95)
}

// ─────────────────────────────────────────────────────────
// 7. validateGrowth
// growthType: 'rank_increase' | 'new_skill' | 'skill_increase' | 'companion_rankup'
// rankType:   'combat' | 'social' | 'magic' (for rank_increase)
//             skill name (for skill_increase)
//             tag_id (for companion_rankup)
// Returns { valid: boolean, reason: string }
// ─────────────────────────────────────────────────────────

function validateGrowth(gameId, growthType, rankType) {
  if (growthType === 'new_skill') {
    return { valid: true, reason: 'New skills are always valid' }
  }

  if (growthType === 'rank_increase') {
    const milestones = storage.getMilestones(gameId)
    if (!milestones.length) {
      return { valid: true, reason: 'No previous milestones — first rank increase is valid' }
    }

    // Find the last milestone for this rank type
    const relevant = milestones
      .filter(m => m.rank_type === rankType && m.milestone_type === 'rank_increase')
      .sort((a, b) => b.id - a.id)

    if (!relevant.length) {
      return { valid: true, reason: `No previous ${rankType} rank increases recorded` }
    }

    const last = relevant[0]
    const allMilestones = milestones.sort((a, b) => b.id - a.id)
    const lastId = allMilestones[0].id
    const exchangesSinceLast = lastId - last.id

    if (exchangesSinceLast < 3) {
      return {
        valid: false,
        reason: `Rank increase requires 3 exchange cooldown — only ${exchangesSinceLast} since last ${rankType} increase`,
      }
    }
    return { valid: true, reason: `Cooldown satisfied (${exchangesSinceLast} exchanges since last ${rankType} increase)` }
  }

  if (growthType === 'skill_increase') {
    const skill = storage.getSkillRank(gameId, rankType)
    if (!skill) {
      return { valid: false, reason: `Skill "${rankType}" not found` }
    }
    if (skill.activity_count < 5) {
      return {
        valid: false,
        reason: `Skill increase requires 5 activity uses — "${rankType}" has ${skill.activity_count}`,
      }
    }
    if (skill.rank >= skill.ceiling) {
      return {
        valid: false,
        reason: `Skill "${rankType}" is at ceiling (${skill.ceiling})`,
      }
    }
    return { valid: true, reason: `Activity threshold met (${skill.activity_count} uses) — skill increase valid` }
  }

  if (growthType === 'companion_rankup') {
    const companion = storage.getCompanionState(gameId, rankType)
    if (!companion) {
      return { valid: false, reason: `Companion "${rankType}" not found in companion_state` }
    }
    if (companion.exchanges_in_combat < 5) {
      return {
        valid: false,
        reason: `Companion rankup requires 5 combat exchanges — "${rankType}" has ${companion.exchanges_in_combat}`,
      }
    }
    return { valid: true, reason: `Combat exchange threshold met (${companion.exchanges_in_combat}) — companion rankup valid` }
  }

  return { valid: false, reason: `Unknown growthType: "${growthType}"` }
}

// ─────────────────────────────────────────────────────────
// 8. runTimeDegradation
// Read-only — returns recommended changes, never writes.
// Returns { recommendations: [] }
// ─────────────────────────────────────────────────────────

const WOUND_PROGRESSION = {
  minor:    'moderate',
  moderate: 'serious',
  serious:  'critical',
}

function runTimeDegradation(gameId) {
  const recommendations = []
  const m = storage.getGameMechanics(gameId)

  if (m) {
    // Recommend worsening untreated wounds
    for (const slot of ['wound_slot_1', 'wound_slot_2', 'wound_slot_3']) {
      const current = m[slot]
      if (current && current !== 'empty' && WOUND_PROGRESSION[current]) {
        recommendations.push({
          type: 'wound_worsening',
          slot,
          current_severity: current,
          recommended_severity: WOUND_PROGRESSION[current],
          reason: `Untreated ${current} wound — consider worsening if sufficient time has passed without treatment`,
        })
      }
    }
  }

  // Flag old pending flags
  const flags = storage.getPendingFlags(gameId)
  for (const flag of flags) {
    if (flag.exchanges_held >= 3) {
      recommendations.push({
        type: 'stale_flag',
        flag_id: flag.id,
        source_agent: flag.source_agent,
        exchanges_held: flag.exchanges_held,
        flag_content: flag.flag_content,
        reason: `Flag held for ${flag.exchanges_held} exchanges — should surface or dismiss`,
      })
    }
  }

  return { recommendations }
}

// ─────────────────────────────────────────────────────────
// 9. buildAmbientIndex
// Groups active confirmed tags by type.
// Returns formatted [AMBIENT INDEX] string.
// ─────────────────────────────────────────────────────────

function buildAmbientIndex(gameId) {
  const tags = storage.getTags(gameId)
  if (!tags || tags.length === 0) {
    return '[AMBIENT INDEX]\nnone'
  }

  // Group by tag_type
  const groups = {}
  for (const tag of tags) {
    if (!groups[tag.tag_type]) groups[tag.tag_type] = []
    groups[tag.tag_type].push(tag.id)
  }

  const lines = ['[AMBIENT INDEX]']
  for (const [type, ids] of Object.entries(groups).sort()) {
    lines.push(`${type}: ${ids.join(', ')}`)
  }
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────
// 10. assembleBrief
// agentResponses: { character?, npc?, plot?, world?, mechanics? }
// Returns assembled brief string for the narrator.
// ─────────────────────────────────────────────────────────

function assembleBrief(gameId, agentResponses = {}) {
  const sections = []

  // ── [PLAYER STATE] ────────────────────────────────────────
  const m = storage.getGameMechanics(gameId)
  const ranks = calculateEffectiveRanks(gameId)

  const playerLines = ['[PLAYER STATE]']
  if (m) {
    playerLines.push(
      `combat: base ${ranks.base.combat} → effective ${ranks.effective.combat}` +
        (ranks.penalties.wound ? ` (wound -${ranks.penalties.wound})` : '') +
        (ranks.penalties.exhaustion ? ` (exhaustion -${ranks.penalties.exhaustion})` : '') +
        (ranks.penalties.hunger ? ` (hunger -${ranks.penalties.hunger})` : '')
    )
    playerLines.push(
      `social: base ${ranks.base.social} → effective ${ranks.effective.social}` +
        (ranks.penalties.exhaustion ? ` (exhaustion -${ranks.penalties.exhaustion})` : '')
    )
    if (ranks.base.magic > 0) {
      playerLines.push(
        `magic: base ${ranks.base.magic} → effective ${ranks.effective.magic}`
      )
    }

    const wounds = [m.wound_slot_1, m.wound_slot_2, m.wound_slot_3]
      .filter(w => w && w !== 'empty')
    if (wounds.length) {
      playerLines.push(`wounds: ${wounds.join(', ')}`)
    } else {
      playerLines.push('wounds: none')
    }

    if (m.exhaustion && m.exhaustion !== 'none') {
      playerLines.push(`exhaustion: ${m.exhaustion}`)
    }
    if (m.hunger && m.hunger !== 'none') {
      playerLines.push(`hunger: ${m.hunger}`)
    }
    if (m.essence_max > 0) {
      playerLines.push(`essence: ${m.essence_current}/${m.essence_max}`)
    }
  } else {
    playerLines.push('no game mechanics record found')
  }
  sections.push(playerLines.join('\n'))

  // ── [ACTIVE DIRECTIVES] ───────────────────────────────────
  const directives = storage.getActiveDirectives(gameId)
  const directiveLines = ['[ACTIVE DIRECTIVES]']
  if (directives.length === 0) {
    directiveLines.push('none')
  } else {
    for (const d of directives) {
      if (d.type === 'wound') {
        directiveLines.push(
          `⚑ DIRECTIVE: wound — minimum encounter rank: ${d.minimum_encounter_rank} | tier: ${d.entity_tier}`
        )
        directiveLines.push('  planned combat only — player-initiated brawls do not fulfill this')
        directiveLines.push('  this is a floor not a ceiling — story may demand harder encounters')
      } else {
        directiveLines.push(`⚑ DIRECTIVE: ${d.type}`)
      }
    }
  }
  sections.push(directiveLines.join('\n'))

  // ── [OPEN CONSEQUENCES] ───────────────────────────────────
  const consequences = storage.getOpenConsequences(gameId)
  const consequenceLines = ['[OPEN CONSEQUENCES]']
  if (consequences.length === 0) {
    consequenceLines.push('none')
  } else {
    for (const c of consequences) {
      consequenceLines.push(`${c.consequence_type} (${c.severity}): ${c.description}`)
    }
  }
  sections.push(consequenceLines.join('\n'))

  // ── [AGENT RESPONSES] ─────────────────────────────────────
  const agentLines = ['[AGENT RESPONSES]']
  const agentOrder = ['character', 'npc', 'plot', 'world', 'mechanics']
  let hasAny = false
  for (const agent of agentOrder) {
    if (agentResponses[agent]) {
      agentLines.push(`--- ${agent.toUpperCase()} AGENT ---`)
      agentLines.push(agentResponses[agent])
      hasAny = true
    }
  }
  if (!hasAny) {
    agentLines.push('none')
  }
  sections.push(agentLines.join('\n'))

  return sections.join('\n\n')
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  calculateRankDifferential,
  calculateWoundSeverity,
  calculateEffectiveRanks,
  getEntityTierForRank,
  updateDifficultyTracker,
  calculateRequiredEncounterRank,
  validateGrowth,
  runTimeDegradation,
  buildAmbientIndex,
  assembleBrief,
}
