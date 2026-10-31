const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function core() {
  const ctx = {window:{},Date,JSON,Map,Set};
  vm.runInNewContext(read('js/persistence.js'),ctx);
  return ctx.window.WBPersistence;
}
function mockStorage() {
  const values = new Map();
  const calls = [];
  const store = {
    getItem(k) { calls.push(['get',k]); return values.has(k)?values.get(k):null; },
    setItem(k,v) { calls.push(['set',k]); values.set(k,v); },
    removeItem(k) { calls.push(['remove',k]); values.delete(k); }
  };
  return {store,values,calls};
}

test('legacy storage keys and raw character/game shapes remain unchanged',()=>{
  const api=core(),storage=mockStorage();
  assert.equal(api.CHARACTER_KEY,'worlds-beyond-sheet-v1');
  assert.equal(api.GAME_KEY,'worlds-beyond-game-v1');
  const repos=api.createLocalRepositories(()=>storage.store);
  const character={id:'cabc1234',fields:{charName:'Aldrich'},hist:{STR:{1:'15'}},
    abilities:[{name:'Contract'}],resources:[{name:'Energy',current:32,max:100}],
    equipmentProfiles:{base:{head:'item1'}}};
  const game={map:{id:'testmap'},tokens:{cabc1234:{x:3,y:4}},fog:{testmap:{seen:'0101'}},foes:[]};
  repos.characters.save(character);repos.games.save(game);
  assert.equal(storage.values.get(api.CHARACTER_KEY),JSON.stringify(character));
  assert.equal(storage.values.get(api.GAME_KEY),JSON.stringify(game));
  assert.deepEqual(JSON.parse(JSON.stringify(repos.characters.load())),character);
  assert.deepEqual(JSON.parse(JSON.stringify(repos.games.load())),game);
  repos.characters.remove();
  assert.equal(storage.values.has(api.CHARACTER_KEY),false);
  assert.deepEqual(JSON.parse(JSON.stringify(repos.games.load())),game,'Clearing character must keep the game');
});

test('new export format matches existing v1 JSON and round trips full custom state',()=>{
  const api=core();
  const state={id:'cfoobar12',fields:{charName:'Flake'},hist:{},
    abilities:[{name:'Rebirth',loadoutIds:['load123456']}],
    resources:[{name:'Heat',max:6,current:3,loadoutIds:[]}],
    abilityLoadouts:[{id:'load123456',name:'Phoenix'}],
    equipmentProfiles:{base:{},load123456:{main:'sword1'}},
    portraits:[{src:'data:image/png;base64,example'}]};
  const payload=api.exportCharacter(state,'2026-10-28T00:00:00.000Z');
  const parsed=JSON.parse(payload);
  assert.equal(parsed.format,'worlds-beyond-character');
  assert.equal(parsed.version,1);
  assert.equal(parsed.exported,'2026-10-28T00:00:00.000Z');
  assert.deepEqual(parsed.state,state);
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseCharacterFile(payload))),state);
  parsed.state.fields.charName='Tampered';
  assert.equal(state.fields.charName,'Flake','Exported state must not alias in-memory character');
});

test('unwrapped historical character imports, invalid files and unsupported future versions',()=>{
  const api=core();
  const legacy={fields:{charName:'Old Character'},hist:{},map:{id:'oldmap'}};
  assert.deepEqual(JSON.parse(JSON.stringify(api.importCharacter(legacy))),legacy);
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseCharacterFile(JSON.stringify(legacy)))),legacy);
  assert.equal(api.parseCharacterFile('not json'),null);
  assert.equal(api.parseCharacterFile('null'),null);
  assert.equal(api.parseCharacterFile('[]'),null);
  assert.equal(api.parseCharacterFile('{}'),null);
  assert.equal(api.importCharacter({format:'worlds-beyond-character',version:2,state:legacy}),null,
    'Future exports should fail safely rather than lose new fields');
  assert.equal(api.importCharacter({format:'worlds-beyond-character',version:1,state:[]}),null);
  assert.equal(api.importCharacter({format:'unexpected-format',fields:{},hist:{}}),null);
});

test('malformed local JSON starts blank without throwing or overwriting stored bytes',()=>{
  const api=core(),storage=mockStorage();
  storage.values.set(api.CHARACTER_KEY,'{broken');
  storage.values.set(api.GAME_KEY,'[]');
  const repos=api.createLocalRepositories(()=>storage.store);
  assert.equal(repos.characters.load(),null);
  assert.equal(repos.games.load(),null);
  assert.equal(storage.values.get(api.CHARACTER_KEY),'{broken');
  assert.equal(storage.values.get(api.GAME_KEY),'[]');
  assert.equal(api.parseStoredValue('{"a":1}').a,1);
  assert.equal(api.parseStoredValue('"a string"'),null);
});

