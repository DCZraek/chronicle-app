// ═══════════════════════════════════════════════════════════
// SEED TEST GAME
// Creates a complete test game directly in the database,
// bypassing the interview. Seeds enough data to test the
// full game loop — narrate endpoint, agents, sync pass.
//
// Run: node tests/seed_test_game.js
// ═══════════════════════════════════════════════════════════

const storage = require('../storage')

const GAME_ID   = 'game-test-001'
const GAME_NAME = 'The Chronicle — Test Game'

function step(msg) { console.log(`\n▸ ${msg}`) }
function ok(msg)   { console.log(`  ✓ ${msg}`) }
function fail(msg) { console.error(`  ✗ FAIL: ${msg}`); process.exit(1) }

function assert(val, msg) {
  if (!val) fail(msg)
  else ok(msg)
}

const now = () => new Date().toISOString()

// ═══════════════════════════════════════════════════════════
// STEP 0 — Delete existing game-test-001 if present
// ═══════════════════════════════════════════════════════════

step('Checking for existing test game...')
const existing = storage.getGame(GAME_ID)
if (existing) {
  storage.deleteGame(GAME_ID)
  ok(`Deleted existing game "${existing.name}"`)
} else {
  ok('No existing test game found — clean slate')
}

// ═══════════════════════════════════════════════════════════
// STEP 1 — Create game and seed default rows
// ═══════════════════════════════════════════════════════════

step('Creating game...')
const ts = now()
storage.createGame({
  id:                GAME_ID,
  name:              GAME_NAME,
  character:         'Ajax',
  created_at:        ts,
  last_played:       ts,
  imported:          0,
  power_active:      0,
  enterprise_active: 0,
})
storage.initializeGameRows(GAME_ID)
ok(`Game created: "${GAME_NAME}" (${GAME_ID})`)

// ═══════════════════════════════════════════════════════════
// STEP 2 — Player character
// ═══════════════════════════════════════════════════════════

step('Seeding player character...')
storage.upsertCharacter(GAME_ID, {
  full_name:   'Ajax Vorn',
  appearance:  'A lean man in his early thirties. Dark hair, weathered face, a thin scar along his left jawline. Moves like someone who has been in enough trouble to know how to leave quietly.',
  background:  'Former city guard turned freelance operative. Has worked for three different factions in the past two years, always careful to stay useful without becoming indispensable.',
  personality: 'Pragmatic. Dry humor. Slow to trust, quick to observe. Loyal to people, not institutions.',
  abilities:   'Capable fighter, better than average. More dangerous in close quarters than at range. Good at reading people and situations.',
  equipment:   'Short sword, knife, leather armor, a purse with 34 silver, traveling clothes.',
  condition:   'Healthy. No wounds.',
  resources:   '34 silver coin, 8 days rations',
  obligations: 'Owes Aldric a report on the Shanks disappearance. Three days overdue.',
})
ok('Character: Ajax Vorn')

// ═══════════════════════════════════════════════════════════
// STEP 3 — Game mechanics
// ═══════════════════════════════════════════════════════════

step('Seeding game mechanics...')
storage.upsertGameMechanics(GAME_ID, {
  player_combat_rank:      15,
  player_social_rank:      11,
  player_magic_rank:       0,
  player_effective_combat: 15,
  player_effective_social: 11,
  player_effective_magic:  0,
  wound_slot_1:            'empty',
  wound_slot_2:            'empty',
  wound_slot_3:            'empty',
  wound_penalty:           0,
  exhaustion:              'none',
  hunger:                  'none',
  coin:                    34,
  rations:                 8,
  ammunition:              0,
  global_notoriety:        23,
})
ok('Game mechanics seeded (combat 15 / social 11 / magic 0)')

// ═══════════════════════════════════════════════════════════
// STEP 4 — Difficulty tracker
// ═══════════════════════════════════════════════════════════

step('Seeding difficulty tracker...')
storage.upsertDifficultyTracker(GAME_ID, {
  combat_since_wound:           0,
  social_since_setback:         0,
  exchanges_since_major_threat: 0,
  consecutive_successes:        0,
  exchanges_since_challenge:    0,
  magic_since_cost:             0,
  required_encounter_rank:      0,
  wound_threshold:              3,
  setback_threshold:            3,
  threat_threshold:             6,
  success_threshold:            4,
  challenge_threshold:          6,
  magic_cost_threshold:         3,
  escalation_rate:              3,
  active_directives:            '[]',
})
ok('Difficulty tracker seeded (all counters at 0)')

