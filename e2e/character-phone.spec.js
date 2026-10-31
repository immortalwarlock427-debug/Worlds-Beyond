const {test,expect}=require('@playwright/test');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
const fs=require('node:fs');
const key='worlds-beyond-sheet-v1';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const hero=()=>({
  id:'cphonehero',fields:{charName:'Star Knight',hpCur:'24',apMax:'15'},hist:{VIT:{1:16}},
  over:{hpMax:'30'},resources:[{id:'resenergyone',name:'Energy',max:10,current:10}],
  abilityLoadouts:[{id:'loadmage123',name:'Mage'}],activeAbilityLoadoutId:'',
  abilities:[
    {id:'abilstarblade',name:'Star Blade',favorite:true,apCost:3,resourceId:'resenergyone',resourceCost:4,cooldown:2,uses:3,usesLeft:3},
    {id:'abilmageonly',name:'Mage only',favorite:true,apCost:1,loadoutIds:['loadmage123']},
    {id:'abilquietward',name:'Quiet Ward',favorite:true,type:'passive'}
  ]
});
async function seed(page,state=hero()){
  await page.addInitScript(({key,state})=>{
    if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));
  },{key,state});
  await page.goto('/index.html');
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const ability=state=>state.abilities.find(a=>a.id==='abilstarblade');

test('phone opens to Health, AP, reactions and a favorite with files/reset tucked away',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await seed(page);
  await expect(page.locator('#sheetCharacterName')).toHaveText('Star Knight');
  await expect(page.locator('#characterMenu')).not.toHaveAttribute('open');
  await expect(page.locator('#exportBtn')).toBeHidden();
  await expect(page.locator('#clearBtn')).toBeHidden();
  const favorite=page.locator('[data-favorite-use="abilstarblade"]');
  for(const selector of ['#hpCur','#apPips','#reactPips','[data-favorite-use="abilstarblade"]']){
    const box=await page.locator(selector).boundingBox();
    expect(box.y,selector).toBeGreaterThan(0);
    expect(box.y+box.height,selector).toBeLessThanOrEqual(844);
  }
  const box=await favorite.boundingBox();
  expect(await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('[data-favorite-use]')),
    {x:box.x+box.width/2,y:box.y+box.height/2})).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await expect(page.locator('#favoriteList')).not.toContainText('Mage only');
  await expect(page.locator('[data-favorite-id="abilquietward"] button')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('favorite activation shares AP/resource/charge/cooldown state with the library',async({page})=>{
  await seed(page);
  const use=page.locator('[data-favorite-use="abilstarblade"]');
  await use.click();
  await expect(page.locator('#favoriteFeedback')).toContainText('Used Star Blade');
  await expect(use).toBeFocused();
  await expect.poll(async()=>(await saved(page)).apAvail).toBe(12);
  let state=await saved(page);
  expect(state.resources[0].current).toBe(6);
  expect(ability(state).usesLeft).toBe(2);
  expect(ability(state).cooldownLeft).toBe(2);
  await use.click();
  await expect(page.locator('#favoriteFeedback')).toContainText('cooling down');
  await page.locator('#turnReset').click();
  await page.locator('#turnReset').click();
  await use.click();
  await expect.poll(async()=>(await saved(page)).resources[0].current).toBe(2);
  state=await saved(page);
  expect(state.apAvail).toBe(12,'turn start refills AP before the next activation');
  expect(ability(state).usesLeft).toBe(1);
  await page.locator('#turnReset').click();
  await page.locator('#turnReset').click();
  await use.click();
  await expect(page.locator('#favoriteFeedback')).toContainText('Not enough Energy');
  await page.locator('[data-sheet-tab="abilities"]').click();
  const card=page.locator('#abilityList .ability-item[data-ability-id="abilstarblade"]');
  await expect(card).toContainText('1/3 uses');
  expect((await saved(page)).resources[0].current).toBe(2);
  expect(ability(await saved(page)).usesLeft).toBe(1);
});

test('favorites ignore library search and switch with the existing form selector',async({page})=>{
  await seed(page);
  await page.locator('[data-sheet-tab="abilities"]').click();
  await page.locator('#abilitySearch').fill('Nothing matches this');
  await expect(page.locator('#abilityList')).toContainText('No abilities match');
  await page.locator('[data-sheet-tab="overview"]').click();
  await expect(page.locator('#favoriteList')).toContainText('Star Blade');
  await page.locator('[data-sheet-tab="abilities"]').click();
  await page.locator('#abilityLoadoutSelect').selectOption({label:'Mage'});
  await page.locator('[data-sheet-tab="overview"]').click();
  await expect(page.locator('#favoriteList')).toContainText('Mage only');
  await expect.poll(async()=>(await saved(page)).activeAbilityLoadoutId).toBe('loadmage123');
  await page.reload();
  await expect(page.locator('#favoriteList')).toContainText('Mage only');
});

test('character menu supports keyboard dismissal and separates reset from file import',async({page})=>{
  await seed(page);
  const summary=page.locator('#characterMenu > summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#exportBtn')).toBeVisible();
  await expect(page.locator('#importBtn')).toBeVisible();
  await expect(page.locator('#clearBtn')).toBeHidden();
  await page.locator('#exportBtn').focus();
  await page.keyboard.press('Escape');
  await expect(summary).toBeFocused();
  await expect(page.locator('#exportBtn')).toBeHidden();
  await openCharacterMenu(page);
  const pending=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const exported=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));
  expect(exported.format).toBe('worlds-beyond-character');
  expect(exported.version).toBe(1);
  expect(exported.state.id).toBe('cphonehero');
  await page.locator('#characterReset > summary').click();
  await page.locator('#clearBtn').click();
  await expect(page.locator('#clearConfirm')).toBeVisible();
  await expect(page.locator('#clearNo')).toBeFocused();
  await page.locator('#clearNo').click();
  expect((await saved(page)).id).toBe('cphonehero');
});

