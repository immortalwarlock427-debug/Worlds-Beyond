const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const key='worlds-beyond-sheet-v1',gameKey='worlds-beyond-game-v1';
const hero=()=>({id:'cconsumablehero',fields:{charName:'Consumable Hero',level:'1',hpCur:'8',mpCur:'5',sessionNotes:'Remember the gate.'},
 hist:{VIT:{1:'16'},INT:{1:'16'},DEX:{1:'20'}},over:{hpMax:'20'},apAvail:7,reactAvail:0,wonderAvail:3,advMode:'adv',
 abilities:[],resources:[{id:'resenergyone',name:'Energy',max:20,current:7}],
 abilityLoadouts:[{id:'loadconswolf',name:'Wolf'}],items:[{id:'helm',name:'Helm',type:'head',ar:0,abilities:[]}],equip:{head:'helm'},
 consumables:[{id:'potion',name:'Healing potion',description:'A red potion.',quantity:3,healingDice:'2d6+2',futureItem:{kept:true}},
  {id:'ration',name:'Rations',description:'Food for the road.',quantity:3,healingDice:''}]});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const card=(page,id)=>page.locator('[data-consumable-id="'+id+'"]');
const quantity=(page,id)=>card(page,id).locator('input');
const use=(page,id)=>card(page,id).locator('[data-consumable-action="use"]');
const edit=(page,id)=>card(page,id).locator('[data-consumable-action="edit"]');
async function tab(page,name){await page.locator('[data-sheet-tab="'+name+'"]').click();}
async function close(page){await page.locator('#toastClose').click();}
async function tapUseWithoutBlurringFirst(page,id){
 const button=use(page,id);await page.evaluate(()=>document.fonts.ready);
 await button.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));await button.hover();
 expect(await quantity(page,id).evaluate(el=>el===document.activeElement)).toBe(true);
 expect(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
 const box=await button.boundingBox();
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
}
async function seed(page,state=hero()){
 await page.addInitScript(({key,gameKey,state})=>{
  if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));
  if(localStorage.getItem(gameKey)===null)localStorage.setItem(gameKey,JSON.stringify({futureGame:{kept:true},tokens:{},foes:[]}));
  crypto.getRandomValues=array=>{array.fill(0);return array;};
 },{key,gameKey,state});
 await page.goto('/index.html#sheet/equipment');
}
async function importState(page,state){
 await openCharacterMenu(page);await page.locator('#importFile').setInputFiles({name:'consumables.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
 await page.locator('#importYes').click();await page.locator('#characterMenu > summary').click();
}

test('create and use a description-only consumable; editing its definition never refills its current quantity',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await seed(page);
 const gameBefore=await page.evaluate(key=>localStorage.getItem(key),gameKey);
 await page.locator('#consumableAdd').click();await page.locator('#consumableName').fill('Torch');await page.locator('#consumableQuantity').fill('3');
 await page.locator('#consumableDescription').fill('Light for the road. <img src=x onerror="window.consumableInjected=true">');await page.locator('#consumableSave').click();
 await expect.poll(async()=>(await saved(page)).consumables.some(item=>item.name==='Torch')).toBe(true);
 const id=(await saved(page)).consumables.find(item=>item.name==='Torch').id;
 await use(page,id).click();await expect(page.locator('#toastMath')).toContainText('Light for the road.');await close(page);
 await expect(quantity(page,id)).toHaveValue('2');await edit(page,id).click();await expect(page.locator('#consumableNewQuantity')).toBeHidden();
 await use(page,id).click();await close(page);await page.locator('#consumableName').fill('A very long torch name carried across distant worlds');await page.locator('#consumableSave').click();
 await expect(quantity(page,id)).toHaveValue('1');await expect.poll(async()=>(await saved(page)).consumables.find(item=>item.id===id).quantity).toBe(1);
 let state=await saved(page);expect(state.apAvail).toBe(7);expect(state.reactAvail).toBe(0);expect(state.fields.hpCur).toBe('8');expect(state.resources[0].current).toBe(7);
 expect(state.fields.sessionNotes).toBe('Remember the gate.');expect(state.items).toHaveLength(1);expect(state.equip.head).toBe('helm');
 expect(await page.evaluate(()=>window.consumableInjected)).toBeUndefined();expect(await page.evaluate(key=>localStorage.getItem(key),gameKey)).toBe(gameBefore);expect(errors).toEqual([]);
 await quantity(page,id).fill('1000001');await tapUseWithoutBlurringFirst(page,id);await expect(page.locator('#toast')).toBeVisible();await close(page);
 await expect.poll(async()=>(await saved(page)).consumables.find(item=>item.id===id).quantity).toBe(1000000);
 // Also cover button activation without a number-input blur, as on some touch browsers.
 await quantity(page,id).fill('4');await use(page,id).evaluate(button=>button.click());
 await expect(page.locator('#toast')).toBeVisible();await close(page);
 await expect.poll(async()=>(await saved(page)).consumables.find(item=>item.id===id).quantity).toBe(3);
 for(const width of [390,360]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);}
});

