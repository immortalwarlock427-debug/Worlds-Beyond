const {test,expect}=require('@playwright/test');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
const fs=require('node:fs');
const key='worlds-beyond-sheet-v1';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6cyYAAAAASUVORK5CYII=';
const hero=()=>({
 id:'ctransacthero',fields:{charName:'Transaction Hero',level:'1',apMax:'15',mpCur:''},
 hist:{INT:{1:'16'},VIT:{1:'16'}},over:{},apAvail:null,apGiven:{n:3,fresh:true},showMana:true,
 abilities:[{id:'abilpulseone',name:'Pulse',favorite:true,apCost:5,resourceId:'resenergyone',resourceCost:10,
  uses:2,usesLeft:2,cooldown:2,duration:3,effects:[{id:'effboostone',target:'resource-max',resourceId:'resenergyone',value:100}]}],
 resources:[{id:'resenergyone',name:'Energy',max:100,current:80}],
 abilityLoadouts:[{id:'loadbeastone',name:'Beast',portraitId:'beastpic',entryApCost:4,entryResourceId:'resenergyone',entryResourceCost:20}],
 activeAbilityLoadoutId:'',formId:'basepic',portraits:[{id:'basepic',name:'Base',src:image},{id:'beastpic',name:'Beast',src:image}],
 items:[{id:'basehelm',type:'head',name:'Base helm',bonuses:[{t:'mp',v:8}]},{id:'beasthelm',type:'head',name:'Beast helm',bonuses:[{t:'mp',v:30}]}],
 equip:{head:'basehelm'},equipmentProfiles:{base:{head:'basehelm'},loadbeastone:{head:'beasthelm'}},
 cloudSync:{endpoint:'https://example.supabase.co',ownerId:'owner',revision:3},futureCharacter:{kept:true}
});
async function seed(page,state=hero()){
 await page.addInitScript(({key,state})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));},{key,state});
 await page.goto('/index.html');
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function flush(page,name){
 await page.locator('[data-sheet-tab="overview"]').click();
 await page.locator('#editCharacterDetails').click();
 await page.locator('#charName').fill(name);await page.locator('#charName').blur();
 await expect.poll(async()=>(await saved(page)).fields.charName).toBe(name);
}

test('favorite and library use share the full cost/charge/cooldown/effect transaction',async({page})=>{
 await seed(page);
 await page.locator('[data-favorite-use="abilpulseone"]').click();
 await expect(page.locator('#favoriteFeedback')).toContainText('Used Pulse');
 await expect.poll(async()=>(await saved(page)).resources[0].current).toBe(70);
 const paid=await saved(page);
 expect(paid.apAvail).toBe(13);expect(paid.apGiven.n).toBe(0);
 expect(paid.abilities[0].usesLeft).toBe(1);expect(paid.abilities[0].cooldownLeft).toBe(2);
 expect(paid.abilities[0].durationLeft).toBe(3);
 await expect(page.locator('#resourceList [role="progressbar"]')).toHaveAttribute('aria-valuemax','200');
 await page.locator('[data-sheet-tab="abilities"]').click();
 await page.locator('#abilityList .ability-quick-use').first().click();
 await expect(page.locator('#abilityFeedback')).toContainText('cooling down');
 await flush(page,'After rejected library use');
 const rejected=await saved(page);
 expect(rejected.resources[0].current).toBe(70);expect(rejected.apAvail).toBe(13);
 expect(rejected.abilities[0].usesLeft).toBe(1);expect(rejected.abilities[0].durationLeft).toBe(3);
 await openCharacterMenu(page);
 const download=page.waitForEvent('download');await page.locator('#exportBtn').click();
 const data=JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));
 expect(data.version).toBe(1);expect(data.state.cloudSync).toEqual(paid.cloudSync);
 expect(data.state.futureCharacter).toEqual({kept:true});
 await page.reload();
 await expect(page.locator('[data-favorite-id="abilpulseone"]')).toContainText('1/2 uses');
 expect((await saved(page)).resources[0].current).toBe(70);
});

