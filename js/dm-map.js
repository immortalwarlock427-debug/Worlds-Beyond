/* Offline DM encounter map presentation.
 * Reads the shared map definition and encounter actor snapshots. Token clicks
 * use PlaceToken/ClearToken commands; no action point costs or player moves.
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
    const mapPick = $('#dmMapPick'), actorPick = $('#dmMapActor');
    const stage = $('#dmMapBoard'), layer = $('#dmMapTokens');
    const grid = $('#dmMapGrid');
    let selectedActorId = '';
    mapPick.innerHTML = Object.keys(maps).map(id =>
      '<option value="' + escapeHtml(id) + '">' +
        escapeHtml(maps[id].name || id) + '</option>').join('');
    function render() {
      let game;
      try { game = options.getGame(); } catch (error) {
        $('#dmMapStatus').textContent = 'Map storage is unavailable.';
        return;
      }
      const encounter = options.getEncounter();
      const map = helper.mapModel(game,maps);
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
      const selected = actors.find(a=>a.id===selectedActorId);
      $('#dmMapStatus').textContent = map.name + ' · ' + map.cols + ' × ' + map.rows +
        ' squares · ' + shown.length + ' of ' + actors.length + ' combatants placed' +
        (selected ? ' · Selected: ' + selected.name : '');
    }
    actorPick.addEventListener('change', () => {
      selectedActorId = actorPick.value;
      render();
    });
    mapPick.addEventListener('change', () => {
      if (!Object.prototype.hasOwnProperty.call(maps,mapPick.value)) return;
      options.selectMap(mapPick.value);
      render();
    });
    $('#dmMapClear').addEventListener('click', () => {
      if (!selectedActorId) return;
      options.command('ClearToken',{actorId:selectedActorId});
    });
    stage.addEventListener('click', event => {
      const selectedToken = event.target.closest('button[data-dm-token]');
      if (selectedToken) {
        selectedActorId = selectedToken.dataset.dmToken;
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
      const attempt = helper.checkPlacement(options.getEncounter(),map,selectedActorId,x,y);
      if (!attempt.ok) {
        const descriptions = {
          OUT_OF_BOUNDS: 'Click within the map grid.',
          BLOCKED_SQUARE: 'That square is blocked by terrain.',
          OCCUPIED_SQUARE: 'That square is already occupied by ' +
            (attempt.name || 'another combatant') + '.',
          ACTOR_NOT_FOUND: 'Select a valid combatant first.'
        };
        options.message(descriptions[attempt.error] || 'That placement is not allowed.',true);
        return;
      }
      options.command('PlaceToken',{actorId:selectedActorId,x,y});
    });
    return { render };
  }
  window.WBDMMap={init};
})();