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
    const mapPick = $('#dmMapPick'), actorPick = $('#dmMapActor');
    const stage = $('#dmMapBoard'), layer = $('#dmMapTokens');
    const grid = $('#dmMapGrid'), pathLayer = $('#dmMapPath');
    const modePick = $('#dmMapMode');
    let selectedActorId = '', preview = null, lastPhase = null;
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
      options.message(errors[error] || 'Cannot move to that square.',true);
    }
    function render() {
      let game;
      try { game = options.getGame(); } catch (error) {
        $('#dmMapStatus').textContent = 'Map storage is unavailable.';
        return;
      }
      const encounter = options.getEncounter();
      const map = helper.mapModel(game,maps);
      if (lastPhase !== encounter.phase) {
        modePick.value = encounter.phase === 'active' ? 'move' : 'place';
        lastPhase = encounter.phase;
        preview = null;
      }
      mapPick.value = map.id;
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
      actorPick.disabled = !actors.length;
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
      $('#dmMapHelp').textContent = modePick.value === 'move' ?
        'Combat movement: select the current combatant, then click an open destination to preview distance and AP before confirming.' :
        'DM placement: click an open square to position or relocate any token without AP cost. Switch modes to spend AP for real movement.';
    }
    actorPick.addEventListener('change', () => {
      selectedActorId = actorPick.value;
      preview = null;
      render();
    });
    modePick.addEventListener('change', cancelPreview);
    mapPick.addEventListener('change', () => {
      if (!Object.prototype.hasOwnProperty.call(maps,mapPick.value)) return;
      preview = null;
      options.selectMap(mapPick.value);
      render();
    });
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
      options.command('MoveToken',{actorId:target.actorId,x:target.x,y:target.y});
      render();
    });
    stage.addEventListener('click', event => {
      const selectedToken = event.target.closest('button[data-dm-token]');
      if (selectedToken) {
        selectedActorId = selectedToken.dataset.dmToken;
        preview = null;
        render();
        return;
      }
      if (!selectedActorId) {
        options.message('Add a combatant before placing a token.',true);
        return;
      }
      const rect = stage.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left) / SIZE);
      const y = Math.floor((event.clientY - rect.top) / SIZE);
      const map = helper.mapModel(options.getGame(),maps);
      const encounter = options.getEncounter();
      if (modePick.value === 'move') {
        if (encounter.phase !== 'active' || encounter.order[encounter.turnIndex] !== selectedActorId) {
          options.message('Only the current combatant can move using AP. Use DM placement for administrative changes.',true);
          return;
        }
        const actor = encounter.actors[selectedActorId];
        if (actor.hp <= 0) {
          options.message('A downed combatant cannot move using AP.',true);
          return;
        }
        const route = helper.movementRoute(encounter,map,selectedActorId,x,y);
        if (!route.ok) { previewMessage(route.error); return; }
        const free = Math.max(0,actor.surgeMax-actor.move.surge);
        const plan = combat.movePlan(route.ft,actor.speedFt,actor.move,free);
        if (!actor.speedFt && plan.fromLeft < plan.ft) {
          options.message('This combatant has 0 Movement and no leftover distance.',true);
          return;
        }
        if (plan.paid > combat.apAvailable(actor,actor.apAvail)) {
          options.message('Not enough AP. This move costs ' + plan.paid +
            ' AP and ' + plan.free + ' Surge AP.',true);
          return;
        }
        preview = { actorId:selectedActorId,x,y,route,plan,mapId:map.id,
          encounterId:encounter.id,revision:encounter.revision };
        render();
        return;
      }
      const attempt = helper.checkPlacement(encounter,map,selectedActorId,x,y);
      if (!attempt.ok) { previewMessage(attempt.error); return; }
      options.command('PlaceToken',{actorId:selectedActorId,x,y});
    });
    return {render};
  }
  window.WBDMMap={init};
})();