// ═══════════════════════════════════════════════════════════
// STEP 5 — Environmental state
// ═══════════════════════════════════════════════════════════

step('Seeding environmental state...')
storage.upsertEnvironmentalState(GAME_ID, {
  current_day: 14,
  season:      'spring',
  time_of_day: 'evening',
  weather:     'overcast',
  temperature: 'mild',
  visibility:  'full',
})
ok('Environmental state: spring, evening, overcast')

// ═══════════════════════════════════════════════════════════
// STEP 6 — World overview
// ═══════════════════════════════════════════════════════════

step('Seeding world overview...')
storage.upsertWorldOverview(GAME_ID, {
  world_name:        'The Iron Coast',
  overview:          'A region of competing port cities, merchant guilds, and pirate factions along a cold northern sea. Trade is the lifeblood of every city. Political power flows through whoever controls the docks.',
  politics:          'Harbor Councils govern most cities. The Red Sails and other pirate factions operate in the gaps between legal authority. Mercenaries and operatives like Ajax exist in the spaces between factions.',
  tone:              'Gritty. Political. Consequences are real.',
  current_tensions:  'Red Sails have been increasingly bold in Drossmark. The Harbor Council is under pressure to act. Something is shifting in the balance of power.',
})
ok('World: The Iron Coast')

// ═══════════════════════════════════════════════════════════
// STEP 7 — Tags (all 10)
// ═══════════════════════════════════════════════════════════

step('Creating tags...')

const tags = [
  {
    id:             'tag_ajax',
    tag_type:       'character',
    canonical_name: 'Ajax',
    description:    'The player character. Freelance operative.',
    status:         'active',
    confirmed:      1,
    entity_tier:    'human',
    combat_rank:    15,
    social_rank:    11,
    magic_rank:     0,
    relevance_score: 100,
    aliases:        ['Ajax', 'Ajax Vorn', 'the operative'],
  },
  {
    id:             'tag_grigor',
    tag_type:       'npc',
    canonical_name: 'Grigor',
    description:    'First mate and loyal crewman. Old sailor, been with Ajax three years.',
    status:         'active',
    confirmed:      1,
    entity_tier:    'human',
    combat_rank:    12,
    social_rank:    8,
    magic_rank:     0,
    relevance_score: 85,
    aliases:        ['Grigor', 'the first mate', 'old Grigor'],
  },
  {
    id:             'tag_aldric',
    tag_type:       'npc',
    canonical_name: 'Aldric',
    description:    'Harbor councilman. Employer. Politically connected, careful, expects results.',
    status:         'active',
    confirmed:      1,
    entity_tier:    'human',
    combat_rank:    6,
    social_rank:    18,
    magic_rank:     0,
    relevance_score: 85,
    aliases:        ['Aldric', 'the councilman', 'Councilman Aldric'],
  },
  {
    id:             'tag_shanks',
    tag_type:       'npc',
    canonical_name: 'Shanks',
    description:    'Missing ship captain. Disappeared three days ago. Reason unknown.',
    status:         'unknown',
    confirmed:      1,
    entity_tier:    'human',
    combat_rank:    14,
    social_rank:    10,
    magic_rank:     0,
    relevance_score: 90,
    aliases:        ['Shanks', 'Captain Shanks', 'the missing captain'],
  },
  {
    id:             'tag_blackened_mug',
    tag_type:       'location',
    canonical_name: 'Blackened Mug',
    description:    'A dim corner tavern on the docks district of Drossmark. Low ceiling, smoke-stained walls. Grigor drinks here most evenings.',
    status:         'active',
    confirmed:      1,
    entity_tier:    'human',
    combat_rank:    0,
    social_rank:    0,
    magic_rank:     0,
    relevance_score: 70,
    aliases:        ['Blackened Mug', 'the tavern', 'the mug'],
  },
  {
    id:             'tag_drossmark',
    tag_type:       'location',
    canonical_name: 'Drossmark',
    description:    'A mid-sized port city. Harbor trade hub. Politics run through the Harbor Council.',
    status:         'active',
    confirmed:      1,
    entity_tier:    'human',
    combat_rank:    0,
    social_rank:    0,
    magic_rank:     0,
    relevance_score: 60,
    aliases:        ['Drossmark', 'the city', 'the port'],
  },
  {
    id:             'tag_red_sails',
    tag_type:       'faction',
    canonical_name: 'Red Sails',
    description:    'Pirate faction operating in the harbor region. Hostile to Ajax. Currently active in Drossmark.',
    status:         'active',
    confirmed:      1,
    entity_tier:    'human',
    combat_rank:    0,
    social_rank:    0,
    magic_rank:     0,
    relevance_score: 75,
    aliases:        ['Red Sails', 'the pirates', 'red sails crew'],
  },
  {
    id:             'tag_harbor_council',
    tag_type:       'faction',
    canonical_name: 'Harbor Council',
    description:    'Governing body of Drossmark harbor trade. Aldric is a member. Neutral toward Ajax.',
    status:         'active',
    confirmed:      1,
    entity_tier:    'human',
    combat_rank:    0,
    social_rank:    0,
    magic_rank:     0,
    relevance_score: 65,
    aliases:        ['Harbor Council', 'the council', 'the councilmen'],
  },
  {
    id:             'tag_find_shanks',
    tag_type:       'thread',
    canonical_name: 'Find Captain Shanks',
    description:    'Active urgent thread. Shanks disappeared three days ago. Aldric hired Ajax to find him.',
    status:         'active',
    confirmed:      1,
    entity_tier:    'human',
    combat_rank:    0,
    social_rank:    0,
    magic_rank:     0,
    relevance_score: 95,
    aliases:        ['Find Shanks', 'the Shanks case', 'find captain shanks'],
  },
  {
    id:             'tag_aldric_commission',
    tag_type:       'thread',
    canonical_name: 'Aldric Commission',
    description:    'Ongoing commission from Aldric. Find Shanks, report back. Three days without contact.',
    status:         'active',
    confirmed:      1,
    entity_tier:    'human',
    combat_rank:    0,
    social_rank:    0,
    magic_rank:     0,
    relevance_score: 80,
    aliases:        ['Aldric commission', 'the commission'],
  },
]

