/* Worlds-Beyond shared combat rules, phase 1.
 * Pure computations only: no DOM, localStorage, network, random rolls or UI.
 * Both the character sheet and future DM view should call these functions.
 * Current homebrew rules; historical formulas exist only for one-time save migration.
 */
(function () {
  'use strict';
  const STATS = ['STR','VIT','DEX','AGL','INT','WIS','CHA','FTH'];
  const ASI_LEVELS = [4,8,12,16,19];
  const SLOTS = ['head','amulet','torso','rarm','larm','rring','lring',
    'belt','rleg','lleg','main','off','strapped','pants'];
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
  function wornItems(state) {
    const ids=[...new Set(SLOTS.map(slot=>record(state.equip)[slot]).filter(id=>typeof id==='string'))];
    return ids.map(id=>(state.items||[]).find(item=>item&&item.id===id)).filter(Boolean);
  }
  function gearBonus(state,key) {
    return wornItems(state).reduce((sum,item)=>sum+(item.bonuses||[]).reduce((n,b)=>n+(b.t===key?(Number(b.v)||0):0),0),0);
  }
  function gearArmor(state) {
    const equip=record(state.equip),by=slot=>(state.items||[]).find(it=>it&&it.id===equip[slot]);
    const ar=item=>item?Math.max(0,Number(item.ar)||0):0;
    const arms=Math.max(ar(by('rarm')),ar(by('larm')));
    const legs=by('rleg')&&by('rleg').pair?ar(by('rleg')):
      by('lleg')&&by('lleg').pair?ar(by('lleg')):by('rleg')&&by('lleg')?ar(by('rleg'))+ar(by('lleg')):0;
    const skip=new Set(['rarm','larm','rleg','lleg']);
    const ids=new Set();let total=arms+legs;
    for(const slot of SLOTS){if(skip.has(slot)||!equip[slot]||ids.has(equip[slot]))continue;ids.add(equip[slot]);total+=ar(by(slot));}
    const pieces=wornItems(state).filter(it=>['head','torso','arms','legs','pants'].includes(it.type));
    const bonuses=pieces.map(it=>({Steel:0,Osmium:2,Tungsten:3,Titanium:4}[it.metal]||0));
    return total+(bonuses.length?Math.min(...bonuses):0);
  }
  function armorProfile(state) {
    const items=wornItems(state),weights=['light','medium','heavy'];
    let rank=-1;for(const item of items)rank=Math.max(rank,weights.indexOf(item.armorWeight));
    const type=weights[rank]||'';const by=slot=>items.find(it=>it.id===record(state.equip)[slot]);const ne=it=>Math.max(0,Number(it?.lightEvasion)||0);
    const armNE=Math.max(ne(by('rarm')),ne(by('larm'))),legNE=by('rleg')?.pair?ne(by('rleg')):by('lleg')?.pair?ne(by('lleg')):by('rleg')&&by('lleg')?Math.max(ne(by('rleg')),ne(by('lleg'))):0;
    return {type,heavy:type==='heavy',aglPenalty:type==='heavy'?Math.min(3,Math.max(0,gearArmor(state)-items.filter(it=>it.type==='shield').reduce((n,it)=>n+(Number(it.ar)||0),0)-3)):0,
      evasionBonus:type==='light'?armNE+legNE+items.filter(it=>!['arms','legs'].includes(it.type)).reduce((sum,it)=>sum+ne(it),0):0,
      movementMultiplier:(type==='heavy'?2:1)*((state.statuses||[]).some(s=>String(s.preset||s.name).toLowerCase()==='prone')?2:1)};
  }
  function statBonus(state,stat,temporary=true){
    const a=window.WBAbilities;
    return {ability:temporary&&a?a.effectBonus(state,'stat',stat):0,form:a?a.formStatBonus(state,stat):0};
  }
  function currentScore(state,stat,temporary=true){const b=statBonus(state,stat,temporary);return effectiveScore(state,stat,level(state),b.ability,b.form);}
  function currentModifier(state,stat,temporary=true){const b=statBonus(state,stat,temporary);return modifier(state,stat,level(state),b.ability,b.form);}
  function derivedValue(state,key,automatic){const v=num(record(state.over)[key]);return Number.isFinite(v)?v:automatic;}
  function evasion(state,temporary=true){return derivedValue(state,'evasion',12+currentModifier(state,'AGL',temporary)+gearBonus(state,'ev')+armorProfile(state).evasionBonus+(temporary&&window.WBAbilities?window.WBAbilities.effectBonus(state,'evasion'):0));}
  function armorRating(state,temporary=true){const vit=currentScore(state,'VIT',temporary);return Math.max(0,derivedValue(state,'armor',gearArmor(state)+(vit!=null&&vit>=28?Math.floor(vit/2):currentModifier(state,'VIT',temporary))+(temporary&&window.WBAbilities?window.WBAbilities.effectBonus(state,'armor'):0)));}
  function initiative(state,temporary=true){return derivedValue(state,'init',currentModifier(state,'WIS',temporary)+gearBonus(state,'init'));}
  function speed(state,temporary=true){const base=derivedValue(state,'speed',Math.max(5,5+5*currentModifier(state,'AGL',temporary))+gearBonus(state,'move'));return Math.max(0,base+(temporary&&window.WBAbilities?window.WBAbilities.movementBonus(state):0));}
  function apMaximum(state){const value=num(record(state.fields).apMax);return Number.isFinite(value)?trackerMax(value,15):15+2*Math.floor(level(state)/5);}
  function scalingTier(state){return 1+Math.floor(Math.min(20,level(state))/5);}
  function blockDice(state){const shield=wornItems(state).find(it=>it.type==='shield');const m=String(shield&&shield.block||'1d4').match(/d(\d+)/i);return {count:scalingTier(state),sides:m?Math.max(1,Number(m[1])):4,multiplier:shield?Math.max(1,Number(shield.blockMultiplier)||({Osmium:1.3,Tungsten:1.4,Titanium:1.5}[shield.metal]||1)):1};}
  // Active ability and form bonuses are supplied by WBAbilities. Keeping the
  // components explicit avoids silently treating temporary buffs as base stats.
  function effectiveScore(state, stat, n, abilityBonus=0, formBonus=0) {
    const base=scoreAt(state,stat,n);
    return base == null ? null : base + gearBonus(state,stat) + abilityBonus + formBonus - (stat==='AGL'?armorProfile(state).aglPenalty:0);
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
  function legacyMaxHealth(state) {
    let sum=0;for(let i=1;i<=level(state);i++){const base=scoreAt(state,'VIT',i);if(base==null)return null;
      const result=healthAtLevel(state,i,base+(Number(record(record(state.lvGear)[i]).VIT)||0));if(result.gain!=null)sum+=result.gain;}
    return sum+gearBonus(state,'hp');
  }
  function characterMaxHealth(state,temporary=true) {
    const vit=currentScore(state,'VIT',temporary);
    return {max:vit==null?null:vit*level(state)+gearBonus(state,'hp'),missing:vit==null?[1]:[]};
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
  function legacyMaxMana(state) {
    const stat=record(state.fields).manaKind==='holy'?'FTH':'INT';if(scoreAt(state,stat,1)==null)return null;
    let total=0;for(let n=1;n<=level(state);n++)total+=manaAtLevel(n,scoreAt(state,stat,n)+(Number(record(record(state.lvGear)[n])[stat])||0));
    return total+gearBonus(state,stat==='FTH'?'holy':'mp');
  }
  function characterMaxMana(state,temporary=true) {
    const holy=record(state.fields).manaKind==='holy',score=currentScore(state,holy?'FTH':'INT',temporary);
    return score==null?null:score*(level(state)+2)+gearBonus(state,holy?'holy':'mp');
  }
  function migrateVitals(state){
    if(state.vitalRulesVersion===1){for(const key of ['rolls','lvGear','settled','levels'])delete state[key];return;}
    const oldHealth=derivedValue(state,'hpMax',legacyMaxHealth(state)),oldMana=derivedValue(state,'mpMax',legacyMaxMana(state));
    const newHealth=derivedValue(state,'hpMax',characterMaxHealth(state).max),newMana=derivedValue(state,'mpMax',characterMaxMana(state));
    state.vitalRulesVersion=1;
    if(Object.keys(record(state.hist)).length)state.vitalMigration={oldHealth,newHealth,oldMana,newMana,acknowledged:false};
    for(const key of ['rolls','lvGear','settled','levels'])delete state[key];
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
  function weaponCritical(naturalDie,criticalOnHit,criticalFrom=20) { return naturalDie>=criticalFrom||criticalOnHit===true; }
  function damagePacket(baseRoll, statModifier, flatBonus, extraRolls) {
    const weaponDmg = Math.max(0,baseRoll+statModifier+flatBonus);
    const extras = (extraRolls || []).map(value => Math.max(0,value));
    return { weaponDmg, extras, total: weaponDmg + extras.reduce((sum,v) => sum+v,0) };
  }
  function offhandDamage(total) { return Math.floor(total/2); }
  function effectiveArmor(armor,twoHanded=false,puncture=0){return Math.max(0,(twoHanded?Math.ceil(armor/2):armor)-puncture);}
  function armorDamage(total, armor, twoHanded=false, puncture=0) { return Math.max(0,total-effectiveArmor(armor,twoHanded,puncture)); }
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
      overwhelmFloor(Math.max(0,resistedDamage(df)-effectiveArmor(df.ar,df.twoHanded,df.puncture||0)),df);
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
        take=df.area ? overwhelmFloor(Math.max(0,Math.floor(resistedDamage(df)/2)-effectiveArmor(df.ar,df.twoHanded,df.puncture||0)),df) : 0;
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
  const weaponPropertyNames=['Balanced','Heavy','Finesse','Paragon','Light','Two-handed','Versatile','Strapped','Reach','Thrown','Loading','Mount','Ranged'];
  const signatureNames=['Sweep','Hook','Stagger','Disarm','Entangle','Puncture','Sunder','Bleed','Pierce Through','Bulwark','Quickdraw','Concealed','Silent','Loud'];
  function weaponProperties(item){const p=Array.isArray(item.properties)?item.properties.filter(x=>weaponPropertyNames.includes(x)):['Balanced'];return [...new Set([...p,...(item.type==='twohand'?['Two-handed']:[])])];}
  function weaponRules(state,item){
    const props=weaponProperties(item),has=p=>props.includes(p),paragon=has('Paragon'),heavy=has('Heavy'),finesse=has('Finesse');
    const thrown=has('Thrown')&&item.attackMode==='ranged',ranged=has('Ranged')||thrown,stat=paragon?item.stat==='DEX'?'DEX':'STR':ranged||finesse?'DEX':heavy?'STR':item.stat==='DEX'?'DEX':'STR';
    const str=currentScore(state,'STR'),dex=currentScore(state,'DEX');
    const requirement=paragon?(str==null||dex==null||str<21||dex<21):heavy?(str==null||str<21):finesse?(dex==null||dex<21):false;
    const heavyArmor=armorProfile(state).heavy&&(str==null||str<21);
    const twoHanded=has('Two-handed')||has('Versatile')&&item.twoHandedGrip===true;
    const normalRange=Math.max(5,Number(thrown?item.thrownRange:item.range)||5)+(!ranged&&has('Reach')?5:0);
    return {props,stat,light:has('Light'),twoHanded,ranged,melee:!ranged&&(Number(item.range)||5)===5,
      normalRange,longRange:Math.max(normalRange,Number(thrown?item.thrownLongRange:item.longRange)||normalRange),
      criticalFrom:finesse||paragon?18:20,damageMultiplier:heavy||paragon?2:1,
      disadvantage:requirement||heavyArmor||has('Mount')&&!item.mounted,
      warning:[requirement?'Attribute requirement unmet: disadvantage suggested.':'',heavyArmor?'Heavy armor without STR 21: disadvantage suggested.':'',has('Mount')&&!item.mounted?'Unmounted: disadvantage suggested.':''].filter(Boolean).join(' '),
      puncture:(Array.isArray(item.signatures)?item.signatures:[]).includes('Puncture')?2:0,loading:has('Loading')?Math.max(1,Math.min(1000,Number(item.loadingCapacity)||1)):0};
  }
  function scaleDice(expression,tier){const parsed=parseDamageDice(expression);if(!parsed)return null;return parsed.expression.replace(/(\d*)d(\d+)/gi,(_,n,sides)=>((Number(n)||1)*tier)+'d'+sides);}
  function inventory(state){
    const worn=new Set(Object.values(record(state.equip))),items=(state.items||[]).filter(Boolean),stock=Array.isArray(state.consumables)?state.consumables:[];
    const incomplete=state.consumables!=null&&!Array.isArray(state.consumables)||stock.some(it=>!it||!Number.isFinite(Number(it.quantity)));
    const used=items.filter(it=>!worn.has(it.id)).reduce((sum,it)=>sum+(it.inventorySlots!=null?Math.max(0,Number(it.inventorySlots)||0):it.ammoQuantity!=null?Math.ceil(Math.max(0,Number(it.ammoQuantity)||0)/5):it.type==='twohand'||it.type==='shield'?2:1),0)+
      stock.reduce((sum,it)=>sum+Math.ceil(Math.max(0,Number(it&&it.quantity)||0)/5),0);
    return {used,incomplete,capacity:Math.max(0,10+currentModifier(state,'STR')+items.reduce((sum,it)=>sum+Math.max(0,Number(it.backpackBonus)||0),0))};
  }
  window.WBCombat = {
    STATS,ASI_LEVELS,SLOTS,weaponPropertyNames,signatureNames,weaponProperties,weaponRules,scaleDice,inventory,
    level,keyAt,rawAt,asiSum,scoreAt,gearBonus,gearArmor,wornItems,armorProfile,currentScore,currentModifier,evasion,armorRating,initiative,speed,apMaximum,scalingTier,blockDice,effectiveScore,
    autoMod,modifier,attackApCost,abilityApCost,abilitySaveDc,parseDamageDice,attackEffects,trackerMax,trackerAvailable,reactionMaximum,givenAp,apAvailable,
    spendAp,refundAp,movePlan,movementAfter,
    hitDieFor,healthAtLevel,characterMaxHealth,manaPerLevel,manaAtLevel,characterMaxMana,migrateVitals,legacyMaxHealth,legacyMaxMana,
    attackHits,dualHits,criticalTotal,weaponCritical,damagePacket,offhandDamage,
    effectiveArmor,armorDamage,dualArmorDamage,overwhelmFloor,resistedDamage,afterArmor,
    defenseResult,deathThreshold,diesAt,damageHealth,healHealth
  };
})();
