const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
const key='worlds-beyond-sheet-v1';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const hero=()=>({id:'cequipmenthero',fields:{charName:'Equipment Hero',level:'1',apMax:'15',hpCur:'8',mpCur:'3'},
 hist:{DEX:{1:'20'},VIT:{1:'16'},INT:{1:'16'}},over:{},inCombat:false,apAvail:5,reactAvail:0,apGiven:null,
 resources:[{id:'resenergyone',name:'Energy',max:20,current:7}],abilities:[],
 items:[{id:'helm',name:'Helm',type:'head',ar:0,abilities:[
  {name:'Old round',effect:'Legacy effect',uses:3,per:'round'},
  {name:'Fixed round',effect:'Fixed effect',uses:3,per:'round',outsideUsesStat:''},
  {name:'Stat round',effect:'Stat effect',uses:1,per:'round',outsideUsesStat:'DEX',futureAbility:{kept:true}},
  {name:'Rest',effect:'Rest effect',uses:2,per:'rest'}]},
  {id:'spare',name:'Spare',type:'amulet',ar:0,abilities:[{name:'Hidden',effect:'Hidden effect',uses:2,per:'round',outsideUsesStat:''}]}],
 equip:{head:'helm'},spent:{helm:{0:1,1:2,2:1,3:1},spare:{0:1}},equipmentOutsideSpent:{helm:{1:1,2:2},spare:{0:1}}});
async function seed(page,state=hero()){
 await page.addInitScript(({key,state})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));},{key,state});
 await page.goto('/index.html');await equipment(page);
}
async function equipment(page){await page.locator('[data-sheet-tab="equipment"]').click();}
async function overview(page){await page.locator('[data-sheet-tab="overview"]').click();}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const use=(page,index,item='helm')=>page.locator('.equipment-ability-use[data-item="'+item+'"][data-ai="'+index+'"]');
const remaining=(page,index,item='helm')=>page.locator('[data-equipment-remaining="'+item+'"][data-ai="'+index+'"]');
async function close(page){await page.locator('#toastClose').click();}
async function edit(page){await page.locator('#wornList .worn-edit[data-id="helm"]').click();}

test('legacy turns keep their behavior while configured combat/outside equipment uses stay separate',async({page})=>{
 await seed(page);await expect(remaining(page,0)).toHaveValue('2');await expect(remaining(page,1)).toHaveValue('2');
 await use(page,1).click();await expect(page.locator('#toastMath')).toHaveText('Fixed effect');await close(page);
 await expect.poll(async()=>(await saved(page)).equipmentOutsideSpent.helm[1]).toBe(2);
 let s=await saved(page);expect(s.spent.helm[1]).toBe(2);expect(s.apAvail).toBe(5);expect(s.fields.mpCur).toBe('3');expect(s.resources[0].current).toBe(7);
 await overview(page);await page.locator('#turnReset').click();await equipment(page);
 await expect(remaining(page,0)).toHaveValue('3');await expect(remaining(page,1)).toHaveValue('1');await expect(remaining(page,2)).toHaveValue('2');
 await overview(page);await page.locator('#combatToggle').click();await equipment(page);await expect(remaining(page,1)).toHaveValue('3');
 await use(page,1).click();await close(page);await expect(remaining(page,1)).toHaveValue('2');
 await overview(page);await page.locator('#combatToggle').click();await equipment(page);await expect(remaining(page,1)).toHaveValue('1');
});

