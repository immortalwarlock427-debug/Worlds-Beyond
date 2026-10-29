/* Worlds Beyond: deterministic, DOM-free resource calculations and commands.
 * This is one stage of the character command migration, not the rules engine.
 * Loading and rendering must never dispatch these commands.
 */
(function(){
 'use strict';
 const LIMIT=999999;
 const number=(v,fallback=0)=>{
   if(v==null||v==='')return fallback;
   const n=Number(v);
   return Number.isFinite(n)?Math.max(0,Math.min(LIMIT,Math.round(n))):fallback;
 };
 const signed=v=>{
   const n=Number(v);
   return Number.isFinite(n)?Math.max(-LIMIT,Math.min(LIMIT,Math.round(n))):0;
 };
 const policy=r=>r.overflowPolicy==='keep'?'keep':'lose';
 const rest=r=>['fill','empty','unchanged'].includes(r.restBehavior)?r.restBehavior:
   (r.refillOnRest===false?'unchanged':'fill');
 const fixedCap=r=>r.cap!=='' && r.cap!=null &&
   Number.isFinite(Number(r.cap)) && Number(r.cap)>0 ?
   Math.max(1,number(r.cap,1)) : null;
 function rawMaximum(state,r){
   let bonus=0;
   const add=effects=>{
     for(const e of (Array.isArray(effects)?effects:[]))
       if(e&&e.target==='resource-max'&&e.resourceId===r.id)bonus+=signed(e.value);
   };
   for(const a of (Array.isArray(state.abilities)?state.abilities:[]))
     if(a&&Number(a.durationLeft)>0)add(a.effects);
   const active=(Array.isArray(state.abilityLoadouts)?state.abilityLoadouts:[])
     .find(f=>f&&f.id===state.activeAbilityLoadoutId);
   if(active)add(active.effects);
   return Math.max(1,Math.min(LIMIT,number(r.max,1)+bonus));
 }
 function limits(state,r){
   const raw=rawMaximum(state,r),cap=fixedCap(r);
   const hardCap=cap===null?raw:cap;
   return {baseMax:Math.max(1,number(r.max,1)),
     effectiveMax:Math.min(raw,hardCap),hardCap,hasFixedCap:cap!==null,
     current:number(r.current),overflowPolicy:policy(r),restBehavior:rest(r)};
 }
 function derive(state){
   const resources=Object.create(null);
   for(const r of (Array.isArray(state.resources)?state.resources:[])){
     if(!r||typeof r.id!=='string')continue;
     resources[r.id]=Object.freeze(limits(state,r));
   }
   return {resources};
 }
 function apply(state,command){
   if(!state||typeof state!=='object'||!command||typeof command!=='object')
     return {ok:false,error:'INVALID_COMMAND'};
   const resources=(Array.isArray(state.resources)?state.resources:[]).map(r=>({...r}));
   const next={...state,resources},type=command.type;
   const before=derive(state).resources;
   const r=resources.find(x=>x&&x.id===command.resourceId);
   const single=['SpendResource','GainResource','FillResource','SetResourceCurrent',
     'SetResourceMaximum','SetResourceCap','SetResourceOverflowPolicy','SetResourceRestBehavior'];
   if(single.includes(type)&&!r)return {ok:false,error:'RESOURCE_NOT_FOUND'};
   if(['SpendResource','GainResource'].includes(type)&&
      (command.amount==null||command.amount===''||!Number.isFinite(Number(command.amount))||
       Number(command.amount)<0))return {ok:false,error:'INVALID_AMOUNT'};
   if(['SetResourceCurrent','SetResourceMaximum'].includes(type)&&
      (command.value==null||command.value===''||!Number.isFinite(Number(command.value))||
       Number(command.value)<0))return {ok:false,error:'INVALID_VALUE'};
   if(type==='SpendResource')r.current=Math.max(0,number(r.current)-number(command.amount));
   else if(type==='GainResource')
     r.current=Math.max(number(r.current),Math.min(before[r.id].hardCap,
       number(r.current)+number(command.amount)));
   else if(type==='FillResource')
     r.current=Math.max(number(r.current),before[r.id].effectiveMax);
   else if(type==='SetResourceCurrent')
     r.current=Math.min(before[r.id].hardCap,number(command.value));
   else if(type==='SetResourceMaximum'){
     r.max=Math.max(1,number(command.value,1));
     const after=limits(next,r);
     // A base maximum edit is a correction, but its capacity change still
     // applies the explicit overflow policy. It must not trigger automation.
     if(after.effectiveMax<before[r.id].effectiveMax && policy(r)==='lose')
       r.current=Math.min(number(r.current),after.effectiveMax);
     if(after.hasFixedCap && after.hardCap<before[r.id].hardCap)
       r.current=Math.min(number(r.current),after.hardCap);
   } else if(type==='SetResourceCap'){
     if(command.value!=='' && command.value!=null &&
        (!Number.isFinite(Number(command.value))||Number(command.value)<1))
       return {ok:false,error:'INVALID_CAP'};
     r.cap=command.value==null||command.value===''?'':Math.max(number(r.max,1),number(command.value,1));
     const after=limits(next,r);
     if(after.effectiveMax<before[r.id].effectiveMax&&policy(r)==='lose')
       r.current=Math.min(number(r.current),after.effectiveMax);
     if(after.hasFixedCap&&after.hardCap<before[r.id].hardCap)
       r.current=Math.min(number(r.current),after.hardCap);
   } else if(type==='SetResourceOverflowPolicy'){
     if(!['lose','keep'].includes(command.value))return {ok:false,error:'INVALID_POLICY'};
     r.overflowPolicy=command.value;
   } else if(type==='SetResourceRestBehavior'){
     if(!['fill','empty','unchanged'].includes(command.value))
       return {ok:false,error:'INVALID_REST_BEHAVIOR'};
     r.restBehavior=command.value;
     r.refillOnRest=command.value==='fill';
   } else if(type==='ResourceTurnStart'){
     for(const pool of resources){
       if(!pool||!pool.regen)continue;
       const ids=Array.isArray(pool.loadoutIds)?pool.loadoutIds:[];
       if((state.abilityLoadouts||[]).length&&ids.length&&!ids.includes(state.activeAbilityLoadoutId))
         continue;
       const max=limits(next,pool).effectiveMax;
       if(number(pool.current)<max)
         pool.current=Math.min(max,number(pool.current)+number(pool.regen));
     }
   } else if(type==='ResourceLongRest'){
     for(const pool of resources){
       if(!pool)continue;
       const behavior=rest(pool);
       if(behavior==='fill')pool.current=Math.max(1,number(pool.max,1));
       else if(behavior==='empty')pool.current=0;
     }
   } else if(type==='ReconcileResourceMaximums'){
     // After an actual form/effect transition, not on redraw/load/import.
     const old=command.previousMaxima||{};
     for(const pool of resources){
       if(!pool||!Object.prototype.hasOwnProperty.call(old,pool.id))continue;
       const prior=Number(old[pool.id]),after=limits(next,pool);
       if(Number.isFinite(prior)&&after.effectiveMax<prior&&policy(pool)==='lose')
         pool.current=Math.min(number(pool.current),after.effectiveMax);
       // A fixed hard cap is always absolute, even if "keep excess".
       if(after.hasFixedCap)pool.current=Math.min(number(pool.current),after.hardCap);
     }
   } else return {ok:false,error:'UNKNOWN_COMMAND'};
   const after=derive(next).resources,events=[];
   for(const pool of resources){
     if(!pool||!before[pool.id])continue;
     const a=after[pool.id],b=before[pool.id];
     if(b.current!==a.current||b.baseMax!==a.baseMax||b.effectiveMax!==a.effectiveMax||
         b.hardCap!==a.hardCap)
       events.push({type:'resource.changed',resourceId:pool.id,
         previous:b.current,current:a.current,
         previousMax:b.effectiveMax,currentMax:a.effectiveMax,
         source:['SetResourceCurrent','SetResourceMaximum','SetResourceCap',
           'SetResourceOverflowPolicy','SetResourceRestBehavior'].includes(type)?
           'correction':'command'});
   }
   return {ok:true,state:next,events,log:events.map(e=>
     type+': '+e.resourceId+' '+e.previous+' -> '+e.current)};
 }
 window.WBCharacter={derive,apply};
})();
