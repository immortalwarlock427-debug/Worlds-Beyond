const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
const key='worlds-beyond-sheet-v1',gameKey='worlds-beyond-game-v1';
const hero=()=>({id:'chistoryhero',fields:{charName:'Dice Hero',level:'1',apMax:'20',hpCur:'8',mpCur:'5'},over:{hpMax:'20'},
 hist:{STR:{1:'22'},DEX:{1:'30'},VIT:{1:'16'},INT:{1:'16'},FTH:{1:'18'},AGL:{1:'12'}},
 apAvail:20,reactAvail:1,wonderAvail:2,advMode:'norm',inCombat:true,
 resources:[{id:'resdiceenergy',name:'Energy',max:10,current:7}],
 abilities:[{id:'abildicefire',name:'Starfire',favorite:true,apCost:5,attackStat:'INT',damageDice:'1d6',damageStat:'STR',resourceId:'resdiceenergy',resourceCost:2,uses:2,usesLeft:2}],
 items:[{id:'blade',type:'onehand',properties:['Balanced','Light'],name:'Blade',dmg:'1d6',stat:'STR',ar:0,abilities:[]},{id:'dagger',type:'onehand',properties:['Balanced','Light'],name:'Dagger',dmg:'1d4',stat:'DEX',ar:0,abilities:[]}],
 equip:{main:'blade',off:'dagger'},consumables:[{id:'potion',name:'Potion',quantity:3,healingDice:'2d1+2'}]});
async function seed(page,state=hero(),hash='#sheet/dice'){
 await page.addInitScript(({key,gameKey,state})=>{
  if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));
  if(localStorage.getItem(gameKey)===null)localStorage.setItem(gameKey,JSON.stringify({futureGame:{kept:true},tokens:{},foes:[]}));
  window.rollDraws=0;window.rollValues=[];
  crypto.getRandomValues=array=>{window.rollDraws++;array[0]=window.rollValues.shift()??0;return array;};
 },{key,gameKey,state});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/index.html'+hash);
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const history=async page=>(await saved(page))?.rollHistory||[];
const dice=(page,values)=>page.evaluate(values=>{window.rollValues=values;window.rollDraws=0;},values);
const cards=page=>page.locator('#recentRollList .recent-roll');
async function tab(page,name){await page.locator('[data-sheet-tab="'+name+'"]').click();}
async function close(page){await page.locator('#toastClose').click();}
async function free(page,expression,label){
 await page.locator('#freeDiceExpression').fill(expression);if(label!==undefined)await page.locator('#freeDiceLabel').fill(label);
 await page.locator('#freeDiceForm button[type="submit"]').click();
}
const attack=(page,slot='main')=>page.locator('.atk-roll[data-slot="'+slot+'"]');

test('free dice follow the complete expression, preserve gameplay and show read-only timestamped details on phones',async({page})=>{
 await seed(page);await expect(page.locator('#advBar')).toBeHidden();const gameBefore=await page.evaluate(key=>localStorage.getItem(key),gameKey);
 await dice(page,[0,1,2]);await free(page,'3d6+2','Camp <img src=x onerror="window.historyInjected=true">');
 await expect(page.locator('#toastTotal')).toHaveText('8');await expect(page.locator('#toastMath')).toContainText('3d6 (1, 2, 3) + 2');
 await expect.poll(async()=>(await history(page)).length).toBe(1);await close(page);
 await expect(cards(page)).toHaveCount(1);await cards(page).locator('summary').click();
 await expect(cards(page).locator('.recent-roll-math')).toContainText('3d6 (1, 2, 3)');
 const entry=(await history(page))[0];expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);await expect(cards(page).locator('time')).toHaveAttribute('datetime',entry.at);
 expect(await page.evaluate(()=>window.historyInjected)).toBeUndefined();expect(await page.evaluate(()=>window.rollDraws)).toBe(3);
 const before=await page.evaluate(key=>localStorage.getItem(key),key);
 await page.evaluate(()=>{window.WBCharacter.apply=()=>{throw Error('History dispatched a command');};});
 await cards(page).locator('summary').click();await cards(page).locator('summary').click();await tab(page,'notes');await tab(page,'dice');
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(before);expect(await page.evaluate(()=>window.rollDraws)).toBe(3);
 const state=await saved(page);expect(state.apAvail).toBe(20);expect(state.resources[0].current).toBe(7);expect(state.consumables[0].quantity).toBe(3);expect(state.fields.hpCur).toBe('8');
 expect(await page.evaluate(key=>localStorage.getItem(key),gameKey)).toBe(gameBefore);await expect(cards(page).getByRole('button')).toHaveCount(0);
 for(const width of [390,360]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);}
});

