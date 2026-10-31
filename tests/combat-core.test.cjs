/* Shared combat core: independent of DOM/browser storage. */
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function harness() {
  const ctx={window:{},Date,Math,Number,Set,Map};
  vm.runInNewContext(read('js/combat-core.js'),ctx);
  vm.runInNewContext(read('js/abilities.js'),ctx);
  return {rules:ctx.window.WBCombat,abilities:ctx.window.WBAbilities};
}
function state() {
  return {
    fields:{level:'12'},hist:{STR:{1:'12',5:'16',15:'22'},DEX:{1:'11'},VIT:{1:'25'},INT:{10:'18'}},
    asi:{4:{STR:1},8:{STR:2},12:{STR:1}},over:{},items:[
      {id:'helm1',type:'head',name:'Helm',ar:3,bonuses:[{t:'STR',v:2},{t:'armor',v:1}]},
      {id:'sword1',type:'onehand',name:'Sword',ar:0,bonuses:[{t:'STR',v:1}]},
      {id:'boots1',type:'legs',name:'Boots',ar:2,bonuses:[{t:'AGL',v:3}]}
    ],equip:{head:'helm1',main:'sword1',rleg:'boots1'},settled:{helm1:true},
    apAvail:3,apGiven:{n:2,fresh:true},abilities:[],abilityLoadouts:[],activeAbilityLoadoutId:''
  };
}
test('homebrew level history uses most recent stat entry and earliest fallback',()=>{
  const {rules}=harness(),s=state();
  assert.equal(rules.level(s),12);
  assert.equal(rules.rawAt(s,'STR',1),'12');
  assert.equal(rules.rawAt(s,'STR',12),'16');
  assert.equal(rules.rawAt(s,'STR',28),'22');
  assert.equal(rules.rawAt(s,'INT',1),'18','First-ever entry applies before first level entry');
  assert.equal(rules.rawAt(s,'WIS',12),null);
  assert.equal(rules.asiSum(s,'STR',12),4);
  assert.equal(rules.scoreAt(s,'STR',12),20,'16 base + 4 advancement');
  assert.equal(rules.scoreAt(s,'STR',5),17,'16 base + 1 advancement');
  assert.equal(rules.scoreAt(s,'STR',16),26,'22 base + 4 advancement');
  s.fields.level='250';assert.equal(rules.level(s),100);
  s.fields.level='';assert.equal(rules.level(s),1);
});
test('STR/DEX use their own modifier formula; other stats use the general one',()=>{
  const {rules}=harness();
  for (const [stat,score,expected] of [
    ['STR',8,-2],['STR',11,-1],['STR',12,0],['STR',13,0],['STR',14,1],
    ['DEX',17,2],['VIT',8,-2],['VIT',11,-1],['VIT',12,0],['VIT',13,1],
    ['VIT',15,1],['WIS',16,2],['CHA',28,6],['FTH',25,5]
  ]) assert.equal(rules.autoMod(stat,score),expected,stat+' at '+score);
});
test('worn gear, active ability and form bonuses are separately composed',()=>{
  const {rules,abilities}=harness(),s=state();
  assert.equal(rules.gearArmor(s),3);
  assert.equal(rules.gearBonus(s,'STR'),3);
  assert.equal(rules.gearBonus(s,'AGL'),3);
  assert.equal(rules.gearBonus(s,'STR',true),3,'Legacy settlement no longer limits current gear');
  assert.equal(rules.effectiveScore(s,'STR',12),23);
  assert.equal(rules.effectiveScore(s,'STR',12,3,4),30);
  assert.equal(rules.modifier(s,'STR',12,3,4),9);
  assert.equal(rules.modifier(s,'DEX',12),-1);
  assert.equal(rules.modifier(s,'WIS',12),0);
  s.over['mod-STR']='-3';
  assert.equal(rules.modifier(s,'STR',12,3,4),-3,'Manual modifier overrides auto derived');
  s.over['mod-STR']='';
  assert.equal(rules.modifier(s,'STR',12,3,4),9);
  s.abilities=[{id:'abilabcdefg',name:'Strengthen',type:'active',
    duration:3,durationLeft:2,effects:[{target:'stat',stat:'STR',value:3}]}];
  const form=abilities.createLoadout(s,'Monster');
  abilities.configureLoadout(s,form.id,'STR',4);
  const effect=abilities.effectBonus(s,'stat','STR'),formBonus=abilities.formStatBonus(s,'STR');
  assert.equal(effect,3);
  assert.equal(formBonus,4);
  assert.equal(rules.effectiveScore(s,'STR',12,effect,formBonus),30);
  abilities.selectLoadout(s,'');
  assert.equal(abilities.formStatBonus(s,'STR'),0);
  assert.equal(rules.effectiveScore(s,'STR',12,effect,0),26);
  assert.equal(s.hist.STR[5],'16','Stat calculations do not rewrite permanent progress');
});
test('tracker maxima and available AP preserve legacy bounds',()=>{
 const {rules}=harness();
 assert.equal(rules.trackerMax('4','8'),4);
 assert.equal(rules.trackerMax('','8'),8);
 assert.equal(rules.trackerMax('200','8'),40);
 assert.equal(rules.trackerMax('-1','8'),0);
 assert.equal(rules.trackerAvailable(null,8),8);
 assert.equal(rules.trackerAvailable(-6,8),0);
 assert.equal(rules.trackerAvailable(14,8),8);
 assert.equal(rules.attackApCost(3),7);
 assert.equal(rules.attackApCost(7),5);
 assert.equal(rules.attackApCost(-2),12);
});
test('spending AP prioritizes Command AP and returns immutable state patch',()=>{
 const {rules}=harness(),s=state(),before=plain(s);
 assert.equal(rules.givenAp(s),2);
 assert.equal(rules.apAvailable(s,3),5);
 const patch=plain(rules.spendAp(s,3,4));
 assert.deepEqual(patch,{apAvail:1,apGiven:{n:0,fresh:true}});
 assert.deepEqual(s,before,'Combat core must not mutate character');
 Object.assign(s,patch);
 assert.equal(rules.givenAp(s),0);
 assert.equal(rules.apAvailable(s,1),1);
 const ownOnly=plain(rules.spendAp(s,1,1));
 assert.deepEqual(ownOnly,{apAvail:0},'No Command record change when none was spent');
});
test('AP refund fills normal pool first, then Command pool, with freshness preserved',()=>{
 const {rules}=harness(),s=state();
 s.apAvail=1;s.apGiven={n:2,fresh:false};
 const patch=plain(rules.refundAp(s,1,4,5));
 assert.deepEqual(patch,{apAvail:4,apGiven:{n:4,fresh:false}});
 assert.deepEqual(s.apGiven,{n:2,fresh:false},'Refund is pure');
 assert.deepEqual(plain(rules.refundAp(s,1,4,2)),{apAvail:3});
 const empty={apGiven:null};
 assert.deepEqual(plain(rules.refundAp(empty,0,4,5)),{apAvail:4,apGiven:{n:1,fresh:true}});
});
test('movement planner reuses leftover feet and free Surge AP before paid AP',()=>{
 const {rules}=harness();
 const m={ft:15,left:5,surge:0};
 const p=plain(rules.movePlan(25,10,m,2));
 assert.deepEqual(p,{ft:25,sp:10,fromLeft:5,ap:2,free:2,paid:0,leftAfter:0});
 assert.deepEqual(plain(rules.movementAfter(m,25,p)),{ft:40,left:0,surge:2});
 assert.deepEqual(m,{ft:15,left:5,surge:0},'Movement preview must not spend or mutate');
 const slower=plain(rules.movePlan(15,10,{ft:0,left:0,surge:2},0));
 assert.deepEqual(slower,{ft:15,sp:10,fromLeft:0,ap:2,free:0,paid:2,leftAfter:5});
 const zero=plain(rules.movePlan(10,0,{ft:0,left:3,surge:0},0));
 assert.equal(zero.sp,0);
 assert.equal(zero.fromLeft,3);
 assert.equal(zero.paid,0);
 assert.equal(zero.leftAfter,-7,'Existing app explicitly blocks zero-speed moves');
});
test('new shared math module loads before app, and app calls extracted functions',()=>{
 const app=read('js/app.js'),html=read('index.html'),core=read('js/combat-core.js');
 assert.ok(html.indexOf('src="js/combat-core.js')<html.indexOf('src="js/app.js'));
 for(const snippet of [
 'window.WBCombat.level(state)','window.WBCombat.scoreAt(state, k, n)',
 'window.WBCombat.effectiveScore(state, k, level()',
 'window.WBCombat.modifier(state, k, level()',
 'window.WBCombat.gearBonus(state, k, true)',
 'window.WBCombat.attackApCost',
 'window.WBCombat.movePlan(ft, speedNow(), moveNow(), surgeLeft())'
 ]) assert.ok(app.includes(snippet),snippet);
 assert.doesNotMatch(core.replace(/\/\*[\s\S]*?\*\//g,''),/document\.|localStorage|fetch\(/);
});
