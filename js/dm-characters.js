/* Adapt a player-owned character export into a minimal DM encounter snapshot.
 * No player save is mutated. Uses WBCombat for scores, gear and Health advancement.
 * Does not interpret ability scripts or automatically roll initiative.
 */
(function () {
  'use strict';
  const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const validId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id);
  const numeric = value => value == null || String(value).trim() === '' ? NaN : Number(value);
  function bounded(value, fallback, min, max) {
    const n = numeric(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  }
  function fromCharacter(state, fallbackId) {
    if (!state || typeof state !== 'object' || Array.isArray(state) ||
        !state.fields || typeof state.fields !== 'object' ||
        !state.hist || typeof state.hist !== 'object') return null;
    const rules = window.WBCombat, abilities = window.WBAbilities;
    const fields = record(state.fields), over = record(state.over);
    const lvl = rules.level(state);
    const bonus = (type, key) => abilities && Array.isArray(state.abilities) ?
      abilities.effectBonus(state, type, key) : 0;
    const formBonus = key => abilities && Array.isArray(state.abilityLoadouts) ?
      abilities.formStatBonus(state, key) : 0;
    const vit = rules.effectiveScore(state, 'VIT', lvl, bonus('stat','VIT'), formBonus('VIT'));
    const vitMod = rules.modifier(state, 'VIT', lvl, bonus('stat','VIT'), formBonus('VIT'));
    const health = rules.characterMaxHealth(state);
    const warnings = [];
    const manualMax = numeric(over.hpMax);
    let maxHp = Number.isFinite(manualMax) && manualMax > 0 ?
      bounded(manualMax, 10, 1, 1000000) : health.max;
    const current = numeric(fields.hpCur);
    if (!(maxHp > 0)) {
      maxHp = Math.max(1, bounded(current, 10, 1, 1000000));
      warnings.push('Maximum Health could not be calculated. Check it in Setup.');
    }
    if (!(Number.isFinite(manualMax) && manualMax > 0) && health.missing.length)
      warnings.push('Missing Health advancement rolls at level(s) ' +
        health.missing.slice(0, 12).join(', ') + '. Check maximum Health.');
    maxHp = bounded(maxHp, 10, 1, 1000000);
    const hp = bounded(current, maxHp, -1000000, 1000000);
    const armorOverride = numeric(over.armor);
    const armor = Number.isFinite(armorOverride) ?
      armorOverride : rules.gearArmor(state) +
      (vit != null && vit >= 28 ? Math.floor(vit / 2) : vitMod) + bonus('armor');
    if (vit == null) warnings.push('VIT is missing. Check Armor Rating and Death Threshold.');
    const initOverride = numeric(over.init);
    const initiativeBonus = Number.isFinite(initOverride) ? initOverride :
      rules.modifier(state, 'WIS', lvl, bonus('stat','WIS'), formBonus('WIS')) +
      rules.gearBonus(state, 'init');
    const agility = rules.effectiveScore(state,'AGL',lvl,bonus('stat','AGL'),formBonus('AGL'));
    const agilityMod = rules.modifier(state,'AGL',lvl,bonus('stat','AGL'),formBonus('AGL'));
    const speedOverride = numeric(over.speed);
    const baseSpeed = Number.isFinite(speedOverride) ? speedOverride :
      Math.max(0,Math.max(5,5*(1+agilityMod))+rules.gearBonus(state,'move'));
    const speedFt = bounded(abilities && Array.isArray(state.abilities) ?
      abilities.effectiveMovement(state,baseSpeed) : baseSpeed,5,0,10000);
    const surgeMax = agility != null && agility >= 21 ? 2 : 0;
    const apMax = rules.trackerMax(fields.apMax, 15);
    const apAvail = rules.trackerAvailable(state.apAvail, apMax);
    const trauma = bounded(state.trauma, 0, 0, 100000);
    const deathThreshold = vit == null ? null :
      rules.deathThreshold(lvl, vit, trauma);
    const id = validId(state.id) ? state.id :
      validId(fallbackId) ? fallbackId : null;
    if (!id) return null;
    const name = String(fields.charName || 'Unnamed character').trim().slice(0, 100) ||
      'Unnamed character';
    return {
      actor: {
        id, name, kind: 'pc', ownerId: 'offline',
        hp, maxHp, ar: bounded(armor, 0, 0, 1000000),
        deathThreshold, trauma,
        down: hp > 0 ? null : (state.down && typeof state.down === 'object' ?
          { mercy: !!state.down.mercy, stable: !!state.down.stable } :
          { mercy: hp < 0, stable: false }),
        apMax, apAvail, speedFt, surgeMax, initiative: 0,
        initiativeBonus: bounded(initiativeBonus, 0, -10000, 10000)
      },
      initiativeBonus: bounded(initiativeBonus, 0, -10000, 10000),
      level: lvl,
      warnings
    };
  }
  window.WBDMCharacters = { fromCharacter };
})();