for (const { aliases, ...fields } of tags) {
  storage.upsertTag(GAME_ID, fields)
  for (const alias of aliases) {
    storage.addAlias(GAME_ID, fields.id, alias)
  }
  ok(`Tag: ${fields.canonical_name} (${fields.tag_type}) — ${aliases.length} aliases`)
}

// ═══════════════════════════════════════════════════════════
// STEP 8 — NPC records
// ═══════════════════════════════════════════════════════════

step('Creating NPC records...')

storage.upsertNpc(GAME_ID, {
  name:             'Grigor',
  role:             'First mate, loyal crewman',
  personality:      'Steady, practical, protective of Ajax. Speaks in short sentences when nervous. Has been carrying a secret for three days.',
  relationship:     'Trusts Ajax like a son. Three years together.',
  current_status:   'Troubled. Knows something he has not said.',
  current_location: 'Blackened Mug, Drossmark',
  attitude:         'Loyal but visibly uneasy',
  secrets:          'Saw Shanks arguing with a woman in red on the east dock the night he vanished. Has told no one.',
  disposition:      70,
  loyalty:          85,
  awareness:        'unaware',
})
ok('NPC: Grigor')

storage.upsertNpc(GAME_ID, {
  name:             'Aldric',
  role:             'Harbor councilman, employer',
  personality:      'Precise, political, expects competence. Does not show frustration openly but remembers everything.',
  relationship:     'Professional. Pays well, expects results. Ajax is an asset, not a confidant.',
  current_status:   "Waiting for Ajax's report. Patience wearing thin.",
  current_location: 'Harbor Council chambers, Drossmark',
  attitude:         'Professionally neutral, privately impatient',
  secrets:          'Has his own reasons for wanting Shanks found that he has not shared with Ajax.',
  disposition:      40,
  loyalty:          30,
  awareness:        'unaware',
})
ok('NPC: Aldric')

storage.upsertNpc(GAME_ID, {
  name:             'Shanks',
  role:             'Ship captain, missing person',
  personality:      'Bold, charismatic, occasionally reckless.',
  relationship:     'Known to Ajax professionally. Not close.',
  current_status:   'Missing. Whereabouts unknown.',
  current_location: 'Unknown',
  attitude:         'N/A — missing',
  secrets:          'Was meeting someone before he vanished.',
  disposition:      0,
  loyalty:          0,
  awareness:        'unaware',
})
ok('NPC: Shanks')