test('invalid free dice draw nothing; constants and signed flat bonuses remain ordinary free results',async({page})=>{
 await seed(page);await dice(page,[]);
 for(const expression of ['2d6oops','1d6+','1001d6','0d6','9'.repeat(121)]){
  await free(page,expression);await expect(page.locator('#diceFeedback')).toContainText('complete dice');await expect(cards(page)).toHaveCount(0);
 }
 expect(await page.evaluate(()=>window.rollDraws)).toBe(0);expect((await saved(page)).rollHistory).toBeUndefined();
 await free(page,'1d1-4');await expect(page.locator('#toastTotal')).toHaveText('-3');await close(page);
 await free(page,'5');await expect(page.locator('#toastTotal')).toHaveText('5');await close(page);
 await expect.poll(async()=>(await history(page)).length).toBe(2);expect(await page.evaluate(()=>window.rollDraws)).toBe(1);
 await expect(page.locator('#toastActions button')).toHaveCount(0);
});

test('twenty newest results survive and clearing them never refunds costs or changes stock',async({page})=>{
 await seed(page);
 for(let i=1;i<=25;i++){await free(page,'1d1','Roll '+i);await close(page);}
 await expect.poll(async()=>(await history(page))[0]?.title).toBe('Roll 25');await expect.poll(async()=>(await history(page)).length).toBe(20);await expect(cards(page)).toHaveCount(20);
 const entries=await history(page);expect(entries[0].title).toBe('Roll 25');expect(entries[19].title).toBe('Roll 6');expect(new Set(entries.map(entry=>entry.id)).size).toBe(20);
 await page.locator('#rollHistoryClear').click();await page.locator('#rollHistoryKeep').click();await expect(cards(page)).toHaveCount(20);
 await page.locator('#rollHistoryClear').click();await page.locator('#rollHistoryClearYes').click();
 await expect.poll(async()=>(await history(page)).length).toBe(0);expect((await saved(page)).apAvail).toBe(20);expect((await saved(page)).consumables[0].quantity).toBe(3);
});

test('weapon rolls retain dice draws and one payment while opportunity conversion revises the original result',async({page})=>{
 await seed(page,hero(),'#sheet/equipment');await dice(page,[19,0]);await attack(page).click();await expect.poll(async()=>(await history(page)).length).toBe(1);
 const attackId=(await history(page))[0].id;
 await page.locator('#toastActions [data-act="toreact"]').click();await expect.poll(async()=>(await saved(page)).apAvail).toBe(20);
 expect((await history(page))[0].id).toBe(attackId);expect((await history(page))[0].note).toContain('Opportunity attack');
 await page.locator('#toastActions [data-act="crit"]').click();await expect.poll(async()=>(await history(page)).length).toBe(2);
 const original=(await history(page))[0];expect(original.total).toBe(12);
 await expect(page.locator('#toastActions [data-act^="devastate"]')).toHaveCount(0);expect((await history(page)).length).toBe(2);
 expect(await page.evaluate(()=>window.rollDraws)).toBe(2);expect((await saved(page)).apAvail).toBe(20);expect((await saved(page)).reactAvail).toBe(0);
});

test('dual Singularity records both natural dice and keeps the revised damage as one result',async({page})=>{
 await seed(page,hero(),'#sheet/equipment');await dice(page,[0,0,0,0]);
 await page.locator('[data-singularity-slot="dual"]').selectOption('off');await attack(page,'dual').click();
 await expect.poll(async()=>(await history(page)).length).toBe(1);const dual=(await history(page))[0];
 expect(dual.kind).toBe('dual');expect(dual.total).toBeNull();expect(dual.math).toContain('Main hand');expect(dual.math).toContain('Off-hand');expect(dual.note).toContain('Singularity');
 await page.locator('#toastActions [data-act="dualboth"]').click();await expect.poll(async()=>(await history(page)).length).toBe(2);
 expect((await history(page))[0].total).toBe(8);expect((await history(page)).length).toBe(2);expect(await page.evaluate(()=>window.rollDraws)).toBe(4);
});

for(const defy of [false,true])test(defy?'Defy Fate annotates a result without claiming another die roll':'Wonder records the new die roll without replacing the original',async({page})=>{
 const state=hero();if(defy)state.hist.FTH={1:'21'};await seed(page,state,'#sheet/attributes');await dice(page,[0,10]);
 await page.locator('.roll-stat[data-stat="VIT"]').click();await expect.poll(async()=>(await history(page)).length).toBe(1);const original=(await history(page))[0];
 await page.locator('#toastActions [data-act="'+(defy?'defy':'wonder')+'"]').click();
 await expect.poll(async()=>(await saved(page)).wonderAvail).toBe(1);
 if(defy){expect((await history(page)).length).toBe(1);expect((await history(page))[0]).toMatchObject({id:original.id,total:3,success:true});expect((await history(page))[0].note).toContain('Defy Fate');expect(await page.evaluate(()=>window.rollDraws)).toBe(1);}
 else {await expect.poll(async()=>(await history(page)).length).toBe(2);expect((await history(page))[0].total).toBe(13);expect((await history(page))[1].total).toBe(3);expect((await history(page))[1].id).toBe(original.id);expect(await page.evaluate(()=>window.rollDraws)).toBe(2);}
});

