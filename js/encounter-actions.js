/* Offline encounter command processor for Worlds Beyond.
 * Deterministic and DOM/storage/randomness-free. No authenticated server exists:
 * context.role and context.userId are trusted ONLY in a local DM prototype.
 * A future server MUST derive identity/roles and trusted rolls itself.
 */
(function () {
  'use strict';
  const combat = () => window.WBCombat;
  const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const copy = v => JSON.parse(JSON.stringify(v));
  const owns = (record, key) => Object.prototype.hasOwnProperty.call(record, key);
  const validId = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(v);
  const integer = (v, min, max) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  const MAX_ACTORS = 60, MAX_ACTIONS = 256;
  function fail(code) { return { ok: false, error: code }; }
  function actorFrom(value) {
    if (!isRecord(value) || !validId(value.id) || typeof value.name !== 'string' ||
        !value.name.trim() || value.name.length > 100) return null;
    const fields = {
      id: value.id, name: value.name.trim(),
      kind: value.kind === 'npc' ? 'npc' : 'pc',
      ownerId: typeof value.ownerId === 'string' ? value.ownerId.slice(0, 100) : '',
      hp: value.hp === undefined ? 10 : value.hp,
      maxHp: value.maxHp === undefined ? 10 : value.maxHp,
      ar: value.ar === undefined ? 0 : value.ar,
      deathThreshold: value.deathThreshold === undefined ? null : value.deathThreshold,
      down: value.down == null ? null : { mercy: !!value.down.mercy, stable: !!value.down.stable },
      trauma: value.trauma === undefined ? 0 : value.trauma,
      apMax: value.apMax === undefined ? 4 : value.apMax,
      apAvail: value.apAvail === undefined ? (value.apMax === undefined ? 4 : value.apMax) : value.apAvail,
      apGiven: value.apGiven == null ? null : {
        n: value.apGiven.n, fresh: !!value.apGiven.fresh
      },
      initiative: value.initiative === undefined ? 0 : value.initiative,
      x: value.x === undefined ? null : value.x,
      y: value.y === undefined ? null : value.y
    };
    if (!integer(fields.maxHp, 1, 1000000) ||
        !integer(fields.hp, -1000000, 1000000) ||
        !integer(fields.ar, 0, 1000000) ||
        !(fields.deathThreshold === null || integer(fields.deathThreshold, 0, 1000000)) ||
        !integer(fields.trauma, 0, 100000) ||
        !integer(fields.apMax, 0, 40) ||
        !integer(fields.apAvail, 0, fields.apMax) ||
        !integer(fields.initiative, -10000, 10000) ||
        !((fields.x === null && fields.y === null) ||
          (integer(fields.x, 0, 999) && integer(fields.y, 0, 999))) ||
        !(fields.apGiven === null || integer(fields.apGiven.n, 0, 40)) ||
        !(value.down == null || isRecord(value.down))) return null;
    if (fields.hp > 0) fields.down = null;
    else if (!fields.down) fields.down = { mercy: fields.hp < 0, stable: false };
    return fields;
  }
  function createEncounter(id) {
    return { version: 1, id: validId(id) ? id : 'local-encounter',
      revision: 0, phase: 'setup', round: 0, turnIndex: 0,
      order: [], actors: {}, applied: [] };
  }
  // This lives inside the separate DM-owned game document; legacy game saves
  // without an encounter remain unchanged.
  function normalizeEncounter(value) {
    if (!isRecord(value) || value.version !== 1) return null;
    const out = createEncounter(value.id);
    out.revision = integer(value.revision, 0, Number.MAX_SAFE_INTEGER) ? value.revision : 0;
    out.phase = ['setup', 'active', 'finished'].includes(value.phase) ? value.phase : 'setup';
    out.round = integer(value.round, 0, 100000000) ? value.round : 0;
    const actors = isRecord(value.actors) ? value.actors : {};
    Object.keys(actors).slice(0, MAX_ACTORS).forEach(id => {
      const actor = actorFrom(actors[id]);
      if (actor && id === actor.id) out.actors[id] = actor;
    });
    const ids = Object.keys(out.actors);
    out.order = Array.isArray(value.order)
      ? value.order.filter((id, i, arr) => validId(id) && owns(out.actors, id) && arr.indexOf(id) === i)
      : [];
    ids.forEach(id => { if (!out.order.includes(id)) out.order.push(id); });
    out.turnIndex = integer(value.turnIndex, 0, Math.max(0, out.order.length - 1)) ? value.turnIndex : 0;
    if (out.phase === 'active' && (!out.order.length || out.round < 1)) out.phase = 'setup';
    if (Array.isArray(value.applied)) out.applied = value.applied
      .filter(item => isRecord(item) && validId(item.id) &&
        typeof item.signature === 'string' && item.signature.length <= 4000)
      .slice(-MAX_ACTIONS).map(item => ({ id: item.id, signature: item.signature }));
    return out;
  }
  function signature(action, context) {
    function stable(value) {
      if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
      if (isRecord(value)) return '{' + Object.keys(value).sort().map(k =>
        JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
      return JSON.stringify(value);
    }
    return stable({ action, userId: context.userId, role: context.role });
  }
  function sortOrder(state) {
    const prior = new Map(state.order.map((id, i) => [id, i]));
    state.order.sort((a, b) => state.actors[b].initiative - state.actors[a].initiative ||
      prior.get(a) - prior.get(b));
  }
  function startTurn(actor) {
    actor.apAvail = actor.apMax;
    if (actor.apGiven && actor.apGiven.n > 0) {
      actor.apGiven = actor.apGiven.fresh
        ? { n: actor.apGiven.n, fresh: false } : null;
    } else actor.apGiven = null;
    // Same bleeding rule as the sheet: 4 at turn start until stabilized or dead.
    if (actor.hp <= 0 && actor.down && !actor.down.stable &&
        !combat().diesAt(actor.hp, actor.deathThreshold)) {
      const outcome = combat().damageHealth(actor.hp, 4, actor.deathThreshold, actor.down);
      actor.hp = outcome.after;
      actor.down = outcome.down;
      return outcome;
    }
    return null;
  }
  function applyAction(encounter, action, context) {
    if (!isRecord(action) || !validId(action.id) || typeof action.type !== 'string' ||
        !integer(action.expectedRevision, 0, Number.MAX_SAFE_INTEGER)) return fail('INVALID_ACTION');
    if (!isRecord(context) || !['dm', 'player'].includes(context.role) ||
        typeof context.userId !== 'string' || !context.userId) return fail('INVALID_CONTEXT');
    const before = normalizeEncounter(encounter);
    if (!before) return fail('INVALID_ENCOUNTER');
    const sig = signature(action, context);
    if (sig.length > 4000) return fail('ACTION_TOO_LARGE');
    const previous = before.applied.find(a => a.id === action.id);
    if (previous) return previous.signature === sig
      ? { ok: true, duplicate: true, state: before, event: null }
      : fail('ACTION_ID_CONFLICT');
    if (action.expectedRevision !== before.revision) return fail('REVISION_CONFLICT');
    const state = copy(before);
    const dm = context.role === 'dm';
    const actor = owns(state.actors, action.actorId) ? state.actors[action.actorId] : null;
    const active = state.phase === 'active' && state.order[state.turnIndex] === action.actorId;
    const canAct = actor && (dm || (actor.kind === 'pc' && actor.ownerId === context.userId));
    let event = { type: action.type, actorId: action.actorId || null };
    if (['AddActor', 'RemoveActor', 'SetInitiative', 'StartEncounter',
      'FinishEncounter', 'ApplyDamage', 'Heal', 'SetHealth', 'PlaceToken', 'GrantAP'].includes(action.type) && !dm)
      return fail('DM_ONLY');
    switch (action.type) {
      case 'AddActor': {
        if (state.phase !== 'setup') return fail('ENCOUNTER_NOT_IN_SETUP');
        const added = actorFrom(action.actor);
        if (!added) return fail('INVALID_ACTOR');
        if (owns(state.actors, added.id)) return fail('ACTOR_EXISTS');
        if (state.order.length >= MAX_ACTORS) return fail('ACTOR_LIMIT');
        state.actors[added.id] = added;
        state.order.push(added.id);
        event.actorId = added.id;
        break;
      }
      case 'RemoveActor': {
        if (state.phase !== 'setup') return fail('ENCOUNTER_NOT_IN_SETUP');
        if (!actor) return fail('ACTOR_NOT_FOUND');
        delete state.actors[action.actorId];
        state.order = state.order.filter(id => id !== action.actorId);
        state.turnIndex = 0;
        break;
      }
      case 'SetInitiative': {
        if (state.phase !== 'setup') return fail('ENCOUNTER_NOT_IN_SETUP');
        if (!actor) return fail('ACTOR_NOT_FOUND');
        if (!integer(action.initiative, -10000, 10000)) return fail('INVALID_INITIATIVE');
        actor.initiative = action.initiative;
        sortOrder(state);
        event.initiative = actor.initiative;
        break;
      }
      case 'StartEncounter': {
        if (state.phase !== 'setup' || !state.order.length) return fail('CANNOT_START');
        sortOrder(state);
        state.phase = 'active';
        state.round = 1;
        state.turnIndex = 0;
        const first = state.actors[state.order[0]];
        event.actorId = first.id;
        event.bleeding = startTurn(first);
        break;
      }
      case 'EndTurn': {
        if (state.phase !== 'active') return fail('ENCOUNTER_NOT_ACTIVE');
        if (!active) return fail('NOT_CURRENT_TURN');
        if (!canAct) return fail('NOT_YOUR_ACTOR');
        state.turnIndex++;
        if (state.turnIndex >= state.order.length) {
          state.turnIndex = 0;
          state.round++;
        }
        const next = state.actors[state.order[state.turnIndex]];
        event.actorId = next.id;
        event.round = state.round;
        event.bleeding = startTurn(next);
        break;
      }
      case 'SpendAP': {
        if (state.phase !== 'active') return fail('ENCOUNTER_NOT_ACTIVE');
        if (!active) return fail('NOT_CURRENT_TURN');
        if (!canAct) return fail('NOT_YOUR_ACTOR');
        if (!integer(action.cost, 1, 40)) return fail('INVALID_AP_COST');
        const available = combat().apAvailable(actor, actor.apAvail);
        if (available < action.cost) return fail('INSUFFICIENT_AP');
        Object.assign(actor, combat().spendAp(actor, actor.apAvail, action.cost));
        event.spent = action.cost;
        event.remaining = combat().apAvailable(actor, actor.apAvail);
        break;
      }
      case 'GrantAP': {
        if (!actor) return fail('ACTOR_NOT_FOUND');
        if (!integer(action.amount, 1, 40)) return fail('INVALID_AP_AMOUNT');
        const given = combat().givenAp(actor);
        if (given + action.amount > 40) return fail('AP_CAP');
        actor.apGiven = { n: given + action.amount, fresh: true };
        event.given = actor.apGiven.n;
        break;
      }
      case 'ApplyDamage': {
        if (!actor) return fail('ACTOR_NOT_FOUND');
        if (!integer(action.rawDamage, 0, 1000000)) return fail('INVALID_DAMAGE');
        if (action.resistant !== undefined && typeof action.resistant !== 'boolean' ||
            action.overwhelming !== undefined && typeof action.overwhelming !== 'boolean')
          return fail('INVALID_DAMAGE');
        // One hit per command; dual-wield attacks must be separate hits so AR
        // applies to each. The DM supplies a trusted, already-rolled raw amount.
        const actual = combat().afterArmor({
          dmg: action.rawDamage, res: action.resistant === true,
          ar: actor.ar, of: action.overwhelming === true
        });
        const outcome = combat().damageHealth(actor.hp, actual, actor.deathThreshold, actor.down);
        actor.hp = outcome.after;
        actor.down = outcome.down;
        event.damage = actual;
        event.outcome = outcome;
        break;
      }
      case 'Heal': {
        if (!actor) return fail('ACTOR_NOT_FOUND');
        if (!integer(action.amount, 0, 1000000)) return fail('INVALID_HEALING');
        const beforeHp = actor.hp;
        const healed = Math.min(1000000, beforeHp + action.amount);
        actor.hp = Math.min(healed, Math.max(beforeHp, actor.maxHp));
        if (beforeHp <= 0 && actor.hp > 0) {
          actor.trauma++;
          if (actor.deathThreshold != null) actor.deathThreshold =
            Math.max(0, actor.deathThreshold - 5);
          actor.down = null;
        }
        event.healed = actor.hp - beforeHp;
        event.hp = actor.hp;
        break;
      }
      case 'SetHealth': {
        if (!actor) return fail('ACTOR_NOT_FOUND');
        if (!integer(action.hp, -1000000, 1000000)) return fail('INVALID_HEALTH');
        actor.hp = action.hp;
        actor.down = actor.hp > 0 ? null : { mercy: actor.hp < 0, stable: false };
        event.hp = actor.hp;
        break;
      }
      case 'PlaceToken': {
        if (!actor) return fail('ACTOR_NOT_FOUND');
        if (!integer(action.x, 0, 999) || !integer(action.y, 0, 999))
          return fail('INVALID_POSITION');
        // Explicit DM placement (not a player MoveToken). Path/terrain/AP
        // validation will be added with the multiplayer battlemap protocol.
        if (isRecord(context.map) && integer(context.map.cols, 1, 1000) &&
            integer(context.map.rows, 1, 1000) &&
            (action.x >= context.map.cols || action.y >= context.map.rows))
          return fail('OUT_OF_BOUNDS');
        actor.x = action.x;
        actor.y = action.y;
        event.x = actor.x;
        event.y = actor.y;
        break;
      }
      case 'FinishEncounter': {
        if (state.phase !== 'active') return fail('ENCOUNTER_NOT_ACTIVE');
        state.phase = 'finished';
        event.actorId = null;
        break;
      }
      default: return fail('UNKNOWN_ACTION');
    }
    state.revision++;
    state.applied.push({ id: action.id, signature: sig });
    if (state.applied.length > MAX_ACTIONS) state.applied.shift();
    return { ok: true, duplicate: false, state, event };
  }
  window.WBEncounter = { createEncounter, normalizeEncounter, applyAction };
})();