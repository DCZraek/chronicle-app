// ═══════════════════════════════════════════════════════════
// mechanical.test.js — Phase 1 database tests
// Run with: node tests/mechanical.test.js
// ═══════════════════════════════════════════════════════════

const storage = require('../storage')
const assert  = require('assert')

const GAME_ID  = 'test-phase1-' + Date.now()
let passed = 0
let failed = 0
const failures = []

function test(label, fn) {
  try {
    fn()
    console.log(`PASS: ${label}`)
    passed++
  } catch (e) {
    console.log(`FAIL: ${label}`)
    console.log(`  Error: ${e.message}`)
    failures.push({ label, error: e.message })
    failed++
  }
}

// ─── Setup ───────────────────────────────────────────────
storage.createGame({ id: GAME_ID, name: 'Phase 1 Test', character: 'Tester' })
storage.initializeGameRows(GAME_ID)

// ═══════════════════════════════════════════════════════════
// GROUP 1 — Tags
// ═══════════════════════════════════════════════════════════

test('1.1 — Create a tag and retrieve it by ID', () => {
  storage.upsertTag(GAME_ID, {
    id:             'tag_test_npc',
    tag_type:       'npc',
    canonical_name: 'Test NPC',
    description:    'A test NPC',
    combat_rank:    12,
    social_rank:    8,
    entity_tier:    'human',
  })
  const tag = storage.getTag(GAME_ID, 'tag_test_npc')
  assert.ok(tag, 'tag should exist')
  assert.strictEqual(tag.canonical_name, 'Test NPC')
  assert.strictEqual(tag.tag_type, 'npc')
  assert.strictEqual(tag.combat_rank, 12)
  assert.strictEqual(tag.social_rank, 8)
  assert.strictEqual(tag.entity_tier, 'human')
  assert.strictEqual(tag.description, 'A test NPC')
})

test('1.2 — Add aliases and find tag by alias', () => {
  storage.addAlias(GAME_ID, 'tag_test_npc', 'the test npc')
  storage.addAlias(GAME_ID, 'tag_test_npc', 'Test')
  const byFull = storage.findTagByAlias(GAME_ID, 'the test npc')
  assert.ok(byFull, 'should find by full alias')
  assert.strictEqual(byFull.id, 'tag_test_npc')
  const byShort = storage.findTagByAlias(GAME_ID, 'Test')
  assert.ok(byShort, 'should find by short alias')
  assert.strictEqual(byShort.id, 'tag_test_npc')
  const missing = storage.findTagByAlias(GAME_ID, 'nonexistent alias xyz')
  assert.strictEqual(missing, null, 'should return null for unknown alias')
})

test('1.3 — Ambient index only includes active confirmed tags', () => {
  storage.upsertTag(GAME_ID, {
    id: 'tag_dormant', tag_type: 'location',
    canonical_name: 'Dormant Place', status: 'dormant', confirmed: 1,
  })
  storage.upsertTag(GAME_ID, {
    id: 'tag_unconfirmed', tag_type: 'npc',
    canonical_name: 'Unconfirmed Person', status: 'active', confirmed: 0,
  })
  const index = storage.getAmbientIndex(GAME_ID)
  const names = index.map(s => s.split(':')[0].trim())
  assert.ok(names.includes('Test NPC'), 'active confirmed tag should appear')
  assert.ok(!names.includes('Dormant Place'), 'dormant tag should not appear')
  assert.ok(!names.includes('Unconfirmed Person'), 'unconfirmed tag should not appear')
})

test('1.4 — Upsert updates existing tag', () => {
  storage.upsertTag(GAME_ID, { id: 'tag_test_npc', combat_rank: 15 })
  const tag = storage.getTag(GAME_ID, 'tag_test_npc')
  assert.strictEqual(tag.combat_rank, 15)
})

// ═══════════════════════════════════════════════════════════
// GROUP 2 — Tag Relationships
// ═══════════════════════════════════════════════════════════

