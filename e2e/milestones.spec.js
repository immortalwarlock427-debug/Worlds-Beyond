const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
const key='worlds-beyond-sheet-v1';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const hero=()=>({id:'cmilestonehero',fields:{charName:'Milestone Hero',level:'1',apMax:'15'},
 hist:Object.fromEntries(['STR','VIT','DEX','AGL','INT','WIS','CHA','FTH'].map(s=>[s,{1:'28'}])),over:{},
 apAvail:null,apGiven:{n:3,fresh:true},inCombat:true,resources:[],
 abilities:[{id:'abilcustomone',name:'Custom',uses:2,usesLeft:1}],statuses:[{id:'keep',name:'Stunned',type:'condition'}]});
async function seed(page,state=hero()){
 await page.addInitScript(({key,state})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));},{key,state});
 await page.goto('/index.html');
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const card=(page,id)=>page.locator('#milestoneList [data-milestone-id="'+id+'"]');
const use=(page,id)=>page.locator('[data-milestone-use="'+id+'"]');
async function panel(page){
 await page.locator('[data-sheet-tab="abilities"]').click();
 if(!await page.locator('#milestonePanel').evaluate(el=>el.open))await page.locator('#milestonePanel > summary').click();
}
async function overview(page){await page.locator('[data-sheet-tab="overview"]').click();}
async function close(page){await page.locator('#toastClose').click();}

test('Stratagem pays fixed AP with Command first and keeps separate round/outside allowances',async({page})=>{
 await seed(page);await panel(page);await expect(page.locator('#milestoneCount')).toHaveText('9 unlocked');
 await use(page,'stratagem').click();await expect(page.locator('#toastTitle')).toHaveText('Stratagem');
 await expect(page.locator('#toastTotal')).toHaveText('6');await expect(page.locator('#toastMath')).toContainText('next attack roll or ability check');
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(13);let s=await saved(page);
 expect(s.apGiven.n).toBe(0);expect(s.abilities).toHaveLength(1);expect(s.abilities[0].usesLeft).toBe(1);
 await close(page);await use(page,'stratagem').click();await expect(page.locator('#milestoneFeedback')).toContainText('no uses left');
 await expect(page.locator('#toast')).toBeHidden();
 await overview(page);await page.locator('#turnReset').click();await panel(page);await expect(card(page,'stratagem')).toContainText('1/1 uses / round');
 await use(page,'stratagem').click();await close(page);await overview(page);await page.locator('#combatToggle').click();await panel(page);
 await expect(card(page,'stratagem')).toContainText('6/6 uses / long rest');await use(page,'stratagem').click();await close(page);
 await expect.poll(async()=>(await saved(page)).milestoneUses.stratagem.outsideUsesSpent).toBe(1);
 await overview(page);await page.locator('#turnReset').click();await panel(page);await expect(card(page,'stratagem')).toContainText('5/6 uses / long rest');
});

test('failed AP payment leaves milestone counts, custom abilities and pools untouched',async({page})=>{
 const s=hero();s.apAvail=1;s.apGiven=null;await seed(page,s);await panel(page);await use(page,'absolute-comprehension').click();
 await expect(page.locator('#milestoneFeedback')).toContainText('Not enough AP');await expect(page.locator('#toast')).toBeHidden();
 await overview(page);await page.locator('#editCharacterDetails').click();await page.locator('#charName').fill('After failed milestone');await page.locator('#charName').blur();
 await expect.poll(async()=>(await saved(page)).fields.charName).toBe('After failed milestone');
 const after=await saved(page);expect(after.apAvail).toBe(1);expect(after.milestoneUses).toEqual({});expect(after.abilities[0].usesLeft).toBe(1);
});

test('Eyes of Truth rolls a WIS check with Defy Fate without paying the milestone twice',async({page})=>{
 await seed(page);await panel(page);await page.evaluate(()=>{crypto.getRandomValues=a=>{a[0]=0;return a;};});
 await use(page,'eyes-of-truth').click();await expect(page.locator('#toastTitle')).toHaveText('Eyes of Truth');
 await expect(page.locator('#toastTotal')).toHaveText('7');await expect(page.locator('#toastNote')).toContainText('contested');
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(13);
 await page.locator('#toastActions [data-act="defy"]').click();await expect(page.locator('#toastNote')).toContainText('Defy Fate');
 await expect.poll(async()=>(await saved(page)).wonderAvail).toBe(5);
 const after=await saved(page);expect(after.apAvail).toBe(13);expect(after.milestoneUses['eyes-of-truth'].usesLeft).toBe(0);
});

test('Commanding Presence shows its special CHA save DC and leaves target outcomes at the table',async({page})=>{
 await seed(page);await panel(page);await use(page,'commanding-presence').click();
 await expect(page.locator('#toastTotal')).toHaveText('22');await expect(page.locator('#toastMath')).toContainText('CHA save, DC 22');
 await expect(page.locator('#toastActions button')).toHaveCount(0);await close(page);
 await overview(page);await page.locator('#turnReset').click();await page.locator('[data-sheet-tab="attributes"]').click();
 await page.locator('#mod-CHA').fill('-2');await page.locator('#mod-CHA').blur();await panel(page);
 await use(page,'commanding-presence').click();await expect(page.locator('#toastTotal')).toHaveText('6');
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(10);
 expect((await saved(page)).statuses[0].name).toBe('Stunned');
});

