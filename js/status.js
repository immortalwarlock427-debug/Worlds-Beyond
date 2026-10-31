/* Worlds Beyond: active statuses and condition tracker.
   Ability effects remain owned by WBAbilities; this module only summarizes them.
   Hand-entered conditions are descriptive and never silently change sheet stats. */
(function () {
  'use strict';
  const MAX = 999999;
  const TYPES = ['buff', 'debuff', 'condition', 'other'];
  const TYPE_LABELS = { buff: 'Buff', debuff: 'Debuff', condition: 'Condition', other: 'Other' };
  const PRESETS=['Bleeding','Blinded','Burning','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];
  const presetText=window.WBRulesCatalog?.statuses||{};
  const STATS = ['STR', 'VIT', 'DEX', 'AGL', 'INT', 'WIS', 'CHA', 'FTH'];
  const id = () => 'sts' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const clean = (v, limit) => String(v == null ? '' : v).trim().slice(0, limit);
  const escape = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const turns = (v) => {
    if (v == null || String(v).trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(MAX, Math.round(n))) : null;
  };
  const signed = (n) => (Number(n) > 0 ? '+' : '') + Number(n);

  function normalizeStatus(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
    return {
      ...s,
      preset:PRESETS.includes(s.preset)?s.preset:'',dc:s.dc==null||s.dc===''?(['Bleeding','Burning'].includes(s.preset)?12:null):turns(s.dc),sourceLevel:Math.max(1,Math.min(100,Number(s.sourceLevel)||1)),
      id: typeof s.id === 'string' && /^sts[a-z0-9]{6,40}$/.test(s.id) ? s.id : id(),
      name: clean(s.name, 100) || 'Unnamed condition',
      type: TYPES.includes(s.type) ? s.type : 'condition',
      source: clean(s.source, 100),
      notes: clean(s.notes, 1200),
      remaining: turns(s.remaining)
    };
  }
  function normalizeState(state) {
    const ids = new Set();
    state.statuses = (Array.isArray(state.statuses) ? state.statuses : [])
      .map(normalizeStatus).filter(Boolean).map(s => {
        if (ids.has(s.id)) s.id = id();
        ids.add(s.id);
        return s;
      });
  }

  function formatEffect(e, state) {
    if (!e || !e.value || e.target === 'none') return '';
    const v = Number(e.value);
    if (!Number.isFinite(v)) return '';
    let target = '';
    if (e.target === 'movement') target = 'ft/AP Movement';
    else if (e.target === 'armor') target = 'Armor Rating';
    else if (e.target === 'evasion') target = 'Evasion';
    else if (e.target === 'stat') target = STATS.includes(e.stat) ? e.stat : 'stat';
    else if (e.target === 'resource-max') {
      const r = (state.resources || []).find(r => r.id === e.resourceId);
      target = (r ? r.name : 'Missing resource') + ' maximum';
    } else return '';
    return signed(v) + ' ' + target;
  }

  function activeEntries(state) {
    const abilities = (Array.isArray(state.abilities) ? state.abilities : []).filter(a => a.durationLeft > 0);
    const effects = abilities.map(a => {
      const labels = (a.effects || []).map(e => formatEffect(e, state)).filter(Boolean);
      const signs = (a.effects || []).filter(e => e && e.target !== 'none' && e.value).map(e => Math.sign(Number(e.value)));
      const tone = signs.length && signs.every(s => s > 0) ? 'buff' :
        signs.length && signs.every(s => s < 0) ? 'debuff' : 'other';
      return {
        id: a.id, type: 'ability', name: a.name, source: 'Ability',
        remaining: a.durationLeft, labels,
        tone, notes: a.description || '',
        cooldownLeft: a.cooldownLeft || 0
      };
    });
    const manual = (state.statuses || []).map(s => ({
      id: s.id, type: 'manual', name: s.name, source: s.source || 'Manual',
      remaining: s.remaining, labels: [], tone: s.type, notes: s.notes,preset:s.preset,dc:s.dc,sourceLevel:s.sourceLevel
    }));
    return { effects, manual, total: effects.length + manual.length };
  }

  function advanceTurn(state) {
    let changed = false;
    state.statuses = (state.statuses || []).filter(s => {
      if (s.remaining == null) return true;
      if (s.remaining > 0) { s.remaining--; changed = true; }
      return s.remaining > 0;
    });
    return changed;
  }

  function endAbility(state, abilityId) {
    const ability = (state.abilities || []).find(a => a.id === abilityId);
    if (!ability || !(ability.durationLeft > 0)) return false;
    ability.durationLeft = 0;
    return true;
  }
  function endManual(state, statusId) {
    const previous = (state.statuses || []).length;
    state.statuses = (state.statuses || []).filter(s => s.id !== statusId);
    return state.statuses.length !== previous;
  }

  function init(getState, save, controls) {
    controls = controls || {};
    const abilityList = document.getElementById('statusAbilityList');
    const manualList = document.getElementById('statusManualList');
    const summary = document.getElementById('statusSummary');
    const feedback = document.getElementById('statusFeedback');
    const form = document.getElementById('statusAddForm');
    const name = document.getElementById('statusName');
    const type = document.getElementById('statusType');
    const source = document.getElementById('statusSource');
    const duration = document.getElementById('statusDuration');
    const notes = document.getElementById('statusNotes');

    const remainingText = n => n == null ? 'Until removed' : n + ' turn' + (n === 1 ? '' : 's') + ' left';

    function abilityRow(e) {
      return '<article class="status-card" data-status-ability="' + escape(e.id) + '">' +
        '<div class="status-card-top"><div><span class="status-kind status-' + escape(e.tone) + '">' +
        (e.tone === 'buff' ? 'Buff' : e.tone === 'debuff' ? 'Debuff' : 'Ability effect') + '</span>' +
        '<h3>' + escape(e.name) + '</h3></div>' +
        '<div class="status-card-actions"><strong class="status-turns">' + escape(remainingText(e.remaining)) + '</strong>' +
        '<button class="btn" type="button" data-status-action="end-ability">End effect</button></div></div>' +
        (e.labels.length ? '<div class="status-modifiers">' + e.labels.map(t =>
          '<span class="status-modifier">' + escape(t) + '</span>').join('') + '</div>' :
          '<p class="status-secondary">Timed ability (no automatic stat changes)</p>') +
        (e.cooldownLeft ? '<p class="status-secondary">Cooldown: ' + e.cooldownLeft + ' turn(s) remaining</p>' : '') +
        (e.notes ? '<p class="status-note">' + escape(e.notes) + '</p>' : '') +
        '</article>';
    }
    function manualRow(e) {
      return '<article class="status-card" data-status-manual="' + escape(e.id) + '">' +
        '<div class="status-card-top"><div><span class="status-kind status-' + escape(e.tone) + '">' +
          escape(TYPE_LABELS[e.tone] || 'Condition') + '</span>' +
          '<h3>' + escape(e.name) + '</h3></div>' +
        '<div class="status-card-actions"><strong class="status-turns">' + escape(remainingText(e.remaining)) + '</strong>' +
          '<button type="button" class="btn" data-status-action="end-manual">Remove</button></div></div>' +
        '<p class="status-secondary">Source: ' + escape(e.source) + '</p>' +
        (e.notes ? '<p class="status-note">' + escape(e.notes) + '</p>' : '') +
        (['Bleeding','Burning','Poisoned'].includes(e.preset||e.name)?'<label>Effect DC<input type="number" min="0" data-status-edit="dc" value="'+(e.dc??'')+'"></label><button type="button" class="btn" data-status-action="shake">Shake It Off (VIT-discounted 5 AP)</button>':'')+
        (['Bleeding','Burning'].includes(e.preset||e.name)?'<label>Source level<input type="number" min="1" max="100" data-status-edit="sourceLevel" value="'+(e.sourceLevel||1)+'"></label><button type="button" class="btn" data-status-action="roll-status">Roll status damage</button>':'')+
        ((e.preset||e.name)==='Prone'?'<button type="button" class="btn" data-status-action="stand">Stand up (5 AP)</button>':'')+
        '<div class="status-edit"><label class="ability-field"><span class="foot-label">Turns remaining (blank = indefinite)</span>' +
          '<input data-status-edit="remaining" type="number" min="0" max="' + MAX + '" value="' +
            (e.remaining == null ? '' : e.remaining) + '" placeholder="Indefinite"></label></div>' +
        '</article>';
    }
    function render() {
      const entries = activeEntries(getState());
      summary.textContent = entries.total + ' active status' + (entries.total === 1 ? '' : 'es') +
        ' · ' + entries.effects.length + ' from abilities · ' + entries.manual.length + ' manually tracked';
      abilityList.innerHTML = entries.effects.length ? entries.effects.map(abilityRow).join('') :
        '<p class="status-empty">No active ability effects. Activate an ability with a duration to see it here.</p>';
      manualList.innerHTML = entries.manual.length ? entries.manual.map(manualRow).join('') :
        '<p class="status-empty">No manually tracked conditions.</p>';
    }

    const preset=document.getElementById('statusPreset');if(preset){preset.innerHTML='<option value="">Custom condition</option>'+PRESETS.map(name=>'<option>'+name+'</option>').join('');preset.addEventListener('change',()=>{if(preset.value){name.value=preset.value;notes.value=presetText[preset.value]||'Record the source, duration and agreed effects. Resolve this condition at the table.';}});}
    form.addEventListener('submit', e => {
      e.preventDefault();
      const value = clean(name.value, 100);
      if (!value) { feedback.textContent = 'Enter a condition or effect name.'; name.focus(); return; }
      getState().statuses.push(normalizeStatus({
        id: id(), name: value,preset:preset&&preset.value, type: type.value, source: source.value,
        notes: notes.value, remaining: duration.value
      }));
      // A manually noted status is descriptive; it does not change any stat math.
      form.reset();
      feedback.textContent = 'Added ' + value + '.';
      render();
      save();
    });
    document.getElementById('statusSec').addEventListener('click', e => {
      const b = e.target.closest('button[data-status-action]');
      if (!b) return;
      const action = b.dataset.statusAction;
      const card = b.closest('.status-card');
      if (!card) return;
      if (action === 'end-ability') {
        if(controls.execute){const r=controls.execute({type:'EndAbilityEffect',abilityId:card.dataset.statusAbility});if(!r.ok)return;}else if(!endAbility(getState(),card.dataset.statusAbility))return;
        feedback.textContent = 'Ended ability effect. AP and resource costs are not refunded.';
        if (controls.refresh) controls.refresh();
      } else if (action === 'end-manual') {
        if(controls.execute)controls.execute({type:'EndManualStatus',statusId:card.dataset.statusManual});else if(!endManual(getState(),card.dataset.statusManual))return;
        feedback.textContent = 'Removed condition.';
      } else if(action==='stand'&&controls.execute){const r=controls.execute({type:'StandUp',statusId:card.dataset.statusManual});feedback.textContent=r.message;if(r.ok){if(controls.refresh)controls.refresh();save();}return;
      } else if(action==='shake'&&controls.execute){const status=getState().statuses.find(s=>s.id===card.dataset.statusManual),result=controls.execute({type:'BeginShakeItOff',statusId:status.id});feedback.textContent=result.message;if(result.ok){if(controls.refresh)controls.refresh();save();controls.shake(result.shakePlan);}return;
      } else if(action==='roll-status'&&controls.rollStatus){const status=getState().statuses.find(s=>s.id===card.dataset.statusManual);const dice=window.WBCombat.scalingTier({fields:{level:status.sourceLevel||1}})+'d'+((status.preset||status.name)==='Burning'?6:4);controls.rollStatus(status.name,dice,status.preset||status.name);return;
      } else return;
      render();
      save();
    });
    manualList.addEventListener('change', e => {
      const input = e.target.closest('[data-status-edit]');
      if (!input) return;
      const card = input.closest('[data-status-manual]');
      const status = card && getState().statuses.find(s => s.id === card.dataset.statusManual);
      if (!status) return;
      if(input.dataset.statusEdit!=='remaining'){status[input.dataset.statusEdit]=turns(input.value);save();return;}
      const n = turns(input.value);
      if (n === 0) endManual(getState(), status.id);
      else status.remaining = n;
      render();
      save();
    });
    render();
    return { render, turnStart() { if (advanceTurn(getState())) { render(); save(); } } };
  }

  window.WBStatus = { PRESETS,presetText,normalizeState, normalizeStatus, activeEntries, advanceTurn, endAbility, endManual, formatEffect, init };
})();