test('2.1 — Create and retrieve a relationship', () => {
  storage.upsertTag(GAME_ID, {
    id: 'tag_test_faction', tag_type: 'faction',
    canonical_name: 'Test Faction',
  })
  storage.upsertRelationship(GAME_ID, {
    tag_id_a:     'tag_test_npc',
    tag_id_b:     'tag_test_faction',
    relationship: 'member_of',
    context_note: 'foot soldier',
  })
  const rels = storage.getRelationships(GAME_ID, 'tag_test_npc')
  assert.ok(rels.length >= 1, 'should have at least one relationship')
  const rel = rels.find(r => r.relationship === 'member_of')
  assert.ok(rel, 'member_of relationship should exist')
  assert.strictEqual(rel.tag_id_a, 'tag_test_npc')
  assert.strictEqual(rel.tag_id_b, 'tag_test_faction')
  assert.strictEqual(rel.context_note, 'foot soldier')
})

test('2.2 — getTagMap returns relationships for given tag IDs', () => {
  const map = storage.getTagMap(GAME_ID, ['tag_test_npc', 'tag_test_faction'])
  assert.ok(map.length >= 1, 'should return at least one relationship')
  const rel = map.find(r => r.relationship === 'member_of')
  assert.ok(rel, 'member_of relationship should appear in tag map')
})

// ═══════════════════════════════════════════════════════════
// GROUP 3 — Pending Tags and Relationships
// ═══════════════════════════════════════════════════════════

test('3.1 — Pending tags do not appear in ambient index', () => {
  storage.addPendingTag(GAME_ID, {
    id: 'tag_pending_a', tag_type: 'npc',
    canonical_name: 'Pending NPC Alpha',
  })
  const index = storage.getAmbientIndex(GAME_ID)
  const names = index.map(s => s.split(':')[0].trim())
  assert.ok(!names.includes('Pending NPC Alpha'), 'pending tag should not appear in ambient index')
})

test('3.2 — Confirm pending tag promotes it correctly', () => {
  storage.addPendingTag(GAME_ID, {
    id: 'tag_pending_b', tag_type: 'location',
    canonical_name: 'Pending Location Beta',
  })
  storage.confirmPendingTag(GAME_ID, 'tag_pending_b')
  const confirmed = storage.getTags(GAME_ID)
  const found = confirmed.find(t => t.id === 'tag_pending_b')
  assert.ok(found, 'confirmed tag should appear in getTags')
  assert.strictEqual(found.confirmed, 1)
  assert.strictEqual(found.canonical_name, 'Pending Location Beta')
})

test('3.3 — Dismiss pending tag removes it', () => {
  storage.addPendingTag(GAME_ID, {
    id: 'tag_pending_c', tag_type: 'npc',
    canonical_name: 'Pending NPC Gamma',
  })
  storage.dismissPendingTag(GAME_ID, 'tag_pending_c')
  const pending = storage.getPendingTags(GAME_ID)
  const found = pending.find(t => t.id === 'tag_pending_c')
  assert.ok(!found, 'dismissed pending tag should not appear in getPendingTags')
})

// ═══════════════════════════════════════════════════════════
// GROUP 4 — Game Mechanics
// ═══════════════════════════════════════════════════════════

test('4.1 — Default values are correct after initializeGameRows', () => {
  const m = storage.getGameMechanics(GAME_ID)
  assert.ok(m, 'game_mechanics record should exist')
  assert.strictEqual(m.player_combat_rank, 10)
  assert.strictEqual(m.player_social_rank, 10)
  assert.strictEqual(m.player_magic_rank, 0)
  assert.strictEqual(m.wound_slot_1, 'empty')
  assert.strictEqual(m.wound_slot_2, 'empty')
  assert.strictEqual(m.wound_slot_3, 'empty')
  assert.strictEqual(m.wound_penalty, 0)
  assert.strictEqual(m.exhaustion, 'none')
  assert.strictEqual(m.hunger, 'none')
})