test('free Indomitable/Miracle uses follow combat versus long-rest resets, and long-rest Undo restores them',async({page})=>{
 const s=hero();s.apAvail=0;s.apGiven=null;await seed(page,s);await panel(page);
 await use(page,'indomitable-status').click();await close(page);await use(page,'miracle').click();
 await expect(page.locator('#toastMath')).toContainText('own limit');await close(page);
 await expect.poll(async()=>(await saved(page)).milestoneUses.miracle.usesLeft).toBe(0);expect((await saved(page)).apAvail).toBe(0);
 await overview(page);await page.locator('#turnReset').click();await panel(page);
 await expect(card(page,'indomitable-status')).toContainText('0/1 uses / combat');await expect(card(page,'miracle')).toContainText('0/1 uses / long rest');
 await overview(page);await page.locator('#combatToggle').click();await panel(page);await use(page,'indomitable-status').click();await close(page);
 await expect(card(page,'indomitable-status')).toContainText('0/1 uses / long rest');
 await overview(page);await page.locator('#combatToggle').click();await panel(page);
 await expect(card(page,'indomitable-status')).toContainText('1/1 uses / combat');await expect(card(page,'miracle')).toContainText('0/1 uses / long rest');
 await overview(page);await page.locator('#longRest').click();await page.locator('#toastActions [data-act="undo"]').click();await expect(page.locator('#toast')).toBeHidden();await panel(page);
 await expect(card(page,'miracle')).toContainText('0/1 uses / long rest');
 expect((await saved(page)).statuses[0].name).toBe('Stunned');
});

test('form unlocks update live and losing/regaining a milestone never refills spent uses',async({page})=>{
 const s=hero();s.hist.INT[1]='20';s.abilityLoadouts=[{id:'loadmageone',name:'Mage',statBonuses:{INT:8}}];
 await seed(page,s);await panel(page);await expect(card(page,'stratagem')).toHaveCount(0);
 await page.locator('#abilityLoadoutSelect').selectOption('loadmageone');await expect(card(page,'stratagem')).toHaveCount(1);
 await expect(card(page,'absolute-comprehension')).toHaveCount(1);await use(page,'stratagem').click();await close(page);
 await page.locator('#abilityLoadoutSelect').selectOption('');await expect(card(page,'stratagem')).toHaveCount(0);
 await page.locator('#abilityLoadoutSelect').selectOption('loadmageone');await expect(card(page,'stratagem')).toContainText('0/1 uses / round');
});

test('milestone counts survive correction, reload and v1 files without changing custom abilities',async({page})=>{
 const s=hero();s.inCombat=false;s.milestoneUses={stratagem:{usesLeft:0,outsideUsesSpent:2},miracle:{usesLeft:0,outsideUsesSpent:0},futureMilestone:{kept:true}};
 await seed(page,s);await panel(page);await expect(card(page,'stratagem')).toContainText('4/6 uses / long rest');
 await page.reload();await panel(page);await expect(card(page,'stratagem')).toContainText('4/6 uses / long rest');
 await openCharacterMenu(page);const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();
 const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));expect(exported.version).toBe(1);expect(exported.state.milestoneUses.stratagem.outsideUsesSpent).toBe(2);
 await page.locator('#characterMenu > summary').click();
 await card(page,'stratagem').locator('[data-milestone-remaining]').fill('5');await card(page,'stratagem').locator('[data-milestone-remaining]').blur();
 await expect.poll(async()=>(await saved(page)).milestoneUses.stratagem.outsideUsesSpent).toBe(1);
 await openCharacterMenu(page);await page.locator('#importFile').setInputFiles({name:'milestones.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.locator('#importYes').click();await page.locator('#characterMenu > summary').click();await panel(page);
 await expect(card(page,'stratagem')).toContainText('4/6 uses / long rest');
 await expect.poll(async()=>(await saved(page)).milestoneUses.stratagem.outsideUsesSpent).toBe(2);
 const after=await saved(page);expect(after.abilities).toHaveLength(1);expect(after.abilities[0].usesLeft).toBe(1);expect(after.milestoneUses.futureMilestone).toEqual({kept:true});
 await page.setViewportSize({width:360,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
});

test('Sixth Sense spends its free outside allowance without rolling the GM secret check',async({page})=>{
 const s=hero();s.inCombat=false;s.apAvail=0;s.apGiven=null;s.hist.WIS[1]='21';await seed(page,s);await panel(page);
 await page.evaluate(()=>{window.diceDraws=0;crypto.getRandomValues=a=>{window.diceDraws++;a[0]=0;return a;};});
 for(let i=0;i<3;i++){await use(page,'sixth-sense').click();await expect(page.locator('#toastMath')).toContainText('good, bad or unsure');await close(page);}
 await expect(card(page,'sixth-sense')).toContainText('0/3 uses / long rest');await use(page,'sixth-sense').click();
 await expect(page.locator('#milestoneFeedback')).toContainText('no uses left');await expect(page.locator('#toast')).toBeHidden();
 await expect.poll(async()=>(await saved(page)).milestoneUses['sixth-sense'].outsideUsesSpent).toBe(3);expect((await saved(page)).apAvail).toBe(0);
 expect(await page.evaluate(()=>window.diceDraws)).toBe(0);
});