// ═══════════════════════════════════════════════════════════
// STEP 9 — Knowledge scopes
// ═══════════════════════════════════════════════════════════

step('Creating knowledge scopes...')

storage.upsertKnowledgeScope(GAME_ID, {
  tag_id:                      'tag_grigor',
  knows_own_role:               1,
  knows_immediate_superior:    'Ajax — reports directly',
  knows_organization_structure: 'none',
  knows_other_cells:            'none',
  knows_finances:               'own_pay',
  knows_plans:                  'immediate',
  knows_location_of:            '["Blackened Mug", "east docks", "ship berth"]',
  has_met:                      '["tag_ajax", "tag_shanks", "tag_aldric"]',
  has_heard_of:                 '["tag_red_sails"]',
})
ok('Knowledge scope: Grigor')

storage.upsertKnowledgeScope(GAME_ID, {
  tag_id:                      'tag_aldric',
  knows_own_role:               1,
  knows_immediate_superior:    'Harbor Council leadership',
  knows_organization_structure: 'partial',
  knows_other_cells:            'adjacent',
  knows_finances:               'partial',
  knows_plans:                  'medium_term',
  knows_location_of:            '["Harbor Council chambers", "Drossmark harbor", "council safe house"]',
  has_met:                      '["tag_ajax", "tag_shanks"]',
  has_heard_of:                 '["tag_red_sails", "tag_grigor"]',
})
ok('Knowledge scope: Aldric')

storage.upsertKnowledgeScope(GAME_ID, {
  tag_id:                      'tag_shanks',
  knows_own_role:               1,
  knows_immediate_superior:    '',
  knows_organization_structure: 'none',
  knows_other_cells:            'none',
  knows_finances:               'own_pay',
  knows_plans:                  'immediate',
  knows_location_of:            '["Drossmark harbor", "east docks"]',
  has_met:                      '["tag_ajax", "tag_aldric", "tag_grigor"]',
  has_heard_of:                 '["tag_red_sails"]',
})
ok('Knowledge scope: Shanks')

// ═══════════════════════════════════════════════════════════
// STEP 10 — Thread records
// ═══════════════════════════════════════════════════════════

step('Creating thread records...')

storage.upsertThread(GAME_ID, {
  name:          'Find Captain Shanks',
  status:        'active',
  thread_type:   'investigation',
  background:    'Shanks disappeared three days ago from the Drossmark docks. No body found, no witnesses come forward. Ajax was hired by Aldric to find him.',
  current_state: 'Day three. No solid leads yet. Grigor may know something — has been acting strangely.',
  involved_npcs: 'Shanks, Aldric, Grigor',
  stakes:        "Aldric's patience has limits. Crew morale dropping without their captain. Something happened on those docks.",
  next_steps:    'Press Grigor. He knows something.',
})
ok('Thread: Find Captain Shanks')

storage.upsertThread(GAME_ID, {
  name:          'Aldric Commission',
  status:        'active',
  thread_type:   'contract',
  background:    'Aldric hired Ajax to find Shanks and report back. Standard arrangement — results, not questions.',
  current_state: 'Three days without a report. Aldric will not wait much longer.',
  involved_npcs: 'Aldric, Shanks',
  stakes:        "Payment. Aldric's continued patronage. Ajax's reputation.",
  next_steps:    'Find something to report before Aldric takes the job elsewhere.',
})
ok('Thread: Aldric Commission')

// ═══════════════════════════════════════════════════════════
// STEP 11 — Location records
// ═══════════════════════════════════════════════════════════

step('Creating location records...')

storage.upsertLocation(GAME_ID, {
  name:          'Blackened Mug',
  location_type: 'tavern',
  description:   "A dim corner tavern on the edge of the docks district. Low ceiling, smoke-stained walls, the kind of place that does not remember faces. Grigor's usual booth is at the back near the kitchen exit.",
  atmosphere:    'Dark, close, functional. Regulars know each other. Strangers are noted.',
  current_state: 'Evening crowd. Moderate noise. Mira the barmaid working.',
  dangers:       'Low normally. Red Sails men have been seen here recently.',
  player_visited: 1,
})
ok('Location: Blackened Mug')

storage.upsertLocation(GAME_ID, {
  name:          'Drossmark',
  location_type: 'city',
  description:   'A mid-sized port city on the Iron Coast. Stone buildings, salt air, harbor smells. The docks run the length of the eastern district.',
  atmosphere:    'Working city. Mercantile. Everyone has an angle.',
  current_state: 'Spring trade season beginning. Unusual tension in the harbor district.',
  dangers:       'Red Sails presence elevated. Political instability.',
  player_visited: 1,
})
ok('Location: Drossmark')

