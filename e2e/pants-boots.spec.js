const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const key='worlds-beyond-sheet-v1',gameKey='worlds-beyond-game-v1';
const hero=()=>({id:'cbootshero',vitalRulesVersion:1,fields:{charName:'Boots Hero',level:'1',hpCur:'20',mpCur:'30'},hist:{VIT:{1:20},AGL:{1:16},INT:{1:20}},
 items:[],equip:{},abilities:[],resources:[],abilityLoadouts:[],spent:{},equipmentOutsideSpent:{},apAvail:15});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function seed(page,state=hero()){
 page.bootErrors=[];page.on('pageerror',error=>page.bootErrors.push(error.message));
 await page.addInitScript(({key,gameKey,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));if(!localStorage.getItem(gameKey))localStorage.setItem(gameKey,JSON.stringify({tokens:{},foes:[],future:{kept:true}}));},{key,gameKey,state});
 await page.goto('/index.html');await page.locator('[data-sheet-tab="equipment"]').click();
}
const select=(page,id)=>page.locator('#pack .card[data-id="'+id+'"] .card-main').click();
const slot=(page,name)=>page.locator('.slot[data-slot="'+name+'"] .slot-main').click();
test.afterEach(async({page})=>{expect(page.bootErrors||[]).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});
test('new characters see Pants and Boots pair, with no separate leg or boot-side controls',async({page})=>{
 await seed(page);await expect(page.locator('.armor-extra-slots .slot')).toHaveCount(2);await expect(page.locator('.doll [data-slot="pants"] .slot-label')).toHaveText('Pants');
 await expect(page.locator('.armor-extra-slots [data-slot="boots"] .slot-label')).toHaveText('Boots (pair)');await expect(page.locator('#previousLegEquipment')).toBeHidden();
 await expect(page.locator('[data-slot="rleg"]')).toBeHidden();await expect(page.locator('[data-slot="lleg"]')).toBeHidden();
 await page.locator('#forgeType [data-type="boots"]').click();await expect(page.locator('#bootsPairNote')).toContainText('always a pair');await expect(page.locator('#setRow')).toBeHidden();
 await expect(page.locator('#forgeType [data-type="legs"]')).toHaveCount(0);await expect(page.locator('#weaponRow')).toBeHidden();
});
test('custom boots equip as one pair and add their Armor Rating only once through reload',async({page})=>{
 await seed(page);const before=await page.evaluate(key=>localStorage.getItem(key),gameKey);
 await page.locator('#forgeType [data-type="boots"]').click();await page.locator('#forgeName').fill('Travel boots');await page.locator('#forgeAr').fill('2');await page.locator('#forgeSubmit').click();
 await expect.poll(async()=>(await saved(page)).items.length).toBe(1);const item=(await saved(page)).items[0];expect(item.type).toBe('boots');
 await select(page,item.id);await slot(page,'boots');await expect.poll(async()=>(await saved(page)).equip.boots).toBe(item.id);
 await expect(page.locator('#dollAr')).toHaveText('5');await expect(page.locator('#wornList .worn-slot')).toHaveText('Boots (pair)');
 await page.reload();await page.locator('[data-sheet-tab="equipment"]').click();await expect(page.locator('[data-slot="boots"] .slot-name')).toHaveText('Travel boots');
 await expect(page.locator('#dollAr')).toHaveText('5');expect(await page.evaluate(key=>localStorage.getItem(key),gameKey)).toBe(before);
 await page.setViewportSize({width:360,height:800});
});
test('leg-armor presets equip in Pants, covering both legs without reviving the old slots',async({page})=>{
 await seed(page);const value=await page.locator('#catalogPreset option').filter({hasText:/^Light leg guards ·/}).getAttribute('value');await page.locator('#catalogPreset').selectOption(value);
 await expect(page.locator('#forgeType [data-type="pants"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#setRow')).toBeHidden();await page.locator('#forgeSubmit').click();
 await expect.poll(async()=>(await saved(page)).items.length).toBe(1);const item=(await saved(page)).items[0];await select(page,item.id);await slot(page,'pants');
 await expect.poll(async()=>(await saved(page)).equip.pants).toBe(item.id);expect((await saved(page)).equip.rleg).toBeUndefined();expect((await saved(page)).equip.lleg).toBeUndefined();
 await expect(page.locator('#wornList .worn-slot')).toHaveText('Pants');await expect(page.locator('#previousLegEquipment')).toBeHidden();
 await page.reload();await page.locator('[data-sheet-tab="equipment"]').click();await expect(page.locator('[data-slot="pants"] .slot-name')).toHaveText('Light leg guards');
});
test('old leg pieces keep stats and uses on load and rename, then Pants replaces them without deleting inventory',async({page})=>{
 const state=hero();state.items=[{id:'right',name:'Old right piece',type:'legs',ar:2,abilities:[{name:'Step',effect:'Move',uses:3,per:'rest'}]},
  {id:'left',name:'Old left piece',type:'legs',ar:1},{id:'pants',name:'New pants',type:'pants',ar:1}];state.equip={rleg:'right',lleg:'left'};
 state.spent={right:{0:2}};state.equipmentOutsideSpent={right:{0:1}};await seed(page,state);await expect(page.locator('#dollAr')).toHaveText('6');
 await expect(page.locator('#previousLegEquipment')).toBeVisible();await slot(page,'pants');await expect(page.locator('#previousLegEquipment')).toHaveAttribute('open','');
 await page.locator('#wornList .worn-edit[data-id="right"]').click();await page.locator('#forgeName').fill('Renamed piece');await page.locator('#forgeSubmit').click();
 await expect.poll(async()=>(await saved(page)).items[0].name).toBe('Renamed piece');expect((await saved(page)).equip).toMatchObject({rleg:'right',lleg:'left'});await expect(page.locator('#dollAr')).toHaveText('6');
 await select(page,'pants');await slot(page,'pants');await expect.poll(async()=>(await saved(page)).equip).toEqual({pants:'pants'});
 const after=await saved(page);expect(after.items.length).toBe(3);expect(after.spent.right[0]).toBe(2);expect(after.equipmentOutsideSpent.right[0]).toBe(1);
 await expect(page.locator('#previousLegEquipment')).toBeHidden();await expect(page.locator('#pack .card[data-id="right"]')).toBeVisible();await expect(page.locator('#pack .card[data-id="left"]')).toBeVisible();
});
test('existing pants plus two previous pieces stay unchanged when a separate boot pair is equipped',async({page})=>{
 const state=hero();state.items=[{id:'right',type:'legs',name:'Old right',ar:2},{id:'left',type:'legs',name:'Old left',ar:1},
  {id:'pants',type:'pants',name:'Pants',ar:1},{id:'boots',type:'boots',name:'Boots',ar:0}];state.equip={rleg:'right',lleg:'left',pants:'pants'};await seed(page,state);
 await expect(page.locator('#dollAr')).toHaveText('7');await select(page,'boots');await slot(page,'boots');
 await expect.poll(async()=>(await saved(page)).equip.boots).toBe('boots');expect((await saved(page)).equip).toMatchObject(state.equip);await expect(page.locator('#dollAr')).toHaveText('7');
});
test('pants and boots persist through forms and v1 export/import with their item-use counters',async({page})=>{
 const state=hero();state.items=[{id:'pants',name:'Pants',type:'pants',ar:1},{id:'boots',name:'Winter boots',type:'boots',ar:1,abilities:[{name:'Warmth',effect:'Warm',uses:2,per:'rest'}]}];
 state.equip={pants:'pants'};state.abilityLoadouts=[{id:'loadwinterone',name:'Winter'}];state.equipmentProfiles={base:{pants:'pants'},loadwinterone:{pants:'pants',boots:'boots'}};state.spent={boots:{0:1}};
 await seed(page,state);await page.locator('[data-sheet-tab="abilities"]').click();await page.locator('#abilityLoadoutSelect').selectOption('loadwinterone');await page.locator('[data-sheet-tab="equipment"]').click();
 await expect(page.locator('[data-slot="boots"] .slot-name')).toHaveText('Winter boots');await expect(page.locator('[data-equipment-remaining="boots"]')).toHaveValue('1');
 await openCharacterMenu(page);const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));expect(exported.version).toBe(1);
 await page.locator('#importFile').setInputFiles({name:'boots.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.locator('#importYes').click();
 await expect.poll(async()=>(await saved(page)).equip.boots).toBe('boots');expect((await saved(page)).spent.boots[0]).toBe(1);
 await page.locator('#characterMenu > summary').click();await page.locator('[data-sheet-tab="abilities"]').click();await page.locator('#abilityLoadoutSelect').selectOption('');await page.locator('[data-sheet-tab="equipment"]').click();
 await expect(page.locator('[data-slot="boots"] .slot-empty')).toHaveText('Empty');expect((await saved(page)).equipmentProfiles.loadwinterone.boots).toBe('boots');
});
