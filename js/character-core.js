/* Deterministic, DOM-free character command foundation.
 * First migration: custom resources. No automatic triggers in this module yet.
 */
(function(){
 'use strict';
 const LIMIT=999999;
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
   return {resources};
 }
 function apply(state,command){
   if(!state||typeof state!=='object'||!command||typeof command!=='object')
     return {ok:false,error:'INVALID_COMMAND'};
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
