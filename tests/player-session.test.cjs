/* Local player preview: pure state filtering, player permissions and UI behavior. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
function modules(){
  const ctx={window:{},Math,Number,Object,Map,Set,Date};
  for(const file of ['js/persistence.js','js/combat-core.js',
    'js/encounter-actions.js','js/game-state.js','js/maps.js',
    'js/routing.js','js/encounter-map.js','js/player-session.js'])
    vm.runInNewContext(read(file),ctx);
  return ctx.window;
}
const dm={role:'dm',userId:'gm'};
const hero={id:'hero',name:'Bran',kind:'pc',ownerId:'offline',
  hp:20,maxHp:20,ar:3,apMax:6,speedFt:10,initiative:16};
const ally={id:'ally',name:'Aran',kind:'pc',ownerId:'different-seat',
  hp:14,maxHp:14,ar:2,apMax:5,speedFt:10,initiative:8};
const boss={id:'boss',name:'Warden',kind:'npc',
  hp:55,maxHp:60,ar:9,apMax:9,speedFt:5,initiative:5};
function action(w,encounter,type,detail={}){
  const result=w.WBEncounter.applyAction(encounter,{
    id:'d'+(encounter.revision+1),type,expectedRevision:encounter.revision,...detail
  },dm);
  assert.equal(result.ok,true,result.error);
  return result.state;
}
function setup(){
  const w=modules();
  let state=w.WBEncounter.createEncounter('session');
  for(const actor of [hero,ally,boss])state=action(w,state,'AddActor',{actor});
  const game={map:{id:'blank',cols:20,rows:15},
    tokens:{legacy:{x:8,y:8}},fog:{},foes:[{id:'f1',map:'blank',x:2,y:3,
      name:'Old foe',hp:10,max:10,ev:12,ar:1}]};
  const map=w.WBEncounterMap.mapModel(game,w.WB_MAPS);
  let count=0;
  for(const [id,x,y] of [['hero',3,3],['ally',4,3],['boss',9,9]]){
    const result=w.WBEncounter.applyAction(state,{id:'place'+(++count),
      type:'PlaceToken',expectedRevision:state.revision,actorId:id,x,y},
      {...dm,map});
    assert.equal(result.ok,true,result.error);state=result.state;
  }
  state=action(w,state,'StartEncounter');
  return {w,state,game,map};
}
test('player preview filters NPC mechanics and limits seat choices to PCs',()=>{
  const {w,state,map}=setup(),api=w.WBPlayerSession;
  assert.deepEqual(plain(api.seats(state)),[
    {id:'hero',name:'Bran'},{id:'ally',name:'Aran'}]);
  const v=api.view(state,'hero',map);
  assert.equal(v.self.id,'hero');assert.equal(v.self.hp,20);
  assert.equal(v.actors.length,3);
  assert.equal(v.isTurn,true);
  assert.equal(v.currentName,'Bran');
  const enemy=v.actors.find(a=>a.id==='boss');
  assert.deepEqual(Object.keys(enemy).sort(),
    ['id','initiative','kind','name','x','y'].sort());
  assert.equal(enemy.hp,undefined);
  assert.equal(enemy.ar,undefined);
  assert.equal(api.view(state,'boss',map),null);
  assert.equal(v.actors[0].x,3);
  const changed=w.WBEncounterMap.mapModel({...{map:{id:'barrow'}}},w.WB_MAPS);
  assert.equal(api.view(state,'hero',changed).actors[0].x,null,
    'Actors on other maps do not leak positions');
});
test('player-only dispatcher enforces own turn, AP, movement and rejects DM actions',()=>{
  const {w,state,map}=setup(),api=w.WBPlayerSession;
  for(const type of ['ApplyDamage','Heal','SetHealth','GrantAP','UpdateActor',
    'PlaceToken','ClearToken','StartEncounter','ReopenSetup','FinishEncounter'])
    assert.equal(api.issue(state,'hero',type,{actorId:'boss',rawDamage:100},
      'attack-'+type,map).error,'PLAYER_ACTION_NOT_ALLOWED');
  assert.equal(api.issue(state,'boss','MoveToken',{x:8,y:8},'bad-npc',map).error,
    'PLAYER_SEAT_REQUIRED');
  assert.equal(api.issue(state,'ally','MoveToken',{x:5,y:4},'wrong-turn',map).error,
    'NOT_CURRENT_TURN');
  let result=api.issue(state,'hero','MoveToken',{actorId:'boss',x:5,y:5},
    'move-one',map);
  assert.equal(result.ok,true,result.error);
  assert.equal(result.state.actors.hero.x,5);
  assert.equal(result.state.actors.hero.apAvail,5);
  assert.equal(result.state.actors.boss.hp,55);
  result=api.issue(result.state,'hero','SpendAP',{cost:1,actorId:'boss'},
    'spent-one',map);
  assert.equal(result.ok,true);
  assert.equal(result.state.actors.hero.apAvail,4);
  result=api.issue(result.state,'hero','EndTurn',{actorId:'boss'},
    'turn-one',map);
  assert.equal(result.ok,true);
  assert.equal(result.state.order[result.state.turnIndex],'ally');
  assert.equal(api.issue(result.state,'hero','EndTurn',{},
    'not-my-turn',map).error,'NOT_CURRENT_TURN');
  assert.equal(api.issue(result.state,'ally','EndTurn',{},
    'ally-turn',map).ok,true);
});
test('legacy offline seat can act and older encounters normalize consistently',()=>{
 const {w,state,map}=setup();
 const saved=JSON.parse(JSON.stringify(state));
 const actor=saved.actors.hero;
 delete actor.speedFt;
 delete actor.move;
 const fixed=w.WBEncounter.normalizeEncounter(saved);
 assert.equal(fixed.actors.hero.speedFt,5);
 assert.deepEqual(plain(fixed.actors.hero.move),{ft:0,left:0,surge:0});
 assert.ok(w.WBPlayerSession.issue(fixed,'hero','EndTurn',{},'old-seat',map).ok);
});
test('player page exposes expected controls and only player session script',()=>{
 const page=read('player.html'),app=read('js/player.js');
 for(const id of ['playerSeat','playerRefresh','playerFeedback','playerTurnHeading',
  'playerEndTurn','playerSpendForm','playerSpendAP','playerStats','playerMapBoard',
  'playerMapGrid','playerMapPath','playerMapTokens','playerMapAnimation',
  'playerMovePreview','playerMoveConfirm','playerMoveCancel','playerMapStatus'])
   assert.ok(page.includes('id="'+id+'"'),'missing '+id);
 const resources=['css/sheet.css','css/dm.css','css/player.css',
  'js/persistence.js','js/combat-core.js','js/encounter-actions.js',
  'js/game-state.js','js/maps.js','js/encounter-map.js',
  'js/player-session.js','js/player.js'];
 const versions=resources.map(f=>{
   const item=page.match(new RegExp('(?:href|src)="'+f.replace(/\./g,'\\.')+
     '\\?v=([^"]+)"'));
   assert.ok(item,'missing version '+f);return item[1];
 });
 assert.equal(new Set(versions).size,1);
 assert.ok(page.indexOf('js/player-session.js')<page.indexOf('js/player.js'));
 assert.match(app,/wb\.issue\(/);
 assert.match(app,/window\.addEventListener\('storage'/);
 assert.match(app,/repo\.save\(\{\.\.\.fresh,encounter:result\.state\}\)/);
 assert.doesNotMatch(app,/'ApplyDamage'|'Heal'|'PlaceToken'|'GrantAP'/,
   'Player UI must not expose DM commands');
 assert.ok(read('dm.html').includes('href="player.html"'));
 assert.ok(read('index.html').includes('href="player.html"'));
});
test('two local views share encounter storage and player writes do not edit sheet or foes',()=>{
 const {w,state,map,game}=setup();
 const storage=new Map();
 const provider={
  getItem(k){return storage.has(k)?storage.get(k):null;},
  setItem(k,value){storage.set(k,value);},removeItem(k){storage.delete(k);}
 };
 const repos=w.WBPersistence.createLocalRepositories(()=>provider);
 repos.characters.save({fields:{charName:'Original sheet'},hist:{}});
 repos.games.save({...game,encounter:state});
 const fromDm=w.WBGameState.normalizeGame(repos.games.load());
 const action=w.WBPlayerSession.issue(fromDm.encounter,'hero','MoveToken',
   {x:5,y:5},'turn-1',map);
 assert.equal(action.ok,true);
 repos.games.save({...fromDm,encounter:action.state});
 const dmAfter=w.WBGameState.normalizeGame(repos.games.load());
 assert.equal(dmAfter.encounter.actors.hero.x,5);
 assert.deepEqual(plain(repos.characters.load()),{fields:{charName:'Original sheet'},hist:{}});
 assert.deepEqual(plain(dmAfter.tokens),plain(game.tokens));
 assert.deepEqual(plain(dmAfter.foes),plain(game.foes));
});

test('player browser controls preview, confirm and propagate movement across local game saves',()=>{
  const {w,state,game}=setup();
  const store=new Map(), events={};
  w.localStorage={
    getItem(k){return store.has(k)?store.get(k):null;},
    setItem(k,v){store.set(k,v);},
    removeItem(k){store.delete(k);}
  };
  w.sessionStorage={getItem(){return null;},setItem(){}};
  w.confirm=()=>true;
  w.matchMedia=()=>({matches:true});
  w.addEventListener=(type,fn)=>{events['window:'+type]=fn;};
  const repository=w.WBPersistence.createLocalRepositories(()=>w.localStorage);
  repository.characters.save({fields:{charName:'Stored sheet'},hist:{}});
  repository.games.save({...game,encounter:state});
  const listener={},elements={};
  const ids=['playerMapBoard','playerMapTokens','playerMapAnimation',
    'playerFeedback','playerSeat','playerRefresh','playerStatus',
    'playerTurnHeading','playerTurnHint','playerEndTurn','playerSpendAP',
    'playerStats','playerMapGrid','playerMovePreview','playerMapPath',
    'playerMoveText','playerMapStatus','playerMapHelp','playerMoveCancel',
    'playerMoveConfirm','playerSpendForm'];
  for(const id of ids){
    elements['#'+id]={
      innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,
      style:{},classList:{toggle(){}},
      addEventListener(type,fn){listener[id+':'+type]=fn;},
      getBoundingClientRect(){return {left:0,top:0};},
      querySelector(){return null;}
    };
  }
  const doc={
    querySelector(id){if(!elements[id])throw Error(id);return elements[id];},
    addEventListener(type,fn){listener['document:'+type]=fn;}
  };
  vm.runInNewContext(read('js/player.js'),{
    window:w,document:doc,Date,Math,Number,crypto:undefined
  });
  assert.equal(elements['#playerSeat'].value,'hero');
  assert.match(elements['#playerTurnHeading'].textContent,/Your turn/);
  assert.match(elements['#playerStats'].innerHTML,/20 \/ 20/);
  assert.doesNotMatch(elements['#playerStats'].innerHTML,/55/);
  assert.match(elements['#playerMapTokens'].innerHTML,/Warden/);
  listener['playerMapBoard:click']({clientX:5*36+2,clientY:5*36+2});
  assert.equal(elements['#playerMovePreview'].hidden,false);
  assert.equal(w.WBGameState.normalizeGame(repository.games.load()).encounter.actors.hero.x,3,
    'Preview must not change the saved position');
  listener['playerMoveConfirm:click']();
  const after=w.WBGameState.normalizeGame(repository.games.load());
  assert.equal(after.encounter.actors.hero.x,5);
  assert.equal(after.encounter.actors.hero.apAvail,5);
  assert.equal(after.encounter.actors.boss.hp,55);
  assert.deepEqual(plain(repository.characters.load()),{fields:{charName:'Stored sheet'},hist:{}});
  // Simulate the DM tab changing the encounter and sending a same-origin
  // storage notification to the Player Preview.
  const turn=w.WBEncounter.applyAction(after.encounter,{
    id:'dm-end',type:'EndTurn',actorId:'hero',
    expectedRevision:after.encounter.revision
  },dm);
  assert.equal(turn.ok,true);
  repository.games.save({...after,encounter:turn.state});
  events['window:storage']({key:w.WBPersistence.GAME_KEY});
  assert.match(elements['#playerTurnHeading'].textContent,/Now acting: Aran/);
  assert.equal(elements['#playerEndTurn'].disabled,true);
  assert.equal(elements['#playerSpendAP'].disabled,true);
});
