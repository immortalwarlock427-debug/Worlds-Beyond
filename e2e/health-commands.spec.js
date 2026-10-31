const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {openCharacterMenu}=require('./helpers/sheet.cjs');
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const key='worlds-beyond-sheet-v1',gameKey='worlds-beyond-game-v1';
const hero=()=>({id:'chealthhero',fields:{charName:'Health Hero',level:'1',hpCur:'10',mpCur:'5',concOn:'1'},hist:{VIT:{1:'16'},INT:{1:'16'}},
 over:{hpMax:'20'},trauma:0,down:null,apAvail:7,reactAvail:1,abilities:[],resources:[{id:'reshealthenergy',name:'Energy',max:20,current:7}],
 items:[{id:'helm',name:'Helm',type:'head',ar:3,abilities:[],effects:[{k:'res',dt:'Fire'}]}],equip:{head:'helm'},
 consumables:[{id:'potion',name:'Potion',quantity:3,healingDice:'5'}]});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function seed(page,state=hero()){
 await page.addInitScript(({key,gameKey,state})=>{
  if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(state));
  if(localStorage.getItem(gameKey)===null)localStorage.setItem(gameKey,JSON.stringify({futureGame:{kept:true},tokens:{},foes:[]}));
  crypto.getRandomValues=array=>{array[0]=19;return array;};
 },{key,gameKey,state});
 await page.goto('/index.html');
 await page.evaluate(()=>{window.healthCalls=[];const apply=window.WBCharacter.apply;window.WBCharacter.apply=(state,command)=>{
  if(command.type.includes('Health'))window.healthCalls.push({...command});const result=apply(state,command);if(command.type==='StartTurn')window.healthTurnResult=result;return result;
 };});
}
async function close(page){await page.locator('#toastClose').click();}
async function tab(page,name){await page.locator('[data-sheet-tab="'+name+'"]').click();}
async function recovery(page){if(!await page.locator('.health-details').evaluate(el=>el.open))await page.locator('.health-details > summary').click();}
async function heal(page,amount){await recovery(page);await page.locator('#hpAmt').fill(String(amount));await page.locator('#hpHeal').click();}
async function hit(page,amount,noArmor=true){await page.locator('#incDmg').fill(String(amount));if(noArmor)await page.locator('#incNoAr').check();await page.locator('#takeHit').click();}

test("Health commands receive final damage once and preserve resistance, armor, Death's Mercy and bleeding",async({page})=>{
 await seed(page);const gameBefore=await page.evaluate(key=>localStorage.getItem(key),gameKey);
 await page.locator('#incType').fill('Fire');await hit(page,13,false);
 await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('9');
 expect(await page.evaluate(()=>window.healthCalls.filter(c=>c.type==='DamageHealth').at(-1).amount)).toBe(1);
 await close(page);await hit(page,100);await expect(page.locator('#toastNote')).toContainText("Death's Mercy");
 await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('-8');await expect(page.locator('#toastActions [data-act="conc"]')).toContainText('DC 50');await close(page);
 await hit(page,4);await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('-12');await close(page);
 await page.locator('#turnReset').click();await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('-16');
 await expect(page.locator('#toastActions [data-act="conc"]')).toHaveCount(0);expect(await page.evaluate(()=>window.healthTurnResult.events.filter(e=>e.type==='health.damaged').map(e=>({source:e.source,amount:e.amount})))).toEqual([{source:'bleeding',amount:4}]);await close(page);
 await page.locator('#turnReset').click();await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('-20');await expect(page.locator('#dyingTitle')).toHaveText('Dead');
 expect((await saved(page)).down.mercy).toBe(true);expect((await saved(page)).resources[0].current).toBe(7);expect(await page.evaluate(key=>localStorage.getItem(key),gameKey)).toBe(gameBefore);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});

