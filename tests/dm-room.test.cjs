/* Offline DM Room: import projection, command integration and page contracts. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const plain = obj => JSON.parse(JSON.stringify(obj));
function modules() {
  const ctx = { window: {}, Math, Number, Object, Date, Set, Map };
  for(const file of ['js/persistence.js', 'js/combat-core.js', 'js/encounter-actions.js',
    'js/game-state.js','js/abilities.js','js/dm-characters.js']) vm.runInNewContext(read(file), ctx);
  return ctx.window;
}
const sheet = {
  id:'char42', fields: { level:'2', charName:'Vype', hpCur:'11', apMax:'18' },
  hist:{ VIT: { 1:16 }, WIS:{1:13} },
  rolls:{2:7}, asi:{}, over:{}, lvGear:{}, trauma:0, down:null,
  items:[{id:'armor1',type:'armor',ar:2,bonuses:[{t:'hp',v:2},{t:'init',v:1}]}],
  equip:{torso:'armor1'}, settled:{}, abilities:[], abilityLoadouts:[],
  activeAbilityLoadoutId:'', apAvail:14
};
function dispatch(engine, state, type, detail={}) {
  const result=engine.applyAction(state, {
    id:'dm' + (state.revision + 1),
    expectedRevision:state.revision, type, ...detail
  },{role:'dm',userId:'local-dm'});
  assert.equal(result.ok,true, result.error);
  return result.state;
}
test('imports current-stat Health/AP/Armor formulas without touching player sheet', () => {
  const w=modules();
  const original=plain(sheet);
  const p=w.WBDMCharacters.fromCharacter(sheet,'fallback');
  assert.deepEqual(plain(sheet),original);
  assert.equal(p.actor.id,'char42');
  assert.equal(p.actor.name,'Vype');
  assert.equal(p.level,2);
  assert.equal(p.actor.maxHp,34,'VIT 16 × level 2, plus gear 2');
  assert.equal(p.actor.hp,11);
  assert.equal(p.actor.ar,4,'Gear AR 2 + VIT mod 2');
  assert.equal(p.actor.deathThreshold,18,'2 + effective VIT 16');
  assert.equal(p.actor.apMax,18);
  assert.equal(p.actor.apAvail,14);
  assert.equal(p.actor.initiative,0,'Initiative total must be entered, not treated as a rolled value');
  assert.equal(p.initiativeBonus,2);
  assert.equal(p.actor.initiativeBonus,2,'Import saves the modifier for DM reference');
  assert.deepEqual(plain(p.warnings),[]);
});
test('manual overrides, missing advances and older exported characters are supported', () => {
  const w=modules(), copy=plain(sheet);
  copy.over.hpMax='42';
  copy.over.armor='12';
  copy.fields.hpCur='';
  copy.fields.apMax='';
  copy.rolls={};
  const p=w.WBDMCharacters.fromCharacter(copy,'backup');
  assert.equal(p.actor.maxHp,42);
  assert.equal(p.actor.hp,42);
  assert.equal(p.actor.ar,12);
  assert.equal(p.actor.apMax,15,'The sheet defaults to 15 AP');
  assert.equal(p.warnings.length,0,'Manual max overrides missing advancement');
  delete copy.over.hpMax;
  const missing=w.WBDMCharacters.fromCharacter(copy,'backup');
  assert.equal(missing.warnings.length,0);
  assert.equal(missing.actor.maxHp,34,'Old advancement rolls are no longer required');
  const parsed=w.WBPersistence.parseCharacterFile(w.WBPersistence.exportCharacter(sheet,'2026-10-28'));
  assert.equal(w.WBDMCharacters.fromCharacter(parsed,'backup').actor.name,'Vype');
  const legacy=w.WBPersistence.parseCharacterFile(JSON.stringify(sheet));
  assert.equal(w.WBDMCharacters.fromCharacter(legacy,'backup').actor.name,'Vype');
  assert.equal(w.WBDMCharacters.fromCharacter({fields:{}},'fallback'),null);
});
test('imported player snapshots and NPCs run a complete offline encounter via shared rules', () => {
  const w=modules(),engine=w.WBEncounter;
  const snap=w.WBDMCharacters.fromCharacter(sheet,'fallback').actor;
  let session=engine.createEncounter('testroom');
  session=dispatch(engine,session,'AddActor',{actor:snap});
  session=dispatch(engine,session,'AddActor',{actor:{
    id:'npc1',name:'Warden',kind:'npc',hp:20,maxHp:20,ar:3,
    deathThreshold:0,apMax:15,initiative:0
  }});
  session=dispatch(engine,session,'UpdateActor',{
    actorId:'char42',changes:{name:'Vype',hp:11,maxHp:33,ar:4,
      apMax:18,initiative:17,deathThreshold:18}
  });
  session=dispatch(engine,session,'SetInitiative',{actorId:'npc1',initiative:12});
  assert.deepEqual(plain(session.order),['char42','npc1']);
  session=dispatch(engine,session,'StartEncounter');
  assert.equal(session.phase,'active');
  session=dispatch(engine,session,'SpendAP',{actorId:'char42',cost:4});
  assert.equal(session.actors.char42.apAvail,14,'Start resets AP to max before spending');
  session=dispatch(engine,session,'ApplyDamage',{actorId:'char42',rawDamage:100});
  assert.equal(session.actors.char42.hp,-9,"Death's Mercy caps first below-zero damage");
  session=dispatch(engine,session,'SetStable',{actorId:'char42',stable:true});
  session=dispatch(engine,session,'EndTurn',{actorId:'char42'});
  session=dispatch(engine,session,'EndTurn',{actorId:'npc1'});
  assert.equal(session.round,2);
  assert.equal(session.actors.char42.hp,-9,'Stabilized heroes do not bleed on their turns');
  session=dispatch(engine,session,'Heal',{actorId:'char42',amount:15});
  assert.equal(session.actors.char42.hp,6);
  assert.equal(session.actors.char42.trauma,1);
  assert.equal(session.actors.char42.deathThreshold,13);
  session=dispatch(engine,session,'FinishEncounter');
  assert.equal(session.phase,'finished');
  assert.equal(w.WBEncounter.applyAction(session,{
    id:'wrong',type:'UpdateActor',actorId:'char42',changes:{hp:1},
    expectedRevision:session.revision
  },{role:'player',userId:'char42'}).error,'DM_ONLY');
});
test('encounter persistence never overwrites saved character or legacy map/foes', () => {
  const w=modules(),repos=w.WBPersistence.createMemoryRepositories();
  repos.characters.save(sheet);
  const map={map:{id:'barrow',rev:1,cols:20,rows:20,free:false,fogOff:false},
    tokens:{char42:{x:2,y:3}},fog:{},foes:[
      {id:'foe1',map:'barrow',x:4,y:3,name:'Specter',hp:6,max:10,ev:14,ar:2}],
    view:{grid:0.4,terrainOn:true,reachOff:false}};
  repos.games.save(map);
  const game=w.WBGameState.normalizeGame(repos.games.load());
  const encounter=w.WBEncounter.createEncounter('next');
  repos.games.save({...game,encounter});
  const stored=repos.games.load();
  assert.deepEqual(plain(repos.characters.load()),plain(sheet));
  assert.deepEqual(plain(stored.map),plain(map.map));
  assert.deepEqual(plain(stored.tokens),plain(map.tokens));
  assert.equal(stored.foes[0].hp,6);
  assert.deepEqual(plain(w.WBGameState.normalizeGame(stored).encounter),plain(encounter));
  assert.equal(w.WBGameState.normalizeGame(map).encounter,undefined);
});
test('DM page has local link, import, roster, turn and error feedback wiring', () => {
  const index=read('index.html'), html=read('dm.html'),ui=read('js/dm.js');
  assert.match(index,/href="dm\.html"/);
  for(const id of ['dmCharacterFiles','dmImport','dmNpcForm','dmActorList',
    'newEncounter','startEncounter','nextTurn','finishEncounter','reuseRoster','dmSaveStatus','dmFeedback'])
    assert.ok(html.includes('id="' + id + '"'),'Missing ' + id);
  const resources=['css/sheet.css','css/dm.css','js/persistence.js','js/combat-core.js',
    'js/encounter-actions.js','js/game-state.js','js/abilities.js','js/dm-characters.js','js/dm.js'];
  const versions=resources.map(asset=>{
    const match=html.match(new RegExp('(?:src|href)="' + asset.replace(/\./g,'\\.') +
      '\\?v=([\\w-]+)"'));
    assert.ok(match, 'Unversioned DM asset ' + asset);
    return match[1];
  });
  assert.equal(new Set(versions).size,1);
  assert.ok(html.indexOf('js/combat-core.js')<html.indexOf('js/encounter-actions.js'));
  assert.ok(html.indexOf('js/encounter-actions.js')<html.indexOf('js/game-state.js'));
  assert.ok(html.indexOf('js/dm-characters.js')<html.indexOf('js/dm.js'));
  assert.match(ui,/window\.WBPersistence\.createLocalRepositories/);
  assert.match(ui,/core\.applyAction\(/);
  assert.match(ui,/repository\.save\(\{ \.\.\.game, encounter: result\.state \}\)/);
  assert.match(ui,/window\.addEventListener\('storage'/);
});

test('DM snapshot excludes every active temporary effect while retaining gear, form and manual overrides',()=>{
  const w=modules(),source=plain(sheet);
  source.hist.AGL={1:15};source.hist.VIT={1:16};source.hist.WIS={1:12};
  source.abilityLoadouts=[{id:'load12345678',name:'Battle Form',statBonuses:{VIT:6,AGL:3,WIS:3}}];
  source.activeAbilityLoadoutId='load12345678';
  source.abilities=[
    {id:'abil12345678',name:'Arcane Shell',durationLeft:2,effects:[
      {target:'armor',value:7},{target:'stat',stat:'VIT',value:6},
      {target:'movement',value:10},{target:'evasion',value:2}]},
    {id:'abil22345678',name:'Mind Fade',durationLeft:1,effects:[
      {target:'stat',stat:'WIS',value:-6},{target:'resource-max',resourceId:'soul',value:4}]},
    {id:'abil32345678',name:'Expired',durationLeft:0,effects:[{target:'armor',value:100}]},
    {id:'abil42345678',name:'Non-numeric Ward',durationLeft:3,effects:[]}
  ];
  source.resources=[{id:'soul',name:'Soul Charges',max:10,current:8}];
  const before=plain(source),pure=plain(source);
  pure.abilities=[];
  const base=w.WBDMCharacters.fromCharacter(pure,'fallback');
  const imported=w.WBDMCharacters.fromCharacter(source,'fallback');
  assert.deepEqual(plain(source),before,'import must never mutate the exported player character');
  assert.deepEqual(plain(imported.actor),plain(base.actor),
    'all imported combat attributes are independent of active duration bonuses');
  assert.deepEqual(plain(imported.warnings).filter(x=>x.includes('Active temporary ability')).length,3);
  assert.ok(imported.warnings.some(x=>x.includes('Arcane Shell')&&x.includes('2 turns left')&&
    x.includes('+7 Armor Rating')&&x.includes('+6 VIT score')&&
    x.includes('+10 Movement (ft/AP)')&&x.includes('+2 Evasion')));
  assert.ok(imported.warnings.some(x=>x.includes('Mind Fade')&&x.includes('1 turn left')&&
    x.includes('-6 WIS score')&&x.includes('+4 maximum Soul Charges')));
  assert.ok(imported.warnings.some(x=>x.includes('Non-numeric Ward')&&
    x.includes('3 turns left')&&x.includes('no automatic numerical bonuses')));
  assert.ok(!imported.warnings.some(x=>x.includes('Expired')));
  const noGearOrForm=plain(pure);
  noGearOrForm.equip={};
  noGearOrForm.activeAbilityLoadoutId='';
  const stripped=w.WBDMCharacters.fromCharacter(noGearOrForm,'fallback').actor;
  assert.ok(imported.actor.ar>stripped.ar,'gear and selected form still affect Armor Rating');
  assert.ok(imported.actor.speedFt>stripped.speedFt,'form AGL bonus still affects Movement');
  const manual=plain(source);
  manual.over={...manual.over,armor:'27',speed:'55'};
  const explicit=w.WBDMCharacters.fromCharacter(manual,'fallback').actor;
  assert.equal(explicit.ar,27);
  assert.equal(explicit.speedFt,55);
});
test('legacy single-effect data also warns without baking the effect into DM Armor',()=>{
  const w=modules(),source=plain(sheet);
  source.abilities=[{name:'Legacy Armor',durationLeft:4,effectTarget:'armor',effectValue:9}];
  const snap=w.WBDMCharacters.fromCharacter(source,'fallback');
  assert.equal(snap.actor.ar,4);
  assert.ok(snap.warnings.some(s=>s.includes('Legacy Armor')&&s.includes('+9 Armor Rating')&&s.includes('4 turns left')));
});
test('all import warnings are surfaced without an unsafe HTML insertion or truncation',()=>{
  const page=read('dm.html'),ui=read('js/dm.js');
  assert.match(page,/id="dmImportWarnings"/);
  assert.match(page,/id="dmImportWarningList"/);
  assert.match(ui,/li\.textContent=warning/);
  assert.match(ui,/converted\.warnings\.forEach/);
  assert.doesNotMatch(ui,/warnings\.slice\(0,\s*4\)/);
});
