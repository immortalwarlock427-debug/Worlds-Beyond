/* Worlds Beyond: character-specific Ability Library.
   Records homebrew abilities without enforcing effects or changing combat math. */
(function () {
  'use strict';
  const id = () => 'abil' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clean = (value, max) => String(value == null ? '' : value).slice(0, max);
  const optionalNumber = (n) => {
    if (n == null || String(n).trim() === '') return '';
    const value = Number(n);
    return Number.isFinite(value) ? Math.max(0, Math.min(999999, Math.round(value))) : '';
  };
  const TYPES = ['active', 'passive', 'reaction', 'other'];
  const propNames = ['name', 'category', 'type', 'description', 'apCost', 'resourceId',
    'resourceCost', 'cooldown', 'duration', 'uses', 'capacityMax', 'notes'];
  const numerical = new Set(['apCost', 'resourceCost', 'cooldown', 'duration', 'uses', 'capacityMax']);
  const STATS = ['STR', 'VIT', 'DEX', 'AGL', 'INT', 'WIS', 'CHA', 'FTH'];
  const effectTargets = ['none', 'movement', 'armor', 'evasion', 'stat', 'resource-max'];
  const effectId = () => 'eff' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const MAX_EFFECTS = 12;
  const formId = () => 'load' + Date.now().toString(36) + Math.random().toString(36).slice(2,10);
  const MAX_LOADOUTS = 30;
  // Form-specific score adjustments are derived like gear bonuses. They never
  // become purchased stat points or alter stored base scores.
  const formAdjustment = value => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(-28, Math.min(28, Math.round(n))) : 0;
  };
  // Keep availability logic in sync with WBResources. Isolated ability tests do
  // not load the resource UI, so these checks must also work independently.
  function resourceAvailable(state, resource) {
    if (!state.abilityLoadouts || !state.abilityLoadouts.length) return true;
    const ids = Array.isArray(resource.loadoutIds) ? resource.loadoutIds : [];
    return !ids.length || ids.includes(state.activeAbilityLoadoutId);
  }
  function formManaAvailable(state) {
    const form = (state.abilityLoadouts || []).find(x => x.id === state.activeAbilityLoadoutId);
    return form && form.manaMode === 'show' ? true :
      form && form.manaMode === 'hide' ? false : state.showMana !== false;
  }
  function formStatBonus(state, stat) {
    if (!STATS.includes(stat)) return 0;
    const form = (state.abilityLoadouts || []).find(x => x.id === state.activeAbilityLoadoutId);
    return form && form.statBonuses ? formAdjustment(form.statBonuses[stat]) : 0;
  }
  function selectLoadout(state, identifier) {
    if (identifier && !(state.abilityLoadouts || []).some(x => x.id === identifier)) return false;
    if (window.WBEquipment) window.WBEquipment.switchForm(state, identifier);
    state.activeAbilityLoadoutId = identifier || '';
    const form = (state.abilityLoadouts || []).find(x => x.id === state.activeAbilityLoadoutId);
    const portrait = form && (state.portraits || []).find(x => x.id === form.portraitId);
    if (portrait) state.formId = portrait.id;
    return true;
  }
  // Choosing a portrait from Overview is the inverse of selectLoadout.
  // Prefer the already selected form when multiple forms share one portrait;
  // otherwise pick the first linked form. Unlinked portraits mean Base.
  function selectPortrait(state, portraitId) {
    if (!(state.portraits || []).some(x => x.id === portraitId)) return false;
    state.formId = portraitId;
    const forms = (state.abilityLoadouts || []).filter(x => x.portraitId === portraitId);
    const current = forms.find(x => x.id === state.activeAbilityLoadoutId);
    const nextFormId = current ? current.id : forms.length ? forms[0].id : '';
    if (window.WBEquipment) window.WBEquipment.switchForm(state, nextFormId);
    state.activeAbilityLoadoutId = nextFormId;
    return true;
  }
  function configureLoadout(state, identifier, property, value) {
    const form = (state.abilityLoadouts || []).find(x => x.id === identifier);
    if (!form) return false;
    if (property === 'manaMode') {
      form.manaMode = ['inherit', 'show', 'hide'].includes(value) ? value : 'inherit';
      return true;
    }
    if (property === 'portraitId') {
      const portrait = (state.portraits || []).find(x => x.id === value);
      form.portraitId = portrait ? portrait.id : '';
      if (form.id === state.activeAbilityLoadoutId && portrait) state.formId = portrait.id;
      return true;
    }
    if (!STATS.includes(property)) return false;
    form.statBonuses[property] = formAdjustment(value);
    return true;
  }
  function loadoutVisible(state, ability) {
    if (!Array.isArray(state.abilityLoadouts) || !state.abilityLoadouts.length) return true;
    const ids = Array.isArray(ability.loadoutIds) ? ability.loadoutIds : [];
    return ids.length === 0 || (ids.includes(state.activeAbilityLoadoutId));
  }
  function createLoadout(state, name) {
    const text = clean(name,60).trim();
    if (!text || !Array.isArray(state.abilityLoadouts) || state.abilityLoadouts.length >= MAX_LOADOUTS) return null;
    const entry = { id: formId(), name: text, portraitId: '', statBonuses: {}, manaMode: 'inherit' };
    state.abilityLoadouts.push(entry);
    if (window.WBEquipment) window.WBEquipment.switchForm(state, entry.id); // New form copies current gear.
    state.activeAbilityLoadoutId = entry.id;
    return entry;
  }
  // Select specific forms directly even when an ability starts as shared.
  // Empty membership always means shared across all forms; specific selections
  // replace that shared setting without a separate uncheck step.
  function setLoadoutMembership(state, ability, mode, identifier, checked) {
    if (!ability || !Array.isArray(state.abilityLoadouts) || !state.abilityLoadouts.length) return false;
    const forms = state.abilityLoadouts;
    if (mode === 'shared') {
      if (checked) ability.loadoutIds = [];
      else ability.loadoutIds = [forms.find(x => x.id === state.activeAbilityLoadoutId)?.id || forms[0].id];
      return true;
    }
    if (mode !== 'member' || !forms.some(x => x.id === identifier)) return false;
    const selected = new Set(ability.loadoutIds || []);
    if (checked) selected.add(identifier);
    else selected.delete(identifier);
    ability.loadoutIds = [...selected];
    return true; // Empty = shared again when the last selected form is cleared.
  }

  function removeLoadout(state, identifier) {
    const before = (state.abilityLoadouts || []).length;
    if ((state.abilityLoadouts || []).some(x => x.id === identifier) &&
        state.activeAbilityLoadoutId === identifier && window.WBEquipment) {
      window.WBEquipment.switchForm(state, ''); // Restore Base gear before removing active form.
    }
    state.abilityLoadouts = (state.abilityLoadouts || []).filter(x => x.id !== identifier);
    if (state.abilityLoadouts.length === before) return false;
    for (const a of (state.abilities || [])) {
      if (Array.isArray(a.loadoutIds)) a.loadoutIds = a.loadoutIds.filter(id => id !== identifier);
    }
    for (const r of (state.resources || [])) {
      if (Array.isArray(r.loadoutIds)) r.loadoutIds = r.loadoutIds.filter(id => id !== identifier);
    }
    if (state.activeAbilityLoadoutId === identifier) state.activeAbilityLoadoutId = '';
    if (window.WBEquipment) window.WBEquipment.removeForm(state, identifier);
    return true;
  }
  const signedNumber = (n) => {
    if (n == null || String(n).trim() === '') return 0;
    const value = Number(n);
    return Number.isFinite(value) ? Math.max(-99999, Math.min(99999, Math.round(value))) : 0;
  };
  // Migrates existing single-effect characters; effects always describe temporary,
  // derived bonuses. Base scores, equipment and resource maximums stay untouched.
  function normalizeEffect(e) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    return {
      id: typeof e.id === 'string' && /^eff[a-z0-9]{6,40}$/.test(e.id) ? e.id : effectId(),
      target: effectTargets.includes(e.target) ? e.target : 'none',
      value: signedNumber(e.value),
      stat: STATS.includes(e.stat) ? e.stat : 'STR',
      resourceId: clean(e.resourceId, 100)
    };
  }
  function normalizeEffects(a) {
    const source = Array.isArray(a.effects) ? a.effects :
      (a.effectTarget && a.effectTarget !== 'none' ? [{
        target: a.effectTarget, value: a.effectValue
      }] : []);
    const seen = new Set();
    return source.slice(0, MAX_EFFECTS).map(normalizeEffect).filter(Boolean).map((e) => {
      if (seen.has(e.id)) e.id = effectId();
      seen.add(e.id);
      return e;
    });
  }
  function effectBonus(state, target, key) {
    return (state.abilities || []).reduce((total, a) => {
      if (!(a.durationLeft > 0)) return total;
      return total + (a.effects || []).reduce((subtotal, e) =>
        subtotal + (e.target === target &&
          (target === 'stat' ? e.stat === key :
           target === 'resource-max' ? e.resourceId === key : true) ?
           signedNumber(e.value) : 0), 0);
    }, 0);
  }
  const movementBonus = (state) => effectBonus(state, 'movement');
  function resourceMax(state, resource) {
    return Math.max(1, (Number(resource.max) || 1) + effectBonus(state, 'resource-max', resource.id));
  }
  // Display and combat must agree: calculate the same effective movement once
  // from an unmodified base, never by adding a bonus to an already-adjusted input.
  function effectiveMovement(state, base) {
    const value = Number(base);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value + movementBonus(state))) : 0;
  }

  function normalizeAbility(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return {
      id: typeof value.id === 'string' && /^abil[a-z0-9]{6,40}$/.test(value.id) ? value.id : id(),
      name: clean(value.name, 100).trim() || 'Unnamed ability',
      category: clean(value.category, 60).trim() || 'General',
      type: TYPES.includes(value.type) ? value.type : 'active',
      description: clean(value.description, 12000),
      notes: clean(value.notes, 6000),
      apCost: optionalNumber(value.apCost),
      resourceId: clean(value.resourceId, 100),
      resourceCost: optionalNumber(value.resourceCost),
      cooldown: optionalNumber(value.cooldown),
      duration: optionalNumber(value.duration),
      uses: optionalNumber(value.uses),
      usesLeft: optionalNumber(value.uses) === '' ? null :
        Math.min(optionalNumber(value.uses), value.usesLeft == null ? optionalNumber(value.uses) : optionalNumber(value.usesLeft)),
      // Capacity limits how many creations/objects can exist at once. Unlike limited
      // uses, it is not refilled at rest or consumed permanently by activation.
      capacityMax: optionalNumber(value.capacityMax),
      capacityCurrent: optionalNumber(value.capacityMax) === '' ? 0 :
        Math.min(optionalNumber(value.capacityMax), optionalNumber(value.capacityCurrent) || 0),
      cooldownLeft: optionalNumber(value.cooldownLeft) || 0,
      durationLeft: optionalNumber(value.durationLeft) || 0,
      effects: normalizeEffects(value),
      loadoutIds: Array.isArray(value.loadoutIds) ?
        [...new Set(value.loadoutIds.filter(x => typeof x === 'string'))].slice(0,MAX_LOADOUTS) : [],
      favorite: value.favorite === true
    };
  }

  function normalizeState(state) {
    const ids = new Set();
    state.abilityLoadouts = (Array.isArray(state.abilityLoadouts) ? state.abilityLoadouts : [])
      .filter(x => x && typeof x === 'object' && !Array.isArray(x) && clean(x.name,60).trim())
      .slice(0, MAX_LOADOUTS).map(x => {
        let key = typeof x.id === 'string' && /^load[a-z0-9]{6,40}$/.test(x.id) ? x.id : formId();
        if (ids.has(key)) key = formId();
        ids.add(key);
        const bonuses = x.statBonuses && typeof x.statBonuses === 'object' &&
          !Array.isArray(x.statBonuses) ? x.statBonuses : {};
        const statBonuses = {};
        STATS.forEach(k => { const amount = formAdjustment(bonuses[k]);
          if (amount) statBonuses[k] = amount;
        });
        return { id:key, name:clean(x.name,60).trim(),
          portraitId: clean(x.portraitId,100), statBonuses,
          manaMode: ['show', 'hide'].includes(x.manaMode) ? x.manaMode : 'inherit' };
      });
    const valid = new Set(state.abilityLoadouts.map(x => x.id));
    state.activeAbilityLoadoutId = valid.has(state.activeAbilityLoadoutId) ?
      state.activeAbilityLoadoutId : '';
    (state.resources || []).forEach(resource => {
      if (Array.isArray(resource.loadoutIds)) resource.loadoutIds =
        [...new Set(resource.loadoutIds.filter(key => valid.has(key)))];
    });
    ids.clear();
    state.abilities = (Array.isArray(state.abilities) ? state.abilities : [])
      .map(normalizeAbility).filter(Boolean).map(ability => {
        if (ids.has(ability.id)) ability.id = id();
        ids.add(ability.id);
        ability.loadoutIds = ability.loadoutIds.filter(key => valid.has(key));
        return ability;
      });
  }

  // Three independent trackers: limited uses, cooldown lock, and active duration.
  // The same validation drives both activation and the 'Usable now' filter.
  function checkActivation(state, abilityId, controls) {
    const a = state.abilities.find((x) => x.id === abilityId);
    if (!a) return { ok: false, message: 'Ability not found.' };
    if (!loadoutVisible(state, a)) return { ok: false, message: a.name + ' is unavailable in your current ability form.' };
    if (a.type === 'passive') return { ok: false, message: 'Passive abilities do not need activation.' };
    if (a.cooldownLeft > 0) return { ok: false, message: a.name + ' is cooling down for ' + a.cooldownLeft + ' more turn(s).' };
    if (a.uses !== '' && a.usesLeft <= 0) return { ok: false, message: a.name + ' has no uses left.' };
    if (a.capacityMax !== '' && a.capacityCurrent >= a.capacityMax) {
      return { ok: false, message: a.name + ' is at its limit (' + a.capacityCurrent + '/' + a.capacityMax + '). Release something first.' };
    }
    if (a.effects && a.effects.some((e) => e.target !== 'none' && e.value !== 0)) {
      if (a.duration === '' || a.duration < 1)
        return { ok: false, message: 'Set a duration of at least 1 turn for ' + a.name + ' to apply its automatic effects.' };
      const missing = a.effects.find((e) => e.target === 'resource-max' && e.value !== 0 &&
        !(state.resources || []).some((r) => r.id === e.resourceId));
      if (missing) return { ok: false, message: 'Choose an existing custom resource for the maximum-resource effect.' };
    }
    const ap = a.apCost === '' ? 0 : a.apCost;
    if (!controls || typeof controls.getAp !== 'function' || typeof controls.spendAp !== 'function') {
      return { ok: false, message: 'AP tracker is not available.' };
    }
    if (ap > controls.getAp()) return { ok: false, message: 'Not enough AP to use ' + a.name + '.' };
    const cost = a.resourceCost === '' ? 0 : a.resourceCost;
    let resource = null;
    if (cost > 0) {
      if (!a.resourceId) return { ok: false, message: 'Choose a resource for ' + a.name + ' before activating it.' };
      if (a.resourceId === 'base-mana') {
        if (!controls.getMana || !controls.spendMana || !formManaAvailable(state)) {
          return { ok: false, message: 'Mana / Holy Power is unavailable for this character.' };
        }
        const mana = controls.getMana();
        if (mana == null || !Number.isFinite(mana)) return { ok: false, message: 'Set your maximum Mana / Holy Power before using this ability.' };
        if (mana < cost) return { ok: false, message: 'Not enough Mana / Holy Power to use ' + a.name + '.' };
      } else {
        resource = (state.resources || []).find((r) => r.id === a.resourceId);
        if (!resource) return { ok: false, message: 'Selected resource no longer exists for ' + a.name + '.' };
        if (!resourceAvailable(state, resource)) return { ok: false, message: resource.name + ' is unavailable in this form.' };
        if (resource.current < cost) return { ok: false, message: 'Not enough ' + resource.name + ' to use ' + a.name + '.' };
      }
    }
    return { ok: true, ability: a, ap, cost, resource };
  }

  function activate(state, abilityId, controls) {
    const check = checkActivation(state, abilityId, controls);
    if (!check.ok) return check;
    const { ability: a, ap, cost, resource } = check;
    // Validate all costs first. Only then commit the expenditure as one activation.
    if (ap) controls.spendAp(ap);
    if (cost) {
      if (a.resourceId === 'base-mana') controls.spendMana(cost);
      else resource.current -= cost;
    }
    if (a.uses !== '') a.usesLeft = Math.max(0, a.usesLeft - 1);
    if (a.capacityMax !== '') a.capacityCurrent += 1;
    a.cooldownLeft = a.cooldown === '' ? 0 : a.cooldown;
    a.durationLeft = a.duration === '' ? 0 : a.duration;
    return { ok: true, message: 'Used ' + a.name + (a.durationLeft ? ' — duration: ' + a.durationLeft + ' turn(s)' : '') + '.' };
  }

  const SORT_MODES = ['favorites', 'name', 'ap', 'category', 'usable'];
  const STATUS_MODES = ['all', 'usable', 'cooldown', 'exhausted', 'active', 'passive'];
  const AP_MODES = ['all', 'free', '1-5', '6-10', '11+'];
  function filterAbilities(state, filters, controls) {
    filters = filters || {};
    const searchText = String(filters.search || '').trim().toLocaleLowerCase();
    const category = String(filters.category || '');
    const type = String(filters.type || '');
    const resource = String(filters.resource || '');
    const status = STATUS_MODES.includes(filters.status) ? filters.status : 'all';
    const apMode = AP_MODES.includes(filters.ap) ? filters.ap : 'all';
    const sorting = SORT_MODES.includes(filters.sort) ? filters.sort : 'favorites';
    const showAll = filters.showAll === true;
    const apOf = a => a.apCost === '' ? 0 : Number(a.apCost) || 0;
    const matches = (state.abilities || []).filter(a => {
      if (!showAll && !loadoutVisible(state, a)) return false;
      const searchOK = !searchText ||
        [a.name, a.category, a.type, a.description, a.notes].some(t => String(t || '').toLocaleLowerCase().includes(searchText));
      if (!searchOK || (filters.favorites && !a.favorite)) return false;
      if (category && a.category !== category) return false;
      if (type && a.type !== type) return false;
      const paid = a.resourceCost !== '' && Number(a.resourceCost) > 0;
      if (resource === 'none' && paid) return false;
      if (resource && resource !== 'none' && (!paid || a.resourceId !== resource)) return false;
      const ap = apOf(a);
      if ((apMode === 'free' && ap !== 0) ||
          (apMode === '1-5' && !(ap >= 1 && ap <= 5)) ||
          (apMode === '6-10' && !(ap >= 6 && ap <= 10)) ||
          (apMode === '11+' && ap < 11)) return false;
      if (status === 'cooldown' && !(a.cooldownLeft > 0)) return false;
      if (status === 'exhausted' && !(a.uses !== '' && a.usesLeft <= 0)) return false;
      if (status === 'active' && !(a.durationLeft > 0)) return false;
      if (status === 'passive' && a.type !== 'passive') return false;
      if (status === 'usable' && !checkActivation(state, a.id, controls).ok) return false;
      return true;
    });
    matches.sort((a,b) => {
      if (sorting === 'name') return a.name.localeCompare(b.name);
      if (sorting === 'ap') return apOf(a) - apOf(b) || a.name.localeCompare(b.name);
      if (sorting === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      if (sorting === 'usable') return Number(checkActivation(state,b.id,controls).ok) -
        Number(checkActivation(state,a.id,controls).ok) || a.name.localeCompare(b.name);
      return Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name);
    });
    return matches;
  }

  function advanceTurn(state) {
    let changed = false;
    for (const a of state.abilities) {
      if (a.cooldownLeft > 0) { a.cooldownLeft -= 1; changed = true; }
      if (a.durationLeft > 0) { a.durationLeft -= 1; changed = true; }
    }
    return changed;
  }

  function resetForRest(state) {
    for (const a of state.abilities) {
      a.cooldownLeft = 0;
      a.durationLeft = 0;
      a.usesLeft = a.uses === '' ? null : a.uses;
    }
  }

  function init(getState, save, controls) {
    controls = controls || {};

    const list = document.getElementById('abilityList');
    const search = document.getElementById('abilitySearch');
    const category = document.getElementById('abilityCategory');
    const favorites = document.getElementById('abilityFavorites');
    const typeFilter = document.getElementById('abilityTypeFilter');
    const resourceFilter = document.getElementById('abilityResourceFilter');
    const statusFilter = document.getElementById('abilityStatusFilter');
    const apFilter = document.getElementById('abilityApFilter');
    const sortFilter = document.getElementById('abilitySortFilter');
    const compactToggle = document.getElementById('abilityCompact');
    const clearFilters = document.getElementById('abilityClearFilters');
    const count = document.getElementById('abilityCount');
    const feedback = document.getElementById('abilityFeedback');
    const addButton = document.getElementById('abilityAdd');
    const loadoutSelect = document.getElementById('abilityLoadoutSelect');
    const loadoutInput = document.getElementById('abilityLoadoutName');
    const loadoutAdd = document.getElementById('abilityLoadoutAdd');
    const loadoutDelete = document.getElementById('abilityLoadoutDelete');
    const showAllLoadouts = document.getElementById('abilityShowAll');
    const loadoutFeedback = document.getElementById('abilityLoadoutFeedback');
    const loadoutConfig = document.getElementById('abilityLoadoutConfig');
    const byId = (abilityId) => getState().abilities.find((a) => a.id === abilityId);
    const open = new Set();

    function resourceOptions(selected) {
      const state = getState();
      const resources = [
        { id: '', name: 'None' },
        { id: 'base-mana', name: state.fields && state.fields.manaKind === 'holy' ? 'Holy Power (existing)' : 'Mana (existing)' },
        ...(state.resources || []).map((r) => ({ id: r.id, name: r.name }))
      ];
      if (selected && !resources.some((r) => r.id === selected)) {
        resources.push({ id: selected, name: 'Missing resource (choose another)' });
      }
      return resources.map((r) =>
        '<option value="' + esc(r.id) + '"' + (selected === r.id ? ' selected' : '') + '>' +
        esc(r.name) + '</option>').join('');
    }

    function field(label, prop, val, type, extra) {
      return '<label class="ability-field"><span class="foot-label">' + label + '</span>' +
        '<input data-ability-prop="' + prop + '" type="' + (type || 'text') + '"' +
        (type === 'number' ? ' min="0" max="999999" step="1" inputmode="numeric"' : '') +
        (extra || '') + ' value="' + esc(val) + '"></label>';
    }

    function effectRow(e, state) {
      const targetOptions = [
        ['none', 'None'], ['movement', 'Movement (ft/AP)'], ['armor', 'Armor Rating'],
        ['evasion', 'Natural Evasion'], ['stat', 'Stat score'], ['resource-max', 'Custom resource maximum']
      ];
      return '<div class="ability-effect-row" data-effect-id="' + esc(e.id) + '">' +
        '<label class="ability-field"><span class="foot-label">Target</span><select data-effect-prop="target">' +
          targetOptions.map(([v, title]) => '<option value="' + v + '"' + (e.target === v ? ' selected' : '') + '>' + title + '</option>').join('') +
        '</select></label>' +
        (e.target === 'stat' ?
          '<label class="ability-field"><span class="foot-label">Stat</span><select data-effect-prop="stat">' +
          STATS.map((k) => '<option value="' + k + '"' + (k === e.stat ? ' selected' : '') + '>' + k + '</option>').join('') +
          '</select></label>' : '') +
        (e.target === 'resource-max' ?
          '<label class="ability-field"><span class="foot-label">Resource</span><select data-effect-prop="resourceId">' +
          '<option value="">Choose resource</option>' +
          (state.resources || []).map((r) => '<option value="' + esc(r.id) + '"' + (e.resourceId === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') +
          (!(state.resources || []).some((r) => r.id === e.resourceId) && e.resourceId ?
            '<option value="' + esc(e.resourceId) + '" selected>Missing resource</option>' : '') +
          '</select></label>' : '') +
        '<label class="ability-field"><span class="foot-label">Bonus / penalty</span>' +
          '<input data-effect-prop="value" type="number" inputmode="numeric" min="-99999" max="99999" step="1" value="' + e.value + '"></label>' +
        '<button type="button" class="btn danger" data-ability-action="remove-effect" aria-label="Remove effect">Remove</button>' +
      '</div>';
    }

    function memberships(ability) {
      const forms = getState().abilityLoadouts || [];
      if (!forms.length) return '';
      const shared = !ability.loadoutIds || ability.loadoutIds.length === 0;
      return '<fieldset class="ability-memberships"><legend>Available in forms</legend>' +
        '<p class="ability-effect-hint">Choose any form to make this ability form-specific. Select multiple forms if needed; clearing them all makes it shared again.</p>' +
        '<label><input type="checkbox" data-loadout-shared ' + (shared ? 'checked' : '') + '> Shared across all forms</label>' +
        '<div class="ability-membership-list">' + forms.map(form =>
          '<label><input type="checkbox" data-loadout-member="' + esc(form.id) + '" ' +
            (!shared && ability.loadoutIds.includes(form.id) ? 'checked ' : '') +
            '> ' + esc(form.name) + '</label>').join('') + '</div></fieldset>';
    }
    function renderLoadoutConfig() {
      const state = getState();
      const form = (state.abilityLoadouts || []).find(x => x.id === state.activeAbilityLoadoutId);
      if (!form) {
        loadoutConfig.innerHTML = '<p class="ability-effect-hint">Choose a named form to customize its appearance and stat modifiers. Base uses your normal character.</p>';
        return;
      }
      const oldDetails = loadoutConfig.querySelector ? loadoutConfig.querySelector('details') : null;
      const expanded = oldDetails && oldDetails.open;
      const options = '<option value="">No linked portrait</option>' +
        (state.portraits || []).map((p,i) =>
          '<option value="' + esc(p.id) + '"' + (p.id === form.portraitId ? ' selected' : '') + '>' +
          esc(p.name || 'Portrait ' + (i+1)) + '</option>').join('');
      loadoutConfig.innerHTML = '<details class="loadout-mechanics"' + (expanded ? ' open' : '') + '>' +
        '<summary>Appearance &amp; stat adjustments for ' + esc(form.name) + '</summary>' +
        '<div class="loadout-mechanics-content">' +
          '<label class="ability-field"><span class="foot-label">Linked portrait</span>' +
            '<select data-loadout-portrait>' + options + '</select></label>' +
          '<p class="ability-effect-hint">Link an existing portrait from Overview. Changing the ability form switches its portrait, and selecting a portrait in Overview switches to its linked ability form. An unlinked portrait selects Base/shared abilities.</p>' +
          '<label class="ability-field"><span class="foot-label">Mana / Holy Power in this form</span>' +
            '<select data-loadout-mana-mode>' +
              '<option value="inherit"' + (form.manaMode === 'inherit' ? ' selected' : '') + '>Use global Mana setting</option>' +
              '<option value="show"' + (form.manaMode === 'show' ? ' selected' : '') + '>Show and allow Mana</option>' +
              '<option value="hide"' + (form.manaMode === 'hide' ? ' selected' : '') + '>Hide and disable Mana</option>' +
            '</select></label>' +
          '<p class="ability-effect-hint">Custom resources are assigned individually on Overview. Hidden pools keep their balances; this setting only controls the built-in Mana/Holy Power pool.</p>' +
          '<p class="ability-effect-hint">Temporary form score adjustments (not permanent stat points). Bonuses and penalties apply while this form is selected.</p>' +
          '<div class="loadout-stat-grid">' + STATS.map(k =>
            '<label class="ability-field"><span class="foot-label">' + k + '</span>' +
            '<input type="number" min="-28" max="28" step="1" data-loadout-stat="' + k +
            '" value="' + (form.statBonuses[k] || 0) + '"></label>').join('') + '</div>' +
          '</div></details>';
    }
    function renderLoadouts() {
      const state = getState();
      const current = state.activeAbilityLoadoutId || '';
      loadoutSelect.innerHTML = '<option value="">Base / shared abilities</option>' +
        state.abilityLoadouts.map(x => '<option value="' + esc(x.id) + '"' +
          (x.id === current ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
      loadoutSelect.value = current;
      loadoutDelete.disabled = !current;
      loadoutAdd.disabled = state.abilityLoadouts.length >= MAX_LOADOUTS;
      renderLoadoutConfig();
    }

    function card(ability) {
      if (!Array.isArray(ability.effects)) ability.effects = normalizeEffects(ability);
      const inactive = !loadoutVisible(getState(), ability);
      const badges = [ability.type.charAt(0).toUpperCase() + ability.type.slice(1)];
      if (inactive) badges.push('Other form');
      if (ability.apCost !== '') badges.push(ability.apCost + ' AP');
      if (ability.resourceId && ability.resourceCost !== '') {
        const s = getState();
        const r = ability.resourceId === 'base-mana'
          ? (s.fields && s.fields.manaKind === 'holy' ? 'Holy Power' : 'Mana')
          : ((s.resources || []).find((x) => x.id === ability.resourceId) || { name: 'Unknown resource' }).name;
        badges.push(ability.resourceCost + ' ' + r);
      }
      if (ability.cooldown !== '') badges.push(ability.cooldown + '-turn cooldown');
      if (ability.duration !== '') badges.push(ability.duration + '-turn duration');
      if (ability.uses !== '') badges.push(ability.usesLeft + '/' + ability.uses + ' uses');
      if (ability.capacityMax !== '') badges.push(ability.capacityCurrent + '/' + ability.capacityMax + ' active');
      if (ability.cooldownLeft) badges.push('Ready in ' + ability.cooldownLeft + ' turn(s)');
      if (ability.durationLeft) badges.push('Active: ' + ability.durationLeft + ' turn(s)');
      (ability.effects || []).forEach((e) => {
        if (e.target === 'none' || !e.value) return;
        const name = e.target === 'movement' ? 'ft/AP' :
          e.target === 'armor' ? 'Armor' : e.target === 'evasion' ? 'Evasion' :
          e.target === 'stat' ? e.stat :
          ((getState().resources || []).find((r) => r.id === e.resourceId) || { name: 'Missing resource' }).name + ' max';
        badges.push((e.value > 0 ? '+' : '') + e.value + ' ' + name + (ability.durationLeft ? ' active' : ''));
      });
      return '<div class="ability-item' + (ability.type === 'passive' ? '' : ' has-quick-use') +
        (inactive ? ' ability-inactive' : '') + '" data-ability-id="' + esc(ability.id) + '">' +
        '<details class="ability-card" data-ability-id="' + esc(ability.id) + '"' +
        (open.has(ability.id) ? ' open' : '') + '>' +
        '<summary class="ability-summary">' +
          '<span class="ability-summary-name">' + esc(ability.name) + '</span>' +
          '<span class="ability-summary-category">' + esc(ability.category) + '</span>' +
          '<span class="ability-summary-badges">' + badges.map((b) =>
            '<span class="ability-tag">' + esc(b) + '</span>').join('') + '</span>' +
          '<span class="ability-summary-arrow" aria-hidden="true">▾</span>' +
        '</summary>' +
        '<div class="ability-editor">' +
          '<div class="ability-editor-row">' +
            field('Name', 'name', ability.name, 'text', ' maxlength="100"') +
            field('Category', 'category', ability.category, 'text', ' maxlength="60"') +
            '<label class="ability-field"><span class="foot-label">Type</span><select data-ability-prop="type">' +
              TYPES.map((type) => '<option value="' + type + '"' +
                (ability.type === type ? ' selected' : '') + '>' +
                type.charAt(0).toUpperCase() + type.slice(1) + '</option>').join('') +
            '</select></label>' +
          '</div>' +
          memberships(ability) +
          '<label class="ability-field"><span class="foot-label">Description / effect</span>' +
            '<textarea data-ability-prop="description" rows="3" maxlength="12000" placeholder="Describe what this ability does.">' +
            esc(ability.description) + '</textarea></label>' +
          '<div class="ability-editor-row">' +
            field('AP cost', 'apCost', ability.apCost, 'number') +
            '<label class="ability-field"><span class="foot-label">Resource</span>' +
              '<select data-ability-prop="resourceId">' + resourceOptions(ability.resourceId) + '</select></label>' +
            field('Resource cost', 'resourceCost', ability.resourceCost, 'number') +
          '</div>' +
          '<div class="ability-editor-row">' +
            field('Cooldown (turns)', 'cooldown', ability.cooldown, 'number') +
            field('Duration (turns)', 'duration', ability.duration, 'number') +
            field('Uses / charges (blank = unlimited)', 'uses', ability.uses, 'number', ' placeholder="Unlimited" title="Limits activations until rest; leave blank for unlimited."') +
          '</div>' +
          '<div class="ability-capacity">' +
            field('Max active / held (blank = no limit)', 'capacityMax', ability.capacityMax, 'number', ' placeholder="No limit" title="Maximum number of creations or objects that can exist at once. Separate from uses."') +
            (ability.capacityMax === '' ? '' :
              '<label class="ability-field"><span class="foot-label">Currently active / held</span><input type="number" min="0" max="' + ability.capacityMax + '" value="' + ability.capacityCurrent + '" data-ability-prop="capacityCurrent"></label>' +
              '<button type="button" class="btn" data-ability-action="release" title="Remove one currently active or held object">−1 Release</button>') +
          '</div>' +
          '<div class="ability-effects">' +
            '<div class="ability-effects-head"><span>Automatic effects</span>' +
              '<button type="button" class="btn" data-ability-action="add-effect"' +
                (ability.effects.length >= MAX_EFFECTS ? ' disabled' : '') + '>+ Add effect</button></div>' +
            (ability.effects.length ? ability.effects.map((e) => effectRow(e, getState())).join('') :
              '<p class="ability-effect-hint">No automatic effects. Add Movement, Armor, Evasion, a stat, or a custom resource maximum.</p>') +
            '<p class="ability-effect-hint">Bonuses stack while active and expire with this ability’s duration. Base stats, gear and resource maximums remain unchanged. Maximum-resource effects do not refill the pool.</p>' +
          '</div>' +
          '<label class="ability-field"><span class="foot-label">Notes</span>' +
            '<textarea data-ability-prop="notes" rows="2" maxlength="6000" placeholder="Optional conditions, limits, or reminders.">' +
            esc(ability.notes) + '</textarea></label>' +
          '<div class="ability-activate">' +
            (ability.type === 'passive'
              ? '<span class="ability-status">Passive · always available; no activation needed</span>'
              : '<button type="button" class="btn strong" data-ability-action="use"' + (inactive ? ' disabled' : '') + '>Use ability</button>' +
                '<span class="ability-status">' +
                  (ability.cooldownLeft ? 'Cooldown: ' + ability.cooldownLeft + ' turn(s)' :
                    ability.uses !== '' && ability.usesLeft <= 0 ? 'Out of uses' : 'Ready') +
                  (ability.durationLeft ? ' · Active for ' + ability.durationLeft + ' more turn(s)' : '') +
                '</span>') +
            (ability.durationLeft ? '<button type="button" class="btn" data-ability-action="end">End effect</button>' : '') +
          '</div>' +
          (ability.uses !== '' ? '<label class="ability-field ability-uses-left"><span class="foot-label">Uses remaining (adjust manually)</span><input data-ability-prop="usesLeft" type="number" min="0" max="' + ability.uses + '" value="' + ability.usesLeft + '"></label>' : '') +
          '<div class="ability-card-actions">' +
            '<button type="button" class="btn" data-ability-action="reset">Reset ability tracker</button>' +
            '<button type="button" class="btn" data-ability-action="favorite" aria-pressed="' +
              (ability.favorite ? 'true' : 'false') + '">' + (ability.favorite ? '★ Favorite' : '☆ Add favorite') + '</button>' +
            '<button type="button" class="btn" data-ability-action="duplicate">Duplicate</button>' +
            '<button type="button" class="btn danger" data-ability-action="delete">Delete</button>' +
          '</div>' +
        '</div></details>' +
        (ability.type === 'passive' ? '' :
          '<button type="button" class="ability-quick-use" data-ability-action="use"' +
          (inactive ? ' disabled' : '') + ' aria-label="Use ' +
          esc(ability.name) + '" title="Use ' + esc(ability.name) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg><span>Use</span></button>') +
        '</div>';
    }

    function rememberOpen() {
      list.querySelectorAll('details.ability-card').forEach((detail) => {
        const abilityId = detail.dataset.abilityId;
        if (detail.open) open.add(abilityId);
        else open.delete(abilityId);
      });
    }
    function render() {
      const state = getState();
      const abilities = state.abilities;
      rememberOpen();
      renderLoadouts();
      const selectedCategory = category.value || '';
      const categories = [...new Set(abilities.map(a => a.category))].sort((a,b) => a.localeCompare(b));
      category.innerHTML = '<option value="">All categories</option>' +
        categories.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
      category.value = categories.includes(selectedCategory) ? selectedCategory : '';
      const selectedResource = resourceFilter.value || '';
      const resources = [
        { id: 'base-mana', name: state.fields && state.fields.manaKind === 'holy' ? 'Holy Power' : 'Mana' },
        ...(state.resources || []).map(r => ({ id: r.id, name: r.name }))
      ];
      resourceFilter.innerHTML = '<option value="">Any resource</option><option value="none">No resource cost</option>' +
        resources.map(r => '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>').join('');
      resourceFilter.value = resources.some(r => r.id === selectedResource) || selectedResource === 'none' ?
        selectedResource : '';
      const matches = filterAbilities(state, {
        search: search.value, category: category.value,
        favorites: favorites.checked, type: typeFilter.value,
        resource: resourceFilter.value, status: statusFilter.value,
        ap: apFilter.value, sort: sortFilter.value, showAll: showAllLoadouts.checked
      }, controls);
      list.classList.toggle('is-compact', compactToggle.checked);
      const visibleCount = abilities.filter(a => loadoutVisible(state, a)).length;
      count.textContent = matches.length + ' shown / ' + visibleCount + ' in current form · ' + abilities.length + ' total';
      list.innerHTML = matches.length ? matches.map(card).join('') :
        '<p class="ability-empty">' + (abilities.length ?
          'No abilities match these filters. Clear filters to see everything.' :
          'No abilities yet. Add a custom technique, spell, trait, or passive.') + '</p>';
    }
    function resetFilters() {
      search.value = '';
      category.value = '';
      favorites.checked = false;
      typeFilter.value = '';
      resourceFilter.value = '';
      statusFilter.value = 'all';
      apFilter.value = 'all';
      sortFilter.value = 'favorites';
    }

    addButton.addEventListener('click', () => {
      const active = getState().activeAbilityLoadoutId;
      const ability = normalizeAbility({ id: id(), name: 'New ability', category: 'General',
        loadoutIds: active ? [active] : [] });
      getState().abilities.push(ability);
      resetFilters();
      open.add(ability.id);
      render();
      save();
      const cardElement = [...list.querySelectorAll('[data-ability-id]')].find((el) => el.dataset.abilityId === ability.id);
      const input = cardElement && cardElement.querySelector('[data-ability-prop="name"]');
      if (input) { input.focus(); input.select(); }
    });

    search.addEventListener('input', render);
    [category, favorites, typeFilter, resourceFilter, statusFilter, apFilter, sortFilter,
      compactToggle].forEach(el => el.addEventListener('change', render));
    clearFilters.addEventListener('click', () => { resetFilters(); render(); });
    showAllLoadouts.addEventListener('change', render);
    loadoutConfig.addEventListener('change', e => {
      const el = e.target.closest('[data-loadout-portrait], [data-loadout-stat], [data-loadout-mana-mode]');
      if (!el) return;
      const state = getState();
      const identifier = state.activeAbilityLoadoutId;
      const property = el.hasAttribute('data-loadout-portrait') ? 'portraitId' :
        el.hasAttribute('data-loadout-mana-mode') ? 'manaMode' : el.dataset.loadoutStat;
      if (!configureLoadout(state, identifier, property, el.value)) return;
      if (controls.refresh) controls.refresh();
      render();
      save();
    });
    loadoutSelect.addEventListener('change', () => {
      selectLoadout(getState(), loadoutSelect.value);
      resetFilters();
      render();
      save();
      loadoutFeedback.textContent = loadoutSelect.value ?
        'Active form: ' + (getState().abilityLoadouts.find(x => x.id === loadoutSelect.value) || {name:''}).name :
        'Base form: shared abilities only.';
      if (controls.refresh) controls.refresh();
    });
    function addForm() {
      const form = createLoadout(getState(), loadoutInput.value);
      if (!form) {
        loadoutFeedback.textContent = 'Enter a form name (maximum ' + MAX_LOADOUTS + ' forms).';
        return;
      }
      loadoutInput.value = '';
      loadoutFeedback.textContent = 'Created ' + form.name + '. Assign abilities using each ability editor.';
      resetFilters();
      render();
      save();
    }
    loadoutAdd.addEventListener('click', addForm);
    loadoutInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addForm(); }
    });
    loadoutDelete.addEventListener('click', () => {
      const state = getState();
      const form = state.abilityLoadouts.find(x => x.id === state.activeAbilityLoadoutId);
      if (!form || !window.confirm('Delete ' + form.name +
        '? Abilities assigned only to this form will become shared. Their costs and cooldowns remain unchanged.')) return;
      removeLoadout(state, form.id);
      resetFilters();
      loadoutFeedback.textContent = 'Deleted ' + form.name + '.';
      render();
      save();
    });

    function updateInput(input) {
      const cardElement = input.closest('[data-ability-id]');
      const ability = cardElement && byId(cardElement.dataset.abilityId);
      if (!ability) return null;
      const prop = input.dataset.abilityProp;
      if (prop === 'capacityCurrent') {
        if (ability.capacityMax !== '') {
          const entered = optionalNumber(input.value);
          if (entered !== '') ability.capacityCurrent = Math.min(ability.capacityMax, entered);
          save();
        }
        return { ability, prop };
      }
      if (prop === 'usesLeft') {
        if (ability.uses !== '') {
          ability.usesLeft = Math.min(ability.uses, optionalNumber(input.value) === '' ? ability.usesLeft : optionalNumber(input.value));
          save();
        }
        return { ability, prop };
      }
      if (!propNames.includes(prop)) return null;
      ability[prop] = numerical.has(prop) ? optionalNumber(input.value) :
        clean(input.value, prop === 'name' ? 100 : prop === 'category' ? 60 :
          prop === 'description' ? 12000 : prop === 'notes' ? 6000 : 100);
      if (prop === 'uses') ability.usesLeft = ability.uses === '' ? null : ability.uses;
      if (prop === 'capacityMax') {
        ability.capacityCurrent = ability.capacityMax === '' ? 0 :
          Math.min(ability.capacityMax, ability.capacityCurrent);
      }
      save();
      return { ability, prop };
    }
    function updateEffect(input) {
      const cardElement = input.closest('[data-ability-id]');
      const a = cardElement && byId(cardElement.dataset.abilityId);
      const item = input.closest('[data-effect-id]');
      const effect = a && item && a.effects.find((e) => e.id === item.dataset.effectId);
      if (!effect) return false;
      const prop = input.dataset.effectProp;
      if (prop === 'target') effect.target = effectTargets.includes(input.value) ? input.value : 'none';
      else if (prop === 'value') effect.value = signedNumber(input.value);
      else if (prop === 'stat') effect.stat = STATS.includes(input.value) ? input.value : 'STR';
      else if (prop === 'resourceId') effect.resourceId = clean(input.value, 100);
      else return false;
      a.durationLeft = 0; // Editing an active effect cancels it; no stale bonuses.
      save();
      return true;
    }
    list.addEventListener('input', (event) => {
      const effectInput = event.target.closest('[data-effect-prop]');
      if (effectInput) { updateEffect(effectInput); return; }
      const input = event.target.closest('[data-ability-prop]');
      if (input) updateInput(input);
    });
    list.addEventListener('change', (event) => {
      const member = event.target.closest('[data-loadout-member], [data-loadout-shared]');
      if (member) {
        const cardElement = member.closest('[data-ability-id]');
        const ability = cardElement && byId(cardElement.dataset.abilityId);
        if (!ability) return;
        if (member.hasAttribute('data-loadout-shared')) {
          setLoadoutMembership(getState(), ability, 'shared', '', member.checked);
        } else {
          setLoadoutMembership(getState(), ability, 'member', member.dataset.loadoutMember, member.checked);
        }
        render();
        save();
        return;
      }
      const effectInput = event.target.closest('[data-effect-prop]');
      if (effectInput) {
        updateEffect(effectInput);
        if (controls.refresh) controls.refresh();
        render();
        return;
      }
      const input = event.target.closest('[data-ability-prop]');
      if (!input) return;
      const edit = updateInput(input);
      if (!edit) return;
      if (edit.prop === 'name') edit.ability.name = edit.ability.name.trim() || 'Unnamed ability';
      if (edit.prop === 'category') edit.ability.category = edit.ability.category.trim() || 'General';

      render();
    });
    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-ability-action]');
      if (!button) return;
      const element = button.closest('[data-ability-id]');
      const ability = element && byId(element.dataset.abilityId);
      if (!ability) return;
      const action = button.dataset.abilityAction;
      if (action === 'delete') {
        if (!window.confirm('Delete ' + ability.name + '? Export your character first if you want a backup.')) return;
        getState().abilities = getState().abilities.filter((a) => a.id !== ability.id);
        open.delete(ability.id);
      } else if (action === 'duplicate') {
        const copy = normalizeAbility(Object.assign({}, ability, {
          id: id(), name: 'Copy of ' + ability.name, favorite: false,
          usesLeft: ability.uses === '' ? null : ability.uses, cooldownLeft: 0, durationLeft: 0,
          capacityCurrent: 0,
          loadoutIds: [...ability.loadoutIds],
          effects: ability.effects.map((e) => Object.assign({}, e, { id: effectId() }))
        }));
        getState().abilities.push(copy);
        open.add(copy.id);
        resetFilters();
      } else if (action === 'add-effect') {
        if (ability.effects.length < MAX_EFFECTS) ability.effects.push(normalizeEffect({
          id: effectId(), target: 'none', value: 0
        }));
        ability.durationLeft = 0;
        if (controls.refresh) controls.refresh();
      } else if (action === 'remove-effect') {
        const item = button.closest('[data-effect-id]');
        ability.effects = ability.effects.filter((e) => e.id !== (item && item.dataset.effectId));
        ability.durationLeft = 0;
        if (controls.refresh) controls.refresh();
      } else if (action === 'favorite') {
        ability.favorite = !ability.favorite;
      } else if (action === 'use') {
        const result = activate(getState(), ability.id, controls);
        feedback.textContent = result.message;
        feedback.classList.toggle('ability-error', !result.ok);
        if (result.ok && controls.refresh) controls.refresh();
      } else if (action === 'reset') {
        ability.cooldownLeft = 0;
        ability.durationLeft = 0;
        ability.usesLeft = ability.uses === '' ? null : ability.uses;
        feedback.textContent = 'Reset ' + ability.name + ' tracker (previous AP and resource costs are not refunded).';
        feedback.classList.remove('ability-error');
      } else if (action === 'end') {
        ability.durationLeft = 0;
        feedback.textContent = 'Ended ' + ability.name + ' duration.';
        feedback.classList.remove('ability-error');
        if (controls.refresh) controls.refresh();
      } else if (action === 'release') {
        if (ability.capacityMax !== '' && ability.capacityCurrent > 0) {
          ability.capacityCurrent--;
          feedback.textContent = 'Released one ' + ability.name + ' creation (' +
            ability.capacityCurrent + '/' + ability.capacityMax + ' active).';
        } else {
          feedback.textContent = 'There is nothing to release for ' + ability.name + '.';
        }
        feedback.classList.remove('ability-error');
      }
      render();
      save();
    });
    render();
    return {
      render,
      turnStart() { if (advanceTurn(getState())) { render(); save(); } },
      longRest() { resetForRest(getState()); render(); }
    };
  }

  window.WBAbilities = {
    normalizeState, init, activate, checkActivation, filterAbilities, loadoutVisible,
    createLoadout, removeLoadout, setLoadoutMembership,
    formStatBonus, selectLoadout, selectPortrait, configureLoadout,
    resourceAvailable, formManaAvailable, advanceTurn, resetForRest,
    movementBonus, effectiveMovement, effectBonus, resourceMax
  };
})();