test('healing reads the saved maximum even if a displayed input is stale; manual corrections stay unrestricted and blank means full',async({page})=>{
 await seed(page);await page.locator('#hpCur').fill('19');await page.locator('#hpCur').blur();await recovery(page);await page.locator('#hpAmt').fill('10');
 await page.evaluate(()=>{document.getElementById('hpMax').value='999';});await page.locator('#hpHeal').click();
 await expect(page.locator('#hpCur')).toHaveValue('20');await close(page);
 await page.locator('#hpCur').fill('40');await page.locator('#hpCur').blur();await page.locator('#hpMax').fill('30');await page.locator('#hpMax').blur();
 await expect(page.locator('#hpCur')).toHaveValue('40');await page.locator('#hpCur').fill('');await page.locator('#hpCur').blur();await expect(page.locator('#hpCur')).toHaveAttribute('placeholder','30');
 await page.locator('#hpMax').fill('');await page.locator('#hpMax').blur();await expect(page.locator('#hpMax')).toHaveValue('16');await expect(page.locator('#hpCur')).toHaveValue('');
 await page.locator('#hpCur').fill('-30');await page.locator('#hpCur').blur();await expect(page.locator('#dyingTitle')).toHaveText('Dead');
 await page.locator('#hpCur').fill('5');await page.locator('#hpCur').blur();await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('5');expect((await saved(page)).trauma).toBe(0);
 const types=await page.evaluate(()=>window.healthCalls.map(c=>c.type));expect(types).toContain('HealHealth');expect(types).toContain('SetHealthCurrent');expect(types).toContain('SetHealthMaximum');
});

test('Indomitable, manual stability, treatment and Trauma buttons use Health commands with the current recovery rules',async({page})=>{
 const state=hero();state.hist.VIT={1:21};state.fields.hpCur='1';await seed(page,state);await hit(page,100);
 await expect(page.locator('#toastActions [data-act="indom"]')).toBeVisible();await page.locator('#toastActions [data-act="indom"]').click();
 await expect.poll(async()=>(await saved(page)).down.stable).toBe(true);await close(page);
 const before=(await saved(page)).fields.hpCur;await page.locator('#turnReset').click();expect((await saved(page)).fields.hpCur).toBe(before);
 await page.locator('#stableOn').uncheck();await page.locator('#treatedBtn').click();
 await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('1');expect((await saved(page)).trauma).toBe(1);expect((await saved(page)).down).toBeNull();await close(page);
 await recovery(page);await page.locator('#traumaUp').click();await expect(page.locator('#traumaN')).toHaveText('2');await page.locator('#traumaDown').click();
 await expect.poll(async()=>(await saved(page)).trauma).toBe(1);expect((await saved(page)).fields.hpCur).toBe('1');
 const calls=await page.evaluate(()=>window.healthCalls);expect(calls.some(c=>c.type==='SetHealthStability'&&c.source==='indomitable')).toBe(true);expect(calls.some(c=>c.type==='TreatHealth')).toBe(true);expect(calls.filter(c=>c.type==='SetHealthTrauma')).toHaveLength(2);
});

test('potion and ordinary healing share one command path and a potion result applies only once',async({page})=>{
 const state=hero();state.fields.hpCur='-2';state.down={mercy:true,stable:false,futureDown:{kept:true}};await seed(page,state);
 await tab(page,'equipment');await page.locator('[data-consumable-id="potion"] [data-consumable-action="use"]').click();
 await page.locator('#toastActions [data-act="consumable-heal"]').dblclick();await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('3');
 expect((await saved(page)).trauma).toBe(1);expect((await saved(page)).consumables[0].quantity).toBe(2);await close(page);
 await tab(page,'overview');await heal(page,2);await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('5');
 expect((await saved(page)).trauma).toBe(1);expect((await saved(page)).apAvail).toBe(7);expect((await saved(page)).resources[0].current).toBe(7);
 expect(await page.evaluate(()=>window.healthCalls.filter(c=>c.type==='HealHealth').length)).toBe(2);
});

