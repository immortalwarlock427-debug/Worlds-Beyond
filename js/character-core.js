/* Deterministic, DOM-free character command foundation.
 * Character payments and ability/form transactions. No automatic triggers.
 */
(function(){
 'use strict';
 const LIMIT=999999;
 const record=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
 const numeric=v=>{
   if(typeof v!=='string'&&typeof v!=='number')return NaN;
   const text=String(v).trim().replace(/−/g,'-');
   return text===''?NaN:Number(text);
 };
 const finite=v=>Number.isFinite(numeric(v));
 const amount=v=>finite(v)&&numeric(v)>=0?numeric(v):null;
 const number=(v,defaultValue=0)=>{
   if(v==null||v==='')return defaultValue;
   const n=Number(v);
   return Number.isFinite(n)?Math.max(0,Math.min(LIMIT,Math.round(n))):defaultValue;
 };
 function maximum(state,r){
   let bonus=0;
   for(const a of (Array.isArray(state.abilities)?state.abilities:[])){
     if(!a||!(Number(a.durationLeft)>0))continue;
     for(const e of (Array.isArray(a.effects)?a.effects:[])){
       if(e&&e.target==='resource-max'&&e.resourceId===r.id){
         const n=Number(e.value);
         if(Number.isFinite(n))bonus+=Math.round(n);
       }
     }
   }
   return Math.max(1,number(r.max,1)+bonus);
 }
 function derive(state){
   const resources=Object.create(null);
   for(const r of (Array.isArray(state.resources)?state.resources:[])){
     if(!r||typeof r.id!=='string')continue;
     resources[r.id]=Object.freeze({
       current:number(r.current),
       baseMax:Math.max(1,number(r.max,1)),
       effectiveMax:maximum(state,r)
     });
   }
   const fields=record(state.fields),over=record(state.over),combat=window.WBCombat;
   const max=combat.trackerMax(fields.apMax,15);
   const own=combat.trackerAvailable(state.apAvail==null?null:
     finite(state.apAvail)?numeric(state.apAvail):0,max);
   const rawGiven=record(state.apGiven).n;
   const given=finite(rawGiven)?Math.max(0,Math.min(40,numeric(rawGiven))):0;
   const ap=Object.freeze({max,own,given,total:own+given});
   const automaticMax=combat.characterMaxMana(state);
   const manaMax=finite(over.mpMax)?numeric(over.mpMax):automaticMax;
   const blank=fields.mpCur==null||String(fields.mpCur).trim()==='';
   const current=blank?(manaMax==null?null:Math.max(0,manaMax)):
     Math.max(0,finite(fields.mpCur)?numeric(fields.mpCur):0);
   const visible=window.WBAbilities.formManaAvailable(state);
   const configured=manaMax!=null&&Number.isFinite(manaMax)&&manaMax>0;
   const mana=Object.freeze({kind:fields.manaKind==='holy'?'holy':'mana',
     automaticMax,max:manaMax,current,visible,configured,available:visible&&configured});
   const reactionMax=combat.reactionMaximum(state,window.WBAbilities.effectBonus(state,'stat','AGL'),window.WBAbilities.formStatBonus(state,'AGL'));
   const reactions=Object.freeze({max:reactionMax,current:combat.trackerAvailable(state.reactAvail==null?null:
     finite(state.reactAvail)?numeric(state.reactAvail):0,reactionMax)});
   return {resources,ap,mana,reactions};
 }
 const poolTypes=new Set(['SpendAP','RefundAP','SetAPCurrent','SetAPMaximum',
   'SpendMana','SetManaCurrent','SetManaMaximum','SpendPools']);
 function applyPools(state,command){
   const before=derive(state),patch={},type=command.type;
   const combat=window.WBCombat;
   const normalized={...state,apGiven:state.apGiven?
     {...state.apGiven,n:before.ap.given}:null};
   if(['SpendAP','SpendMana','SpendPools'].includes(type)){
     const ap=type==='SpendAP'?amount(command.amount):type==='SpendPools'?
       amount(command.ap===undefined?0:command.ap):0;
     const mana=type==='SpendMana'?amount(command.amount):type==='SpendPools'?
       amount(command.mana===undefined?0:command.mana):0;
     if(ap===null||mana===null)return {ok:false,error:'INVALID_AMOUNT'};
     // Validate both pools before making any patch; failed payments are inert.
     if(ap>before.ap.total)return {ok:false,error:'INSUFFICIENT_AP'};
     if(mana>0){
       if(!before.mana.configured)return {ok:false,error:'MANA_NOT_CONFIGURED'};
       if(!before.mana.visible&&command.allowHiddenMana!==true)
         return {ok:false,error:'MANA_UNAVAILABLE'};
       if(mana>before.mana.current)return {ok:false,error:'INSUFFICIENT_MANA'};
     }
     if(ap>0)Object.assign(patch,combat.spendAp(normalized,before.ap.own,ap));
     if(mana>0)patch.fields={...record(state.fields),mpCur:String(before.mana.current-mana)};
   }else if(type==='RefundAP'){
     const n=amount(command.amount);
     if(n===null)return {ok:false,error:'INVALID_AMOUNT'};
     if(n>0)Object.assign(patch,combat.refundAp(normalized,before.ap.own,before.ap.max,n));
   }else if(type==='SetAPCurrent'){
     if(command.value==null||command.value==='')patch.apAvail=null;
     else if(!finite(command.value))return {ok:false,error:'INVALID_VALUE'};
     else patch.apAvail=Math.max(0,Math.min(before.ap.max,numeric(command.value)));
   }else{
     // Corrections retain blank/full sentinels and manually entered balances,
     // including above-max/negative Mana. Derived spendable Mana is never negative.
     const value=command.value;
     if(value!==''&&value!=null&&!finite(value))return {ok:false,error:'INVALID_VALUE'};
     const text=value==null?'':String(value);
     if(type==='SetManaMaximum'){
       patch.over={...record(state.over)};
       if(text.trim()==='')delete patch.over.mpMax;else patch.over.mpMax=text;
     }else{
       const key=type==='SetAPMaximum'?'apMax':'mpCur';
       patch.fields={...record(state.fields),[key]:text};
     }
   }
   const next={...state,...patch},after=derive(next),events=[];
   const correction=type.startsWith('Set');
   for(const pool of ['ap','mana']){
     const a=after[pool],b=before[pool];
     if(JSON.stringify(a)===JSON.stringify(b))continue;
     events.push({type:pool+'.changed',previous:b,current:a,
       source:correction?'correction':'command',command:type});
   }
   return {ok:true,state:next,patch,events,log:events.map(e=>type+': '+e.type+' '+
     (e.type==='ap.changed'?e.previous.total:e.previous.current)+' -> '+
     (e.type==='ap.changed'?e.current.total:e.current.current))};
 }
 const transactionTypes=new Set(['ActivateAbility','EnterForm','SelectPortrait']);
 const lifecycleTypes=new Set(['StartCombat','EndCombat','AdvanceAbilityTurn','RestAbilities']);
 function applyAbilityLifecycle(state,command){
   const type=command.type,abilities=window.WBAbilities;
   if(type==='StartCombat'&&state.inCombat===true||type==='EndCombat'&&state.inCombat!==true)
     return {ok:true,state,patch:{},events:[],log:[],message:type==='StartCombat'?'Already in combat.':'Already outside combat.'};
   const patch={},next={...state,abilities:(state.abilities||[]).map(a=>({...a}))};
   if(type==='StartCombat'){
     patch.inCombat=true;next.inCombat=true;patch.parryUsed=false;
     for(const a of next.abilities)if(['combat','round'].includes(a.usesPer))a.usesLeft=a.uses===''?null:a.uses;
   }else if(type==='EndCombat'){patch.inCombat=false;next.inCombat=false;}
   else if(type==='AdvanceAbilityTurn')abilities.advanceTurn(next);
   else abilities.resetForRest(next);
   const events=[];
   if(type==='StartCombat'||type==='EndCombat')events.push({type:type==='StartCombat'?'combat.started':'combat.ended',command:type});
   const snapshot=a=>({usesLeft:a.usesLeft,outsideUsesSpent:a.outsideUsesSpent||0,
     cooldownLeft:a.cooldownLeft,durationLeft:a.durationLeft});
   for(let i=0;i<next.abilities.length;i++){
     const previous=snapshot(state.abilities[i]),current=snapshot(next.abilities[i]);
     if(JSON.stringify(previous)!==JSON.stringify(current))events.push({type:'ability.changed',abilityId:next.abilities[i].id,previous,current,command:type});
   }
   if(JSON.stringify(next.abilities)!==JSON.stringify(state.abilities||[]))patch.abilities=next.abilities;
   const milestoneUses=abilities.milestoneLifecycle(next,type);
   if(JSON.stringify(milestoneUses)!==JSON.stringify(state.milestoneUses||{})){
     patch.milestoneUses=milestoneUses;
     for(const [id,current] of Object.entries(milestoneUses)){
       const previous=record(state.milestoneUses)[id];
       if(JSON.stringify(previous)!==JSON.stringify(current))events.push({type:'milestone.changed',milestoneId:id,previous,current,command:type});
     }
   }
   const equipment=abilities.equipmentLifecycle(next,type);
   for(const key of ['spent','equipmentOutsideSpent'])if(JSON.stringify(equipment[key])!==JSON.stringify(state[key]||{})){
     patch[key]=equipment[key];events.push({type:'equipment.uses.changed',pool:key,previous:state[key]||{},current:equipment[key],command:type});
   }
   return {ok:true,state:{...state,...patch},patch,events,log:events.map(e=>type+': '+e.type),
     message:type==='StartCombat'?'Combat started. Combat and round uses restored.':type==='EndCombat'?'Combat ended. Outside uses retained.':'Ability trackers updated.'};
 }
 function applyTransaction(state,command){
   const type=command.type,abilities=window.WBAbilities;
   const reject=(error,message)=>({ok:false,error,message});
   if(type==='ActivateAbility'&&typeof command.abilityId!=='string'||
      type==='EnterForm'&&typeof command.formId!=='string'||
      type==='SelectPortrait'&&typeof command.portraitId!=='string')
     return reject('INVALID_COMMAND','Choose an existing ability, form or portrait.');
   // Copy only paths owned by these operations. Portrait image strings, history
   // and unknown data stay shared/read-only; no normalization or new ids here.
   const next={...state};
   for(const key of ['fields','apGiven','equip'])
     if(state[key]&&typeof state[key]==='object')next[key]={...state[key]};
   for(const key of ['abilities','resources'])
     if(Array.isArray(state[key]))next[key]=state[key].map(item=>item?{...item}:item);
   if(state.equipmentProfiles)next.equipmentProfiles=Object.fromEntries(
     Object.entries(state.equipmentProfiles).map(([id,profile])=>[id,{...record(profile)}]));
   // Existing WBAbilities/WBEquipment rules operate only on the private copy.
   // Every payment uses B1's primitives; no external callbacks or DOM values.
   const commit=result=>{
     if(!result.ok)throw new Error(result.error);
     Object.assign(next,result.patch);
     return result;
   };
   const controls={
     getAp:()=>derive(next).ap.total,
     getMana:()=>{const mana=derive(next).mana;return mana.configured?mana.current:null;},
     spendAp:n=>commit(applyPools(next,{type:'SpendAP',amount:n})),
     spendMana:n=>commit(applyPools(next,{type:'SpendMana',amount:n})),
     planPools:costs=>applyPools(next,{type:'SpendPools',...costs}),
     commitPools:commit
   };
   let result;
   try{
     if(type==='ActivateAbility'){
       result=abilities.activate(next,command.abilityId,controls);
       if(!result.ok)return reject('ABILITY_REJECTED',result.message);
     }else{
       const formId=type==='EnterForm'?command.formId:abilities.portraitForm(next,command.portraitId);
       if(formId===null)return reject('PORTRAIT_NOT_FOUND','That portrait no longer exists.');
       const payment=abilities.entryCost(next,formId,controls);
       if(!payment.ok)return reject('FORM_REJECTED',payment.message);
       const switched=type==='EnterForm'?abilities.selectLoadout(next,formId,controls):
         abilities.selectPortrait(next,command.portraitId,controls);
       if(!switched)return reject('FORM_REJECTED','Could not switch forms. No costs were spent.');
       const form=(next.abilityLoadouts||[]).find(f=>f.id===next.activeAbilityLoadoutId);
       result={message:form?'Active form: '+form.name:'Base form: shared abilities only.'};
     }
   }catch(error){return reject('TRANSACTION_FAILED','The character change could not be completed. No costs were spent.');}
   if(type==='ActivateAbility'){
     const ability=next.abilities.find(a=>a.id===command.abilityId);
     for(const key of ['usesLeft','outsideUsesSpent','capacityCurrent','cooldownLeft','durationLeft'])
       if(ability[key]!=null&&(!finite(ability[key])||numeric(ability[key])<0))
         return reject('INVALID_CHARACTER_STATE','This ability has unreadable tracker values. No costs were spent.');
   }
   for(const resource of (next.resources||[])){
     const previous=(state.resources||[]).find(r=>r.id===resource.id);
     if(previous&&previous.current!==resource.current&&
       (!finite(resource.current)||numeric(resource.current)<0))
       return reject('INVALID_CHARACTER_STATE','The resource balance could not be read. No costs were spent.');
   }
   const patch={};
   for(const key of ['fields','apAvail','apGiven','abilities','resources','equip',
     'equipmentProfiles','activeAbilityLoadoutId','formId'])
     if(JSON.stringify(state[key])!==JSON.stringify(next[key]))patch[key]=next[key];
   const before=derive(state),after=derive(next),events=[];
   const emit=(event)=>events.push({...event,source:'command',command:type});
   for(const pool of ['ap','mana'])
     if(JSON.stringify(before[pool])!==JSON.stringify(after[pool]))
       emit({type:pool+'.changed',previous:before[pool],current:after[pool]});
   for(const [id,current] of Object.entries(after.resources)){
     const previous=before.resources[id];
     if(previous&&JSON.stringify(previous)!==JSON.stringify(current))
       emit({type:'resource.changed',resourceId:id,previous:previous.current,current:current.current,
         previousMaximum:previous.effectiveMax,currentMaximum:current.effectiveMax});
   }
   if(type==='ActivateAbility'){
     const snapshot=s=>{
       const a=s.abilities.find(a=>a.id===command.abilityId);
       return {usesLeft:a.usesLeft,outsideUsesSpent:a.outsideUsesSpent||0,cooldownLeft:a.cooldownLeft,
         durationLeft:a.durationLeft,capacityCurrent:a.capacityCurrent};
     };
     emit({type:'ability.used',abilityId:command.abilityId,previous:snapshot(state),current:snapshot(next)});
   }else{
     if(state.activeAbilityLoadoutId!==next.activeAbilityLoadoutId){
       if(state.activeAbilityLoadoutId)emit({type:'form.left',formId:state.activeAbilityLoadoutId});
       if(next.activeAbilityLoadoutId)emit({type:'form.entered',formId:next.activeAbilityLoadoutId});
     }
     if(state.formId!==next.formId)emit({type:'portrait.changed',previous:state.formId??null,current:next.formId??null});
     if(JSON.stringify(record(state.equip))!==JSON.stringify(record(next.equip)))
       emit({type:'equipment.changed',previous:{...record(state.equip)},current:{...record(next.equip)}});
   }
   return {ok:true,state:{...state,...patch},patch,events,message:result.message,
     ...(result.rollPlan?{rollPlan:result.rollPlan}:{}),
     log:[result.message,...events.map(e=>type+': '+e.type)]};
 }
 function applyMilestone(state,command){
   const id=command.milestoneId,abilities=window.WBAbilities;
   const milestone=typeof id==='string'?abilities.milestoneAction(state,id):null;
   if(!milestone)return {ok:false,error:'MILESTONE_NOT_FOUND',message:'Choose an existing milestone action.'};
   const previous={...record(record(state.milestoneUses)[id])};
   if(command.type==='SetMilestoneUses'){
     const value=amount(command.value);
     if(value===null)return {ok:false,error:'INVALID_VALUE',message:'Enter a nonnegative number of uses.'};
     const remaining=Math.min(milestone.usage.maximum,Math.round(value));
     const current={...previous,usesLeft:milestone.ability.usesLeft,outsideUsesSpent:milestone.ability.outsideUsesSpent};
     if(milestone.usage.outside)current.outsideUsesSpent=milestone.usage.maximum-remaining;
     else current.usesLeft=remaining;
     const patch={milestoneUses:{...record(state.milestoneUses),[id]:current}};
     const events=[{type:'milestone.changed',milestoneId:id,previous,current,source:'correction',command:command.type}];
     return {ok:true,state:{...state,...patch},patch,events,log:[],message:'Adjusted '+milestone.name+' uses.'};
   }
   if(!milestone.unlocked)return {ok:false,error:'MILESTONE_LOCKED',message:milestone.name+' unlocks at '+milestone.stat+' '+milestone.at+'.'};
   // Adapt built-in actions to the same atomic activation path, without adding
   // generated entries to the player's editable Ability Library.
   const working={...state,abilities:[milestone.ability,...(state.abilities||[])]};
   const result=applyTransaction(working,{type:'ActivateAbility',abilityId:milestone.ability.id});
   if(!result.ok)return result;
   const used=result.state.abilities[0];
   const current={...previous,usesLeft:used.usesLeft,outsideUsesSpent:used.outsideUsesSpent};
   const patch={...result.patch,milestoneUses:{...record(state.milestoneUses),[id]:current}};
   delete patch.abilities;
   const events=result.events.map(event=>event.type==='ability.used'?
     {type:'milestone.used',milestoneId:id,previous:{usesLeft:milestone.ability.usesLeft,outsideUsesSpent:milestone.ability.outsideUsesSpent},
       current:{usesLeft:used.usesLeft,outsideUsesSpent:used.outsideUsesSpent},command:'UseMilestone'}:
     {...event,command:'UseMilestone'});
   return {ok:true,state:{...state,...patch},patch,events,message:result.message,milestonePlan:milestone.plan,
     log:events.map(e=>'UseMilestone: '+e.type)};
 }
 function beginWeaponAttack(state,command){
   const plan=window.WBAbilities.weaponAttackPlan(state,command.slot);
   if(!plan.ok)return {ok:false,error:'INVALID_WEAPON',message:plan.message};
   const payment=command.payment===undefined?'ap':command.payment;
   if(!['ap','reaction'].includes(payment))return {ok:false,error:'INVALID_PAYMENT',message:'Choose AP or a reaction for this weapon attack.'};
   const before=derive(state);
   let patch={},events=[];
   if(payment==='ap'){
     const paid=applyPools(state,{type:'SpendAP',amount:plan.apCost});
     if(!paid.ok)return {ok:false,error:paid.error,message:'Not enough AP for this weapon attack.'};
     patch=paid.patch;events=paid.events.map(e=>({...e,command:'BeginWeaponAttack'}));
   }else{
     if(before.reactions.current<1)return {ok:false,error:'INSUFFICIENT_REACTIONS',message:'No reactions left. They come back at the start of your turn.'};
     patch.reactAvail=before.reactions.current-1;
     events.push({type:'reactions.changed',previous:before.reactions.current,current:patch.reactAvail,command:'BeginWeaponAttack'});
   }
   const singularityHand=command.singularityHand||'';
   if(singularityHand){
     if(!['main','off'].includes(singularityHand)||!plan.dual&&singularityHand!==command.slot)
       return {ok:false,error:'INVALID_SINGULARITY_HAND',message:'Choose one hand making this weapon attack.'};
     const used=applyMilestone({...state,...patch},{type:'UseMilestone',milestoneId:'singularity'});
     if(!used.ok)return used;
     patch={...patch,...used.patch};events.push(...used.events.map(e=>({...e,command:'BeginWeaponAttack'})));
   }
   const weaponAttack={...plan,payment,apSpent:payment==='ap'?plan.apCost:0,singularityHand};
   events.push({type:'weapon.attack.prepared',slot:plan.slot,payment,command:'BeginWeaponAttack'});
   return {ok:true,state:{...state,...patch},patch,events,weaponAttack,message:'Weapon attack prepared.',log:events.map(e=>'BeginWeaponAttack: '+e.type)};
 }
 function applyEquipmentAbility(state,command){
   const itemId=command.itemId,index=command.abilityIndex,abilities=window.WBAbilities;
   const data=abilities.equipmentAbility(state,itemId,index);
   if(!data)return {ok:false,error:'EQUIPMENT_ABILITY_NOT_FOUND',message:'Choose an existing equipment ability.'};
   if(!data.usage.limited)return {ok:false,error:'UNLIMITED_EQUIPMENT_ABILITY',message:'This equipment ability has no use limit to track.'};
   const key=data.usage.outside?'equipmentOutsideSpent':'spent';
   const previous=data.usage.outside?data.ability.outsideUsesSpent:data.spent;
   let current;
   if(command.type==='SetEquipmentAbilityUses'){
     const value=amount(command.value);
     if(value===null)return {ok:false,error:'INVALID_VALUE',message:'Enter a nonnegative number of uses.'};
     current=data.usage.maximum-Math.min(data.usage.maximum,Math.round(value));
   }else{
     if(data.usage.remaining<=0)return {ok:false,error:'NO_EQUIPMENT_USES',message:data.ability.name+' has no uses left until the next '+data.usage.period+'.'};
     const working={...state,abilities:[data.ability,...(state.abilities||[])]};
     const used=applyTransaction(working,{type:'ActivateAbility',abilityId:data.ability.id});
     if(!used.ok)return used;
     const ability=used.state.abilities[0];
     current=data.usage.outside?ability.outsideUsesSpent:data.ability.uses-ability.usesLeft;
   }
   const patch={[key]:{...record(state[key]),[itemId]:{...record(record(state[key])[itemId]),[index]:current}}};
   const correction=command.type==='SetEquipmentAbilityUses';
   const events=[{type:correction?'equipment.ability.corrected':'equipment.ability.used',itemId,abilityIndex:index,previous,current,
     period:data.usage.period,source:correction?'correction':'command',command:command.type}];
   return {ok:true,state:{...state,...patch},patch,events,log:events.map(e=>command.type+': '+e.type),
     message:(correction?'Adjusted ':'Used ')+data.ability.name+'.',equipmentAbilityPlan:{name:data.ability.name,effect:String(data.definition.effect||'')}};
 }
 function apply(state,command){
   if(!state||typeof state!=='object'||Array.isArray(state)||!command||typeof command!=='object'||Array.isArray(command))
     return {ok:false,error:'INVALID_COMMAND'};
   if(poolTypes.has(command.type))return applyPools(state,command);
   if(transactionTypes.has(command.type))return applyTransaction(state,command);
   if(lifecycleTypes.has(command.type))return applyAbilityLifecycle(state,command);
   if(command.type==='UseMilestone'||command.type==='SetMilestoneUses')return applyMilestone(state,command);
   if(command.type==='ApplyDevastate'){
     const source=record(command.damageSource);
     if(source.stat!=='STR'||typeof source.damageModifier!=='number'||!Number.isFinite(source.damageModifier))
       return {ok:false,error:'INVALID_DEVASTATE_SOURCE',message:'Devastate requires STR-based attack damage.'};
     const result=applyMilestone(state,{type:'UseMilestone',milestoneId:'devastate'});
     if(!result.ok)return result;
     const events=result.events.map(e=>({...e,command:'ApplyDevastate'}));
     return {...result,devastateBonus:source.damageModifier,events,log:events.map(e=>'ApplyDevastate: '+e.type)};
   }
   if(command.type==='BeginWeaponAttack')return beginWeaponAttack(state,command);
   if(command.type==='UseEquipmentAbility'||command.type==='SetEquipmentAbilityUses')return applyEquipmentAbility(state,command);
   const resources=(Array.isArray(state.resources)?state.resources:[]).map(r=>({...r}));
   const next={...state,resources};
   const before=derive(state).resources;
   const type=command.type;
   const r=resources.find(x=>x&&x.id===command.resourceId);
   if(['SpendResource','GainResource','FillResource','SetResourceCurrent','SetResourceMaximum'].includes(type)&&!r)
     return {ok:false,error:'RESOURCE_NOT_FOUND'};
   if(['SpendResource','GainResource'].includes(type)&&
     (command.amount==null||command.amount===''||!Number.isFinite(Number(command.amount))||
      Number(command.amount)<0))return {ok:false,error:'INVALID_AMOUNT'};
   if(['SetResourceCurrent','SetResourceMaximum'].includes(type)&&
     (command.value==null||command.value===''||!Number.isFinite(Number(command.value))||
      Number(command.value)<0))return {ok:false,error:'INVALID_VALUE'};
   if(type==='SpendResource')r.current=Math.max(0,number(r.current)-number(command.amount));
   else if(type==='GainResource')
     r.current=Math.max(number(r.current),Math.min(before[r.id].effectiveMax,number(r.current)+number(command.amount)));
   else if(type==='FillResource')
     r.current=Math.max(number(r.current),before[r.id].effectiveMax);
   else if(type==='SetResourceCurrent')
     r.current=Math.min(before[r.id].effectiveMax,number(command.value));
   else if(type==='SetResourceMaximum'){
     r.max=Math.max(1,number(command.value,1));
     const cap=maximum(next,r);
     if(cap<before[r.id].effectiveMax)r.current=Math.min(number(r.current),cap);
   } else if(type==='ResourceTurnStart'){
     for(const pool of resources){
       if(!pool||!pool.regen)continue;
       const ids=Array.isArray(pool.loadoutIds)?pool.loadoutIds:[];
       if((state.abilityLoadouts||[]).length&&ids.length&&!ids.includes(state.activeAbilityLoadoutId))
         continue;
       const cap=maximum(next,pool);
       if(number(pool.current)<cap)
         pool.current=Math.min(cap,number(pool.current)+number(pool.regen));
     }
   } else if(type==='ResourceLongRest'){
     for(const pool of resources)if(pool&&pool.refillOnRest!==false)
       pool.current=Math.max(1,number(pool.max,1));
   } else if(type==='ReconcileResourceMaximums'){
     // Only an actual state transition can lower excess, never loading/drawing.
     const old=command.previousMaxima||{};
     for(const pool of resources){
       if(!pool||!Object.prototype.hasOwnProperty.call(old,pool.id))continue;
       const prior=Number(old[pool.id]),cap=maximum(next,pool);
       if(Number.isFinite(prior)&&cap<prior)
         pool.current=Math.min(number(pool.current),cap);
     }
   } else return {ok:false,error:'UNKNOWN_COMMAND'};
   const after=derive(next).resources,events=[];
   for(const pool of resources){
     if(!pool||!before[pool.id])continue;
     const a=after[pool.id],b=before[pool.id];
     if(b.current!==a.current||b.baseMax!==a.baseMax)
       events.push({type:'resource.changed',resourceId:pool.id,
         previous:b.current,current:a.current,
         source:type==='SetResourceCurrent'?'correction':'command'});
   }
   return {ok:true,state:next,events,log:events.map(e=>
     type+': '+e.resourceId+' '+e.previous+' -> '+e.current)};
 }
 window.WBCharacter={derive,apply};
})();
