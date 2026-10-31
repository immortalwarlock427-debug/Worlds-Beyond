const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
const key='worlds-beyond-sheet-v1';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const hero=()=>({id:'ccombathero',fields:{charName:'Combat Hero',level:'1',apMax:'15',hpCur:'8',mpCur:'3'},
 hist:{DEX:{1:'16'},INT:{1:'16'},VIT:{1:'16'}},over:{},apAvail:5,reactAvail:0,apGiven:null,
 resources:[{id:'resenergyone',name:'Energy',max:20,current:7}],
 abilities:[{id:'abilcombatone',name:'Combat move',favorite:true,uses:1,usesLeft:0,usesPer:'combat',outsideUsesSpent:0,apCost:2},
  {id:'abilroundone',name:'Round move',favorite:true,uses:1,usesLeft:0,usesPer:'round',outsideUsesStat:'DEX',outsideUsesSpent:1},
  {id:'abillegacyone',name:'Legacy',uses:2,usesLeft:1}]});
async function seed(page,state=hero()){
 await page.addInitScript(({key,state})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));},{key,state});
 await page.goto('/index.html');
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const ability=(s,id='abilcombatone')=>s.abilities.find(a=>a.id===id);
const favorite=(page,id='abilcombatone')=>page.locator('[data-favorite-id="'+id+'"]');
const use=(page,id='abilcombatone')=>page.locator('[data-favorite-use="'+id+'"]');
const card=(page,id='abilcombatone')=>page.locator('#abilityList .ability-item[data-ability-id="'+id+'"]');
async function toggle(page){await page.locator('#combatToggle').click();}

test('combat and outside uses stay separate; phase changes preserve pools and starting a turn outside cannot refill uses',async({page})=>{
 await seed(page);await expect(page.locator('#combatState')).toHaveText('Out of combat');
 await expect(favorite(page)).toContainText('1/1 uses / long rest');await use(page).click();
 await expect.poll(async()=>ability(await saved(page)).outsideUsesSpent).toBe(1);
 await toggle(page);await expect(page.locator('#combatState')).toHaveText('In combat');
 await expect(favorite(page)).toContainText('1/1 uses / combat');
 await expect.poll(async()=>(await saved(page)).inCombat).toBe(true);
 let s=await saved(page);expect(s.apAvail).toBe(3);expect(s.reactAvail).toBe(0);expect(s.fields.hpCur).toBe('8');expect(s.resources[0].current).toBe(7);
 await use(page).click();await expect.poll(async()=>ability(await saved(page)).usesLeft).toBe(0);
 await toggle(page);await expect(favorite(page)).toContainText('0/1 uses / long rest');
 await page.locator('#turnReset').click();await use(page).click();await expect(page.locator('#favoriteFeedback')).toContainText('no uses left');
 await page.locator('[data-sheet-tab="abilities"]').click();await page.locator('#abilityStatusFilter').selectOption('exhausted');
 await expect(card(page)).toHaveCount(1);await page.locator('#abilityStatusFilter').selectOption('usable');await expect(card(page)).toHaveCount(0);
 await page.locator('[data-sheet-tab="overview"]').click();await toggle(page);await expect(favorite(page)).toContainText('1/1 uses / combat');
 await expect.poll(async()=>(await saved(page)).inCombat).toBe(true);s=await saved(page);expect(s.apAvail).toBeNull();expect(ability(s).outsideUsesSpent).toBe(1);
});

test('round uses refill on turns only in combat; long rest restores both and Undo restores both spent counters',async({page})=>{
 const s=hero();s.abilities[0].outsideUsesSpent=1;await seed(page,s);
 await expect(favorite(page,'abilroundone')).toContainText('1/2 uses / long rest');await use(page,'abilroundone').click();
 await expect.poll(async()=>ability(await saved(page),'abilroundone').outsideUsesSpent).toBe(2);
 await page.locator('#turnReset').click();await expect(favorite(page,'abilroundone')).toContainText('0/2 uses / long rest');
 await toggle(page);await use(page,'abilroundone').click();await expect(favorite(page,'abilroundone')).toContainText('0/1 uses / round');
 await page.locator('#turnReset').click();await expect(favorite(page,'abilroundone')).toContainText('1/1 uses / round');
 await toggle(page);await expect(favorite(page,'abilroundone')).toContainText('0/2 uses / long rest');
 await page.locator('#longRest').click();await expect(favorite(page,'abilroundone')).toContainText('2/2 uses / long rest');
 await expect(favorite(page)).toContainText('1/1 uses / long rest');
 await page.locator('#toastActions [data-act="undo"]').click();
 await expect(favorite(page,'abilroundone')).toContainText('0/2 uses / long rest');await expect(favorite(page)).toContainText('0/1 uses / long rest');
 await expect.poll(async()=>ability(await saved(page),'abilroundone').outsideUsesSpent).toBe(2);
});