test('unavailable/quota-exceeded browser storage errors propagate to UI status handling',()=>{
  const api=core();
  const denied=api.createLocalRepositories(()=>{throw Error('denied')});
  assert.throws(()=>denied.characters.load(),/denied/);
  assert.throws(()=>denied.games.save({}),/denied/);
  const full=api.createLocalRepositories(()=>({
    getItem:()=>null,removeItem:()=>{},setItem:()=>{throw Error('quota')}
  }));
  assert.throws(()=>full.characters.save({fields:{}}),/quota/);
  assert.throws(()=>api.createLocalRepositories(null),/storage provider/);
  assert.throws(()=>full.characters.save(null),/object/);
});

test('in-memory repositories isolate state and characters from session data',()=>{
  const api=core(),repos=api.createMemoryRepositories();
  const char={id:'cabc1234',fields:{charName:'Aran'},hist:{}};
  const game={tokens:{cabc1234:{x:1,y:2}},foes:[{name:'Void'}],fog:{secret:{seen:'0'}}};
  repos.characters.save(char);
  repos.games.save(game);
  char.fields.charName='Mutated';
  game.foes[0].name='Mutated';
  assert.equal(repos.characters.load().fields.charName,'Aran');
  assert.equal(repos.games.load().foes[0].name,'Void');
  const loaded=repos.games.load();loaded.foes[0].name='Again';
  assert.equal(repos.games.load().foes[0].name,'Void');
  assert.equal(repos.characters.load().foes,undefined,'DM state must not leak into a character');
  repos.characters.remove();
  assert.equal(repos.characters.load(),null);
  assert.equal(repos.games.load().foes[0].name,'Void');
});

test('concurrent game merge keeps newer untouched sections and applies local changes',()=>{
  const api=core();
  const base={map:{id:'blank'},tokens:{hero:{x:1,y:1}},fog:{},foes:[],view:{grid:100}};
  const local={...base,map:{id:'stone-hall'},view:{grid:45}};
  const latest={...base,tokens:{hero:{x:2,y:1}},encounter:{id:'newer-dm-encounter'}};
  const merged=api.mergeGameChanges(base,local,latest);
  assert.deepEqual(merged.map,{id:'stone-hall'});
  assert.deepEqual(merged.view,{grid:45});
  assert.deepEqual(merged.tokens,{hero:{x:2,y:1}},'untouched token data should use the newest save');
  assert.equal(merged.encounter.id,'newer-dm-encounter');
  local.map.id='mutated-after-merge';
  latest.encounter.id='mutated-after-merge';
  assert.equal(merged.map.id,'stone-hall','merged local sections must not alias the caller');
  assert.equal(merged.encounter.id,'newer-dm-encounter','newer sections must not alias the caller');
});

test('site integrates repositories for every load/save/clear/import/export path',()=>{
  const html=read('index.html'),app=read('js/app.js');
  assert.ok(html.indexOf('src="js/persistence.js')<html.indexOf('src="js/app.js'));
  for(const term of ['repositories.games.load()', 'repositories.characters.load()',
    'repositories.games.save(game)',
    'WBPersistence.exportCharacter(state)',
    'WBPersistence.parseCharacterFile(String(reader.result))']) assert.ok(app.includes(term),term);
  assert.doesNotMatch(app,/localStorage\.(?:getItem|setItem|removeItem)\s*\(/);
  assert.match(app,/const saveTimer|let saveTimer/);
  assert.match(app,/WBPersistence\.mergeGameChanges\(gameSaveBase, localGame, latestGame\)/);
});

test('guarded character writes and clears reject a stale tab and retain newer data',()=>{
 const api=core(),storage=mockStorage(),repo=api.createLocalRepositories(()=>storage.store).characters;
 const before=repo.snapshot();
 assert.equal(before,null);
 repo.save({fields:{charName:'Phone'}},before);
 const phone=repo.snapshot();
 repo.save({fields:{charName:'Restored cloud copy'}},phone);
 const newest=repo.snapshot();
 assert.throws(()=>repo.save({fields:{charName:'Stale tab'}},phone),/CHARACTER_CHANGED/);
 assert.throws(()=>repo.remove(phone),/CHARACTER_CHANGED/);
 assert.equal(repo.snapshot(),newest);
 repo.save({fields:{charName:'Reviewed edit'}},newest);
 repo.remove(repo.snapshot());
 assert.equal(repo.snapshot(),null);
});
