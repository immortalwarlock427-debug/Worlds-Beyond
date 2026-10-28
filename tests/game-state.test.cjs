const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function api() {
 const ctx={window:{},Math,Number,Set,Object};
 vm.runInNewContext(read('js/game-state.js'),ctx);
 return ctx.window.WBGameState;
}
const plain=v=>JSON.parse(JSON.stringify(v));
test('blank DM-owned game has no character data and is independent per call',()=>{
 const core=api(),a=core.blankGame(),b=core.blankGame();
 assert.deepEqual(plain(a),{map:null,tokens:{},fog:{},foes:[],view:{}});
 a.tokens.foo={x:1,y:2};assert.deepEqual(plain(b.tokens),{});
 assert.equal(a.fields,undefined);
});
test('game normalizer retains known map, fog, token, foe and view data',()=>{
 const core=api();
 const game={
  map:{id:'barrow',rev:4,cols:30,rows:30,free:true,fogOff:false},
  tokens:{cabc1234:{x:6,y:7}},
  fog:{barrow:{rev:4,seen:'0101'}},
  foes:[{id:'e1',map:'barrow',x:10,y:12,name:'Lich',hp:13,max:20,ev:15,ar:3}],
  view:{grid:0.5,terrainOn:true,reachOff:false}
 };
 assert.deepEqual(plain(core.normalizeGame(game)),game);
 const clone=core.normalizeGame(game);
 clone.tokens.cabc1234.x=99;
 assert.equal(game.tokens.cabc1234.x,6);
});
test('legacy map view settings migrate and malformed session data is sanitized',()=>{
 const core=api();
 const legacy={map:{id:'old',grid:0.3,terrainOn:true,reachOff:true},foes:[
  {id:'e1',map:'old',x:1.4,y:3.5,name:'Specter',hp:-10,max:0,ev:8,ar:-3},
  {id:'bad',x:1,y:2,name:'no map'}],
  tokens:{cabc1234:{x:1.5,y:3.2},missing:{x:'nan',y:3}},
  fog:{old:{rev:1,seen:'0110'},bad:{seen:'hello'}}};
 const result=plain(core.normalizeGame(legacy));
 assert.equal(result.map.id,'old');
 assert.equal(result.view.grid,0.3);
 assert.equal(result.view.terrainOn,true);
 assert.equal(result.view.reachOff,true);
 assert.deepEqual(result.tokens,{cabc1234:{x:2,y:3}});
 assert.deepEqual(result.fog,{old:{rev:1,seen:'0110'}});
 assert.equal(result.foes.length,1);
 assert.equal(result.foes[0].max,1);
 assert.equal(result.foes[0].ar,0);
 assert.deepEqual(plain(core.normalizeGame(null)),{
  map:null,tokens:{},fog:{},foes:[],view:{grid:null,terrainOn:false,reachOff:false}
 });
});
test('app uses game-state module without a second conflicting rules implementation',()=>{
 const app=read('js/app.js'),html=read('index.html');
 assert.match(app,/window\.WBGameState\.blankGame/);
 assert.match(app,/window\.WBGameState\.normalizeGame/);
 assert.doesNotMatch(app,/function normalizeGame\(/);
 assert.ok(html.indexOf('src="js/game-state.js')<html.indexOf('src="js/app.js'));
});
