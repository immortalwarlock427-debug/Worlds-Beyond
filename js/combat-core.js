/* Worlds-Beyond shared combat rules, phase 1.
 * Pure computations only: no DOM, localStorage, network, random rolls or UI.
 * Both the character sheet and future DM view should call these functions.
 * Homebrew STR/VIT/DEX/AGL/INT/WIS/CHA/FTH + AP rules are kept unchanged.
 */
(function () {
  'use strict';
  const STATS = ['STR','VIT','DEX','AGL','INT','WIS','CHA','FTH'];
  const ASI_LEVELS = [4,8,12,16,19];
  const SLOTS = ['head','amulet','torso','rarm','larm','rring','lring',
    'belt','rleg','lleg','main','off'];
  const record = obj => obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  const isSet = v => v != null && String(v).trim() !== '';
  const num = v => {
    const text = String(v == null ? '' : v).trim().replace(/−/g,'-');
    return text === '' ? NaN : Number(text);
  };
  function level(state) {
    const l = Math.floor(num(record(state.fields).level));
    return isNaN(l) || l < 1 ? 1 : Math.min(l,100);
  }
  function keyAt(state, stat, n) {
    const h = record(state.hist)[stat];
    if (!h || typeof h !== 'object') return null;
    let best = null, bestLv = -Infinity, first = null, firstLv = Infinity;
    Object.keys(h).forEach(key => {
      const lv = Number(key);
      const v = h[key];
      if (!isSet(v) || isNaN(num(v))) return;
      if (lv <= n && lv > bestLv) { best = key; bestLv = lv; }
      if (lv < firstLv) { first = key; firstLv = lv; }
    });
    return best != null ? best : first;
  }
  function rawAt(state, stat, n) {
    const key = keyAt(state, stat, n);
    return key == null ? null : state.hist[stat][key];
  }
  function asiSum(state, stat, n) {
    let total = 0;
    ASI_LEVELS.forEach(lv => {
      if (lv <= n && state.asi && state.asi[lv] && state.asi[lv][stat]) total += state.asi[lv][stat];
    });
    return total;
  }
  function scoreAt(state, stat, n) {
    const value = rawAt(state, stat, n);
    return value == null ? null : num(value) + asiSum(state, stat, n);
  }
  function gearBonus(state, key, settledOnly=false) {
    const equip = record(state.equip),settled=record(state.settled);
    let total = 0;
    SLOTS.forEach(slot => {
      const id = equip[slot];
      if (!id || (settledOnly && !settled[id])) return;
      const item = (state.items || []).find(it => it && it.id === id);
      if (item) (item.bonuses || []).forEach(b => { if (b.t === key) total += b.v; });
    });
    return total;
  }
  function gearArmor(state) {
    const equip=record(state.equip);
    return SLOTS.reduce((sum,slot) => {
      const item=(state.items || []).find(it => it && it.id === equip[slot]);
      return sum + (item ? (Number(item.ar) || 0) : 0);
    },0);
  }
  // Active ability and form bonuses are supplied by WBAbilities. Keeping the
  // components explicit avoids silently treating temporary buffs as base stats.
  function effectiveScore(state, stat, n, abilityBonus=0, formBonus=0) {
    const base=scoreAt(state,stat,n);
    return base == null ? null : base + gearBonus(state,stat) + abilityBonus + formBonus;
  }
  function autoMod(stat,score) {
    if (stat === 'STR' || stat === 'DEX') return Math.floor((score - 12) / 2);
    return score >= 12 ? Math.ceil((score - 12) / 3) : -Math.ceil((12 - score) / 3);
  }
  function modifier(state, stat, n, abilityBonus=0, formBonus=0) {
    const override=record(state.over)['mod-'+stat];
    if (isSet(override) && !isNaN(num(override))) return num(override);
    const score=effectiveScore(state,stat,n,abilityBonus,formBonus);
    return score == null ? 0 : autoMod(stat,score);
  }
  function attackApCost(mod) { return Math.max(5,10-mod); }
  function trackerMax(value,fallback) {
    let m=num(value);
    if (isNaN(m)) m=num(fallback);
    return isNaN(m) || m < 0 ? 0 : Math.min(Math.floor(m),40);
  }
  function trackerAvailable(current,max) {
    return current == null ? max : Math.max(0,Math.min(current,max));
  }
  function givenAp(state) {
    return state.apGiven && state.apGiven.n > 0 ? state.apGiven.n : 0;
  }
  function apAvailable(state,ownAvailable) { return ownAvailable + givenAp(state); }
  function givenRecord(state,n) {
    return {n:Math.max(0,Math.min(40,Math.round(n))),
      fresh:state.apGiven ? !!state.apGiven.fresh : true};
  }
  // Returns a patch; never mutates state. Extra AP (Command) is spent first.
  function spendAp(state,ownAvailable,cost) {
    const given=givenAp(state);
    const fromGiven=Math.min(given,cost);
    const patch={apAvail:Math.max(0,ownAvailable-(cost-fromGiven))};
    if (fromGiven) patch.apGiven=givenRecord(state,given-fromGiven);
    return patch;
  }
  // Refund AP to the normal pool first. Overflow goes into Command AP.
  function refundAp(state,ownAvailable,ownMax,amount) {
    const back=Math.min(Math.max(0,ownMax-ownAvailable),amount);
    const patch={apAvail:ownAvailable+back};
    if (amount>back) patch.apGiven=givenRecord(state,givenAp(state)+(amount-back));
    return patch;
  }
  function movePlan(ft,speed,movement,freeApLeft) {
    const m=movement || {ft:0,left:0,surge:0};
    const fromLeft=Math.min(m.left,ft);
    const rest=ft-fromLeft;
    const ap=rest>0 && speed>0 ? Math.ceil(rest/speed) : 0;
    const free=Math.min(freeApLeft,ap);
    return {ft,sp:speed,fromLeft,ap,free,paid:ap-free,
      leftAfter:m.left-fromLeft+(ap*speed-rest)};
  }
  function movementAfter(m,ft,plan) {
    const before=m || {ft:0,left:0,surge:0};
    return {ft:before.ft+ft,left:plan.leftAfter,surge:before.surge+plan.free};
  }
  window.WBCombat = {
    STATS,ASI_LEVELS,SLOTS,
    level,keyAt,rawAt,asiSum,scoreAt,gearBonus,gearArmor,effectiveScore,
    autoMod,modifier,attackApCost,trackerMax,trackerAvailable,givenAp,apAvailable,
    spendAp,refundAp,movePlan,movementAfter
  };
})();
