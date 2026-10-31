const {test,expect}=require('@playwright/test');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
const fs=require('node:fs');
const key='worlds-beyond-sheet-v1';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const hero=()=>({
 id:'capmanahero',fields:{charName:'Pool Tester',level:'3',apMax:'15',mpCur:''},
 hist:{INT:{1:'16'},FTH:{1:'13'},VIT:{1:'16'}},over:{},apAvail:null,apGiven:{n:3,fresh:true},
 abilities:[{id:'abilmanatest',name:'Starfire',favorite:true,apCost:5,resourceId:'base-mana',resourceCost:6,uses:3,usesLeft:3}],
 resources:[],showMana:true,cloudSync:{endpoint:'https://example.supabase.co',ownerId:'example-owner',revision:3}
});
async function seed(page,state=hero()){
 await page.addInitScript(({key,state})=>{
  if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));
 },{key,state});
 await page.goto('/index.html');
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const use=page=>page.locator('[data-favorite-use="abilmanatest"]');
async function flushRejectedSave(page){
 // A later ordinary edit must preserve all rejected-payment balances as well.
 await page.locator('#editCharacterDetails').click();
 await page.locator('#charName').fill('After rejected ability');
 await page.locator('#charName').blur();
 await expect.poll(async()=>(await saved(page)).fields.charName).toBe('After rejected ability');
}

test('favorite pays blank/full Mana and Command AP once, then survives export and reload',async({page})=>{
 await seed(page);
 await expect(page.locator('#mpMax')).toHaveValue('80');
 await expect(page.locator('#mpCur')).toHaveValue('');
 await use(page).click();
 await expect(page.locator('#favoriteFeedback')).toContainText('Used Starfire');
 await expect.poll(async()=>(await saved(page)).fields.mpCur).toBe('74');
 const state=await saved(page);
 expect(state.apAvail).toBe(13);expect(state.apGiven.n).toBe(0);
 expect(state.abilities[0].usesLeft).toBe(2);
 await expect(page.locator('#mpCur')).toHaveValue('74');
 await expect(page.locator('#apCount')).toContainText('13/15 AP');
 await openCharacterMenu(page);
 const pending=page.waitForEvent('download');
 await page.locator('#exportBtn').click();
 const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));
 expect(exported.version).toBe(1);expect(exported.state.fields.mpCur).toBe('74');
 expect(exported.state.cloudSync).toEqual(state.cloudSync);
 await page.reload();
 await expect(page.locator('#mpCur')).toHaveValue('74');
 await expect(page.locator('#apCount')).toContainText('13/15 AP');
});

for(const [label,apAvail,given,mpCur,message] of [
 ['AP',1,1,'20','Not enough AP'],['Mana',null,3,'2','Not enough Mana']
])test('insufficient '+label+' rejects the entire ability payment and retains charges',async({page})=>{
 const s=hero();s.apAvail=apAvail;s.apGiven={n:given,fresh:true};s.fields.mpCur=mpCur;
 await seed(page,s);
 await use(page).click();
 await expect(page.locator('#favoriteFeedback')).toContainText(message);
 await flushRejectedSave(page);
 const after=await saved(page);
 expect(after.apAvail).toBe(apAvail);expect(after.apGiven.n).toBe(given);
 expect(after.fields.mpCur).toBe(mpCur);expect(after.abilities[0].usesLeft).toBe(3);
 expect(after.abilities[0].cooldownLeft).toBe(0);
});

test('payment uses character data even when displayed pool values are stale',async({page})=>{
 await seed(page);
 await page.evaluate(()=>{
  document.querySelector('#apMax').value='40';
  document.querySelector('#mpMax').value='999';
  document.querySelector('#mpCur').value='999';
 });
 await use(page).click();
 await expect.poll(async()=>(await saved(page)).fields.mpCur).toBe('74');
 expect((await saved(page)).apAvail).toBe(13);
 await expect(page.locator('#mpMax')).toHaveValue('80');
 await expect(page.locator('#mpCur')).toHaveValue('74');
 await expect(page.locator('#apMax')).toHaveValue('15');
});

