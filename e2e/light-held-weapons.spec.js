const {test,expect}=require('@playwright/test');
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const key='worlds-beyond-sheet-v1';
const hero=()=>({id:'chandhero',vitalRulesVersion:1,fields:{charName:'Hands Hero',level:'1',hpCur:'20',mpCur:'30'},hist:{STR:{1:22},DEX:{1:22},VIT:{1:20},INT:{1:20}},
 items:[{id:'kusari',name:'Kusarigama',type:'onehand',dmg:'1d8',stat:'DEX',ar:0,properties:['Finesse']},
  {id:'light',name:'Light sword',type:'onehand',dmg:'1d6',stat:'STR',ar:0,properties:['Balanced','Light']},
  {id:'other',name:'Other Light sword',type:'onehand',dmg:'1d6',stat:'STR',ar:0,properties:['Balanced','Light']},
  {id:'shield',name:'Shield',type:'shield',ar:1},{id:'bow',name:'Strapped bow',type:'onehand',dmg:'1d10',stat:'DEX',ar:0,properties:['Ranged','Strapped']}],
 equip:{},abilities:[],resources:[],abilityLoadouts:[],apAvail:15,reactAvail:2,spent:{kusari:{0:2}},equipmentOutsideSpent:{kusari:{0:1}}});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function seed(page,state=hero()){
 page.handErrors=[];page.on('pageerror',error=>page.handErrors.push(error.message));
 await page.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));},{key,state});
 await page.goto('/index.html');await page.locator('[data-sheet-tab="equipment"]').click();
}
const select=(page,id)=>page.locator('#pack .card[data-id="'+id+'"] .card-main').click();
const slot=(page,name)=>page.locator('.slot[data-slot="'+name+'"] .slot-main').click();
test.afterEach(async({page})=>{expect(page.handErrors||[]).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});
test('Pants uses the former Belt body position and Belt uses the lower row without changing saved identities',async({page})=>{
 const state=hero();state.items.push({id:'pants',name:'Pants',type:'pants',ar:1},{id:'belt',name:'Belt',type:'belt',ar:0});state.equip={pants:'pants',belt:'belt'};await seed(page,state);
 await expect(page.locator('.doll .slot.cr.r3[data-slot="pants"] .slot-name')).toHaveText('Pants');
 await expect(page.locator('.armor-extra-slots [data-slot="belt"] .slot-name')).toHaveText('Belt');await expect(page.locator('.doll [data-slot="belt"]')).toHaveCount(0);
 expect((await saved(page)).equip).toMatchObject({pants:'pants',belt:'belt'});
});
test('setup equips only one non-Light weapon, keeps both items and counters, and still allows a shield and strapped bow',async({page})=>{
 const state=hero();state.equip={main:'light',off:'other',strapped:'bow'};await seed(page,state);await select(page,'kusari');await slot(page,'main');
 await expect.poll(async()=>(await saved(page)).equip).toEqual({main:'kusari',strapped:'bow'});expect((await saved(page)).items.length).toBe(5);
 expect((await saved(page)).spent.kusari[0]).toBe(2);expect((await saved(page)).equipmentOutsideSpent.kusari[0]).toBe(1);
 await expect(page.locator('#pack .card[data-id="light"]')).toBeVisible();await expect(page.locator('#attacks .dual')).toHaveCount(0);
 await select(page,'shield');await slot(page,'off');await expect.poll(async()=>(await saved(page)).equip.off).toBe('shield');expect((await saved(page)).equip.main).toBe('kusari');
 await expect(page.locator('#heldWeaponConflict')).toBeHidden();await expect(page.locator('#attacks .atk-roll[data-slot="strapped"]')).toBeVisible();
});
test('paid Draw of either weapon stows a conflicting opposite weapon and insufficient AP does not change gear',async({page})=>{
 const state=hero();state.equip={main:'kusari'};await seed(page,state);await page.locator('[data-draw-weapon="light"][data-hand="off"]').click();await page.locator('#toastClose').click();
 await expect.poll(async()=>(await saved(page)).equip).toEqual({off:'light'});
 await page.locator('[data-draw-weapon="kusari"][data-hand="main"]').click();await page.locator('#toastClose').click();await expect.poll(async()=>(await saved(page)).equip).toEqual({main:'kusari'});
 await page.locator('[data-sheet-tab="overview"]').click();await page.locator('#apPips .pip').first().click();await expect.poll(async()=>(await saved(page)).apAvail).toBe(0);
 await page.locator('[data-sheet-tab="equipment"]').click();const before=(await saved(page)).equip;
 await page.locator('[data-draw-weapon="light"][data-hand="off"]').click();await expect(page.locator('#toastMath')).toContainText('costs');expect((await saved(page)).equip).toEqual(before);
});
test('old saved conflicting pairs ask which weapon to keep and cannot spend AP or a reaction on held attacks',async({page})=>{
 const state=hero();state.equip={main:'kusari',off:'light',strapped:'bow'};await seed(page,state);
 await expect(page.locator('#heldWeaponConflict')).toBeVisible();await expect(page.locator('#heldWeaponConflict [data-keep-held="main"]')).toHaveText('Keep Kusarigama');
 await page.locator('#attacks .atk-roll[data-slot="main"]').click();await expect(page.locator('#toastMath')).toContainText('must both have Light');await page.locator('#toastClose').click();
 expect((await saved(page)).apAvail).toBe(15);await page.locator('#attacks .atk-opp[data-slot="off"]').click();await expect(page.locator('#toastMath')).toContainText('must both have Light');await page.locator('#toastClose').click();expect((await saved(page)).reactAvail).toBe(2);
 await page.locator('#heldWeaponConflict [data-keep-held="main"]').click();await expect.poll(async()=>(await saved(page)).equip).toEqual({main:'kusari',strapped:'bow'});
 await expect(page.locator('#heldWeaponConflict')).toBeHidden();expect((await saved(page)).spent.kusari[0]).toBe(2);
 await page.reload();await page.locator('[data-sheet-tab="equipment"]').click();await expect(page.locator('#heldWeaponConflict')).toBeHidden();
});
test('two Light weapons can still attack together and removing Light prompts a choice without resetting uses',async({page})=>{
 const state=hero();state.equip={main:'light',off:'other'};await seed(page,state);await expect(page.locator('#attacks .dual')).toBeVisible();
 await page.locator('#wornList .worn-edit[data-id="light"]').click();await page.locator('.rule-editor > summary').click();await page.locator('[data-weapon-property="Light"]').uncheck();await page.locator('#forgeSubmit').click();
 await expect(page.locator('#heldWeaponConflict')).toBeVisible();await expect(page.locator('#attacks .dual')).toHaveCount(0);
 await page.locator('#heldWeaponConflict [data-keep-held="off"]').click();await expect.poll(async()=>(await saved(page)).equip).toEqual({off:'other'});
 await page.setViewportSize({width:360,height:800});
});