test('4.2 — getEffectiveRanks applies wound penalty correctly', () => {
  storage.upsertGameMechanics(GAME_ID, { player_combat_rank: 15, wound_penalty: 10 })
  const ranks = storage.getEffectiveRanks(GAME_ID)
  assert.strictEqual(ranks.combat, 5, 'combat should be 15 - 10 = 5')
  assert.strictEqual(ranks.social, 10, 'social should be unaffected')
  assert.strictEqual(ranks.wound_penalty, 10)
})

test('4.3 — Upsert updates individual fields without overwriting others', () => {
  storage.upsertGameMechanics(GAME_ID, { coin: 150 })
  const m = storage.getGameMechanics(GAME_ID)
  assert.strictEqual(m.coin, 150)
  assert.strictEqual(m.player_combat_rank, 15, 'combat_rank should be unchanged at 15')
})

// ═══════════════════════════════════════════════════════════
// GROUP 5 — Difficulty Tracker
// ═══════════════════════════════════════════════════════════

test('5.1 — Default values are correct after initializeGameRows', () => {
  const dt = storage.getDifficultyTracker(GAME_ID)
  assert.ok(dt, 'difficulty_tracker record should exist')
  assert.strictEqual(dt.combat_since_wound, 0)
  assert.strictEqual(dt.wound_threshold, 3)
  assert.strictEqual(dt.escalation_rate, 3)
  const directives = storage.getActiveDirectives(GAME_ID)
  assert.deepStrictEqual(directives, [], 'active_directives should parse to empty array')
})

test('5.2 — addDirective and getActiveDirectives', () => {
  storage.addDirective(GAME_ID, {
    type: 'wound', minimum_rank: 18, tier: 'human', triggered_at_exchange: 5,
  })
  const directives = storage.getActiveDirectives(GAME_ID)
  assert.strictEqual(directives.length, 1)
  assert.strictEqual(directives[0].type, 'wound')
  assert.strictEqual(directives[0].minimum_rank, 18)
})

test('5.3 — removeDirective removes correct entry', () => {
  storage.addDirective(GAME_ID, {
    type: 'challenge', minimum_rank: 20, tier: 'human', triggered_at_exchange: 6,
  })
  storage.removeDirective(GAME_ID, 'wound')
  const directives = storage.getActiveDirectives(GAME_ID)
  assert.strictEqual(directives.length, 1)
  assert.strictEqual(directives[0].type, 'challenge')
})

// ═══════════════════════════════════════════════════════════
// GROUP 6 — Skill Ranks
// ═══════════════════════════════════════════════════════════

test('6.1 — Create skill and increment activity', () => {
  storage.upsertSkillRank(GAME_ID, { skill_name: 'navigation', rank: 12, ceiling: 40 })
  storage.incrementSkillActivity(GAME_ID, 'navigation')
  storage.incrementSkillActivity(GAME_ID, 'navigation')
  const skill = storage.getSkillRank(GAME_ID, 'navigation')
  assert.strictEqual(skill.rank, 12)
  assert.strictEqual(skill.activity_count, 2)
})

test('6.2 — incrementSkillActivity creates skill if not exists', () => {
  storage.incrementSkillActivity(GAME_ID, 'seamanship')
  const skill = storage.getSkillRank(GAME_ID, 'seamanship')
  assert.ok(skill, 'skill should have been created')
  assert.strictEqual(skill.activity_count, 1)
})

// ═══════════════════════════════════════════════════════════
// GROUP 7 — Consequence Ledger
// ═══════════════════════════════════════════════════════════

let consequenceId

test('7.1 — Add consequence and retrieve open consequences', () => {
  storage.addConsequence(GAME_ID, {
    consequence_type: 'enemy_grudge',
    description:      'Harkon wants revenge',
    severity:         'high',
  })
  const open = storage.getOpenConsequences(GAME_ID)
  const c = open.find(x => x.consequence_type === 'enemy_grudge')
  assert.ok(c, 'consequence should be present')
  assert.strictEqual(c.status, 'open')
  assert.strictEqual(c.severity, 'high')
  consequenceId = c.id
})

test('7.2 — surfaceConsequence updates status', () => {
  storage.surfaceConsequence(GAME_ID, consequenceId)
  const open = storage.getOpenConsequences(GAME_ID)
  const stillOpen = open.find(x => x.id === consequenceId)
  assert.ok(!stillOpen, 'surfaced consequence should not appear in open list')
})