// ═══════════════════════════════════════════════════════════
// STEP 12 — Faction records
// ═══════════════════════════════════════════════════════════

step('Creating faction records...')

storage.upsertFaction(GAME_ID, {
  name:            'Red Sails',
  faction_type:    'pirate',
  description:     'Pirate faction with growing influence in the Drossmark harbor region.',
  power_level:     'Significant. Well-organized for pirates.',
  goals:           'Control harbor access. Extract tribute from merchant traffic.',
  methods:         'Intimidation, violence, strategic alliances with corrupt officials.',
  relationship:    'Hostile. Ajax has crossed them before.',
  current_actions: 'Increased presence in Drossmark. Something is being planned.',
})
ok('Faction: Red Sails')

storage.upsertFaction(GAME_ID, {
  name:            'Harbor Council',
  faction_type:    'government',
  description:     'Governing body of Drossmark harbor trade.',
  power_level:     'High within the city. Limited beyond it.',
  goals:           'Stable trade, controlled harbor, political survival.',
  methods:         'Bureaucracy, hired operatives, political maneuvering.',
  relationship:    'Neutral. Aldric is a member.',
  current_actions: 'Investigating Red Sails activity. Quietly.',
})
ok('Faction: Harbor Council')

// ═══════════════════════════════════════════════════════════
// STEP 13 — Faction heat
// ═══════════════════════════════════════════════════════════

step('Setting faction heat...')
storage.upsertFactionHeat(GAME_ID, 'tag_red_sails',      67)
ok('Red Sails heat: 67')
storage.upsertFactionHeat(GAME_ID, 'tag_harbor_council', 15)
ok('Harbor Council heat: 15')

// ═══════════════════════════════════════════════════════════
// STEP 14 — Tag relationships (22)
// ═══════════════════════════════════════════════════════════

step('Creating tag relationships...')

const relationships = [
  { tag_id_a: 'tag_grigor',          relationship: 'employed_by',   tag_id_b: 'tag_ajax',             context_note: 'first mate, three years' },
  { tag_id_a: 'tag_grigor',          relationship: 'located_at',    tag_id_b: 'tag_blackened_mug',    context_note: 'drinks here most evenings' },
  { tag_id_a: 'tag_grigor',          relationship: 'has_met',       tag_id_b: 'tag_shanks',           context_note: 'crewmates' },
  { tag_id_a: 'tag_grigor',          relationship: 'has_met',       tag_id_b: 'tag_aldric',           context_note: 'knows him by reputation' },
  { tag_id_a: 'tag_grigor',          relationship: 'involved_in',   tag_id_b: 'tag_find_shanks',      context_note: 'key witness' },
  { tag_id_a: 'tag_aldric',          relationship: 'employs',       tag_id_b: 'tag_ajax',             context_note: 'active commission' },
  { tag_id_a: 'tag_aldric',          relationship: 'involved_in',   tag_id_b: 'tag_find_shanks',      context_note: 'hired Ajax' },
  { tag_id_a: 'tag_aldric',          relationship: 'involved_in',   tag_id_b: 'tag_aldric_commission',context_note: 'commissioner' },
  { tag_id_a: 'tag_aldric',          relationship: 'member_of',     tag_id_b: 'tag_harbor_council',   context_note: 'councilman' },
  { tag_id_a: 'tag_shanks',          relationship: 'involved_in',   tag_id_b: 'tag_find_shanks',      context_note: 'missing person' },
  { tag_id_a: 'tag_ajax',            relationship: 'involved_in',   tag_id_b: 'tag_find_shanks',      context_note: 'investigator' },
  { tag_id_a: 'tag_ajax',            relationship: 'involved_in',   tag_id_b: 'tag_aldric_commission',context_note: 'contractor' },
  { tag_id_a: 'tag_ajax',            relationship: 'located_at',    tag_id_b: 'tag_drossmark',        context_note: 'current location' },
  { tag_id_a: 'tag_blackened_mug',   relationship: 'located_in',    tag_id_b: 'tag_drossmark',        context_note: 'docks district' },
  { tag_id_a: 'tag_red_sails',       relationship: 'opposes',       tag_id_b: 'tag_ajax',             context_note: 'prior conflict' },
  { tag_id_a: 'tag_red_sails',       relationship: 'opposes',       tag_id_b: 'tag_harbor_council',   context_note: 'competing interests' },
  { tag_id_a: 'tag_harbor_council',  relationship: 'located_in',    tag_id_b: 'tag_drossmark',        context_note: 'governing body' },
  { tag_id_a: 'tag_find_shanks',     relationship: 'involves',      tag_id_b: 'tag_grigor',           context_note: 'key witness' },
  { tag_id_a: 'tag_find_shanks',     relationship: 'involves',      tag_id_b: 'tag_aldric',           context_note: 'client' },
  { tag_id_a: 'tag_find_shanks',     relationship: 'involves',      tag_id_b: 'tag_shanks',           context_note: 'subject' },
  { tag_id_a: 'tag_aldric_commission',relationship: 'involves',     tag_id_b: 'tag_aldric',           context_note: 'commissioner' },
  { tag_id_a: 'tag_aldric_commission',relationship: 'involves',     tag_id_b: 'tag_ajax',             context_note: 'contractor' },
]

