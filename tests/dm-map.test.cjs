/* Encounter map placement and offline DM presentation regression tests. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const ctx={window:{},Math,Date,Number,Set,Map,Object};
 for(const file of ['js/combat-core.js','js/encounter-actions.js',
   'js/maps.js','js/encounter-map.js','js/game-state.js'])
   vm.runInNewContext(read(file),ctx);
 return ctx.window;
}
const dm={role:'dm',userId:'local'};
function dispatch(api,session,type,detail={},context=dm) {
 const result=api.applyAction(session,{
   id:'action-'+(session.revision+1),expectedRevision:session.revision,type,...detail
 },context);
 assert.equal(result.ok,true,result.error);
 return result.state;
}
const hero={id:'hero',name:'Hero',kind:'pc',ownerId:'test',maxHp:20,hp:20,ar:2,apMax:15,initiative:10};
const lich={id:'lich',name:'Lich',kind:'npc',maxHp:30,hp:30,ar:3,apMax:15,initiative:5};
test('map model uses same dimensions/artwork and safe fallbacks as character Battlemap',()=>{
 const w=setup();
 const e=w.WBEncounterMap;
 let map=e.mapModel({map:{id:'stone-hall',cols:40,rows:40}},w.WB_MAPS);
 assert.equal(map.id,'stone-hall');assert.equal(map.cols,30);assert.equal(map.rows,15);
 assert.equal(map.def.img,'maps/stone-hall-2.webp');
 assert.equal(e.blocked(map,0,0),true,'Wall is blocked');
 assert.equal(e.blocked(map,16,13),false,'Starting corridor is open');
 const other=e.mapModel({map:{id:'blank',cols:28,rows:22}},w.WB_MAPS);
 assert.equal(other.cols,28);assert.equal(other.rows,22);
 assert.equal(e.mapModel({map:{id:'missing',cols:500,rows:3}},w.WB_MAPS).id,'blank');
 assert.equal(e.squareName(0,0),'A1');assert.equal(e.squareName(25,9),'Z10');
 assert.equal(e.squareName(26,9),'AA10');
});
test('DM can place a party and NPC on the same map and retains map-bound coordinates',()=>{
 const w=setup(),api=w.WBEncounter,board=w.WBEncounterMap;
 let state=api.createEncounter('room');
 state=dispatch(api,state,'AddActor',{actor:hero});
 state=dispatch(api,state,'AddActor',{actor:lich});
 const map=board.mapModel({map:{id:'stone-hall'}},w.WB_MAPS);
 assert.equal(board.checkPlacement(state,map,'hero',5,5).ok,true);
 assert.equal(board.checkPlacement(state,map,'hero',0,0).error,'BLOCKED_SQUARE');
 state=dispatch(api,state,'PlaceToken',{actorId:'hero',x:16,y:13},{...dm,map});
 assert.equal(state.actors.hero.mapId,'stone-hall');
 assert.equal(state.actors.hero.x,16);
 assert.equal(state.actors.hero.y,13);
 assert.equal(board.checkPlacement(state,map,'lich',16,13).error,'OCCUPIED_SQUARE');
 const bad=api.applyAction(state,{id:'bad',type:'PlaceToken',expectedRevision:state.revision,
   actorId:'lich',x:16,y:13},{...dm,map});
 assert.equal(bad.error,'OCCUPIED_SQUARE','core rejects occupied placement, not only the UI');
 state=dispatch(api,state,'PlaceToken',{actorId:'lich',x:17,y:13},{...dm,map});
 assert.deepEqual(plain(board.tokenActors(state,map).map(actor=>actor.id)),['hero','lich']);
 const barrow=board.mapModel({map:{id:'barrow'}},w.WB_MAPS);
 assert.equal(board.tokenActors(state,barrow).length,0,'No cross-map ghost tokens');
 assert.equal(board.checkPlacement(state,barrow,'lich',22,8).ok,true);
 state=dispatch(api,state,'PlaceToken',{actorId:'lich',x:22,y:8},{...dm,map:barrow});
 assert.equal(state.actors.lich.mapId,'barrow');
 assert.deepEqual(plain(board.tokenActors(state,map).map(actor=>actor.id)),['hero']);
 assert.deepEqual(plain(board.tokenActors(state,barrow).map(actor=>actor.id)),['lich']);
 state=dispatch(api,state,'ClearToken',{actorId:'hero'});
 assert.equal(state.actors.hero.x,null);
 assert.equal(state.actors.hero.y,null);
 assert.equal(state.actors.hero.mapId,null);
 assert.equal(board.tokenActors(state,map).length,0);
});
test('placement commands keep DM-only role boundaries and validate map bounds',()=>{
 const w=setup(),api=w.WBEncounter;
 let state=dispatch(api,api.createEncounter('test'),'AddActor',{actor:hero});
 const map=w.WBEncounterMap.mapModel({map:{id:'barrow'}},w.WB_MAPS);
 const act=(id,type,x,y,role='dm')=>api.applyAction(state,{
   id,type,expectedRevision:state.revision,actorId:'hero',x,y
 },{role,userId:'offline',map});
 assert.equal(act('a','PlaceToken',26,8).error,'OUT_OF_BOUNDS');
 assert.equal(act('b','PlaceToken',0,0).error,'BLOCKED_SQUARE');
 assert.equal(act('c','PlaceToken',22,8,'player').error,'DM_ONLY');
 assert.equal(act('d','ClearToken',22,8,'player').error,'DM_ONLY');
 assert.deepEqual(plain(state.actors.hero).x,null);
});
test('new map representation roundtrips inside game without rewriting other records',()=>{
 const w=setup();
 const game={
   map:{id:'stone-hall',rev:2,cols:30,rows:15,free:false,fogOff:false},
   tokens:{original:{x:8,y:8}},fog:{},foes:[{
     id:'enemy1',map:'stone-hall',x:4,y:5,name:'Knight',hp:7,max:10,ev:15,ar:2
   }],view:{grid:45,terrainOn:false,reachOff:false}
 };
 const before=plain(game);
 let encounter=dispatch(w.WBEncounter,w.WBEncounter.createEncounter('new'),'AddActor',{actor:hero});
 const map=w.WBEncounterMap.mapModel(game,w.WB_MAPS);
 encounter=dispatch(w.WBEncounter,encounter,'PlaceToken',{actorId:'hero',x:16,y:13},{...dm,map});
 const output=w.WBGameState.normalizeGame({...game,encounter});
 assert.deepEqual(plain(game),before);
 assert.deepEqual(plain(output.tokens),before.tokens);
 assert.deepEqual(plain(output.foes),before.foes);
 assert.equal(output.encounter.actors.hero.mapId,'stone-hall');
});
test('DM map has controls, terrain display and browser click-to-place wiring',()=>{
 const html=read('dm.html'),css=read('css/dm.css'),controller=read('js/dm.js'),mapUi=read('js/dm-map.js');
 for(const id of ['dmMapPick','dmMapActor','dmMapClear','dmMapBoard','dmMapGrid','dmMapTokens','dmMapStatus']){
   assert.ok(html.includes('id="'+id+'"'),'missing map control '+id);
 }
 for(const resource of ['js/maps.js','js/encounter-map.js','js/dm-map.js']){
   assert.ok(html.includes('src="'+resource+'?v='),resource);
 }
 assert.ok(html.indexOf('js/maps.js')<html.indexOf('js/encounter-map.js'));
 assert.ok(html.indexOf('js/encounter-map.js')<html.indexOf('js/dm-map.js'));
 assert.ok(html.indexOf('js/dm-map.js')<html.indexOf('js/dm.js'));
 assert.match(css,/\.dm-map-board/);
 assert.match(mapUi,/checkPlacement\(/);
 assert.match(mapUi,/PlaceToken/);
 assert.match(controller,/context,\s*map: window\.WBEncounterMap\.mapModel/);
 assert.match(controller,/repository\.save\(next\)/);
});
test('render and click board use selected actor and map coordinates without free movement',()=>{
 const w=setup(),api=w.WBEncounter;
 let state=dispatch(api,api.createEncounter('room'),'AddActor',{actor:hero});
 const game={map:{id:'blank',cols:20,rows:15}};
 const listeners={};
 const elements={};
 const ids=['dmMapPick','dmMapActor','dmMapBoard','dmMapTokens','dmMapGrid',
   'dmMapClear','dmMapStatus','dmMapMode','dmMovePreview','dmMoveText',
   'dmMoveConfirm','dmMoveCancel','dmMapPath','dmMapHelp'];
 for(const id of ids){
   elements['#'+id]={
     innerHTML:'',textContent:'',value:'',disabled:false,style:{},
     addEventListener(name,fn){listeners[id+':'+name]=fn;},
     getBoundingClientRect(){return{left:100,top:100}}
   };
 }
 const ctx={window:{WB_MAPS:w.WB_MAPS,WBEncounterMap:w.WBEncounterMap,WBCombat:w.WBCombat},
   document:{querySelector(key){if(!elements[key])throw Error(key);return elements[key]}}};
 vm.runInNewContext(read('js/dm-map.js'),ctx);
 let latestAction=null;
 const instance=ctx.window.WBDMMap.init({
   getGame:()=>game,getEncounter:()=>state,
   command(type,detail){
     latestAction={type,detail};
     state=dispatch(api,state,type,detail,{...dm,map:w.WBEncounterMap.mapModel(game,w.WB_MAPS)});
   },
   selectMap(id){game.map.id=id;},
   message(){throw Error('unexpected UI error')}
 });
 instance.render();
 assert.equal(elements['#dmMapBoard'].style.width,'720px');
 listeners['dmMapBoard:click']({clientX:100+3*36+2,clientY:100+2*36+2,
   target:{closest(){return null}}});
 assert.equal(latestAction.type,'PlaceToken');
 assert.equal(state.actors.hero.x,3);
 assert.equal(state.actors.hero.y,2);
 instance.render();
 assert.match(elements['#dmMapTokens'].innerHTML,/data-dm-token="hero"/);
 listeners['dmMapClear:click']();
 assert.equal(latestAction.type,'ClearToken');
 assert.equal(state.actors.hero.x,null);
});
