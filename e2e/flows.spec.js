const {test, expect} = require('@playwright/test');

// These are real browser interactions on a locally served copy of Worlds Beyond.
// Each test has a fresh Playwright context (including localStorage and cookies).
const character = async page => page.evaluate(() =>
  JSON.parse(localStorage.getItem('worlds-beyond-sheet-v1') || 'null'));
const game = async page => page.evaluate(() =>
  JSON.parse(localStorage.getItem('worlds-beyond-game-v1') || 'null'));
const tab = async (page,name) => page.locator('[data-sheet-tab="'+name+'"]').click();
const settled = (page,read,match) =>
  expect.poll(async()=>match(await read(page)),{timeout:8000}).toBe(true);
async function createExport(page,name='Browser Test Hero'){
  await page.goto('/index.html');
  await page.locator('#charName').fill(name);
  await page.locator('#charName').blur();
  await settled(page,character,s=>s?.fields?.charName===name);
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  return (await downloadPromise).path();
}
async function createForm(page,name){
  await tab(page,'abilities');
  await page.locator('#abilityLoadoutName').fill(name);
  await page.locator('#abilityLoadoutAdd').click();
  await page.locator('#abilityLoadoutSelect').selectOption({label:name});
  await expect(page.locator('#abilityLoadoutSelect')).toHaveValue(/.+/);
  return page.locator('#abilityLoadoutSelect').inputValue();
}
async function addAbility(page,name,ap,cooldown=0){
  await tab(page,'abilities');
  await page.locator('#abilityAdd').click();
  const card=page.locator('#abilityList .ability-item').last();
  await card.locator('[data-ability-prop="name"]').fill(name);
  await card.locator('[data-ability-prop="name"]').blur();
  await card.locator('[data-ability-prop="apCost"]').fill(String(ap));
  await card.locator('[data-ability-prop="apCost"]').blur();
  if(cooldown){
    await card.locator('[data-ability-prop="cooldown"]').fill(String(cooldown));
    await card.locator('[data-ability-prop="cooldown"]').blur();
  }
  return card;
}

