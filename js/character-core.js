/* Deterministic, DOM-free character command foundation.
 * Custom resources and AP/Mana payments. No automatic triggers in this module.
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
   return {resources,ap,mana};
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
 function apply(state,command){
   if(!state||typeof state!=='object'||Array.isArray(state)||!command||typeof command!=='object'||Array.isArray(command))
     return {ok:false,error:'INVALID_COMMAND'};
   if(poolTypes.has(command.type))return applyPools(state,command);
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
