const {test,expect}=require('@playwright/test');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const key='worlds-beyond-sheet-v1';
const project='https://bribnpmgptnktvlbhzdm.supabase.co';
const hero=(revision=3)=>({
  id:'ccloudhero',fields:{charName:'Phone hero'},hist:{VIT:{1:16}},
  cloudSync:{endpoint:project,ownerId:'owner',revision}
});
// A deterministic Supabase transport double. The actual controller, adapter,
// storage, confirmations and sheet UI run unchanged; no live account is used.
function fakeSupabase(){
  const clone=value=>JSON.parse(JSON.stringify(value));
  const doc={id:'ccloudhero',fields:{charName:'Laptop level-up',level:'5'},hist:{VIT:{1:16}}};
  const db=window.cloudTest={row:{character_id:doc.id,name:'Laptop level-up',revision:4,document:doc},updates:[]};
  window.supabase={createClient(){return {
    auth:{async getUser(){return {data:{user:{id:'owner',email:'test@example.invalid'}}};},
      onAuthStateChange(){},stopAutoRefresh(){}},
    from(){
      let action='select',value,filters={};
      const q={select(){return q;},eq(k,v){filters[k]=v;return q;},
        order(){return Promise.resolve({data:db.row?[clone(db.row)]:[]});},
        update(v){action='update';value=v;return q;},
        insert(v){action='insert';value=v;return q;},
        maybeSingle:async()=>{
          if(db.holdNext){db.holdNext=false;await new Promise(resolve=>{db.release=resolve;});}
          return result();
        },single:async()=>result()};
      function result(){
        if(action==='insert'){
          if(db.row)return {error:{code:'23505'}};
          db.row=clone(value);return {data:clone(db.row)};
        }
        if(action==='update')db.updates.push(clone(filters));
        if(!db.row||filters.character_id!==db.row.character_id||
            (filters.revision!==undefined&&filters.revision!==db.row.revision))return {data:null};
        if(action==='update')Object.assign(db.row,clone(value));
        return {data:clone(db.row)};
      }
      return q;
    }
  };}};
}
async function prepare(context,state){
  await context.addInitScript(fakeSupabase);
  await context.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  await context.addInitScript(({key,state})=>{
    if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));
  },{key,state});
}
async function cloudPage(page){
  await page.goto('/cloud.html');
  await expect(page.locator('#cloudCharacterList')).toContainText('Revision 4');
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);

test('refreshing the list never lets a stale local revision overwrite a newer cloud copy',async({context,page})=>{
  await prepare(context,hero());
  await cloudPage(page);
  await page.locator('#cloudSaveLocal').click();
  await expect(page.locator('#cloudFeedback')).toContainText('Conflict');
  await page.locator('#cloudReload').click();
  await expect(page.locator('#cloudFeedback')).toContainText('refreshed');
  await page.locator('#cloudSaveLocal').click();
  await expect(page.locator('#cloudFeedback')).toContainText('Conflict');
  expect(await page.evaluate(()=>window.cloudTest.updates)).toEqual([]);
  expect((await saved(page)).cloudSync.revision).toBe(3);
  expect(await page.evaluate(()=>window.cloudTest.row.document.fields.level)).toBe('5');
});

test('a cloud write between list and Save is rejected by the adapter revision filter',async({context,page})=>{
  await prepare(context,hero(4));
  await cloudPage(page);
  await page.evaluate(()=>{window.cloudTest.row.revision=5;});
  page.once('dialog',d=>d.accept());
  await page.locator('#cloudSaveLocal').click();
  await expect(page.locator('#cloudFeedback')).toContainText('Conflict');
  expect(await page.evaluate(()=>window.cloudTest.updates[0].revision)).toBe(4);
  expect(await page.evaluate(()=>window.cloudTest.row.revision)).toBe(5);
  expect((await saved(page)).cloudSync.revision).toBe(4);
});

test('legacy local copies without a receipt require restore before overwriting a cloud row',async({context,page})=>{
  const state=hero();delete state.cloudSync;
  await prepare(context,state);
  await cloudPage(page);
  await page.locator('#cloudSaveLocal').click();
  await expect(page.locator('#cloudFeedback')).toContainText('no matching cloud revision');
  expect(await page.evaluate(()=>window.cloudTest.updates.length)).toBe(0);
});

