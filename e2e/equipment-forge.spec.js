const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const key='worlds-beyond-sheet-v1',gameKey='worlds-beyond-game-v1';
const hero=()=>({id:'cforgehero',vitalRulesVersion:1,fields:{charName:'Forge Hero',level:'1',hpCur:'20',mpCur:'30'},hist:{STR:{1:22},DEX:{1:22},VIT:{1:20},INT:{1:20}},
 items:[],equip:{},abilities:[],resources:[],abilityLoadouts:[],spent:{},equipmentOutsideSpent:{},apAvail:15,inCombat:true});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const category=(page,name)=>page.locator('#catalogCategory [data-category="'+name+'"]').click();
async function base(page,name){
 const value=await page.locator('#catalogPreset option').filter({hasText:new RegExp('^'+name+' ·')}).getAttribute('value');
 await page.locator('#catalogPreset').selectOption(value);
}
async function seed(page,state=hero()){
 page.forgeErrors=[];page.on('pageerror',error=>page.forgeErrors.push(error.message));
 await page.addInitScript(({key,gameKey,state})=>{
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));
  if(!localStorage.getItem(gameKey))localStorage.setItem(gameKey,JSON.stringify({tokens:{},foes:[],future:{kept:true}}));
 },{key,gameKey,state});
 await page.goto('/index.html');await page.locator('[data-sheet-tab="equipment"]').click();
}
async function rules(page){if(!await page.locator('.rule-editor').evaluate(el=>el.open))await page.locator('.rule-editor > summary').click();}
test.afterEach(async({page})=>{expect(page.forgeErrors||[]).toEqual([]);if(!page.isClosed())expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});