test('ability attacks, damage and consumable healing record results without duplicating costs or applying history effects',async({page})=>{
 await seed(page,hero(),'#sheet/overview');await dice(page,[9,0,0,0]);await page.locator('[data-favorite-use="abildicefire"]').click();
 await page.locator('#toastActions [data-act="ability-dmg"]').click();await close(page);await expect.poll(async()=>(await history(page)).length).toBe(2);
 await tab(page,'equipment');await page.locator('[data-consumable-id="potion"] [data-consumable-action="use"]').click();
 await expect(page.locator('#toastTotal')).toHaveText('4');await page.locator('#toastActions [data-act="consumable-heal"]').click();await close(page);
 await expect.poll(async()=>(await history(page)).length).toBe(3);const after=await saved(page);
 expect(after.apAvail).toBe(15);expect(after.resources[0].current).toBe(5);expect(after.abilities[0].usesLeft).toBe(1);expect(after.consumables[0].quantity).toBe(2);expect(after.fields.hpCur).toBe('12');
 for(const entry of after.rollHistory)for(const key of ['acts','weapon','attackDamage','consumableHealing','abilityRoll','foe'])expect(entry[key]).toBeUndefined();
 await tab(page,'dice');for(const item of await cards(page).all())await item.locator('summary').click();
 expect((await saved(page)).fields.hpCur).toBe('12');expect((await saved(page)).consumables[0].quantity).toBe(2);expect(await page.evaluate(()=>window.rollDraws)).toBe(4);
});

test('stat generation and short rests record real rolls, while redraws and reload never create extra results',async({page})=>{
 const state=hero();state.fields.level='2';await seed(page,state,'#sheet/attributes');await dice(page,[]);
 expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
 await page.locator('#rollAll').click();await expect.poll(async()=>(await history(page)).length).toBe(8);
 await page.locator('#rollClear').click();expect((await history(page)).length).toBe(8);
 await tab(page,'overview');await page.locator('.health-details > summary').click();await page.locator('#shortRest').click();await expect.poll(async()=>(await history(page)).length).toBe(9);
 expect((await history(page))[0].kind).toBe('healing');expect((await history(page))[0].total).toBe(1);expect((await saved(page)).rolls).toBeUndefined();
 expect(await page.evaluate(()=>window.rollDraws)).toBe(25);await tab(page,'dice');await page.reload();await expect(cards(page)).toHaveCount(9);
 expect(await page.evaluate(()=>window.rollDraws)).toBe(0);
});

test('history travels through v1 files, legacy import and character clear reset drafts, and unsupported collections stay preserved',async({page})=>{
 await seed(page);await free(page,'1d1+2','Saved result');await close(page);await expect.poll(async()=>(await history(page)).length).toBe(1);
 const first=(await history(page))[0];await page.reload();await expect(cards(page)).toHaveCount(1);await expect(page.locator('[data-sheet-tab="dice"]')).toBeInViewport();
 await openCharacterMenu(page);const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();const file=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));
 expect(file.version).toBe(1);expect(file.state.rollHistory[0]).toEqual(first);expect(file.state.futureGame).toBeUndefined();
 await page.locator('#characterMenu > summary').click();await page.locator('#freeDiceExpression').fill('Old draft');
 async function load(value){await openCharacterMenu(page);await page.locator('#importFile').setInputFiles({name:'dice.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await page.locator('#importYes').click();await page.locator('#characterMenu > summary').click();}
 await load(hero());await expect(cards(page)).toHaveCount(0);await expect(page.locator('#freeDiceExpression')).toHaveValue('');
 await load(file);await expect(cards(page)).toHaveCount(1);expect((await history(page))[0]).toEqual(first);
 const future=hero();future.rollHistory={futureSchema:true};await load(future);await expect(page.locator('#rollHistoryClear')).toBeDisabled();
 await tab(page,'notes');await page.locator('#sessionNotes').fill('Keep future history');await expect.poll(async()=>(await saved(page)).fields.sessionNotes).toBe('Keep future history');expect((await saved(page)).rollHistory).toEqual({futureSchema:true});
 await openCharacterMenu(page);await page.locator('#characterReset > summary').click();await page.locator('#clearBtn').click();await page.locator('#clearYes').click();await page.locator('#characterMenu > summary').click();await tab(page,'dice');await expect(cards(page)).toHaveCount(0);
});