test('healing rolls consume once; explicit healing uses existing negative Health, Trauma and maximum rules',async({page})=>{
 const state=hero();state.fields.hpCur='-2';state.down={mercy:true,stable:false};await seed(page,state);
 await use(page,'potion').click();await expect(page.locator('#toastTotal')).toHaveText('4');await expect(quantity(page,'potion')).toHaveValue('2');
 expect((await saved(page)).fields.hpCur).toBe('-2');await expect(page.locator('#toastActions [data-act="wonder"]')).toHaveCount(0);
 await page.locator('#toastActions [data-act="consumable-heal"]').dblclick();
 await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('2');expect((await saved(page)).trauma).toBe(1);expect((await saved(page)).down).toBeNull();
 await expect(page.locator('#toastActions [data-act="consumable-heal"]')).toHaveCount(0);await close(page);
 await edit(page,'potion').click();await page.locator('#consumableHealing').fill('100');await page.locator('#consumableSave').click();
 await use(page,'potion').click();await page.locator('#toastActions [data-act="consumable-heal"]').click();
 await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('20');expect((await saved(page)).trauma).toBe(1);await close(page);
 await use(page,'potion').click();await close(page);await expect(quantity(page,'potion')).toHaveValue('0');await expect(use(page,'potion')).toBeDisabled();
 await expect.poll(async()=>(await saved(page)).consumables[0].quantity).toBe(0);const after=await saved(page);
 expect(after.fields.hpCur).toBe('20');expect(after.apAvail).toBe(7);expect(after.wonderAvail).toBe(3);expect(after.advMode).toBe('adv');
});

test('unknown Health does not spend another item on retry, and zero healing never reduces Health',async({page})=>{
 const state=hero();state.fields={charName:'Unconfigured hero',level:'1'};state.hist={};state.over={};state.consumables[0].healingDice='5';await seed(page,state);
 await use(page,'potion').click();await page.locator('#toastActions [data-act="consumable-heal"]').click();
 await expect(page.locator('#toastNote')).toContainText('Set your Health first');await expect(quantity(page,'potion')).toHaveValue('2');
 await tab(page,'overview');await page.locator('#hpCur').fill('3');await page.locator('#toastActions [data-act="consumable-heal"]').click();
 await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('8');await close(page);await tab(page,'equipment');
 await edit(page,'potion').click();await page.locator('#consumableHealing').fill('1d1-10');await page.locator('#consumableSave').click();
 await use(page,'potion').click();await expect(page.locator('#toastTotal')).toHaveText('0');await expect(page.locator('#toastActions [data-act="consumable-heal"]')).toHaveCount(0);
 await close(page);await expect.poll(async()=>(await saved(page)).consumables[0].quantity).toBe(1);expect((await saved(page)).fields.hpCur).toBe('8');
});

test('invalid rolls and quantity corrections are inert; a depleted item and removal remain editable',async({page})=>{
 const state=hero();state.consumables[0].healingDice='2d6oops';await seed(page,state);
 await quantity(page,'ration').fill('4');await tapUseWithoutBlurringFirst(page,'ration');
 await expect(page.locator('#toast')).toBeVisible();await close(page);await expect(quantity(page,'ration')).toHaveValue('3');
 await use(page,'potion').click();await expect(page.locator('#consumableFeedback')).toContainText('complete healing dice');await expect(quantity(page,'potion')).toHaveValue('3');
 await quantity(page,'potion').fill('1.5');await quantity(page,'potion').blur();await expect(quantity(page,'potion')).toHaveValue('3');
 await edit(page,'potion').click();await page.locator('#consumableHealing').fill('1d1+1');await page.locator('#consumableSave').click();
 await quantity(page,'potion').fill('0');await quantity(page,'potion').blur();await expect(use(page,'potion')).toBeDisabled();
 await quantity(page,'potion').fill('2');await tapUseWithoutBlurringFirst(page,'potion');await expect(page.locator('#toast')).toBeVisible();await close(page);await expect(quantity(page,'potion')).toHaveValue('1');
 await page.locator('#consumableAdd').click();await page.locator('#consumableName').fill('Bad formula');await page.locator('#consumableHealing').fill('2d6+');await page.locator('#consumableSave').click();
 await expect(page.locator('#consumableForm')).toBeVisible();await expect(page.locator('#consumableFeedback')).toContainText('complete healing dice');await page.locator('#consumableCancel').click();
 await card(page,'ration').locator('[data-consumable-action="remove"]').click();await card(page,'ration').locator('[data-consumable-action="keep"]').click();await expect(card(page,'ration')).toBeVisible();
 await card(page,'ration').locator('[data-consumable-action="remove"]').click();await card(page,'ration').locator('[data-consumable-action="confirm-remove"]').click();await expect(card(page,'ration')).toHaveCount(0);
 await expect.poll(async()=>(await saved(page)).consumables.length).toBe(1);expect((await saved(page)).consumables[0].quantity).toBe(1);
});