test('profile fields, healing and character reset still work through their visible controls',async({page})=>{
  await seed(page);
  await page.locator('#editCharacterDetails').click();
  await expect(page.locator('#charName')).toBeFocused();
  await page.locator('#charName').fill('Renamed Knight');
  await page.locator('#charName').blur();
  await expect(page.locator('#sheetCharacterName')).toHaveText('Renamed Knight');
  await page.locator('.health-details > summary').click();
  await page.locator('#hpAmt').fill('4');
  await page.locator('#hpHeal').click();
  await expect(page.locator('#hpCur')).toHaveValue('28');
  await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('28');
  await page.evaluate(()=>localStorage.setItem('worlds-beyond-game-v1',JSON.stringify({encounter:{id:'keep-dm-game'}})));
  await openCharacterMenu(page);
  await page.locator('#characterReset > summary').click();
  await page.locator('#clearBtn').click();
  await page.locator('#clearYes').click();
  expect(await saved(page)).toBeNull();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('worlds-beyond-game-v1')).encounter.id)).toBe('keep-dm-game');
});

test('secondary views remain reachable and returning from Battlemap restores the character tab',async({page})=>{
  await seed(page);
  await page.locator('[data-sheet-tab="abilities"]').click();
  await openCharacterMenu(page);
  await expect(page.locator('#characterMenu a[href="dm.html"]')).toBeVisible();
  await expect(page.locator('#characterMenu a[href="player.html"]')).toBeVisible();
  await page.locator('[data-view="map"]').click();
  await expect(page.locator('#mapSec')).toBeVisible();
  await expect(page.locator('#characterMenu')).not.toHaveAttribute('open');
  await openCharacterMenu(page);
  await page.locator('[data-view="sheet"]').click();
  await expect(page.locator('#abilitySection')).toBeVisible();
  await expect(page.locator('[data-sheet-tab="abilities"]')).toHaveAttribute('aria-pressed','true');
});

test('50 favorite abilities and long names stay within the phone width',async({page})=>{
  const state=hero();
  state.abilities=Array.from({length:50},(_,i)=>({id:'abilmany'+String(i).padStart(7,'0'),name:'Long custom ability '+i+' '+('Star'.repeat(15)),favorite:true,apCost:3}));
  await seed(page,state);
  await expect(page.locator('.favorite-ability')).toHaveCount(50);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});
