const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const plain = v => JSON.parse(JSON.stringify(v));
function engine() {
  const ctx = { window: {}, Math, Number, Object, Set, Map };
  vm.runInNewContext(read('js/combat-core.js'), ctx);
  vm.runInNewContext(read('js/encounter-actions.js'), ctx);
  return { encounter: ctx.window.WBEncounter, combat: ctx.window.WBCombat, ctx };
}
const dm = { role: 'dm', userId: 'gm' };
const player = { role: 'player', userId: 'alice' };
const other = { role: 'player', userId: 'bob' };
const pc = { id: 'hero', name: 'Hero', kind: 'pc', ownerId: 'alice',
  hp: 16, maxHp: 16, ar: 2, deathThreshold: 20, apMax: 4, initiative: 12 };
const npc = { id: 'goblin', name: 'Goblin', kind: 'npc',
  hp: 12, maxHp: 12, ar: 3, deathThreshold: 0, apMax: 3, initiative: 7 };
function command(engine, state, type, params = {}, ctx = dm, id) {
  return engine.applyAction(state, {
    id: id || 'act-' + (state.revision + 1),
    type, expectedRevision: state.revision, ...params
  }, ctx);
}
function setup() {
  const e = engine().encounter;
  let state = e.createEncounter('fight-one');
  let r = command(e, state, 'AddActor', { actor: pc }); assert.equal(r.ok, true); state = r.state;
  r = command(e, state, 'AddActor', { actor: npc }); assert.equal(r.ok, true); state = r.state;
  return { e, state };
}
test('blank encounter and normalized snapshots are separate from character data', () => {
  const { encounter: e } = engine();
  const a = e.createEncounter('scene-1'), b = e.createEncounter('scene-1');
  assert.deepEqual(plain(a), { version: 1, id: 'scene-1', revision: 0,
    phase: 'setup', round: 0, turnIndex: 0, order: [], actors: {}, applied: [] });
  a.actors.foo = {}; assert.deepEqual(plain(b.actors), {});
  assert.equal(e.normalizeEncounter(null), null);
  const { state } = setup();
  const copied = e.normalizeEncounter(state);
  copied.actors.hero.hp = 0;
  assert.equal(state.actors.hero.hp, 16);
  assert.equal(copied.fields, undefined, 'DM encounter does not own character sheet');
});
test('initiative, turn rotation, AP reset and player turn ownership', () => {
  let { e, state } = setup();
  let r = command(e, state, 'StartEncounter'); assert.equal(r.ok, true);
  state = r.state;
  assert.deepEqual(plain(state.order), ['hero', 'goblin']);
  assert.equal(state.phase, 'active'); assert.equal(state.round, 1);
  assert.equal(command(e, state, 'SpendAP', { actorId: 'hero', cost: 1 }, other).error, 'NOT_YOUR_ACTOR');
  r = command(e, state, 'SpendAP', { actorId: 'hero', cost: 3 }, player);
  assert.equal(r.ok, true); state = r.state;
  assert.equal(state.actors.hero.apAvail, 1);
  assert.equal(command(e, state, 'SpendAP', { actorId: 'hero', cost: 2 }, player).error, 'INSUFFICIENT_AP');
  assert.equal(command(e, state, 'EndTurn', { actorId: 'goblin' }, player).error, 'NOT_CURRENT_TURN');
  r = command(e, state, 'EndTurn', { actorId: 'hero' }, player);
  assert.equal(r.ok, true); state = r.state;
  assert.equal(state.turnIndex, 1);
  assert.equal(command(e, state, 'SpendAP', { actorId: 'hero', cost: 1 }, player).error, 'NOT_CURRENT_TURN');
  assert.equal(command(e, state, 'EndTurn', { actorId: 'goblin' }, other).error, 'NOT_YOUR_ACTOR');
  r = command(e, state, 'EndTurn', { actorId: 'goblin' }, dm);
  state = r.state; assert.equal(state.round, 2);
  assert.equal(state.actors.hero.apAvail, 4, 'New turn refreshes personal AP');
  assert.equal(state.actors.goblin.apAvail, 3);
});
test('stale revisions, idempotent retries and conflicting action IDs do not mutate state', () => {
  const { e, state } = setup();
  const action = { id: 'start-1', type: 'StartEncounter', expectedRevision: state.revision };
  const original = plain(state);
  const accepted = e.applyAction(state, action, dm);
  assert.equal(accepted.ok, true); assert.deepEqual(plain(state), original);
  const duplicate = e.applyAction(accepted.state, action, dm);
  assert.equal(duplicate.ok, true); assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.state.revision, accepted.state.revision);
  assert.equal(duplicate.event, null);
  const swapped = { ...action, type: 'FinishEncounter' };
  assert.equal(e.applyAction(accepted.state, swapped, dm).error, 'ACTION_ID_CONFLICT');
  const stale = { id: 'later', type: 'EndTurn', actorId: 'hero', expectedRevision: 0 };
  assert.equal(e.applyAction(accepted.state, stale, player).error, 'REVISION_CONFLICT');
});
test('damage uses per-hit armor/resistance and shared Deaths Mercy, healing adds Trauma', () => {
  let { e, state } = setup();
  let r = command(e, state, 'ApplyDamage', { actorId: 'hero', rawDamage: 30, resistant: true });
  assert.equal(r.ok, true);
  assert.equal(r.event.damage, 13, 'floor(30/2) - 2 armor');
  state = r.state;
  assert.equal(state.actors.hero.hp, 3);
  r = command(e, state, 'ApplyDamage', { actorId: 'hero', rawDamage: 100 });
  assert.equal(r.ok, true); assert.equal(r.state.actors.hero.hp, -10);
  assert.equal(r.state.actors.hero.down.mercy, true);
  state = r.state;
  r = command(e, state, 'ApplyDamage', { actorId: 'hero', rawDamage: 12 });
  assert.equal(r.state.actors.hero.hp, -20);
  assert.equal(r.event.outcome.dead, true);
  state = r.state;
  r = command(e, state, 'Heal', { actorId: 'hero', amount: 35 });
  assert.equal(r.state.actors.hero.hp, 15);
  assert.equal(r.state.actors.hero.trauma, 1);
  assert.equal(r.state.actors.hero.deathThreshold, 15);
  assert.equal(r.state.actors.hero.down, null);
  assert.equal(r.state.actors.goblin.hp, 12);
});
test('bleeding at turn start matches sheet and given AP is spent first', () => {
  let { e, state } = setup();
  let r = command(e, state, 'SetHealth', { actorId: 'hero', hp: 0 });
  state = r.state;
  r = command(e, state, 'GrantAP', { actorId: 'hero', amount: 3 });
  state = r.state;
  r = command(e, state, 'StartEncounter'); state = r.state;
  assert.equal(state.actors.hero.hp, -4);
  assert.equal(state.actors.hero.apGiven.fresh, false);
  r = command(e, state, 'SpendAP', { actorId: 'hero', cost: 4 }, player);
  state = r.state;
  assert.equal(state.actors.hero.apAvail, 3);
  assert.equal(state.actors.hero.apGiven.n, 0);
  r = command(e, state, 'EndTurn', { actorId: 'hero' }, player); state = r.state;
  r = command(e, state, 'EndTurn', { actorId: 'goblin' }); state = r.state;
  assert.equal(state.actors.hero.hp, -8, 'Bleeding repeats until stabilized');
});
test('DM-only mutations, strict input validation, map placement and lifecycle', () => {
  let { e, state } = setup();
  assert.equal(command(e, state, 'ApplyDamage', { actorId: 'goblin', rawDamage: 5 }, player).error, 'DM_ONLY');
  assert.equal(command(e, state, 'AddActor', { actor: pc }, player).error, 'DM_ONLY');
  assert.equal(command(e, state, 'ApplyDamage', { actorId: 'hero', rawDamage: -1 }).error, 'INVALID_DAMAGE');
  assert.equal(command(e, state, 'ApplyDamage', { actorId: 'hero', rawDamage: NaN }).error, 'INVALID_DAMAGE');
  assert.equal(command(e, state, 'SetInitiative', { actorId: 'hero', initiative: 4.5 }).error, 'INVALID_INITIATIVE');
  assert.equal(command(e, state, 'PlaceToken', { actorId: 'hero', x: 50, y: 1 },
    { ...dm, map: { cols: 20, rows: 20 } }).error, 'OUT_OF_BOUNDS');
  let r = command(e, state, 'PlaceToken', { actorId: 'hero', x: 8, y: 3 },
    { ...dm, map: { cols: 20, rows: 20 } }); state = r.state;
  assert.equal(state.actors.hero.x, 8);
  assert.equal(command(e, state, 'MoveToken', { actorId: 'hero', x: 9, y: 4 }).error, 'UNKNOWN_ACTION',
    'Player movement must not bypass path/AP validation');
  r = command(e, state, 'StartEncounter'); state = r.state;
  assert.equal(command(e, state, 'RemoveActor', { actorId: 'hero' }).error, 'ENCOUNTER_NOT_IN_SETUP');
  r = command(e, state, 'FinishEncounter'); state = r.state;
  assert.equal(state.phase, 'finished');
  assert.equal(command(e, state, 'EndTurn', { actorId: 'hero' }).error, 'ENCOUNTER_NOT_ACTIVE');
});
test('game normalizer preserves optional DM encounter, and no encounter leaves old save identical', () => {
  const { ctx, encounter: e } = engine();
  vm.runInNewContext(read('js/game-state.js'), ctx);
  const gameState = ctx.window.WBGameState;
  assert.equal(gameState.normalizeGame({}).encounter, undefined);
  const { state } = setup();
  const loaded = gameState.normalizeGame({ map: null, foes: [], encounter: state });
  assert.deepEqual(plain(loaded.encounter), plain(e.normalizeEncounter(state)));
  loaded.encounter.actors.hero.hp = -40;
  assert.equal(state.actors.hero.hp, 16);
  const html = read('index.html');
  assert.ok(html.indexOf('src="js/combat-core.js') < html.indexOf('src="js/encounter-actions.js'));
  assert.ok(html.indexOf('src="js/encounter-actions.js') < html.indexOf('src="js/app.js'));
});
