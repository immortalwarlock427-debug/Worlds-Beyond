const {test,expect}=require('@playwright/test');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
const fs=require('node:fs');
const key='worlds-beyond-sheet-v1';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const hero=()=>({id:'cdiscountshero',fields:{charName:'Discount Hero',level:'1',apMax:'15'},hist:{STR:{1:'20'}},over:{},
 apAvail:6,apGiven:null,abilities:[{id:'abilstrikeone',name:'Strike',apCost:10,favorite:true}],resources:[]});
async function seed(page,state=hero()){
 await page.addInitScript(({key,state})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));},{key,state});
 await page.goto('/index.html');
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const card=page=>page.locator('#abilityList .ability-item[data-ability-id="abilstrikeone"]');
const badge=page=>card(page).locator('.ability-summary-badges');
const favorite=page=>page.locator('[data-favorite-id="abilstrikeone"]');
async function library(page){await page.locator('[data-sheet-tab="abilities"]').click();}
async function overview(page){await page.locator('[data-sheet-tab="overview"]').click();}

test('phone editor, filters, favorite and library spend one price and preserve the option through files',async({page})=>{
 await seed(page);await library(page);
 await card(page).locator('summary').click();
 await expect(card(page).locator('[data-ability-prop="apDiscountStat"]')).toHaveValue('');
 await expect(badge(page)).toContainText('10 AP');
 await card(page).locator('[data-ability-prop="apDiscountStat"]').selectOption('STR');
 await expect(card(page).locator('[data-ability-ap-price]')).toContainText('Current cost: 6 AP');
 await expect(badge(page)).toContainText('6 AP (10 base · STR)');
 await page.locator('#abilityStatusFilter').selectOption('usable');
 await page.locator('#abilityApFilter').selectOption('6-10');
 await expect(card(page)).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await overview(page);await expect(favorite(page)).toContainText('6 AP (10 base · STR)');
 await page.locator('[data-favorite-use="abilstrikeone"]').click();
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(0);
 expect((await saved(page)).abilities[0].apCost).toBe(10);
 await page.locator('#turnReset').click();await library(page);
 await card(page).locator('.ability-quick-use').click();
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(9);
 await page.locator('#abilityClearFilters').click();
 if(!await card(page).locator('details').evaluate(el=>el.open))await card(page).locator('summary').click();
 await card(page).locator('[data-ability-action="duplicate"]').click();
 await expect.poll(async()=>(await saved(page)).abilities.length).toBe(2);
 expect((await saved(page)).abilities.map(a=>[a.apCost,a.apDiscountStat])).toEqual([[10,'STR'],[10,'STR']]);
 await openCharacterMenu(page);const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();
 const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));
 expect(exported.version).toBe(1);expect(exported.state.abilities[0].apDiscountStat).toBe('STR');
 await page.reload();await expect(favorite(page)).toContainText('6 AP (10 base · STR)');
 await openCharacterMenu(page);
 await page.locator('#importFile').setInputFiles({name:'discount-hero.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.locator('#importYes').click();
 if(await page.locator('#characterMenu').evaluate(el=>el.open))await page.locator('#characterMenu > summary').click();
 await library(page);await card(page).locator('summary').click();
 await expect(card(page).locator('[data-ability-prop="apDiscountStat"]')).toHaveValue('STR');
 await expect(card(page).locator('[data-ability-prop="apCost"]')).toHaveValue('10');
 await expect(badge(page)).toContainText('6 AP (10 base · STR)');
});

test('form gear, timed effects and manual modifier changes refresh prices before payment',async({page})=>{
 const s=hero();s.hist.STR[1]='14';s.apAvail=null;s.abilities[0].apDiscountStat='STR';
 s.abilities.push({id:'abilboostone',name:'Boost',type:'active',duration:1,durationLeft:1,
  effects:[{id:'effboostone',target:'stat',stat:'STR',value:2}]});
 s.items=[{id:'basehelm',type:'head',name:'Base helm',bonuses:[{t:'STR',v:2}]},
  {id:'beasthelm',type:'head',name:'Beast helm',bonuses:[{t:'STR',v:4}]}];
 s.equip={head:'basehelm'};s.equipmentProfiles={base:{head:'basehelm'},loadbeastone:{head:'beasthelm'}};
 s.abilityLoadouts=[{id:'loadbeastone',name:'Beast',statBonuses:{STR:2}}];
 await seed(page,s);await expect(favorite(page)).toContainText('7 AP (10 base · STR)');
 await library(page);await page.locator('#abilityLoadoutSelect').selectOption('loadbeastone');
 await expect(badge(page)).toContainText('5 AP (10 base · STR)');
 await overview(page);await expect(favorite(page)).toContainText('5 AP (10 base · STR)');
 await page.locator('#turnReset').click();await expect(favorite(page)).toContainText('6 AP (10 base · STR)');
 await page.locator('[data-favorite-use="abilstrikeone"]').click();
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(9);
 await page.locator('[data-sheet-tab="attributes"]').click();
 await page.locator('#mod-STR').fill('-2');await page.locator('#mod-STR').blur();
 await library(page);await expect(badge(page)).toContainText('12 AP (10 base · STR)');
 await page.locator('#abilityApFilter').selectOption('11+');await expect(card(page)).toHaveCount(1);
 await page.locator('#abilityStatusFilter').selectOption('usable');await expect(card(page)).toHaveCount(0);
 await overview(page);await page.locator('#turnReset').click();
 await page.locator('[data-favorite-use="abilstrikeone"]').click();
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(3);
 expect((await saved(page)).abilities[0].apCost).toBe(10);
});

test('odd base costs stop at half rounded up and blank/zero remain free under a penalty',async({page})=>{
 const s=hero();s.abilities[0].apDiscountStat='STR';s.abilities[0].apCost=11;s.over['mod-STR']='20';
 await seed(page,s);await expect(favorite(page)).toContainText('6 AP (11 base · STR)');
 await page.locator('[data-favorite-use="abilstrikeone"]').click();
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(0);
 await page.locator('[data-sheet-tab="attributes"]').click();
 await page.locator('#mod-STR').fill('-5');await page.locator('#mod-STR').blur();
 await library(page);await card(page).locator('summary').click();
 for(const base of ['0','']){
  await card(page).locator('[data-ability-prop="apCost"]').fill(base);
  await card(page).locator('[data-ability-prop="apCost"]').blur();
  await expect(card(page).locator('[data-ability-ap-price]')).toContainText('Current cost: 0 AP');
  await page.locator('#abilityApFilter').selectOption('free');await page.locator('#abilityStatusFilter').selectOption('usable');
  await expect(card(page)).toHaveCount(1);
  await card(page).locator('.ability-quick-use').click();await expect(page.locator('#abilityFeedback')).toContainText('Used Strike');
 }
 await page.setViewportSize({width:360,height:800});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
});
