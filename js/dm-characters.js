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
  // Ability durations live on the player's sheet, not in encounter snapshots.
  // Describe each active effect for the DM without applying its bonus.
  function temporaryEffectWarnings(state) {
    const resources = new Map((Array.isArray(state.resources) ? state.resources : [])
      .filter(r => r && typeof r.id === 'string').map(r => [r.id,String(r.name || r.id).slice(0,100)]));
    const names={movement:'Movement (ft/AP)',armor:'Armor Rating',evasion:'Evasion'};
    const stats=['STR','DEX','VIT','AGL','INT','WIS','CHA','FTH'];
    const result=[];
    for(const a of (Array.isArray(state.abilities) ? state.abilities : [])) {
      if(!a || typeof a !== 'object')continue;
      const turns=Number(a.durationLeft);
      if(!Number.isFinite(turns) || turns<=0)continue;
      const effects=Array.isArray(a.effects) ? a.effects :
        (a.effectTarget && a.effectTarget!=='none' ?
          [{target:a.effectTarget,value:a.effectValue,stat:a.effectStat,resourceId:a.effectResourceId}] : []);
      const bonuses=[];
      for(const effect of effects) {
        if(!effect || typeof effect!=='object')continue;
        const n=Number(effect.value);
        if(!Number.isFinite(n)||!n)continue;
        const amount=Math.max(-99999,Math.min(99999,Math.round(n)));
        if(!amount)continue;
        let label=names[effect.target];
        if(effect.target==='stat') {
          if(!stats.includes(effect.stat))continue;
          label=effect.stat+' score';
        } else if(effect.target==='resource-max') {
          const id=typeof effect.resourceId==='string'?effect.resourceId:'';
          label='maximum '+(resources.get(id)||id||'custom resource');
        }
        if(label)bonuses.push((amount>0?'+':'')+amount+' '+label);
      }
      const name=String(a.name||'Unnamed ability').trim().slice(0,100)||'Unnamed ability';
      const count=Math.max(1,Math.floor(turns));
      result.push('Active temporary ability "'+name+'" ('+count+
        (count===1?' turn':' turns')+' left): '+
        (bonuses.length?bonuses.join(', '):'no automatic numerical bonuses')+
        '. Temporary effects were not imported.');
    }
    return result;
  }
  function fromCharacter(state, fallbackId) {
    if (!state || typeof state !== 'object' || Array.isArray(state) ||
        !state.fields || typeof state.fields !== 'object' ||
        !state.hist || typeof state.hist !== 'object') return null;
    const rules = window.WBCombat, abilities = window.WBAbilities;
    const fields = record(state.fields), over = record(state.over);
    const lvl = rules.level(state);
    // Form and gear modifiers remain; live ability bonuses cannot be made permanent.
    const bonus = () => 0;
    const formBonus = key => abilities && Array.isArray(state.abilityLoadouts) ?
      abilities.formStatBonus(state, key) : 0;
    const vit = rules.effectiveScore(state, 'VIT', lvl, bonus('stat','VIT'), formBonus('VIT'));
    const vitMod = rules.modifier(state, 'VIT', lvl, bonus('stat','VIT'), formBonus('VIT'));
    const health = rules.characterMaxHealth(state);
    const warnings = temporaryEffectWarnings(state);
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
    const speedFt = bounded(baseSpeed,5,0,10000);
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
        id, name, kind: 'pc', side:'party', ownerId: 'offline',
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