test('cloud restore pauses stale sheet writes; reload adopts the restored revision for the next save',async({context,page})=>{
  await prepare(context,hero());
  const sheet=await context.newPage();
  await sheet.goto('/index.html');
  await expect(sheet.locator('#charName')).toHaveValue('Phone hero');
  await cloudPage(page);
  await page.evaluate(()=>Object.assign(window.cloudTest.row.document.fields,{
    backstory:'Beyond the gate.\nA promise remains.',sessionNotes:'Cloud session notes 🗺️'
  }));
  await page.evaluate(()=>{window.cloudTest.row.document.consumables=[{id:'conscloudpotion',name:'Cloud potion',quantity:3,healingDice:'5',description:'Cloud reminder',futureItem:{kept:true}}];});
  await page.evaluate(()=>{window.cloudTest.row.document.rollHistory=[{id:'rollcloud',at:'2026-10-31T05:00:00.000Z',kind:'free',title:'Cloud roll',total:7,math:'1d6 (5) + 2',note:''}];});
  await page.evaluate(()=>{window.cloudTest.row.document.fields.hpCur='-2';window.cloudTest.row.document.over={hpMax:'20'};window.cloudTest.row.document.trauma=0;window.cloudTest.row.document.down={mercy:true,stable:true};});
  page.once('dialog',d=>d.accept());
  await page.locator('[data-cloud-action="restore"]').click();
  await expect(page.locator('#cloudFeedback')).toContainText('restored on this device');
  await expect(sheet.locator('#characterConflict')).toBeVisible();
  await sheet.locator('#charName').fill('Stale tab edit');
  await sheet.locator('#charName').blur();
  // Deliberately wait past the sheet's autosave debounce to expose stale writes.
  await sheet.waitForTimeout(400);
  expect((await saved(sheet)).fields.charName).toBe('Laptop level-up');
  expect((await saved(sheet)).cloudSync.revision).toBe(4);
  await openCharacterMenu(sheet);
  await sheet.locator('#characterReset > summary').click();
  await sheet.locator('#clearBtn').click();
  await sheet.locator('#clearYes').click();
  expect((await saved(sheet)).fields.charName).toBe('Laptop level-up');
  await sheet.locator('#reloadCharacter').click();
  await expect(sheet.locator('#charName')).toHaveValue('Laptop level-up');
  await sheet.locator('#charName').fill('Reviewed level-up');
  await sheet.locator('#charName').blur();
  await sheet.locator('[data-sheet-tab="notes"]').click();
  await expect(sheet.locator('#backstory')).toHaveValue('Beyond the gate.\nA promise remains.');
  await expect(sheet.locator('#sessionNotes')).toHaveValue('Cloud session notes 🗺️');
  await sheet.locator('#sessionNotes').fill('Reviewed cloud session notes\nNext: the lighthouse.');
  await expect.poll(async()=>(await saved(sheet)).fields.charName).toBe('Reviewed level-up');
  await expect.poll(async()=>(await saved(sheet)).fields.sessionNotes).toBe('Reviewed cloud session notes\nNext: the lighthouse.');
  await sheet.locator('[data-sheet-tab="equipment"]').click();
  await sheet.locator('[data-consumable-id="conscloudpotion"] [data-consumable-action="use"]').click();
  await sheet.locator('#toastActions [data-act="consumable-heal"]').click();await expect.poll(async()=>(await saved(sheet)).fields.hpCur).toBe('3');
  await sheet.locator('#toastClose').click();await expect.poll(async()=>(await saved(sheet)).consumables[0].quantity).toBe(2);
  await sheet.locator('[data-sheet-tab="dice"]').click();await expect(sheet.locator('#recentRollList')).toContainText('Cloud roll');
  await sheet.locator('#freeDiceExpression').fill('1d1+2');await sheet.locator('#freeDiceForm button[type="submit"]').click();await sheet.locator('#toastClose').click();
  await expect.poll(async()=>(await saved(sheet)).rollHistory.length).toBe(3);
  page.once('dialog',d=>d.accept());
  await page.locator('#cloudSaveLocal').click();
  await expect(page.locator('#cloudFeedback')).toContainText('saved privately');
  expect((await saved(page)).cloudSync.revision).toBe(5);
  expect(await page.evaluate(()=>window.cloudTest.row.document.fields.charName)).toBe('Reviewed level-up');
  expect(await page.evaluate(()=>window.cloudTest.row.document.fields.sessionNotes)).toBe('Reviewed cloud session notes\nNext: the lighthouse.');
  expect(await page.evaluate(()=>window.cloudTest.row.document.fields.backstory)).toBe('Beyond the gate.\nA promise remains.');
  expect(await page.evaluate(()=>window.cloudTest.row.document.consumables[0])).toMatchObject({quantity:2,healingDice:'5',futureItem:{kept:true}});
  expect(await page.evaluate(()=>window.cloudTest.row.document.rollHistory.length)).toBe(3);
  expect(await page.evaluate(()=>window.cloudTest.row.document.rollHistory[0].total)).toBe(3);
  expect(await page.evaluate(()=>window.cloudTest.row.document.fields.hpCur)).toBe('3');
  expect(await page.evaluate(()=>window.cloudTest.row.document.trauma)).toBe(1);
  expect(await page.evaluate(()=>window.cloudTest.row.document.down)).toBeNull();
});

