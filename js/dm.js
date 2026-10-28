/* Offline DM Room controller. All encounter mutations route through WBEncounter.
 * Browser identity and rolled damage are local DM inputs, not secure multiplayer.
 */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const repository = window.WBPersistence.createLocalRepositories(() => window.localStorage).games;
  const core = window.WBEncounter;
  const context = { role: 'dm', userId: 'local-dm' };
  const quote = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  let encounter = core.createEncounter('local-encounter');
  let serial = 0;
  let dmMap = null;

  const errors = {
    REVISION_CONFLICT: 'The encounter changed in another tab. Latest data has been loaded; review it and try again.',
    ACTOR_EXISTS: 'This character is already in the encounter.',
    ACTOR_LIMIT: 'An encounter can contain up to 60 combatants.',
    INVALID_ACTOR: 'Check the combatant name and numeric values.',
    INSUFFICIENT_AP: 'Not enough AP for this action.',
    ENCOUNTER_NOT_IN_SETUP: 'Finish this encounter or create a new one before adding or editing combatants.',
    ENCOUNTER_NOT_ACTIVE: 'Start combat before taking that action.',
    ENCOUNTER_NOT_FINISHED: 'Finish combat before returning to roster setup.',
    CANNOT_START: 'Add at least one combatant before starting.',
    ACTOR_NOT_DOWN: 'Only a character at zero or lower Health can be stabilized.',
    INVALID_DAMAGE: 'Enter a valid nonnegative, whole-number damage amount.',
    INVALID_HEALING: 'Enter a valid nonnegative healing amount.',
    INVALID_HEALTH: 'Enter a valid whole-number Health value.',
    INVALID_AP_COST: 'Enter an AP cost between 1 and 40.',
    INVALID_AP_AMOUNT: 'Enter an AP grant between 1 and 40.',
    AP_CAP: 'Given AP would exceed the allowed maximum.',
    INVALID_INITIATIVE: 'Enter a whole-number initiative total.',
    NOT_CURRENT_TURN: 'Only the current combatant can spend AP or end their turn.',
    OUT_OF_BOUNDS: 'That square is outside the selected map.',
    BLOCKED_SQUARE: 'That square is blocked by terrain.',
    OCCUPIED_SQUARE: 'Another combatant occupies that square.',
    TOKEN_NOT_PLACED: 'Place this combatant on the map before using combat movement.',
    MAP_REQUIRED: 'A valid encounter map is required for movement.',
    ALREADY_THERE: 'That combatant is already on the destination square.',
    NO_PATH: 'There is no walkable route to that square.',
    NO_MOVEMENT: 'This combatant has no movement left.',
    ACTOR_UNCONSCIOUS: 'A downed combatant cannot use combat movement.'
  };
  function message(text, isError = false) {
    const el = $('#dmFeedback');
    el.textContent = text;
    el.classList.toggle('error', isError);
  }
  function saveMessage(text, isError = false) {
    const el = $('#dmSaveStatus');
    el.textContent = text;
    el.classList.toggle('error', isError);
  }
  function latestGame() {
    return window.WBGameState.normalizeGame(repository.load());
  }
  function newId(prefix) {
    const part = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Date.now().toString(36) + Math.floor(Math.random() * 100000000).toString(36);
    return prefix + part + (++serial).toString(36);
  }
  function syncWithStorage() {
    try {
      const game = latestGame();
      encounter = game.encounter || core.createEncounter('local-encounter');
      return true;
    } catch (err) {
      message('This browser cannot read local game storage. Your encounter may not be restored.', true);
      saveMessage('Storage unavailable', true);
      return false;
    }
  }
  function noConflict(latest) {
    const saved = latest.encounter || core.createEncounter('local-encounter');
    if (saved.id !== encounter.id || saved.revision !== encounter.revision) {
      encounter = saved;
      render();
      message(errors.REVISION_CONFLICT, true);
      return false;
    }
    return true;
  }
  function command(type, detail = {}, quiet = false) {
    let game;
    try {
      game = latestGame();
      if (!noConflict(game)) return false;
      const mapContext = type === 'PlaceToken' || type === 'MoveToken'
        ? { ...context, map: window.WBEncounterMap.mapModel(game,window.WB_MAPS) }
        : context;
      const result = core.applyAction(encounter, {
        id: newId('action'), type, expectedRevision: encounter.revision, ...detail
      }, mapContext);
      if (!result.ok) {
        if (!quiet) message(errors[result.error] || 'Action rejected: ' + result.error, true);
        return false;
      }
      repository.save({ ...game, encounter: result.state });
      encounter = result.state;
      render();
      saveMessage('Saved on this device · Revision ' + encounter.revision);
      if (!quiet) {
        const affected = result.event && result.event.actorId && encounter.actors[result.event.actorId];
        message(type.replace(/([A-Z])/g, ' $1').trim() +
          (affected ? ': ' + affected.name : '') + ' · Saved locally.');
      }
      // Movement animation consumes the validated path from the accepted
      // encounter event; other DM callers keep the existing boolean API.
      return type === 'MoveToken' ? result : true;
    } catch (err) {
      message('Could not save. Check browser storage and available space.', true);
      saveMessage('Not saved — storage error', true);
      return false;
    }
  }
  function num(value, blank = null) {
    if (value === '' || value == null) return blank;
    return Number(value);
  }
  function actorCard(actor, index) {
    const active = encounter.phase === 'active';
    const editing = encounter.phase === 'setup';
    const current = active && encounter.order[encounter.turnIndex] === actor.id;
    const hpState = actor.hp <= 0 ?
      (window.WBCombat.diesAt(actor.hp, actor.deathThreshold) ? 'Dead' :
        actor.down && actor.down.stable ? 'Stable' : 'Bleeding') : '';
    const head = '<header class="dm-actor-header"><div class="dm-actor-title">' +
      '<span class="dm-order">' + (index + 1) + '</span><h4>' + quote(actor.name) + '</h4>' +
      '<span class="dm-pill">' + (actor.kind === 'npc' ? 'NPC' : 'Player') + '</span>' +
      (current ? '<span class="dm-pill live">Current turn</span>' : '') +
      (hpState ? '<span class="dm-pill down">' + hpState + '</span>' : '') +
      '</div><div class="dm-actor-meta">' +
      '<span>Initiative <b>' + actor.initiative + '</b></span>' +
      (actor.initiativeBonus == null ? '' : '<span>Initiative bonus <b>' +
        (actor.initiativeBonus >= 0 ? '+' : '') + actor.initiativeBonus + '</b></span>') +
      '<span>HP <b class="' + (actor.hp <= 0 ? 'down' : '') + '">' +
      actor.hp + ' / ' + actor.maxHp + '</b></span>' +
      '<span>AR <b>' + actor.ar + '</b></span>' +
      '<span>AP <b>' + (actor.apAvail + (actor.apGiven ? actor.apGiven.n : 0)) +
      ' / ' + actor.apMax + '</b></span>' +
      '<span>Movement <b>' + actor.speedFt + ' ft/AP</b></span>' +
      (actor.surgeMax ? '<span>Surge <b>' +
        (actor.surgeMax - actor.move.surge) + ' / ' + actor.surgeMax + '</b></span>' : '') +
      (active ? '<span>Moved <b>' + actor.move.ft + ' ft</b></span>' : '') +
      '</div></header>';
    let body = '';
    if (editing) {
      body = '<form class="dm-actor-setup" data-dm-action="edit" data-actor="' + quote(actor.id) + '">' +
        '<label class="dm-name">Name<input name="name" maxlength="100" value="' + quote(actor.name) + '" required></label>' +
        '<label>HP<input type="number" name="hp" min="-1000000" max="1000000" value="' + actor.hp + '" required></label>' +
        '<label>Max HP<input type="number" name="maxHp" min="1" max="1000000" value="' + actor.maxHp + '" required></label>' +
        '<label>AR<input type="number" name="ar" min="0" max="1000000" value="' + actor.ar + '" required></label>' +
        '<label>AP max<input type="number" name="apMax" min="0" max="40" value="' + actor.apMax + '" required></label>' +
        '<label>Movement ft/AP<input type="number" name="speedFt" min="0" max="10000" value="' + actor.speedFt + '" required></label>' +
        '<label>Surge free AP<input type="number" name="surgeMax" min="0" max="2" value="' + actor.surgeMax + '" required></label>' +
        '<label>Death threshold<input type="number" name="deathThreshold" min="0" max="1000000" value="' +
          (actor.deathThreshold == null ? '' : actor.deathThreshold) + '"></label>' +
        '<label>Initiative total<input type="number" name="initiative" min="-10000" max="10000" value="' +
          actor.initiative + '" required></label>' +
        '<button type="submit" class="btn strong dm-setup-btn">Save values</button>' +
        '<button type="button" class="btn" data-dm-click="remove" data-actor="' + quote(actor.id) + '">Remove</button></form>';
    } else if (active) {
      body = '<div class="dm-actions">' +
        '<form data-dm-action="damage" data-actor="' + quote(actor.id) + '" class="dm-damage">' +
          '<label>Raw damage<input type="number" name="rawDamage" min="0" max="1000000" value="0" required></label>' +
          '<label class="dm-check"><input type="checkbox" name="resistant"> Resistant</label>' +
          '<label class="dm-check"><input type="checkbox" name="overwhelming"> Overwhelming</label>' +
          '<button class="btn" type="submit">Deal damage</button></form>' +
        '<form data-dm-action="heal" data-actor="' + quote(actor.id) + '">' +
          '<label>Heal<input type="number" name="amount" min="0" max="1000000" value="1" required></label>' +
          '<button class="btn" type="submit">Heal</button></form>' +
        '<form data-dm-action="sethp" data-actor="' + quote(actor.id) + '">' +
          '<label>Set HP<input type="number" name="hp" min="-1000000" max="1000000" value="' + actor.hp + '" required></label>' +
          '<button class="btn" type="submit">Set HP</button></form>' +
        '<form data-dm-action="spendap" data-actor="' + quote(actor.id) + '">' +
          '<label>Spend AP<input type="number" name="cost" min="1" max="40" value="1" required></label>' +
          '<button class="btn" type="submit"' + (current ? '' : ' disabled') + '>Spend AP</button></form>' +
        '<form data-dm-action="grantap" data-actor="' + quote(actor.id) + '">' +
          '<label>Give AP<input type="number" name="amount" min="1" max="40" value="1" required></label>' +
          '<button class="btn" type="submit">Grant AP</button></form>' +
        (actor.hp <= 0 ? '<button class="btn" data-dm-click="stable" data-actor="' +
          quote(actor.id) + '" data-stable="' + (actor.down && actor.down.stable ? 'false' : 'true') +
          '" type="button">' + (actor.down && actor.down.stable ? 'Resume bleeding' : 'Stabilize') + '</button>' : '') +
        '</div>';
    } else {
      body = '<p class="dm-help">Combat finished. Create a new encounter to assemble another roster.</p>';
    }
    return '<article class="dm-actor' + (current ? ' current' : '') + '" data-actor-card="' +
      quote(actor.id) + '">' + head + body + '</article>';
  }
  function render() {
    const setup = encounter.phase === 'setup', active = encounter.phase === 'active';
    $('#setupSection').hidden = !setup;
    $('#startEncounter').hidden = !setup;
    $('#startEncounter').disabled = !encounter.order.length;
    $('#nextTurn').hidden = !active;
    $('#reuseRoster').hidden = encounter.phase !== 'finished';
    $('#finishEncounter').hidden = !active;
    $('#encounterSummary').textContent = encounter.order.length + ' combatant' +
      (encounter.order.length === 1 ? '' : 's') + ' · Revision ' + encounter.revision +
      ' · ' + (setup ? 'Setting up' : active ? 'In combat' : 'Finished');
    const current = active && encounter.actors[encounter.order[encounter.turnIndex]];
    $('#turnHeading').textContent = setup ? 'Not started' :
      active ? 'Round ' + encounter.round + ' · ' + current.name : 'Encounter finished';
    $('#turnHint').textContent = setup ? 'Set initiative totals before starting combat.' :
      active ? 'Acting: ' + current.name + ' · AP ' + (current.apAvail +
        (current.apGiven ? current.apGiven.n : 0)) + ' remaining' :
        'Saved locally. Choose New encounter to begin another.';
    const actors = encounter.order.map(id => encounter.actors[id]).filter(Boolean);
    $('#dmActorList').innerHTML = actors.length ?
      actors.map((actor, i) => actorCard(actor, i)).join('') :
      '<p class="dm-empty">No combatants yet. Import a character or create an NPC above.</p>';
    $('#rosterHint').textContent = setup ?
      'Enter initiative totals and save each row. Highest acts first; ties keep the previous order.' :
      active ? 'The highlighted combatant is taking their turn.' : 'Completed roster';
    if (dmMap) dmMap.render();
  }
  $('#dmImport').addEventListener('click', async () => {
    if (encounter.phase !== 'setup') return;
    const input = $('#dmCharacterFiles');
    const files = Array.from(input.files || []);
    if (!files.length) { message('Select one or more exported character JSON files first.', true); return; }
    const btn = $('#dmImport');
    btn.disabled = true;
    let imported = 0;
    const warnings = [];
    try {
      for (const file of files.slice(0, 60)) {
        if (file.size > 12000000) { warnings.push(file.name + ': exceeds 12 MB'); continue; }
        let state;
        try { state = window.WBPersistence.parseCharacterFile(await file.text()); }
        catch (err) { state = null; }
        if (!state) { warnings.push(file.name + ': invalid or unsupported character export'); continue; }
        const converted = window.WBDMCharacters.fromCharacter(state, newId('import'));
        if (!converted) { warnings.push(file.name + ': missing character data'); continue; }
        if (!command('AddActor', { actor: converted.actor }, true)) {
          warnings.push(file.name + ': could not add (duplicate ID, full roster, or storage error)');
          continue;
        }
        imported++;
        if (converted.warnings.length)
          warnings.push(converted.actor.name + ': ' + converted.warnings.join(' '));
      }
    } finally {
      btn.disabled = false;
      input.value = '';
    }
    message('Imported ' + imported + ' character' + (imported === 1 ? '' : 's') + '.' +
      (warnings.length ? ' Review: ' + warnings.slice(0, 4).join(' | ') +
        (warnings.length > 4 ? ' (and ' + (warnings.length - 4) + ' more)' : '') : '') ,
      warnings.length > 0 || !imported);
  });
  $('#dmNpcForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const actor = {
      id: newId('npc'), name: String(fd.get('name') || '').trim(), kind: 'npc',
      hp: num(fd.get('maxHp')), maxHp: num(fd.get('maxHp')),
      ar: num(fd.get('ar')), apMax: num(fd.get('apMax')), apAvail: num(fd.get('apMax')),
      initiative: num(fd.get('initiative')),
      speedFt:num(fd.get('speedFt')), surgeMax:num(fd.get('surgeMax')),
      deathThreshold: num(fd.get('deathThreshold'))
    };
    if (command('AddActor', { actor })) ev.currentTarget.reset();
  });
  $('#dmActorList').addEventListener('submit', ev => {
    const form = ev.target.closest('form[data-dm-action]');
    if (!form) return;
    ev.preventDefault();
    const id = form.dataset.actor;
    const fd = new FormData(form);
    const which = form.dataset.dmAction;
    if (which === 'edit') {
      command('UpdateActor', { actorId:id, changes:{
        name:String(fd.get('name') || '').trim(),
        hp:num(fd.get('hp')), maxHp:num(fd.get('maxHp')),
        ar:num(fd.get('ar')), apMax:num(fd.get('apMax')),
        speedFt:num(fd.get('speedFt')), surgeMax:num(fd.get('surgeMax')),
        deathThreshold:num(fd.get('deathThreshold')),
        initiative:num(fd.get('initiative'))
      } });
    } else if (which === 'damage') {
      command('ApplyDamage', { actorId:id, rawDamage:num(fd.get('rawDamage')),
        resistant:fd.has('resistant'), overwhelming:fd.has('overwhelming') });
    } else if (which === 'heal') {
      command('Heal', { actorId:id, amount:num(fd.get('amount')) });
    } else if (which === 'sethp') {
      command('SetHealth', { actorId:id, hp:num(fd.get('hp')) });
    } else if (which === 'spendap') {
      command('SpendAP', { actorId:id, cost:num(fd.get('cost')) });
    } else if (which === 'grantap') {
      command('GrantAP', { actorId:id, amount:num(fd.get('amount')) });
    }
  });
  $('#dmActorList').addEventListener('click', ev => {
    const btn = ev.target.closest('button[data-dm-click]');
    if (!btn) return;
    const actorId = btn.dataset.actor;
    if (btn.dataset.dmClick === 'remove') {
      const actor = encounter.actors[actorId];
      if (actor && window.confirm('Remove ' + actor.name + ' from the encounter?'))
        command('RemoveActor', { actorId });
    } else if (btn.dataset.dmClick === 'stable') {
      command('SetStable', { actorId, stable:btn.dataset.stable === 'true' });
    }
  });
  $('#startEncounter').addEventListener('click', () => command('StartEncounter'));
  $('#reuseRoster').addEventListener('click', () => {
    if (!encounter.order.length) return;
    // Reopen setup without resetting any imported character snapshots.
    if (command('ReopenSetup')) message(
      'Roster reopened. Characters and token positions are preserved. AP and movement are reset. Edit Health, initiative, or add combatants before starting another fight.');
  });
  $('#nextTurn').addEventListener('click', () => {
    const actorId = encounter.order[encounter.turnIndex];
    if (actorId) command('EndTurn', { actorId });
  });
  $('#finishEncounter').addEventListener('click', () => {
    if (window.confirm('Finish this encounter? The completed roster stays saved until you make a new encounter.'))
      command('FinishEncounter');
  });
  $('#newEncounter').addEventListener('click', () => {
    if (!window.confirm('Clear the entire encounter roster and begin empty? Use Reuse roster after finishing a combat to keep imported characters. Your player files and battlemap will not be changed.'))
      return;
    try {
      const game = latestGame();
      if (!noConflict(game)) return;
      const next = core.createEncounter(newId('encounter'));
      repository.save({ ...game, encounter: next });
      encounter = next;
      render();
      message('New encounter ready. Your character and battlemap saves are untouched.');
      saveMessage('New encounter saved on this device');
    } catch (err) {
      message('New encounter could not be saved.', true);
      saveMessage('Not saved — storage error', true);
    }
  });
  window.addEventListener('storage', event => {
    if (event.key === window.WBPersistence.GAME_KEY) {
      if (syncWithStorage()) {
        render();
        message('The game changed in another tab; refreshed to its latest local encounter.');
      }
    }
  });
  function selectBattlemap(id) {
    if (!Object.prototype.hasOwnProperty.call(window.WB_MAPS,id)) return false;
    try {
      const game = latestGame();
      if (!noConflict(game)) return false;
      const def = window.WB_MAPS[id];
      const old = game.map || {};
      const next = { ...game, map: {
        ...old, id, rev:def.rev || null,
        cols:def.cols || old.cols || 20, rows:def.rows || old.rows || 15
      } };
      repository.save(next);
      render();
      message('Selected ' + def.name + '. Combatant placements on other maps are preserved.');
      saveMessage('Battlemap selection saved on this device');
      return true;
    } catch (error) {
      message('Could not save the selected map. Browser storage might be unavailable.',true);
      saveMessage('Map change not saved',true);
      return false;
    }
  }
  dmMap = window.WBDMMap.init({
    getGame:latestGame, getEncounter:() => encounter,
    command, selectMap:selectBattlemap, message
  });
  const loaded = syncWithStorage();
  render();
  if (loaded) {
    message('DM Room ready. Import player characters or create enemies to begin.');
    saveMessage('Saved locally · Revision ' + encounter.revision);
  }
})();