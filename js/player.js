/* Player Preview controller. Same-origin, same-browser local encounter only.
 * Uses a deliberately non-authenticated seat selector. All actions reuse the
 * player-only WBEncounter role and are checked against encounter revisions.
 */
(function () {
  'use strict';
  const $ = key => document.querySelector(key);
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g,ch =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const repo = window.WBPersistence.createLocalRepositories(() => window.localStorage).games;
  const wb = window.WBPlayerSession, rules = window.WBEncounterMap, combat = window.WBCombat;
  const SIZE=36, seatStore='worlds-beyond-player-preview-seat';
  let game=window.WBGameState.blankGame();
  let encounter=window.WBEncounter.createEncounter('local-encounter');
  let seatId='', preview=null, animation=null, serial=0, lastMapId=null;
  const errors={
    REVISION_CONFLICT:'The encounter changed. Refresh the player view and try again.',
    NOT_CURRENT_TURN:'Wait for your character’s turn.',
    NOT_YOUR_ACTOR:'Only the selected character can act.',
    ACTOR_UNCONSCIOUS:'A downed character cannot move.',
    INSUFFICIENT_AP:'Not enough AP for that action.',
    TOKEN_NOT_PLACED:'Ask the DM to position your token first.',
    BLOCKED_SQUARE:'The destination is blocked by terrain.',
    OCCUPIED_SQUARE:'Another combatant occupies this square.',
    NO_PATH:'There is no legal route to that square.',
    NO_MOVEMENT:'No movement remains.',
    OUT_OF_BOUNDS:'Destination is off the map.',
    ALREADY_THERE:'You are already in that square.',
    PLAYER_SEAT_REQUIRED:'Choose a player character first.',
    PLAYER_ACTION_NOT_ALLOWED:'Only player actions are available in this view.'
  };
  const mapBoard=$('#playerMapBoard'), layer=$('#playerMapTokens');
  const animationLayer=$('#playerMapAnimation');
  function notify(text,isError=false){
    const element=$('#playerFeedback');
    element.textContent=text;
    element.classList.toggle('error',isError);
  }
  function actionId(){
    const random=typeof crypto!=='undefined'&&crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g,'').slice(0,20)
      : Date.now().toString(36)+Math.floor(Math.random()*1e9).toString(36);
    return 'player'+random+(++serial).toString(36);
  }
  function read(){
    const data=repo.load();
    return window.WBGameState.normalizeGame(data);
  }
  function rememberSeat(){
    try { window.sessionStorage.setItem(seatStore,seatId); } catch(error) { /* optional */ }
  }
  function savedSeat(){
    try { return window.sessionStorage.getItem(seatStore)||''; }
    catch(error) { return ''; }
  }
  function cancelMotion(){
    const old=animation; animation=null;
    if(old){
      if(old.timer!=null && window.clearTimeout) window.clearTimeout(old.timer);
      if(old.motion && old.motion.cancel) old.motion.cancel();
    }
    animationLayer.innerHTML='';
    if(old && layer.querySelector){
      const item=layer.querySelector('[data-player-token="'+old.actorId+'"]');
      if(item)item.style.visibility='';
    }
  }
  function hideFinalToken(){
    if(!animation || !layer.querySelector)return;
    const el=layer.querySelector('[data-player-token="'+animation.actorId+'"]');
    if(el)el.style.visibility='hidden';
  }
  function animate(path){
    cancelMotion();
    if(!Array.isArray(path)||path.length<2 ||
      (window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches))
      return;
    const actor=encounter.actors[seatId];
    if(!actor)return;
    const start=path[0],end=path[path.length-1];
    const tokenName=actor.name.split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
    animationLayer.innerHTML='<span class="dm-map-token player self" style="left:'+
      (start.x*SIZE+3)+'px;top:'+(start.y*SIZE+3)+'px">'+escapeHtml(tokenName)+'</span>';
    const token=animationLayer.querySelector&&animationLayer.querySelector('.dm-map-token');
    if(!token){animationLayer.innerHTML='';return;}
    const travel={actorId:seatId,mapId:lastMapId,endX:end.x,endY:end.y,motion:null,timer:null};
    animation=travel;
    hideFinalToken();
    function complete(){
      if(animation!==travel)return;
      cancelMotion();
      render();
      notify('Your move is complete. AP has been updated.');
    }
    if(typeof token.animate==='function'){
      const frames=path.map((point,i)=>({
        offset:i/(path.length-1),
        transform:'translate('+((point.x-start.x)*SIZE)+'px, '+((point.y-start.y)*SIZE)+'px)'
      }));
      travel.motion=token.animate(frames,{duration:(path.length-1)*170,easing:'linear',fill:'forwards'});
      travel.motion.finished.then(complete,complete);
    }else if(typeof window.setTimeout==='function'){
      let index=0;
      const step=()=>{
        if(animation!==travel)return;
        index++;
        if(index>=path.length){complete();return;}
        token.style.left=(path[index].x*SIZE+3)+'px';
        token.style.top=(path[index].y*SIZE+3)+'px';
        travel.timer=window.setTimeout(step,170);
      };
      travel.timer=window.setTimeout(step,170);
    }else cancelMotion();
  }
  function load(){
    try {
      game=read();
      encounter=game.encounter || window.WBEncounter.createEncounter('local-encounter');
      const choices=wb.seats(encounter);
      const seatIds=choices.map(s=>s.id);
      if(!seatIds.includes(seatId)){
        const stored=savedSeat();
        seatId=seatIds.includes(stored)?stored:(seatIds[0]||'');
      }
      if(preview && (preview.revision!==encounter.revision ||
        preview.encounterId!==encounter.id))preview=null;
      render();
      return true;
    }catch(error){
      notify('Could not load local encounter data. Check browser storage.',true);
      return false;
    }
  }
  function currentView(){
    const map=rules.mapModel(game,window.WB_MAPS);
    return wb.view(encounter,seatId,map);
  }
  function command(type,detail={}){
    if(!seatId){notify('Choose a player character first.',true);return null;}
    try {
      const fresh=read();
      const saved=fresh.encounter || window.WBEncounter.createEncounter('local-encounter');
      if(saved.id!==encounter.id || saved.revision!==encounter.revision){
        load();notify(errors.REVISION_CONFLICT,true);return null;
      }
      const selectedMap=rules.mapModel(fresh,window.WB_MAPS);
      const oldMap=rules.mapModel(game,window.WB_MAPS);
      if(selectedMap.id!==oldMap.id){
        load();notify('The DM changed maps. Review the new map before moving.',true);
        return null;
      }
      const result=wb.issue(saved,seatId,type,detail,actionId(),selectedMap);
      if(!result.ok){
        notify(errors[result.error]||('Action rejected: '+result.error),true);
        return null;
      }
      // Only encounter changes are written. Character files, legacy token
      // locations, fog and enemy records stay untouched.
      repo.save({...fresh,encounter:result.state});
      game={...fresh,encounter:result.state};encounter=result.state;
      preview=null;render();
      notify(type==='EndTurn'?'Turn ended successfully.':
        type==='SpendAP'?'AP spent.':'Movement saved.');
      return result;
    }catch(error){
      notify('Unable to save the action. Check browser storage.',true);
      return null;
    }
  }
  function render(){
    const map=rules.mapModel(game,window.WB_MAPS);
    if(lastMapId!==map.id){cancelMotion();lastMapId=map.id;preview=null;}
    const choices=wb.seats(encounter);
    $('#playerSeat').innerHTML=choices.length
      ? choices.map(seat=>'<option value="'+escapeHtml(seat.id)+'">'+escapeHtml(seat.name)+'</option>').join('')
      : '<option value="">No imported player characters</option>';
    $('#playerSeat').value=seatId;
    $('#playerSeat').disabled=!choices.length;
    const v=currentView(),self=v&&v.self;
    const turn=v&&v.isTurn,alive=self&&self.hp>0;
    $('#playerStatus').textContent=encounter.phase==='active'
      ? 'Round '+encounter.round+' · '+encounter.order.length+' combatants · Local revision '+encounter.revision
      : encounter.phase==='finished'?'Combat finished · the DM may reuse the roster':
        'Waiting for the DM to start an encounter';
    $('#playerTurnHeading').textContent=encounter.phase==='active'&&v
      ? (turn?'Your turn':'Now acting: '+v.currentName)
      : encounter.phase==='finished'?'Combat finished':'Waiting for combat';
    $('#playerTurnHint').textContent=!self
      ? 'The DM must import player characters into this encounter first.'
      : encounter.phase!=='active'
      ? 'Use the DM Room to start or reuse combat.'
      : turn?'Move your token, spend AP, or end your turn when ready.'
      : 'You can see the map, but only the current character can take actions.';
    $('#playerEndTurn').disabled=!turn;
    $('#playerSpendAP').disabled=!turn;
    const stats=self?[
      ['Health',self.hp+' / '+self.maxHp],
      ['Action Points',(self.apAvail+(self.apGiven?self.apGiven.n:0))+' / '+self.apMax],
      ['Movement',self.speedFt+' ft/AP'],
      ['Surge',Math.max(0,self.surgeMax-self.move.surge)+' / '+self.surgeMax],
      ['Armor Rating',self.ar],
      ['Initiative',self.initiative],
      ['Distance moved',self.move.ft+' ft'],
      ['Leftover movement',self.move.left+' ft']
    ]:[];
    $('#playerStats').innerHTML=stats.length?stats.map(([name,value])=>
      '<div class="player-stat"><span>'+escapeHtml(name)+'</span><strong>'+
      escapeHtml(value)+'</strong></div>').join(''):
      '<p class="dm-empty">No player character selected.</p>';
    const stage=mapBoard,grid=$('#playerMapGrid');
    stage.style.width=map.cols*SIZE+'px';
    stage.style.height=map.rows*SIZE+'px';
    stage.style.backgroundImage=map.def.img?'url("'+map.def.img+'")':'none';
    stage.style.backgroundSize='100% 100%';
    grid.style.backgroundSize=SIZE+'px '+SIZE+'px';
    const actors=v?v.actors:[];
    layer.innerHTML=actors.filter(a=>Number.isInteger(a.x)&&Number.isInteger(a.y)&&
      a.x>=0&&a.y>=0&&a.x<map.cols&&a.y<map.rows)
      .map(actor=>'<span class="dm-map-token'+(actor.kind==='npc'?' enemy':' player')+
        (actor.id===seatId?' self':'')+
        (v&&actor.id===v.currentId?' current':'')+
        '" data-player-token="'+escapeHtml(actor.id)+'" style="left:'+
        (actor.x*SIZE+3)+'px;top:'+(actor.y*SIZE+3)+'px" title="'+
        escapeHtml(actor.name)+'">'+escapeHtml(actor.name.trim().split(/\s+/)
          .slice(0,2).map(word=>word[0]||'').join('').toUpperCase())+'</span>').join('');
    if(animation){
      if(!self||self.x!==animation.endX||self.y!==animation.endY||
        map.id!==animation.mapId)cancelMotion();
      else hideFinalToken();
    }
    if(preview && (!turn||!alive||preview.revision!==encounter.revision||
      preview.actorId!==seatId||preview.mapId!==map.id))preview=null;
    $('#playerMovePreview').hidden=!preview;
    $('#playerMapPath').innerHTML=preview?preview.route.path.slice(1).map((pt,i)=>
      '<span class="dm-path-cell'+(i===preview.route.path.length-2?' destination':'')+
      '" style="left:'+(pt.x*SIZE)+'px;top:'+(pt.y*SIZE)+'px"></span>').join(''):'';
    if(preview){
      $('#playerMoveText').textContent=preview.route.ft+' ft to '+
        rules.squareName(preview.x,preview.y)+' · '+preview.plan.paid+
        ' AP + '+preview.plan.free+' Surge AP'+
        (preview.route.rough?' · '+preview.route.rough+' difficult square(s)':'');
    }
    $('#playerMapStatus').textContent=map.name+' · '+map.cols+' × '+map.rows+
      ' squares · '+actors.filter(a=>a.x!=null&&a.y!=null).length+' combatants placed';
    $('#playerMapHelp').textContent=!self?'Choose a player character to view the map.':
      !turn?'Waiting for your turn. You cannot move tokens from this view right now.':
      !alive?'Your character is down and cannot move.':
      self.mapId!==map.id?'Ask the DM to place your token on this map.':
      'Click an open square to preview a validated movement route; confirm before spending AP.';
  }
  $('#playerSeat').addEventListener('change',()=>{
    cancelMotion();preview=null;seatId=$('#playerSeat').value;rememberSeat();
    render();notify('Previewing '+(encounter.actors[seatId]?.name||'a player character')+
      '. This seat selection is not authentication.');
  });
  $('#playerRefresh').addEventListener('click',()=>{
    cancelMotion();load();notify('Refreshed from the local DM encounter.');
  });
  $('#playerSpendForm').addEventListener('submit',event=>{
    event.preventDefault();
    const input=event.currentTarget.querySelector('[name="cost"]');
    const cost=Number(input.value);
    command('SpendAP',{cost});
  });
  $('#playerEndTurn').addEventListener('click',()=>{
    if(window.confirm&& !window.confirm('End your character’s turn?'))return;
    cancelMotion();
    command('EndTurn');
  });
  $('#playerMoveCancel').addEventListener('click',()=>{preview=null;render();});
  $('#playerMoveConfirm').addEventListener('click',()=>{
    if(!preview)return;
    const pending=preview;
    if(pending.revision!==encounter.revision || pending.mapId!==lastMapId ||
      pending.actorId!==seatId){preview=null;render();notify('The route expired. Choose a new destination.',true);return;}
    const result=command('MoveToken',{x:pending.x,y:pending.y});
    if(result){
      const path=result.event && Array.isArray(result.event.path)
        ? result.event.path:pending.route.path;
      animate(path);
    }
  });
  mapBoard.addEventListener('click',event=>{
    if(!seatId)return;
    const v=currentView(),actor=v&&v.self;
    if(!v||!v.isTurn){notify('It is not your turn yet.',true);return;}
    if(actor.hp<=0){notify('Your character cannot move while down.',true);return;}
    const rect=mapBoard.getBoundingClientRect();
    const x=Math.floor((event.clientX-rect.left)/SIZE);
    const y=Math.floor((event.clientY-rect.top)/SIZE);
    const map=rules.mapModel(game,window.WB_MAPS);
    const route=rules.movementRoute(encounter,map,seatId,x,y);
    if(!route.ok){notify(errors[route.error]||('Movement rejected: '+route.error),true);return;}
    const free=Math.max(0,actor.surgeMax-actor.move.surge);
    const plan=combat.movePlan(route.ft,actor.speedFt,actor.move,free);
    if((actor.speedFt===0 && plan.fromLeft<plan.ft)||
      plan.paid>combat.apAvailable(actor,actor.apAvail)){
      notify('Not enough movement or AP. Try a closer square.',true);return;
    }
    cancelMotion();
    preview={x,y,actorId:seatId,revision:encounter.revision,mapId:map.id,route,plan};
    render();notify('Route ready. Confirm movement to spend AP.');
  });
  window.addEventListener('storage',event=>{
    if(event.key!==window.WBPersistence.GAME_KEY)return;
    cancelMotion();load();notify('The DM encounter changed in another tab. View updated.');
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){cancelMotion();load();}
  });
  load();
  notify('Local Player Preview ready. Open the DM Room in another tab to test shared encounter updates.');
})();