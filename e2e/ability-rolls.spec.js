const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
const key='worlds-beyond-sheet-v1';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const hero=()=>({id:'cabilityrolls',fields:{charName:'Roll Hero',level:'1',apMax:'15'},
 hist:{STR:{1:'20'},INT:{1:'16'},DEX:{1:'14'},FTH:{1:'21'}},over:{},apAvail:null,apGiven:{n:3,fresh:true},
 resources:[{id:'resenergyone',name:'Energy',max:10,current:10}],
 abilities:[{id:'abilstarfire',name:'Starfire',favorite:true,apCost:10,apDiscountStat:'STR',attackStat:'INT',
  damageDice:'2d6 + 3',damageStat:'DEX',damageType:'Fire',saveDcStat:'FTH',targetSaveStat:'AGL',
  resourceId:'resenergyone',resourceCost:4,uses:2,usesLeft:2,cooldown:2}]});
async function seed(page,state=hero()){
 await page.addInitScript(({key,state})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));},{key,state});
 await page.goto('/index.html');
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const card=page=>page.locator('#abilityList .ability-item[data-ability-id="abilstarfire"]');
const use=page=>page.locator('[data-favorite-use="abilstarfire"]');
const dice=(page,values)=>page.evaluate(values=>{window.crypto.getRandomValues=array=>{array[0]=values.shift()??0;return array;};},values);
async function flush(page){
 await page.locator('#editCharacterDetails').click();await page.locator('#charName').fill('After rejected roll');
 await page.locator('#charName').blur();await expect.poll(async()=>(await saved(page)).fields.charName).toBe('After rejected roll');
}

test('favorite attack uses advantage and critical damage without charging twice or offering Wonder',async({page})=>{
 await seed(page);await page.locator('#advBar [data-mode="adv"]').click();await dice(page,[19,0,0,1]);
 await use(page).click();
 await expect(page.locator('#toastTitle')).toHaveText('Starfire attack');
 await expect(page.locator('#toastTotal')).toHaveText('22');
 await expect(page.locator('#toastMath')).toContainText('Advantage, d20 (20, 1) + 2');
 await expect(page.locator('#toastNote')).toContainText('AGL save DC 15');
 await expect(page.locator('#toastActions [data-act="wonder"], #toastActions [data-act="defy"], #toastActions [data-act="toreact"]')).toHaveCount(0);
 await expect.poll(async()=>(await saved(page)).resources[0].current).toBe(6);
 const paid=await saved(page);expect(paid.apAvail).toBe(12);expect(paid.apGiven.n).toBe(0);expect(paid.abilities[0].usesLeft).toBe(1);
 await page.locator('#toastActions [data-act="ability-crit"]').click();
 await expect(page.locator('#toastTitle')).toHaveText('Starfire critical damage');
 await expect(page.locator('#toastTotal')).toHaveText('19');
 await expect(page.locator('#toastMath')).toContainText('max 12 + 2d6 (1, 2) + 3 + 1 Fire');
 expect((await saved(page)).apAvail).toBe(12);expect((await saved(page)).resources[0].current).toBe(6);
 await page.locator('#toastClose').click();await use(page).click();
 await expect(page.locator('#favoriteFeedback')).toContainText('cooling down');await expect(page.locator('#toast')).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});

test('library attack uses disadvantage, supports ordinary damage, and has no critical on a natural 1',async({page})=>{
 await seed(page);await page.locator('#advBar [data-mode="dis"]').click();await dice(page,[19,0,0,0]);
 await page.locator('[data-sheet-tab="abilities"]').click();await card(page).locator('.ability-quick-use').click();
 await expect(page.locator('#toastTotal')).toHaveText('3');await expect(page.locator('#toastMath')).toContainText('Disadvantage, d20 (20, 1) + 2');
 await expect(page.locator('#toastActions [data-act="ability-crit"]')).toHaveCount(0);
 await page.locator('#toastActions [data-act="ability-dmg"]').click();await expect(page.locator('#toastTotal')).toHaveText('6');
 await expect(page.locator('#toastNote')).toContainText('AGL save DC 15');
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(12);
 expect((await saved(page)).abilities[0].usesLeft).toBe(1);
});

test('weapon and ability attacks reuse worn gear effects without borrowing another weapon bonuses',async({page})=>{
 const s=hero();s.items=[{id:'sword',name:'Sword',type:'onehand',stat:'STR',dmg:'1d6',effects:[{k:'atk',v:5}]},
  {id:'helm',name:'Helm',type:'head',effects:[{k:'atk',v:2},{k:'flat',v:3},{k:'dmg',dice:'1d4',dt:'Cold'}]}];
 s.equip={main:'sword',head:'helm'};await seed(page,s);
 await page.locator('[data-sheet-tab="equipment"]').click();await dice(page,[19,0,0]);
 await page.locator('#attacks .atk-roll[data-slot="main"]').click();await expect(page.locator('#toastTotal')).toHaveText('31');
 await page.locator('#toastActions [data-act="crit"]').click();await expect(page.locator('#toastTotal')).toHaveText('19');
 await page.locator('#toastClose').click();await page.locator('[data-sheet-tab="overview"]').click();await dice(page,[19,0,0,0]);
 await use(page).click();await expect(page.locator('#toastTotal')).toHaveText('24');
 await page.locator('#toastActions [data-act="ability-crit"]').click();await expect(page.locator('#toastTotal')).toHaveText('26');
 await expect(page.locator('#toastMath')).toContainText('Cold');
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(6);
});

