/* Shared routing: one engine for DM, sheet fog planning and eight-way occupancy. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const window={};
vm.runInNewContext(read('js/routing.js'),{window,Number,Array,Int32Array,Math,Set,Map});
vm.runInNewContext(read('js/encounter-map.js'),{window,Number,Array,Int32Array,Math,Set,Map});
const plan=(terrain,start,occupants=[],side='party',goal=null,seen=null)=>window.WBRouting.findPaths({
  cols:terrain[0].length,rows:terrain.length,terrain,start,side,occupants,seen,goal
});
const corridor=['#####','#...#','#####','#####','#####'];
const start={x:1,y:1};
const guest=(side,hp=20)=>({id:'guest',x:2,y:1,side,hp});
const target={x:3,y:1};
test('armor and prone cost multipliers share the same route calculation for sheet and DM',()=>{
 const input={cols:3,rows:1,start:{x:0,y:0},terrain:['.r.'],goal:{x:2,y:0}};
 assert.equal(window.WBRouting.findPaths(input).to(2,0).ft,15);
 assert.equal(window.WBRouting.findPaths({...input,costMultiplier:2}).to(2,0).ft,30);
 assert.equal(window.WBRouting.findPaths({...input,costMultiplier:4}).to(2,0).ft,60);
});
test('party ally can be crossed in a one-square corridor at normal cost, never occupied as endpoint',()=>{
  const routes=plan(corridor,start,[guest('party')],'party',target);
  const via=routes.to(3,1);
  assert.equal(via.ok,true);
  assert.equal(via.ft,10);
  assert.deepEqual(Array.from(via.path, x=>[x.x,x.y]),[[1,1],[2,1],[3,1]]);
  assert.equal(routes.to(2,1).error,'OCCUPIED_SQUARE');
  // Reachability shade must not show a legal stopping point on occupied ally.
  assert.equal(routes.dist[1*5+2],Infinity);
});
test('downed enemies and downed allies can be crossed, but not used as destinations',()=>{
  for(const side of ['enemy','party']) {
    const routes=plan(corridor,start,[guest(side,0)],'party',target);
    assert.equal(routes.to(3,1).ok,true);
    assert.equal(routes.to(3,1).ft,10);
    assert.equal(routes.to(2,1).error,'OCCUPIED_SQUARE');
  }
});
test('standing opponent blocks a one-square corridor even when detours would normally be possible',()=>{
  const routes=plan(corridor,start,[guest('enemy',10)],'party',target);
  assert.equal(routes.to(3,1).error,'NO_PATH');
  assert.equal(routes.to(2,1).error,'OCCUPIED_SQUARE');
});
test('same routing supports enemy acting through its ally and blocking a party actor',()=>{
  const friend=plan(corridor,start,[guest('enemy')],'enemy',target);
  assert.equal(friend.to(3,1).ft,10);
  const enemy=plan(corridor,start,[guest('party')],'enemy',target);
  assert.equal(enemy.to(3,1).error,'NO_PATH');
});
test('fog assumes unseen terrain is open, without exposing an unknown enemy',()=>{
  const hidden=['.....','..#..','.....','.....','.....'];
  const seen=Array(25).fill(0);
  seen[1*5+1]=1;seen[1*5+3]=1;
  const naive=plan(hidden,{x:1,y:1},[guest('enemy')],'party',{x:3,y:1},seen).to(3,1);
  assert.equal(naive.ok,true,'hidden wall and occupant do not leak into player route');
  assert.equal(naive.ft,10);
  const discovered=Array(25).fill(1);
  const real=plan(hidden,{x:1,y:1},[guest('enemy')],'party',{x:3,y:1},discovered).to(3,1);
  assert.equal(real.ok,true,'the route can detour around the now visible obstruction');
  assert.equal(real.ft,10,'two legal diagonals cost the same as two straight steps');
  assert.ok(!real.path.some(c=>c.x===2&&c.y===1));
});
test('no diagonal squeezing through two walls; rough terrain costs 10 feet',()=>{
  const corner=['.....','..#..','.#...','.....','.....'];
  const route=plan(corner,{x:1,y:1},[],'party',{x:2,y:2}).to(2,2);
  assert.equal(route.ok,true);
  assert.ok(route.path.length>2,'cannot cut through touching wall corners');
  const rough=['#####','#r..#','#####','#####','#####'];
  const p=plan(rough,{x:1,y:1},[],'party',{x:3,y:1}).to(3,1);
  assert.equal(p.ft,10);
  assert.equal(p.rough,0,'starting on rough does not charge entry');
  const entered=plan(rough,{x:2,y:1},[],'party',{x:1,y:1}).to(1,1);
  assert.equal(entered.ft,10);
  assert.equal(entered.rough,1);
});
test('DM adapter calls identical route function and side defaults work with old saves',()=>{
  const map={id:'corridor',cols:5,rows:5,def:{terrain:corridor}};
  const encounter={order:['hero','npc'],actors:{
    hero:{id:'hero',mapId:'corridor',x:1,y:1,side:'party',hp:30},
    npc:{id:'npc',mapId:'corridor',x:2,y:1,side:'party',hp:30}
  }};
  const dm=window.WBEncounterMap.movementRoute(encounter,map,'hero',3,1);
  assert.equal(dm.ok,true);
  assert.equal(dm.ft,10);
  encounter.actors.npc.side='enemy';
  assert.equal(window.WBEncounterMap.movementRoute(encounter,map,'hero',3,1).error,'NO_PATH');
});
test('sheet and DM scripts load the shared route engine before either controller',()=>{
  const sheet=read('index.html'),dm=read('dm.html'),player=read('player.html'),app=read('js/app.js');
  for(const html of [sheet,dm,player]){
    assert.match(html,/js\/routing.js\?v=/);
    assert.ok(html.indexOf('js/routing.js')<html.indexOf('js/app.js') ||
      html.indexOf('js/routing.js')<html.indexOf('js/encounter-map.js'));
  }
  assert.match(app,/window\.WBRouting\.findPaths\(/);
  assert.doesNotMatch(app,/const heap = \[\[0, start\]\]/,'sheet may not reintroduce its own pathfinder');
});