test('form entry pays from the old gear profile while preserving hidden Mana and linked portrait',async({page})=>{
 const s=hero();s.fields.level='1';s.apGiven=null;s.showMana=false;
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6cyYAAAAASUVORK5CYII=';
 s.portraits=[{id:'pbase',name:'Base',src:image},{id:'pmage',name:'Mage',src:image}];s.formId='pbase';
 s.items=[{id:'basehelm',type:'head',name:'Base helm',bonuses:[{t:'mp',v:8}]},
          {id:'formhelm',type:'head',name:'Mage helm',bonuses:[{t:'mp',v:30}]}];
 s.equip={head:'basehelm'};s.equipmentProfiles={base:{head:'basehelm'},loadmageform:{head:'formhelm'}};
 s.abilityLoadouts=[{id:'loadmageform',name:'Mage',portraitId:'pmage',manaMode:'hide',entryApCost:4,entryResourceId:'base-mana',entryResourceCost:6}];
 await seed(page,s);
 await expect(page.locator('#manaPool')).toBeHidden();
 await page.locator('[data-sheet-tab="abilities"]').click();
 await page.locator('#abilityLoadoutSelect').selectOption('loadmageform');
 await expect.poll(async()=>(await saved(page)).activeAbilityLoadoutId).toBe('loadmageform');
 let state=await saved(page);
 expect(state.apAvail).toBe(11);expect(state.fields.mpCur).toBe('72');
 expect(state.equip.head).toBe('formhelm');expect(state.formId).toBe('pmage');
 await page.locator('#abilityLoadoutSelect').selectOption('loadmageform');
 await page.locator('#abilityLoadoutSelect').selectOption('');
 await expect.poll(async()=>(await saved(page)).activeAbilityLoadoutId).toBe('');
 state=await saved(page);
 expect(state.fields.mpCur).toBe('50');expect(state.apAvail).toBe(11);expect(state.equip.head).toBe('basehelm');
 await page.locator('[data-sheet-tab="overview"]').click();
 await expect(page.locator('#manaPool')).toBeHidden();
 await page.locator('#showManaPool').check();
 await expect(page.locator('#mpCur')).toHaveValue('50');
 await expect(page.locator('#mpMax')).toHaveValue('56');
});

test('manual Mana corrections, maximum override and Holy Power retain their existing behavior',async({page})=>{
 await seed(page);
 await page.locator('#mpCur').fill('40');
 await page.locator('#mpCur').blur();
 await use(page).click();
 await expect(page.locator('#mpCur')).toHaveValue('34');
 await page.locator('#mpMax').fill('20');
 await page.locator('#mpMax').blur();
 await page.locator('#mpCur').fill('');
 await page.locator('#mpCur').blur();
 await use(page).click();
 await expect.poll(async()=>(await saved(page)).fields.mpCur).toBe('14');
 await page.locator('#mpCur').fill('-3');
 await page.locator('#mpCur').blur();
 await expect.poll(async()=>(await saved(page)).fields.mpCur).toBe('-3');
 const before=(await saved(page)).apAvail;
 await use(page).click();
 await expect(page.locator('#favoriteFeedback')).toContainText('Not enough Mana');
 await flushRejectedSave(page);
 expect((await saved(page)).apAvail).toBe(before);
 expect((await saved(page)).fields.mpCur).toBe('-3');
 await page.locator('#manaPool [data-kind="holy"]').click();
 await expect(page.locator('#manaName')).toHaveText('Holy Power');
 await expect(page.locator('#mpMax')).toHaveValue('20');
 await page.locator('#mpMax').fill('');
 await page.locator('#mpMax').blur();
 await expect(page.locator('#mpMax')).toHaveValue('65');
 await expect(page.locator('#mpCur')).toHaveValue('42');
});
