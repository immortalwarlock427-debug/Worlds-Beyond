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
  function abilityApCost(baseCost,modifier) {
    const base=Number(baseCost);
    if(!Number.isFinite(base)||base<=0)return 0;
    const discount=Number.isFinite(Number(modifier))?Number(modifier):0;
    return Math.max(Math.ceil(base/2),base-discount);
  }
  function abilitySaveDc(modifier) { return 12+modifier; }
  function commandingPresenceDc(modifier) { return 10+2*modifier; }
  // Dice are parsed here, but drawn by the UI. Reject partial expressions so
  // an ability never spends its costs and silently rolls only part of its dice.
  function parseDamageDice(value) {
    const text=String(value==null?'':value).trim().replace(/−/g,'-');
    if(!text || text.length>120 || /\d\s+\d/.test(text))return null;
    const compact=text.replace(/\s+/g,'');
    if(!/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/i.test(compact))return null;
    const terms=compact.match(/[+-]?[^+-]+/g)||[];
    let count=0,maximum=0,flat=0;
    for(const term of terms){
      const die=term.match(/^\+?(\d*)d(\d+)$/i);
      if(die){
        const n=die[1]===''?1:Number(die[1]),sides=Number(die[2]);
        // The existing random adapter samples an unsigned 32-bit integer.
        if(!Number.isSafeInteger(n)||n<1||!Number.isSafeInteger(sides)||sides<1||sides>4294967296)return null;
        count+=n;maximum+=n*sides;
      } else {
        if(!/^[+-]?\d+$/.test(term))return null;
        flat+=Number(term);
      }
    }
    if(!terms.length||count>1000||!Number.isSafeInteger(maximum)||!Number.isSafeInteger(flat))return null;
    return {expression:compact,count,maximum,flat};
  }
  // Non-weapon worn effects apply to every attack; a weapon contributes only
  // when it is the source. Ability rolls have no implicit weapon source.
  function attackEffects(state,weaponId) {
    return SLOTS.flatMap(slot=>{
      const item=(state.items||[]).find(it=>it&&it.id===record(state.equip)[slot]);
      return item&&(item.id===weaponId||!['onehand','twohand'].includes(item.type))?item.effects||[]:[];
    });
  }
  function trackerMax(value,fallback) {
    let m=num(value);
    if (isNaN(m)) m=num(fallback);
    return isNaN(m) || m < 0 ? 0 : Math.min(Math.floor(m),40);
  }
  function trackerAvailable(current,max) {
    return current == null ? max : Math.max(0,Math.min(current,max));
  }
  function reactionMaximum(state,abilityBonus=0,formBonus=0) {
    const agl=effectiveScore(state,'AGL',level(state),abilityBonus,formBonus);
    const automatic=1+(agl!=null&&agl>=21?1:0)+(agl!=null&&agl>=28?1:0);
    return trackerMax(record(state.over).reactMax,automatic);
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

  // Advancement Health uses the historical VIT score for each level,
  // not the currently equipped gear. Both the sheet and DM import use this.
  function hitDieFor(vit) {
    if (vit >= 46) return '2d12+1d8';
    if (vit >= 43) return '2d12+1d6';
    if (vit >= 40) return '2d12+1d4';
    if (vit >= 37) return '2d12';
    if (vit >= 34) return '1d12+1d10';
    if (vit >= 31) return '1d12+1d8';
    if (vit >= 28) return '1d12+1d6';
    if (vit >= 25) return '1d12+1d4';
    if (vit >= 22) return '1d12';
    if (vit >= 19) return '1d10';
    if (vit >= 16) return '1d8';
    if (vit >= 12) return '1d6';
    return '1d4';
  }
  function healthAtLevel(state, n, vit) {
    if (vit == null) return { die: null, dieMax: 0, gain: null };
    const override = record(state.over).hitDie;
    const die = isSet(override) ? String(override) : hitDieFor(vit);
    const dice = [...die.matchAll(/(\d*)\s*d\s*(\d+)/gi)];
    const dieMax = dice.reduce((sum, parts) => sum +
      (Number(parts[1]) || 1) * Number(parts[2]), 0);
    const roll = num(record(state.rolls)[n]);
    const gain = n === 1 ? (dieMax ? dieMax + Math.floor(vit / 2) : null)
      : isNaN(roll) ? null : roll + Math.floor(vit / 2);
    return { die, dieMax, gain };
  }
  function characterMaxHealth(state) {
    const n = level(state);
    if (scoreAt(state,'VIT',1) == null) return { max: null, missing: [1] };
    let sum = 0;
    const missing = [];
    for (let i = 1; i <= n; i++) {
      const base = scoreAt(state,'VIT',i);
      const gear = record(record(state.lvGear)[i]);
      const vit = base == null ? null : base + (Number(gear.VIT) || 0);
      const result = healthAtLevel(state,i,vit);
      if (result.gain == null) missing.push(i);
      else sum += result.gain;
    }
    return { max: sum + gearBonus(state,'hp'), missing };
  }

  function manaPerLevel(score) {
    if (score >= 28) return 18;
    if (score >= 25) return 14;
    if (score >= 22) return 12;
    if (score >= 19) return 10;
    if (score >= 16) return 8;
    if (score >= 13) return 6;
    return 0;
  }
  function manaAtLevel(n, score) {
    return score == null ? null : n === 1 ? Math.max(0, (score - 12) * 3) : manaPerLevel(score);
  }
  // Advancement uses historical INT/FTH and settled level-up snapshots. Current
  // gear adds only its explicit Max Mana/Holy Power bonus, never retroactive stats.
  function characterMaxMana(state) {
    const holy = record(state.fields).manaKind === 'holy';
    const stat = holy ? 'FTH' : 'INT';
    if (scoreAt(state,stat,1) == null) return null;
    let total = 0;
    for (let n = 1; n <= level(state); n++) {
      const historical = scoreAt(state,stat,n);
      const snapshot = record(record(state.lvGear)[n]);
      if (historical != null) total += manaAtLevel(n,historical + (Number(snapshot[stat]) || 0));
    }
    return total + gearBonus(state,holy ? 'holy' : 'mp');
  }

  // Attack / damage resolution. Dice are rolled by an adapter and passed in;
  // the same outcomes can be checked by the sheet, a DM room or the server.
  function attackHits(total, evasion, naturalDie) {
    return naturalDie === 20 || total >= evasion;
  }
  function dualHits(mainTotal, offTotal, mainDie, offDie, evasion) {
    return {
      main: attackHits(mainTotal,evasion,mainDie),
      off: attackHits(offTotal,evasion,offDie)
    };
  }
  function criticalTotal(rolled, diceMaximum, critical) {
    return rolled + (critical ? diceMaximum : 0);
  }
  function weaponCritical(naturalDie,criticalOnHit) { return naturalDie===20||criticalOnHit===true; }
  function damagePacket(baseRoll, statModifier, flatBonus, extraRolls) {
    const weaponDmg = Math.max(0,baseRoll+statModifier+flatBonus);
    const extras = (extraRolls || []).map(value => Math.max(0,value));
    return { weaponDmg, extras, total: weaponDmg + extras.reduce((sum,v) => sum+v,0) };
  }
  function offhandDamage(total) { return Math.floor(total/2); }
  function armorDamage(total, armor) { return Math.max(0,total-armor); }
  function dualArmorDamage(mainTotal,offTotal,armor,mainHit=true,offHit=true) {
    return (mainHit ? armorDamage(mainTotal,armor) : 0) +
      (offHit ? armorDamage(offhandDamage(offTotal),armor) : 0);
  }
  // Resistance is applied before armor. Overwhelming Force sets a final
  // damage floor except for successful avoidance (dodge/parry in current UI).
  function overwhelmFloor(amount, df) {
    return df.of && df.dmg != null ? Math.max(amount,Math.floor(df.dmg/2)) : amount;
  }
  function resistedDamage(df) {
    return df.res ? Math.floor(df.dmg/2) : df.dmg;
  }
  function afterArmor(df) {
    return df.dmg == null ? null :
      overwhelmFloor(Math.max(0,resistedDamage(df)-df.ar),df);
  }
  // The dice roll and any forced success are inputs; no randomness or UI state
  // is held here. A save meets its DC; a dodge/parry beats an attack roll.
  function defenseResult(df,rollTotal,forcedSuccess) {
    const after=afterArmor(df);
    if (df.type === 'block') {
      return { won:false, unresolved:false,
        take:after == null ? null : overwhelmFloor(Math.max(0,after-df.amt),df) };
    }
    if (df.vs == null && !forcedSuccess) {
      return { won:false, unresolved:true, take:null };
    }
    const won=!!forcedSuccess || (df.area ? rollTotal>=df.vs : rollTotal>df.vs);
    let take=null;
    if (df.dmg != null) {
      if (!won) take=after;
      else if (df.type === 'dodge') {
        take=df.area ? overwhelmFloor(Math.max(0,Math.floor(resistedDamage(df)/2)-df.ar),df) : 0;
      } else take=overwhelmFloor(0,df);
    }
    return { won, unresolved:false, take };
  }
  function deathThreshold(levelScore, vitScore, trauma) {
    return vitScore == null ? null : Math.max(0,levelScore+vitScore-5*(trauma || 0));
  }
  function diesAt(h,threshold) {
    return threshold != null && (threshold === 0 ? h<0 : h<=-threshold);
  }
  // Health damage returns the next state, without modifying the character.
  // Death's Mercy caps the first below-zero hit; concentration remains a
  // separate reaction/roll managed by the sheet.
  function damageHealth(before,amount,threshold,down) {
    const amt=Math.max(0,Math.round(amount));
    let after=before-amt;
    const dropped=before>0 && after<=0;
    let nextDown=down ? {mercy:!!down.mercy,stable:!!down.stable} : null;
    if (after<=0 && (dropped || !nextDown)) nextDown={mercy:false,stable:false};
    let mercyCapped=false;
    if (after<0 && !nextDown.mercy) {
      nextDown.mercy=true;
      if (threshold!=null && threshold>0) {
        const cap=Math.floor(threshold/2);
        if (after < -cap) {after=-cap;mercyCapped=true;}
      }
    }
    return {after,down:nextDown,dropped,dead:diesAt(after,threshold),mercyCapped,
      concentrationDc:Math.max(12,Math.floor(amt/2)),amount:amt};
  }
  function healHealth(before,amount,maximum,trauma) {
    const amt=Math.max(0,Math.round(amount));
    let after=before+amt;
    if(maximum!=null&&after>maximum)after=Math.max(before,maximum);
    const recovered=before<=0&&after>0;
    return {after,recovered,trauma:trauma+(recovered?1:0),amount:amt};
  }
  window.WBCombat = {
    STATS,ASI_LEVELS,SLOTS,
    level,keyAt,rawAt,asiSum,scoreAt,gearBonus,gearArmor,effectiveScore,
    autoMod,modifier,attackApCost,abilityApCost,abilitySaveDc,commandingPresenceDc,parseDamageDice,attackEffects,trackerMax,trackerAvailable,reactionMaximum,givenAp,apAvailable,
    spendAp,refundAp,movePlan,movementAfter,
    hitDieFor,healthAtLevel,characterMaxHealth,manaPerLevel,manaAtLevel,characterMaxMana,
    attackHits,dualHits,criticalTotal,weaponCritical,damagePacket,offhandDamage,
    armorDamage,dualArmorDamage,overwhelmFloor,resistedDamage,afterArmor,
    defenseResult,deathThreshold,diesAt,damageHealth,healHealth
  };
})();