for (const rel of relationships) {
  storage.upsertRelationship(GAME_ID, { ...rel, strength: 'strong', confirmed: 1 })
}
ok(`${relationships.length} relationships created`)

// ═══════════════════════════════════════════════════════════
// STEP 15 — Game files (legacy compatibility)
// ═══════════════════════════════════════════════════════════

step('Writing game files...')

storage.writeFile(GAME_ID, 'world-state.txt',
  'The Iron Coast — a region of competing port cities along a cold northern sea. Ajax is a freelance operative in Drossmark, hired by Harbor Councilman Aldric to find the missing Captain Shanks. Three days into the investigation with no solid leads. Grigor, Ajax\'s first mate, has been acting strangely.'
)
ok('world-state.txt')

storage.writeFile(GAME_ID, 'character-sheet.txt',
  'Ajax Vorn — former city guard turned freelance operative. Lean, weathered, early thirties. Practical and observant. Armed with short sword and knife. Currently in Drossmark, evening of day 14. Owes Aldric a report that is three days overdue.'
)
ok('character-sheet.txt')

storage.writeFile(GAME_ID, 'npc-dossier.txt',
  'Grigor — first mate, loyal, knows something he is not saying. Aldric — harbor councilman, employer, patience wearing thin. Shanks — missing captain, last seen on east dock three nights ago.'
)
ok('npc-dossier.txt')

storage.writeFile(GAME_ID, 'quest-log.txt',
  "Find Captain Shanks. He disappeared three days ago. Aldric hired Ajax to find him. Grigor may know something — press him."
)
ok('quest-log.txt')

storage.writeFile(GAME_ID, 'session-summary.txt',
  "Ajax is in Drossmark. Evening, spring. The investigation into Shanks' disappearance has stalled. Grigor drinks alone at the Blackened Mug most nights now. Something is wrong with him."
)
ok('session-summary.txt')

// ═══════════════════════════════════════════════════════════
// STEP 16 — Message history seed
// ═══════════════════════════════════════════════════════════

step('Writing message history seed...')

const worldState      = storage.readFile(GAME_ID, 'world-state.txt')     || ''
const characterSheet  = storage.readFile(GAME_ID, 'character-sheet.txt') || ''
const npcDossier      = storage.readFile(GAME_ID, 'npc-dossier.txt')     || ''
const questLog        = storage.readFile(GAME_ID, 'quest-log.txt')       || ''
const sessionSummary  = storage.readFile(GAME_ID, 'session-summary.txt') || ''

const seedMessage = [
  '[WORLD STATE]',
  worldState,
  '',
  '[CHARACTER SHEET]',
  characterSheet,
  '',
  '[NPC DOSSIER]',
  npcDossier,
  '',
  '[QUEST LOG]',
  questLog,
  '',
  '[SESSION SUMMARY]',
  sessionSummary,
  '',
  '[The player is ready. Open with a short atmospheric scene that places them in the world.]',
].join('\n')

const messageHistory = [
  { role: 'user',      content: seedMessage },
  { role: 'assistant', content: '[World state acknowledged. Beginning session.]' },
]

storage.writeFile(GAME_ID, 'message-history.json', JSON.stringify(messageHistory, null, 2))
ok('message-history.json (2 messages)')

