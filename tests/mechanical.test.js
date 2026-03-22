// ═══════════════════════════════════════════════════════════
// mechanical.test.js — Phase 2: Heuristics engine tests
// Run with: node tests/mechanical.test.js
// ═══════════════════════════════════════════════════════════

const assert = require('assert')
const storage = require('../storage')
const h       = require('../heuristics')

// ── Test helpers ─────────────────────────────────────────

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}`)
    console.log(`    ${e.message}`)
    failed++
  }
}

function group(name, fn) {
  console.log(`\n${name}`)
  fn()
}

// ── Setup: create a test game ─────────────────────────────

const GAME_ID = `test_heuristics_${Date.now()}`

function setup() {
  storage.db.prepare(
    `INSERT INTO games (id, name, created_at, last_played)
     VALUES (?, 'Heuristics Test', datetime('now'), datetime('now'))`
  ).run(GAME_ID)
  storage.initializeGameRows(GAME_ID)
}

function teardown() {
  storage.db.prepare('DELETE FROM games WHERE id = ?').run(GAME_ID)
}

// ── Run setup before any tests execute ───────────────────
setup()

// ═══════════════════════════════════════════════════════════
// GROUP 1 — calculateRankDifferential
// ═══════════════════════════════════════════════════════════

group('1. calculateRankDifferential', () => {
  test('attacker_dominant when gap >= 35', () => {
    const r = h.calculateRankDifferential(60, 20)
    assert.strictEqual(r.gap, 40)
    assert.strictEqual(r.outcome, 'attacker_dominant')
  })

  test('attacker_advantage when gap 20-34', () => {
    const r = h.calculateRankDifferential(45, 20)
    assert.strictEqual(r.gap, 25)
    assert.strictEqual(r.outcome, 'attacker_advantage')
  })

  test('contested when gap -9 to +19', () => {
    const equal = h.calculateRankDifferential(20, 20)
    assert.strictEqual(equal.outcome, 'contested')

    const slight = h.calculateRankDifferential(25, 20)
    assert.strictEqual(slight.outcome, 'contested')

    const negative = h.calculateRankDifferential(15, 20)
    assert.strictEqual(negative.outcome, 'contested')
  })

  test('defender_advantage when gap -10 to -19', () => {
    const r = h.calculateRankDifferential(10, 25)
    assert.strictEqual(r.gap, -15)
    assert.strictEqual(r.outcome, 'defender_advantage')
  })

  test('defender_dominant when gap -20 to -34', () => {
    const r = h.calculateRankDifferential(10, 40)
    assert.strictEqual(r.gap, -30)
    assert.strictEqual(r.outcome, 'defender_dominant')
  })

  test('impossible_for_attacker when gap <= -35', () => {
    const r = h.calculateRankDifferential(10, 50)
    assert.strictEqual(r.gap, -40)
    assert.strictEqual(r.outcome, 'impossible_for_attacker')
  })

  test('counts tier_crossings correctly', () => {
    // Boundaries at 25, 40, 60, 80, 95
    const r1 = h.calculateRankDifferential(10, 30)  // crosses 25
    assert.strictEqual(r1.tier_crossings, 1)

    const r2 = h.calculateRankDifferential(10, 50)  // crosses 25 and 40
    assert.strictEqual(r2.tier_crossings, 2)

    const r3 = h.calculateRankDifferential(20, 22)  // no crossing
    assert.strictEqual(r3.tier_crossings, 0)
  })
})

// ═══════════════════════════════════════════════════════════
// GROUP 2 — calculateWoundSeverity
// ═══════════════════════════════════════════════════════════

group('2. calculateWoundSeverity', () => {
  test('superficial when gap <= -15', () => {
    const r = h.calculateWoundSeverity(5, 25)  // gap = -20
    assert.strictEqual(r.severity, 'superficial')
    assert.strictEqual(r.fills_slot, false)
    assert.strictEqual(r.penalty, 0)
  })

  test('minor when gap -14 to -5', () => {
    const r = h.calculateWoundSeverity(15, 25)  // gap = -10
    assert.strictEqual(r.severity, 'minor')
    assert.strictEqual(r.fills_slot, false)
    assert.strictEqual(r.penalty, 0)
  })

  test('moderate when gap -4 to +4', () => {
    const r = h.calculateWoundSeverity(22, 20)  // gap = +2
    assert.strictEqual(r.severity, 'moderate')
    assert.strictEqual(r.fills_slot, true)
    assert.strictEqual(r.penalty, 5)
  })

  test('serious when gap +5 to +14', () => {
    const r = h.calculateWoundSeverity(30, 20)  // gap = +10
    assert.strictEqual(r.severity, 'serious')
    assert.strictEqual(r.fills_slot, true)
    assert.strictEqual(r.penalty, 10)
  })

  test('critical when gap >= +15', () => {
    const r = h.calculateWoundSeverity(40, 20)  // gap = +20
    assert.strictEqual(r.severity, 'critical')
    assert.strictEqual(r.fills_slot, true)
    assert.strictEqual(r.penalty, 15)
  })

  test('boundary at gap -5 is minor not superficial', () => {
    const r = h.calculateWoundSeverity(15, 20)  // gap = -5
    assert.strictEqual(r.severity, 'minor')
  })

  test('boundary at gap +5 is serious not moderate', () => {
    const r = h.calculateWoundSeverity(25, 20)  // gap = +5
    assert.strictEqual(r.severity, 'serious')
  })
})

// ═══════════════════════════════════════════════════════════
// GROUP 3 — calculateEffectiveRanks
// ═══════════════════════════════════════════════════════════

group('3. calculateEffectiveRanks', () => {
  test('returns zeroes for nonexistent game', () => {
    const r = h.calculateEffectiveRanks('no_such_game')
    assert.strictEqual(r.effective.combat, 0)
    assert.strictEqual(r.effective.social, 0)
    assert.strictEqual(r.effective.magic, 0)
  })

  test('returns base ranks with no penalties', () => {
    storage.upsertGameMechanics(GAME_ID, {
      player_combat_rank: 18,
      player_social_rank: 14,
      player_magic_rank:  6,
      wound_penalty:      0,
      exhaustion:         'none',
      hunger:             'none',
    })
    const r = h.calculateEffectiveRanks(GAME_ID)
    assert.strictEqual(r.effective.combat, 18)
    assert.strictEqual(r.effective.social, 14)
    assert.strictEqual(r.effective.magic,  6)
    assert.strictEqual(r.penalties.wound,  0)
  })

  test('applies wound penalty to combat and magic/2', () => {
    storage.upsertGameMechanics(GAME_ID, {
      player_combat_rank: 18,
      player_social_rank: 14,
      player_magic_rank:  10,
      wound_penalty:      10,
      exhaustion:         'none',
      hunger:             'none',
    })
    const r = h.calculateEffectiveRanks(GAME_ID)
    assert.strictEqual(r.effective.combat, 8)   // 18 - 10
    assert.strictEqual(r.effective.social, 14)  // unchanged
    assert.strictEqual(r.effective.magic,  5)   // 10 - floor(10/2)
  })

  test('applies exhaustion to combat and social', () => {
    storage.upsertGameMechanics(GAME_ID, {
      player_combat_rank: 18,
      player_social_rank: 14,
      player_magic_rank:  6,
      wound_penalty:      0,
      exhaustion:         'moderate',
      hunger:             'none',
    })
    const r = h.calculateEffectiveRanks(GAME_ID)
    assert.strictEqual(r.penalties.exhaustion, 5)
    assert.strictEqual(r.effective.combat, 13)  // 18 - 5
    assert.strictEqual(r.effective.social, 9)   // 14 - 5
  })

  test('hunger affects combat only', () => {
    storage.upsertGameMechanics(GAME_ID, {
      player_combat_rank: 18,
      player_social_rank: 14,
      player_magic_rank:  6,
      wound_penalty:      0,
      exhaustion:         'none',
      hunger:             'mild',
    })
    const r = h.calculateEffectiveRanks(GAME_ID)
    assert.strictEqual(r.penalties.hunger,  2)
    assert.strictEqual(r.effective.combat, 16)  // 18 - 2
    assert.strictEqual(r.effective.social, 14)  // unchanged
  })

  test('effective rank cannot go below 0', () => {
    storage.upsertGameMechanics(GAME_ID, {
      player_combat_rank: 5,
      player_social_rank: 5,
      player_magic_rank:  5,
      wound_penalty:      15,
      exhaustion:         'severe',
      hunger:             'severe',
    })
    const r = h.calculateEffectiveRanks(GAME_ID)
    assert.strictEqual(r.effective.combat, 0)
    assert.strictEqual(r.effective.social, 0)
    assert.strictEqual(r.effective.magic,  0)
  })
})

// ═══════════════════════════════════════════════════════════
// GROUP 4 — getEntityTierForRank
// ═══════════════════════════════════════════════════════════

group('4. getEntityTierForRank', () => {
  test('0 is human',                    () => assert.strictEqual(h.getEntityTierForRank(0),   'human'))
  test('25 is human',                   () => assert.strictEqual(h.getEntityTierForRank(25),  'human'))
  test('26 is augmented',               () => assert.strictEqual(h.getEntityTierForRank(26),  'augmented'))
  test('40 is augmented',               () => assert.strictEqual(h.getEntityTierForRank(40),  'augmented'))
  test('41 is lesser_supernatural',     () => assert.strictEqual(h.getEntityTierForRank(41),  'lesser_supernatural'))
  test('60 is lesser_supernatural',     () => assert.strictEqual(h.getEntityTierForRank(60),  'lesser_supernatural'))
  test('61 is greater_supernatural',    () => assert.strictEqual(h.getEntityTierForRank(61),  'greater_supernatural'))
  test('80 is greater_supernatural',    () => assert.strictEqual(h.getEntityTierForRank(80),  'greater_supernatural'))
  test('81 is divine_adjacent',         () => assert.strictEqual(h.getEntityTierForRank(81),  'divine_adjacent'))
  test('95 is divine_adjacent',         () => assert.strictEqual(h.getEntityTierForRank(95),  'divine_adjacent'))
  test('96 is true_divine',             () => assert.strictEqual(h.getEntityTierForRank(96),  'true_divine'))
  test('100 is true_divine',            () => assert.strictEqual(h.getEntityTierForRank(100), 'true_divine'))
})

// ═══════════════════════════════════════════════════════════
// GROUP 5 — calculateRequiredEncounterRank
// ═══════════════════════════════════════════════════════════

group('5. calculateRequiredEncounterRank', () => {
  test('returns effective combat when no escalation', () => {
    storage.upsertGameMechanics(GAME_ID, {
      player_combat_rank: 18,
      player_social_rank: 14,
      player_magic_rank:  0,
      wound_penalty:      0,
      exhaustion:         'none',
      hunger:             'none',
    })
    storage.upsertDifficultyTracker(GAME_ID, {
      combat_since_wound: 0,
      escalation_rate:    3,
    })
    const rank = h.calculateRequiredEncounterRank(GAME_ID)
    assert.strictEqual(rank, 18)
  })

  test('escalates by escalation_rate per combat exchange', () => {
    storage.upsertGameMechanics(GAME_ID, {
      player_combat_rank: 15,
      wound_penalty:      0,
      exhaustion:         'none',
      hunger:             'none',
    })
    storage.upsertDifficultyTracker(GAME_ID, {
      combat_since_wound: 4,
      escalation_rate:    3,
    })
    const rank = h.calculateRequiredEncounterRank(GAME_ID)
    assert.strictEqual(rank, 27)  // 15 + (4 * 3)
  })

  test('caps at 95', () => {
    storage.upsertGameMechanics(GAME_ID, {
      player_combat_rank: 20,
      wound_penalty:      0,
      exhaustion:         'none',
      hunger:             'none',
    })
    storage.upsertDifficultyTracker(GAME_ID, {
      combat_since_wound: 100,
      escalation_rate:    3,
    })
    const rank = h.calculateRequiredEncounterRank(GAME_ID)
    assert.strictEqual(rank, 95)
  })
})

// ═══════════════════════════════════════════════════════════
// GROUP 6 — updateDifficultyTracker
// ═══════════════════════════════════════════════════════════

group('6. updateDifficultyTracker', () => {
  test('increments combat_since_wound on combat scene', () => {
    storage.upsertDifficultyTracker(GAME_ID, {
      combat_since_wound: 1,
      wound_threshold:    10,
      escalation_rate:    3,
      active_directives:  '[]',
    })
    h.updateDifficultyTracker(GAME_ID, { sceneType: 'combat', woundOccurred: false })
    const tracker = storage.getDifficultyTracker(GAME_ID)
    assert.strictEqual(tracker.combat_since_wound, 2)
  })

  test('resets combat_since_wound when wound occurred', () => {
    storage.upsertDifficultyTracker(GAME_ID, {
      combat_since_wound: 5,
      wound_threshold:    10,
      active_directives:  '[]',
    })
    h.updateDifficultyTracker(GAME_ID, { sceneType: 'combat', woundOccurred: true })
    const tracker = storage.getDifficultyTracker(GAME_ID)
    assert.strictEqual(tracker.combat_since_wound, 0)
  })

  test('fires wound directive when threshold crossed', () => {
    storage.upsertDifficultyTracker(GAME_ID, {
      combat_since_wound: 2,
      wound_threshold:    3,
      escalation_rate:    3,
      active_directives:  '[]',
    })
    storage.upsertGameMechanics(GAME_ID, {
      player_combat_rank: 15,
      wound_penalty:      0,
      exhaustion:         'none',
      hunger:             'none',
    })
    const result = h.updateDifficultyTracker(GAME_ID, { sceneType: 'combat', woundOccurred: false })
    assert.ok(result.directives_fired.length > 0)
    assert.strictEqual(result.directives_fired[0].type, 'wound')
  })

  test('does not fire wound directive twice', () => {
    const existing = [{ type: 'wound', minimum_encounter_rank: 20, entity_tier: 'human' }]
    storage.upsertDifficultyTracker(GAME_ID, {
      combat_since_wound: 99,
      wound_threshold:    3,
      escalation_rate:    3,
      active_directives:  JSON.stringify(existing),
    })
    const result = h.updateDifficultyTracker(GAME_ID, { sceneType: 'combat', woundOccurred: false })
    assert.strictEqual(result.directives_fired.length, 0)
  })

  test('consecutive_successes resets on setback', () => {
    storage.upsertDifficultyTracker(GAME_ID, {
      consecutive_successes: 3,
      active_directives:     '[]',
    })
    h.updateDifficultyTracker(GAME_ID, { sceneType: 'social', setbackOccurred: true })
    const tracker = storage.getDifficultyTracker(GAME_ID)
    assert.strictEqual(tracker.consecutive_successes, 0)
  })
})

// ═══════════════════════════════════════════════════════════
// GROUP 7 — validateGrowth
// ═══════════════════════════════════════════════════════════

group('7. validateGrowth', () => {
  test('new_skill is always valid', () => {
    const r = h.validateGrowth(GAME_ID, 'new_skill', 'athletics')
    assert.strictEqual(r.valid, true)
  })

  test('rank_increase valid when no previous milestones', () => {
    storage.db.prepare('DELETE FROM milestone_log WHERE game_id = ?').run(GAME_ID)
    const r = h.validateGrowth(GAME_ID, 'rank_increase', 'combat')
    assert.strictEqual(r.valid, true)
  })

  test('skill_increase fails below 5 activity', () => {
    storage.upsertSkillRank(GAME_ID, {
      skill_name:     'swords',
      rank:           5,
      ceiling:        40,
      activity_count: 3,
    })
    const r = h.validateGrowth(GAME_ID, 'skill_increase', 'swords')
    assert.strictEqual(r.valid, false)
    assert.ok(r.reason.includes('3'))
  })

  test('skill_increase valid at 5 activity', () => {
    storage.upsertSkillRank(GAME_ID, {
      skill_name:     'swords',
      rank:           5,
      ceiling:        40,
      activity_count: 5,
    })
    const r = h.validateGrowth(GAME_ID, 'skill_increase', 'swords')
    assert.strictEqual(r.valid, true)
  })

  test('skill_increase fails at ceiling', () => {
    storage.upsertSkillRank(GAME_ID, {
      skill_name:     'swords',
      rank:           40,
      ceiling:        40,
      activity_count: 10,
    })
    const r = h.validateGrowth(GAME_ID, 'skill_increase', 'swords')
    assert.strictEqual(r.valid, false)
    assert.ok(r.reason.includes('ceiling'))
  })

  test('companion_rankup fails below 5 combat exchanges', () => {
    storage.upsertCompanionState(GAME_ID, {
      tag_id:              'tag_companion_a',
      combat_rank:         12,
      exchanges_in_combat: 2,
    })
    const r = h.validateGrowth(GAME_ID, 'companion_rankup', 'tag_companion_a')
    assert.strictEqual(r.valid, false)
  })

  test('companion_rankup valid at 5 combat exchanges', () => {
    storage.upsertCompanionState(GAME_ID, {
      tag_id:              'tag_companion_a',
      combat_rank:         12,
      exchanges_in_combat: 5,
    })
    const r = h.validateGrowth(GAME_ID, 'companion_rankup', 'tag_companion_a')
    assert.strictEqual(r.valid, true)
  })

  test('unknown growthType returns invalid', () => {
    const r = h.validateGrowth(GAME_ID, 'something_else', 'combat')
    assert.strictEqual(r.valid, false)
  })
})

// ═══════════════════════════════════════════════════════════
// GROUP 8 — runTimeDegradation
// ═══════════════════════════════════════════════════════════

group('8. runTimeDegradation', () => {
  test('recommends wound worsening for untreated wounds', () => {
    storage.upsertGameMechanics(GAME_ID, {
      wound_slot_1:  'minor',
      wound_slot_2:  'empty',
      wound_slot_3:  'empty',
      wound_penalty: 0,
    })
    const r = h.runTimeDegradation(GAME_ID)
    const rec = r.recommendations.find(x => x.type === 'wound_worsening')
    assert.ok(rec)
    assert.strictEqual(rec.current_severity, 'minor')
    assert.strictEqual(rec.recommended_severity, 'moderate')
  })

  test('no wound recommendations when all slots empty', () => {
    storage.upsertGameMechanics(GAME_ID, {
      wound_slot_1: 'empty',
      wound_slot_2: 'empty',
      wound_slot_3: 'empty',
    })
    const r = h.runTimeDegradation(GAME_ID)
    const woundRecs = r.recommendations.filter(x => x.type === 'wound_worsening')
    assert.strictEqual(woundRecs.length, 0)
  })

  test('flags stale pending flags (held >= 3 exchanges)', () => {
    storage.addPendingFlag(GAME_ID, {
      source_agent:   'mechanics',
      flag_content:   'Red Sails patrol spotted',
      exchanges_held: 3,
      status:         'pending',
    })
    const r = h.runTimeDegradation(GAME_ID)
    const flagRecs = r.recommendations.filter(x => x.type === 'stale_flag')
    assert.ok(flagRecs.length > 0)
  })

  test('does not write to database', () => {
    const before = storage.getGameMechanics(GAME_ID)
    h.runTimeDegradation(GAME_ID)
    const after = storage.getGameMechanics(GAME_ID)
    assert.strictEqual(before.wound_slot_1, after.wound_slot_1)
    assert.strictEqual(before.updated_at, after.updated_at)
  })
})

// ═══════════════════════════════════════════════════════════
// GROUP 9 — buildAmbientIndex and assembleBrief
// ═══════════════════════════════════════════════════════════

group('9. buildAmbientIndex and assembleBrief', () => {
  test('buildAmbientIndex returns "none" when no tags', () => {
    const index = h.buildAmbientIndex(GAME_ID)
    assert.ok(index.includes('[AMBIENT INDEX]'))
    assert.ok(index.includes('none'))
  })

  test('buildAmbientIndex groups tags by type', () => {
    storage.upsertTag(GAME_ID, {
      id:             'tag_grigor',
      tag_type:       'npc',
      canonical_name: 'Grigor',
      status:         'active',
      confirmed:      1,
    })
    storage.upsertTag(GAME_ID, {
      id:             'tag_east_dock',
      tag_type:       'location',
      canonical_name: 'East Dock',
      status:         'active',
      confirmed:      1,
    })
    const index = h.buildAmbientIndex(GAME_ID)
    assert.ok(index.includes('[AMBIENT INDEX]'))
    assert.ok(index.includes('npc: tag_grigor'))
    assert.ok(index.includes('location: tag_east_dock'))
  })

  test('assembleBrief includes all four sections', () => {
    storage.upsertGameMechanics(GAME_ID, {
      player_combat_rank: 15,
      player_social_rank: 12,
      player_magic_rank:  0,
      wound_penalty:      0,
      exhaustion:         'none',
      hunger:             'none',
      wound_slot_1:       'empty',
      wound_slot_2:       'empty',
      wound_slot_3:       'empty',
      essence_current:    0,
      essence_max:        0,
    })
    storage.upsertDifficultyTracker(GAME_ID, { active_directives: '[]' })
    storage.db.prepare('DELETE FROM consequence_ledger WHERE game_id = ?').run(GAME_ID)

    const brief = h.assembleBrief(GAME_ID, {
      character: 'Character agent response here',
      npc:       'NPC agent response here',
    })
    assert.ok(brief.includes('[PLAYER STATE]'))
    assert.ok(brief.includes('[ACTIVE DIRECTIVES]'))
    assert.ok(brief.includes('[OPEN CONSEQUENCES]'))
    assert.ok(brief.includes('[AGENT RESPONSES]'))
    assert.ok(brief.includes('Character agent response here'))
    assert.ok(brief.includes('NPC agent response here'))
  })

  test('assembleBrief includes wound directive when active', () => {
    const directives = [{ type: 'wound', minimum_encounter_rank: 22, entity_tier: 'human' }]
    storage.upsertDifficultyTracker(GAME_ID, { active_directives: JSON.stringify(directives) })
    const brief = h.assembleBrief(GAME_ID, {})
    assert.ok(brief.includes('⚑ DIRECTIVE: wound'))
    assert.ok(brief.includes('22'))
  })

  test('assembleBrief shows open consequences', () => {
    storage.db.prepare("DELETE FROM consequence_ledger WHERE game_id = ?").run(GAME_ID)
    storage.addConsequence(GAME_ID, {
      consequence_type: 'Red_Sails_debt',
      description:      'Ajax humiliated a Red Sails man publicly',
      severity:         'medium',
      status:           'open',
    })
    const brief = h.assembleBrief(GAME_ID, {})
    assert.ok(brief.includes('Red_Sails_debt'))
    assert.ok(brief.includes('Ajax humiliated'))
  })
})

// ═══════════════════════════════════════════════════════════
// TEARDOWN
// ═══════════════════════════════════════════════════════════

teardown()

console.log(`\n${'═'.repeat(50)}`)
console.log(`  ${passed} passed, ${failed} failed`)
console.log('═'.repeat(50))

if (failed > 0) process.exit(1)
