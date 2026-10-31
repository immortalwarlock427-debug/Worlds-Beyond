const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
const key='worlds-beyond-sheet-v1';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const hero=()=>({id:'cweaponhero',fields:{charName:'Weapon Hero',level:'1',apMax:'15',mpCur:'3'},
 hist:{STR:{1:'22'},DEX:{1:'28'},AGL:{1:'21'},INT:{1:'16'},VIT:{1:'16'},FTH:{1:'21'}},over:{},
 apAvail:null,apGiven:{n:3,fresh:true},reactAvail:null,inCombat:true,abilities:[],resources:[],
 items:[{id:'sword',name:'Sword',type:'onehand',properties:['Balanced','Light'],stat:'STR',dmg:'1d6'},
  {id:'dagger',name:'Dagger',type:'onehand',properties:['Balanced','Light'],stat:'DEX',dmg:'1d4'}],equip:{main:'sword',off:'dagger'}});
async function seed(page,state=hero()){
 await page.addInitScript(({key,state})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));},{key,state});
 await page.goto('/index.html');await equipment(page);
}
async function equipment(page){await page.locator('[data-sheet-tab="equipment"]').click();}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const select=(page,slot)=>page.locator('[data-singularity-slot="'+slot+'"]');
const attack=(page,slot)=>page.locator('#attacks .atk-roll[data-slot="'+slot+'"]');
const damage=(page,slot)=>page.locator('#attacks .atk-dmg[data-slot="'+slot+'"]');
const dice=(page,values)=>page.evaluate(values=>{window.diceDraws=0;crypto.getRandomValues=a=>{window.diceDraws++;a[0]=values.shift()??0;return a;};},values);
async function close(page){await page.locator('#toastClose').click();}

test('single-hand Singularity is declared before rolling, forces critical damage without changing the natural die',async({page})=>{
 await seed(page);await select(page,'main').selectOption('main');await dice(page,[9,0]);await attack(page,'main').click();
 await expect(page.locator('#toastTotal')).toHaveText('15');await expect(page.locator('#toastTotal')).not.toHaveClass(/nat20/);
 await expect(page.locator('#toastNote')).toContainText('Singularity');
 await expect(page.locator('#toastActions [data-act="dmg"]')).toHaveCount(0);
 await expect(page.locator('#toastActions [data-act="wonder"], #toastActions [data-act="defy"]')).toHaveCount(0);
 await expect.poll(async()=>(await saved(page)).milestoneUses?.singularity?.usesLeft).toBe(0);
 await page.locator('#toastActions [data-act="crit"]').click();await expect(page.locator('#toastTotal')).toHaveText('12');
 await expect(page.locator('#toastActions [data-act^="devastate"]')).toHaveCount(0);
 const after=await saved(page);expect(after.apAvail).toBe(13);expect(after.apGiven.n).toBe(0);expect(await page.evaluate(()=>window.diceDraws)).toBe(2);
});

test('dual Singularity affects only the chosen off hand and the off-hand adds no modifier',async({page})=>{
 await seed(page);await select(page,'dual').selectOption('off');await dice(page,[0,0,0,0]);await attack(page,'dual').click();
 await expect(page.locator('#toastMath')).toContainText('Main hand 6');await expect(page.locator('#toastMath')).toContainText('Off-hand 9');
 await page.locator('#toastActions [data-act="dualboth"]').click();await expect(page.locator('#toastTotal')).toHaveText('8');
 await expect(page.locator('#toastMath')).toContainText('Off-hand crit');await expect(page.locator('#toastMath')).not.toContainText('Main hand crit');
 await expect(page.locator('#toastActions [data-act="devastate-off"]')).toHaveCount(0);
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(13);
});

test('a miss by the chosen dual hand still spends Singularity without making the other hand critical',async({page})=>{
 await seed(page);await select(page,'dual').selectOption('main');await dice(page,[0,0,0]);await attack(page,'dual').click();
 // With no map target, selecting off-hand-only damage declares that the chosen main hand missed.
 await page.locator('#toastActions [data-act="dualoff"]').click();await expect(page.locator('#toastTotal')).toHaveText('0');
 await expect(page.locator('#toastMath')).not.toContainText('crit');await expect(page.locator('#toastActions [data-act^="devastate"]')).toHaveCount(0);
 await expect.poll(async()=>(await saved(page)).milestoneUses?.singularity?.usesLeft).toBe(0);
 expect((await saved(page)).milestoneUses.devastate).toBeUndefined();
});

test('weapon damage retain the original stat snapshot after later stat edits',async({page})=>{
 await seed(page);await dice(page,[9,0]);await attack(page,'main').click();await page.locator('[data-sheet-tab="attributes"]').click();
 await page.locator('#score-STR').fill('26');await page.locator('#score-STR').blur();await expect(page.locator('#mod-STR')).toHaveValue('+7');
 await page.locator('#toastActions [data-act="dmg"]').click();await expect(page.locator('#toastTotal')).toHaveText('6');
 await expect(page.locator('#toastActions [data-act^="devastate"]')).toHaveCount(0);
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(13);
});