test('malformed saved JSON cannot be overwritten by edits on a blank fallback sheet',async({page})=>{
  await page.addInitScript(key=>localStorage.setItem(key,'{unreadable character'),key);
  await page.goto('/index.html');
  await expect(page.locator('#characterConflict')).toBeVisible();
  await page.locator('#charName').fill('Replacement');
  await page.locator('#charName').blur();
  await page.waitForTimeout(400);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe('{unreadable character');
  const pending=page.waitForEvent('download');
  await page.locator('#downloadStoredCharacter').click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe('worlds-beyond-saved-data.json');
  const fs=require('node:fs');
  expect(fs.readFileSync(await download.path(),'utf8')).toBe('{unreadable character');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  page.once('dialog',d=>d.accept());
  await page.locator('#replaceUnreadableCharacter').click();
  await expect(page.locator('#characterConflict')).toBeHidden();
  expect((await saved(page)).fields.charName).toBe('Replacement');
});

test('a newly created cloud copy records its first revision only after success',async({context,page})=>{
  const state=hero();delete state.cloudSync;
  await prepare(context,state);
  await cloudPage(page);
  await page.evaluate(()=>{window.cloudTest.row=null;});
  await page.locator('#cloudReload').click();
  await expect(page.locator('#cloudCharacterList')).toContainText('No cloud characters');
  await page.locator('#cloudSaveLocal').click();
  await expect(page.locator('#cloudFeedback')).toContainText('saved privately');
  expect((await saved(page)).cloudSync.revision).toBe(1);
  expect(await page.evaluate(()=>window.cloudTest.row.document.cloudSync.revision)).toBe(1);
});

test('a successful upload does not overwrite edits made locally while it was pending',async({context,page})=>{
  await prepare(context,hero(4));
  await cloudPage(page);
  await page.evaluate(()=>{window.cloudTest.holdNext=true;});
  page.once('dialog',d=>d.accept());
  await page.locator('#cloudSaveLocal').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.cloudTest.release)).toBe('function');
  await page.evaluate(key=>{
    const state=JSON.parse(localStorage.getItem(key));
    state.fields.charName='New local edits';localStorage.setItem(key,JSON.stringify(state));
    window.cloudTest.release();
  },key);
  await expect(page.locator('#cloudFeedback')).toContainText('Cloud save succeeded, but another tab changed');
  expect((await saved(page)).fields.charName).toBe('New local edits');
  expect((await saved(page)).cloudSync.revision).toBe(4);
  expect(await page.evaluate(()=>window.cloudTest.row.revision)).toBe(5);
});

test('restore preserves edits made locally while the cloud fetch was pending',async({context,page})=>{
  await prepare(context,hero());
  await cloudPage(page);
  await page.evaluate(()=>{window.cloudTest.holdNext=true;});
  page.once('dialog',d=>d.accept());
  await page.locator('[data-cloud-action="restore"]').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.cloudTest.release)).toBe('function');
  await page.evaluate(key=>{
    const state=JSON.parse(localStorage.getItem(key));
    state.fields.charName='Keep this edit';localStorage.setItem(key,JSON.stringify(state));
    window.cloudTest.release();
  },key);
  await expect(page.locator('#cloudFeedback')).toContainText('changed in another tab');
  expect((await saved(page)).fields.charName).toBe('Keep this edit');
  expect((await saved(page)).cloudSync.revision).toBe(3);
});