// ═══════════════════════════════════════════════════════════
// STEP 17 — Verification
// ═══════════════════════════════════════════════════════════

step('Running verification checks...')

// 1. Game exists
const game = storage.getGame(GAME_ID)
assert(game && game.id === GAME_ID,         'Game exists in database')
assert(game.name === GAME_NAME,             'Game name correct')

// 2. Game mechanics
const mech = storage.getGameMechanics(GAME_ID)
assert(mech,                                'game_mechanics row exists')
assert(mech.player_combat_rank === 15,      'combat_rank = 15')
assert(mech.player_social_rank === 11,      'social_rank = 11')
assert(mech.coin === 34,                    'coin = 34')
assert(mech.global_notoriety === 23,        'notoriety = 23')

// 3. All 10 tags created
const allTags = storage.getTags(GAME_ID)
assert(allTags.length === 10,               `10 tags created (got ${allTags.length})`)

// 4. Aliases and lookup
const byAlias = storage.getTagByAlias(GAME_ID, 'the first mate')
assert(byAlias && byAlias.id === 'tag_grigor', 'alias "the first mate" → tag_grigor')
const byAlias2 = storage.getTagByAlias(GAME_ID, 'Captain Shanks')
assert(byAlias2 && byAlias2.id === 'tag_shanks', 'alias "Captain Shanks" → tag_shanks')

// 5. Relationships
const allRels = storage.getAllRelationships(GAME_ID)
assert(allRels.length === 22,               `22 relationships created (got ${allRels.length})`)

// 6. NPC records
const npcs = storage.getNpcs(GAME_ID)
assert(npcs.length === 3,                   `3 NPC records (got ${npcs.length})`)
const grigor = storage.getNpc(GAME_ID, 'Grigor')
assert(grigor && grigor.disposition === 70, 'Grigor disposition = 70')
const aldric = storage.getNpc(GAME_ID, 'Aldric')
assert(aldric && aldric.loyalty === 30,     'Aldric loyalty = 30')

// 7. Knowledge scopes
const grigorScope = storage.getKnowledgeScope(GAME_ID, 'tag_grigor')
assert(grigorScope,                         'knowledge scope: Grigor')
const aldricScope = storage.getKnowledgeScope(GAME_ID, 'tag_aldric')
assert(aldricScope,                         'knowledge scope: Aldric')

// 8. Thread records
const threads = storage.getThreads(GAME_ID)
assert(threads.length === 2,               `2 thread records (got ${threads.length})`)

// 9. Faction heat
const heat = storage.getFactionHeat(GAME_ID)
assert(heat.length >= 2,                   'faction heat records created')
const redSailsHeat = storage.getFactionHeatByTag(GAME_ID, 'tag_red_sails')
assert(redSailsHeat && redSailsHeat.heat === 67, 'Red Sails heat = 67')

// 10. Ambient index
const ambientIndex = storage.getAmbientIndex(GAME_ID)
assert(Array.isArray(ambientIndex),        'ambient index returns an array')
assert(ambientIndex.length >= 9,           `ambient index includes active tags (${ambientIndex.length} entries)`)

// 11. Game files
const files = storage.readAllFiles(GAME_ID)
const fileCount = Object.keys(files).length
assert(fileCount >= 6,                     `game files written (${fileCount} files)`)
const histFile = storage.readFile(GAME_ID, 'message-history.json')
assert(typeof histFile === 'string' && histFile.length > 0, 'message-history.json exists')
const hist = JSON.parse(histFile)
assert(hist.length === 2,                  'message history has 2 seed messages')
assert(hist[0].content.includes('[WORLD STATE]'), 'seed message contains [WORLD STATE]')
assert(hist[0].content.includes('Iron Coast'),    'seed message contains world content')

// ═══════════════════════════════════════════════════════════
// DONE
// ═══════════════════════════════════════════════════════════

const finalTags = storage.getTags(GAME_ID)
const finalRels = storage.getAllRelationships(GAME_ID)
const finalNpcs = storage.getNpcs(GAME_ID)

console.log('\n' + '═'.repeat(55))
console.log('TEST GAME READY')
console.log(`Game ID:   ${GAME_ID}`)
console.log(`Game Name: ${GAME_NAME}`)
console.log(`Tags: ${finalTags.length} | Relationships: ${finalRels.length} | NPCs: ${finalNpcs.length}`)
console.log('Open http://localhost:3000 and load the test game.')
console.log('═'.repeat(55))