test('failed AP/reaction payments retain Singularity and allow retry without a partial charge',async({page})=>{
 const s=hero();s.apAvail=0;s.apGiven=null;s.reactAvail=0;await seed(page,s);await select(page,'main').selectOption('main');await dice(page,[]);
 await attack(page,'main').click();await expect(page.locator('#toastMath')).toContainText('you have 0 left');await close(page);
 await page.locator('#attacks .atk-opp[data-slot="main"]').click();await expect(page.locator('#toastMath')).toContainText('No reactions left');await close(page);
 expect((await saved(page)).milestoneUses||{}).toEqual({});expect(await page.evaluate(()=>window.diceDraws)).toBe(0);
 await page.locator('[data-sheet-tab="overview"]').click();await page.locator('#turnReset').click();await equipment(page);
 await page.locator('#attacks .atk-opp[data-slot="main"]').click();await expect(page.locator('#toastNote')).toContainText('Singularity');
 await expect.poll(async()=>(await saved(page)).milestoneUses?.singularity?.usesLeft).toBe(0);
 const after=await saved(page);expect(after.apAvail).toBeNull();expect(after.reactAvail).toBe(1);
});

test('converting an attack to opportunity refunds AP once while keeping its Singularity use',async({page})=>{
 await seed(page);await select(page,'main').selectOption('main');await dice(page,[4,0]);await attack(page,'main').click();
 await page.locator('#toastActions [data-act="toreact"]').click();await expect(page.locator('#toastActions [data-act="toreact"]')).toHaveCount(0);
 await page.locator('#toastActions [data-act="crit"]').click();await expect(page.locator('#toastTotal')).toHaveText('12');
 await expect.poll(async()=>(await saved(page)).reactAvail).toBe(1);const after=await saved(page);
 expect(after.apAvail).toBe(15);expect(after.apGiven.n).toBe(3);expect(after.milestoneUses.singularity.usesLeft).toBe(0);
});

test('outside milestone counts survive reload/files while Singularity selection itself never arms on reload',async({page})=>{
 const s=hero();s.inCombat=false;await seed(page,s);await select(page,'main').selectOption('main');await dice(page,[0,0]);await attack(page,'main').click();
 await page.locator('#toastActions [data-act="crit"]').click();await close(page);await page.locator('[data-sheet-tab="abilities"]').click();if(!await page.locator('#milestonePanel').evaluate(el=>el.open))await page.locator('#milestonePanel > summary').click();await page.locator('[data-milestone-use="titans-might"]').click();await close(page);await equipment(page);
 await expect.poll(async()=>(await saved(page)).milestoneUses['titans-might'].outsideUsesSpent).toBe(1);
 await select(page,'main').selectOption('main');await page.reload();await equipment(page);await expect(select(page,'main')).toHaveValue('');
 expect((await saved(page)).milestoneUses.singularity.outsideUsesSpent).toBe(1);
 await openCharacterMenu(page);const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();
 const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));expect(exported.version).toBe(1);expect(exported.state.milestoneUses['titans-might'].outsideUsesSpent).toBe(1);
 await page.locator('#importFile').setInputFiles({name:'weapon.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.locator('#importYes').click();await page.locator('#characterMenu > summary').click();await equipment(page);
 await expect(select(page,'main')).toHaveValue('');expect((await saved(page)).milestoneUses.singularity.outsideUsesSpent).toBe(1);
 await page.setViewportSize({width:360,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
});

test('Titan’s Might is a free narrative melee action with separate combat and outside allowances',async({page})=>{
 await seed(page);await page.locator('[data-sheet-tab="abilities"]').click();if(!await page.locator('#milestonePanel').evaluate(el=>el.open))await page.locator('#milestonePanel > summary').click();const use=page.locator('[data-milestone-use="titans-might"]');await use.click();
 await expect(page.locator('#toastMath')).toContainText('push the target 5ft');await expect.poll(async()=>(await saved(page)).milestoneUses?.['titans-might']?.usesLeft).toBe(0);expect((await saved(page)).apAvail).toBeNull();await close(page);
 await page.locator('[data-sheet-tab="overview"]').click();await page.locator('#combatToggle').click();await page.locator('[data-sheet-tab="abilities"]').click();if(!await page.locator('#milestonePanel').evaluate(el=>el.open))await page.locator('#milestonePanel > summary').click();await use.click();
 await expect.poll(async()=>(await saved(page)).milestoneUses?.['titans-might']?.outsideUsesSpent).toBe(1);expect((await saved(page)).milestoneUses['titans-might'].usesLeft).toBe(0);
});