test('7.3 — dismissConsequence removes from open list', () => {
  storage.addConsequence(GAME_ID, {
    consequence_type: 'debt',
    description:      'Owes the harbor master',
    severity:         'medium',
  })
  const before = storage.getOpenConsequences(GAME_ID)
  const debt = before.find(x => x.consequence_type === 'debt')
  assert.ok(debt, 'debt consequence should exist before dismiss')
  storage.dismissConsequence(GAME_ID, debt.id)
  const after = storage.getOpenConsequences(GAME_ID)
  const stillThere = after.find(x => x.id === debt.id)
  assert.ok(!stillThere, 'dismissed consequence should not appear in open list')
})

// ═══════════════════════════════════════════════════════════
// GROUP 8 — Pending Flags
// ═══════════════════════════════════════════════════════════

let flagId1, flagId2

test('8.1 — Add flag and retrieve pending flags', () => {
  storage.addPendingFlag(GAME_ID, {
    source_agent: 'world',
    flag_content: 'Red Sails patrol nearby',
  })
  const flags = storage.getPendingFlags(GAME_ID)
  const f = flags.find(x => x.flag_content === 'Red Sails patrol nearby')
  assert.ok(f, 'flag should be present')
  assert.strictEqual(f.exchanges_held, 0)
  flagId1 = f.id
})

test('8.2 — incrementFlagAge increments all pending flags', () => {
  storage.addPendingFlag(GAME_ID, {
    source_agent: 'mechanics',
    flag_content: 'Wound threshold crossed',
  })
  const all = storage.getPendingFlags(GAME_ID)
  flagId2 = all.find(x => x.flag_content === 'Wound threshold crossed').id

  storage.incrementFlagAge(GAME_ID)
  const after1 = storage.getPendingFlags(GAME_ID)
  for (const f of after1) {
    assert.strictEqual(f.exchanges_held, 1, `flag ${f.id} should have exchanges_held:1`)
  }
  storage.incrementFlagAge(GAME_ID)
  const after2 = storage.getPendingFlags(GAME_ID)
  for (const f of after2) {
    assert.strictEqual(f.exchanges_held, 2, `flag ${f.id} should have exchanges_held:2`)
  }
})

test('8.3 — dismissFlag removes flag from pending list', () => {
  storage.dismissFlag(GAME_ID, flagId1, 'narrator used it')
  const flags = storage.getPendingFlags(GAME_ID)
  const dismissed = flags.find(x => x.id === flagId1)
  assert.ok(!dismissed, 'dismissed flag should not appear in pending list')
  const remaining = flags.find(x => x.id === flagId2)
  assert.ok(remaining, 'second flag should still be present')
})

// ═══════════════════════════════════════════════════════════
// GROUP 9 — Faction Heat
// ═══════════════════════════════════════════════════════════

test('9.1 — Set and retrieve faction heat', () => {
  storage.upsertTag(GAME_ID, {
    id: 'tag_red_sails', tag_type: 'faction',
    canonical_name: 'Red Sails',
  })
  storage.upsertFactionHeat(GAME_ID, 'tag_red_sails', 67)
  const heat = storage.getFactionHeatByTag(GAME_ID, 'tag_red_sails')
  assert.ok(heat, 'faction heat record should exist')
  assert.strictEqual(heat.heat, 67)
})

test('9.2 — getHighHeatFactions returns correct results', () => {
  storage.upsertTag(GAME_ID, {
    id: 'tag_harbor_watch', tag_type: 'faction',
    canonical_name: 'Harbor Watch',
  })
  storage.upsertFactionHeat(GAME_ID, 'tag_harbor_watch', 30)
  const high = storage.getHighHeatFactions(GAME_ID, 50)
  const ids = high.map(h => h.tag_id)
  assert.ok(ids.includes('tag_red_sails'), 'Red Sails (heat 67) should be in high heat')
  assert.ok(!ids.includes('tag_harbor_watch'), 'Harbor Watch (heat 30) should not be in high heat')
})