test('a selector failure after private equipment edits cannot spend or leak any character changes',async({page})=>{
 await seed(page);
 await page.evaluate(()=>{
  const original=window.WBEquipment.switchForm;
  window.restoreEquipment=()=>{window.WBEquipment.switchForm=original;};
  window.WBEquipment.switchForm=(draft,destination)=>{
   original(draft,destination);
   draft.resources[0].current=0;draft.fields.mpCur='0';draft.abilities[0].usesLeft=0;
   return false;
  };
 });
 await page.locator('[data-sheet-tab="abilities"]').click();
 await page.locator('#abilityLoadoutSelect').selectOption('loadbeastone');
 await expect(page.locator('#abilityLoadoutFeedback')).toContainText('Could not switch forms');
 await expect(page.locator('#abilityLoadoutSelect')).toHaveValue('');
 await flush(page,'After rejected gear switch');
 let s=await saved(page);
 expect(s.activeAbilityLoadoutId).toBe('');expect(s.formId).toBe('basepic');expect(s.equip.head).toBe('basehelm');
 expect(s.equipmentProfiles.base.head).toBe('basehelm');expect(s.resources[0].current).toBe(80);
 expect(s.fields.mpCur).toBe('');expect(s.apAvail).toBeNull();expect(s.apGiven.n).toBe(3);
 expect(s.abilities[0].usesLeft).toBe(2);
 await page.evaluate(()=>window.restoreEquipment());
 await page.locator('[data-sheet-tab="abilities"]').click();
 await page.locator('#abilityLoadoutSelect').selectOption('loadbeastone');
 await expect.poll(async()=>(await saved(page)).activeAbilityLoadoutId).toBe('loadbeastone');
 s=await saved(page);
 expect(s.resources[0].current).toBe(60);expect(s.apAvail).toBe(14);expect(s.apGiven.n).toBe(0);
 expect(s.equip.head).toBe('beasthelm');expect(s.formId).toBe('beastpic');
});

test('portrait clicks reject low Mana, then commit one source-profile payment and return to Base free',async({page})=>{
 const state=hero();state.fields.mpCur='1';state.showMana=false;
 Object.assign(state.abilityLoadouts[0],{entryResourceId:'base-mana',entryResourceCost:6,manaMode:'hide'});
 await seed(page,state);
 await page.locator('#editCharacterDetails').click();
 await page.locator('.form-thumb[data-form="beastpic"]').click();
 await expect(page.locator('#toast')).toContainText('Not enough Mana');
 await flush(page,'After rejected portrait');
 let s=await saved(page);
 expect(s.formId).toBe('basepic');expect(s.activeAbilityLoadoutId).toBe('');
 expect(s.equip.head).toBe('basehelm');expect(s.apAvail).toBeNull();expect(s.fields.mpCur).toBe('1');
 await page.locator('#showManaPool').check();
 await page.locator('#mpCur').fill('');await page.locator('#mpCur').blur();
 await page.locator('#showManaPool').uncheck();
 await page.locator('#editCharacterDetails').click();
 await page.locator('.form-thumb[data-form="beastpic"]').click();
 await expect.poll(async()=>(await saved(page)).formId).toBe('beastpic');
 s=await saved(page);
 expect(s.fields.mpCur).toBe('14');expect(s.apAvail).toBe(14);expect(s.apGiven.n).toBe(0);
 expect(s.equip.head).toBe('beasthelm');expect(s.resources[0].current).toBe(80);
 await page.locator('.form-thumb[data-form="beastpic"]').click();
 await page.locator('.form-thumb[data-form="basepic"]').click();
 await expect.poll(async()=>(await saved(page)).activeAbilityLoadoutId).toBe('');
 s=await saved(page);
 expect(s.fields.mpCur).toBe('14');expect(s.apAvail).toBe(14);expect(s.equip.head).toBe('basehelm');
});

test('removing a portrait keeps it when the fallback form is unaffordable, then switches and unlinks together',async({page})=>{
 const state=hero();state.resources[0].current=1;
 await seed(page,state);
 await page.locator('#editCharacterDetails').click();
 await page.locator('#portraitClear').click();
 await expect(page.locator('#toast')).toContainText('Not enough Energy');
 await flush(page,'After rejected portrait removal');
 let s=await saved(page);
 expect(s.portraits).toHaveLength(2);expect(s.formId).toBe('basepic');expect(s.equip.head).toBe('basehelm');
 expect(s.apAvail).toBeNull();expect(s.resources[0].current).toBe(1);
 await page.locator('#toastClose').click();
 await page.locator('#resourceList [data-resource-prop="current"]').fill('80');
 await page.locator('#resourceList [data-resource-prop="current"]').blur();
 await page.locator('#editCharacterDetails').click();
 await page.locator('#portraitClear').click();
 await expect.poll(async()=>(await saved(page)).portraits.length).toBe(1);
 s=await saved(page);
 expect(s.formId).toBe('beastpic');expect(s.activeAbilityLoadoutId).toBe('loadbeastone');
 expect(s.equip.head).toBe('beasthelm');expect(s.apAvail).toBe(14);expect(s.resources[0].current).toBe(60);
 await page.locator('#portraitClear').click();
 await expect.poll(async()=>(await saved(page)).portraits.length).toBe(0);
 s=await saved(page);
 expect(s.formId).toBeNull();expect(s.activeAbilityLoadoutId).toBe('');expect(s.equip.head).toBe('basehelm');
 expect(s.apAvail).toBe(14);expect(s.resources[0].current).toBe(60);expect(s.abilityLoadouts[0].portraitId).toBe('');
});
