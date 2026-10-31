/* Read-only roll snapshots and the free-dice UI. Randomness/timestamps are
 * supplied by the UI; saved history contains no executable roll actions. */
(() => {
  'use strict';
  const LIMIT=20;
  const kinds=new Set(['free','check','attack','dual','damage','block','consumable-healing','healing','status','stat','advancement']);
  const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const collection=state=>state.rollHistory==null?[]:Array.isArray(state.rollHistory)?state.rollHistory:null;
  const text=(value,max)=>typeof value==='string'?(value.length>max?value.slice(0,max)+'… (details shortened)':value):'';
  function snapshot(value,id,at){
    if(!record(value)||typeof id!=='string'||!id.trim()||typeof at!=='string'||!Number.isFinite(Date.parse(at))||!kinds.has(value.kind))return null;
    if(value.total!==null&&(typeof value.total!=='number'||!Number.isFinite(value.total)))return null;
    const item={id,at,kind:value.kind,title:text(value.title,160)||'Roll',total:value.total,math:text(value.math,4000),note:text(value.note,2000)};
    if(['norm','adv','dis'].includes(value.mode))item.mode=value.mode;
    if(Number.isInteger(value.d20)&&value.d20>=1&&value.d20<=20)item.d20=value.d20;
    if(value.success===true)item.success=true;
    return item;
  }
  function view(state){return (collection(state)||[]).slice(0,LIMIT).map(value=>record(value)?snapshot(value,value.id,value.at):null).filter(Boolean);}
  function freeDicePlan(value){
    const plan=typeof value==='string'?window.WBCombat.parseDamageDice(value):null;
    return plan&&Number.isSafeInteger(plan.maximum+plan.flat)?plan:null;
  }
  function apply(state,command){
    const list=collection(state);
    if(!list)return {ok:false,error:'UNSUPPORTED_ROLL_HISTORY',message:'The recent rolls in this save could not be read. Their saved data has been kept.'};
    let next;
    if(command.type==='ClearRollHistory')next=[];
    else if(command.type==='RecordRoll'){
      const value=command.entry,item=snapshot(value,value&&value.id,value&&value.at);
      if(!item)return {ok:false,error:'INVALID_ROLL',message:'This result could not be added to recent rolls.'};
      if(list.some(value=>value&&value.id===item.id))return {ok:false,error:'DUPLICATE_ROLL'};
      next=[item,...list].slice(0,LIMIT);
    }else if(command.type==='ReviseRoll'){
      const indices=list.map((value,i)=>value&&value.id===command.rollId?i:-1).filter(i=>i>=0);
      if(indices.length!==1)return {ok:false,error:'ROLL_NOT_FOUND'};
      const index=indices[0],previous=list[index],item=snapshot(command.result,previous.id,previous.at);
      if(!item)return {ok:false,error:'INVALID_ROLL'};
      next=list.slice();next[index]={...previous,...item};
      if(!item.success)delete next[index].success;
    }else return {ok:false,error:'UNKNOWN_COMMAND'};
    const patch={rollHistory:next};
    return {ok:true,state:{...state,...patch},patch,events:[],log:[],message:command.type==='ClearRollHistory'?'Recent rolls cleared.':'Recent rolls updated.'};
  }
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function init(getState,save,controls){
    const form=document.getElementById('freeDiceForm'),expression=document.getElementById('freeDiceExpression'),label=document.getElementById('freeDiceLabel');
    const list=document.getElementById('recentRollList'),feedback=document.getElementById('diceFeedback');
    const clear=document.getElementById('rollHistoryClear'),confirm=document.getElementById('rollHistoryConfirm');
    let sequence=0;
    function message(value,error=false){feedback.textContent=value;feedback.classList.toggle('error',error);}
    function render(){
      const entries=view(getState()),raw=collection(getState());clear.disabled=raw===null||raw.length===0;
      document.getElementById('rollHistoryCount').textContent=entries.length+' / '+LIMIT;
      if(raw===null){list.innerHTML='<li class="note">The recent rolls in this save could not be read. Their saved data has been kept.</li>';return;}
      list.innerHTML=entries.map(item=>'<li class="recent-roll" data-roll-id="'+esc(item.id)+'"><details><summary><span class="recent-roll-title">'+esc(item.title)+'</span>'+
        (item.total===null?'':'<strong class="recent-roll-total">'+esc(item.total)+'</strong>')+
        '<time datetime="'+esc(item.at)+'" title="'+esc(new Date(item.at).toLocaleString())+'">'+esc(new Date(item.at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}))+'</time></summary>'+
        '<p class="recent-roll-math">'+esc(item.math)+'</p>'+(item.note?'<p class="recent-roll-note">'+esc(item.note)+'</p>':'')+'</details></li>').join('')||'<li class="recent-roll-empty">No recent rolls yet. Use the dice box or roll from the sheet.</li>';
    }
    function execute(command){const result=controls.execute(command);if(result.ok){render();save();}return result;}
    function capture(value,id){
      let result;
      if(id)result=execute({type:'ReviseRoll',rollId:id,result:value});
      else {
        const at=new Date().toISOString(),ids=new Set((collection(getState())||[]).map(item=>item&&item.id));
        do{id='roll'+Date.now().toString(36)+'-'+(++sequence);}while(ids.has(id));
        result=execute({type:'RecordRoll',entry:snapshot(value,id,at)});
      }
      if(!result.ok){if(result.message)message(result.message,true);return null;}
      return id;
    }
    form.addEventListener('submit',event=>{
      event.preventDefault();const plan=freeDicePlan(expression.value);
      if(!plan){message('Enter complete dice such as 3d6+2. Use at most 1,000 dice and a 120-character expression.',true);expression.focus();return;}
      message('');controls.rollFree(plan,label.value.trim());
    });
    clear.addEventListener('click',()=>{confirm.hidden=false;document.getElementById('rollHistoryKeep').focus();});
    document.getElementById('rollHistoryKeep').addEventListener('click',()=>{confirm.hidden=true;clear.focus();});
    document.getElementById('rollHistoryClearYes').addEventListener('click',()=>{
      const result=execute({type:'ClearRollHistory'});message(result.message||'Recent rolls could not be cleared.',!result.ok);
      if(result.ok){confirm.hidden=true;expression.focus();}
    });
    render();
    return {render,capture,reset(){form.reset();confirm.hidden=true;message('');render();}};
  }
  window.WBRolls={LIMIT,collection,snapshot,view,freeDicePlan,apply,init};
})();