// ═══════════════════════════════════════════════════════════
// GROUP 10 — Knowledge Scope
// ═══════════════════════════════════════════════════════════

test('10.1 — Create and retrieve knowledge scope', () => {
  storage.upsertKnowledgeScope(GAME_ID, {
    tag_id:                      'tag_test_npc',
    knows_immediate_superior:    'Voss at the warehouse',
    knows_organization_structure:'none',
    knows_plans:                 'immediate',
    knows_location_of:           '["harbor warehouse"]',
    has_met:                     '["tag_voss"]',
  })
  const scope = storage.getKnowledgeScope(GAME_ID, 'tag_test_npc')
  assert.ok(scope, 'knowledge scope should exist')
  assert.strictEqual(scope.knows_immediate_superior, 'Voss at the warehouse')
  assert.strictEqual(scope.knows_organization_structure, 'none')
  assert.strictEqual(scope.knows_plans, 'immediate')
  assert.strictEqual(scope.knows_location_of, '["harbor warehouse"]')
  assert.strictEqual(scope.has_met, '["tag_voss"]')
})

test('10.2 — Upsert updates existing scope', () => {
  storage.upsertKnowledgeScope(GAME_ID, {
    tag_id:       'tag_test_npc',
    knows_plans:  'medium_term',
  })
  const scope = storage.getKnowledgeScope(GAME_ID, 'tag_test_npc')
  assert.strictEqual(scope.knows_plans, 'medium_term')
  assert.strictEqual(scope.knows_immediate_superior, 'Voss at the warehouse',
    'other fields should be unchanged')
})

// ═══════════════════════════════════════════════════════════
// GROUP 11 — Companion State
// ═══════════════════════════════════════════════════════════

test('11.1 — Create companion state and increment activity', () => {
  storage.upsertCompanionState(GAME_ID, {
    tag_id:     'tag_grigor',
    combat_rank: 8,
    loyalty:    82,
  })
  storage.incrementCompanionActivity(GAME_ID, 'tag_grigor', 'combat')
  storage.incrementCompanionActivity(GAME_ID, 'tag_grigor', 'combat')
  storage.incrementCompanionActivity(GAME_ID, 'tag_grigor', 'combat')
  storage.incrementCompanionActivity(GAME_ID, 'tag_grigor', 'base')
  const c = storage.getCompanionState(GAME_ID, 'tag_grigor')
  assert.ok(c, 'companion state should exist')
  assert.strictEqual(c.exchanges_in_combat, 3)
  assert.strictEqual(c.exchanges_at_base, 1)
  assert.strictEqual(c.loyalty, 82)
})

// ═══════════════════════════════════════════════════════════
// GROUP 12 — Integration: initializeGameRows completeness
// ═══════════════════════════════════════════════════════════

test('12.1 — All three new single-row tables are seeded', () => {
  const freshId = 'test-fresh-' + Date.now()
  storage.createGame({ id: freshId, name: 'Fresh Test', character: 'Fresh' })
  storage.initializeGameRows(freshId)
  const m  = storage.getGameMechanics(freshId)
  const dt = storage.getDifficultyTracker(freshId)
  const es = storage.getEnvironmentalState(freshId)
  assert.ok(m,  'game_mechanics should be seeded')
  assert.ok(dt, 'difficulty_tracker should be seeded')
  assert.ok(es, 'environmental_state should be seeded')
  storage.deleteGame(freshId)
})

// ─── Cleanup ─────────────────────────────────────────────
storage.deleteGame(GAME_ID)

// ─── Summary ─────────────────────────────────────────────
const total = passed + failed
console.log('')
if (failures.length > 0) {
  console.log('─── Failures ───────────────────────────────────────────')
  for (const f of failures) {
    console.log(`FAIL: ${f.label}`)
    console.log(`  ${f.error}`)
  }
  console.log('')
}
console.log(`Tests passed: ${passed}/${total}`)
console.log(`Tests failed: ${failed}/${total}`)
process.exit(failed > 0 ? 1 : 0)
