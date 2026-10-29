/* Validated encounter movement: pathfinding, AP, Surge, controls and persistence. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
function modules(){
 const ctx={window:{},Math,Number,Object,Set,Map,Date};
 for(const file of ['js/combat-core.js','js/encounter-actions.js',
   'js/maps.js','js/routing.js','js/encounter-map.js','js/game-state.js',
   'js/abilities.js','js/dm-characters.js'])
   vm.runInNewContext(read(file),ctx);
 return ctx.window;
}
const dm={role:'dm',userId:'gm'};
const alice={role:'player',userId:'alice'};
const bob={role:'player',userId:'bob'};
const hero={id:'hero',kind:'pc',ownerId:'alice',name:'Hero',
 hp:22,maxHp:22,ar:1,apMax:6,speedFt:10,surgeMax:0,initiative:11};
const npc={id:'npc',kind:'npc',name:'Warden',
 hp:19,maxHp:19,ar:2,apMax:6,speedFt:5,initiative:7};
const apply=(api,state,type,detail={},context=dm)=>{
 const result=api.applyAction(state,{id:'a'+(state.revision+1),
   type,expectedRevision:state.revision,...detail},context);
 assert.equal(result.ok,true,result.error);
 return result.state;
};
function gameSetup(id='blank'){
 const w=modules(),e=w.WBEncounter, m=w.WBEncounterMap;
 const game={map:{id,cols:20,rows:15}};
 const map=m.mapModel(game,w.WB_MAPS);
 let state=e.createEncounter('movement');
 state=apply(e,state,'AddActor',{actor:hero});
 state=apply(e,state,'AddActor',{actor:npc});
 const pos=id==='blank'?[[3,3],[8,8]]:[[16,13],[18,13]];
 for(let i=0;i<state.order.length;i++){
   state=apply(e,state,'PlaceToken',{actorId:state.order[i],
     x:pos[i][0],y:pos[i][1]},{...dm,map});
 }
 return {w,e,m,map,game,state};
}
test('shortest routes count 5-foot diagonals and 10-foot difficult terrain',()=>{
 let {m,map,state}=gameSetup();
 const direct=m.movementRoute(state,map,'hero',5,5);
 assert.equal(direct.ok,true);
 assert.equal(direct.ft,10);
 assert.equal(direct.path.length,3);
 assert.equal(direct.rough,0);
 const same=m.movementRoute(state,map,'hero',3,3);
 assert.equal(same.error,'ALREADY_THERE');
 const occupied=m.movementRoute(state,map,'hero',8,8);
 assert.equal(occupied.error,'OCCUPIED_SQUARE');
 ({m,map,state}=gameSetup('stone-hall'));
 const a=m.movementRoute(state,map,'hero',15,12);
 assert.equal(a.ok,true);assert.ok(a.ft>=5);
 const blocked=m.movementRoute(state,map,'hero',0,0);
 assert.equal(blocked.error,'BLOCKED_SQUARE');
 const out=m.movementRoute(state,map,'hero',31,13);
 assert.equal(out.error,'OUT_OF_BOUNDS');
 const noSpot=m.movementRoute({...state,actors:{...state.actors,hero:{...state.actors.hero,
   x:null,y:null,mapId:null}}},map,'hero',16,13);
 assert.equal(noSpot.error,'TOKEN_NOT_PLACED');
 // Single row of rubble must cost 10 ft per square.
 const local={...map,id:'rough-grid',cols:5,rows:5,def:{
   terrain:['#####','#.###','#r###','#.###','#####'] }};
 const enc={order:['hero'],actors:{hero:{...state.actors.hero,mapId:'rough-grid',x:1,y:1}}};
 const rough=m.movementRoute(enc,local,'hero',1,3);
 assert.equal(rough.ok,true);
 assert.equal(rough.ft,15);
 assert.equal(rough.rough,1);
});
test('combat movement debits authoritative AP, carries feet, and resets each new turn',()=>{
 const {w,e,map}=gameSetup();
 let state=gameSetup().state; // same pure snapshot
 state=apply(e,state,'StartEncounter');
 const moving=(x,y,ctx=alice)=>e.applyAction(state,{
   id:'move'+(state.revision+1),type:'MoveToken',
   actorId:'hero',x,y,expectedRevision:state.revision
 },{...ctx,map});
 let result=moving(5,5);
 assert.equal(result.ok,true);
 assert.equal(result.event.ft,10);
 assert.equal(result.event.paid,1);
 state=result.state;
 assert.equal(state.actors.hero.apAvail,5);
 assert.equal(state.actors.hero.move.left,0);
 result=moving(6,5);
 assert.equal(result.ok,true);
 state=result.state;
 assert.equal(state.actors.hero.apAvail,4);
 assert.equal(state.actors.hero.move.left,5);
 assert.equal(state.actors.hero.move.ft,15);
 result=moving(7,5);
 assert.equal(result.ok,true);
 state=result.state;
 assert.equal(result.event.paid,0,'Leftover feet should avoid new AP');
 assert.equal(state.actors.hero.apAvail,4);
 assert.equal(state.actors.hero.move.left,0);
 const before=plain(state);
 const other=e.applyAction(state,{id:'wrong',type:'MoveToken',actorId:'npc',
   x:9,y:9,expectedRevision:state.revision},{...dm,map});
 assert.equal(other.error,'NOT_CURRENT_TURN');
 assert.deepEqual(plain(state),before);
 state=apply(e,state,'EndTurn',{actorId:'hero'});
 state=apply(e,state,'EndTurn',{actorId:'npc'});
 assert.equal(state.actors.hero.apAvail,6);
 assert.deepEqual(plain(state.actors.hero.move),{ft:0,left:0,surge:0});
});
test('Surge grants two free movement AP and Command AP is spent first',()=>{
 const {e,map}=gameSetup();
 let state=gameSetup().state;
 state=apply(e,state,'UpdateActor',{actorId:'hero',changes:{speedFt:5,surgeMax:2}});
 state=apply(e,state,'StartEncounter');
 let result=e.applyAction(state,{
   id:'surge1',type:'MoveToken',actorId:'hero',x:5,y:5,
   expectedRevision:state.revision
 },{...dm,map});
 assert.equal(result.ok,true);state=result.state;
 assert.equal(result.event.free,2);
 assert.equal(result.event.paid,0);
 assert.equal(state.actors.hero.move.surge,2);
 assert.equal(state.actors.hero.apAvail,6);
 state=apply(e,state,'GrantAP',{actorId:'hero',amount:2});
 result=e.applyAction(state,{id:'surge2',type:'MoveToken',actorId:'hero',
   x:6,y:6,expectedRevision:state.revision},{...dm,map});
 assert.equal(result.ok,true);state=result.state;
 assert.equal(result.event.paid,1);
 assert.equal(state.actors.hero.apGiven.n,1);
 assert.equal(state.actors.hero.apAvail,6);
});
test('ownership, map, dead actor, AP and stale revision protections reject moves',()=>{
 const {e,m,map}=gameSetup();
 let state=gameSetup().state;
 const before=plain(state);
 const action=(id,x,y,ctx=dm,rev=state.revision)=>e.applyAction(state,{
   id,type:'MoveToken',actorId:'hero',x,y,expectedRevision:rev
 },ctx);
 assert.equal(action('before',4,4,{...alice,map}).error,'ENCOUNTER_NOT_ACTIVE');
 state=apply(e,state,'StartEncounter');
 assert.equal(action('other',4,4,{...bob,map}).error,'NOT_YOUR_ACTOR');
 assert.equal(action('no-map',4,4,dm).error,'MAP_REQUIRED');
 assert.equal(action('stale',4,4,{...alice,map},state.revision-1).error,'REVISION_CONFLICT');
 assert.equal(action('bad-xy',8,8,{...alice,map}).error,'OCCUPIED_SQUARE');
 assert.equal(action('invalid',2.5,4,{...alice,map}).error,'INVALID_POSITION');
 let removed=apply(e,state,'ClearToken',{actorId:'hero'});
 assert.equal(e.applyAction(removed,{id:'unplaced',type:'MoveToken',actorId:'hero',x:4,y:4,
   expectedRevision:removed.revision},{...alice,map}).error,'TOKEN_NOT_PLACED');
});
test('speed zero, insufficient AP, initiative and unconscious restrictions',()=>{
 const {e,map}=gameSetup();
 let state=gameSetup().state;
 state=apply(e,state,'UpdateActor',{actorId:'hero',changes:{speedFt:0}});
 state=apply(e,state,'StartEncounter');
 let move={id:'no-speed',type:'MoveToken',actorId:'hero',x:4,y:3,
   expectedRevision:state.revision};
 assert.equal(e.applyAction(state,move,{...dm,map}).error,'NO_MOVEMENT');
 // Spend all AP by existing action, then try moving.
 let baseline=gameSetup().state;
 baseline=apply(e,baseline,'StartEncounter');
 baseline=apply(e,baseline,'SpendAP',{actorId:'hero',cost:6});
 assert.equal(e.applyAction(baseline,{...move,id:'no-ap',expectedRevision:baseline.revision},
   {...dm,map}).error,'INSUFFICIENT_AP');
 baseline=apply(e,baseline,'SetHealth',{actorId:'hero',hp:0});
 assert.equal(e.applyAction(baseline,{...move,id:'down',expectedRevision:baseline.revision},
   {...dm,map}).error,'ACTOR_UNCONSCIOUS');
});
test('imported AGL, Movement overrides and ability effects use existing shared sheet rules',()=>{
 const w=modules();
 const state={id:'pc1',fields:{level:'1',charName:'Swift',hpCur:'10',apMax:'15'},
   hist:{AGL:{1:22},VIT:{1:16}},over:{},items:[],equip:{},
   rolls:{},lvGear:{},asi:{},abilities:[],abilityLoadouts:[],activeAbilityLoadoutId:''};
 const p=w.WBDMCharacters.fromCharacter(state,'fallback').actor;
 assert.equal(p.speedFt,25,'AGL 22 gives +4; 5*(1+4) ft/AP');
 assert.equal(p.surgeMax,2,'AGL 21+ gives two free Surge AP');
 assert.equal(p.apMax,15);
 state.over.speed='40';
 assert.equal(w.WBDMCharacters.fromCharacter(state,'fallback').actor.speedFt,40);
 state.over.speed='0';
 assert.equal(w.WBDMCharacters.fromCharacter(state,'fallback').actor.speedFt,0);
});
test('UI exposes separate free placement and preview-confirmed combat movement',()=>{
 const html=read('dm.html'),js=read('js/dm-map.js'),ctl=read('js/dm.js');
 for(const id of ['dmMapMode','dmMovePreview','dmMoveText','dmMoveConfirm',
   'dmMoveCancel','dmMapPath','dmMapChoices','dmMapNotice','dmMapAnimation'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(js,/movementRoute\(/);
 assert.match(js,/movePlan\(/);
 assert.match(js,/dmMoveConfirm/);
 assert.match(js,/options\.command\('MoveToken'/);
 assert.match(ctl,/type === 'PlaceToken' \|\| type === 'MoveToken'/);
});

test('DM map previews movement first and only deducts AP after Confirm',()=>{
 const {w,e,map,game}=gameSetup();
 let state=gameSetup().state;
 state=apply(e,state,'StartEncounter');
 const nodes={},listeners={};
 const ids=['dmMapPick','dmMapActor','dmMapBoard','dmMapTokens','dmMapGrid',
   'dmMapClear','dmMapStatus','dmMapMode','dmMovePreview','dmMoveText',
   'dmMoveConfirm','dmMoveCancel','dmMapPath','dmMapHelp','dmMapChoices','dmMapNotice','dmMapAnimation'];
 for(const name of ids)nodes['#'+name]={
   style:{},value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,
   addEventListener(type,fn){listeners[name+':'+type]=fn;},
   getBoundingClientRect(){return {left:0,top:0};}
 };
 const ctx={window:{WB_MAPS:w.WB_MAPS,WBEncounterMap:w.WBEncounterMap,WBCombat:w.WBCombat},
   document:{querySelector(s){if(!nodes[s])throw Error('Missing '+s);return nodes[s];}}};
 vm.runInNewContext(read('js/dm-map.js'),ctx);
 let calls=[];
 const instance=ctx.window.WBDMMap.init({
   getGame:()=>game,getEncounter:()=>state,
   command(type,data) {
     calls.push({type,data});
     state=apply(e,state,type,data,{...dm,map});
     return true;
   },
   selectMap(id){game.map.id=id;},
   message(s){throw Error('Unexpected error: '+s);}
 });
 instance.render();
 assert.equal(nodes['#dmMapMode'].value,'move');
 const old=state.actors.hero.apAvail;
 listeners['dmMapBoard:click']({
   clientX:5*36+4,clientY:5*36+4,
   target:{closest(){return null;}}
 });
 assert.equal(calls.length,0,'Preview does not apply a command');
 assert.equal(nodes['#dmMovePreview'].hidden,false);
 assert.equal(state.actors.hero.apAvail,old);
 assert.match(nodes['#dmMoveText'].textContent,/10 ft/);
 assert.match(nodes['#dmMapPath'].innerHTML,/dm-path-cell/);
 listeners['dmMoveConfirm:click']();
 assert.equal(calls.length,1);
 assert.equal(calls[0].type,'MoveToken');
 assert.equal(state.actors.hero.apAvail,old-1);
 assert.equal(nodes['#dmMovePreview'].hidden,true);
 assert.equal(state.actors.hero.x,5);
 assert.equal(state.actors.hero.y,5);
});

test('finished encounter can return to editable setup without losing its roster or tokens',()=>{
  const {e,map}=gameSetup();
  let state=gameSetup().state;
  const positions=plain(state.order.map(id=>({
    id,x:state.actors[id].x,y:state.actors[id].y,mapId:state.actors[id].mapId
  })));
  state=apply(e,state,'StartEncounter');
  state=apply(e,state,'MoveToken',{actorId:'hero',x:5,y:5},{...dm,map});
  state=apply(e,state,'ApplyDamage',{actorId:'hero',rawDamage:10});
  const hp=state.actors.hero.hp;
  state=apply(e,state,'FinishEncounter');
  const finished=state;
  assert.equal(state.phase,'finished');
  state=apply(e,state,'ReopenSetup');
  assert.equal(state.phase,'setup');
  assert.equal(state.round,0);
  assert.equal(state.actors.hero.hp,hp,'Continuing HP is not silently healed');
  assert.equal(state.actors.hero.apAvail,state.actors.hero.apMax);
  assert.deepEqual(plain(state.actors.hero.move),{ft:0,left:0,surge:0});
  assert.deepEqual(plain(state.order),plain(finished.order));
  assert.equal(state.actors.npc.mapId,positions[1].mapId);
  assert.equal(state.actors.npc.x,positions[1].x);
  assert.equal(state.actors.npc.y,positions[1].y);
  state=apply(e,state,'AddActor',{actor:{id:'newfoe',name:'Reinforcement',
    kind:'npc',hp:12,maxHp:12,ar:1,apMax:4,speedFt:5,initiative:2}});
  state=apply(e,state,'UpdateActor',{actorId:'hero',changes:{hp:22,initiative:19}});
  state=apply(e,state,'StartEncounter');
  assert.equal(state.phase,'active');
  assert.equal(state.round,1);
  assert.equal(state.order.length,3);
  const illegal=e.applyAction(state,{id:'bad-reopen',type:'ReopenSetup',
    expectedRevision:state.revision},{...alice,map});
  assert.equal(illegal.error,'DM_ONLY');
  assert.equal(e.applyAction(state,{id:'bad-reopen2',type:'ReopenSetup',
    expectedRevision:state.revision},dm).error,'ENCOUNTER_NOT_FINISHED');
});

test('map choice buttons work and movement follows active turn with visible local feedback',()=>{
  const {w,e,game}=gameSetup();
  let state=gameSetup().state;
  state=apply(e,state,'StartEncounter');
  const elements={},listeners={};
  const ids=['dmMapPick','dmMapActor','dmMapBoard','dmMapTokens','dmMapGrid',
    'dmMapClear','dmMapStatus','dmMapMode','dmMovePreview','dmMoveText',
    'dmMoveConfirm','dmMoveCancel','dmMapPath','dmMapHelp','dmMapChoices','dmMapNotice','dmMapAnimation'];
  for(const id of ids)elements['#'+id]={
    style:{},value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,
    addEventListener(event,fn){listeners[id+':'+event]=fn;},
    getBoundingClientRect(){return {left:0,top:0}}
  };
  const ctx={window:{WB_MAPS:w.WB_MAPS,WBEncounterMap:w.WBEncounterMap,
    WBCombat:w.WBCombat},
    document:{querySelector(id){if(!elements[id])throw Error('No '+id);return elements[id];}}};
  vm.runInNewContext(read('js/dm-map.js'),ctx);
  let errors=[],calls=[];
  const ui=ctx.window.WBDMMap.init({
    getGame:()=>game,getEncounter:()=>state,
    command(type,params){
      calls.push(type);
      state=apply(e,state,type,params,{...dm,map:w.WBEncounterMap.mapModel(game,w.WB_MAPS)});
      return true;
    },
    selectMap(id){game.map.id=id;return true;},
    message(text){errors.push(text)}
  });
  ui.render();
  assert.match(elements['#dmMapChoices'].innerHTML,/Blank grid/);
  assert.match(elements['#dmMapChoices'].innerHTML,/Stone Hall/);
  assert.equal(elements['#dmMapMode'].value,'move');
  assert.equal(elements['#dmMapActor'].value,'hero');
  assert.equal(elements['#dmMapActor'].disabled,true);
  listeners['dmMapChoices:click']({target:{closest(){return {dataset:{dmMap:'stone-hall'}};}}});
  assert.equal(game.map.id,'stone-hall');
  assert.match(elements['#dmMapChoices'].innerHTML,/aria-pressed="true"/);
  listeners['dmMapChoices:click']({target:{closest(){return {dataset:{dmMap:'blank'}};}}});
  assert.equal(game.map.id,'blank');
  listeners['dmMapBoard:click']({target:{closest(){return null}},
    clientX:5*36+2,clientY:5*36+2});
  assert.match(elements['#dmMapNotice'].textContent,/Route preview ready/);
  assert.equal(state.actors.hero.x,3,'Preview alone cannot move an actor');
  listeners['dmMoveConfirm:click']();
  assert.equal(state.actors.hero.x,5);
  assert.equal(state.actors.hero.y,5);
  assert.match(elements['#dmMapNotice'].textContent,/Movement completed/);
  state=apply(e,state,'EndTurn',{actorId:'hero'});
  ui.render();
  assert.equal(elements['#dmMapActor'].value,'npc','Moves automatically follow initiative');
  assert.match(elements['#dmMapHelp'].textContent,/current combatant/);
  state=apply(e,state,'FinishEncounter');
  ui.render();
  assert.equal(elements['#dmMapMode'].value,'place');
  assert.equal(elements['#dmMapMode'].disabled,true);
  assert.match(elements['#dmMapHelp'].textContent,/Reuse roster/);
});


test('equal-cost routes stay straight on open horizontal and vertical lines',()=>{
  const {m,map,state}=gameSetup();
  const horizontal=m.movementRoute(state,map,'hero',7,3);
  assert.equal(horizontal.ok,true);
  assert.equal(horizontal.ft,20);
  assert.deepEqual(plain(horizontal.path),[
    {x:3,y:3},{x:4,y:3},{x:5,y:3},{x:6,y:3},{x:7,y:3}
  ]);
  const vertical=m.movementRoute(state,map,'hero',3,7);
  assert.equal(vertical.ok,true);
  assert.deepEqual(plain(vertical.path),[
    {x:3,y:3},{x:3,y:4},{x:3,y:5},{x:3,y:6},{x:3,y:7}
  ]);
  const mixed=m.movementRoute(state,map,'hero',8,5);
  assert.equal(mixed.ft,25);
  assert.equal(mixed.path.length,6);
  // A necessary diagonal is fine; zigzag detours should not be chosen when
  // equally cheap straight steps exist.
  const diagonals=mixed.path.slice(1).filter((v,i)=>{
    const p=mixed.path[i];return v.x!==p.x&&v.y!==p.y;
  });
  assert.equal(diagonals.length,2);
  const crooked=m.movementRoute(state,map,'hero',7,7);
  assert.deepEqual(plain(crooked.path),[
    {x:3,y:3},{x:4,y:4},{x:5,y:5},{x:6,y:6},{x:7,y:7}
  ]);
});

test('approved movement animates through route keyframes without delaying AP save',async()=>{
  const {w,e,map,game}=gameSetup();
  let state=gameSetup().state;
  state=apply(e,state,'StartEncounter');
  const elements={},listeners={};
  const ids=['dmMapPick','dmMapActor','dmMapBoard','dmMapTokens','dmMapGrid',
    'dmMapClear','dmMapStatus','dmMapMode','dmMovePreview','dmMoveText',
    'dmMoveConfirm','dmMoveCancel','dmMapPath','dmMapHelp','dmMapChoices',
    'dmMapNotice','dmMapAnimation'];
  for(const id of ids)elements['#'+id]={
    style:{},value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,
    addEventListener(type,fn){listeners[id+':'+type]=fn;},
    getBoundingClientRect(){return {left:0,top:0}}
  };
  let frames=null,settings=null,resolveAnimation;
  const animatedToken={
    style:{},
    animate(nextFrames,nextSettings){
      frames=plain(nextFrames);
      settings=plain(nextSettings);
      return {
        finished:new Promise(resolve=>{resolveAnimation=resolve;}),
        cancel(){}
      };
    }
  };
  const saved={style:{visibility:''}};
  elements['#dmMapTokens'].querySelector=()=>saved;
  elements['#dmMapAnimation'].querySelector=()=>{
    return elements['#dmMapAnimation'].innerHTML.includes('<span')?animatedToken:null;
  };
  const context={window:{WB_MAPS:w.WB_MAPS,WBEncounterMap:w.WBEncounterMap,
    WBCombat:w.WBCombat},
    document:{querySelector(id){if(!elements[id])throw Error(id);return elements[id]}}};
  vm.runInNewContext(read('js/dm-map.js'),context);
  const ui=context.window.WBDMMap.init({
    getGame:()=>game,getEncounter:()=>state,
    command(type,params){
      const result=e.applyAction(state,{
        id:'animate-'+state.revision,type,expectedRevision:state.revision,...params
      },{...dm,map});
      assert.equal(result.ok,true,result.error);
      state=result.state;return result;
    },
    selectMap(){return true;},
    message(message){throw Error(message);}
  });
  ui.render();
  listeners['dmMapBoard:click']({
    clientX:5*36+2,clientY:3*36+2,
    target:{closest(){return null;}}
  });
  assert.equal(state.actors.hero.x,3,'Preview should not commit a move');
  listeners['dmMoveConfirm:click']();
  assert.equal(state.actors.hero.x,5,'Validated position is stored immediately');
  assert.equal(state.actors.hero.apAvail,5,'AP is spent exactly once at confirmation');
  assert.equal(saved.style.visibility,'hidden','End-position token is hidden while traveling');
  assert.equal(settings.easing,'linear');
  assert.equal(settings.duration,340,'One visible transition per five-foot square');
  assert.deepEqual(frames.map(f=>f.transform),[
    'translate(0px, 0px)',
    'translate(36px, 0px)',
    'translate(72px, 0px)'
  ]);
  assert.match(elements['#dmMapAnimation'].innerHTML,/left:111px;top:111px/);
  resolveAnimation();
  await Promise.resolve();
  assert.equal(elements['#dmMapAnimation'].innerHTML,'');
  assert.equal(saved.style.visibility,'');
  assert.match(elements['#dmMapNotice'].textContent,/Movement completed/);
});