test('Forge renames preserve counters and removing an earlier ability carries later counters with their rows',async({page})=>{
 await seed(page);await edit(page);await page.locator('#forgeName').fill('Renamed Helm');await page.locator('#forgeSubmit').click();
 await expect.poll(async()=>(await saved(page)).items.find(i=>i.id==='helm').name).toBe('Renamed Helm');
 expect((await saved(page)).spent.helm).toEqual({0:1,1:2,2:1,3:1});expect((await saved(page)).equipmentOutsideSpent.helm).toEqual({1:1,2:2});
 await edit(page);await page.locator('#abilRows .abil-row').first().locator('.abil-del').click();await page.locator('#addAbil').click();
 const row=page.locator('#abilRows .abil-row').last();await row.locator('.abil-name').fill('New');await row.locator('.abil-effect').fill('New effect');await row.locator('.abil-n').fill('1');
 await page.locator('#forgeSubmit').click();await expect.poll(async()=>(await saved(page)).items.find(i=>i.id==='helm').abilities[0].name).toBe('Fixed round');
 const after=await saved(page);expect(after.spent.helm).toEqual({0:2,1:1,2:1});expect(after.equipmentOutsideSpent.helm).toEqual({0:1,1:2});
 expect(after.items.find(i=>i.id==='helm').abilities[1].futureAbility).toEqual({kept:true});await expect(remaining(page,3)).toHaveValue('1');
});

