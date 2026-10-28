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
    'resourceCost', 'cooldown', 'duration', 'uses', 'notes'];
  const numerical = new Set(['apCost', 'resourceCost', 'cooldown', 'duration', 'uses']);

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

  function init(getState, save) {
    const list = document.getElementById('abilityList');
    const search = document.getElementById('abilitySearch');
    const category = document.getElementById('abilityCategory');
    const favorites = document.getElementById('abilityFavorites');
    const count = document.getElementById('abilityCount');
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
      return '<details class="ability-card" data-ability-id="' + esc(ability.id) + '"' +
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
            field('Uses / charges (blank = unlimited)', 'uses', ability.uses, 'number', ' placeholder="Unlimited" title="Leave blank for unlimited uses. Enter 0 to indicate none available."') +
          '</div>' +
          '<label class="ability-field"><span class="foot-label">Notes</span>' +
            '<textarea data-ability-prop="notes" rows="2" maxlength="6000" placeholder="Optional conditions, limits, or reminders.">' +
            esc(ability.notes) + '</textarea></label>' +
          '<div class="ability-card-actions">' +
            '<button type="button" class="btn" data-ability-action="favorite" aria-pressed="' +
              (ability.favorite ? 'true' : 'false') + '">' + (ability.favorite ? '★ Favorite' : '☆ Add favorite') + '</button>' +
            '<button type="button" class="btn" data-ability-action="duplicate">Duplicate</button>' +
            '<button type="button" class="btn danger" data-ability-action="delete">Delete</button>' +
          '</div>' +
        '</div></details>';
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
      if (!propNames.includes(prop)) return null;
      ability[prop] = numerical.has(prop) ? optionalNumber(input.value) :
        clean(input.value, prop === 'name' ? 100 : prop === 'category' ? 60 :
          prop === 'description' ? 12000 : prop === 'notes' ? 6000 : 100);
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
        const copy = normalizeAbility(Object.assign({}, ability, { id: id(), name: 'Copy of ' + ability.name, favorite: false }));
        getState().abilities.push(copy);
        open.add(copy.id);
        search.value = ''; category.value = ''; favorites.checked = false;
      } else if (action === 'favorite') {
        ability.favorite = !ability.favorite;
      }
      render();
      save();
    });
    render();
    return { render };
  }

  window.WBAbilities = { normalizeState, init };
})();