test('rendering derives downed defaults without mutating them; ordinary saves reconcile metadata without gameplay commands',async({page})=>{
 await seed(page);
 await page.evaluate(()=>{const health=window.WBCharacter.health;window.WBCharacter.health=state=>{window.healthRoot=state;return health(state);};});
 await page.locator('#hpMax').dispatchEvent('focusout');
 await page.evaluate(()=>{window.healthRoot.fields.hpCur='-4';window.healthRoot.down=null;window.healthCalls=[];});
 await page.locator('#hpMax').dispatchEvent('focusout');await expect(page.locator('#dyingTitle')).toHaveText('Bleeding out');
 expect(await page.evaluate(()=>window.healthRoot.down)).toBeNull();expect(await page.evaluate(()=>window.healthCalls)).toEqual([]);expect((await saved(page)).fields.hpCur).toBe('10');
 await tab(page,'notes');await page.locator('#sessionNotes').fill('Saved after a configuration change');
 await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('-4');expect((await saved(page)).down).toEqual({mercy:true,stable:false});expect(await page.evaluate(()=>window.healthCalls)).toEqual([]);
});

test('reload/v1 import, legacy negative Health and long-rest Undo retain flags and values',async({page})=>{
 const state=hero();state.fields.hpCur='-3';state.down={mercy:true,stable:true,futureDown:{kept:true}};state.trauma=1;await seed(page,state);
 await expect(page.locator('#stableOn')).toBeChecked();await page.locator('#hpMax').fill('21');await page.locator('#hpMax').blur();
 await expect.poll(async()=>(await saved(page)).over.hpMax).toBe('21');await page.reload();await expect(page.locator('#stableOn')).toBeChecked();
 await openCharacterMenu(page);const pending=page.waitForEvent('download');await page.locator('#exportBtn').click();const file=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));
 expect(file.version).toBe(1);expect(file.state.down.futureDown).toEqual({kept:true});expect(file.state.trauma).toBe(1);
 async function load(value){await openCharacterMenu(page);await page.locator('#importFile').setInputFiles({name:'health.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await page.locator('#importYes').click();await page.locator('#characterMenu > summary').click();}
 const legacy=hero();legacy.fields.hpCur='-4';delete legacy.down;await load(legacy);await expect(page.locator('#stableOn')).not.toBeChecked();
 await hit(page,10);await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('-14');await close(page);
 await page.locator('#longRest').click();await expect(page.locator('#hpCur')).toHaveValue('20');await page.locator('#toastActions [data-act="undo"]').click();await expect(page.locator('#hpCur')).toHaveValue('-14');
 await load(file);await expect(page.locator('#hpCur')).toHaveValue('-3');await expect(page.locator('#stableOn')).toBeChecked();expect((await saved(page)).trauma).toBe(1);
});

test('historical gear uses numeric progression while current form equipment changes only the live maximum',async({page})=>{
 const state=hero();state.fields.level='2';state.fields.hpCur='';state.over={};state.lvGear={1:{VIT:'2'},2:{VIT:'4'}};state.rolls={2:'5'};
 state.items[0].bonuses=[{t:'hp',v:3}];state.items.push({id:'other',name:'Other helm',type:'head',ar:0,abilities:[],bonuses:[{t:'hp',v:7}]});
 state.abilityLoadouts=[{id:'loadhealthform',name:'Form',statBonuses:{VIT:8}}];state.equipmentProfiles={base:{head:'helm'},loadhealthform:{head:'other'}};
 await seed(page,state);await expect(page.locator('#hpMax')).toHaveValue('35');await tab(page,'attributes');await expect(page.locator('#logHp')).toHaveText('32');
 await tab(page,'abilities');await page.locator('#abilityLoadoutSelect').selectOption('loadhealthform');await tab(page,'overview');await expect(page.locator('#hpMax')).toHaveValue('39');await expect(page.locator('#hpCur')).toHaveValue('');
 await page.locator('#hpCur').fill('37');await page.locator('#hpCur').blur();await tab(page,'abilities');await page.locator('#abilityLoadoutSelect').selectOption('');await tab(page,'overview');await expect(page.locator('#hpMax')).toHaveValue('35');
 await heal(page,5);await expect(page.locator('#hpCur')).toHaveValue('37');await expect.poll(async()=>(await saved(page)).fields.hpCur).toBe('37');
});
