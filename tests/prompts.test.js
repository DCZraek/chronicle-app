// ═══════════════════════════════════════════════════════════
// prompts.test.js — Phase 3: Agent architecture tests
// Run with: node tests/prompts.test.js
//
// Groups 1-4 require no Ollama (instant).
// Groups 5-6 require Ollama running with llama3.1:8b-instruct-q8_0.
// Ollama tests may take 5-15 seconds each.
// ═══════════════════════════════════════════════════════════

const assert  = require('assert')
const storage = require('../storage')
const agents  = require('../agents')

// ── Test helpers ─────────────────────────────────────────

let passed = 0
let failed = 0
let skipped = 0

function test(name, fn) {
  try {
    const result = fn()
    if (result && typeof result.then === 'function') {
      // Return promise so async groups await it
      return result
        .then(() => { console.log(`  ✓ ${name}`); passed++ })
        .catch(e  => { console.log(`  ✗ ${name}`); console.log(`    ${e.message}`); failed++ })
    }
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}`)
    console.log(`    ${e.message}`)
    failed++
  }
}

function skip(name, reason) {
  console.log(`  - ${name} (SKIP: ${reason})`)
  skipped++
}

function group(name, fn) {
  console.log(`\n${name}`)
  return fn()
}

async function asyncGroup(name, fn) {
  console.log(`\n${name}`)
  await fn()
}

// ── Check if Ollama is available ─────────────────────────

async function ollamaAvailable() {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

// ── Setup ─────────────────────────────────────────────────

const GAME_ID = `test_agents_${Date.now()}`

function setup() {
  storage.db.prepare(
    `INSERT INTO games (id, name, created_at, last_played)
     VALUES (?, 'Agents Test', datetime('now'), datetime('now'))`
  ).run(GAME_ID)
  storage.initializeGameRows(GAME_ID)
}

function teardown() {
  storage.db.prepare('DELETE FROM games WHERE id = ?').run(GAME_ID)
}

// ═══════════════════════════════════════════════════════════
// GROUP 1 — detectTags (no Ollama)
// ═══════════════════════════════════════════════════════════

function group1() {
  group('1. detectTags (no Ollama)', () => {

    // Create tag with alias
    storage.upsertTag(GAME_ID, {
      id:             'tag_grigor',
      tag_type:       'npc',
      canonical_name: 'Grigor',
      status:         'active',
      confirmed:      1,
    })
    storage.addAlias(GAME_ID, 'tag_grigor', 'Grigor')
    storage.addAlias(GAME_ID, 'tag_grigor', 'the old sailor')

    test('1.1: Detects known alias in player input', () => {
      const r = agents.detectTags(GAME_ID, 'I ask Grigor about the docks')
      assert.ok(r.detected_tag_ids.includes('tag_grigor'))
    })

    test('1.2: Case insensitive matching', () => {
      const r = agents.detectTags(GAME_ID, 'I ask grigor about the docks')
      assert.ok(r.detected_tag_ids.includes('tag_grigor'))
    })

    test('1.3: No match returns empty array', () => {
      const r = agents.detectTags(GAME_ID, 'I look around the room')
      assert.strictEqual(r.detected_tag_ids.length, 0)
    })

    test('1.4: Multiple tags detected', () => {
      storage.upsertTag(GAME_ID, {
        id:             'tag_east_dock',
        tag_type:       'location',
        canonical_name: 'East Dock',
        status:         'active',
        confirmed:      1,
      })
      storage.addAlias(GAME_ID, 'tag_east_dock', 'the docks')
      storage.addAlias(GAME_ID, 'tag_east_dock', 'east dock')

      const r = agents.detectTags(GAME_ID, 'I ask Grigor about the docks')
      assert.ok(r.detected_tag_ids.includes('tag_grigor'))
      assert.ok(r.detected_tag_ids.includes('tag_east_dock'))
    })

    test('1.5: Multi-word alias matched', () => {
      const r = agents.detectTags(GAME_ID, 'I find the old sailor at the tavern')
      assert.ok(r.detected_tag_ids.includes('tag_grigor'))
    })
  })
}

// ═══════════════════════════════════════════════════════════
// GROUP 2 — parseIntent (no Ollama)
// ═══════════════════════════════════════════════════════════

function group2() {
  group('2. parseIntent (no Ollama)', () => {

    test('2.1: Parses NEEDS_AGENTS response correctly', () => {
      const mock = `[NEEDS_AGENTS]
scene_type: social
location: tag_blackened_mug
active_tags: tag_ajax, tag_grigor
connected_tags: tag_find_shanks
narrative_direction: Ajax pressures Grigor for information
tone: tense`
      const r = agents.parseIntent(mock)
      assert.ok(r !== null)
      assert.strictEqual(r.scene_type, 'social')
      assert.ok(r.active_tags.includes('tag_ajax'))
      assert.ok(r.active_tags.includes('tag_grigor'))
      assert.strictEqual(r.tone, 'tense')
      assert.strictEqual(r.location, 'tag_blackened_mug')
    })

    test('2.2: Returns null for DIRECT response', () => {
      const r = agents.parseIntent('[DIRECT]\nSome prose response here')
      assert.strictEqual(r, null)
    })

    test('2.3: Returns null for malformed response', () => {
      const r = agents.parseIntent('This is not a valid intent response')
      assert.strictEqual(r, null)
    })

    test('2.4: Returns null when scene_type is missing', () => {
      const r = agents.parseIntent('[NEEDS_AGENTS]\ntone: neutral')
      assert.strictEqual(r, null)
    })

    test('2.5: Returns null for empty input', () => {
      assert.strictEqual(agents.parseIntent(''), null)
      assert.strictEqual(agents.parseIntent(null), null)
    })
  })
}

// ═══════════════════════════════════════════════════════════
// GROUP 3 — parseSyncResponse (no Ollama)
// ═══════════════════════════════════════════════════════════

function group3() {
  group('3. parseSyncResponse (no Ollama)', () => {

    test('3.1: Parses valid sync response correctly', () => {
      const mock = `[WRITES]
table: npcs
id: tag_grigor
field: attitude
old: nervous
new: relieved
evidence: "the collapse of a weight held too long"

[SKIPPED]
none

[NEW_RECORDS]
none`
      const r = agents.parseSyncResponse(mock)
      assert.strictEqual(r.sync_failed, false)
      assert.strictEqual(r.writes.length, 1)
      assert.strictEqual(r.writes[0].table, 'npcs')
      assert.strictEqual(r.writes[0].field, 'attitude')
      assert.strictEqual(r.writes[0].new, 'relieved')
    })

    test('3.2: Handles SYNC_FAILED response', () => {
      const r = agents.parseSyncResponse('SYNC_FAILED | reason: no valid SCENE_TAGS block found')
      assert.strictEqual(r.sync_failed, true)
      assert.strictEqual(r.writes.length, 0)
      assert.ok(r.failure_reason.length > 0)
    })

    test('3.3: Parses multiple writes', () => {
      const mock = `[WRITES]
table: npcs
id: tag_grigor
field: attitude
old: nervous
new: relieved
evidence: "the weight"

table: npcs
id: tag_grigor
field: disposition
old: 70
new: 78
evidence: "relieved"

[SKIPPED]
none

[NEW_RECORDS]
none`
      const r = agents.parseSyncResponse(mock)
      assert.strictEqual(r.writes.length, 2)
    })

    test('3.4: Handles empty writes section', () => {
      const mock = `[WRITES]
none

[SKIPPED]
none

[NEW_RECORDS]
none`
      const r = agents.parseSyncResponse(mock)
      assert.strictEqual(r.sync_failed, false)
      assert.strictEqual(r.writes.length, 0)
    })

    test('3.5: Handles empty response', () => {
      const r = agents.parseSyncResponse('')
      assert.strictEqual(r.sync_failed, true)
    })
  })
}

// ═══════════════════════════════════════════════════════════
// GROUP 4 — parseSceneTags (no Ollama)
// ═══════════════════════════════════════════════════════════

function group4() {
  group('4. parseSceneTags (no Ollama)', () => {

    test('4.1: Parses complete SCENE_TAGS block', () => {
      const block = `SCENE_TAGS
present: tag_ajax, tag_grigor
scene_type: social
time_advance: 2 hours
modified: tag_grigor(secrets, attitude)
new: tag_harkon | npc | mercenary captain | aliases: "Harkon", "the captain" | combat_rank: 22 | social_rank: 8 | entity_tier: human
new_relationship: tag_harkon — works_for — tag_red_sails | "hired enforcer"
disposition_change: tag_grigor | 70 | 78 | "relieved after unburdening"
new_consequence: Red_Sails_debt | Ajax humiliated a Red Sails man | medium
wound_inflicted: moderate
wound_source: tag_harkon
encounter_rank: 22
encounter_outcome: success
directive_fulfilled: wound`

      const r = agents.parseSceneTags(block)

      assert.deepStrictEqual(r.present, ['tag_ajax', 'tag_grigor'])
      assert.strictEqual(r.scene_type, 'social')
      assert.deepStrictEqual(r.time_advance, { amount: 2, unit: 'hour' })

      assert.strictEqual(r.modified.length, 1)
      assert.strictEqual(r.modified[0].tag_id, 'tag_grigor')
      assert.ok(r.modified[0].fields.includes('secrets'))

      assert.strictEqual(r.new_tags.length, 1)
      assert.strictEqual(r.new_tags[0].id, 'tag_harkon')
      assert.strictEqual(r.new_tags[0].tag_type, 'npc')
      assert.strictEqual(r.new_tags[0].combat_rank, 22)
      assert.ok(r.new_tags[0].aliases.includes('Harkon'))

      assert.strictEqual(r.new_relationships.length, 1)
      assert.strictEqual(r.new_relationships[0].tag_id_a, 'tag_harkon')
      assert.strictEqual(r.new_relationships[0].relationship, 'works_for')
      assert.strictEqual(r.new_relationships[0].tag_id_b, 'tag_red_sails')

      assert.strictEqual(r.disposition_changes.length, 1)
      assert.strictEqual(r.disposition_changes[0].tag_id, 'tag_grigor')
      assert.strictEqual(r.disposition_changes[0].new, 78)

      assert.strictEqual(r.new_consequences.length, 1)
      assert.strictEqual(r.new_consequences[0].type, 'Red_Sails_debt')
      assert.strictEqual(r.new_consequences[0].severity, 'medium')

      assert.strictEqual(r.wound_inflicted, 'moderate')
      assert.strictEqual(r.wound_source, 'tag_harkon')
      assert.strictEqual(r.encounter_rank, 22)
      assert.strictEqual(r.encounter_outcome, 'success')
      assert.ok(r.directive_fulfilled.includes('wound'))
    })

    test('4.2: Missing optional fields handled gracefully', () => {
      const minimal = `SCENE_TAGS
present: tag_ajax
scene_type: travel`

      const r = agents.parseSceneTags(minimal)
      assert.deepStrictEqual(r.present, ['tag_ajax'])
      assert.strictEqual(r.scene_type, 'travel')
      assert.strictEqual(r.time_advance, null)
      assert.strictEqual(r.wound_inflicted, null)
      assert.strictEqual(r.encounter_rank, null)
      assert.strictEqual(r.new_tags.length, 0)
      assert.strictEqual(r.new_relationships.length, 0)
    })

    test('4.3: Returns empty result for null/missing block', () => {
      const r = agents.parseSceneTags(null)
      assert.strictEqual(r.scene_type, null)
      assert.strictEqual(r.present.length, 0)
    })

    test('4.4: Parses skill declarations', () => {
      const block = `SCENE_TAGS
present: tag_ajax
scene_type: combat
new_skill: navigation | 8 | demonstrated during sea voyage
skill_increase: swords | 10 | 12 | practiced in the fight`

      const r = agents.parseSceneTags(block)
      assert.strictEqual(r.new_skills.length, 1)
      assert.strictEqual(r.new_skills[0].name, 'navigation')
      assert.strictEqual(r.new_skills[0].rank, 8)
      assert.strictEqual(r.skill_increases.length, 1)
      assert.strictEqual(r.skill_increases[0].name, 'swords')
      assert.strictEqual(r.skill_increases[0].new, 12)
    })

    test('4.5: Parses essence and resource changes', () => {
      const block = `SCENE_TAGS
present: tag_ajax
scene_type: magic
essence_spent: 3
resource_change: coin | 50 | 40 | paid for drinks`

      const r = agents.parseSceneTags(block)
      assert.strictEqual(r.essence_spent, 3)
      assert.strictEqual(r.resource_changes.length, 1)
      assert.strictEqual(r.resource_changes[0].name, 'coin')
      assert.strictEqual(r.resource_changes[0].new, '40')
    })
  })
}

// ═══════════════════════════════════════════════════════════
// GROUP 5 — Ollama integration
// ═══════════════════════════════════════════════════════════

async function group5(hasOllama) {
  await asyncGroup('5. Ollama integration (requires Ollama)', async () => {

    if (!hasOllama) {
      skip('5.1: callOllama returns a response', 'Ollama not available')
      skip('5.2: Character agent produces correct output format', 'Ollama not available')
      skip('5.3: Sync agent produces correct output format', 'Ollama not available')
      return
    }

    await test('5.1: callOllama returns a response', async () => {
      const resp = await agents.callOllama(
        'You are a helpful assistant. Reply with exactly one word.',
        'Reply with exactly the word: PONG'
      )
      assert.ok(typeof resp === 'string')
      assert.ok(resp.trim().length > 0)
      assert.ok(resp.toUpperCase().includes('PONG'), `Expected PONG in: ${resp}`)
    })

    await test('5.2: Character agent produces correct output format', async () => {
      // Set up minimal game state
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
      })

      const intent = {
        scene_type:          'social',
        location:            'tag_test_location',
        active_tags:         [],
        connected_tags:      [],
        narrative_direction: 'A simple greeting scene',
        tone:                'neutral',
      }

      // Import PROMPTS via require trick
      const fs   = require('fs')
      const path = require('path')
      const systemPrompt = fs.readFileSync(
        path.join(__dirname, '../prompts/agent_character.txt'), 'utf8'
      )
      // Build user message manually for just the character agent
      const userMessage = `RECORDS:
GAME MECHANICS: player_combat_rank=15, player_social_rank=12

INTENT:
scene_type: social
narrative_direction: A simple greeting scene
tone: neutral

Produce your structured response now. Follow the output format exactly.`

      const resp = await agents.callOllama(systemPrompt, userMessage)
      assert.ok(resp.includes('[CHARACTER]'), `Expected [CHARACTER] in response: ${resp.slice(0, 200)}`)
      assert.ok(resp.includes('[CONSTRAINTS]'), `Expected [CONSTRAINTS] in response`)
      assert.ok(resp.includes('[FLAGS]'), `Expected [FLAGS] in response`)
    })

    await test('5.3: Sync agent produces correct output format', async () => {
      const narrative = `The old sailor looked up from his mug, his eyes wary.
"What do you want to know?" he muttered.

SCENE_TAGS
present: tag_grigor
scene_type: social`

      const currentRecords = `NPC Grigor:
{ "name": "Grigor", "attitude": "nervous", "secrets": "Knows something" }`

      // Build sync system prompt for NPC domain
      const fs   = require('fs')
      const path = require('path')
      let syncPrompt = fs.readFileSync(path.join(__dirname, '../prompts/sync_prompt.txt'), 'utf8')
      syncPrompt = syncPrompt
        .replace('[CHARACTER | NPC | PLOT | WORLD | MECHANICS]', 'NPC')
        .replace('[domain]', 'NPC')
        .replace('[Filled at runtime with full narrator response including SCENE_TAGS]', narrative)
        .replace(
          /\[Filled at runtime with current database records for modified tags[\s\S]*?in this domain\]/,
          currentRecords
        )

      const resp = await agents.callOllama(syncPrompt, 'Produce your sync output now.')
      assert.ok(resp.includes('[WRITES]'),      `Expected [WRITES] in sync response`)
      assert.ok(resp.includes('[SKIPPED]'),     `Expected [SKIPPED] in sync response`)
      assert.ok(resp.includes('[NEW_RECORDS]'), `Expected [NEW_RECORDS] in sync response`)
    })
  })
}

// ═══════════════════════════════════════════════════════════
// GROUP 6 — runSyncPass integration
// ═══════════════════════════════════════════════════════════

async function group6(hasOllama) {
  await asyncGroup('6. runSyncPass integration (requires Ollama)', async () => {

    if (!hasOllama) {
      skip('6.1: Sync pass creates new tag from SCENE_TAGS', 'Ollama not available')
      skip('6.2: Sync pass creates relationship from SCENE_TAGS', 'Ollama not available')
      skip('6.3: Sync pass updates difficulty tracker', 'Ollama not available')
      skip('6.4: Wound resets difficulty tracker', 'Ollama not available')
      return
    }

    await test('6.1: Sync pass creates new tag from SCENE_TAGS', async () => {
      const narrative = `A figure emerged from the shadows — clearly someone new to the docks.

SCENE_TAGS
present: tag_ajax
scene_type: social
new: tag_new_npc_6_1 | npc | A mysterious stranger at the docks | aliases: "the stranger"`

      const r = await agents.runSyncPass(GAME_ID, narrative, narrative)
      // Tag should be created regardless of Ollama (Step 2 - immediate writes)
      const tag = storage.getTag(GAME_ID, 'tag_new_npc_6_1')
      assert.ok(tag, 'Tag should have been created')
      assert.strictEqual(tag.tag_type, 'npc')

      // Alias should be findable
      const found = storage.findTagByAlias(GAME_ID, 'the stranger')
      assert.ok(found, 'Should find tag by alias')
    })

    await test('6.2: Sync pass creates relationship from SCENE_TAGS', async () => {
      // Ensure both tags exist first
      storage.upsertTag(GAME_ID, {
        id: 'tag_rel_test_a', tag_type: 'npc',
        canonical_name: 'NPC A', status: 'active', confirmed: 1,
      })
      storage.upsertTag(GAME_ID, {
        id: 'tag_rel_test_b', tag_type: 'npc',
        canonical_name: 'NPC B', status: 'active', confirmed: 1,
      })

      const narrative = `They had clearly met before.

SCENE_TAGS
present: tag_ajax, tag_rel_test_a, tag_rel_test_b
scene_type: social
new_relationship: tag_rel_test_a — knows — tag_rel_test_b | "met at the tavern"`

      await agents.runSyncPass(GAME_ID, narrative, narrative)
      const rels = storage.getRelationships(GAME_ID, 'tag_rel_test_a')
      assert.ok(rels.length > 0, 'Relationship should have been created')
      assert.ok(rels.some(r => r.relationship === 'knows'))
    })

    await test('6.3: Sync pass updates difficulty tracker on combat', async () => {
      storage.upsertDifficultyTracker(GAME_ID, {
        combat_since_wound: 0,
        wound_threshold:    10,
        escalation_rate:    3,
        active_directives:  '[]',
      })

      const narrative = `A brief scuffle with a dock rat — nothing serious.

SCENE_TAGS
present: tag_ajax
scene_type: combat
encounter_outcome: success`

      await agents.runSyncPass(GAME_ID, narrative, narrative)
      const tracker = storage.getDifficultyTracker(GAME_ID)
      assert.strictEqual(tracker.combat_since_wound, 1, 'combat_since_wound should have incremented')
    })

    await test('6.4: Wound resets difficulty tracker', async () => {
      storage.upsertDifficultyTracker(GAME_ID, {
        combat_since_wound: 3,
        wound_threshold:    10,
        escalation_rate:    3,
        active_directives:  '[]',
      })

      const narrative = `The knife caught Ajax across the forearm — a moderate wound.

SCENE_TAGS
present: tag_ajax
scene_type: combat
wound_inflicted: moderate
wound_source: tag_grigor
encounter_outcome: partial`

      await agents.runSyncPass(GAME_ID, narrative, narrative)
      const tracker = storage.getDifficultyTracker(GAME_ID)
      assert.strictEqual(tracker.combat_since_wound, 0, 'combat_since_wound should have reset after wound')

      // Wound slot should be filled
      const mech = storage.getGameMechanics(GAME_ID)
      const woundFilled = mech.wound_slot_1 === 'moderate' || mech.wound_slot_2 === 'moderate' || mech.wound_slot_3 === 'moderate'
      assert.ok(woundFilled, 'A moderate wound slot should be filled')
    })
  })
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  setup()

  try {
    group1()
    group2()
    group3()
    group4()

    const hasOllama = await ollamaAvailable()
    if (!hasOllama) {
      console.log('\n  ⚠  Ollama not available — Groups 5-6 will be skipped')
    }

    await group5(hasOllama)
    await group6(hasOllama)

  } finally {
    teardown()
  }

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  ${passed} passed, ${failed} failed, ${skipped} skipped`)
  console.log('═'.repeat(50))

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Test runner error:', err)
  process.exit(1)
})
