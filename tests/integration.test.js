// ═══════════════════════════════════════════════════════════
// INTEGRATION TESTS — Phase 4
// Requires server running on localhost:3000
// Run: node tests/integration.test.js
// ═══════════════════════════════════════════════════════════

require('dotenv').config()

const BASE_URL = 'http://localhost:3000/api'
const TOKEN    = process.env.CHRONICLE_TOKEN || ''
const TEST_GAME_ID = 'integration-test-' + Date.now()

let passed = 0
let failed = 0
let skipped = 0

function ok(val, label) {
  if (val) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    failed++
  }
}

function skip(label, reason) {
  console.log(`  ⊘ SKIP ${label} — ${reason}`)
  skipped++
}

async function group(name, fn) {
  console.log(`\n── ${name}`)
  try {
    await fn()
  } catch (e) {
    console.error(`  ✗ GROUP ERROR: ${e.message}`)
    failed++
  }
}

// ── HTTP helpers ─────────────────────────────────────────

async function req(method, path, body, tokenOverride) {
  const t = tokenOverride !== undefined ? tokenOverride : TOKEN
  const opts = {
    method,
    headers: {
      'authorization': `Bearer ${t}`,
      'content-type':  'application/json'
    }
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE_URL}${path}`, opts)
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

// ── Server availability check ─────────────────────────────

async function checkServer() {
  try {
    const res = await fetch(BASE_URL.replace('/api', ''), { signal: AbortSignal.timeout(3000) })
    return res.status < 500
  } catch {
    return false
  }
}

// ═══════════════════════════════════════════════════════════
// GROUP 1 — Server health
// ═══════════════════════════════════════════════════════════

async function testServerHealth() {
  await group('Server Health', async () => {
    // Root page loads without auth
    const root = await fetch('http://localhost:3000/', { signal: AbortSignal.timeout(3000) })
    ok(root.status === 200, 'root page loads (no auth required)')

    // API without token returns 403
    const noAuth = await req('GET', '/games', undefined, '')
    ok(noAuth.status === 403, 'API without token returns 403')

    // API with wrong token returns 403
    const badAuth = await req('GET', '/games', undefined, 'wrong-token')
    ok(badAuth.status === 403, 'API with wrong token returns 403')

    // API with correct token works
    const auth = await req('GET', '/games')
    ok(auth.status === 200, 'API with correct token returns 200')
    ok(Array.isArray(auth.data), 'GET /games returns array')
  })
}

// ═══════════════════════════════════════════════════════════
// GROUP 2 — Game lifecycle
// ═══════════════════════════════════════════════════════════

async function testGameLifecycle() {
  await group('Game Lifecycle', async () => {
    // Create game
    const create = await req('POST', '/games', {
      id:    TEST_GAME_ID,
      name:  'Integration Test Game',
      world: 'Test world for automated integration testing'
    })
    ok(create.status === 200 && create.data?.ok, 'create game returns ok')

    // Get game
    const get = await req('GET', `/games/${TEST_GAME_ID}`)
    ok(get.status === 200, 'get game returns 200')
    ok(get.data?.id === TEST_GAME_ID, 'returned game has correct id')
    ok(get.data?.name === 'Integration Test Game', 'returned game has correct name')

    // List games includes the new game
    const list = await req('GET', '/games')
    const found = list.data?.some(g => g.id === TEST_GAME_ID)
    ok(found, 'list games includes created game')

    // Game mechanics seeded by initializeGameRows
    const state = await req('GET', `/games/${TEST_GAME_ID}/game-state`)
    ok(state.status === 200, 'game-state seeded on create')
    ok(typeof state.data?.player_combat_rank === 'number', 'game-state has player_combat_rank')

    // Difficulty tracker seeded
    const diff = await req('GET', `/games/${TEST_GAME_ID}/difficulty`)
    ok(diff.status === 200, 'difficulty tracker seeded on create')

    // Environmental state seeded
    const env = await req('GET', `/games/${TEST_GAME_ID}/environment`)
    ok(env.status === 200, 'environmental state seeded on create')
    ok(env.data?.season === 'spring', 'environmental state defaults to spring')

    // Update last played
    const touch = await req('PATCH', `/games/${TEST_GAME_ID}/last-played`)
    ok(touch.status === 200 && touch.data?.ok, 'update last-played returns ok')
  })
}

// ═══════════════════════════════════════════════════════════
// GROUP 3 — Tag system
// ═══════════════════════════════════════════════════════════

async function testTagSystem() {
  await group('Tag System', async () => {
    // Create a tag
    const createTag = await req('POST', `/games/${TEST_GAME_ID}/tags`, {
      id:             'tag-npc-aldric',
      tag_type:       'npc',
      canonical_name: 'Aldric',
      status:         'active',
      confirmed:      1,
      relevance_score: 80,
      entity_tier:    'human',
      combat_rank:    12,
      social_rank:    15,
      description:    'A grey-bearded merchant with sharp eyes'
    })
    ok(createTag.status === 200 && createTag.data?.ok, 'create tag returns ok')

    // Get the tag
    const getTag = await req('GET', `/games/${TEST_GAME_ID}/tags/tag-npc-aldric`)
    ok(getTag.status === 200, 'get tag returns 200')
    ok(getTag.data?.canonical_name === 'Aldric', 'returned tag has correct canonical_name')
    ok(getTag.data?.combat_rank === 12, 'returned tag has correct combat_rank')

    // List tags
    const listTags = await req('GET', `/games/${TEST_GAME_ID}/tags`)
    ok(Array.isArray(listTags.data), 'list tags returns array')
    ok(listTags.data?.some(t => t.id === 'tag-npc-aldric'), 'list includes created tag')

    // Add an alias
    const alias = await req('POST', `/games/${TEST_GAME_ID}/tags/tag-npc-aldric/aliases`, {
      alias: 'the merchant'
    })
    ok(alias.status === 200 && alias.data?.ok, 'add alias returns ok')

    // Lookup by alias
    const byAlias = await req('GET', `/games/${TEST_GAME_ID}/tags/alias/the merchant`)
    ok(byAlias.status === 200, 'get tag by alias returns 200')
    ok(byAlias.data?.id === 'tag-npc-aldric', 'alias lookup returns correct tag')

    // Create a second tag for relationship test
    await req('POST', `/games/${TEST_GAME_ID}/tags`, {
      id:             'tag-location-market',
      tag_type:       'location',
      canonical_name: 'The Market District',
      status:         'active',
      confirmed:      1,
      relevance_score: 60
    })

    // Create a relationship
    const rel = await req('POST', `/games/${TEST_GAME_ID}/relationships`, {
      tag_id_a:     'tag-npc-aldric',
      tag_id_b:     'tag-location-market',
      relationship: 'operates_in',
      context_note: 'Has a stall in the east quarter',
      strength:     'strong',
      confirmed:    1
    })
    ok(rel.status === 200 && rel.data?.ok, 'create relationship returns ok')

    // List all relationships
    const rels = await req('GET', `/games/${TEST_GAME_ID}/relationships`)
    ok(Array.isArray(rels.data), 'list relationships returns array')
    ok(rels.data?.length > 0, 'relationships list is not empty')

    // Ambient index includes active confirmed tags
    const ambient = await req('GET', `/games/${TEST_GAME_ID}/ambient-index`)
    ok(ambient.status === 200, 'ambient index returns 200')
    ok(typeof ambient.data === 'string' || ambient.data !== null, 'ambient index returns data')
  })
}

// ═══════════════════════════════════════════════════════════
// GROUP 4 — Narrate endpoint (validation layer only)
// ═══════════════════════════════════════════════════════════

async function testNarrateValidation() {
  await group('Narrate Endpoint — Validation', async () => {
    // Missing gameId
    const noGame = await req('POST', '/narrate', { messages: [{ role: 'user', content: 'hello' }] })
    ok(noGame.status === 400, 'missing gameId returns 400')
    ok(noGame.data?.error?.includes('gameId'), 'error message mentions gameId')

    // Missing messages
    const noMsg = await req('POST', '/narrate', { gameId: TEST_GAME_ID })
    ok(noMsg.status === 400, 'missing messages returns 400')
    ok(noMsg.data?.error?.includes('messages'), 'error message mentions messages')

    // Empty messages array
    const emptyMsg = await req('POST', '/narrate', { gameId: TEST_GAME_ID, messages: [] })
    ok(emptyMsg.status === 400, 'empty messages array returns 400')

    // Auth required
    const noAuth = await req('POST', '/narrate', {
      gameId:   TEST_GAME_ID,
      messages: [{ role: 'user', content: 'test' }]
    }, '')
    ok(noAuth.status === 403, 'narrate without token returns 403')
  })
}

// ═══════════════════════════════════════════════════════════
// GROUP 5 — Full exchange (requires AI provider)
// ═══════════════════════════════════════════════════════════

async function testFullExchange() {
  await group('Full Exchange (AI)', async () => {
    // Check if Anthropic API key is available
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      skip('full exchange with Anthropic', 'ANTHROPIC_API_KEY not set')
      skip('SCENE_TAGS extracted from response', 'ANTHROPIC_API_KEY not set')
      skip('narrativeOnly differs from full response', 'ANTHROPIC_API_KEY not set')
      skip('sync pass triggered', 'ANTHROPIC_API_KEY not set')
      return
    }

    // Set up a minimal game context for the narrator
    await req('POST', `/games/${TEST_GAME_ID}/files/world`, {
      content: 'A grim medieval city called Ashford. Cobblestone streets. Perpetual fog.'
    })

    // Seed a world state message in the game
    const messages = [
      {
        role:    'user',
        content: '[WORLD STATE]\nLocation: Ashford market district. A grey morning. The fog hangs low.'
      },
      {
        role:    'assistant',
        content: 'The market stalls creak in the damp air. Merchants call out in half-hearted voices.'
      },
      {
        role:    'user',
        content: 'I approach the nearest stall and ask the vendor about recent news.'
      }
    ]

    const result = await req('POST', '/narrate', {
      gameId:   TEST_GAME_ID,
      messages,
      provider: 'anthropic',
      model:    'claude-opus-4-6',
      apiKey
    })

    ok(result.status === 200, 'narrate returns 200 with valid request')
    ok(typeof result.data?.response      === 'string', 'response is a string')
    ok(typeof result.data?.narrativeOnly === 'string', 'narrativeOnly is a string')
    ok(result.data?.narrativeOnly.length > 0,          'narrativeOnly is not empty')
    ok(['DIRECT', 'NEEDS_AGENTS'].includes(result.data?.routing), 'routing is DIRECT or NEEDS_AGENTS')
    ok(typeof result.data?.syncTriggered === 'boolean', 'syncTriggered is boolean')

    // narrativeOnly should not contain [SCENE_TAGS] block
    ok(!result.data?.narrativeOnly.includes('[SCENE_TAGS]'), 'narrativeOnly has SCENE_TAGS stripped')

    // If SCENE_TAGS were present, check they appear in full response but not narrativeOnly
    if (result.data?.sceneTagsBlock) {
      ok(result.data.response.includes('[SCENE_TAGS]'),      'full response contains SCENE_TAGS')
      ok(!result.data.narrativeOnly.includes('[SCENE_TAGS]'), 'narrativeOnly does not contain SCENE_TAGS')
      ok(result.data.syncTriggered === true, 'sync was triggered when SCENE_TAGS present')
    }
  })
}

// ═══════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════

async function cleanup() {
  try {
    await req('DELETE', `/games/${TEST_GAME_ID}`)
    console.log(`\n  (test game ${TEST_GAME_ID} deleted)`)
  } catch {
    console.log('\n  (cleanup: could not delete test game)')
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('Chronicle Integration Tests — Phase 4')
  console.log('Requires server running on http://localhost:3000\n')

  const serverUp = await checkServer()
  if (!serverUp) {
    console.error('ERROR: Server not running. Start with: node chronicle-server.js')
    process.exit(1)
  }
  console.log('Server: OK\n')

  if (!TOKEN) {
    console.error('ERROR: CHRONICLE_TOKEN not set in .env')
    process.exit(1)
  }

  await testServerHealth()
  await testGameLifecycle()
  await testTagSystem()
  await testNarrateValidation()
  await testFullExchange()
  await cleanup()

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`)

  if (failed > 0) process.exit(1)
}

main().catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