test('four lists separate melee, ranged, armor and shields without creating inventory items',async({page})=>{
 await seed(page);await expect(page.locator('#catalogCategory button')).toHaveCount(4);
 await category(page,'melee');await expect(page.locator('#catalogPreset option')).toHaveCount(42);
 await expect(page.locator('#catalogPreset')).toContainText('Longsword');await expect(page.locator('#catalogPreset')).not.toContainText('Longbow');
 await category(page,'ranged');await expect(page.locator('#catalogPreset option')).toHaveCount(13);await expect(page.locator('#catalogPreset')).toContainText('Hand Crossbow');
 await category(page,'armor');await expect(page.locator('#catalogPreset option')).toHaveCount(14);await expect(page.locator('#catalogPreset')).toContainText('Heavy pants');
 await category(page,'shield');await expect(page.locator('#catalogPreset option')).toHaveCount(5);await expect(page.locator('#catalogPreset')).toContainText('Plate shield');
 expect((await saved(page)).items).toEqual([]);
});
test('Shortsword fills table stats before creation and custom overrides survive saving and editing',async({page})=>{
 await seed(page);await category(page,'melee');await base(page,'Shortsword');await rules(page);
 await expect(page.locator('#forgeName')).toHaveValue('Shortsword');await expect(page.locator('#forgeDmg')).toHaveValue('1d6');
 await expect(page.locator('#forgeDamageType')).toHaveValue('Piercing');await expect(page.locator('#forgePrice')).toHaveValue('10 gc');
 await expect(page.locator('[data-weapon-property="Light"]')).toBeChecked();await expect(page.locator('[data-signature="Puncture"]')).toBeChecked();
 expect((await saved(page)).items).toEqual([]);await page.locator('#forgeName').fill('Solvaris blade');await page.locator('#forgeDmg').fill('2d8+3');
 await page.locator('#forgeDamageMultiplier').fill('1.5');await page.locator('#forgeSubmit').click();
 await expect.poll(async()=>(await saved(page)).items.length).toBe(1);let item=(await saved(page)).items[0];
 expect(item).toMatchObject({name:'Solvaris blade',baseEquipment:'Shortsword',dmg:'2d8+3',damageType:'Piercing',price:'10 gc',diceMultiplier:1.5});
 expect(item.properties).toEqual(['Balanced','Light']);expect(item.signatures).toEqual(['Puncture']);
 await page.reload();await page.locator('[data-sheet-tab="equipment"]').click();await page.locator('#pack .card-edit').click();
 await expect(page.locator('#forgeDmg')).toHaveValue('2d8+3');await expect(page.locator('#forgeName')).toHaveValue('Solvaris blade');
 await page.locator('#catalogAdd').click();await expect(page.locator('#forgeDmg')).toHaveValue('1d6');await expect(page.locator('#forgeName')).toHaveValue('Solvaris blade');
 expect((await saved(page)).items[0].dmg).toBe('2d8+3');
});
test('Mace hides unrelated fields after a crossbow base and saves no stale Loading or armor settings',async({page})=>{
 await seed(page);await category(page,'ranged');await base(page,'Hand Crossbow');await rules(page);
 await expect(page.locator('#forgeLoading')).toBeVisible();await expect(page.locator('#forgeLoading')).toHaveValue('1');
 await category(page,'melee');await base(page,'Mace');
 for(const id of ['forgeLoading','forgeLightEv','forgeWeight','forgeBlockMultiplier','forgeVersatile','forgeLongRange','forgeThrownRange','forgeMounted'])await expect(page.locator('#'+id)).toBeHidden();
 await expect(page.locator('#forgeDmg')).toBeVisible();await expect(page.locator('#forgeLoading')).toBeDisabled();
 await page.locator('#forgeSubmit').click();await expect.poll(async()=>(await saved(page)).items.length).toBe(1);
 const item=(await saved(page)).items[0];expect(item.name).toBe('Mace');expect(item.loadingCapacity).toBeUndefined();expect(item.armorWeight).toBeUndefined();expect(item.blockMultiplier).toBeUndefined();
});
test('property choices reveal only their matching settings and disabled dice do not block saving',async({page})=>{
 await seed(page);await category(page,'melee');await base(page,'Mace');await rules(page);
 for(const [property,field] of [['Loading','forgeLoading'],['Thrown','forgeThrownRange'],['Ranged','forgeLongRange'],['Mount','forgeMounted'],['Versatile','forgeVersatile']]){
  await page.locator('[data-weapon-property="'+property+'"]').check();await expect(page.locator('#'+field)).toBeVisible();
  if(property==='Versatile')await page.locator('#'+field).fill('bad dice');
  await page.locator('[data-weapon-property="'+property+'"]').uncheck();await expect(page.locator('#'+field)).toBeHidden();
 }
 await page.locator('#forgeSubmit').click();await expect.poll(async()=>(await saved(page)).items.length).toBe(1);expect((await saved(page)).items[0].versatileDice).toBeUndefined();
});
test('pants stay with armor and light Evasion appears only for light armor',async({page})=>{
 await seed(page);await base(page,'Heavy pants');await rules(page);
 await expect(page.locator('#forgeWeight')).toHaveValue('heavy');await expect(page.locator('#forgeAr')).toHaveValue('1');await expect(page.locator('#forgeLightEv')).toBeHidden();
 await expect(page.locator('#weaponRow')).toBeHidden();await expect(page.locator('#forgeLoading')).toBeHidden();await expect(page.locator('#shieldRow')).toBeHidden();
 await page.locator('#forgeWeight').selectOption('light');await expect(page.locator('#forgeLightEv')).toBeVisible();await page.locator('#forgeLightEv').fill('2');
 await page.locator('#forgeSubmit').click();await expect.poll(async()=>(await saved(page)).items.length).toBe(1);
 const item=(await saved(page)).items[0];expect(item).toMatchObject({type:'pants',ar:1,armorWeight:'light',lightEvasion:2});expect(item.properties).toBeUndefined();
 await expect(page.locator('.armor-extra-slots [data-slot="pants"]')).toHaveCount(1);await expect(page.locator('.hands [data-slot="pants"]')).toHaveCount(0);
});
test('shields load Block and price and expose shield settings without weapon or light-armor fields',async({page})=>{
 await seed(page);await category(page,'shield');await base(page,'Plate shield');await rules(page);
 await expect(page.locator('#forgeBlock')).toHaveValue('1d10');await expect(page.locator('#forgeAr')).toHaveValue('1');await expect(page.locator('#forgePrice')).toHaveValue('60 gc');
 await expect(page.locator('#forgeBlockMultiplier')).toBeVisible();await expect(page.locator('#forgeLoading')).toBeHidden();await expect(page.locator('#forgeWeight')).toBeHidden();await expect(page.locator('#weaponRow')).toBeHidden();
 await page.locator('#forgeBlock').fill('1d12');await page.locator('#forgeBlockMultiplier').fill('1.5');await page.locator('#forgeSubmit').click();
 await expect.poll(async()=>(await saved(page)).items.length).toBe(1);expect((await saved(page)).items[0]).toMatchObject({type:'shield',block:'1d12',blockMultiplier:1.5});
});
test('optional pack capabilities reveal their fields and custom weapons may explicitly add Armor Rating',async({page})=>{
 await seed(page);await category(page,'melee');await base(page,'Shortsword');await rules(page);
 await expect(page.locator('#forgeAr')).toBeHidden();await page.locator('#forgeCustomArmor').check();await expect(page.locator('#forgeAr')).toBeVisible();await page.locator('#forgeAr').fill('2');
 await page.locator('.forge-pack-settings > summary').click();await expect(page.locator('#forgeAmmo')).toBeHidden();await expect(page.locator('#forgeBackpack')).toBeHidden();
 await page.locator('#forgeBackpackEnabled').check();await page.locator('#forgeBackpack').fill('6');await page.locator('#forgeAmmoEnabled').check();await page.locator('#forgeAmmo').fill('10');
 await page.locator('#forgeAmmoEnabled').uncheck();await page.locator('#forgeSubmit').click();
 await expect.poll(async()=>(await saved(page)).items.length).toBe(1);const item=(await saved(page)).items[0];expect(item.ar).toBe(2);expect(item.backpackBonus).toBe(6);expect(item.ammoQuantity).toBeUndefined();
});
test('editing a legacy custom weapon never reapplies a matching-name preset or clears abilities and counters',async({page})=>{
 const state=hero();state.items=[{id:'custom',name:'Shortsword',type:'onehand',ar:2,dmg:'3d12+7',stat:'DEX',damageType:'Fire',futureGear:{kept:true},abilities:[{name:'Flare',effect:'Fire',uses:3,per:'round'}]}];
 state.equip.main='custom';state.spent.custom={0:2};state.equipmentOutsideSpent.custom={0:1};await seed(page,state);
 await page.locator('#wornList .worn-edit[data-id="custom"]').click();await expect(page.locator('#catalogPreset')).toHaveValue('');await expect(page.locator('#forgeDmg')).toHaveValue('3d12+7');
 await expect(page.locator('#forgeAr')).toHaveValue('2');await page.locator('#forgeName').fill('Renamed blade');await page.locator('#forgeSubmit').click();
 await expect.poll(async()=>(await saved(page)).items[0].name).toBe('Renamed blade');let after=await saved(page);expect(after.items[0]).toMatchObject({dmg:'3d12+7',stat:'DEX',ar:2,damageType:'Fire',futureGear:{kept:true}});expect(after.spent.custom[0]).toBe(2);
 await page.locator('#wornList .worn-edit[data-id="custom"]').click();await base(page,'Shortsword');await page.locator('#forgeSubmit').click();
 await expect.poll(async()=>(await saved(page)).items[0].dmg).toBe('1d6');after=await saved(page);expect(after.items[0].name).toBe('Renamed blade');expect(after.items[0].abilities[0].name).toBe('Flare');expect(after.spent.custom[0]).toBe(2);expect(after.equipmentOutsideSpent.custom[0]).toBe(1);
});
test('left strapped attachment works beside the legacy right attachment, held weapon and arm guard',async({page})=>{
 const state=hero();state.items=[{id:'right',name:'Right bow',type:'onehand',ar:0,dmg:'1d10',stat:'DEX',properties:['Strapped','Ranged','Loading'],loadingCapacity:1},
  {id:'left',name:'Left bow',type:'onehand',ar:0,dmg:'1d8',stat:'DEX',properties:['Strapped','Ranged','Loading'],loadingCapacity:2},
  {id:'main',name:'Greatsword',type:'twohand',ar:0,dmg:'2d6',stat:'STR'}, {id:'guard',name:'Guard',type:'arms',ar:1}];
 state.equip={strapped:'right',main:'main',rarm:'guard'};await seed(page,state);
 await expect(page.locator('.hands .slot')).toHaveCount(4);await expect(page.locator('[data-slot="strapped"] .slot-label')).toHaveText('Right strapped');
 await page.locator('[data-draw-weapon="left"][data-hand="off"]').click();await page.locator('#toastClose').click();
 await expect.poll(async()=>(await saved(page)).equip.lstrapped).toBe('left');let after=await saved(page);expect(after.equip).toMatchObject({strapped:'right',main:'main',rarm:'guard'});
 await page.locator('#attacks .atk-roll[data-slot="lstrapped"]').click();await expect.poll(async()=>(await saved(page)).weaponShots?.left).toBe(1);after=await saved(page);expect(after.weaponShots.right).toBeUndefined();
 await expect(page.locator('#toastTitle')).toContainText('Left bow');await page.locator('#toastClose').click();
 await page.reload();await page.locator('[data-sheet-tab="equipment"]').click();await expect(page.locator('[data-slot="lstrapped"] .slot-name')).toHaveText('Left bow');
 await page.setViewportSize({width:360,height:800});
});
test('table base overrides and both attachments survive v1 export/import without rewriting the DM game',async({page})=>{
 const state=hero();state.items=[{id:'right',name:'Right',type:'onehand',ar:0,dmg:'1d10',properties:['Strapped','Ranged']},
  {id:'left',name:'Left',type:'onehand',ar:0,dmg:'1d10',properties:['Strapped','Ranged']}];state.equip={strapped:'right',lstrapped:'left'};await seed(page,state);
 const before=await page.evaluate(key=>localStorage.getItem(key),gameKey);await category(page,'melee');await base(page,'Shortsword');await page.locator('#forgeName').fill('Custom short blade');await page.locator('#forgeDmg').fill('2d6');await page.locator('#forgeSubmit').click();
 await expect.poll(async()=>(await saved(page)).items.length).toBe(3);await openCharacterMenu(page);const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();
 const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));expect(exported.version).toBe(1);
 await page.locator('#importFile').setInputFiles({name:'forge.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.locator('#importYes').click();
 await expect.poll(async()=>(await saved(page)).items[2].dmg).toBe('2d6');const after=await saved(page);expect(after.items[2].baseEquipment).toBe('Shortsword');expect(after.equip).toMatchObject({strapped:'right',lstrapped:'left'});
 expect(await page.evaluate(key=>localStorage.getItem(key),gameKey)).toBe(before);
});
test('setup attachment swaps use the chosen side without replacing held gear or refilling item uses',async({page})=>{
 const state=hero();state.items=[{id:'right',name:'Right',type:'onehand',ar:0,dmg:'1d10',properties:['Strapped','Ranged']},
  {id:'left',name:'Left',type:'onehand',ar:0,dmg:'1d10',properties:['Strapped','Ranged']},
  {id:'sword',name:'Sword',type:'twohand',ar:0,dmg:'2d6'}];state.equip={strapped:'right',main:'sword'};
 state.spent={right:{0:2},left:{0:1}};await seed(page,state);
 await expect(page.locator('[data-draw-weapon="sword"][data-hand="off"]')).toHaveCount(0);
 await page.locator('#pack .card[data-id="left"] .card-main').click();await page.locator('.slot[data-slot="lstrapped"] .slot-main').click();
 await expect.poll(async()=>(await saved(page)).equip.lstrapped).toBe('left');
 await page.locator('.slot[data-slot="lstrapped"] .slot-main').click();await page.locator('.slot[data-slot="strapped"] .slot-main').click();
 await expect.poll(async()=>(await saved(page)).equip.strapped).toBe('left');const after=await saved(page);
 expect(after.equip).toMatchObject({main:'sword',strapped:'left',lstrapped:'right'});expect(after.apAvail).toBe(15);expect(after.spent).toEqual(state.spent);
});
