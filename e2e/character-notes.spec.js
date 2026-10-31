const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const key='worlds-beyond-sheet-v1',gameKey='worlds-beyond-game-v1';
const fields=['sessionNotes','backstory','personality','languages','allies'];
const notes={sessionNotes:'Session 12 — follow the river.\nAsk about the missing ship.',backstory:'Born beyond the gate.\nReturned with a promise.',
 personality:'Curious, patient, afraid of heights.',languages:'Common\nOld Celestial',allies:'Mara — captain of the Starling.'};
const hero=()=>({id:'cnoteshero',fields:{charName:'Notes Hero',level:'1',hpCur:'8',mpCur:'9'},hist:{VIT:{1:'16'},INT:{1:'16'},DEX:{1:'20'}},
 inCombat:true,apAvail:7,reactAvail:0,parryOutsideSpent:2,
 abilities:[{id:'abilnotespower',name:'Ongoing power',uses:3,usesLeft:1,usesPer:'round',outsideUsesSpent:2,cooldown:4,cooldownLeft:3,duration:4,durationLeft:2}],
 resources:[{id:'resnotesenergy',name:'Energy',max:20,current:7}],
 abilityLoadouts:[{id:'loadnoteswolf',name:'Wolf',entryApCost:2}],
 items:[{id:'helm',name:'Helm',type:'head',ar:0,abilities:[{name:'Barrier',uses:3,per:'round',outsideUsesStat:''}]}],
 equip:{head:'helm'},spent:{helm:{0:2}},equipmentOutsideSpent:{helm:{0:1}}});
async function seed(page,state=hero(),path='/index.html'){
 await page.addInitScript(({key,gameKey,state})=>{
  if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));
  if(localStorage.getItem(gameKey)===null)localStorage.setItem(gameKey,JSON.stringify({futureGame:{retained:true},tokens:{},foes:[]}));
 },{key,gameKey,state});
 await page.goto(path);
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function tab(page,name){await page.locator('[data-sheet-tab="'+name+'"]').click();}
async function expectNotes(page,values=notes){for(const name of fields)await expect(page.locator('#'+name)).toHaveValue(values[name]||'');}
async function importState(page,value){
 await openCharacterMenu(page);
 await page.locator('#importFile').setInputFiles({name:'notes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
 await page.locator('#importYes').click();
 await page.locator('#characterMenu > summary').click();
}

test('legacy notes start empty; typing long plain text preserves gameplay and DM saves on a phone',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await seed(page);await expect(page.locator('#hpCur')).toBeVisible();await expect(page.locator('#notesSec')).toBeHidden();
 await tab(page,'notes');await expectNotes(page,{});await expect(page.locator('#advBar')).toBeHidden();
 const gameBefore=await page.evaluate(key=>localStorage.getItem(key),gameKey);
 await page.evaluate(()=>{
  window.noteCommandCalls=0;
  window.WBCharacter.apply=()=>{window.noteCommandCalls++;throw Error('A note dispatched a gameplay command');};
 });
 const longText='  Session reminder 🗺️\n'+('Look beyond the gate. '.repeat(300))+'\n<img src=x onerror="window.noteExecuted=true">\n  ';
 await page.locator('#sessionNotes').fill(longText);
 for(const name of fields.filter(name=>name!=='sessionNotes'))await page.locator('#'+name).fill(notes[name]);
 await page.locator('#personality').pressSequentially(' Brave.');
 await expect.poll(async()=>(await saved(page)).fields.personality).toBe(notes.personality+' Brave.');
 const state=await saved(page);
 expect(state.fields.sessionNotes).toBe(longText);expect(state.apAvail).toBe(7);expect(state.reactAvail).toBe(0);
 expect(state.fields.hpCur).toBe('8');expect(state.fields.mpCur).toBe('9');expect(state.inCombat).toBe(true);
 expect(state.abilities[0]).toMatchObject({usesLeft:1,outsideUsesSpent:2,cooldownLeft:3,durationLeft:2});
 expect(state.resources[0].current).toBe(7);expect(state.spent.helm[0]).toBe(2);expect(state.equipmentOutsideSpent.helm[0]).toBe(1);
 expect(await page.evaluate(()=>window.noteCommandCalls)).toBe(0);expect(await page.evaluate(()=>window.noteExecuted)).toBeUndefined();
 expect(await page.evaluate(key=>localStorage.getItem(key),gameKey)).toBe(gameBefore);expect(errors).toEqual([]);
 await page.locator('#sessionNotes').evaluate(el=>{el.focus();el.setSelectionRange(5,5);});
 await page.locator('#sessionNotes').press('X');
 expect(await page.locator('#sessionNotes').evaluate(el=>({active:el===document.activeElement,start:el.selectionStart}))).toEqual({active:true,start:6});
 for(const width of [390,360]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);}
});