test('explicitly configuring legacy outside uses carries spent uses instead of refilling the ability',async({page})=>{
 await seed(page);await edit(page);let row=page.locator('#abilRows .abil-row').first();
 await expect(row.locator('.abil-outside-stat')).toHaveValue('legacy');await row.locator('.abil-outside-stat').selectOption('');await page.locator('#forgeSubmit').click();
 await expect(remaining(page,0)).toHaveValue('2');await expect.poll(async()=>(await saved(page)).equipmentOutsideSpent.helm[0]).toBe(1);
 await edit(page);row=page.locator('#abilRows .abil-row').first();await row.locator('.abil-outside-stat').selectOption('DEX');await page.locator('#forgeSubmit').click();
 await expect(remaining(page,0)).toHaveValue('3');expect((await saved(page)).equipmentOutsideSpent.helm[0]).toBe(1);
 await page.setViewportSize({width:360,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
});

test('manual number/pip corrections use the current bank and long-rest Undo restores both banks including hidden items',async({page})=>{
 await seed(page);await remaining(page,1).fill('3');await remaining(page,1).blur();
 await expect.poll(async()=>(await saved(page)).equipmentOutsideSpent.helm[1]).toBe(0);expect((await saved(page)).spent.helm[1]).toBe(2);
 await page.locator('button[data-use="helm"][data-ai="1"][data-j="1"]').click();await expect(remaining(page,1)).toHaveValue('1');
 await expect.poll(async()=>(await saved(page)).equipmentOutsideSpent.helm[1]).toBe(2);
 await overview(page);await page.locator('#longRest').click();await expect.poll(async()=>Object.keys((await saved(page)).equipmentOutsideSpent).length).toBe(0);
 await page.locator('#toastActions [data-act="undo"]').click();await equipment(page);await expect(remaining(page,1)).toHaveValue('1');
 await expect.poll(async()=>(await saved(page)).equipmentOutsideSpent.spare?.[0]).toBe(1);expect((await saved(page)).spent.spare[0]).toBe(1);
});

test('outside modifiers update remaining counts without discarding spent uses or limiting large pools to twenty',async({page})=>{
 await seed(page);await page.locator('[data-sheet-tab="attributes"]').click();await page.locator('#mod-DEX').fill('1');await page.locator('#mod-DEX').blur();
 await equipment(page);await expect(remaining(page,2)).toHaveValue('0');await use(page,2).click();await expect(page.locator('#toastMath')).toContainText('no uses left');await close(page);
 await page.locator('[data-sheet-tab="attributes"]').click();await page.locator('#mod-DEX').fill('30');await page.locator('#mod-DEX').blur();await equipment(page);
 await expect(remaining(page,2)).toHaveValue('28');await expect(remaining(page,2)).toHaveAttribute('max','30');
 await expect(page.locator('button[data-use="helm"][data-ai="2"]')).toHaveCount(0);
 await use(page,2).click();await close(page);await expect.poll(async()=>(await saved(page)).equipmentOutsideSpent.helm[2]).toBe(3);
 await expect(remaining(page,2)).toHaveValue('27');await page.setViewportSize({width:360,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
});

test('legacy definitions, explicit settings and both counters survive reload and v1 export/import',async({page})=>{
 await seed(page);await use(page,1).click();await close(page);await expect.poll(async()=>(await saved(page)).equipmentOutsideSpent.helm[1]).toBe(2);
 await page.reload();await equipment(page);await expect(remaining(page,1)).toHaveValue('1');
 await openCharacterMenu(page);const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();
 const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));expect(exported.version).toBe(1);
 expect(exported.state.items.find(i=>i.id==='helm').abilities[0].outsideUsesStat).toBeUndefined();
 expect(exported.state.items.find(i=>i.id==='helm').abilities[1].outsideUsesStat).toBe('');
 await page.locator('#importFile').setInputFiles({name:'equipment.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.locator('#importYes').click();await page.locator('#characterMenu > summary').click();await equipment(page);
 await expect(remaining(page,1)).toHaveValue('1');expect((await saved(page)).spent.helm[1]).toBe(2);expect((await saved(page)).equipmentOutsideSpent.spare[0]).toBe(1);
});

test('form swaps retain item-wise balances and deleting an item removes its two counter banks',async({page})=>{
 const s=hero();s.items.push({id:'other',name:'Other helm',type:'head',ar:0,abilities:[{name:'Other power',effect:'Other effect',uses:2,per:'round',outsideUsesStat:''}]});
 s.equipmentOutsideSpent.other={0:1};s.abilityLoadouts=[{id:'loadotherone',name:'Other',statBonuses:{DEX:2}}];
 s.equipmentProfiles={base:{head:'helm'},loadotherone:{head:'other'}};await seed(page,s);
 await page.locator('[data-sheet-tab="abilities"]').click();await page.locator('#abilityLoadoutSelect').selectOption('loadotherone');await equipment(page);
 await expect(remaining(page,0,'other')).toHaveValue('1');await use(page,0,'other').click();await close(page);
 await page.locator('[data-sheet-tab="abilities"]').click();await page.locator('#abilityLoadoutSelect').selectOption('');await equipment(page);
 await expect(remaining(page,2)).toHaveValue('2');await page.locator('[data-sheet-tab="abilities"]').click();await page.locator('#abilityLoadoutSelect').selectOption('loadotherone');await equipment(page);
 await expect(remaining(page,0,'other')).toHaveValue('0');await page.locator('[data-sheet-tab="abilities"]').click();await page.locator('#abilityLoadoutSelect').selectOption('');await equipment(page);
 await page.locator('#pack .card[data-id="other"] .card-x').click();await expect.poll(async()=>(await saved(page)).items.some(i=>i.id==='other')).toBe(false);
 expect((await saved(page)).equipmentOutsideSpent.other).toBeUndefined();expect((await saved(page)).equipmentProfiles.loadotherone.head).toBeUndefined();
});

test('new Forge round abilities expose an explicit fixed outside limit and can track a use after equipping',async({page})=>{
 await seed(page);await page.locator('#forgeName').fill('New gear');await page.locator('#addAbil').click();
 const row=page.locator('#abilRows .abil-row').first();await row.locator('.abil-name').fill('New power');await row.locator('.abil-effect').fill('New effect');
 await row.locator('.abil-n').fill('2');await row.locator('.abil-per').selectOption('round');await expect(row.locator('.abil-outside-stat')).toHaveValue('');
 await page.locator('#forgeSubmit').click();await expect.poll(async()=>(await saved(page)).items.some(i=>i.name==='New gear')).toBe(true);
 const item=(await saved(page)).items.find(i=>i.name==='New gear');expect(item.abilities[0].outsideUsesStat).toBe('');
 await page.locator('#pack .card[data-id="'+item.id+'"] .card-main').click();await page.locator('.slot[data-slot="head"] .slot-main').click();
 await use(page,0,item.id).click();await close(page);await expect(remaining(page,0,item.id)).toHaveValue('1');
 await expect.poll(async()=>(await saved(page)).equipmentOutsideSpent[item.id]?.[0]).toBe(1);
 expect((await saved(page)).equipmentOutsideSpent.helm[2]).toBe(2);
});