test('form switches, new turns, combat changes, rest and rest Undo never refill consumables',async({page})=>{
 await seed(page);await use(page,'ration').click();await close(page);await use(page,'potion').click();await close(page);
 await tab(page,'abilities');await page.locator('#abilityLoadoutSelect').selectOption('loadconswolf');await tab(page,'equipment');await expect(quantity(page,'ration')).toHaveValue('2');
 await tab(page,'abilities');await page.locator('#abilityLoadoutSelect').selectOption('');await tab(page,'overview');
 await page.locator('#combatToggle').click();await page.locator('#turnReset').click();await page.locator('#combatToggle').click();await page.locator('#longRest').click();
 await tab(page,'equipment');await expect(quantity(page,'potion')).toHaveValue('2');await expect(quantity(page,'ration')).toHaveValue('2');
 await quantity(page,'ration').fill('0');await quantity(page,'ration').blur();await page.locator('#toastActions [data-act="undo"]').click();
 await expect(quantity(page,'ration')).toHaveValue('0');await expect(quantity(page,'potion')).toHaveValue('2');
 await expect.poll(async()=>(await saved(page)).consumables[1].quantity).toBe(0);
});

test('reload and v1 files preserve balances and unknown fields; legacy import and clear reset drafts and old roll actions',async({page})=>{
 await seed(page);await use(page,'potion').click();await close(page);await expect.poll(async()=>(await saved(page)).consumables[0].quantity).toBe(2);
 await page.reload();await expect(quantity(page,'potion')).toHaveValue('2');await openCharacterMenu(page);
 const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));
 expect(exported.version).toBe(1);expect(exported.state.consumables[0].quantity).toBe(2);expect(exported.state.consumables[0].futureItem).toEqual({kept:true});expect(exported.state.futureGame).toBeUndefined();
 await page.locator('#characterMenu > summary').click();await page.locator('#consumableAdd').click();await page.locator('#consumableName').fill('Old draft');await use(page,'potion').click();
 const legacy=hero();delete legacy.consumables;legacy.id='clegacycons';await importState(page,legacy);
 await expect(page.locator('#consumableForm')).toBeHidden();await expect(page.locator('#toast')).toBeHidden();await expect(page.locator('#consumableList')).toContainText('No consumables yet');
 await importState(page,exported);await expect(quantity(page,'potion')).toHaveValue('2');
 await openCharacterMenu(page);await page.locator('#characterReset > summary').click();await page.locator('#clearBtn').click();await page.locator('#clearYes').click();await page.locator('#characterMenu > summary').click();
 await expect(page.locator('#consumableList')).toContainText('No consumables yet');await page.locator('#consumableAdd').click();await page.locator('#consumableName').fill('New character food');await page.locator('#consumableSave').click();
 await expect.poll(async()=>(await saved(page))?.consumables.length).toBe(1);expect((await saved(page)).consumables[0].name).toBe('New character food');
});

test('unsupported saved consumable shapes survive ordinary character edits without being replaced',async({page})=>{
 const state=hero();state.consumables={futureCollection:[{name:'Keep this'}]};await seed(page,state);
 await expect(page.locator('#consumableAdd')).toBeDisabled();await expect(page.locator('#consumableList')).toContainText('saved data has been kept');
 await tab(page,'notes');await page.locator('#sessionNotes').fill('A new session note');
 await expect.poll(async()=>(await saved(page)).fields.sessionNotes).toBe('A new session note');expect((await saved(page)).consumables).toEqual(state.consumables);
});