test('phone roll fields survive editing, duplicate, export, reload and import independently',async({page})=>{
 const s=hero();for(const prop of ['attackStat','damageDice','damageStat','damageType','saveDcStat','targetSaveStat'])delete s.abilities[0][prop];
 await seed(page,s);await page.locator('[data-sheet-tab="abilities"]').click();await card(page).locator('.ability-summary').click();
 await card(page).locator('.ability-roll-config > summary').click();
 for(const [prop,value] of [['attackStat','INT'],['damageStat','DEX'],['saveDcStat','FTH'],['targetSaveStat','AGL']])
  await card(page).locator('[data-ability-prop="'+prop+'"]').selectOption(value);
 for(const [prop,value] of [['damageDice','2d6 + 3'],['damageType','Fire']]){
  await card(page).locator('[data-ability-prop="'+prop+'"]').fill(value);await card(page).locator('[data-ability-prop="'+prop+'"]').blur();
 }
 await expect(card(page).locator('.ability-summary-badges')).toContainText('INT attack +2');
 await expect(card(page).locator('.ability-summary-badges')).toContainText('AGL save · DC 15');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await card(page).locator('[data-ability-action="duplicate"]').click();await expect.poll(async()=>(await saved(page)).abilities.length).toBe(2);
 const definitions=(await saved(page)).abilities;for(const a of definitions){
  expect(a.attackStat).toBe('INT');expect(a.damageStat).toBe('DEX');expect(a.apDiscountStat).toBe('STR');
  expect(a.saveDcStat).toBe('FTH');expect(a.targetSaveStat).toBe('AGL');expect(a.damageDice).toBe('2d6 + 3');
 }
 await openCharacterMenu(page);const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();
 const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));expect(exported.version).toBe(1);
 await page.reload();await expect(page.locator('[data-favorite-id="abilstarfire"]')).toContainText('AGL save · DC 15');
 await openCharacterMenu(page);await page.locator('#importFile').setInputFiles({name:'roll-hero.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.locator('#importYes').click();await page.locator('#characterMenu > summary').click();
 await page.locator('[data-sheet-tab="abilities"]').click();await card(page).locator('.ability-summary').click();
 await expect(card(page).locator('[data-ability-prop="damageDice"]')).toHaveValue('2d6 + 3');
 await expect(card(page).locator('[data-ability-prop="saveDcStat"]')).toHaveValue('FTH');
 await page.setViewportSize({width:360,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
});

for(const mode of ['damage','save','attack','legacy'])test(mode+'-only configuration keeps its own roll flow',async({page})=>{
 const s=hero(),a=s.abilities[0];
 for(const prop of ['attackStat','damageDice','damageStat','saveDcStat','targetSaveStat'])a[prop]='';
 if(mode==='damage')a.damageDice='1d6 − 2';
 if(mode==='save'){a.saveDcStat='INT';a.targetSaveStat='VIT';}
 if(mode==='attack')a.attackStat='DEX';
 await seed(page,s);await dice(page,[4]);await use(page).click();
 await expect.poll(async()=>(await saved(page)).resources[0].current).toBe(6);
 if(mode==='legacy')await expect(page.locator('#toast')).toBeHidden();
 else {
  await expect(page.locator('#toast')).toBeVisible();
  if(mode==='damage'){await expect(page.locator('#toastTotal')).toHaveText('3');await expect(page.locator('#toastMath')).toContainText('− 2');}
  if(mode==='save'){await expect(page.locator('#toastMath')).toContainText('VIT save DC 14');await expect(page.locator('#toastTotal')).toBeHidden();}
  if(mode==='attack')await expect(page.locator('#toastTotal')).toHaveText('6');
  await expect(page.locator('#toastActions [data-act="wonder"], #toastActions [data-act="defy"], #toastActions [data-act="ability-dmg"]')).toHaveCount(0);
 }
});

for(const reason of ['dice','resource'])test('invalid '+reason+' prevents a popup and preserves all activation costs',async({page})=>{
 const s=hero();if(reason==='dice')s.abilities[0].damageDice='2d6 + typo';else s.resources[0].current=3;
 await seed(page,s);await use(page).click();
 await expect(page.locator('#favoriteFeedback')).toContainText(reason==='dice'?'Check the damage dice':'Not enough Energy');
 await expect(page.locator('#toast')).toBeHidden();await flush(page);
 const after=await saved(page);expect(after.apAvail).toBeNull();expect(after.apGiven.n).toBe(3);
 expect(after.resources[0].current).toBe(s.resources[0].current);expect(after.abilities[0].usesLeft).toBe(2);expect(after.abilities[0].cooldownLeft).toBe(0);
});
