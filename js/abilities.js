/* Worlds Beyond: ability definitions, derived effects and shared form/activation rules.
   Runtime UI actions commit through the WBCharacter transaction boundary. */
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
  const propNames = ['name', 'category', 'type', 'description', 'apCost', 'apDiscountStat', 'resourceId',
    'resourceCost', 'cooldown', 'duration', 'uses', 'capacityMax', 'notes',
    'attackStat','damageDice','damageType','damageStat','saveDcStat','targetSaveStat','usesPer','outsideUsesStat'];
  const numerical = new Set(['apCost', 'resourceCost', 'cooldown', 'duration', 'uses', 'capacityMax']);
  const STATS = ['STR', 'VIT', 'DEX', 'AGL', 'INT', 'WIS', 'CHA', 'FTH'];
  const milestoneDescriptions = {
  "STR": [
    "Once per round, when you land a melee attack, you can push the target 5ft in any direction or try to knock it prone, at no extra AP. You can also try to grapple or shove creatures larger than you, within reason.",
    "Your weapon and unarmed attacks can't have their damage reduced below half by anything, including Armor Rating, blocks and parries. A dodge still avoids them entirely. This doesn't bypass immunities."
  ],
  "DEX": [
    "Once each round, as a reaction, you can parry a physical attack you can see, melee or ranged, made against you or anyone you could reach with 1 AP of movement. To protect someone else, you move in front of wherever the attack is coming from. You need a weapon or shield in hand. Roll a d20 and add your Dexterity modifier. If the result is higher than the attack roll, you negate all of the attack's damage and any non-magical effects it would apply.",
    "Once each round, before rolling a weapon attack (melee or ranged), you can declare Singularity. If the attack hits, it's a critical hit. If it misses, Singularity is spent for the round."
  ],
  "VIT": [
    "Once per combat, when a status effect that physically restrains or damages you would take hold, such as stunned, paralyzed or restrained, you can negate it so it never affects you. Mind-based effects like charmed or frightened don't count. Also, when you're dropped below 0 Health, you can roll a d20 + your Vitality modifier against DC 12. On a success you stop bleeding and remain unconscious.",
    "Your Armor Rating becomes half your Vitality, rounded down, plus the armor you're wearing, instead of your Vitality modifier plus your armor."
  ],
  "AGL": [
    "Each turn, you get 2 AP of movement for free. You also gain an additional reaction.",
    "You can't be hit by opportunity attacks, and any attack that relies on sight to hit you rolls with disadvantage, whether it's melee, ranged or a spell. You also have advantage on saves against spells that need sight to target you. You also gain an additional reaction."
  ],
  "INT": [
    "Once per round, for 5 AP, you can give a plan to an ally who can hear you. Their next attack roll or ability check before your next turn adds your Intelligence modifier.",
    "Once per round, for 5 AP, you can analyze a creature, ability, object or phenomenon you can perceive to learn how it works: one significant property, weakness or underlying principle, if one can be inferred from the information available."
  ],
  "WIS": [
    "Whenever you face a danger you don't know about, the GM secretly makes a Wisdom check for you against the danger's DC, like an ambusher's stealth roll or a trap's DC. On a success you feel that something is wrong, like a sudden aversion to drinking from a cup. The GM doesn't say what. Once per round, at no AP cost, you can also ask the GM whether a specific choice is dangerous, and you get a feeling back: good, bad or unsure.",
    "You naturally see through illusions and can see invisible creatures within 30 ft. Once per round, for 5 AP, you can attempt to perceive the true intent behind anything in sight: whether a creature is hostile, afraid, lying or hiding something, or what the things around you are for, like who a trap is meant to catch or what a ritual is meant to bring about. You learn its purpose. Make a Wisdom check, contested by a creature's Charisma if it's hiding something, or against a DC the GM sets."
  ],
  "CHA": [
    "Once per round, for 5 AP, you can force a creature within 60 ft that can perceive you to make a Charisma saving throw (DC 12 + your Charisma modifier). On a failure, its attention is fixed on you until the start of your next turn, and it has disadvantage on attacks against anyone but you.",
    "You are immune to possession and to effects that forcibly alter your personality, memories or identity when they come from a source of your level or lower. Against higher-level sources, you have advantage to resist them."
  ],
  "FTH": [
    "Each use of Wonder now turns a failed saving throw or ability check into a success. You still have uses equal to your Faith modifier, regained on a long rest. On initiative, Wonder still rerolls.",
    "Once per long rest, at no AP cost, you can declare in one sentence a single restriction standing in the way of an action, such as a usage limit, an immunity or the limit of your own strength, and fate bends probability so the action can come to pass anyway. Miracle fails if the declaration is too broad or fundamentally impossible for you, such as granting an ability you don't have, like flight. Miracle can't be used to get around its own limit."
  ]
};
  const DISCOUNT_STATS = ['STR','VIT','DEX','INT','WIS','CHA','FTH'];
  const discountStat = ability => DISCOUNT_STATS.includes(ability.apDiscountStat) ? ability.apDiscountStat : '';
  const rollStats = new Set(['attackStat','damageStat','saveDcStat','targetSaveStat']);
  const rollStat = value => STATS.includes(value)?value:'';
  const usesPer = ability => ['combat','round'].includes(ability.usesPer)?ability.usesPer:'rest';
  const milestoneDefinitions = [
    {id:'titans-might',name:"Titan’s Might",stat:'STR',at:21,ap:0,per:'round'},
    {id:'singularity',name:'Singularity',stat:'DEX',at:28,ap:0,per:'round',weapon:true},
    {id:'indomitable-status',name:'Indomitable: negate status',stat:'VIT',at:21,ap:0,per:'combat'},
    {id:'stratagem',name:'Stratagem',stat:'INT',at:21,ap:5,per:'round'},
    {id:'absolute-comprehension',name:'Absolute Comprehension',stat:'INT',at:28,ap:5,per:'round'},
    {id:'sixth-sense',name:'Sixth Sense: ask about danger',stat:'WIS',at:21,ap:0,per:'round'},
    {id:'eyes-of-truth',name:'Eyes of Truth',stat:'WIS',at:28,ap:5,per:'round'},
    {id:'commanding-presence',name:'Commanding Presence',stat:'CHA',at:21,ap:5,per:'round'},
    {id:'miracle',name:'Miracle',stat:'FTH',at:28,ap:0,per:'rest'}
  ];
  const milestoneData = state => state.milestoneUses && typeof state.milestoneUses==='object' && !Array.isArray(state.milestoneUses)?state.milestoneUses:{};
  function milestoneAbility(state,id) {
    const definition=milestoneDefinitions.find(d=>d.id===id);
    if(!definition)return null;
    const saved=milestoneData(state)[id]||(id==='titans-might'?milestoneData(state).devastate:null)||{},left=optionalNumber(saved.usesLeft);
    return {id:'@milestone/'+id,name:definition.name,type:'active',apCost:definition.ap,apDiscountStat:'',
      uses:1,usesLeft:left===''?1:Math.min(1,left),usesPer:definition.per,
      outsideUsesStat:definition.per==='round'?definition.stat:'',outsideUsesSpent:optionalNumber(saved.outsideUsesSpent)||0,
      resourceId:'',resourceCost:'',cooldown:'',duration:'',cooldownLeft:0,durationLeft:0,
      capacityMax:'',capacityCurrent:0,loadoutIds:[],effects:[]};
  }
  function milestoneAction(state,id) {
    const definition=milestoneDefinitions.find(d=>d.id===id);
    if(!definition)return null;
    const combat=window.WBCombat,stat=definition.stat;
    const score=combat.effectiveScore(state,stat,combat.level(state),effectBonus(state,'stat',stat),formStatBonus(state,stat));
    const modifier=combat.modifier(state,stat,combat.level(state),effectBonus(state,'stat',stat),formStatBonus(state,stat));
    const ability=milestoneAbility(state,id),plan={title:definition.name,kind:'notice',total:null,text:''};
    if(definition.weapon){plan.kind='weapon-attack';plan.text=milestoneDescriptions[stat][definition.at===28?1:0];}
    else if(id==='indomitable-status')plan.text='Negate one incoming status that physically restrains or damages you, such as stunned, paralyzed or restrained. Mind-based effects such as charmed or frightened do not count. Use when the status would take hold; resolve eligibility at the table.';
    else if(id==='stratagem'){
      plan.total=modifier;plan.text='Give a plan to an ally who can hear you. Their next attack roll or ability check before your next turn adds your INT modifier ('+(modifier>=0?'+':'')+modifier+').';
    }else if(id==='sixth-sense')plan.text='Ask the GM whether one specific choice is dangerous. The answer is a feeling: good, bad or unsure. Your passive secret danger check is resolved by the GM.';
    else if(id==='eyes-of-truth'){
      plan.kind='check';plan.modifier=modifier;plan.text=milestoneDescriptions.WIS[1];
    }else if(id==='commanding-presence'){
      plan.total=combat.abilitySaveDc(modifier);
      plan.text='A creature within 60 ft that can perceive you makes a CHA save, DC '+plan.total+' (12 + CHA modifier). On failure, its attention is fixed on you until your next turn and it has disadvantage on attacks against others. Resolve the target’s save at the table.';
    }else plan.text=milestoneDescriptions[stat][definition.at===28?1:0];
    return {...definition,unlocked:score!=null&&score>=definition.at,ability,usage:usageState(state,ability),plan};
  }
  function milestoneActions(state) { return milestoneDefinitions.map(d=>milestoneAction(state,d.id)); }
  function milestoneLifecycle(state,type) {
    const original=milestoneData(state),updated={...original};
    for(const d of milestoneDefinitions){
      if(!Object.prototype.hasOwnProperty.call(original,d.id)&&!(d.id==='titans-might'&&Object.prototype.hasOwnProperty.call(original,'devastate')))continue;
      const ability=milestoneAbility(state,d.id);
      if(type==='StartCombat'&&d.per!=='rest')ability.usesLeft=1;
      else if(type==='AdvanceAbilityTurn')advanceTurn({...state,abilities:[ability]});
      else if(type==='RestAbilities')resetForRest({...state,abilities:[ability]});
      updated[d.id]={...(original[d.id]||(d.id==='titans-might'?original.devastate:{})),usesLeft:ability.usesLeft,outsideUsesSpent:ability.outsideUsesSpent};
    }
    return updated;
  }
  function usageState(state,ability) {
    if(ability.uses===''||ability.uses==null)return {limited:false,maximum:null,remaining:null,period:'',outside:false};
    const per=usesPer(ability),outside=per!=='rest'&&state.inCombat!==true;
    let maximum=Number(ability.uses)||0;
    if(outside&&per==='round'&&rollStat(ability.outsideUsesStat)){
      const stat=ability.outsideUsesStat,combat=window.WBCombat;
      maximum=Math.max(0,Math.floor(combat.modifier(state,stat,combat.level(state),effectBonus(state,'stat',stat),formStatBonus(state,stat))));
    }
    return {limited:true,maximum,outside,
      remaining:outside?Math.max(0,maximum-(Number(ability.outsideUsesSpent)||0)):ability.usesLeft,
      period:outside||per==='rest'?'long rest':per};
  }
  const equipmentOutsideSetting = ability => ability && (ability.outsideUsesStat===''||STATS.includes(ability.outsideUsesStat))?ability.outsideUsesStat:'legacy';
  const counterMap = value => value && typeof value==='object' && !Array.isArray(value)?value:{};
  const equipmentSpent = (map,itemId,index) => Math.max(0,Math.round(Number(counterMap(counterMap(map)[itemId])[index]))||0);
  function equipmentAbility(state,itemId,index) {
    if(typeof itemId!=='string'||!Number.isInteger(index)||index<0)return null;
    const item=(state.items||[]).find(item=>item&&item.id===itemId),definition=item&&(item.abilities||[])[index];
    if(!definition||typeof definition!=='object')return null;
    const uses=typeof definition.uses==='number'&&definition.uses>=1?Math.min(20,Math.round(definition.uses)):'';
    const setting=equipmentOutsideSetting(definition),round=definition.per==='round';
    const legacyRound=round&&setting==='legacy';
    const ability={id:'@equipment/'+itemId+'/'+index,name:String(definition.name||'Equipment ability'),type:'active',apCost:'',apDiscountStat:'',
      uses,usesLeft:uses===''?null:Math.max(0,uses-equipmentSpent(state.spent,itemId,index)),usesPer:round&&!legacyRound?'round':'rest',
      outsideUsesStat:setting==='legacy'?'':setting,outsideUsesSpent:equipmentSpent(state.equipmentOutsideSpent,itemId,index),
      resourceId:'',resourceCost:'',cooldown:'',duration:'',cooldownLeft:0,durationLeft:0,capacityMax:'',capacityCurrent:0,loadoutIds:[],effects:[]};
    const usage=usageState(state,ability);
    if(legacyRound)usage.period='round';
    return {itemId,index,definition,ability,usage,legacyRound,setting,spent:equipmentSpent(state.spent,itemId,index)};
  }
  function equipmentLifecycle(state,type) {
    if(type==='EndCombat')return {spent:counterMap(state.spent),equipmentOutsideSpent:counterMap(state.equipmentOutsideSpent)};
    const spent={...counterMap(state.spent)},outside={...counterMap(state.equipmentOutsideSpent)};
    for(const item of (state.items||[])){
      if(!item)continue;
      const counters={...counterMap(spent[item.id])};
      for(let i=0;i<(item.abilities||[]).length;i++){
        const a=item.abilities[i];if(!a)continue;
        const configured=equipmentOutsideSetting(a)!=='legacy';
        const reset=type==='RestAbilities'||a.per==='round'&&
          (type==='StartCombat'&&configured||type==='AdvanceAbilityTurn'&&(state.inCombat===true||!configured));
        if(reset)delete counters[i];
      }
      if(Object.keys(counters).length)spent[item.id]=counters;else delete spent[item.id];
      if(type==='RestAbilities')delete outside[item.id];
    }
    return {spent,equipmentOutsideSpent:outside};
  }
  // Forge rows retain their source index while editing. Carry counters with the
  // row when earlier rows are removed; a rename never refills the whole item.
  function remapEquipmentUses(state,itemId,nextAbilities,originalIndices) {
    const item=(state.items||[]).find(item=>item&&item.id===itemId);
    const spent={},outside={},oldOutside=counterMap(counterMap(state.equipmentOutsideSpent)[itemId]);
    for(let next=0;next<nextAbilities.length;next++){
      const old=originalIndices[next];if(!Number.isInteger(old)||old<0||!item||(item.abilities||[])[old]==null)continue;
      const prior=item.abilities[old],used=equipmentSpent(state.spent,itemId,old);
      if(Object.prototype.hasOwnProperty.call(counterMap(counterMap(state.spent)[itemId]),old))spent[next]=used;
      const outsideUsed=equipmentSpent(state.equipmentOutsideSpent,itemId,old);
      if(Object.prototype.hasOwnProperty.call(oldOutside,old))outside[next]=outsideUsed;
      const priorOutside=state.inCombat!==true&&prior.per==='round'&&equipmentOutsideSetting(prior)!=='legacy';
      const nextOutside=state.inCombat!==true&&nextAbilities[next].per==='round'&&equipmentOutsideSetting(nextAbilities[next])!=='legacy';
      if(priorOutside!==nextOutside){if(nextOutside)outside[next]=used;else spent[next]=outsideUsed;}
    }
    const patch={spent:{...counterMap(state.spent)},equipmentOutsideSpent:{...counterMap(state.equipmentOutsideSpent)}};
    if(Object.keys(spent).length)patch.spent[itemId]=spent;else delete patch.spent[itemId];
    if(Object.keys(outside).length)patch.equipmentOutsideSpent[itemId]=outside;else delete patch.equipmentOutsideSpent[itemId];
    return patch;
  }
  const effectTargets = ['none', 'movement', 'armor', 'evasion', 'stat', 'resource-max'];
  const effectId = () => 'eff' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const MAX_EFFECTS = 12;
  const formId = () => 'load' + Date.now().toString(36) + Math.random().toString(36).slice(2,10);
  const MAX_LOADOUTS = 30;
  // Form-specific score adjustments are derived like gear bonuses. They never
  // become purchased stat points or alter stored base scores.
  const formAdjustment = value => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(-28, Math.min(28, Math.round(n))) : 0;
  };
  // Keep availability logic in sync with WBResources. Isolated ability tests do
  // not load the resource UI, so these checks must also work independently.
  function resourceAvailable(state, resource) {
    if (!state.abilityLoadouts || !state.abilityLoadouts.length) return true;
    const ids = Array.isArray(resource.loadoutIds) ? resource.loadoutIds : [];
    return !ids.length || ids.includes(state.activeAbilityLoadoutId);
  }
  function formManaAvailable(state) {
    const form = (state.abilityLoadouts || []).find(x => x.id === state.activeAbilityLoadoutId);
    return form && form.manaMode === 'show' ? true :
      form && form.manaMode === 'hide' ? false : state.showMana !== false;
  }
  function formStatBonus(state, stat) {
    if (!STATS.includes(stat)) return 0;
    const form = (state.abilityLoadouts || []).find(x => x.id === state.activeAbilityLoadoutId);
    return form && form.statBonuses ? formAdjustment(form.statBonuses[stat]) : 0;
  }
  function abilityApCost(state,ability) {
    const base=ability.apCost===''?0:Number(ability.apCost)||0;
    const stat=discountStat(ability);
    if(!stat)return base; // Legacy/None abilities retain their entered price.
    const combat=window.WBCombat;
    const modifier=combat.modifier(state,stat,combat.level(state),
      effectBonus(state,'stat',stat),formStatBonus(state,stat));
    return combat.abilityApCost(base,modifier);
  }
  function weaponSource(state,weaponId) {
    const weapon=(state.items||[]).find(item=>item&&item.id===weaponId);
    if(!weapon||!['onehand','twohand'].includes(weapon.type))return null;
    const combat=window.WBCombat,rules=combat.weaponRules(state,weapon),stat=rules.stat;
    const modifier=key=>combat.currentModifier(state,key),effects=combat.attackEffects(state,weapon.id);
    const sum=kind=>effects.reduce((total,e)=>total+(e.k===kind?Number(e.v)||0:0),0);
    const rawDice=String(rules.twoHanded&&weapon.versatileDice?weapon.versatileDice:weapon.dmg||'1d6'),tier=combat.scalingTier(state);
    const scaled=combat.scaleDice(rawDice,tier);
    return {weaponId:weapon.id,name:String(weapon.name||'Weapon'),stat,type:weapon.type,dice:scaled||rawDice,rawDice,tier,
      fastRoll:state.fastRoll===true,criticalFrom:rules.criticalFrom,twoHanded:rules.twoHanded,puncture:rules.puncture,melee:rules.melee,normalRange:rules.normalRange,longRange:rules.longRange,
      disadvantage:rules.disadvantage,warning:rules.warning,light:rules.light,loading:rules.loading,
      attackModifier:modifier(stat)+sum('atk'),apModifier:modifier(stat),damageModifier:modifier(stat)*rules.damageMultiplier,flatBonus:sum('flat')+(rules.props.includes('Mount')&&weapon.mounted?Math.min(Math.max(0,modifier(stat)),Math.floor(Math.max(0,Number(state.mountApproach)||0)/10)):0),diceMultiplier:weapon.diceMultiplier!=null&&Number.isFinite(Number(weapon.diceMultiplier))?Math.max(0,Number(weapon.diceMultiplier)):1,
      extras:effects.filter(e=>e.k==='dmg').map(e=>({dice:String(e.dice||''),type:String(e.dt||'')})),
      hits:[...effects.filter(e=>e.k==='onhit').map(e=>String(e.text||'')),...(Array.isArray(weapon.signatures)?weapon.signatures:[]).map(x=>x+': '+(window.WBRulesCatalog?.signatures?.[x]||'resolve its property at the table.')) ]};
  }
  function weaponAttackPlan(state,slot) {
    if(!['main','off','dual','strapped'].includes(slot))return {ok:false,message:'Choose a weapon in hand or strapped attachment.'};
    const equip=state.equip||{},main=weaponSource(state,equip.main),off=weaponSource(state,equip.off);
    const source=slot==='off'?off:slot==='strapped'?weaponSource(state,equip.strapped):main;
    if(!source||slot==='off'&&main&&main.twoHanded||slot==='dual'&&(!off||!main.light||!off.light||main.twoHanded||off.twoHanded||main.weaponId===off.weaponId))
      return {ok:false,message:'Dual attacks require a Light weapon in each hand. Other weapons can attack separately.'};
    if(!window.WBCombat.parseDamageDice(source.dice)||slot==='dual'&&!window.WBCombat.parseDamageDice(off.dice))return {ok:false,message:'Check the weapon damage dice before attacking.'};
    const offSource=slot==='dual'?{...off,damageModifier:0}:null;
    return {ok:true,slot,dual:slot==='dual',main:source,off:offSource,apCost:window.WBCombat.attackApCost(source.apModifier)};
  }
  function abilityRollPlan(state,ability) {
    const attackStat=rollStat(ability.attackStat),damageStat=rollStat(ability.damageStat);
    const saveDcStat=rollStat(ability.saveDcStat),targetSaveStat=rollStat(ability.targetSaveStat);
    const dice=clean(ability.damageDice,1000).trim();
    if(!attackStat&&!dice&&!saveDcStat&&!targetSaveStat)return {ok:true,configured:false};
    const combat=window.WBCombat;
    const parsed=dice?combat.parseDamageDice(dice):null;
    if(dice&&!parsed)return {ok:false,message:'Check the damage dice for '+ability.name+'. Use dice such as 2d6 + 3, added dice, or a flat number (up to 1,000 dice).'};
    if(targetSaveStat&&!saveDcStat)return {ok:false,message:'Choose a Save DC stat for '+ability.name+', or clear Target save.'};
    const modifier=stat=>stat?combat.modifier(state,stat,combat.level(state),effectBonus(state,'stat',stat),formStatBonus(state,stat)):0;
    const effects=combat.attackEffects(state);
    const sum=kind=>effects.reduce((total,e)=>total+(e.k===kind?Number(e.v)||0:0),0);
    return {ok:true,configured:true,name:ability.name,
      attack:attackStat?{stat:attackStat,modifier:modifier(attackStat)+sum('atk')}:null,
      damage:dice?{dice:parsed.expression,stat:damageStat,modifier:modifier(damageStat),type:clean(ability.damageType,60),flatBonus:sum('flat'),
        extras:effects.filter(e=>e.k==='dmg').map(e=>({dice:e.dice,type:e.dt||''})),
        hits:effects.filter(e=>e.k==='onhit').map(e=>e.text)}:null,
      save:saveDcStat?{stat:saveDcStat,targetStat:targetSaveStat,dc:combat.abilitySaveDc(modifier(saveDcStat))}:null};
  }
  function planPoolPayment(controls,ap,mana,allowHiddenMana=false) {
    if(!(ap||mana)||!controls||typeof controls.planPools!=='function'||
        typeof controls.commitPools!=='function')return null;
    return controls.planPools({ap,mana,allowHiddenMana});
  }
  const poolPaymentError=()=>({ok:false,message:'The AP or Mana payment could not be completed. Check the current pools and retry.'});
  // Plan the entire entry payment before any portrait, loadout, equipment or
  // tracker changes. Returning to Base and selecting the active form are free.
  function entryCost(state, identifier, controls) {
    const form=identifier && (state.abilityLoadouts||[]).find(x=>x.id===identifier);
    if(identifier && !form)return {ok:false,message:'That form no longer exists.'};
    if(!identifier || state.activeAbilityLoadoutId===identifier)
      return {ok:true,ap:0,cost:0,form:form||null,resource:null};
    const ap=optionalNumber(form.entryApCost)||0;
    const cost=optionalNumber(form.entryResourceCost)||0;
    const resourceId=form.entryResourceId||'';
    if(ap && (!controls || typeof controls.getAp!=='function' ||
        typeof controls.spendAp!=='function'))
      return {ok:false,message:'The AP tracker is unavailable for this form switch.'};
    if(ap && controls.getAp()<ap)
      return {ok:false,message:'Not enough AP to enter '+form.name+' (requires '+ap+' AP).'};
    let resource=null;
    if(cost) {
      if(resourceId==='base-mana') {
        if(!controls||typeof controls.getMana!=='function'||
            typeof controls.spendMana!=='function')
          return {ok:false,message:'Mana / Holy Power is unavailable for this form switch.'};
        const current=controls.getMana();
        if(current==null||!Number.isFinite(current))
          return {ok:false,message:'Set a Mana / Holy Power maximum before entering '+form.name+'.'};
        if(current<cost)
          return {ok:false,message:'Not enough Mana / Holy Power to enter '+form.name+' (requires '+cost+').'};
      } else {
        resource=(state.resources||[]).find(r=>r.id===resourceId);
        if(!resource)
          return {ok:false,message:'Choose an entry resource for '+form.name+'.'};
        if((Number(resource.current)||0)<cost)
          return {ok:false,message:'Not enough '+resource.name+' to enter '+form.name+' (requires '+cost+').'};
      }
    }
    const poolPayment=planPoolPayment(controls,ap,resourceId==='base-mana'?cost:0,true);
    if(poolPayment&&!poolPayment.ok)return poolPaymentError();
    return {ok:true,ap,cost,resource,resourceId,form,poolPayment};
  }
  function commitFormEntry(state, identifier, controls) {
    const payment=entryCost(state,identifier,controls);
    if(!payment.ok)return payment;
    if(state.activeAbilityLoadoutId===identifier)return payment;
    if(window.WBEquipment && !window.WBEquipment.switchForm(state,identifier))
      return {ok:false,message:'Could not switch equipment profiles.'};
    // A blank Mana field means full in the original gear profile. Commit the
    // payment planned before switching equipment, not a newly derived balance.
    if(payment.poolPayment)controls.commitPools(payment.poolPayment);
    else if(payment.ap)controls.spendAp(payment.ap);
    if(payment.cost) {
      if(payment.resourceId==='base-mana'){
        if(!payment.poolPayment)controls.spendMana(payment.cost);
      }
      else payment.resource.current=Math.max(0,Number(payment.resource.current)-payment.cost);
    }
    state.activeAbilityLoadoutId=identifier;
    return payment;
  }
  function selectLoadout(state, identifier, controls) {
    const payment=commitFormEntry(state,identifier,controls);
    if(!payment.ok)return false;
    const form = (state.abilityLoadouts || []).find(x => x.id === state.activeAbilityLoadoutId);
    const portrait = form && (state.portraits || []).find(x => x.id === form.portraitId);
    if (portrait) state.formId = portrait.id;
    return true;
  }
  // Choosing a portrait from Overview is the inverse of selectLoadout.
  // Prefer the already selected form when multiple forms share one portrait;
  // otherwise pick the first linked form. Unlinked portraits mean Base.
  function portraitForm(state, portraitId) {
    if (!(state.portraits || []).some(x => x.id === portraitId)) return null;
    const forms = (state.abilityLoadouts || []).filter(x => x.portraitId === portraitId);
    const current = forms.find(x => x.id === state.activeAbilityLoadoutId);
    return current ? current.id : forms.length ? forms[0].id : '';
  }
  function selectPortrait(state, portraitId, controls) {
    const nextFormId=portraitForm(state,portraitId);
    if(nextFormId===null)return false;
    if(!commitFormEntry(state,nextFormId,controls).ok)return false;
    state.formId = portraitId;
    return true;
  }
  function configureLoadout(state, identifier, property, value) {
    const form = (state.abilityLoadouts || []).find(x => x.id === identifier);
    if (!form) return false;
    if (property === 'entryApCost' || property === 'entryResourceCost') {
      form[property]=optionalNumber(value);return true;
    }
    if (property === 'entryResourceId') {
      form.entryResourceId=value==='base-mana'||(state.resources||[]).some(r=>r.id===value)
        ?value:'';
      return true;
    }
    if (property === 'manaMode') {
      form.manaMode = ['inherit', 'show', 'hide'].includes(value) ? value : 'inherit';
      return true;
    }
    if (property === 'portraitId') {
      const portrait = (state.portraits || []).find(x => x.id === value);
      form.portraitId = portrait ? portrait.id : '';
      if (form.id === state.activeAbilityLoadoutId && portrait) state.formId = portrait.id;
      return true;
    }
    if (!STATS.includes(property)) return false;
    form.statBonuses[property] = formAdjustment(value);
    return true;
  }
  function loadoutVisible(state, ability) {
    if (!Array.isArray(state.abilityLoadouts) || !state.abilityLoadouts.length) return true;
    const ids = Array.isArray(ability.loadoutIds) ? ability.loadoutIds : [];
    return ids.length === 0 || (ids.includes(state.activeAbilityLoadoutId));
  }
  function createLoadout(state, name) {
    const text = clean(name,60).trim();
    if (!text || !Array.isArray(state.abilityLoadouts) || state.abilityLoadouts.length >= MAX_LOADOUTS) return null;
    const entry = { id: formId(), name: text, portraitId: '', statBonuses: {}, manaMode: 'inherit',
      entryApCost:'',entryResourceId:'',entryResourceCost:'' };
    state.abilityLoadouts.push(entry);
    if (window.WBEquipment) window.WBEquipment.switchForm(state, entry.id); // New form copies current gear.
    state.activeAbilityLoadoutId = entry.id;
    return entry;
  }
  // Select specific forms directly even when an ability starts as shared.
  // Empty membership always means shared across all forms; specific selections
  // replace that shared setting without a separate uncheck step.
  function setLoadoutMembership(state, ability, mode, identifier, checked) {
    if (!ability || !Array.isArray(state.abilityLoadouts) || !state.abilityLoadouts.length) return false;
    const forms = state.abilityLoadouts;
    if (mode === 'shared') {
      if (checked) ability.loadoutIds = [];
      else ability.loadoutIds = [forms.find(x => x.id === state.activeAbilityLoadoutId)?.id || forms[0].id];
      return true;
    }
    if (mode !== 'member' || !forms.some(x => x.id === identifier)) return false;
    const selected = new Set(ability.loadoutIds || []);
    if (checked) selected.add(identifier);
    else selected.delete(identifier);
    ability.loadoutIds = [...selected];
    return true; // Empty = shared again when the last selected form is cleared.
  }

  function removeLoadout(state, identifier) {
    const before = (state.abilityLoadouts || []).length;
    if ((state.abilityLoadouts || []).some(x => x.id === identifier) &&
        state.activeAbilityLoadoutId === identifier && window.WBEquipment) {
      window.WBEquipment.switchForm(state, ''); // Restore Base gear before removing active form.
    }
    state.abilityLoadouts = (state.abilityLoadouts || []).filter(x => x.id !== identifier);
    if (state.abilityLoadouts.length === before) return false;
    for (const a of (state.abilities || [])) {
      if (Array.isArray(a.loadoutIds)) a.loadoutIds = a.loadoutIds.filter(id => id !== identifier);
    }
    for (const r of (state.resources || [])) {
      if (Array.isArray(r.loadoutIds)) r.loadoutIds = r.loadoutIds.filter(id => id !== identifier);
    }
    if (state.activeAbilityLoadoutId === identifier) state.activeAbilityLoadoutId = '';
    if (window.WBEquipment) window.WBEquipment.removeForm(state, identifier);
    return true;
  }
  const signedNumber = (n) => {
    if (n == null || String(n).trim() === '') return 0;
    const value = Number(n);
    return Number.isFinite(value) ? Math.max(-99999, Math.min(99999, Math.round(value))) : 0;
  };
  // Migrates existing single-effect characters; effects always describe temporary,
  // derived bonuses. Base scores, equipment and resource maximums stay untouched.
  function normalizeEffect(e) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    return {
      id: typeof e.id === 'string' && /^eff[a-z0-9]{6,40}$/.test(e.id) ? e.id : effectId(),
      target: effectTargets.includes(e.target) ? e.target : 'none',
      value: signedNumber(e.value),
      stat: STATS.includes(e.stat) ? e.stat : 'STR',
      resourceId: clean(e.resourceId, 100)
    };
  }
  function normalizeEffects(a) {
    const source = Array.isArray(a.effects) ? a.effects :
      (a.effectTarget && a.effectTarget !== 'none' ? [{
        target: a.effectTarget, value: a.effectValue
      }] : []);
    const seen = new Set();
    return source.slice(0, MAX_EFFECTS).map(normalizeEffect).filter(Boolean).map((e) => {
      if (seen.has(e.id)) e.id = effectId();
      seen.add(e.id);
      return e;
    });
  }
  function effectBonus(state, target, key) {
    return (state.abilities || []).reduce((total, a) => {
      if (!(a.durationLeft > 0)) return total;
      return total + (a.effects || []).reduce((subtotal, e) =>
        subtotal + (e.target === target &&
          (target === 'stat' ? e.stat === key :
           target === 'resource-max' ? e.resourceId === key : true) ?
           signedNumber(e.value) : 0), 0);
    }, 0);
  }
  const movementBonus = (state) => effectBonus(state, 'movement');
  function resourceMax(state, resource) {
    return Math.max(1, (Number(resource.max) || 1) + effectBonus(state, 'resource-max', resource.id));
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
      apDiscountStat: discountStat(value),
      attackStat: rollStat(value.attackStat), damageDice: clean(value.damageDice,1000),
      damageType: clean(value.damageType,60), damageStat: rollStat(value.damageStat),
      saveDcStat: rollStat(value.saveDcStat), targetSaveStat: rollStat(value.targetSaveStat),
      resourceId: clean(value.resourceId, 100),
      resourceCost: optionalNumber(value.resourceCost),
      cooldown: optionalNumber(value.cooldown),
      duration: optionalNumber(value.duration),
      uses: optionalNumber(value.uses),
      usesPer: usesPer(value), outsideUsesStat: rollStat(value.outsideUsesStat),
      outsideUsesSpent: optionalNumber(value.outsideUsesSpent)||0,
      usesLeft: optionalNumber(value.uses) === '' ? null :
        Math.min(optionalNumber(value.uses), value.usesLeft == null ? optionalNumber(value.uses) : optionalNumber(value.usesLeft)),
      // Capacity limits how many creations/objects can exist at once. Unlike limited
      // uses, it is not refilled at rest or consumed permanently by activation.
      capacityMax: optionalNumber(value.capacityMax),
      capacityCurrent: optionalNumber(value.capacityMax) === '' ? 0 :
        Math.min(optionalNumber(value.capacityMax), optionalNumber(value.capacityCurrent) || 0),
      cooldownLeft: optionalNumber(value.cooldownLeft) || 0,
      durationLeft: optionalNumber(value.durationLeft) || 0,
      effects: normalizeEffects(value),
      loadoutIds: Array.isArray(value.loadoutIds) ?
        [...new Set(value.loadoutIds.filter(x => typeof x === 'string'))].slice(0,MAX_LOADOUTS) : [],
      favorite: value.favorite === true
    };
  }

  function normalizeState(state) {
    state.inCombat=state.inCombat===true;
    state.milestoneUses=milestoneData(state);
    state.equipmentOutsideSpent=counterMap(state.equipmentOutsideSpent);
    const ids = new Set();
    state.abilityLoadouts = (Array.isArray(state.abilityLoadouts) ? state.abilityLoadouts : [])
      .filter(x => x && typeof x === 'object' && !Array.isArray(x) && clean(x.name,60).trim())
      .slice(0, MAX_LOADOUTS).map(x => {
        let key = typeof x.id === 'string' && /^load[a-z0-9]{6,40}$/.test(x.id) ? x.id : formId();
        if (ids.has(key)) key = formId();
        ids.add(key);
        const bonuses = x.statBonuses && typeof x.statBonuses === 'object' &&
          !Array.isArray(x.statBonuses) ? x.statBonuses : {};
        const statBonuses = {};
        STATS.forEach(k => { const amount = formAdjustment(bonuses[k]);
          if (amount) statBonuses[k] = amount;
        });
        return { id:key, name:clean(x.name,60).trim(),
          portraitId: clean(x.portraitId,100), statBonuses,
          manaMode: ['show', 'hide'].includes(x.manaMode) ? x.manaMode : 'inherit',
          entryApCost:optionalNumber(x.entryApCost), entryResourceId:clean(x.entryResourceId,100),
          entryResourceCost:optionalNumber(x.entryResourceCost) };
      });
    const valid = new Set(state.abilityLoadouts.map(x => x.id));
    state.activeAbilityLoadoutId = valid.has(state.activeAbilityLoadoutId) ?
      state.activeAbilityLoadoutId : '';
    (state.resources || []).forEach(resource => {
      if (Array.isArray(resource.loadoutIds)) resource.loadoutIds =
        [...new Set(resource.loadoutIds.filter(key => valid.has(key)))];
    });
    ids.clear();
    state.abilities = (Array.isArray(state.abilities) ? state.abilities : [])
      .map(normalizeAbility).filter(Boolean).map(ability => {
        if (ids.has(ability.id)) ability.id = id();
        ids.add(ability.id);
        ability.loadoutIds = ability.loadoutIds.filter(key => valid.has(key));
        return ability;
      });
  }

  // Three independent trackers: limited uses, cooldown lock, and active duration.
  // The same validation drives both activation and the 'Usable now' filter.
  function checkActivation(state, abilityId, controls) {
    const a = state.abilities.find((x) => x.id === abilityId);
    if (!a) return { ok: false, message: 'Ability not found.' };
    if (!loadoutVisible(state, a)) return { ok: false, message: a.name + ' is unavailable in your current ability form.' };
    if (a.type === 'passive') return { ok: false, message: 'Passive abilities do not need activation.' };
    if (a.cooldownLeft > 0) return { ok: false, message: a.name + ' is cooling down for ' + a.cooldownLeft + ' more turn(s).' };
    const usage=usageState(state,a);
    if (usage.limited && usage.remaining <= 0) return { ok: false, message: a.name + ' has no uses left until the next '+usage.period+'.' };
    if (a.capacityMax !== '' && a.capacityCurrent >= a.capacityMax) {
      return { ok: false, message: a.name + ' is at its limit (' + a.capacityCurrent + '/' + a.capacityMax + '). Release something first.' };
    }
    if (a.effects && a.effects.some((e) => e.target !== 'none' && e.value !== 0)) {
      if (a.duration === '' || a.duration < 1)
        return { ok: false, message: 'Set a duration of at least 1 turn for ' + a.name + ' to apply its automatic effects.' };
      const missing = a.effects.find((e) => e.target === 'resource-max' && e.value !== 0 &&
        !(state.resources || []).some((r) => r.id === e.resourceId));
      if (missing) return { ok: false, message: 'Choose an existing custom resource for the maximum-resource effect.' };
    }
    const rollPlan=abilityRollPlan(state,a);
    if(!rollPlan.ok)return rollPlan;
    const ap = abilityApCost(state,a);
    if (!controls || typeof controls.getAp !== 'function' || typeof controls.spendAp !== 'function') {
      return { ok: false, message: 'AP tracker is not available.' };
    }
    if (ap > controls.getAp()) return { ok: false, message: 'Not enough AP to use ' + a.name + '.' };
    const cost = a.resourceCost === '' ? 0 : a.resourceCost;
    let resource = null;
    if (cost > 0) {
      if (!a.resourceId) return { ok: false, message: 'Choose a resource for ' + a.name + ' before activating it.' };
      if (a.resourceId === 'base-mana') {
        if (!controls.getMana || !controls.spendMana || !formManaAvailable(state)) {
          return { ok: false, message: 'Mana / Holy Power is unavailable for this character.' };
        }
        const mana = controls.getMana();
        if (mana == null || !Number.isFinite(mana)) return { ok: false, message: 'Set your maximum Mana / Holy Power before using this ability.' };
        if (mana < cost) return { ok: false, message: 'Not enough Mana / Holy Power to use ' + a.name + '.' };
      } else {
        resource = (state.resources || []).find((r) => r.id === a.resourceId);
        if (!resource) return { ok: false, message: 'Selected resource no longer exists for ' + a.name + '.' };
        if (!resourceAvailable(state, resource)) return { ok: false, message: resource.name + ' is unavailable in this form.' };
        if (resource.current < cost) return { ok: false, message: 'Not enough ' + resource.name + ' to use ' + a.name + '.' };
      }
    }
    const poolPayment=planPoolPayment(controls,ap,a.resourceId==='base-mana'?cost:0);
    if(poolPayment&&!poolPayment.ok)return poolPaymentError();
    return { ok: true, ability: a, ap, cost, resource, poolPayment, rollPlan };
  }

  function activate(state, abilityId, controls) {
    const check = checkActivation(state, abilityId, controls);
    if (!check.ok) return check;
    const { ability: a, ap, cost, resource, poolPayment } = check;
    // Validate all costs first. Only then commit the expenditure as one activation.
    if (poolPayment) controls.commitPools(poolPayment);
    else if (ap) controls.spendAp(ap);
    if (cost) {
      if (a.resourceId === 'base-mana') {
        if (!poolPayment) controls.spendMana(cost);
      }
      else resource.current -= cost;
    }
    const usage=usageState(state,a);
    if(usage.limited){
      if(usage.outside)a.outsideUsesSpent=(Number(a.outsideUsesSpent)||0)+1;
      else a.usesLeft=Math.max(0,a.usesLeft-1);
    }
    if (a.capacityMax !== '') a.capacityCurrent += 1;
    a.cooldownLeft = a.cooldown === '' ? 0 : a.cooldown;
    a.durationLeft = a.duration === '' ? 0 : a.duration;
    return { ok: true, ...(check.rollPlan.configured?{rollPlan:check.rollPlan}:{}),
      message: 'Used ' + a.name + (a.durationLeft ? ' — duration: ' + a.durationLeft + ' turn(s)' : '') + '.' };
  }

  const SORT_MODES = ['favorites', 'name', 'ap', 'category', 'usable'];
  const STATUS_MODES = ['all', 'usable', 'cooldown', 'exhausted', 'active', 'passive'];
  const AP_MODES = ['all', 'free', '1-5', '6-10', '11+'];
  function filterAbilities(state, filters, controls) {
    filters = filters || {};
    const searchText = String(filters.search || '').trim().toLocaleLowerCase();
    const category = String(filters.category || '');
    const type = String(filters.type || '');
    const resource = String(filters.resource || '');
    const status = STATUS_MODES.includes(filters.status) ? filters.status : 'all';
    const apMode = AP_MODES.includes(filters.ap) ? filters.ap : 'all';
    const sorting = SORT_MODES.includes(filters.sort) ? filters.sort : 'favorites';
    const showAll = filters.showAll === true;
    const apOf = a => abilityApCost(state,a);
    const matches = (state.abilities || []).filter(a => {
      if (!showAll && !loadoutVisible(state, a)) return false;
      const searchOK = !searchText ||
        [a.name, a.category, a.type, a.description, a.notes].some(t => String(t || '').toLocaleLowerCase().includes(searchText));
      if (!searchOK || (filters.favorites && !a.favorite)) return false;
      if (category && a.category !== category) return false;
      if (type && a.type !== type) return false;
      const paid = a.resourceCost !== '' && Number(a.resourceCost) > 0;
      if (resource === 'none' && paid) return false;
      if (resource && resource !== 'none' && (!paid || a.resourceId !== resource)) return false;
      const ap = apOf(a);
      if ((apMode === 'free' && ap !== 0) ||
          (apMode === '1-5' && !(ap >= 1 && ap <= 5)) ||
          (apMode === '6-10' && !(ap >= 6 && ap <= 10)) ||
          (apMode === '11+' && ap < 11)) return false;
      if (status === 'cooldown' && !(a.cooldownLeft > 0)) return false;
      if (status === 'exhausted' && !(usageState(state,a).limited && usageState(state,a).remaining <= 0)) return false;
      if (status === 'active' && !(a.durationLeft > 0)) return false;
      if (status === 'passive' && a.type !== 'passive') return false;
      if (status === 'usable' && !checkActivation(state, a.id, controls).ok) return false;
      return true;
    });
    matches.sort((a,b) => {
      if (sorting === 'name') return a.name.localeCompare(b.name);
      if (sorting === 'ap') return apOf(a) - apOf(b) || a.name.localeCompare(b.name);
      if (sorting === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      if (sorting === 'usable') return Number(checkActivation(state,b.id,controls).ok) -
        Number(checkActivation(state,a.id,controls).ok) || a.name.localeCompare(b.name);
      return Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name);
    });
    return matches;
  }

  function advanceTurn(state) {
    let changed = false;
    for (const a of state.abilities) {
      if(state.inCombat===true&&usesPer(a)==='round'&&a.uses!==''&&a.usesLeft!==a.uses){a.usesLeft=a.uses;changed=true;}
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
      a.outsideUsesSpent=0;
    }
  }

  function initMilestones(getState,save,controls) {
    const list=document.getElementById('milestoneList'),feedback=document.getElementById('milestoneFeedback');
    const count=document.getElementById('milestoneCount'),locked=document.getElementById('milestoneLocked');
    function render(){
      const actions=milestoneActions(getState()),unlocked=actions.filter(a=>a.unlocked);
      count.textContent=unlocked.length+' unlocked';
      list.innerHTML=unlocked.length?unlocked.map(a=>
        '<article class="milestone-action" data-milestone-id="'+a.id+'"><div class="milestone-action-head"><h3>'+esc(a.name)+'</h3>'+
          '<span class="ability-tag">'+a.ap+' AP · '+a.usage.remaining+'/'+a.usage.maximum+' uses / '+a.usage.period+'</span></div>'+
          '<p class="pool-src">'+esc(a.plan.text)+'</p><div class="milestone-action-controls">'+
          (a.weapon?'<a class="btn" href="#sheet/equipment">Use with a weapon</a>':
            '<button type="button" class="btn strong" data-milestone-use="'+a.id+'">Use '+esc(a.name)+'</button>')+
          '<label class="ability-field"><span class="foot-label">Uses remaining</span><input type="number" min="0" max="'+a.usage.maximum+'" value="'+a.usage.remaining+'" data-milestone-remaining="'+a.id+'"></label>'+
          '</div></article>').join(''):'<p class="pool-src">These actions unlock when their effective attribute reaches 21 or 28.</p>';
      locked.innerHTML=actions.filter(a=>!a.unlocked).map(a=>'<li>'+esc(a.name)+' — '+a.stat+' '+a.at+'</li>').join('');
    }
    list.addEventListener('click',event=>{
      const button=event.target.closest('[data-milestone-use]');if(!button)return;
      const id=button.dataset.milestoneUse,result=controls.execute({type:'UseMilestone',milestoneId:id});
      feedback.textContent=result.message;feedback.classList.toggle('ability-error',!result.ok);
      if(result.ok){controls.refresh();save();controls.rollMilestone(result.milestonePlan);}
      render();
      const next=list.querySelector('[data-milestone-use="'+id+'"]');if(next)next.focus({preventScroll:true});
    });
    list.addEventListener('change',event=>{
      const input=event.target.closest('[data-milestone-remaining]');if(!input)return;
      const result=controls.execute({type:'SetMilestoneUses',milestoneId:input.dataset.milestoneRemaining,value:input.value});
      feedback.textContent=result.message;feedback.classList.toggle('ability-error',!result.ok);
      if(result.ok){controls.refresh();save();}render();
    });
    render();return {render};
  }
  function init(getState, save, controls) {
    controls = controls || {};
    const execute=command=>typeof controls.execute==='function'?controls.execute(command):
      {ok:false,message:'The character command handler is unavailable.'};

    const list = document.getElementById('abilityList');
    const search = document.getElementById('abilitySearch');
    const category = document.getElementById('abilityCategory');
    const favorites = document.getElementById('abilityFavorites');
    const typeFilter = document.getElementById('abilityTypeFilter');
    const resourceFilter = document.getElementById('abilityResourceFilter');
    const statusFilter = document.getElementById('abilityStatusFilter');
    const apFilter = document.getElementById('abilityApFilter');
    const sortFilter = document.getElementById('abilitySortFilter');
    const compactToggle = document.getElementById('abilityCompact');
    const clearFilters = document.getElementById('abilityClearFilters');
    const count = document.getElementById('abilityCount');
    const feedback = document.getElementById('abilityFeedback');
    const addButton = document.getElementById('abilityAdd');
    const loadoutSelect = document.getElementById('abilityLoadoutSelect');
    const loadoutInput = document.getElementById('abilityLoadoutName');
    const loadoutAdd = document.getElementById('abilityLoadoutAdd');
    const loadoutDelete = document.getElementById('abilityLoadoutDelete');
    const showAllLoadouts = document.getElementById('abilityShowAll');
    const loadoutFeedback = document.getElementById('abilityLoadoutFeedback');
    const loadoutConfig = document.getElementById('abilityLoadoutConfig');
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

    function effectRow(e, state) {
      const targetOptions = [
        ['none', 'None'], ['movement', 'Movement (ft/AP)'], ['armor', 'Armor Rating'],
        ['evasion', 'Natural Evasion'], ['stat', 'Stat score'], ['resource-max', 'Custom resource maximum']
      ];
      return '<div class="ability-effect-row" data-effect-id="' + esc(e.id) + '">' +
        '<label class="ability-field"><span class="foot-label">Target</span><select data-effect-prop="target">' +
          targetOptions.map(([v, title]) => '<option value="' + v + '"' + (e.target === v ? ' selected' : '') + '>' + title + '</option>').join('') +
        '</select></label>' +
        (e.target === 'stat' ?
          '<label class="ability-field"><span class="foot-label">Stat</span><select data-effect-prop="stat">' +
          STATS.map((k) => '<option value="' + k + '"' + (k === e.stat ? ' selected' : '') + '>' + k + '</option>').join('') +
          '</select></label>' : '') +
        (e.target === 'resource-max' ?
          '<label class="ability-field"><span class="foot-label">Resource</span><select data-effect-prop="resourceId">' +
          '<option value="">Choose resource</option>' +
          (state.resources || []).map((r) => '<option value="' + esc(r.id) + '"' + (e.resourceId === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') +
          (!(state.resources || []).some((r) => r.id === e.resourceId) && e.resourceId ?
            '<option value="' + esc(e.resourceId) + '" selected>Missing resource</option>' : '') +
          '</select></label>' : '') +
        '<label class="ability-field"><span class="foot-label">Bonus / penalty</span>' +
          '<input data-effect-prop="value" type="number" inputmode="numeric" min="-99999" max="99999" step="1" value="' + e.value + '"></label>' +
        '<button type="button" class="btn danger" data-ability-action="remove-effect" aria-label="Remove effect">Remove</button>' +
      '</div>';
    }

    function memberships(ability) {
      const forms = getState().abilityLoadouts || [];
      if (!forms.length) return '';
      const shared = !ability.loadoutIds || ability.loadoutIds.length === 0;
      return '<fieldset class="ability-memberships"><legend>Available in forms</legend>' +
        '<p class="ability-effect-hint">Choose any form to make this ability form-specific. Select multiple forms if needed; clearing them all makes it shared again.</p>' +
        '<label><input type="checkbox" data-loadout-shared ' + (shared ? 'checked' : '') + '> Shared across all forms</label>' +
        '<div class="ability-membership-list">' + forms.map(form =>
          '<label><input type="checkbox" data-loadout-member="' + esc(form.id) + '" ' +
            (!shared && ability.loadoutIds.includes(form.id) ? 'checked ' : '') +
            '> ' + esc(form.name) + '</label>').join('') + '</div></fieldset>';
    }
    function renderLoadoutConfig() {
      const state = getState();
      const form = (state.abilityLoadouts || []).find(x => x.id === state.activeAbilityLoadoutId);
      if (!form) {
        loadoutConfig.innerHTML = '<p class="ability-effect-hint">Choose a named form to customize its appearance and stat modifiers. Base uses your normal character.</p>';
        return;
      }
      const oldDetails = loadoutConfig.querySelector ? loadoutConfig.querySelector('details') : null;
      const expanded = oldDetails && oldDetails.open;
      const options = '<option value="">No linked portrait</option>' +
        (state.portraits || []).map((p,i) =>
          '<option value="' + esc(p.id) + '"' + (p.id === form.portraitId ? ' selected' : '') + '>' +
          esc(p.name || 'Portrait ' + (i+1)) + '</option>').join('');
      loadoutConfig.innerHTML = '<details class="loadout-mechanics"' + (expanded ? ' open' : '') + '>' +
        '<summary>Appearance &amp; stat adjustments for ' + esc(form.name) + '</summary>' +
        '<div class="loadout-mechanics-content">' +
          '<label class="ability-field"><span class="foot-label">Linked portrait</span>' +
            '<select data-loadout-portrait>' + options + '</select></label>' +
          '<p class="ability-effect-hint">Link an existing portrait from Overview. Changing the ability form switches its portrait, and selecting a portrait in Overview switches to its linked ability form. An unlinked portrait selects Base/shared abilities.</p>' +
          '<label class="ability-field"><span class="foot-label">Mana / Holy Power in this form</span>' +
            '<select data-loadout-mana-mode>' +
              '<option value="inherit"' + (form.manaMode === 'inherit' ? ' selected' : '') + '>Use global Mana setting</option>' +
              '<option value="show"' + (form.manaMode === 'show' ? ' selected' : '') + '>Show and allow Mana</option>' +
              '<option value="hide"' + (form.manaMode === 'hide' ? ' selected' : '') + '>Hide and disable Mana</option>' +
            '</select></label>' +
          '<p class="ability-effect-hint">Custom resources are assigned individually on Overview. Hidden pools keep their balances; this setting only controls the built-in Mana/Holy Power pool.</p>' +
          '<fieldset class="form-entry-costs"><legend>Cost to enter this form (optional)</legend>' +
            '<p class="ability-effect-hint">Blank means free. Combine AP and one resource if desired. Base is always free; failed switches spend nothing.</p>' +
            '<label class="ability-field"><span class="foot-label">AP to enter</span>' +
              '<input data-loadout-entry-cost="entryApCost" type="number" min="0" max="999999" step="1" inputmode="numeric" placeholder="Free" value="' + esc(form.entryApCost) + '"></label>' +
            '<label class="ability-field"><span class="foot-label">Resource to spend</span>' +
              '<select data-loadout-entry-resource><option value="">None</option>' +
              '<option value="base-mana"' + (form.entryResourceId==='base-mana'?' selected':'') + '>' +
              (state.fields && state.fields.manaKind==='holy'?'Holy Power':'Mana') + '</option>' +
              (state.resources||[]).map(r=>'<option value="' + esc(r.id) + '"' +
                (form.entryResourceId===r.id?' selected':'') + '>' + esc(r.name) + '</option>').join('') +
              (form.entryResourceId && form.entryResourceId!=='base-mana' &&
                !(state.resources||[]).some(r=>r.id===form.entryResourceId) ?
                '<option value="' + esc(form.entryResourceId) + '" selected>Missing resource</option>' : '') +
              '</select></label>' +
            '<label class="ability-field"><span class="foot-label">Resource amount to enter</span>' +
              '<input data-loadout-entry-cost="entryResourceCost" type="number" min="0" max="999999" step="1" inputmode="numeric" placeholder="Free" value="' + esc(form.entryResourceCost) + '"></label>' +
          '</fieldset>' +
          '<p class="ability-effect-hint">Temporary form score adjustments (not permanent stat points). Bonuses and penalties apply while this form is selected.</p>' +
          '<div class="loadout-stat-grid">' + STATS.map(k =>
            '<label class="ability-field"><span class="foot-label">' + k + '</span>' +
            '<input type="number" min="-28" max="28" step="1" data-loadout-stat="' + k +
            '" value="' + (form.statBonuses[k] || 0) + '"></label>').join('') + '</div>' +
          '</div></details>';
    }
    function renderLoadouts() {
      const state = getState();
      const current = state.activeAbilityLoadoutId || '';
      loadoutSelect.innerHTML = '<option value="">Base / shared abilities</option>' +
        state.abilityLoadouts.map(x => '<option value="' + esc(x.id) + '"' +
          (x.id === current ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
      loadoutSelect.value = current;
      loadoutDelete.disabled = !current;
      loadoutAdd.disabled = state.abilityLoadouts.length >= MAX_LOADOUTS;
      renderLoadoutConfig();
    }

    function abilityBadges(ability, includeEffects = true) {
      if (!Array.isArray(ability.effects)) ability.effects = normalizeEffects(ability);
      const badges = [ability.type.charAt(0).toUpperCase() + ability.type.slice(1)];
      if (!loadoutVisible(getState(), ability)) badges.push('Other form');
      const stat=discountStat(ability);
      if (stat) badges.push(abilityApCost(getState(),ability)+' AP ('+(ability.apCost||0)+' base · '+stat+')');
      else if (ability.apCost !== '') badges.push(ability.apCost + ' AP');
      const roll=abilityRollPlan(getState(),ability);
      if(!roll.ok)badges.push('Check roll setup');
      else if(roll.configured){
        if(roll.attack)badges.push(roll.attack.stat+' attack '+(roll.attack.modifier>=0?'+':'')+roll.attack.modifier);
        if(roll.damage)badges.push(roll.damage.dice+(roll.damage.type?' '+roll.damage.type:''));
        if(roll.save)badges.push((roll.save.targetStat?roll.save.targetStat+' save · ':'Save ')+'DC '+roll.save.dc);
      }
      if (ability.resourceId && ability.resourceCost !== '') {
        const s = getState();
        const r = ability.resourceId === 'base-mana'
          ? (s.fields && s.fields.manaKind === 'holy' ? 'Holy Power' : 'Mana')
          : ((s.resources || []).find((x) => x.id === ability.resourceId) || { name: 'Unknown resource' }).name;
        badges.push(ability.resourceCost + ' ' + r);
      }
      if (ability.cooldown !== '') badges.push(ability.cooldown + '-turn cooldown');
      if (ability.duration !== '') badges.push(ability.duration + '-turn duration');
      const usage=usageState(getState(),ability);
      if (usage.limited) badges.push(usage.remaining + '/' + usage.maximum + ' uses / '+usage.period);
      if (ability.capacityMax !== '') badges.push(ability.capacityCurrent + '/' + ability.capacityMax + ' active');
      if (ability.cooldownLeft) badges.push('Ready in ' + ability.cooldownLeft + ' turn(s)');
      if (ability.durationLeft) badges.push('Active: ' + ability.durationLeft + ' turn(s)');
      if (includeEffects) (ability.effects || []).forEach((e) => {
        if (e.target === 'none' || !e.value) return;
        const name = e.target === 'movement' ? 'ft/AP' :
          e.target === 'armor' ? 'Armor' : e.target === 'evasion' ? 'Evasion' :
          e.target === 'stat' ? e.stat :
          ((getState().resources || []).find((r) => r.id === e.resourceId) || { name: 'Missing resource' }).name + ' max';
        badges.push((e.value > 0 ? '+' : '') + e.value + ' ' + name + (ability.durationLeft ? ' active' : ''));
      });
      return badges;
    }
    function statField(label,prop,value,emptyLabel='None') {
      return '<label class="ability-field"><span class="foot-label">'+label+'</span><select data-ability-prop="'+prop+'">'+
        '<option value="">'+emptyLabel+'</option>'+STATS.map(stat=>'<option value="'+stat+'"'+(value===stat?' selected':'')+'>'+stat+'</option>').join('')+'</select></label>';
    }
    function card(ability) {
      const inactive = !loadoutVisible(getState(), ability);
      const badges = abilityBadges(ability);
      const usage=usageState(getState(),ability);
      return '<div class="ability-item' + (ability.type === 'passive' ? '' : ' has-quick-use') +
        (inactive ? ' ability-inactive' : '') + '" data-ability-id="' + esc(ability.id) + '">' +
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
          memberships(ability) +
          '<label class="ability-field"><span class="foot-label">Description / effect</span>' +
            '<textarea data-ability-prop="description" rows="3" maxlength="12000" placeholder="Describe what this ability does.">' +
            esc(ability.description) + '</textarea></label>' +
          '<div class="ability-editor-row ability-cost-row">' +
            '<label class="ability-field"><span class="foot-label">Action tier</span><select data-action-tier><option value="">Custom</option><option value="0">Free · 0 AP</option><option value="2">Minor · 2 AP</option><option value="5">Quick · 5 AP</option><option value="10">Standard · 10 AP</option><option value="11">Spell · 11 AP</option><option value="15">Heavy / Extended · 15+ AP</option></select></label>'+field('Base AP cost', 'apCost', ability.apCost, 'number') +
            '<label class="ability-field"><span class="foot-label">Discounted by</span>' +
              '<select data-ability-prop="apDiscountStat"><option value="">None</option>' +
                DISCOUNT_STATS.map(stat=>'<option value="'+stat+'"'+
                  (ability.apDiscountStat===stat?' selected':'')+'>'+stat+'</option>').join('') +
              '</select></label>' +
          '</div>' +
          '<p class="ability-effect-hint" data-ability-ap-price>Current cost: '+abilityApCost(getState(),ability)+
            ' AP. '+(discountStat(ability)?'Minimum half the base cost, rounded up. Negative modifiers increase the price. Blank or 0 stays free.':
            'None keeps the base AP cost.')+'</p>' +
          '<div class="ability-editor-row ability-cost-row">' +
            '<label class="ability-field"><span class="foot-label">Resource</span>' +
              '<select data-ability-prop="resourceId">' + resourceOptions(ability.resourceId) + '</select></label>' +
            field('Resource cost', 'resourceCost', ability.resourceCost, 'number') +
          '</div>' +
          '<div class="ability-editor-row">' +
            field('Cooldown (turns)', 'cooldown', ability.cooldown, 'number')+field('Cooldown remaining','cooldownLeft',ability.cooldownLeft,'number')+field('Effect turns remaining','durationLeft',ability.durationLeft,'number') +
            field('Duration (turns)', 'duration', ability.duration, 'number') +
            field('Uses / charges (blank = unlimited)', 'uses', ability.uses, 'number', ' placeholder="Unlimited" title="Limits activations in the selected reset period; leave blank for unlimited."') +
          '</div>' +
          '<div class="ability-editor-row ability-cost-row">' +
            '<label class="ability-field"><span class="foot-label">Uses reset</span><select data-ability-prop="usesPer">'+
              [['rest','Long rest'],['combat','New combat'],['round','Turn start']].map(([value,label])=>
                '<option value="'+value+'"'+(usesPer(ability)===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label>' +
            (usesPer(ability)==='round'?statField('Outside uses from stat modifier','outsideUsesStat',ability.outsideUsesStat,'Same number of uses'):'') +
          '</div>' +
          (usesPer(ability)==='rest'?'':'<p class="ability-effect-hint">Combat and outside allowances are separate. Outside combat: '+
            (usesPer(ability)==='round'&&ability.outsideUsesStat?ability.outsideUsesStat+' modifier':'the same number of uses')+
            ' per long rest. Starting a turn outside combat does not refill them.</p>') +
          '<details class="ability-roll-config"'+(ability.attackStat||ability.damageDice||ability.saveDcStat||ability.targetSaveStat?' open':'')+'>' +
            '<summary>Optional rolls</summary><div class="ability-roll-fields">' +
            '<p class="ability-effect-hint">Use pays once, then opens the roll popup. Damage costs no extra AP. Leave these blank for a tracker-only ability.</p>' +
            '<div class="ability-editor-row ability-cost-row">' +
              statField('Attack stat','attackStat',ability.attackStat) +
              statField('Damage bonus stat','damageStat',ability.damageStat) + '</div>' +
            '<div class="ability-editor-row ability-cost-row">' +
              field('Damage dice / flat','damageDice',ability.damageDice,'text',' maxlength="120" placeholder="2d6 + 3"') +
              field('Damage type','damageType',ability.damageType,'text',' maxlength="60" placeholder="Fire, slashing…"') + '</div>' +
            '<div class="ability-editor-row ability-cost-row">' +
              statField('Save DC stat (12 + mod)','saveDcStat',ability.saveDcStat) +
              statField('Target save','targetSaveStat',ability.targetSaveStat) + '</div>' +
            '<p class="ability-effect-hint">These stats are independent of Discounted by. Damage adds only the bonus stat you choose. The target rolls their save; resolve its effect at the table.</p>' +
            '</div></details>' +
          '<div class="ability-capacity">' +
            field('Max active / held (blank = no limit)', 'capacityMax', ability.capacityMax, 'number', ' placeholder="No limit" title="Maximum number of creations or objects that can exist at once. Separate from uses."') +
            (ability.capacityMax === '' ? '' :
              '<label class="ability-field"><span class="foot-label">Currently active / held</span><input type="number" min="0" max="' + ability.capacityMax + '" value="' + ability.capacityCurrent + '" data-ability-prop="capacityCurrent"></label>' +
              '<button type="button" class="btn" data-ability-action="release" title="Remove one currently active or held object">−1 Release</button>') +
          '</div>' +
          '<div class="ability-effects">' +
            '<div class="ability-effects-head"><span>Automatic effects</span>' +
              '<button type="button" class="btn" data-ability-action="add-effect"' +
                (ability.effects.length >= MAX_EFFECTS ? ' disabled' : '') + '>+ Add effect</button></div>' +
            (ability.effects.length ? ability.effects.map((e) => effectRow(e, getState())).join('') :
              '<p class="ability-effect-hint">No automatic effects. Add Movement, Armor, Evasion, a stat, or a custom resource maximum.</p>') +
            '<p class="ability-effect-hint">Bonuses stack while active and expire with this ability’s duration. Base stats, gear and resource maximums remain unchanged. Maximum-resource effects do not refill the pool.</p>' +
          '</div>' +
          '<label class="ability-field"><span class="foot-label">Notes</span>' +
            '<textarea data-ability-prop="notes" rows="2" maxlength="6000" placeholder="Optional conditions, limits, or reminders.">' +
            esc(ability.notes) + '</textarea></label>' +
          '<div class="ability-activate">' +
            (ability.type === 'passive'
              ? '<span class="ability-status">Passive · always available; no activation needed</span>'
              : '<button type="button" class="btn strong" data-ability-action="use"' + (inactive ? ' disabled' : '') + '>Use ability</button>' +
                '<span class="ability-status">' +
                  (ability.cooldownLeft ? 'Cooldown: ' + ability.cooldownLeft + ' turn(s)' :
                    usage.limited && usage.remaining <= 0 ? 'Out of uses' : 'Ready') +
                  (ability.durationLeft ? ' · Active for ' + ability.durationLeft + ' more turn(s)' : '') +
                '</span>') +
            (ability.durationLeft ? '<button type="button" class="btn" data-ability-action="end">End effect</button>' : '') +
          '</div>' +
          (usage.limited ? '<label class="ability-field ability-uses-left"><span class="foot-label">Uses remaining (current allowance; adjust manually)</span><input data-ability-prop="usesLeft" type="number" min="0" max="' + usage.maximum + '" value="' + usage.remaining + '"></label>' : '') +
          '<div class="ability-card-actions">' +
            '<button type="button" class="btn" data-ability-action="reset">Reset ability tracker</button>' +
            '<button type="button" class="btn" data-ability-action="favorite" aria-pressed="' +
              (ability.favorite ? 'true' : 'false') + '">' + (ability.favorite ? '★ Favorite' : '☆ Add favorite') + '</button>' +
            '<button type="button" class="btn" data-ability-action="duplicate">Duplicate</button>' +
            '<button type="button" class="btn danger" data-ability-action="delete">Delete</button>' +
          '</div>' +
        '</div></details>' +
        (ability.type === 'passive' ? '' :
          '<button type="button" class="ability-quick-use" data-ability-action="use"' +
          (inactive ? ' disabled' : '') + ' aria-label="Use ' +
          esc(ability.name) + '" title="Use ' + esc(ability.name) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg><span>Use</span></button>') +
        '</div>';
    }

    const favoriteList = document.getElementById('favoriteList');
    const favoriteFeedback = document.getElementById('favoriteFeedback');
    function renderFavorites() {
      if (!favoriteList) return;
      const state = getState();
      const chosen = state.abilities.filter(a => a.favorite && loadoutVisible(state, a));
      favoriteList.innerHTML = chosen.length ? chosen.map(a =>
        '<article class="favorite-ability" data-favorite-id="' + esc(a.id) + '">' +
          '<div><h4>' + esc(a.name) + '</h4><p>' +
          abilityBadges(a, false).map(esc).join(' · ') + '</p></div>' +
          (a.type === 'passive' ? '<span class="favorite-passive">Passive</span>' :
            '<button type="button" class="btn strong" data-favorite-use="' + esc(a.id) +
            '" aria-label="Use ' + esc(a.name) + '">Use</button>') +
        '</article>').join('') :
        '<p class="favorite-empty">Star abilities in the Abilities tab to keep them here. Only favorites available in your current form appear.</p>';
    }
    function useAbility(ability, output) {
      const result = execute({type:'ActivateAbility',abilityId:ability.id});
      output.textContent = result.message;
      output.classList.toggle('ability-error', !result.ok);
      if (result.ok && controls.refresh) controls.refresh();
      if (result.ok && result.rollPlan && controls.rollAbility) controls.rollAbility(result.rollPlan);
    }
    if (favoriteList) favoriteList.addEventListener('click', event => {
      const button = event.target.closest('[data-favorite-use]');
      const ability = button && byId(button.dataset.favoriteUse);
      if (!ability) return;
      useAbility(ability, favoriteFeedback);
      render();
      save();
      const next = favoriteList.querySelector('[data-favorite-use="' + ability.id + '"]');
      if (next) next.focus({preventScroll:true});
    });

    function rememberOpen() {
      list.querySelectorAll('details.ability-card').forEach((detail) => {
        const abilityId = detail.dataset.abilityId;
        if (detail.open) open.add(abilityId);
        else open.delete(abilityId);
      });
    }
    function render() {
      const state = getState();
      const abilities = state.abilities;
      rememberOpen();
      renderFavorites();
      renderLoadouts();
      const selectedCategory = category.value || '';
      const categories = [...new Set(abilities.map(a => a.category))].sort((a,b) => a.localeCompare(b));
      category.innerHTML = '<option value="">All categories</option>' +
        categories.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
      category.value = categories.includes(selectedCategory) ? selectedCategory : '';
      const selectedResource = resourceFilter.value || '';
      const resources = [
        { id: 'base-mana', name: state.fields && state.fields.manaKind === 'holy' ? 'Holy Power' : 'Mana' },
        ...(state.resources || []).map(r => ({ id: r.id, name: r.name }))
      ];
      resourceFilter.innerHTML = '<option value="">Any resource</option><option value="none">No resource cost</option>' +
        resources.map(r => '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>').join('');
      resourceFilter.value = resources.some(r => r.id === selectedResource) || selectedResource === 'none' ?
        selectedResource : '';
      const matches = filterAbilities(state, {
        search: search.value, category: category.value,
        favorites: favorites.checked, type: typeFilter.value,
        resource: resourceFilter.value, status: statusFilter.value,
        ap: apFilter.value, sort: sortFilter.value, showAll: showAllLoadouts.checked
      }, controls);
      list.classList.toggle('is-compact', compactToggle.checked);
      const visibleCount = abilities.filter(a => loadoutVisible(state, a)).length;
      count.textContent = matches.length + ' shown / ' + visibleCount + ' in current form · ' + abilities.length + ' total';
      list.innerHTML = matches.length ? matches.map(card).join('') :
        '<p class="ability-empty">' + (abilities.length ?
          'No abilities match these filters. Clear filters to see everything.' :
          'No abilities yet. Add a custom technique, spell, trait, or passive.') + '</p>';
    }
    function resetFilters() {
      search.value = '';
      category.value = '';
      favorites.checked = false;
      typeFilter.value = '';
      resourceFilter.value = '';
      statusFilter.value = 'all';
      apFilter.value = 'all';
      sortFilter.value = 'favorites';
    }

    addButton.addEventListener('click', () => {
      const active = getState().activeAbilityLoadoutId;
      const ability = normalizeAbility({ id: id(), name: 'New ability', category: 'General',
        loadoutIds: active ? [active] : [] });
      getState().abilities.push(ability);
      resetFilters();
      open.add(ability.id);
      render();
      save();
      const cardElement = [...list.querySelectorAll('[data-ability-id]')].find((el) => el.dataset.abilityId === ability.id);
      const input = cardElement && cardElement.querySelector('[data-ability-prop="name"]');
      if (input) { input.focus(); input.select(); }
    });

    search.addEventListener('input', render);
    [category, favorites, typeFilter, resourceFilter, statusFilter, apFilter, sortFilter,
      compactToggle].forEach(el => el.addEventListener('change', render));
    clearFilters.addEventListener('click', () => { resetFilters(); render(); });
    showAllLoadouts.addEventListener('change', render);
    loadoutConfig.addEventListener('change', e => {
      const el = e.target.closest('[data-loadout-portrait], [data-loadout-stat], [data-loadout-mana-mode], [data-loadout-entry-cost], [data-loadout-entry-resource]');
      if (!el) return;
      const state = getState();
      const identifier = state.activeAbilityLoadoutId;
      const property = el.hasAttribute('data-loadout-portrait') ? 'portraitId' :
        el.hasAttribute('data-loadout-mana-mode') ? 'manaMode' :
        el.hasAttribute('data-loadout-entry-resource') ? 'entryResourceId' :
        el.dataset.loadoutEntryCost || el.dataset.loadoutStat;
      if (!configureLoadout(state, identifier, property, el.value)) return;
      if (controls.refresh) controls.refresh();
      render();
      save();
    });
    loadoutSelect.addEventListener('change', () => {
      const result=execute({type:'EnterForm',formId:loadoutSelect.value});
      if(!result.ok) {
        loadoutFeedback.textContent=result.message;
        renderLoadouts(); // Reset a failed selection without losing the form or portrait.
        return;
      }
      resetFilters();
      render();
      save();
      loadoutFeedback.textContent = loadoutSelect.value ?
        'Active form: ' + (getState().abilityLoadouts.find(x => x.id === loadoutSelect.value) || {name:''}).name :
        'Base form: shared abilities only.';
      if (controls.refresh) controls.refresh();
    });
    function addForm() {
      const form = createLoadout(getState(), loadoutInput.value);
      if (!form) {
        loadoutFeedback.textContent = 'Enter a form name (maximum ' + MAX_LOADOUTS + ' forms).';
        return;
      }
      loadoutInput.value = '';
      loadoutFeedback.textContent = 'Created ' + form.name + '. Assign abilities using each ability editor.';
      resetFilters();
      render();
      save();
    }
    loadoutAdd.addEventListener('click', addForm);
    loadoutInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addForm(); }
    });
    loadoutDelete.addEventListener('click', () => {
      const state = getState();
      const form = state.abilityLoadouts.find(x => x.id === state.activeAbilityLoadoutId);
      if (!form || !window.confirm('Delete ' + form.name +
        '? Abilities assigned only to this form will become shared. Their costs and cooldowns remain unchanged.')) return;
      removeLoadout(state, form.id);
      resetFilters();
      loadoutFeedback.textContent = 'Deleted ' + form.name + '.';
      render();
      save();
    });

    function updateInput(input) {
      const cardElement = input.closest('[data-ability-id]');
      const ability = cardElement && byId(cardElement.dataset.abilityId);
      if (!ability) return null;
      const prop = input.dataset.abilityProp;
      if(['capacityCurrent','usesLeft','cooldownLeft','durationLeft'].includes(prop)){
        const entered=optionalNumber(input.value);if(entered!=='')execute({type:'SetAbilityTracker',abilityId:ability.id,field:prop,value:entered});
        save();return {ability,prop};
      }
      if (!propNames.includes(prop)) return null;
      ability[prop] = prop==='usesPer'?usesPer({usesPer:input.value}):
        prop==='outsideUsesStat'?rollStat(input.value):rollStats.has(prop)?rollStat(input.value):
        prop==='apDiscountStat' ? discountStat({apDiscountStat:input.value}) :
        numerical.has(prop) ? optionalNumber(input.value) :
        clean(input.value, prop === 'name' ? 100 : prop === 'category' ? 60 :
          prop === 'description' ? 12000 : prop === 'notes' ? 6000 : prop==='damageDice'?120:prop==='damageType'?60:100);
      if (prop === 'uses') {ability.usesLeft = ability.uses === '' ? null : ability.uses;ability.outsideUsesSpent=0;}
      if (prop === 'capacityMax') {
        ability.capacityCurrent = ability.capacityMax === '' ? 0 :
          Math.min(ability.capacityMax, ability.capacityCurrent);
      }
      save();
      return { ability, prop };
    }
    function updateEffect(input) {
      const cardElement = input.closest('[data-ability-id]');
      const a = cardElement && byId(cardElement.dataset.abilityId);
      const item = input.closest('[data-effect-id]');
      const effect = a && item && a.effects.find((e) => e.id === item.dataset.effectId);
      if (!effect) return false;
      const prop = input.dataset.effectProp;
      if (prop === 'target') effect.target = effectTargets.includes(input.value) ? input.value : 'none';
      else if (prop === 'value') effect.value = signedNumber(input.value);
      else if (prop === 'stat') effect.stat = STATS.includes(input.value) ? input.value : 'STR';
      else if (prop === 'resourceId') effect.resourceId = clean(input.value, 100);
      else return false;
      a.durationLeft = 0; // Editing an active effect cancels it; no stale bonuses.
      save();
      return true;
    }
    list.addEventListener('input', (event) => {
      const effectInput = event.target.closest('[data-effect-prop]');
      if (effectInput) { updateEffect(effectInput); return; }
      const input = event.target.closest('[data-ability-prop]');
      if (input) updateInput(input);
    });
    list.addEventListener('change', (event) => {
      const tier=event.target.closest('[data-action-tier]');if(tier){const a=byId(tier.closest('[data-ability-id]').dataset.abilityId);if(a&&tier.value!==''){a.apCost=Number(tier.value);render();save();}return;}

      const member = event.target.closest('[data-loadout-member], [data-loadout-shared]');
      if (member) {
        const cardElement = member.closest('[data-ability-id]');
        const ability = cardElement && byId(cardElement.dataset.abilityId);
        if (!ability) return;
        if (member.hasAttribute('data-loadout-shared')) {
          setLoadoutMembership(getState(), ability, 'shared', '', member.checked);
        } else {
          setLoadoutMembership(getState(), ability, 'member', member.dataset.loadoutMember, member.checked);
        }
        render();
        save();
        return;
      }
      const effectInput = event.target.closest('[data-effect-prop]');
      if (effectInput) {
        updateEffect(effectInput);
        if (controls.refresh) controls.refresh();
        render();
        return;
      }
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
        const copy = normalizeAbility(Object.assign({}, ability, {
          id: id(), name: 'Copy of ' + ability.name, favorite: false,
          usesLeft: ability.uses === '' ? null : ability.uses, cooldownLeft: 0, durationLeft: 0,
          outsideUsesSpent:0,
          capacityCurrent: 0,
          loadoutIds: [...ability.loadoutIds],
          effects: ability.effects.map((e) => Object.assign({}, e, { id: effectId() }))
        }));
        getState().abilities.push(copy);
        open.add(copy.id);
        resetFilters();
      } else if (action === 'add-effect') {
        if (ability.effects.length < MAX_EFFECTS) ability.effects.push(normalizeEffect({
          id: effectId(), target: 'none', value: 0
        }));
        ability.durationLeft = 0;
        if (controls.refresh) controls.refresh();
      } else if (action === 'remove-effect') {
        const item = button.closest('[data-effect-id]');
        ability.effects = ability.effects.filter((e) => e.id !== (item && item.dataset.effectId));
        ability.durationLeft = 0;
        if (controls.refresh) controls.refresh();
      } else if (action === 'favorite') {
        ability.favorite = !ability.favorite;
      } else if (action === 'use') {
        useAbility(ability, feedback);
      } else if(['reset','end','release'].includes(action)){
        const result=execute({type:action==='reset'?'ResetAbilityTracker':action==='end'?'EndAbilityEffect':'ReleaseAbilityCapacity',abilityId:ability.id});
        feedback.textContent=result.message;feedback.classList.toggle('ability-error',!result.ok);
        if(controls.refresh)controls.refresh();
      }
      render();
      save();
    });
    render();
    return {
      render,
      turnStart() { const r=execute({type:'AdvanceAbilityTurn'});if(r.ok){render();save();} },
      longRest() { execute({type:'RestAbilities'});render(); }
    };
  }

  window.WBAbilities = {
    normalizeState, init, initMilestones, activate, checkActivation, filterAbilities, loadoutVisible,
    milestoneDescriptions, milestoneAbility, milestoneAction, milestoneActions, milestoneLifecycle,
    createLoadout, removeLoadout, setLoadoutMembership,
    formStatBonus, abilityApCost, abilityRollPlan, weaponSource, weaponAttackPlan, usageState,
    equipmentOutsideSetting, equipmentAbility, equipmentLifecycle, remapEquipmentUses,
    entryCost, selectLoadout, selectPortrait, portraitForm, configureLoadout,
    resourceAvailable, formManaAvailable, advanceTurn, resetForRest,
    movementBonus, effectiveMovement, effectBonus, resourceMax
  };
})();
