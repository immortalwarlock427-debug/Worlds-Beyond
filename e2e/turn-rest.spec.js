const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const key='worlds-beyond-sheet-v1',gameKey='worlds-beyond-game-v1';
const hero=()=>({id:'cturnresthero',fields:{charName:'Rest Hero',level:'1',hpCur:'-3',mpCur:'2',sessionNotes:'Before'},
 hist:{VIT:{1:'16'},INT:{1:'16'},AGL:{1:'21'}},over:{hpMax:'30',mpMax:'20'},
 inCombat:true,apAvail:0,reactAvail:0,apGiven:{n:4,fresh:true},wonderAvail:0,parryUsed:true,parryOutsideSpent:2,
 trauma:1,down:{mercy:true,stable:false},
 abilities:[{id:'abilrestboost',name:'Boost',favorite:true,type:'active',uses:2,usesLeft:0,usesPer:'round',outsideUsesSpent:2,
  cooldown:3,cooldownLeft:2,duration:2,durationLeft:1,effects:[{target:'resource-max',resourceId:'resrestenergy',value:100},{target:'movement',value:15}]}],
 resources:[{id:'resrestenergy',name:'Energy',max:100,current:150,regen:5,refillOnRest:true},
  {id:'resreststock',name:'Stock',max:30,current:2,regen:0,refillOnRest:false}],
 statuses:[{id:'stsresttimed',name:'Timed',remaining:1},{id:'stsrestforever',name:'Ongoing',remaining:null}],
 items:[{id:'helm',name:'Rest helm',type:'head',abilities:[{name:'Flash',uses:2,per:'round'}]}],equip:{head:'helm'},spent:{helm:{0:1}},
 consumables:[{id:'potion',name:'Potion',quantity:2}]});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function seed(page,state=hero()){
 await page.addInitScript(({key,gameKey,state})=>{
  if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));
  if(localStorage.getItem(gameKey)===null)localStorage.setItem(gameKey,JSON.stringify({tokens:{},foes:[],future:{kept:true}}));
 },{key,gameKey,state});
 await page.goto('/index.html');
 await page.evaluate(()=>{window.transitionCalls=[];const apply=window.WBCharacter.apply;window.WBCharacter.apply=(state,command)=>{
  window.transitionState=state;window.transitionCalls.push(command.type);return apply(state,command);
 };});
}
const tab=(page,name)=>page.locator('[data-sheet-tab="'+name+'"]').click();
test('phone turn commits one command with post-expiry resource/movement, timers and one bleeding application',async({page})=>{
 await seed(page);const game=await page.evaluate(key=>localStorage.getItem(key),gameKey);
 await page.locator('#turnReset').click();await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('-7');
 const s=await saved(page);expect(s.resources[0].current).toBe(100);expect(s.abilities[0].durationLeft).toBe(0);expect(s.abilities[0].cooldownLeft).toBe(1);
 expect(s.abilities[0].usesLeft).toBe(2);expect(s.abilities[0].outsideUsesSpent).toBe(2);expect(s.apGiven).toEqual({n:4,fresh:false});
 expect(s.statuses.map(s=>s.name)).toEqual(['Ongoing']);expect(s.spent.helm).toBeUndefined();expect(s.consumables[0].quantity).toBe(2);
 await expect(page.locator('#toastTitle')).toHaveText('Dying');await expect(page.locator('#toastMath')).toContainText('Lost 4');
 expect(await page.evaluate(()=>window.transitionCalls)).toEqual(['StartTurn']);expect(await page.evaluate(key=>localStorage.getItem(key),gameKey)).toBe(game);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.locator('#toastClose').click();await page.locator('#turnReset').click();await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('-11');expect((await saved(page)).apGiven).toBeNull();
});
test('late failure leaves the saved character unchanged and does not publish partial turn resets',async({page})=>{
 await seed(page);const before=await saved(page);
 await page.evaluate(()=>{window.WBStatus.advanceTurn=s=>{s.statuses[0].remaining=99;throw Error('test failure');};});
 await page.locator('#turnReset').click();await expect(page.locator('#toastMath')).toContainText('Nothing changed');
 await page.waitForTimeout(350);expect(await saved(page)).toEqual(before);await expect(page.locator('#hpCur')).toHaveValue('-3');
 await page.reload();await expect(page.locator('#hpCur')).toHaveValue('-3');expect((await saved(page)).resources[0].current).toBe(150);
});
test('long rest uses state maxima even when displayed values are stale and refills hidden Mana without inventing recovery Trauma',async({page})=>{
 const state=hero();state.showMana=false;await seed(page,state);
 await page.evaluate(()=>{document.getElementById('hpMax').value='999';document.getElementById('mpMax').value='777';});
 await page.locator('#longRest').click();await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('30');
 const s=await saved(page);expect(s.fields.mpCur).toBe('20');expect(s.trauma).toBe(0);expect(s.down).toBeNull();expect(s.wonderAvail).toBeNull();
 expect(s.apGiven).toBeNull();expect(s.apAvail).toBeNull();expect(s.reactAvail).toBeNull();expect(s.parryOutsideSpent).toBe(0);
 expect(s.resources.map(r=>r.current)).toEqual([100,2]);expect(s.abilities[0].cooldownLeft).toBe(0);expect(s.abilities[0].durationLeft).toBe(0);
 expect(s.settled).toBeUndefined();expect(s.statuses).toHaveLength(2);expect(s.inCombat).toBe(true);expect(s.consumables[0].quantity).toBe(2);
 expect(await page.evaluate(()=>window.transitionCalls)).toEqual(['LongRest']);await expect(page.locator('#manaPool')).toBeHidden();
 await page.locator('#toastActions [data-act="undo"]').click();await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('-3');
 expect((await saved(page)).down).toEqual({mercy:true,stable:false});expect((await saved(page)).resources[0].current).toBe(150);expect((await saved(page)).settled).toBeUndefined();
 expect(await page.evaluate(()=>window.transitionCalls)).toEqual(['LongRest','UndoLongRest']);
});
test('rest Undo keeps later phone notes, quantity corrections and manual statuses while restoring rest trackers',async({page})=>{
 await seed(page);await page.locator('#longRest').click();await expect(page.locator('#toastTitle')).toHaveText('Long rest');
 // Rest owns these complete records; restore them exactly while preserving
 // the live editor objects and unrelated later character edits.
 await page.evaluate(()=>{window.transitionState.abilities[0].laterField=true;window.transitionState.resources[0].laterField=true;});
 await tab(page,'notes');await page.locator('#sessionNotes').fill('After the rest\nKeep this note');await expect.poll(async()=>(await saved(page)).fields.sessionNotes).toBe('After the rest\nKeep this note');
 await tab(page,'equipment');await page.locator('[data-consumable-id="potion"] [data-quantity-committed]').fill('1');await page.locator('[data-consumable-id="potion"] [data-quantity-committed]').blur();
 await tab(page,'statuses');await page.locator('#statusName').fill('New condition');await page.locator('#statusName').press('Enter');
 await page.locator('#toastActions [data-act="undo"]').click();await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('-3');
 const s=await saved(page);expect(s.fields.sessionNotes).toBe('After the rest\nKeep this note');expect(s.consumables[0].quantity).toBe(1);
 expect(s.statuses.map(s=>s.name)).toEqual(['Timed','Ongoing','New condition']);expect(s.trauma).toBe(1);expect(s.abilities[0].durationLeft).toBe(1);
 expect(s.abilities[0].laterField).toBeUndefined();expect(s.resources[0].laterField).toBeUndefined();
 await page.reload();expect((await saved(page)).fields.sessionNotes).toContain('Keep this note');expect((await saved(page)).consumables[0].quantity).toBe(1);
});
test('late rest failure publishes no refill or Undo receipt',async({page})=>{
 await seed(page);const before=await saved(page);await page.evaluate(()=>{window.WBAbilities.resetForRest=s=>{s.abilities[0].usesLeft=2;throw Error('test failure');};});
 await page.locator('#longRest').click();await expect(page.locator('#toastMath')).toContainText('Nothing changed');await expect(page.locator('#toastActions [data-act="undo"]')).toHaveCount(0);
 await page.waitForTimeout(350);expect(await saved(page)).toEqual(before);
});
test('status turn shortcut runs one shared transaction and rest receipts stay out of v1 exports/reload',async({page})=>{
 const state=hero();state.down.stable=true;await seed(page,state);await tab(page,'statuses');await page.locator('#statusNextTurn').click();
 await expect.poll(async()=>(await saved(page)).abilities[0].durationLeft).toBe(0);expect((await saved(page)).fields.hpCur).toBe('-3');
 expect(await page.evaluate(()=>window.transitionCalls)).toEqual(['StartTurn']);await tab(page,'overview');await page.locator('#longRest').click();
 await page.locator('#toastClose').click();await openCharacterMenu(page);const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();
 const file=JSON.parse(fs.readFileSync(await(await pending).path(),'utf8'));expect(file.version).toBe(1);expect(file.state.fields.hpCur).toBe('30');expect(file.state.restReceipt).toBeUndefined();
 await page.reload();await expect(page.locator('#hpCur')).toHaveValue('30');await expect(page.locator('#toastActions [data-act="undo"]')).toHaveCount(0);
});
