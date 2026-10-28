/* Worlds Beyond: optional per-character resources.
   Resource ids remain stable so the future ability builder can refer to them. */
(function () {
  'use strict';

  const LIMIT = 999999;
  const COLORS = ['teal', 'brass', 'blue', 'red'];
  const value = (n, fallback) => {
    const parsed = Number(n);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(LIMIT, Math.round(parsed))) : fallback;
  };
  const text = (v) => String(v == null ? '' : v).trim().slice(0, 48);
  const escape = (v) => String(v).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const id = () => 'res' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

  function normalizeResource(r) {
    if (!r || typeof r !== 'object') return null;
    const max = Math.max(1, value(r.max, 100));
    return {
      id: typeof r.id === 'string' && /^res[a-z0-9]{6,36}$/.test(r.id) ? r.id : id(),
      name: text(r.name) || 'Resource',
      max,
      current: Math.min(max, value(r.current, max)),
      amount: Math.max(1, value(r.amount, 5)),
      display: r.display === 'percent' ? 'percent' : 'number',
      regen: value(r.regen, 0),
      refillOnRest: r.refillOnRest !== false,
      color: COLORS.includes(r.color) ? r.color : 'teal'
    };
  }

  function normalizeState(state) {
    const ids = new Set();
    state.resources = (Array.isArray(state.resources) ? state.resources : [])
      .map(normalizeResource).filter(Boolean).map((r) => {
        if (ids.has(r.id)) r.id = id();
        ids.add(r.id);
        return r;
      });
    // Existing character files did not contain this flag; leave their mana visible.
    state.showMana = state.showMana !== false;
  }

  function init(getState, save) {
    const section = document.getElementById('resourceSection');
    const list = document.getElementById('resourceList');
    const showMana = document.getElementById('showManaPool');
    const mana = document.getElementById('manaPool');
    const byId = (resourceId) => getState().resources.find((r) => r.id === resourceId);
    const effectiveMax = (r) => window.WBAbilities && window.WBAbilities.resourceMax ? window.WBAbilities.resourceMax(getState(), r) : r.max;

    function render() {
      const state = getState();
      showMana.checked = state.showMana;
      mana.hidden = !state.showMana;
      if (!state.resources.length) {
        list.innerHTML = '<p class="resource-empty">No additional resources. Add Energy, Stamina, Heat, or anything your character uses.</p>';
        return;
      }
      list.innerHTML = state.resources.map((r) => {
        const maxNow = effectiveMax(r);
        // When a temporary maximum expires, excess points cannot remain above
        // the restored cap. Raising the cap never grants free points.
        if (r.current > maxNow) r.current = maxNow;
        const percent = Math.min(100, Math.round(100 * r.current / maxNow));
        const currentDisplay = r.display === 'percent' ? percent + '%' : r.current + ' / ' + maxNow;
        return '<div class="custom-resource" data-resource-id="' + escape(r.id) + '">' +
          '<div class="resource-top">' +
            '<label class="resource-name"><span class="foot-label">Name</span>' +
              '<input aria-label="Resource name" maxlength="48" data-resource-prop="name" value="' + escape(r.name) + '"></label>' +
            '<strong class="resource-figure" aria-live="polite">' + escape(currentDisplay) + '</strong>' +
            '<button type="button" class="xbtn del" data-resource-action="remove" aria-label="Remove ' + escape(r.name) + '">&times;</button>' +
          '</div>' +
          '<div class="resource-meter ' + escape(r.color) + '" role="progressbar" aria-label="' + escape(r.name) + '" aria-valuemin="0" aria-valuemax="' + maxNow + '" aria-valuenow="' + r.current + '">' +
            '<span style="width:' + percent + '%"></span></div>' +
          '<div class="resource-values">' +
            '<label><span class="foot-label">Current</span><input type="number" inputmode="numeric" min="0" max="' + maxNow + '" data-resource-prop="current" value="' + r.current + '"></label>' +
            '<label><span class="foot-label">Base maximum</span><input type="number" inputmode="numeric" min="1" max="' + LIMIT + '" data-resource-prop="max" value="' + r.max + '"></label>' +
            '<label><span class="foot-label">Display</span><select data-resource-prop="display">' +
              '<option value="number"' + (r.display === 'number' ? ' selected' : '') + '>Points</option>' +
              '<option value="percent"' + (r.display === 'percent' ? ' selected' : '') + '>Percent</option>' +
            '</select></label>' +
          '</div>' +
          (maxNow !== r.max ? '<span class="resource-effect-bonus">Effective maximum: ' + maxNow + ' (' + (maxNow > r.max ? '+' : '') + (maxNow - r.max) + ' from abilities)</span>' : '') +
          '<div class="resource-actions">' +
            '<label class="resource-adjust"><span class="foot-label">Amount</span>' +
              '<input type="number" min="1" max="' + LIMIT + '" value="' + r.amount + '" data-resource-amount aria-label="Amount to spend or restore"></label>' +
            '<button type="button" class="btn" data-resource-action="spend">Spend</button>' +
            '<button type="button" class="btn" data-resource-action="restore">Restore</button>' +
            '<button type="button" class="btn" data-resource-action="refill">Fill</button>' +
          '</div>' +
          '<div class="resource-options">' +
            '<label><span class="foot-label">Restore each turn</span><input type="number" min="0" max="' + LIMIT + '" value="' + r.regen + '" data-resource-prop="regen"></label>' +
            '<label><span class="foot-label">Bar color</span><select data-resource-prop="color">' +
              COLORS.map((c) => '<option value="' + c + '"' + (c === r.color ? ' selected' : '') + '>' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>').join('') +
            '</select></label>' +
            '<label class="resource-refill"><input type="checkbox" data-resource-prop="refillOnRest"' + (r.refillOnRest ? ' checked' : '') + '> Fill on long rest</label>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    document.getElementById('addResource').addEventListener('click', () => {
      const state = getState();
      state.resources.push(normalizeResource({ id: id(), name: 'Resource', max: 100, current: 100 }));
      render();
      save();
      const names = list.querySelectorAll('[data-resource-prop="name"]');
      if (names.length) { const last = names[names.length - 1]; last.focus(); last.select(); }
    });

    showMana.addEventListener('change', () => {
      getState().showMana = showMana.checked;
      render();
      save();
    });

    list.addEventListener('change', (e) => {
      // Remember this amount independently for each pool, including after re-renders and reloads.
      const amountInput = e.target.closest('[data-resource-amount]');
      if (amountInput) {
        const card = amountInput.closest('[data-resource-id]');
        const r = card && byId(card.dataset.resourceId);
        if (!r) return;
        r.amount = String(amountInput.value).trim() === '' ? r.amount : Math.max(1, value(amountInput.value, r.amount));
        amountInput.value = String(r.amount);
        save();
        return;
      }
      const input = e.target.closest('[data-resource-prop]');
      if (!input) return;
      const card = input.closest('[data-resource-id]');
      const r = card && byId(card.dataset.resourceId);
      if (!r) return;
      const prop = input.dataset.resourceProp;
      if (prop === 'name') r.name = text(input.value) || 'Resource';
      else if (prop === 'max') {
        r.max = Math.max(1, value(input.value, r.max));
        r.current = Math.min(r.max, r.current);
      } else if (prop === 'current') r.current = Math.min(effectiveMax(r), value(input.value, r.current));
      else if (prop === 'regen') r.regen = value(input.value, r.regen);
      else if (prop === 'display') r.display = input.value === 'percent' ? 'percent' : 'number';
      else if (prop === 'color') r.color = COLORS.includes(input.value) ? input.value : 'teal';
      else if (prop === 'refillOnRest') r.refillOnRest = input.checked;
      render();
      save();
    });

    list.addEventListener('click', (e) => {
      const button = e.target.closest('[data-resource-action]');
      if (!button) return;
      const card = button.closest('[data-resource-id]');
      const r = card && byId(card.dataset.resourceId);
      if (!r) return;
      const action = button.dataset.resourceAction;
      if (action === 'remove') {
        if (!window.confirm('Remove ' + r.name + '? This cannot be undone unless you import a saved character.')) return;
        getState().resources = getState().resources.filter((x) => x.id !== r.id);
      } else if (action === 'refill') r.current = r.max;
      else {
        const field = card.querySelector('[data-resource-amount]');
        // Save the amount before the card is rebuilt; never revert to the default 5.
        r.amount = field && String(field.value).trim() !== '' ? Math.max(1, value(field.value, r.amount)) : r.amount;
        if (action === 'spend') r.current = Math.max(0, r.current - r.amount);
        if (action === 'restore') r.current = Math.min(effectiveMax(r), r.current + r.amount);
      }
      render();
      save();
    });

    function turnStart() {
      let changed = false;
      getState().resources.forEach((r) => {
        if (r.regen && r.current < effectiveMax(r)) {
          r.current = Math.min(effectiveMax(r), r.current + r.regen);
          changed = true;
        }
      });
      if (changed) { render(); save(); }
    }
    function longRest() {
      getState().resources.forEach((r) => { if (r.refillOnRest) r.current = r.max; });
      render();
    }

    render();
    return { render, turnStart, longRest };
  }

  window.WBResources = { normalizeState, init };
})();
