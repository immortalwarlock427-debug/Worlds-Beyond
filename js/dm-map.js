/* Offline DM encounter map presentation. All movement costs verified by
 * WBEncounter.MoveToken; visual route previews never mutate combat state.
 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const SIZE = 36;
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0,2)
      .map(word => word[0] || '').join('').toUpperCase() || '?';
  }
  function init(options) {
    if (!options || typeof options.getGame !== 'function' ||
        typeof options.getEncounter !== 'function' ||
        typeof options.command !== 'function' || typeof options.selectMap !== 'function')
      throw new TypeError('DM map callbacks are required.');
    const maps = window.WB_MAPS;
    const helper = window.WBEncounterMap;
    const combat = window.WBCombat;
    const mapPick = $('#dmMapPick'), mapChoices = $('#dmMapChoices');
    const actorPick = $('#dmMapActor');
    const stage = $('#dmMapBoard'), layer = $('#dmMapTokens');
    const animationLayer = $('#dmMapAnimation');
    const grid = $('#dmMapGrid'), pathLayer = $('#dmMapPath');
    const modePick = $('#dmMapMode');
    let selectedActorId = '', preview = null, lastPhase = null, lastTurnKey = null;
    const notice = $('#dmMapNotice');
    let traveling = null;  // Visual-only; the encounter save is authoritative.
    function savedToken(id) {
      return layer.querySelector ? layer.querySelector(
        '[data-dm-token="' + id + '"]') : null;
    }
    function hideSavedToken() {
      const saved = traveling && savedToken(traveling.actorId);
      if (saved) saved.style.visibility = 'hidden';
    }
    function cancelTravel() {
      const previous = traveling;
      traveling = null;
      if (previous && previous.timer != null &&
          typeof window.clearTimeout === 'function')
        window.clearTimeout(previous.timer);
      if (previous && previous.animation && previous.animation.cancel)
        previous.animation.cancel();
      animationLayer.innerHTML = '';
      if (previous) {
        const saved = savedToken(previous.actorId);
        if (saved) saved.style.visibility = '';
      }
    }
    function animateCommittedMove(actor,path,encounterId,mapId) {
      cancelTravel();
      if (!actor || !Array.isArray(path) || path.length < 2 ||
          (window.matchMedia && window.matchMedia(
            '(prefers-reduced-motion: reduce)').matches)) return false;
      const start = path[0], end = path[path.length-1];
      const state = {actorId:actor.id,encounterId,mapId,
        endX:end.x,endY:end.y,animation:null,timer:null};
      const label = escapeHtml(initials(actor.name));
      animationLayer.innerHTML = '<span class="dm-map-token' +
        (actor.kind === 'npc' ? ' enemy' : ' player') +
        '" style="left:' + (start.x*SIZE+3) + 'px;top:' +
        (start.y*SIZE+3) + 'px">' + label + '</span>';
      const token = animationLayer.querySelector &&
        animationLayer.querySelector('.dm-map-token');
      if (!token) { animationLayer.innerHTML=''; return false; }
      traveling = state;
      hideSavedToken();
      function finished() {
        if (traveling !== state) return;
        cancelTravel();
        render();
        notify('Movement completed to ' + helper.squareName(end.x,end.y) +
          '. AP and Surge have been updated.');
      }
      if (typeof token.animate === 'function') {
        const frames = path.map((point,index) => ({
          offset:index/(path.length-1),
          transform:'translate(' + ((point.x-start.x)*SIZE) + 'px, ' +
            ((point.y-start.y)*SIZE) + 'px)'
        }));
        // Each neighboring square is its own keyframe; 170 ms per square
        // makes travel visible without delaying verified state persistence.
        const motion=token.animate(frames,{
          duration:(path.length-1)*170,easing:'linear',fill:'forwards'
        });
        state.animation=motion;
        motion.finished.then(finished,finished);
      } else if (typeof window.setTimeout === 'function') {
        let index=0;
        function step() {
          if (traveling !== state) return;
          index++;
          if(index>=path.length){ finished(); return; }
          token.style.left=(path[index].x*SIZE+3)+'px';
          token.style.top=(path[index].y*SIZE+3)+'px';
          state.timer=window.setTimeout(step,170);
        }
        state.timer=window.setTimeout(step,170);
      } else { cancelTravel(); return false; }
      return true;
    }
    function notify(text,isError = false) {
      notice.textContent = text;
      notice.className = 'dm-map-notice' + (isError ? ' error' : '');
      if (isError) options.message(text,true);
    }
    function cancelPreview() { preview = null; render(); }
    function previewMessage(error) {
      const errors = {
        ACTOR_NOT_FOUND:'Select a combatant first.',
        TOKEN_NOT_PLACED:'This combatant needs a starting token on this map. Switch to DM placement.',
        OUT_OF_BOUNDS:'Destination is outside the map.',
        ALREADY_THERE:'This combatant is already on that square.',
        BLOCKED_SQUARE:'The destination is blocked by terrain.',
        OCCUPIED_SQUARE:'A combatant occupies the destination.',
        NO_PATH:'No walkable route reaches that square.'
      };
      return errors[error] || 'Cannot move to that square.';
    }
    function render() {
      let game;
      try { game = options.getGame(); } catch (error) {
        $('#dmMapStatus').textContent = 'Map storage is unavailable.';
        return;
      }
      const encounter = options.getEncounter();
      const map = helper.mapModel(game,maps);
      if (traveling) {
        const moving = encounter.actors && encounter.actors[traveling.actorId];
        if (encounter.id !== traveling.encounterId ||
            map.id !== traveling.mapId || !moving ||
            moving.x !== traveling.endX || moving.y !== traveling.endY)
          cancelTravel();
      }
      if (lastPhase !== encounter.phase) {
        modePick.value = encounter.phase === 'active' ? 'move' : 'place';
        lastPhase = encounter.phase;
        preview = null;
        notice.textContent = '';
      }
      modePick.disabled = encounter.phase !== 'active';
      const currentId = encounter.phase === 'active' ?
        encounter.order[encounter.turnIndex] : null;
      const turnKey = encounter.id + '|' + encounter.phase + '|' +
        (encounter.round || 0) + '|' + (currentId || '');
      if (lastTurnKey !== turnKey) {
        // The first actor in import order is not necessarily the first actor in
        // initiative. Follow the current turn automatically in movement mode.
        if (currentId) selectedActorId = currentId;
        preview = null;
        lastTurnKey = turnKey;
      }
      if (modePick.value === 'move' && currentId) selectedActorId = currentId;
      mapPick.value = map.id;
      mapChoices.innerHTML = Object.keys(maps).map(id =>
        '<button type="button" data-dm-map="' + escapeHtml(id) +
        '" class="dm-map-choice' + (map.id === id ? ' active' : '') +
        '" aria-pressed="' + (map.id === id) + '">' +
        escapeHtml(maps[id].short || maps[id].name || id) +
        '</button>').join('');
      const actors = (encounter.order || []).map(id =>
        Object.prototype.hasOwnProperty.call(encounter.actors,id) ? encounter.actors[id] : null)
        .filter(Boolean);
      if (!actors.some(a => a.id === selectedActorId))
        selectedActorId = actors[0] ? actors[0].id : '';
      actorPick.innerHTML = actors.length ? actors.map(actor =>
        '<option value="' + escapeHtml(actor.id) + '">' +
          escapeHtml(actor.name) + (actor.kind === 'npc' ? ' (NPC)' : ' (Player)') +
          '</option>').join('') : '<option value="">No combatants</option>';
      actorPick.value = selectedActorId;
      actorPick.disabled = !actors.length ||
        (modePick.value === 'move' && encounter.phase === 'active');
      $('#dmMapClear').disabled = !actors.some(a => a.id === selectedActorId && a.mapId === map.id);
      stage.style.width = map.cols * SIZE + 'px';
      stage.style.height = map.rows * SIZE + 'px';
      const img = map.def && map.def.img;
      stage.style.backgroundImage = img ? 'url("' + img + '")' : 'none';
      stage.style.backgroundSize = '100% 100%';
      grid.style.backgroundSize = SIZE + 'px ' + SIZE + 'px';
      const shown = helper.tokenActors(encounter,map);
      layer.innerHTML = shown.map(actor => {
        const current = encounter.phase === 'active' &&
          encounter.order[encounter.turnIndex] === actor.id;
        return '<button type="button" class="dm-map-token' +
          (actor.kind === 'npc' ? ' enemy' : ' player') +
          (current ? ' current' : '') +
          (actor.id === selectedActorId ? ' selected' : '') +
          '" style="left:' + (actor.x * SIZE + 3) + 'px;top:' + (actor.y * SIZE + 3) +
          'px" data-dm-token="' + escapeHtml(actor.id) + '" title="' +
          escapeHtml(actor.name + ' · ' + helper.squareName(actor.x,actor.y)) +
          '" aria-label="Select ' + escapeHtml(actor.name) + ', square ' +
          helper.squareName(actor.x,actor.y) + '">' +
          escapeHtml(initials(actor.name)) + '</button>';
      }).join('');
      if (traveling) hideSavedToken();
      if (preview && (preview.mapId !== map.id || preview.actorId !== selectedActorId ||
          preview.encounterId !== encounter.id || preview.revision !== encounter.revision ||
          modePick.value !== 'move')) preview = null;
      pathLayer.innerHTML = preview ? preview.route.path.slice(1).map((point,i) =>
        '<span class="dm-path-cell' + (i === preview.route.path.length-2 ? ' destination' : '') +
        '" style="left:' + (point.x*SIZE) + 'px;top:' + (point.y*SIZE) + 'px"></span>').join('') : '';
      $('#dmMovePreview').hidden = !preview;
      if (preview) {
        const plan = preview.plan;
        $('#dmMoveText').textContent = helper.squareName(preview.x,preview.y) +
          ' · ' + preview.route.ft + ' ft' +
          (preview.route.rough ? ' (' + preview.route.rough + ' difficult square(s))' : '') +
          ' · ' + plan.paid + ' AP + ' + plan.free + ' Surge AP' +
          (plan.fromLeft ? ' + ' + plan.fromLeft + ' ft carried' : '') +
          ' · ' + plan.leftAfter + ' ft left over after the move.';
      }
      const selected = actors.find(a=>a.id===selectedActorId);
      $('#dmMapStatus').textContent = map.name + ' · ' + map.cols + ' × ' + map.rows +
        ' squares · ' + shown.length + ' of ' + actors.length + ' combatants placed' +
        (selected ? ' · Selected: ' + selected.name : '') +
        (selected && encounter.phase === 'active' ? ' · ' + selected.speedFt + ' ft/AP · ' +
          (selected.apAvail + (selected.apGiven ? selected.apGiven.n : 0)) + ' AP remaining' : '');
      $('#dmMapHelp').textContent = encounter.phase === 'finished' ?
        'This combat has ended. Click Reuse roster / Edit setup above, then Start encounter to move with AP again. Free DM token placement still works here.' :
        modePick.value === 'move' ?
        'Combat movement: the current combatant is selected automatically. Click an open destination, review the route and click Confirm move.' :
        'DM placement: click an open square to position or relocate any token without AP cost. During combat, switch to Combat movement to spend AP.';
    }
    actorPick.addEventListener('change', () => {
      selectedActorId = actorPick.value;
      preview = null;
      render();
    });
    modePick.addEventListener('change', () => {
      cancelTravel();
      preview = null;
      notice.textContent = '';
      render();
    });
    function chooseMap(id) {
      if (!Object.prototype.hasOwnProperty.call(maps,id)) return;
      cancelTravel();
      preview = null;
      if (options.selectMap(id)) {
        notify('Showing ' + (maps[id].name || id) + '.');
      } else {
        notify('Map change could not be saved. Check browser storage.',true);
      }
      render();
    }
    // Large, explicit buttons work around native select popups that do not
    // render their options in some browser themes.
    mapChoices.addEventListener('click', event => {
      const button = event.target.closest('button[data-dm-map]');
      if (button) chooseMap(button.dataset.dmMap);
    });
    mapPick.addEventListener('change', () => chooseMap(mapPick.value));
    $('#dmMapClear').addEventListener('click', () => {
      if (!selectedActorId) return;
      preview = null;
      options.command('ClearToken',{actorId:selectedActorId});
    });
    $('#dmMoveCancel').addEventListener('click', cancelPreview);
    $('#dmMoveConfirm').addEventListener('click', () => {
      if (!preview) return;
      const target = preview;
      preview = null;
      const success = options.command('MoveToken',{
        actorId:target.actorId,x:target.x,y:target.y
      });
      if (success) {
        const encounter = options.getEncounter();
        const actor = encounter.actors[target.actorId];
        // Use the route recomputed by the validated command when available.
        const committedPath = success.event && Array.isArray(success.event.path)
          ? success.event.path : target.route.path;
        const animating = animateCommittedMove(actor,committedPath,
          encounter.id,target.mapId);
        if (animating) notify('Moving ' + actor.name +
          ' along the route. AP was saved when you confirmed.');
        else notify('Movement completed to ' +
          helper.squareName(target.x,target.y) + '. AP and Surge have been updated.');
      } else notify('Move was rejected. Check the combat tracker and try again.',true);
      render();
    });
    stage.addEventListener('click', event => {
      const selectedToken = event.target.closest('button[data-dm-token]');
      if (selectedToken) {
        const id = selectedToken.dataset.dmToken;
        const enc = options.getEncounter();
        const current = enc.phase === 'active' ?
          enc.actors[enc.order[enc.turnIndex]] : null;
        if (modePick.value === 'move' && current && id !== current.id) {
          notify('It is ' + current.name +
            '\'s turn. Use DM placement (free) to reposition other tokens.',true);
          return;
        }
        selectedActorId = id;
        preview = null;
        notice.textContent = '';
        render();
        return;
      }
      if (!selectedActorId) {
        options.message('Add a combatant before placing a token.',true);
        return;
      }
      if (traveling) cancelTravel();
      const rect = stage.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left) / SIZE);
      const y = Math.floor((event.clientY - rect.top) / SIZE);
      const map = helper.mapModel(options.getGame(),maps);
      const encounter = options.getEncounter();
      if (modePick.value === 'move') {
        if (encounter.phase !== 'active' || encounter.order[encounter.turnIndex] !== selectedActorId) {
          notify('Only the current combatant can move with AP. Change to DM placement for manual repositioning.',true);
          return;
        }
        const actor = encounter.actors[selectedActorId];
        if (actor.hp <= 0) {
          notify('A downed combatant cannot move using AP.',true);
          return;
        }
        const route = helper.movementRoute(encounter,map,selectedActorId,x,y);
        if (!route.ok) { notify(previewMessage(route.error),true); return; }
        const free = Math.max(0,actor.surgeMax-actor.move.surge);
        const plan = combat.movePlan(route.ft,actor.speedFt,actor.move,free);
        if (!actor.speedFt && plan.fromLeft < plan.ft) {
          notify('This combatant has 0 Movement and no leftover distance.',true);
          return;
        }
        if (plan.paid > combat.apAvailable(actor,actor.apAvail)) {
          notify('Not enough AP. This move costs ' + plan.paid +
            ' AP and ' + plan.free + ' Surge AP.',true);
          return;
        }
        preview = { actorId:selectedActorId,x,y,route,plan,mapId:map.id,
          encounterId:encounter.id,revision:encounter.revision };
        notify('Route preview ready. Review its cost, then press Confirm move to spend AP.');
        render();
        return;
      }
      const attempt = helper.checkPlacement(encounter,map,selectedActorId,x,y);
      if (!attempt.ok) { notify(previewMessage(attempt.error),true); return; }
      notice.textContent = '';
      options.command('PlaceToken',{actorId:selectedActorId,x,y});
    });
    return {render};
  }
  window.WBDMMap={init};
})();