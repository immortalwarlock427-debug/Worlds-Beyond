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
    'resourceCost', 'cooldown', 'duration', 'uses', 'capacityMax', 'notes', 'effectTarget', 'effectValue'];
  const numerical = new Set(['apCost', 'resourceCost', 'cooldown', 'duration', 'uses', 'capacityMax']);
  const effectTargets = ['none', 'movement'];
  const signedNumber = (n) => {
    if (n == null || String(n).trim() === '') return 0;
    const value = Number(n);
    return Number.isFinite(value) ? Math.max(-99999, Math.min(99999, Math.round(value))) : 0;
  };
  // Effect bonuses are derived, not written to character fields or gear totals.
  function movementBonus(state) {
    return (state.abilities || []).reduce((total, ability) =>
      total + (ability.effectTarget === 'movement' && ability.durationLeft > 0 ?
        signedNumber(ability.effectValue) : 0), 0);
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
      effectTarget: effectTargets.includes(value.effectTarget) ? value.effectTarget : 'none',
      effectValue: signedNumber(value.effectValue),
      favorite: value.favorite === true
    };
  }

  function normalizeState(state) {
    const ids = new Set();
    state.abilities = (Array.isArray(state.abilities) ? state.abilities : [])
      .map(normalizeAbility).filter(Boolean).map((ability) => {
        if (ids.has(ability.id)) ability.id = id();
        ids.add(ability.id);
        return ability;
      });
  }

  // Three independent trackers: limited uses, cooldown lock, and active duration.
  // A duration is informational until sheet-targeted effects are implemented.
  function activate(state, abilityId, controls) {
    const a = state.abilities.find((x) => x.id === abilityId);
    if (!a) return { ok: false, message: 'Ability not found.' };
    if (a.type === 'passive') return { ok: false, message: 'Passive abilities do not need activation.' };
    if (a.cooldownLeft > 0) return { ok: false, message: a.name + ' is cooling down for ' + a.cooldownLeft + ' more turn(s).' };
    if (a.uses !== '' && a.usesLeft <= 0) return { ok: false, message: a.name + ' has no uses left.' };
    if (a.capacityMax !== '' && a.capacityCurrent >= a.capacityMax) {
      return { ok: false, message: a.name + ' is at its limit (' + a.capacityCurrent + '/' + a.capacityMax + '). Release something first.' };
    }
    if (a.effectTarget === 'movement' && a.effectValue !== 0 && (a.duration === '' || a.duration < 1)) {
      return { ok: false, message: 'Set a duration of at least 1 turn for ' + a.name + ' to apply a Movement effect.' };
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
        if (!controls.getMana || !controls.spendMana || state.showMana === false) {
          return { ok: false, message: 'Mana / Holy Power is unavailable for this character.' };
        }
        const mana = controls.getMana();
        if (mana == null || !Number.isFinite(mana)) return { ok: false, message: 'Set your maximum Mana / Holy Power before using this ability.' };
        if (mana < cost) return { ok: false, message: 'Not enough Mana / Holy Power to use ' + a.name + '.' };
      } else {
        resource = (state.resources || []).find((r) => r.id === a.resourceId);
        if (!resource) return { ok: false, message: 'Selected resource no longer exists for ' + a.name + '.' };
        if (resource.current < cost) return { ok: false, message: 'Not enough ' + resource.name + ' to use ' + a.name + '.' };
      }
    }
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
    const count = document.getElementById('abilityCount');
    const feedback = document.getElementById('abilityFeedback');
    const addButton = document.getElementById('abilityAdd');
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

    function card(ability) {
      const badges = [ability.type.charAt(0).toUpperCase() + ability.type.slice(1)];
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
      if (ability.effectTarget === 'movement' && ability.effectValue) {
        const amount = (ability.effectValue > 0 ? '+' : '') + ability.effectValue + ' ft/AP';
        badges.push(amount + (ability.durationLeft ? ' active' : ' effect'));
      }
      return '<div class="ability-item' + (ability.type === 'passive' ? '' : ' has-quick-use') + '" data-ability-id="' + esc(ability.id) + '">' +
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
          '<div class="ability-effect-config">' +
            '<label class="ability-field"><span class="foot-label">Automatic effect</span><select data-ability-prop="effectTarget">' +
              '<option value="none"' + (ability.effectTarget === 'none' ? ' selected' : '') + '>None — description only</option>' +
              '<option value="movement"' + (ability.effectTarget === 'movement' ? ' selected' : '') + '>Movement (feet per AP)</option>' +
            '</select></label>' +
            field('Bonus / penalty (feet per AP)', 'effectValue', ability.effectValue, 'number', ' step="1" title="Positive adds movement; negative subtracts movement. Set a duration above."') +
          '</div>' +
          '<p class="ability-effect-hint">Movement effects require a duration. Active bonuses stack across different abilities and expire on turn start; your base movement and equipment remain unchanged.</p>' +
          '<label class="ability-field"><span class="foot-label">Notes</span>' +
            '<textarea data-ability-prop="notes" rows="2" maxlength="6000" placeholder="Optional conditions, limits, or reminders.">' +
            esc(ability.notes) + '</textarea></label>' +
          '<div class="ability-activate">' +
            (ability.type === 'passive'
              ? '<span class="ability-status">Passive · always available; no activation needed</span>'
              : '<button type="button" class="btn strong" data-ability-action="use">Use ability</button>' +
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
          '<button type="button" class="ability-quick-use" data-ability-action="use" aria-label="Use ' +
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
      const abilities = getState().abilities;
      rememberOpen();
      const previousCategory = category.value || '';
      const categories = [...new Set(abilities.map((a) => a.category))].sort((a, b) => a.localeCompare(b));
      category.innerHTML = '<option value="">All categories</option>' +
        categories.map((c) => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
      category.value = categories.includes(previousCategory) ? previousCategory : '';
      const needle = search.value.trim().toLowerCase();
      const matches = abilities.filter((a) =>
        (!favorites.checked || a.favorite) &&
        (!category.value || a.category === category.value) &&
        (!needle || [a.name, a.category, a.type, a.description, a.notes].some((s) => s.toLowerCase().includes(needle)))
      );
      matches.sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || a.name.localeCompare(b.name));
      count.textContent = matches.length + ' shown / ' + abilities.length + ' total';
      list.innerHTML = matches.length ? matches.map(card).join('') :
        '<p class="ability-empty">' + (abilities.length
          ? 'No abilities match these filters.' : 'No abilities yet. Add a custom technique, spell, trait, or passive.') +
        '</p>';
    }

    addButton.addEventListener('click', () => {
      const ability = normalizeAbility({ id: id(), name: 'New ability', category: 'General' });
      getState().abilities.push(ability);
      search.value = '';
      category.value = '';
      favorites.checked = false;
      open.add(ability.id);
      render();
      save();
      const cardElement = [...list.querySelectorAll('[data-ability-id]')].find((el) => el.dataset.abilityId === ability.id);
      const input = cardElement && cardElement.querySelector('[data-ability-prop="name"]');
      if (input) { input.focus(); input.select(); }
    });

    search.addEventListener('input', render);
    category.addEventListener('change', render);
    favorites.addEventListener('change', render);

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
      if (prop === 'effectTarget') {
        ability.effectTarget = effectTargets.includes(ability.effectTarget) ? ability.effectTarget : 'none';
        ability.durationLeft = 0; // Reconfigure safely: don't keep an old effect applied.
      }
      if (prop === 'effectValue') {
        ability.effectValue = signedNumber(input.value);
        ability.durationLeft = 0; // Changing the amount doesn't alter an already-running bonus.
      }
      if (prop === 'capacityMax') {
        ability.capacityCurrent = ability.capacityMax === '' ? 0 :
          Math.min(ability.capacityMax, ability.capacityCurrent);
      }
      save();
      return { ability, prop };
    }
    list.addEventListener('input', (event) => {
      const input = event.target.closest('[data-ability-prop]');
      if (input) updateInput(input);
    });
    list.addEventListener('change', (event) => {
      const input = event.target.closest('[data-ability-prop]');
      if (!input) return;
      const edit = updateInput(input);
      if (!edit) return;
      if (edit.prop === 'name') edit.ability.name = edit.ability.name.trim() || 'Unnamed ability';
      if (edit.prop === 'category') edit.ability.category = edit.ability.category.trim() || 'General';
      if ((edit.prop === 'effectTarget' || edit.prop === 'effectValue') && controls.refresh) controls.refresh();
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
          capacityCurrent: 0
        }));
        getState().abilities.push(copy);
        open.add(copy.id);
        search.value = ''; category.value = ''; favorites.checked = false;
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

  window.WBAbilities = { normalizeState, init, activate, advanceTurn, resetForRest, movementBonus, effectiveMovement };
})();