test('notes survive reload and v1 export/import with exact multiline values',async({page})=>{
 const state=hero();Object.assign(state.fields,notes);
 await seed(page,state,'/index.html#sheet/notes');await expectNotes(page);
 const button=await page.locator('[data-sheet-tab="notes"]').boundingBox();
 expect(button.x).toBeGreaterThanOrEqual(0);expect(button.x+button.width).toBeLessThanOrEqual(390);
 await page.locator('#sessionNotes').fill(notes.sessionNotes+'\nNew lead: the lighthouse.');
 const updated={...notes,sessionNotes:notes.sessionNotes+'\nNew lead: the lighthouse.'};
 await expect.poll(async()=>(await saved(page)).fields.sessionNotes).toBe(updated.sessionNotes);
 await page.reload();await expectNotes(page,updated);
 await expect(page.locator('[data-sheet-tab="notes"]')).toBeInViewport();await openCharacterMenu(page);
 const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();
 const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));
 expect(exported.version).toBe(1);expect(exported.format).toBe('worlds-beyond-character');
 for(const name of fields)expect(exported.state.fields[name]).toBe(updated[name]);
 expect(exported.state.futureGame).toBeUndefined();expect(exported.state.map).toBeUndefined();
 await page.locator('#characterMenu > summary').click();await page.locator('#backstory').fill('Local change');
 await expect.poll(async()=>(await saved(page)).fields.backstory).toBe('Local change');
 await importState(page,exported);await expectNotes(page,updated);
 await page.reload();await expectNotes(page,updated);
});

test('legacy import and character reset clear prior notes; cancelling reset keeps them',async({page})=>{
 const state=hero();Object.assign(state.fields,notes);
 await seed(page,state,'/index.html#sheet/notes');await expectNotes(page);
 await openCharacterMenu(page);await page.locator('#characterReset > summary').click();await page.locator('#clearBtn').click();
 await page.locator('#clearNo').click();await page.locator('#characterMenu > summary').click();await expectNotes(page);
 await importState(page,hero());await expectNotes(page,{});
 await page.locator('#allies').fill('A new friend');await expect.poll(async()=>(await saved(page)).fields.allies).toBe('A new friend');
 await openCharacterMenu(page);await page.locator('#characterReset > summary').click();await page.locator('#clearBtn').click();await page.locator('#clearYes').click();
 await page.locator('#characterMenu > summary').click();await expectNotes(page,{});
 await page.locator('#sessionNotes').fill('A fresh start');await expect.poll(async()=>(await saved(page))?.fields.sessionNotes).toBe('A fresh start');
 expect((await saved(page)).fields.allies).toBeUndefined();
});

test('character notes remain shared across forms, combat changes, turns and long-rest Undo',async({page})=>{
 const state=hero();Object.assign(state.fields,notes);await seed(page,state);
 await tab(page,'abilities');await page.locator('#abilityLoadoutSelect').selectOption('loadnoteswolf');
 await tab(page,'notes');await expectNotes(page);
 await tab(page,'abilities');await page.locator('#abilityLoadoutSelect').selectOption('');
 await tab(page,'overview');await expect(page.locator('#advBar')).toBeVisible();await page.locator('#combatToggle').click();await page.locator('#turnReset').click();
 await tab(page,'notes');await expectNotes(page);
 await tab(page,'overview');await page.locator('#longRest').click();await page.locator('#toastActions [data-act="undo"]').click();
 await tab(page,'notes');await expectNotes(page);
 await expect.poll(async()=>(await saved(page)).fields.sessionNotes).toBe(notes.sessionNotes);
});
