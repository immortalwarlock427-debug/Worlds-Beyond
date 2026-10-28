/* Worlds Beyond: optional equipment profiles tied to mechanical forms.
   The inventory and item identities are shared. Only worn slots change.
   Characters and game sessions remain separate saves. */
(function () {
  'use strict';
  const BASE = 'base';
  const SLOTS = ['head','amulet','torso','rarm','larm','rring','lring','belt','rleg','lleg','main','off'];
  const FIT = {
    head: ['head'], amulet: ['amulet'], torso: ['torso'],
    rarm: ['arms'], larm: ['arms'], rring: ['ring'], lring: ['ring'],
    belt: ['belt'], rleg: ['legs'], lleg: ['legs'],
    main: ['onehand','twohand'], off: ['onehand','shield']
  };
  const PAIRS = {arms: ['rarm','larm'], ring: ['rring','lring'], legs: ['rleg','lleg']};
  const record = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const key = id => id || BASE;
  function sanitize(state, profile) {
    const inventory = new Map((state.items || []).filter(Boolean).map(item => [item.id, item]));
    const output = {}, seen = new Set();
    for (const slot of SLOTS) {
      const id = record(profile)[slot];
      const item = inventory.get(id);
      if (!item || !FIT[slot].includes(item.type) || seen.has(id)) continue;
      // Pairs are represented in their primary slot, and a two-handed weapon
      // occupies the offhand implicitly. Do not equip conflicting pieces.
      const pair = PAIRS[item.type];
      if (item.pair && pair && slot !== pair[0]) continue;
      if (slot === 'off' && output.main && inventory.get(output.main).type === 'twohand') continue;
      if (pair && slot === pair[1] && output[pair[0]]) {
        const first = inventory.get(output[pair[0]]);
        if (first && first.type === item.type && first.pair) continue;
      }
      output[slot] = id;
      seen.add(id);
      if (item.pair && pair) delete output[pair[1]];
      if (item.type === 'twohand') delete output.off;
    }
    return output;
  }
  function normalizeState(state) {
    const all = record(state.equipmentProfiles);
    const valid = new Set([BASE, ...(state.abilityLoadouts || []).map(f => f.id)]);
    const activeKey = valid.has(state.activeAbilityLoadoutId) ? key(state.activeAbilityLoadoutId) : BASE;
    const current = sanitize(state, state.equip);
    const result = {};
    result[BASE] = sanitize(state, all[BASE] || current);
    for (const form of (state.abilityLoadouts || [])) {
      result[form.id] = sanitize(state, all[form.id] || current);
    }
    result[activeKey] = current; // Current worn gear is authoritative on import.
    state.equipmentProfiles = result;
    state.equip = current;
  }
  function capture(state) {
    if (!state.equipmentProfiles) normalizeState(state);
    const k = key(state.activeAbilityLoadoutId);
    state.equipmentProfiles[k] = sanitize(state, state.equip);
  }
  function switchForm(state, destination) {
    if (!state.equipmentProfiles) normalizeState(state);
    const target = key(destination);
    if (target !== BASE && !(state.abilityLoadouts || []).some(f => f.id === destination)) return false;
    const previous = key(state.activeAbilityLoadoutId);
    capture(state);
    if (!state.equipmentProfiles[target]) state.equipmentProfiles[target] = sanitize(state, state.equip);
    state.equip = sanitize(state, state.equipmentProfiles[target]);
    return true;
  }
  function removeForm(state, identifier) {
    if (!state.equipmentProfiles) normalizeState(state);
    delete state.equipmentProfiles[identifier];
  }
  function removeItem(state, itemId) {
    for (const profile of Object.values(record(state.equipmentProfiles))) {
      for (const slot of SLOTS) if (profile[slot] === itemId) delete profile[slot];
    }
  }
  function copyBase(state) {
    if (!state.equipmentProfiles) normalizeState(state);
    const target = key(state.activeAbilityLoadoutId);
    if (target === BASE) return false;
    capture(state);
    state.equip = sanitize(state, state.equipmentProfiles[BASE]);
    capture(state);
    return true;
  }
  function clearCurrent(state) {
    if (!state.equipmentProfiles) normalizeState(state);
    state.equip = {};
    capture(state);
  }
  function name(state) {
    const form = (state.abilityLoadouts || []).find(f => f.id === state.activeAbilityLoadoutId);
    return form ? form.name : 'Base';
  }
  window.WBEquipment = { normalizeState, capture, switchForm, removeForm, removeItem, copyBase, clearCurrent, name, sanitize };
})();
