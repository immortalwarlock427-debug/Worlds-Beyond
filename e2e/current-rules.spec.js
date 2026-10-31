const {test,expect}=require('@playwright/test');
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const key='worlds-beyond-sheet-v1',game='worlds-beyond-game-v1';
const hero=()=>({id:'cruleshero',fields:{charName:'Current Rules',level:'1',hpCur:'8',mpCur:'20',concOn:'1'},hist:{STR:{1:22},DEX:{1:22},VIT:{1:21},INT:{1:21},AGL:{1:16},FTH:{1:16}},over:{},items:[],equip:{},abilities:[],resources:[],statuses:[],consumables:[],inCombat:true});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const tab=(page,name)=>page.locator('[data-sheet-tab="'+name+'"]').click();
async function seed(page,state=hero()){
 await page.addInitScript(({key,game,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));if(!localStorage.getItem(game))localStorage.setItem(game,JSON.stringify({tokens:{},foes:[],future:{kept:true}}));crypto.getRandomValues=array=>{window.ruleDraws=(window.ruleDraws||0)+1;array[0]=17;return array;};},{key,game,state});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/index.html');return errors;
}
test('old saves retain current pools, show new maxima once, and drop only obsolete advancement data',async({page})=>{
 const state=hero();state.rolls={2:9};state.lvGear={1:{VIT:5}};state.settled={old:true};const errors=await seed(page,state);
 await expect(page.locator('#hpCur')).toHaveValue('8');await expect(page.locator('#hpMax')).toHaveValue('21');await expect(page.locator('#mpMax')).toHaveValue('63');
 await expect(page.locator('#vitalMigration')).toBeVisible();await page.locator('#vitalMigrationDismiss').click();
 await expect.poll(async()=>(await saved(page)).vitalRulesVersion).toBe(1);const s=await saved(page);expect(s.rolls).toBeUndefined();expect(s.lvGear).toBeUndefined();expect(s.settled).toBeUndefined();expect(s.hist.VIT[1]).toBe(21);
 await page.reload();await expect(page.locator('#vitalMigration')).toBeHidden();await expect(page.locator('#hpCur')).toHaveValue('8');expect(errors).toEqual([]);
});
test('current stat and level edits adjust Health/Mana by their maximum difference',async({page})=>{
 await seed(page);await tab(page,'attributes');await page.locator('#score-VIT').fill('24');await page.locator('#score-VIT').blur();
 await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('11');await page.locator('#score-INT').fill('24');await page.locator('#score-INT').blur();
 await expect.poll(async()=>(await saved(page)).fields.mpCur).toBe('29');await tab(page,'overview');await expect(page.locator('#hpMax')).toHaveValue('24');await expect(page.locator('#mpMax')).toHaveValue('72');
});
test('removing Health gear can down a character without spending Mercy or prompting damage concentration',async({page})=>{
 const state=hero();state.items=[{id:'life',name:'Life helm',type:'head',ar:0,bonuses:[{t:'hp',v:12}]}];state.equip.head='life';await seed(page,state);
 const before=await page.evaluate(key=>localStorage.getItem(key),game);await tab(page,'equipment');await page.locator('.slot[data-slot="head"] .slot-x').click();
 await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('-4');const s=await saved(page);expect(s.down.mercy).toBe(false);expect(s.fields.concOn).toBe('0');
 await tab(page,'overview');await expect(page.locator('#dyingTitle')).toHaveText('Dying');expect(await page.evaluate(key=>localStorage.getItem(key),game)).toBe(before);
});
test('current equipment presets include armor, prices, Light properties and the strapped crossbow',async({page})=>{
 await seed(page);await tab(page,'equipment');await expect(page.locator('#catalogPreset option')).toHaveCount(71);
 const value=await page.locator('#catalogPreset option').filter({hasText:'Hand Crossbow'}).getAttribute('value');await page.locator('#catalogPreset').selectOption(value);await page.locator('#catalogAdd').click();
 await expect.poll(async()=>(await saved(page)).items.length).toBe(1);const item=(await saved(page)).items[0];expect(item.price).toBe('35 gc');expect(item.properties).toContain('Strapped');expect(item.loadingCapacity).toBe(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});
test('Heavy scaling doubles only the modifier and Fast Roll reduces draws while criticals roll every die',async({page})=>{
 const state=hero();state.fields.level='5';state.items=[{id:'axe',name:'Heavy axe',type:'twohand',dmg:'2d6',stat:'STR',properties:['Heavy'],ar:0}];state.equip.main='axe';await seed(page,state);await tab(page,'equipment');
 await expect(page.locator('#attacks')).toContainText('4d6');await expect(page.locator('#attacks')).toContainText(/\+\s*10/);await page.locator('#fastRoll').check();
 await page.evaluate(()=>window.ruleDraws=0);await page.locator('#attacks .atk-dmg[data-slot="main"]').click();await expect(page.locator('#toastTotal')).toHaveText('34');expect(await page.evaluate(()=>window.ruleDraws)).toBe(2);await page.locator('#toastClose').click();
 await page.locator('#attacks .atk-roll[data-slot="main"]').click();await page.evaluate(()=>window.ruleDraws=0);
 await page.locator('#toastActions [data-act="dmg"]').click();await expect(page.locator('#toastTotal')).toHaveText('34');expect(await page.evaluate(()=>window.ruleDraws)).toBe(2);
});
test('Finesse 18 is a critical option and remains an actual natural 18',async({page})=>{
 const state=hero();state.fields.level='5';state.fastRoll=true;state.items=[{id:'rapier',name:'Rapier',type:'onehand',dmg:'1d10',stat:'DEX',properties:['Finesse'],ar:0}];state.equip.main='rapier';await seed(page,state);await tab(page,'equipment');
 await page.locator('#attacks .atk-roll[data-slot="main"]').click();await expect(page.locator('#toastMath')).toContainText('18');await expect(page.locator('#toastActions [data-act="crit"]')).toBeVisible();await expect(page.locator('#toastNote')).not.toContainText('natural 20');
 await page.evaluate(()=>window.ruleDraws=0);await page.locator('#toastActions [data-act="crit"]').click();await expect(page.locator('#toastTotal')).toHaveText('41');expect(await page.evaluate(()=>window.ruleDraws)).toBe(2);
});
test('Loading attacks spend one shot with AP and Reload uses the same AP payment path',async({page})=>{
 const state=hero();state.items=[{id:'crossbow',name:'Hand crossbow',type:'onehand',dmg:'1d10',stat:'DEX',properties:['Strapped','Ranged','Loading'],loadingCapacity:1,ar:0},{id:'guards',name:'Guards',type:'arms',ar:1}];state.equip={strapped:'crossbow',rarm:'guards'};await seed(page,state);await tab(page,'equipment');
 await page.locator('#attacks .atk-roll[data-slot="strapped"]').click();await expect.poll(async()=>(await saved(page)).weaponShots?.crossbow).toBe(0);await page.locator('#toastClose').click();
 await page.locator('#attacks .atk-roll[data-slot="strapped"]').click();await expect(page.locator('#toastMath')).toContainText('needs reloading');expect((await saved(page)).apAvail).toBe(10);await page.locator('#toastClose').click();
 await page.locator('[data-reload-weapon="crossbow"]').click();await expect.poll(async()=>(await saved(page)).weaponShots?.crossbow).toBe(1);expect((await saved(page)).apAvail).toBe(7);expect((await saved(page)).equip.rarm).toBe('guards');
});
test('Burning uses the editable preset DC and a successful paid Shake It Off roll ends it',async({page})=>{
 await seed(page);await tab(page,'statuses');await page.locator('#statusPreset').selectOption('Burning');await expect(page.locator('#statusNotes')).toHaveValue(/requires a VIT roll/);await page.locator('#statusName').press('Enter');
 const card=page.locator('[data-status-manual]').first();await expect(card.locator('[data-status-edit="dc"]')).toHaveValue('12');await card.locator('[data-status-action="shake"]').click();
 await expect.poll(async()=>(await saved(page)).apAvail).toBe(12);expect((await saved(page)).statuses.length).toBe(0);await expect(page.locator('#toastTitle')).toHaveText('Shake It Off');
});
test('short rest rolls a hit die and applies its healing once without advancement rolls',async({page})=>{
 await seed(page);await page.locator('.health-details > summary').click();await page.locator('#shortRest').click();await expect(page.locator('#toastTitle')).toHaveText('Short rest hit die');await page.locator('#toastActions [data-act="shortrest-heal"]').dblclick();
 await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('16');expect((await saved(page)).rolls).toBeUndefined();expect((await saved(page)).apAvail).toBeNull();
});
test('explicit Draw and Drink buttons commit discounted AP with gear or quantity once',async({page})=>{
 const state=hero();state.items=[{id:'sword',name:'Sword',type:'onehand',dmg:'1d6',stat:'STR',properties:['Light'],ar:0}];state.consumables=[{id:'potion',name:'Potion',quantity:2,healingDice:'1d1'}];await seed(page,state);await tab(page,'equipment');
 await page.locator('[data-draw-weapon="sword"][data-hand="main"]').click();await expect.poll(async()=>(await saved(page)).apAvail).toBe(14);expect((await saved(page)).equip.main).toBe('sword');await page.locator('#toastClose').click();
 await page.locator('[data-consumable-id="potion"] [data-consumable-action="drink"]').click();await expect.poll(async()=>(await saved(page)).apAvail).toBe(11);expect((await saved(page)).consumables[0].quantity).toBe(1);
 await page.locator('#toastActions [data-act="consumable-heal"]').click();await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('9');expect((await saved(page)).apAvail).toBe(11);
});
test('Forge uses editable numeric multipliers without a material taxonomy',async({page})=>{
 await seed(page);await tab(page,'equipment');await page.locator('#forgeType [data-type="onehand"]').click();await page.locator('#forgeName').fill('Custom blade');await page.locator('#forgeDmg').fill('1d6');
 await page.locator('.rule-editor > summary').click();await expect(page.locator('#forgeMetal')).toHaveCount(0);await page.locator('#forgeDamageMultiplier').fill('1.5');await page.locator('#forgeSubmit').click();
 await expect.poll(async()=>(await saved(page)).items.length).toBe(1);const item=(await saved(page)).items[0];expect(item.diceMultiplier).toBe(1.5);expect(item.metal).toBeUndefined();
 await page.locator('[data-draw-weapon="'+item.id+'"][data-hand="main"]').click();await page.locator('#toastClose').click();await page.locator('#attacks .atk-dmg[data-slot="main"]').click();await expect(page.locator('#toastTotal')).toHaveText('14');
});