test('mode, separate counters and reset options survive reload, duplicate and v1 export/import',async({page})=>{
 const s=hero();s.inCombat=true;s.abilities[0].outsideUsesSpent=1;await seed(page,s);
 await expect(favorite(page)).toContainText('0/1 uses / combat');await page.reload();
 await expect(page.locator('#combatState')).toHaveText('In combat');await expect(favorite(page)).toContainText('0/1 uses / combat');
 await page.locator('[data-sheet-tab="abilities"]').click();await card(page).locator('.ability-summary').click();
 await expect(card(page).locator('[data-ability-prop="usesPer"]')).toHaveValue('combat');
 await card(page).locator('[data-ability-action="duplicate"]').click();await expect.poll(async()=>(await saved(page)).abilities.length).toBe(4);
 const copy=(await saved(page)).abilities.find(a=>a.name==='Copy of Combat move');expect(copy.usesPer).toBe('combat');expect(copy.outsideUsesSpent).toBe(0);expect(copy.usesLeft).toBe(1);
 await openCharacterMenu(page);const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();
 const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));expect(exported.version).toBe(1);expect(exported.state.inCombat).toBe(true);
 await page.locator('#characterMenu > summary').click();await page.locator('[data-sheet-tab="overview"]').click();await toggle(page);
 await openCharacterMenu(page);await page.locator('#importFile').setInputFiles({name:'combat.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.locator('#importYes').click();await page.locator('#characterMenu > summary').click();
 await expect(page.locator('#combatState')).toHaveText('In combat');
 await expect.poll(async()=>(await saved(page)).inCombat).toBe(true);expect(ability(await saved(page)).outsideUsesSpent).toBe(1);
});

test('manual corrections and reset act only on the current allowance; period defaults remain Long rest',async({page})=>{
 const s=hero();s.abilities[0].outsideUsesSpent=1;await seed(page,s);
 await page.locator('[data-sheet-tab="abilities"]').click();await card(page).locator('.ability-summary').click();
 const remaining=card(page).locator('[data-ability-prop="usesLeft"]');await remaining.fill('1');await remaining.blur();
 await expect.poll(async()=>ability(await saved(page)).outsideUsesSpent).toBe(0);expect(ability(await saved(page)).usesLeft).toBe(0);
 await card(page).locator('[data-ability-action="reset"]').click();await expect.poll(async()=>ability(await saved(page)).outsideUsesSpent).toBe(0);
 await card(page,'abillegacyone').locator('.ability-summary').click();await expect(card(page,'abillegacyone').locator('[data-ability-prop="usesPer"]')).toHaveValue('rest');
 await card(page,'abillegacyone').locator('[data-ability-prop="usesPer"]').selectOption('round');
 await card(page,'abillegacyone').locator('[data-ability-prop="outsideUsesStat"]').selectOption('DEX');
 await expect(card(page,'abillegacyone').locator('.ability-summary-badges')).toContainText('2/2 uses / long rest');
 await page.setViewportSize({width:360,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
});

test('Parry has a separate DEX-modifier allowance outside combat and once-per-round uses in combat',async({page})=>{
 const s=hero();s.hist.DEX[1]='21';s.reactAvail=null;s.items=[{id:'sword',name:'Sword',type:'onehand',dmg:'1d6',stat:'STR'}];s.equip={main:'sword'};
 await seed(page,s);await expect(page.locator('#parryBtn')).toHaveText('Parry (4/4 until rest)');
 await page.locator('#parryBtn').click();await page.locator('#toastClose').click();await expect(page.locator('#parryBtn')).toHaveText('Parry (3/4 until rest)');
 await page.locator('#turnReset').click();await expect(page.locator('#parryBtn')).toHaveText('Parry (3/4 until rest)');
 await toggle(page);await page.locator('#parryBtn').click();await page.locator('#toastClose').click();
 await expect(page.locator('#parryBtn')).toBeDisabled();await page.locator('#turnReset').click();await expect(page.locator('#parryBtn')).toBeEnabled();
 await toggle(page);await expect(page.locator('#parryBtn')).toHaveText('Parry (3/4 until rest)');
 await page.locator('#longRest').click();await page.locator('#toastClose').click();await expect(page.locator('#parryBtn')).toHaveText('Parry (4/4 until rest)');
 await expect.poll(async()=>(await saved(page)).parryOutsideSpent).toBe(0);
});

test('combat controls do not tick timers or truncate boosted resources; the existing turn still expires them',async({page})=>{
 const s=hero();s.resources[0].current=150;s.resources[0].max=100;
 s.abilities.push({id:'abilboostone',name:'Boost',duration:1,durationLeft:1,cooldown:3,cooldownLeft:3,
  effects:[{id:'effboostone',target:'resource-max',resourceId:'resenergyone',value:100}]});
 await seed(page,s);await toggle(page);await toggle(page);
 await expect(page.locator('#resourceList [role="progressbar"]')).toHaveAttribute('aria-valuemax','200');
 await expect.poll(async()=>(await saved(page)).inCombat).toBe(false);
 let after=await saved(page);expect(after.resources[0].current).toBe(150);expect(ability(after,'abilboostone').cooldownLeft).toBe(3);
 await page.locator('#turnReset').click();await expect.poll(async()=>(await saved(page)).resources[0].current).toBe(100);
 after=await saved(page);expect(ability(after,'abilboostone').durationLeft).toBe(0);expect(ability(after,'abilboostone').cooldownLeft).toBe(2);
});