test('custom resource: add, spend, restore, and save after a refresh',async({page})=>{
  await page.goto('/index.html');
  await page.locator('#addResource').click();
  const card=page.locator('#resourceList .custom-resource').first();
  await card.locator('[data-resource-prop="name"]').fill('Star Energy');
  await card.locator('[data-resource-prop="name"]').blur();
  await card.locator('[data-resource-amount]').fill('7');
  await card.locator('[data-resource-action="spend"]').click();
  await expect(card.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow','93');
  await card.locator('[data-resource-amount]').fill('4');
  await card.locator('[data-resource-action="restore"]').click();
  await expect(card.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow','97');
  await settled(page,character,s=>s?.resources?.[0]?.current===97);
  await page.reload();
  await expect(page.locator('#resourceList .custom-resource').first().locator('[data-resource-prop="name"]')).toHaveValue('Star Energy');
  await expect(page.locator('#resourceList [role="progressbar"]').first()).toHaveAttribute('aria-valuenow','97');
});

test('ability: editing AP and cooldown, Use spends AP, start turn decrements cooldown',async({page})=>{
  await page.goto('/index.html');
  await page.locator('#charName').fill('Ability Tester');
  await page.locator('#charName').blur();
  await addAbility(page,'Meteor Barrage',3,2);
  await expect(page.locator('#abilityList')).toContainText('Meteor Barrage');
  await settled(page,character,s=>Boolean(s&&s.abilities&&s.abilities.length===1));
  // The AP tracker belongs to Overview, so navigate there for the real click.
  await tab(page,'overview');
  await page.locator('#turnReset').click();
  await settled(page,character,s=>s?.apAvail===15);
  await tab(page,'abilities');
  const before=await character(page);
  const apBefore=before.apAvail;
  await page.locator('#abilityList .ability-item').first().locator('[data-ability-action="use"]').first().click();
  await settled(page,character,s=>s?.abilities?.[0]?.cooldownLeft===2);
  const used=await character(page);
  expect(used.apAvail).toBe(apBefore-3);
  await tab(page,'overview');
  await page.locator('#turnReset').click();
  await settled(page,character,s=>s?.abilities?.[0]?.cooldownLeft===1);
  await page.locator('#turnReset').click();
  await settled(page,character,s=>s?.abilities?.[0]?.cooldownLeft===0);
});

test('two forms retain distinct ability, resource and worn gear profiles',async({page})=>{
  await page.goto('/index.html');
  const warrior=await createForm(page,'Warrior');
  await addAbility(page,'Shield Bash',2);
  await tab(page,'overview');
  await page.locator('#addResource').click();
  const resource=page.locator('#resourceList .custom-resource').first();
  await resource.locator('[data-resource-prop="name"]').fill('Guard Points');
  await resource.locator('[data-resource-prop="name"]').blur();
  await tab(page,'equipment');
  await page.locator('#forgeName').fill('Warrior Helm');
  await page.locator('#forgeAr').fill('3');
  await page.locator('#forgeSubmit').click();
  await page.locator('#pack .card').filter({hasText:'Warrior Helm'}).click();
  await page.locator('.slot[data-drop="slot"][data-slot="head"]').click();
  await settled(page,character,s=>Boolean(s?.equip?.head));
  const warriorGear=(await character(page)).equip.head;
  const mage=await createForm(page,'Mage');
  await addAbility(page,'Arcane Spark',2);
  await tab(page,'overview');
  await page.locator('#addResource').click();
  const mageRes=page.locator('#resourceList .custom-resource').first();
  await mageRes.locator('[data-resource-prop="name"]').fill('Spell Charges');
  await mageRes.locator('[data-resource-prop="name"]').blur();
  await settled(page,character,s=>s?.resources?.length===2);
  await tab(page,'abilities');
  await expect(page.locator('#abilityList')).toContainText('Arcane Spark');
  await expect(page.locator('#abilityList')).not.toContainText('Shield Bash');
  await tab(page,'equipment');
  // New forms deliberately inherit the currently worn gear. Explicitly
  // unequip Mage's gear to verify independent form profiles.
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#equipmentClearForm').click();
  await settled(page,character,s=>!s?.equip?.head);
  expect((await character(page)).equip.head||'').not.toBe(warriorGear);
  await tab(page,'abilities');
  await page.locator('#abilityLoadoutSelect').selectOption(warrior);
  await tab(page,'overview');
  // Input values are not text nodes; check the actual visible input and form.
  const visibleResource=page.locator('#resourceList .custom-resource [data-resource-prop="name"]');
  await expect(visibleResource).toHaveCount(1);
  await expect(visibleResource).toHaveValue('Guard Points');
  await tab(page,'equipment');
  expect((await character(page)).equip.head).toBe(warriorGear);
  await tab(page,'abilities');
  await expect(page.locator('#abilityList')).toContainText('Shield Bash');
  await expect(page.locator('#abilityList')).not.toContainText('Arcane Spark');
  expect(warrior).not.toBe(mage);
});

test('manual timed status expires after two actual Start of my turn clicks',async({page})=>{
  await page.goto('/index.html#sheet/statuses');
  await page.locator('#statusName').fill('Blessed by Stars');
  await page.locator('#statusDuration').fill('2');
  await page.locator('#statusAddForm button[type="submit"]').click();
  await expect(page.locator('#statusManualList')).toContainText('Blessed by Stars');
  await expect(page.locator('#statusManualList')).toContainText('2 turns left');
  await page.locator('#statusNextTurn').click();
  await expect(page.locator('#statusManualList')).toContainText('1 turn left');
  await page.locator('#statusNextTurn').click();
  await expect(page.locator('#statusManualList')).not.toContainText('Blessed by Stars');
});

test('exported character JSON can be imported back through the file picker',async({page})=>{
  const path=await createExport(page,'Export Hero');
  await page.locator('#charName').fill('Unsaved Replacement');
  await page.locator('#charName').blur();
  await page.locator('#importFile').setInputFiles(path);
  await expect(page.locator('#importConfirm')).toBeVisible();
  await page.locator('#importYes').click();
  await expect(page.locator('#charName')).toHaveValue('Export Hero');
  await settled(page,character,s=>s?.fields?.charName==='Export Hero');
});

test('DM imports an exported character, starts combat, moves token and charges AP',async({page})=>{
  const exportPath=await createExport(page,'DM Test Hero');
  await page.goto('/dm.html');
  await page.locator('#dmCharacterFiles').setInputFiles(exportPath);
  await page.locator('#dmImport').click();
  await expect(page.locator('#dmActorList')).toContainText('DM Test Hero');
  await page.locator('#dmMapBoard').click({position:{x:3*36+10,y:3*36+10}});
  await settled(page,game,g=>Boolean(g?.encounter?.actors && Object.values(g.encounter.actors)[0]?.mapId));
  await page.locator('#startEncounter').click();
  await expect(page.locator('#turnHeading')).toContainText('DM Test Hero');
  await page.locator('#dmMapBoard').click({position:{x:5*36+10,y:3*36+10}});
  await expect(page.locator('#dmMovePreview')).toBeVisible();
  await page.locator('#dmMoveConfirm').click();
  await settled(page,game,g=>Boolean(g?.encounter?.actors &&
    Object.values(g.encounter.actors)[0]?.x===5));
  const actor=Object.values((await game(page)).encounter.actors)[0];
  expect(actor.apAvail).toBeLessThan(actor.apMax);
  expect(actor.x).toBe(5);
});

for(const path of ['/index.html','/index.html#map','/dm.html','/player.html','/cloud.html']){
  test('390px viewport does not scroll the document sideways: '+path,async({browser})=>{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const phone=await context.newPage();
    await phone.goto(path);
    const result=await phone.evaluate(()=>({
      viewport:document.documentElement.clientWidth,
      doc:document.documentElement.scrollWidth,
      body:document.body.scrollWidth,
      width:window.innerWidth
    }));
    expect(result.doc,JSON.stringify(result)).toBeLessThanOrEqual(result.width+1);
    await context.close();
  });
}
