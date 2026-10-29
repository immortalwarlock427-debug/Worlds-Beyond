// Worlds Beyond: character sheet and battlemap. One script for now; see docs/ARCHITECTURE.md.
(() => {
  const repositories = window.WBPersistence.createLocalRepositories(() => window.localStorage);
  const MAX_LEVEL = 100;
  const ASI_LEVELS = [4, 8, 12, 16, 19];
  const STATS = [
    { k: 'STR', n: 'Strength',     g: 'phys', m: ['Devastate', 'Overwhelming Force'] },
    { k: 'VIT', n: 'Vitality',     g: 'phys', m: ['Indomitable', 'Adamantine Body'] },
    { k: 'DEX', n: 'Dexterity',    g: 'phys', m: ['Parry', 'Singularity'] },
    { k: 'AGL', n: 'Agility',      g: 'phys', m: ['Surge', 'Flicker'] },
    { k: 'INT', n: 'Intelligence', g: 'ment', m: ['Stratagem', 'Absolute Comprehension'] },
    { k: 'WIS', n: 'Wisdom',       g: 'ment', m: ['Sixth Sense', 'Eyes of Truth'] },
    { k: 'CHA', n: 'Charisma',     g: 'ment', m: ['Commanding Presence', 'Unassailable Self'] },
    { k: 'FTH', n: 'Faith',        g: 'ment', m: ['Defy Fate', 'Miracle'] }
  ];
  // Milestone text, copied from the stat pages in Game Systems.
  const MS_DESC = {
    STR: ["Once each round, you can add your Strength modifier to an attack's damage twice instead of once.", "Your weapon and unarmed attacks can't have their damage reduced below half by anything, blocks and parries included. A dodge still avoids them entirely, since the attack never connects, and this doesn't bypass immunities."],
    VIT: ["Once per combat, when a status effect that physically restrains or damages you would take hold, such as stunned, paralyzed or restrained, you can negate it so it never affects you. Mind-based effects like charmed or frightened don't count. Also, when you're dropped below 0 Health, you can roll a d20 + your Vitality modifier against DC 12. On a success you stop bleeding, though you're still unconscious.", "Your Armor Rating becomes half your Vitality, rounded down, plus the armor you're wearing, instead of your Vitality modifier plus your armor."],
    DEX: ["Once each round, as a reaction, you can parry a physical attack you can see, melee or ranged, made against you or anyone you could reach with 1 AP of movement, moving in front of the attack to do it. You need a weapon or shield in hand. Roll a d20 and add your Dexterity modifier. If the result is higher than the attack roll, you negate all of the attack's damage and any non-magical effects it would apply.", "Once each round, before rolling a weapon attack (melee or ranged), you can concentrate all of your power into a single point. If the attack hits, it's a critical hit. If it misses, Singularity is spent for the round."],
    AGL: ["Each turn, you get 2 AP of movement for free. You also gain an additional reaction.", "You move so fast that you can't be hit by opportunity attacks, and any attack that relies on sight to hit you rolls with disadvantage, whether it's melee, ranged or a spell. You also have advantage on saves against spells that need sight to target you. You also gain an additional reaction."],
    INT: ["Once per round, for 5 AP, you can give a plan to an ally who can hear you. Their next attack roll or ability check before your next turn adds your Intelligence modifier.", "Once per round, for 5 AP, you can analyze a creature, ability, object or phenomenon you can perceive to learn one significant property, weakness or underlying principle, if one can be inferred from the information available."],
    WIS: ["You have a supernatural sense for danger directed at you. Whenever you face a danger you don't know about, the GM secretly makes a Wisdom check for you against the danger's DC, like an ambusher's stealth roll or a trap's DC. On a success you aren't told what's wrong, only that something is, like a sudden aversion to drinking from a cup. Once per round, at no AP cost, you can also ask the GM whether a specific choice is dangerous, and you get a feeling back: good, bad or unsure.", "You naturally see through illusions and can see invisible creatures within 30 ft. Once per round, for 5 AP, you can attempt to perceive the true intent behind anything in sight, whether a creature (hostile, afraid, lying or hiding something) or the things around you, like what a trap or ritual is meant to do. Make a Wisdom check, contested by a creature's Charisma if it's hiding something, or against a DC the GM sets."],
    CHA: ["Once per round, for 5 AP, you can force a creature within 60 ft that can perceive you to make a Charisma saving throw (DC 10 + double your Charisma modifier). On a failure, its attention is fixed on you until the start of your next turn, and it has disadvantage on attacks against anyone but you.", "You are immune to possession and to effects that forcibly alter your personality, memories or identity when they come from a source of your level or lower. Against higher-level sources, you have advantage to resist them."],
    FTH: ["Your luck changes. Instead of rerolling, each use lets you treat a failed saving throw or ability check as a success. You still have a number of uses equal to your Faith modifier, regained on a long rest. Initiative is the exception: a use there still rerolls it.", "Once per long rest, at no AP cost, you can declare in one sentence a single restriction standing in the way of an action, such as a usage limit, an immunity or the limit of your own strength, and fate bends probability so the action can come to pass anyway. Miracle fails if the declaration is too broad or fundamentally impossible for you: it can push you past your limits, but it can't give you an ability you don't have, like flight. Miracle can't be used to get around its own limit."]
  };
  const SLOTS = [
    { k: 'head',   n: 'Head',       fits: 'head' },
    { k: 'amulet', n: 'Amulet',     fits: 'amulet' },
    { k: 'torso',  n: 'Torso',      fits: 'torso' },
    { k: 'rarm',   n: 'Right Arm',  fits: 'arms' },
    { k: 'larm',   n: 'Left Arm',   fits: 'arms' },
    { k: 'rring',  n: 'Right Ring', fits: 'ring' },
    { k: 'lring',  n: 'Left Ring',  fits: 'ring' },
    { k: 'belt',   n: 'Belt',       fits: 'belt' },
    { k: 'rleg',   n: 'Right Leg',  fits: 'legs' },
    { k: 'lleg',   n: 'Left Leg',   fits: 'legs' },
    { k: 'main',   n: 'Main Hand',  fits: 'onehand twohand' },
    { k: 'off',    n: 'Off Hand',   fits: 'onehand shield' }
  ];
  const ORDER = SLOTS.map((s) => s.k);
  const SLOT_BY = {};
  SLOTS.forEach((s) => { SLOT_BY[s.k] = s; });
  // Sets: a piece that only works as a pair, like boots, fills both slots of its kind.
  // It sits in the first slot and covers the second, the way a two-handed weapon covers the off hand.
  const PAIRS = {
    arms: { a: 'rarm',  b: 'larm',  n: 'Both Arms',  on: 'both arms' },
    legs: { a: 'rleg',  b: 'lleg',  n: 'Both Legs',  on: 'both legs' },
    ring: { a: 'rring', b: 'lring', n: 'Both Rings', on: 'both ring slots' }
  };
  const TYPES = {
    head:   { n: 'Head',   def: 'Helmet' },
    torso:  { n: 'Torso',  def: 'Chestpiece' },
    arms:   { n: 'Arms',   def: 'Arm guards' },
    legs:   { n: 'Legs',   def: 'Leg guards' },
    ring:   { n: 'Ring',   def: 'Ring' },
    amulet: { n: 'Amulet', def: 'Amulet' },
    belt:   { n: 'Belt',   def: 'Belt' },
    onehand: { n: 'One-handed', def: 'Sword', weapon: true },
    twohand: { n: 'Two-handed', def: 'Greatsword', weapon: true },
    shield: { n: 'Shield', def: 'Shield' }
  };
  // What a piece of equipment can raise while it's worn (never AP or reactions).
  const BONUS = [
    { k: 'STR', n: 'STR', label: 'Strength', grp: 'Stats' },
    { k: 'VIT', n: 'VIT', label: 'Vitality', grp: 'Stats' },
    { k: 'DEX', n: 'DEX', label: 'Dexterity', grp: 'Stats' },
    { k: 'AGL', n: 'AGL', label: 'Agility', grp: 'Stats' },
    { k: 'INT', n: 'INT', label: 'Intelligence', grp: 'Stats' },
    { k: 'WIS', n: 'WIS', label: 'Wisdom', grp: 'Stats' },
    { k: 'CHA', n: 'CHA', label: 'Charisma', grp: 'Stats' },
    { k: 'FTH', n: 'FTH', label: 'Faith', grp: 'Stats' },
    { k: 'hp', n: 'Max Health', label: 'Max Health', grp: 'Vitals' },
    { k: 'mp', n: 'Max Mana', label: 'Max Mana', grp: 'Vitals' },
    { k: 'holy', n: 'Max Holy Power', label: 'Max Holy Power', grp: 'Vitals' },
    { k: 'ev', n: 'Natural Evasion', label: 'Natural Evasion', grp: 'Vitals' },
    { k: 'init', n: 'Initiative', label: 'Initiative', grp: 'Vitals' },
    { k: 'move', n: 'Movement', label: 'Movement (ft per AP)', unit: ' ft', grp: 'Vitals' },
    { k: 'sight', n: 'Darkvision', label: 'Darkvision (ft)', unit: ' ft', grp: 'Vitals' },
    { k: 'light', n: 'Light', label: 'Light (ft)', unit: ' ft', grp: 'Vitals' }
  ];
  const BONUS_BY = {};
  BONUS.forEach((b) => { BONUS_BY[b.k] = b; });
  const sgn = (v) => (v >= 0 ? '+' : '\u2212') + Math.abs(v);
  const fmtBonus = (b) => sgn(b.v) + (BONUS_BY[b.t].unit || '') + ' ' + BONUS_BY[b.t].n;
  // Simple combat effects gear can carry. Anything more involved is handled at the table.
  const EFFECTS = [
    { k: 'dmg',   n: 'Extra damage on hit' },
    { k: 'atk',   n: 'Attack bonus' },
    { k: 'flat',  n: 'Damage bonus' },
    { k: 'def',   n: 'Defense bonus' },
    { k: 'res',   n: 'Resistance' },
    { k: 'onhit', n: 'On-hit reminder' }
  ];
  const EFF_BY = {};
  EFFECTS.forEach((e) => { EFF_BY[e.k] = e; });
  const DEF_NAMES = { all: 'defenses', block: 'Block', dodge: 'Dodge', parry: 'Parry' };
  function fmtEff(e) {
    if (e.k === 'dmg') return '+' + e.dice + (e.dt ? ' ' + e.dt : '') + ' on hit';
    if (e.k === 'atk') return sgn(e.v) + ' to attack';
    if (e.k === 'flat') return sgn(e.v) + ' damage';
    if (e.k === 'def') return sgn(e.v) + ' to ' + DEF_NAMES[e.on];
    if (e.k === 'res') return 'Resist ' + e.dt;
    return 'On hit: ' + e.text;
  }
  const gearLine = (it) => (it.type === 'shield' && it.block ? ['Block die ' + it.block] : []).concat((it.bonuses || []).map(fmtBonus), (it.effects || []).map(fmtEff));
  const perText = (a) => (a.per === 'round' ? 'per round' : 'per long rest');
  const SVG_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">';
  const ICONS = {
    head:   SVG_OPEN + '<path d="M4.5 16v-4a7.5 7.5 0 0 1 15 0v4"/><path d="M4.5 16h5l1 4h3l1-4h5"/><path d="M12 4.5v6"/></svg>',
    torso:  SVG_OPEN + '<path d="M8 4l4 2 4-2 4 4-2.5 2.5V20h-11v-9.5L4 8z"/><path d="M12 6v14"/></svg>',
    arms:   SVG_OPEN + '<path d="M7 21l-1-8 3-1V5h2v6h1V4h2v7h1V6h2v7l-1 8z"/></svg>',
    legs:   SVG_OPEN + '<path d="M9 3h6v9l1 4 3 2v3H8v-5l1-4z"/><path d="M9 8h6"/></svg>',
    ring:   SVG_OPEN + '<circle cx="12" cy="14.5" r="5.5"/><path d="M9.5 6.5L12 4l2.5 2.5L12 9z"/></svg>',
    amulet: SVG_OPEN + '<path d="M6 3c0 5 2.7 8 6 9 3.3-1 6-4 6-9"/><path d="M12 12l3 4-3 5-3-5z"/></svg>',
    belt:   SVG_OPEN + '<rect x="2.5" y="9" width="19" height="6" rx="1"/><rect x="9.5" y="7.5" width="5" height="9" rx="1"/><path d="M12 10.5v3"/></svg>',
    onehand: SVG_OPEN + '<path d="M18.5 3.5h2v2L9 17l-2-2z"/><path d="M5.5 13.5l5 5M4 20l2.5-2.5"/></svg>',
    twohand: SVG_OPEN + '<path d="M17.5 3.5h3v3L9.5 17.5l-3-3z"/><path d="M4 12l8 8M3 21l3-3"/></svg>',
    shield: SVG_OPEN + '<path d="M12 3l7 2.5V11c0 4.6-3 8-7 10-4-2-7-5.4-7-10V5.5z"/><path d="M12 3v18M5 11h14"/></svg>'
  };
  const PEN = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M3 13l.8-3.2L10.5 3 13 5.5 6.2 12.2z"/><path d="M9.3 4.2l2.5 2.5"/></svg>';
  const UP = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V3.5M4.5 7L8 3.5 11.5 7"/></svg>';
  const DOWN = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5v9M4.5 9L8 12.5 11.5 9"/></svg>';
  const D20_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M8 1.5l5.6 3.2v6.6L8 14.5l-5.6-3.2V4.7z"/><path d="M8 1.5L4.3 9.3h7.4z"/><path d="M4.3 9.3L8 14.5l3.7-5.2"/></svg>';
  const DIE_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="5" cy="5" r="1.3" fill="currentColor"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="11" cy="11" r="1.3" fill="currentColor"/></svg>';
  const $ = (s) => document.querySelector(s);
  const blank = () => ({
    fields: {}, over: {}, hist: {}, rolls: {},
    pool: [], alloc: {}, items: [], equip: {}, equipmentProfiles: {}, order: [], lvGear: {}, settled: {}, spent: {},
    apAvail: null, reactAvail: null, wonderAvail: null, apGiven: null, move: null, portraits: [], formId: null,
    asi: {}, trauma: 0, down: null, advMode: 'norm', id: null, resources: [], showMana: true, abilities: [], abilityLoadouts: [], activeAbilityLoadoutId: '', statuses: []
  });
  function newCharId() { return 'c' + Date.now().toString(36) + randInt(1e6).toString(36); }

  // The game: the battlemap and everything on it, kept apart from the character so that later several
  // characters (and the DM) can share one game. map: which map and its size; tokens: each character's
  // square by character id; fog: per map, which squares the party has seen; foes: enemies on any map;
  // view: how this browser draws the map (grid strength, terrain overlay, reach shading).
  // Game session data has its own DOM-free normalizer for the future DM view.
  const blankGame = window.WBGameState.blankGame;
  const normalizeGame = window.WBGameState.normalizeGame;
  let game = blankGame();
  let gameSaveBase = blankGame();
  // Your token: this character's square in the game.
  const myTok = () => game.tokens[state.id] || null;
  function setTok(t) {
    const tokens = Object.assign({}, game.tokens);
    if (t) tokens[state.id] = { x: t.x, y: t.y }; else delete tokens[state.id];
    game.tokens = tokens;
  }

  const num = (v) => {
    const t = String(v == null ? '' : v).trim().replace(/−/g, '-');
    return t === '' ? NaN : Number(t);
  };
  const isSet = (v) => v != null && String(v).trim() !== '';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  let state = blank();
  let selected = null;   // { kind: 'roll' | 'item', id }
  let drag = null;
  let flash = '';
  let pendingFocus = null;

  // Equipment helpers (declared early so loading can validate saved data)
  function itemById(id) { return state.items.find((it) => it.id === id) || null; }
  function fits(type, slot) { const s = SLOT_BY[slot]; return !!s && s.fits.split(' ').includes(type); }
  function slotOf(id) { const s = SLOTS.find((x) => state.equip[x.k] === id); return s ? s.k : null; }
  const isPair = (it) => !!(it && it.pair && PAIRS[it.type]);
  // The piece covering a slot from elsewhere: a two-handed weapon over the off hand, or a set over its second slot.
  function coveredBy(slot) {
    if (slot === 'off') { const m = itemById(state.equip.main); return m && m.type === 'twohand' ? m : null; }
    const t = Object.keys(PAIRS).find((k) => PAIRS[k].b === slot);
    const it = t ? itemById(state.equip[PAIRS[t].a]) : null;
    return isPair(it) ? it : null;
  }
  // Keeps sets in their first slot with the second one empty (used after loading and after editing a piece).
  function fixPairs() {
    Object.keys(PAIRS).forEach((t) => {
      const p = PAIRS[t];
      const ib = itemById(state.equip[p.b]);
      if (isPair(ib)) {
        const prev = state.equip[p.a];
        if (prev && prev !== ib.id) delete state.settled[prev];
        state.equip[p.a] = ib.id;
        delete state.equip[p.b];
      }
      const ia = itemById(state.equip[p.a]);
      if (isPair(ia) && state.equip[p.b]) { delete state.settled[state.equip[p.b]]; delete state.equip[p.b]; }
    });
  }
  const isNum = (v) => typeof v === 'number' && isFinite(v) && v !== 0;
  function validEff(e) {
    if (!e || !EFF_BY[e.k]) return false;
    if (e.k === 'dmg') return isSet(e.dice) && eachDie(e.dice, () => {});
    if (e.k === 'atk' || e.k === 'flat') return isNum(e.v);
    if (e.k === 'def') return isNum(e.v) && !!DEF_NAMES[e.on];
    if (e.k === 'res') return isSet(e.dt);
    return isSet(e.text);
  }

  // Character and game have independent repositories. Keep game load first for
  // migrating pre-website character files that embedded the map.
  try {
    const savedGame = repositories.games.load();
    if (savedGame) game = normalizeGame(savedGame);
  } catch (e) { /* unavailable storage: start blank */ }
  gameSaveBase = normalizeGame(game);
  try {
    const savedCharacter = repositories.characters.load();
    if (savedCharacter) state = Object.assign(blank(), savedCharacter);
  } catch (e) { /* unavailable storage: start blank */ }
  normalizeState();
  // Checks and upgrades saved data (also used when a character file is imported).
  function normalizeState() {
    window.WBResources.normalizeState(state);
    window.WBAbilities.normalizeState(state);
    window.WBStatus.normalizeState(state);
  ['fields', 'over', 'hist', 'rolls', 'alloc', 'equip', 'lvGear', 'settled', 'spent'].forEach((k) => { if (!state[k] || typeof state[k] !== 'object' || Array.isArray(state[k])) state[k] = {}; });
  ['pool', 'items', 'order'].forEach((k) => { if (!Array.isArray(state[k])) state[k] = []; });
  // Stat increases: { level: { STAT: points } }, at most 2 per stat per level up.
  if (!state.asi || typeof state.asi !== 'object' || Array.isArray(state.asi)) state.asi = {};
  Object.keys(state.asi).forEach((L) => {
    const a = state.asi[L];
    if (!ASI_LEVELS.includes(Number(L)) || !a || typeof a !== 'object') { delete state.asi[L]; return; }
    Object.keys(a).forEach((k) => {
      const v = Math.round(Number(a[k]));
      if (!STATS.some((s) => s.k === k) || !(v >= 1)) delete a[k]; else a[k] = Math.min(2, v);
    });
  });
  state.trauma = Math.max(0, Math.floor(Number(state.trauma)) || 0);
  if (!state.down || typeof state.down !== 'object') state.down = null;
  if (!['adv', 'dis', 'norm'].includes(state.advMode)) state.advMode = 'norm';
  // Older drafts: hand-set modifiers, one score per stat, a level table with stored stats, a typed armor value.
  if (state.mods) {
    Object.keys(state.mods).forEach((k) => { if (state.mods[k] != null) state.over['mod-' + k] = state.mods[k]; });
    delete state.mods;
  }
  STATS.forEach((s) => {
    const old = state.fields['score-' + s.k];
    if (isSet(old) && !state.hist[s.k]) state.hist[s.k] = { 1: old };
    delete state.fields['score-' + s.k];
  });
  if (Array.isArray(state.levels)) {
    state.levels.forEach((r, i) => { if (i > 0 && r && isSet(r.roll)) state.rolls[i + 1] = r.roll; });
    delete state.levels;
  }
  ['evasion', 'mpMax', 'speed', 'hitDie', 'hpMax', 'armor'].forEach((id) => { delete state.fields[id]; });
  if (isSet(state.over.apMax)) state.fields.apMax = state.over.apMax;
  delete state.over.apMax;
  // Validate dice and equipment
  state.pool = state.pool.filter((r) => r && typeof r.v === 'number' && Array.isArray(r.d)).slice(0, 8);
  Object.keys(state.alloc).forEach((k) => {
    if (!STATS.some((s) => s.k === k) || !state.pool[state.alloc[k]]) delete state.alloc[k];
  });
  state.items = state.items.filter((it) => it && typeof it.id === 'string' && TYPES[it.type]);
  state.items.forEach((it) => {
    if (!Array.isArray(it.abilities)) it.abilities = [];
    it.abilities = it.abilities.filter((a) => a && (isSet(a.name) || isSet(a.effect)));
    if (!Array.isArray(it.bonuses)) it.bonuses = [];
    it.bonuses = it.bonuses.filter((b) => b && BONUS_BY[b.t] && typeof b.v === 'number' && isFinite(b.v) && b.v !== 0);
    it.effects = (Array.isArray(it.effects) ? it.effects : []).filter(validEff);
    it.abilities.forEach((a) => {
      if (typeof a.uses === 'number' && a.uses >= 1) { a.uses = Math.min(20, Math.round(a.uses)); a.per = a.per === 'round' ? 'round' : 'rest'; }
      else { delete a.uses; delete a.per; }
    });
    if (TYPES[it.type].weapon) {
      it.dmg = isSet(it.dmg) ? String(it.dmg) : '1d6';
      it.stat = it.stat === 'DEX' ? 'DEX' : 'STR';
      // How far it hits on the battlemap, in feet. Older weapons had none, which means the next square (5 ft).
      const rg = Math.round(Number(it.range) / 5) * 5;
      if (isFinite(rg) && rg > 5) it.range = Math.min(1000, rg); else delete it.range;
    }
    if (it.type !== 'shield' || !isSet(it.block) || !eachDie(String(it.block), () => {})) delete it.block;
    if (it.pair !== true || !PAIRS[it.type]) delete it.pair;
  });
  Object.keys(state.equip).forEach((s) => {
    const it = itemById(state.equip[s]);
    if (!it || !fits(it.type, s)) delete state.equip[s];
  });
  { const mw = itemById(state.equip.main); if (mw && mw.type === 'twohand') delete state.equip.off; }
  fixPairs();
  window.WBEquipment.normalizeState(state); // Legacy characters inherit their current worn equipment.
  // Movement this turn: feet moved, feet left over from AP already spent, and Surge AP used.
  const mv = state.move;
  state.move = mv && typeof mv === 'object' ? {
    ft: Math.max(0, Math.round(Number(mv.ft)) || 0),
    left: Math.max(0, Math.round(Number(mv.left)) || 0),
    surge: Math.max(0, Math.min(2, Math.round(Number(mv.surge)) || 0))
  } : null;
  // AP an ally gave you with Command. fresh: received since your last turn started.
  const ag = state.apGiven;
  state.apGiven = ag && typeof ag === 'object' && Number(ag.n) > 0 ? { n: Math.min(5, Math.round(Number(ag.n))), fresh: !!ag.fresh } : null;
  // Every character gets an id, which is how the game knows which token is theirs.
  if (typeof state.id !== 'string' || !/^c[a-z0-9]{4,30}$/.test(state.id)) state.id = newCharId();
  // Sight in the dark (darkvision) and the light you carry, in feet.
  ['darkvision', 'light'].forEach((k) => { const v = Math.round(Number(state.fields[k])); if (state.fields[k] != null && state.fields[k] !== '' && !(v >= 0)) delete state.fields[k]; });
  // Drafts before the website kept the battlemap inside the character. It belongs to the game now:
  // it moves over if this browser's game hasn't been started, and leaves the character either way.
  if (state.map || state.token || state.foes || state.fog) {
    if (!game.map && !game.foes.length) {
      game = normalizeGame({ map: state.map, tokens: state.token ? { [state.id]: state.token } : {}, fog: state.fog, foes: state.foes });
    }
    delete state.map; delete state.token; delete state.foes; delete state.fog;
  }
  Object.keys(state.settled).forEach((id) => { if (!slotOf(id)) delete state.settled[id]; });
  Object.keys(state.spent).forEach((id) => { if (!itemById(id) || !state.spent[id] || typeof state.spent[id] !== 'object') delete state.spent[id]; });
  // Portraits: one per form. Older drafts kept a single portrait.
  if (typeof state.portrait === 'string' && state.portrait) state.portraits = [{ id: 'f1', src: state.portrait, name: '' }];
  delete state.portrait;
  if (!Array.isArray(state.portraits)) state.portraits = [];
  state.portraits = state.portraits.filter((f) => f && typeof f.src === 'string' && /^data:image\//.test(f.src)).map((f, i) => ({
    id: typeof f.id === 'string' && f.id ? f.id : 'f' + (i + 1), src: f.src, name: typeof f.name === 'string' ? f.name.slice(0, 30) : ''
  }));
  const portraitIds = new Set(state.portraits.map(f => f.id));
  state.abilityLoadouts.forEach(form => {
    if (form.portraitId && !portraitIds.has(form.portraitId)) form.portraitId = '';
  });
  if (!state.portraits.some((f) => f.id === state.formId)) state.formId = state.portraits.length ? state.portraits[0].id : null;
  }

  const statusEl = $('#saveStatus');
  const DEFAULT_STATUS = 'Saves automatically in this browser.';
  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', !!isError);
  }
  let saveTimer = null;
  function save() {
    window.WBEquipment.capture(state); // Save the currently worn slots in this form's profile.
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        repositories.characters.save(state);
        const localGame = normalizeGame(game);
        if (JSON.stringify(localGame) !== JSON.stringify(gameSaveBase)) {
          const savedGame = repositories.games.load();
          const latestGame = savedGame ? normalizeGame(savedGame) : blankGame();
          game = normalizeGame(window.WBPersistence.mergeGameChanges(gameSaveBase, localGame, latestGame));
          repositories.games.save(game);
          gameSaveBase = normalizeGame(game);
        }
        setStatus(DEFAULT_STATUS);
      } catch (e) {
        setStatus("This browser won't save the sheet. Your entries stay until you close the page.", true);
      }
    }, 250);
  }

  // Build the eight attribute tiles
  const msItem = (at, name, desc) =>
    '<li data-at="' + at + '"><button type="button" class="ms-btn has-tip" aria-expanded="false" aria-label="' + esc(name + ', at ' + at + ': ' + desc) + '">' +
      '<span class="ms-gem"></span><span class="ms-at">' + at + '</span><span class="ms-name">' + name + '</span>' +
      '<span class="pop" role="tooltip"><b>' + name + '</b>' + esc(desc) + '</span>' +
    '</button></li>';
  const grids = { phys: $('#physGrid'), ment: $('#mentGrid') };
  STATS.forEach((s) => {
    const el = document.createElement('div');
    el.className = 'stat';
    el.id = 'stat-' + s.k;
    el.dataset.drop = 'stat';
    el.dataset.stat = s.k;
    el.innerHTML =
      '<div class="stat-head"><button type="button" class="abbr roll-stat" data-stat="' + s.k + '" aria-label="Roll ' + s.n + '">' + s.k + D20_SVG + '</button><span class="stat-name">' + s.n + '</span></div>' +
      '<div class="stat-body">' +
        '<div class="cell"><input class="score" id="score-' + s.k + '" data-stat="' + s.k + '" type="number" inputmode="numeric" min="0" placeholder="12" aria-label="' + s.n + ' score" autocomplete="off"><span class="cap">Score</span><span class="gear" id="gear-' + s.k + '" hidden></span></div>' +
        '<div class="cell"><div class="mod octagon"><input class="mod-input" id="mod-' + s.k + '" data-auto type="text" inputmode="numeric" placeholder="+0" aria-label="' + s.n + ' modifier" autocomplete="off"></div><span class="cap">Mod</span></div>' +
      '</div>' +
      '<div class="asi-row">' +
        '<button type="button" class="xbtn asi-minus" data-stat="' + s.k + '" aria-label="Take a point off ' + s.n + '">\u2212</button>' +
        '<span class="asi-got" id="asiGot-' + s.k + '" aria-live="polite"></span>' +
        '<button type="button" class="xbtn asi-plus" data-stat="' + s.k + '" aria-label="Add a point to ' + s.n + '">+</button>' +
      '</div>' +
      '<ul class="milestones" aria-label="' + s.n + ' milestones">' +
        msItem(21, s.m[0], MS_DESC[s.k][0]) +
        msItem(28, s.m[1], MS_DESC[s.k][1]) +
      '</ul>';
    grids[s.g].appendChild(el);
  });

  // Levels and per-level scores.
  // Each stat keeps a value for every level it was set at. A level uses the latest value
  // at or below it; levels before the first value use that first value.
  const level = () => window.WBCombat.level(state);
  const keyAt = (k, n) => window.WBCombat.keyAt(state, k, n);
  const rawAt = (k, n) => window.WBCombat.rawAt(state, k, n);
  const hasScore = (k) => rawAt(k, 1) != null;
  // Points spent at levels 4, 8, 12, 16 and 19 count from that level on.
  const asiSum = (k, n) => window.WBCombat.asiSum(state, k, n);
  const scoreAt = (k, n) => window.WBCombat.scoreAt(state, k, n);
  const baseScore = (k) => scoreAt(k, level());
  // Your score right now: your own score plus whatever your worn equipment adds.
  // Advancement (Health and Mana per level) always uses your own score, never gear.
  const score = (k) => window.WBCombat.effectiveScore(state, k, level(),
    window.WBAbilities.effectBonus(state, 'stat', k),
    window.WBAbilities.formStatBonus(state, k));
  const scoreOr12 = (k) => { const s = score(k); return s == null ? 12 : s; };
  function setLevel(n) {
    n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(n) || 1));
    const old = level();
    if (n < old) {
      // Going down a level undoes everything above it.
      Object.keys(state.hist).forEach((k) => {
        const h = state.hist[k];
        const keep = rawAt(k, n);
        Object.keys(h).forEach((key) => { if (Number(key) > n) delete h[key]; });
        if (keep != null && rawAt(k, n) == null) h[1] = keep;
      });
      Object.keys(state.rolls).forEach((key) => { if (Number(key) > n) delete state.rolls[key]; });
      Object.keys(state.lvGear).forEach((key) => { if (Number(key) > n) delete state.lvGear[key]; });
      Object.keys(state.asi).forEach((key) => { if (Number(key) > n) delete state.asi[key]; });
    } else if (n > old) {
      // Gear you've worn through a long rest counts toward that level's Health and Mana.
      const snap = {};
      ['VIT', 'INT', 'FTH'].forEach((k) => { const g = gearSettled(k); if (g) snap[k] = g; });
      for (let lv = old + 1; lv <= n; lv++) {
        if (Object.keys(snap).length) state.lvGear[lv] = Object.assign({}, snap); else delete state.lvGear[lv];
      }
    }
    state.fields.level = String(n);
  }
  // A score set by typing or by a rolled result goes on your current level,
  // except a stat's very first value, which goes on level 1 so it counts for every level.
  function writeScore(k, v) {
    if (!state.hist[k]) state.hist[k] = {};
    // Stored without stat increases, which are added back on top.
    state.hist[k][hasScore(k) ? level() : 1] = String(v - asiSum(k, level()));
  }
  function clearScoreIfEqual(k, v) {
    const key = keyAt(k, level());
    if (key != null && scoreAt(k, level()) === v) delete state.hist[k][key];
  }

  // Rules
  const fmt = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);
  const autoMod = (k, s) => window.WBCombat.autoMod(k, s);
  const mod = (k) => window.WBCombat.modifier(state, k, level(),
    window.WBAbilities.effectBonus(state, 'stat', k),
    window.WBAbilities.formStatBonus(state, k));
  const kind = () => (state.fields.manaKind === 'holy' ? 'holy' : 'mana');
  const msStat = () => (kind() === 'holy' ? 'FTH' : 'INT');
  function manaPerLevel(s) {
    if (s >= 28) return 18;
    if (s >= 25) return 14;
    if (s >= 22) return 12;
    if (s >= 19) return 10;
    if (s >= 16) return 8;
    if (s >= 13) return 6;
    return 0;
  }
  function hitDieFor(s) {
    if (s >= 46) return '2d12+1d8';
    if (s >= 43) return '2d12+1d6';
    if (s >= 40) return '2d12+1d4';
    if (s >= 37) return '2d12';
    if (s >= 34) return '1d12+1d10';
    if (s >= 31) return '1d12+1d8';
    if (s >= 28) return '1d12+1d6';
    if (s >= 25) return '1d12+1d4';
    if (s >= 22) return '1d12';
    if (s >= 19) return '1d10';
    if (s >= 16) return '1d8';
    if (s >= 12) return '1d6';
    return '1d4';
  }
  const rowDie = (vit) => (isSet(state.over.hitDie) ? String(state.over.hitDie) : hitDieFor(vit));
  function eachDie(str, fn) {
    let found = false;
    String(str || '').replace(/(\d*)\s*d\s*(\d+)/gi, (m, c, sides) => {
      const count = Number(c) || 1;
      const n = Number(sides);
      if (n > 0) { found = true; fn(count, n); }
      return m;
    });
    return found;
  }
  function diceMax(str) {
    let total = 0;
    return eachDie(str, (c, n) => { total += c * n; }) ? total : 0;
  }
  function randInt(n) {
    try {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] % n;
    } catch (e) {
      return Math.floor(Math.random() * n);
    }
  }
  function rollDice(str) {
    let total = 0;
    const ok = eachDie(str, (c, n) => { for (let i = 0; i < c; i++) total += 1 + randInt(n); });
    return ok ? total : null;
  }
  const listJoin = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  // Milestones count your score as it is right now, gear included.
  const reached = (k, at) => { const s = score(k); return s != null && s >= at; };
  // Adamantine Body (VIT 28): Armor Rating uses half your VIT instead of your VIT mod.
  const adamantine = () => reached('VIT', 28);
  const vitArmor = () => (adamantine() ? Math.floor((score('VIT') || 0) / 2) : mod('VIT'));
  // Gear effects. Everything worn counts for defenses and resistances; an attack uses its own weapon's
  // effects plus those of anything worn that isn't a weapon.
  function wornItems() { return SLOTS.map((s) => itemById(state.equip[s.k])).filter(Boolean); }
  function allEffects() { const out = []; wornItems().forEach((it) => (it.effects || []).forEach((e) => out.push(e))); return out; }
  function effectsFor(w) {
    const out = [];
    wornItems().forEach((it) => { if (it === w || !TYPES[it.type].weapon) (it.effects || []).forEach((e) => out.push(e)); });
    return out;
  }
  const sumEff = (list, k, on) => list.reduce((t, e) => t + (e.k === k && (!on || e.on === 'all' || e.on === on) ? e.v : 0), 0);
  const defBonus = (type) => sumEff(allEffects(), 'def', type);
  const atkMod = (w) => mod(w.stat) + sumEff(effectsFor(w), 'atk');
  function resistances() {
    const r = [];
    allEffects().forEach((e) => { if (e.k === 'res' && !r.some((x) => x.toLowerCase() === e.dt.toLowerCase())) r.push(e.dt); });
    return r;
  }
  const resists = (dt) => !!dt && resistances().some((x) => x.toLowerCase() === dt.toLowerCase());
  const armorTotal = () => window.WBCombat.gearArmor(state);
  const gear = (k) => window.WBCombat.gearBonus(state, k);
  const gearSettled = (k) => window.WBCombat.gearBonus(state, k, true);
  const gearNote = (k) => { const g = gear(k); return g ? ', ' + sgn(g) + ' gear' : ''; };
  const poolGearNote = (k) => { const g = gear(k); return g ? ' · ' + sgn(g) + ' from gear' : ''; };
  const pointsBy = (L) => 4 * ASI_LEVELS.filter((x) => x <= L).length;

  // Advancement: Health and Mana built level by level from the scores each level had.
  function computeLog() {
    const L = level();
    const ms = msStat();
    const rows = [];
    const missing = [];
    let hp = 0;
    let mp = 0;
    for (let n = 1; n <= L; n++) {
      const lg = state.lvGear[n] || {};
      const vb = scoreAt('VIT', n);
      const mb = scoreAt(ms, n);
      const vit = vb == null ? null : vb + (lg.VIT || 0);
      const msv = mb == null ? null : mb + (lg[ms] || 0);
      const health = window.WBCombat.healthAtLevel(state, n, vit);
      const die = health.die, dieMax = health.dieMax, gain = health.gain;
      if (vit != null) {
        if (gain == null) missing.push(n); else hp += gain;
      }
      let mgain = null;
      if (msv != null) {
        mgain = n === 1 ? Math.max(0, (msv - 12) * 3) : manaPerLevel(msv);
        mp += mgain;
      }
      rows.push({ n, vit, msv, die, dieMax, gain, mgain, vg: vb == null ? 0 : (lg.VIT || 0), mg: mb == null ? 0 : (lg[ms] || 0) });
    }
    return { rows, hp: hasScore('VIT') ? hp : null, mp: hasScore(ms) ? mp : null, missing };
  }
  let log = { rows: [], hp: null, mp: null, missing: [] };

  const AUTO = {
    hpMax: () => (log.hp == null ? '' : log.hp + gear('hp')),
    mpMax: () => (log.mp == null ? '' : log.mp + gear(kind() === 'holy' ? 'holy' : 'mp')),
    hitDie: () => { const v = score('VIT'); return v == null ? '' : hitDieFor(v); },
    evasion: () => 10 + mod('AGL') + gear('ev') + window.WBAbilities.effectBonus(state, 'evasion'),
    armor: () => Math.max(0, armorTotal() + vitArmor() + window.WBAbilities.effectBonus(state, 'armor')),
    init: () => fmt(mod('WIS') + gear('init')),
    speed: () => Math.max(0, Math.max(5, 5 * (1 + mod('AGL'))) + gear('move')),
    reactMax: () => 1 + (reached('AGL', 21) ? 1 : 0) + (reached('AGL', 28) ? 1 : 0),
    wonderMax: () => Math.max(0, mod('FTH'))
  };
  STATS.forEach((s) => {
    AUTO['mod-' + s.k] = () => { const sc = score(s.k); return sc == null ? '' : fmt(autoMod(s.k, sc)); };
  });

  // Pools
  function updatePool(p) {
    const c = num($('#' + p + 'Cur').value);
    const m = num($('#' + p + 'Max').value);
    const bar = $('#' + p + 'Bar');
    if (isNaN(m) || m <= 0) {
      bar.style.width = '100%';
      bar.classList.add('idle');
      return;
    }
    const v = isNaN(c) ? m : c;
    bar.style.width = Math.max(0, Math.min(100, (v / m) * 100)) + '%';
    bar.classList.remove('idle');
  }
  const manaPool = $('#manaPool');
  const resourceManager = window.WBResources.init(() => state, save);
  const formEntryControls = {
    getAp: () => apHave(),
    spendAp: (cost) => spendAp(cost),
    getMana: () => {
      const current = $('#mpCur').value;
      const maximum = Number($('#mpMax').value);
      if (!Number.isFinite(maximum) || maximum <= 0) return null;
      return current === '' ? maximum : Math.max(0, Number(current) || 0);
    },
    spendMana: (cost) => {
      const current = $('#mpCur').value;
      const maximum = Math.max(0, Number($('#mpMax').value) || 0);
      state.fields.mpCur = String(Math.max(0, (current === '' ? maximum : Number(current) || 0) - cost));
      $('#mpCur').value = state.fields.mpCur;
    },
    refresh: () => refreshAll()
  };
  const abilityLibrary = window.WBAbilities.init(() => state, save, formEntryControls);
  const statusManager = window.WBStatus.init(() => state, save, { refresh: () => refreshAll() });
  function updateManaKind() {
    const holy = kind() === 'holy';
    const label = holy ? 'Holy Power' : 'Mana';
    manaPool.classList.toggle('holy', holy);
    $('#manaName').textContent = label;
    $('#mpCur').setAttribute('aria-label', 'Current ' + label.toLowerCase());
    $('#mpMax').setAttribute('aria-label', 'Maximum ' + label.toLowerCase());
    manaPool.querySelectorAll('.seg button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.kind === kind()));
    });
  }
  manaPool.querySelector('.seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-kind]');
    if (!b) return;
    state.fields.manaKind = b.dataset.kind;
    refreshAll();
    save();
  });

  // Pip trackers (Action Points, Reactions, Wonder)
  function makeTracker(o) {
    const t = {
      max() {
        return window.WBCombat.trackerMax(o.maxEl.value, o.maxEl.placeholder);
      },
      avail() {
        const m = t.max();
        const a = state[o.key];
        return window.WBCombat.trackerAvailable(a, m);
      },
      render() {
        const m = t.max();
        if (o.pips.children.length !== m) {
          o.pips.innerHTML = '';
          for (let i = 0; i < m; i++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'pip' + (o.shape ? ' ' + o.shape : '');
            b.dataset.i = String(i);
            o.pips.appendChild(b);
          }
        }
        const a = t.avail();
        Array.from(o.pips.children).forEach((b, i) => {
          const on = i < a;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', String(on));
          b.setAttribute('aria-label', o.noun + ' ' + (i + 1) + ': ' + (on ? 'ready' : 'spent'));
        });
        o.count.textContent = o.format(a, m);
      }
    };
    o.pips.addEventListener('click', (e) => {
      const b = e.target.closest('.pip');
      if (!b) return;
      const i = Number(b.dataset.i);
      const a = t.avail();
      state[o.key] = i < a ? i : i + 1;
      t.render();
      if (o.after) o.after();
      save();
    });
    return t;
  }
  const apTracker = makeTracker({
    key: 'apAvail', maxEl: $('#apMax'), pips: $('#apPips'), count: $('#apCount'), noun: 'Action point', after: () => renderMove(),
    format: (a, m) => (m ? a + '/' + m + ' AP' : 'No AP') + (givenAp() ? ' + ' + givenAp() + ' given' : '')
  });
  const reactTracker = makeTracker({
    key: 'reactAvail', maxEl: $('#reactMax'), pips: $('#reactPips'), count: $('#reactCount'), noun: 'Reaction', shape: 'ring',
    format: (a, m) => a + '/' + m + (m === 1 ? ' reaction' : ' reactions')
  });
  const wonderTracker = makeTracker({
    key: 'wonderAvail', maxEl: $('#wonderMax'), pips: $('#wonderPips'), count: $('#wonderCount'), noun: 'Wonder use', shape: 'star',
    format: (a, m) => (m ? a + ' of ' + m + ' ready' : 'No uses until FTH reaches 13')
  });
  const trackers = [apTracker, reactTracker, wonderTracker];

  // ---------- Spending AP ----------
  // AP an ally gave you with Command sits on top of your own (it can go past your max), is spent first,
  // and lasts until it's used or your next turn is over.
  const givenAp = () => window.WBCombat.givenAp(state);
  function setGiven(n) { state.apGiven = { n: Math.max(0, Math.min(40, Math.round(n))), fresh: state.apGiven ? !!state.apGiven.fresh : true }; }
  const apHave = () => window.WBCombat.apAvailable(state, apTracker.avail());
  function spendAp(cost) {
    Object.assign(state, window.WBCombat.spendAp(state, apTracker.avail(), cost));
  }
  // Getting AP back (an attack that turns out to be an opportunity attack) refills your own first.
  function refundAp(n) {
    Object.assign(state, window.WBCombat.refundAp(state, apTracker.avail(), apTracker.max(), n));
  }
  // One undo for the last Move, Command or Receive.
  let apUndo = null;
  function snapAp(label) { apUndo = { label, data: JSON.stringify({ apAvail: state.apAvail, apGiven: state.apGiven, move: state.move, token: myTok() }) }; }
  function undoAp() {
    if (!apUndo) return;
    const snap = JSON.parse(apUndo.data);
    setTok(snap.token);
    delete snap.token;
    Object.assign(state, snap);
    apUndo = null;
    refreshAll();
    save();
    toastEl.hidden = true;
  }
  const leftText = () => apHave() + ' AP left' + (givenAp() ? ' (' + givenAp() + ' given)' : '');

  // Given AP: its own pips under your AP. Tap one to spend down to it.
  function renderGiven() {
    const g = givenAp();
    const row = $('#givenRow');
    row.hidden = !g;
    const pips = $('#givenPips');
    let h = '';
    for (let i = 0; i < g; i++) h += '<button type="button" class="pip on given" data-i="' + i + '" aria-label="Given AP ' + (i + 1) + '. Tap to spend it."></button>';
    pips.innerHTML = h;
    if (g) $('#givenTxt').textContent = state.apGiven.fresh ? 'For your next turn. Spent before your own AP.' : 'Use it this turn. Spent before your own AP.';
  }
  $('#givenPips').addEventListener('click', (e) => {
    const b = e.target.closest('.pip');
    if (!b) return;
    setGiven(Number(b.dataset.i));
    if (!givenAp()) state.apGiven = null;
    refreshAll();
    save();
  });

  // ---------- Movement ----------
  // Each AP moves you your Movement in feet. Feet left over from an AP you've started stay yours for the rest of the turn.
  // Surge (AGL 21) gives 2 AP of movement for free each turn, used before your own AP.
  // Effective speed is derived from the base/manual movement field and active ability
  // effects; do not write the temporary effect into a field or gear totals.
  const speedBase = () => {
    const v = num(state.over.speed != null ? state.over.speed : AUTO.speed());
    return isNaN(v) ? 0 : v;
  };
  const speedNow = () => window.WBAbilities.effectiveMovement(state, speedBase());
  const surgeOn = () => reached('AGL', 21);
  const moveNow = () => state.move || { ft: 0, left: 0, surge: 0 };
  const surgeLeft = () => (surgeOn() ? Math.max(0, 2 - moveNow().surge) : 0);
  const movePlan = (ft) => window.WBCombat.movePlan(ft, speedNow(), moveNow(), surgeLeft());
  function planText(p) {
    const parts = [];
    if (p.fromLeft) parts.push(p.fromLeft + ' ft left over');
    if (p.free) parts.push(p.free + ' free Surge AP');
    if (p.paid) parts.push(p.paid + ' AP');
    return parts.length ? parts.join(' + ') : 'nothing';
  }
  function renderMove() {
    const sp = speedNow();
    const m = moveNow();
    $('#moveRule').textContent = sp ? sp + ' ft for each AP' + (surgeOn() ? ', and Surge gives 2 AP of movement free each turn.' : '.') : 'Your Movement is 0, so you can’t move.';
    $('#moveDone').textContent = m.ft ? m.ft + ' ft this turn' : 'Not moved yet';
    const sRow = $('#surgeRow');
    sRow.hidden = !surgeOn();
    if (surgeOn()) {
      const sl = surgeLeft();
      $('#surgePips').innerHTML = [0, 1].map((i) => '<button type="button" class="pip free' + (i < sl ? ' on' : '') + '" data-i="' + i + '" aria-pressed="' + (i < sl) + '" aria-label="Surge AP ' + (i + 1) + ': ' + (i < sl ? 'ready' : 'used') + '"></button>').join('');
      $('#surgeTxt').textContent = sl ? sl + ' free AP left: ' + (sl * sp) + ' ft' : 'Used this turn';
    }
    const lf = $('#moveLeft');
    lf.hidden = !m.left;
    lf.textContent = m.left + ' ft left from AP you’ve already spent';
    const ft = num($('#moveFt').value);
    const out = $('#movePlan');
    if (isNaN(ft) || ft <= 0) { out.textContent = sp ? 'Enter how far you’re moving. A square on the map is 5 ft.' : ''; return; }
    const p = movePlan(Math.round(ft));
    if (!sp && p.fromLeft < p.ft) { out.textContent = 'You can only move the ' + m.left + ' ft you have left over.'; return; }
    out.textContent = p.ft + ' ft costs ' + planText(p) + (p.paid > apHave() ? '. You have ' + apHave() + ' AP.' : p.leftAfter ? ', with ' + p.leftAfter + ' ft left over.' : '.');
  }
  // Pays for a move (shared by the Movement panel and the battlemap). Returns the plan, or null with a notice if you can't.
  function spendMove(ft) {
    const p = movePlan(ft);
    if (!p.sp && p.fromLeft < p.ft) { showRoll({ kind: 'notice', title: 'Move', math: 'Your Movement is 0, so you can only use the ' + moveNow().left + ' ft you have left over.' }); return null; }
    if (p.paid > apHave()) {
      showRoll({ kind: 'notice', title: 'Move ' + ft + ' ft', math: 'That costs ' + planText(p) + ' and you have ' + apHave() + ' AP left.', note: 'You can go ' + maxMove() + ' ft right now.' });
      return null;
    }
    snapAp('move');
    spendAp(p.paid);
    const m = moveNow();
    state.move = window.WBCombat.movementAfter(m, ft, p);
    return p;
  }
  function moveToast(ft, p, where) {
    showRoll({ kind: 'notice', title: 'Moved ' + ft + ' ft' + (where ? ' to ' + where : ''), math: 'Used ' + planText(p) + '. ' + leftText() + '.', note: p.leftAfter ? p.leftAfter + ' ft left over for this turn' : undefined, acts: [['undoap', 'Undo']] });
  }
  function doMove() {
    const el = $('#moveFt');
    const ft = Math.round(num(el.value));
    if (isNaN(ft) || ft <= 0) { el.focus(); return; }
    const p = spendMove(ft);
    if (!p) return;
    el.value = '';
    refreshAll();
    save();
    moveToast(ft, p);
  }
  // The farthest you can go right now with what's left.
  function maxMove() { return moveNow().left + (surgeLeft() + apHave()) * speedNow(); }
  $('#moveFt').addEventListener('input', renderMove);
  $('#moveFt').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doMove(); } });
  $('#moveBtn').addEventListener('click', doMove);
  $('#surgePips').addEventListener('click', (e) => {
    const b = e.target.closest('.pip');
    if (!b) return;
    const i = Number(b.dataset.i);
    const sl = surgeLeft();
    const m = moveNow();
    state.move = { ft: m.ft, left: m.left, surge: 2 - (i < sl ? i : i + 1) };
    refreshAll();
    save();
  });

  // ---------- Command ----------
  // Spend 5 AP to give an ally 2 + CHA mod AP, up to 5. CHA doesn't lower its cost.
  const CMD_COST = 5;
  const cmdGives = () => Math.max(0, Math.min(5, 2 + mod('CHA')));
  function renderCommand() {
    const g = cmdGives();
    $('#cmdSrc').textContent = CMD_COST + ' AP · they get 2 + CHA mod, up to 5: ' + (g ? g + ' AP' : 'nothing at your CHA');
  }
  $('#cmdBtn').addEventListener('click', () => {
    const g = cmdGives();
    const have = apHave();
    if (!g) { showRoll({ kind: 'notice', title: 'Command', math: 'With a CHA mod of ' + fmt(mod('CHA')) + ', Command gives your ally no AP.' }); return; }
    if (have < CMD_COST) { showRoll({ kind: 'notice', title: 'Command', math: 'Command costs ' + CMD_COST + ' AP and you have ' + have + ' left.' }); return; }
    snapAp('command');
    spendAp(CMD_COST);
    refreshAll();
    save();
    showRoll({ kind: 'notice', title: 'Command', total: g, math: 'Spent ' + CMD_COST + ' AP. Your ally gets ' + g + ' AP: 2, plus your CHA mod of ' + fmt(mod('CHA')) + (2 + mod('CHA') > 5 ? ', capped at 5' : '') + '.', note: 'They add it with Receive on their sheet and use it on their turn. ' + leftText() + '.', acts: [['undoap', 'Undo']] });
  });
  // When an ally Commands you: up to 5 AP, used on your turn. Like temporary Health, Commands don't stack:
  // a new one only replaces what you're holding if it's higher. AP held from before your last turn has lapsed.
  $('#getBtn').addEventListener('click', () => {
    const el = $('#getAmt');
    const n = Math.round(num(el.value));
    if (isNaN(n) || n < 1) { el.focus(); return; }
    const amt = Math.min(5, n);
    const held = state.apGiven && state.apGiven.fresh ? givenAp() : 0;
    el.value = '';
    if (held >= amt) {
      showRoll({ kind: 'notice', title: 'Commanded', math: 'You already hold ' + held + ' AP from a Command. Commands don’t stack, so you keep the higher one.' });
      return;
    }
    snapAp('receive');
    state.apGiven = { n: amt, fresh: true };
    refreshAll();
    save();
    showRoll({ kind: 'notice', title: 'Commanded', total: amt, math: 'Got ' + amt + ' AP from an ally' + (n > 5 ? ' (a Command gives at most 5)' : '') + (held ? ', replacing the ' + held + ' you held' : '') + '.', note: 'Use it on your next turn. It’s spent before your own AP.', acts: [['undoap', 'Undo']] });
  });
  $('#getAmt').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#getBtn').click(); } });

  $('#turnReset').addEventListener('click', () => {
    state.apAvail = null;
    state.reactAvail = null;
    state.parryUsed = false;
    state.move = null;
    apUndo = null;
    mapNote = '';
    // Given AP carries into the turn after you got it, then it's gone.
    if (state.apGiven && state.apGiven.fresh && state.apGiven.n > 0) state.apGiven = { n: state.apGiven.n, fresh: false };
    else state.apGiven = null;
    // Per-round item abilities come back too.
    Object.keys(state.spent).forEach((id) => {
      const it = itemById(id);
      Object.keys(state.spent[id] || {}).forEach((i) => { const a = it && it.abilities[i]; if (!a || a.per === 'round') delete state.spent[id][i]; });
    });
    apTracker.render();
    reactTracker.render();
    renderGiven();
    renderMove();
    renderDefense();
    renderEquip();
    renderMap();
    save();
    const oldResourceMaxima=resourceManager.maxima();
    resourceManager.turnStart();
    abilityLibrary.turnStart();
    resourceManager.reconcileMaximums(oldResourceMaxima);
    statusManager.turnStart();
    refreshAll(); // Update movement and the battlemap after timed effects expire.
    // Bleeding out: 4 at the start of each of your turns while at 0 or below, until stabilized.
    const h = hpNow();
    if (h != null && h <= 0 && !(state.down && state.down.stable) && !isDead()) applyDamage(4, { bleed: true });
  });

  // Long rest: refill every resource and lock in worn gear, with an undo.
  let restUndo = null;
  function undoRest() {
    if (!restUndo) return;
    Object.assign(state, JSON.parse(restUndo.other));
    state.fields.hpCur = restUndo.hpCur;
    state.fields.mpCur = restUndo.mpCur;
    restUndo = null;
    fillInputs();
    resourceManager.render();
    refreshAll();
    save();
    toastEl.hidden = true;
  }
  $('#longRest').addEventListener('click', () => {
    restUndo = {
      hpCur: state.fields.hpCur, mpCur: state.fields.mpCur,
      other: JSON.stringify({ abilities: state.abilities, resources: state.resources, wonderAvail: state.wonderAvail, apAvail: state.apAvail, reactAvail: state.reactAvail, apGiven: state.apGiven, move: state.move, parryUsed: !!state.parryUsed, settled: state.settled, spent: state.spent, trauma: state.trauma, down: state.down })
    };
    resourceManager.longRest();
    abilityLibrary.longRest();
    const hpMax = $('#hpMax').value;
    const mpMax = $('#mpMax').value;
    if (hpMax !== '') state.fields.hpCur = hpMax;
    if (mpMax !== '') state.fields.mpCur = mpMax;
    state.wonderAvail = null;
    state.apAvail = null;
    state.reactAvail = null;
    state.apGiven = null;
    state.move = null;
    apUndo = null;
    state.parryUsed = false;
    state.spent = {};
    state.trauma = 0;
    state.down = null;
    // Everything worn through this rest now counts toward your next level-up.
    state.settled = Object.assign({}, state.settled);
    SLOTS.forEach((s) => { if (state.equip[s.k]) state.settled[state.equip[s.k]] = true; });
    fillInputs();
    refreshAll();
    save();
    showRoll({ kind: 'notice', title: 'Long rest', math: 'Health, ' + (kind() === 'holy' ? 'Holy Power' : 'Mana') + ', Wonder, AP, reactions and item uses are full, and Trauma is cleared.', acts: [['undo', 'Undo']] });
  });

  // Defenses: Block, Dodge and Parry each use a reaction.
  // A weapon or shield in hand counts for Parry. Block also takes arm guards, just not bare skin or clothes.
  function hasWeaponInHand() { return !!(itemById(state.equip.main) || itemById(state.equip.off)); }
  function canBlock() { return hasWeaponInHand() || !!(itemById(state.equip.rarm) || itemById(state.equip.larm)); }
  // Block rolls 1d4 + STR mod. A shield in the off hand replaces the 1d4 with its own Block die
  // and lets you block for anyone you could reach with 1 AP of movement.
  const BASE_BLOCK = '1d4';
  function shieldInHand() { const sh = itemById(state.equip.off); return sh && sh.type === 'shield' ? sh : null; }
  function blockDie() { const sh = shieldInHand(); return sh && isSet(sh.block) ? sh.block : BASE_BLOCK; }
  const armorNow = () => { const v = num($('#armor').value); return isNaN(v) ? 0 : Math.max(0, v); };
  const canGuard = () => !!shieldInHand() || (reached('DEX', 21) && hasWeaponInHand());
  function incoming() {
    const a = num($('#incAtk').value);
    const d = num($('#incDmg').value);
    const dt = $('#incType').value.trim();
    const ally = canGuard() && $('#incAlly').checked;
    const area = $('#incArea').checked;
    // An attack that rolled a natural 20 always hits and can't be dodged, but it can still be blocked or parried.
    const nat = !area && $('#incNat').checked;
    return { vs: isNaN(a) ? null : a, dmg: isNaN(d) ? null : Math.max(0, Math.round(d)), area, nat, of: $('#incOF').checked, dt, ally, noAr: $('#incNoAr').checked, res: !ally && resists(dt) };
  }
  // Damage for an ally is entered after their own Armor Rating, so yours never comes off it.
  const arFor = (inc) => (inc.ally || inc.noAr ? 0 : armorNow());
  // Overwhelming Force: nothing but a successful dodge brings the damage below half.
  const ofFloor = window.WBCombat.overwhelmFloor;
  // The exact resistance / armor / overwhelming force order lives in the
  // shared combat rules, not in the DOM defense panel.
  const resisted = window.WBCombat.resistedDamage;
  const afterArmor = window.WBCombat.afterArmor;
  function setGear(sel, v) { const el = $(sel); el.hidden = !v; el.textContent = v ? sgn(v) + ' gear' : ''; }
  function clearIncoming() {
    ['#incAtk', '#incDmg', '#incType'].forEach((sel) => { $(sel).value = ''; });
    ['#incArea', '#incNat', '#incOF', '#incNoAr', '#incAlly'].forEach((sel) => { $(sel).checked = false; });
    renderDefense();
  }
  function renderDefense() {
    const guard = canGuard();
    $('#incAllyLab').hidden = !guard;
    if (!guard) $('#incAlly').checked = false;
    const inc = incoming();
    const ar = arFor(inc);
    const after = afterArmor(Object.assign({ ar }, inc));
    const rl = resistances();
    let msg;
    if (inc.ally) {
      msg = after == null
        ? 'Enter the damage left after their Armor Rating, then Block' + (shieldInHand() ? '' : ' (needs a shield)') + ' or Parry for them.'
        : 'They’d take ' + after + '. Block or Parry to protect them.';
    } else if (after == null) {
      msg = (inc.noAr ? 'Your Armor Rating won’t come off this one.' : 'Your Armor Rating (' + armorNow() + ') comes off every hit.') + (rl.length ? ' You resist ' + listJoin(rl) + '.' : '');
    } else {
      const how = [];
      if (inc.res) how.push('halved for your ' + inc.dt + ' resistance');
      if (!inc.noAr) how.push('minus your Armor Rating (' + armorNow() + ')');
      msg = 'You’d take ' + after + (how.length ? ': ' + listJoin(how) : '') + '.';
    }
    $('#incAfter').textContent = msg;
    $('#takeHit').disabled = inc.ally;
    $('#incAtkLab').textContent = inc.area ? 'Save DC' : 'Their attack roll';
    $('#blockNum').textContent = blockDie() + modText(mod('STR') + defBonus('block'));
    setGear('#blockGear', defBonus('block'));
    setGear('#dodgeGear', defBonus('dodge'));
    setGear('#parryGear', defBonus('parry'));
    const blockOk = canBlock() && (!inc.ally || !!shieldInHand());
    $('#defBlock').classList.toggle('ready', blockOk);
    $('#blockBtn').disabled = !blockOk;
    $('#blockRel').hidden = blockOk && !shieldInHand();
    $('#blockRel').textContent = !canBlock()
      ? 'Put on arm guards or hold a weapon or shield. Bare skin and clothes can’t block.'
      : !blockOk ? 'Blocking for an ally takes a shield.'
      : 'Your shield’s Block die is ' + blockDie() + '. You can also block for anyone within ' + (num($('#speed').value) || 5) + ' ft (1 AP of movement).';
    $('#incNatLab').hidden = inc.area;
    const dodgeBtn = $('#defDodge [data-def]');
    dodgeBtn.disabled = inc.ally || inc.nat;
    $('#defDodge').classList.toggle('ready', !inc.ally && !inc.nat);
    $('#dodgeRel').hidden = !inc.nat;
    $('#dodgeNum').textContent = fmt(mod('AGL') + defBonus('dodge'));
    const dex = score('DEX');
    const ready = reached('DEX', 21);
    const armed = hasWeaponInHand();
    $('#parryNum').textContent = fmt(mod('DEX') + defBonus('parry'));
    $('#defParry').classList.toggle('ready', ready && armed);
    const btn = $('#parryBtn');
    btn.disabled = !ready || !armed || !!state.parryUsed;
    btn.textContent = state.parryUsed ? 'Used this round' : 'Parry';
    const reach = num($('#speed').value);
    $('#parryRel').textContent = !ready
      ? 'Unlocks at DEX 21' + (dex != null ? ' (yours is ' + dex + ').' : '.')
      : !armed
        ? 'Put a weapon or shield in your hand to parry.'
        : 'Reach: anyone within ' + (isNaN(reach) ? 5 : reach) + ' ft (1 AP of movement). You move in front of the attack. Ready again at the start of your turn.';
  }
  $('#incoming').addEventListener('input', renderDefense);
  $('#incoming').addEventListener('change', renderDefense);
  // Taking a hit without defending uses no reaction.
  $('#takeHit').addEventListener('click', () => {
    const inc = incoming();
    if (inc.ally) return;
    if (inc.dmg == null) { $('#incDmg').focus(); return; }
    const after = afterArmor(Object.assign({ ar: arFor(inc) }, inc));
    clearIncoming();
    applyDamage(after);
  });
  $('#goDamage').addEventListener('click', () => {
    $('#incoming').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    $('#incDmg').focus({ preventScroll: true });
  });
  function spendReaction() {
    state.reactAvail = Math.max(0, reactTracker.avail() - 1);
    reactTracker.render();
    renderDefense();
    save();
  }
  function useDefense(type) {
    const name = type.charAt(0).toUpperCase() + type.slice(1);
    const inc = incoming();
    if (type === 'parry' && state.parryUsed) return;
    if (type === 'block' && (!canBlock() || (inc.ally && !shieldInHand()))) return;
    if (type === 'dodge' && (inc.ally || inc.nat)) return;
    if (reactTracker.avail() < 1) {
      showRoll({ kind: 'notice', title: name, math: 'No reactions left. They come back at the start of your turn.' });
      return;
    }
    state.reactAvail = reactTracker.avail() - 1;
    if (type === 'parry') state.parryUsed = true;
    reactTracker.render();
    renderDefense();
    save();
    const df = Object.assign({ type, ar: arFor(inc) }, inc);
    if (type !== 'dodge') df.area = false;
    const who = inc.ally ? ' for an ally' : '';
    if (type === 'block') {
      const die = blockDie();
      const rs = rollSet(die, false);
      const m = mod('STR');
      const g = defBonus('block');
      df.amt = Math.max(0, rs.t + m + g);
      showRoll({ kind: 'block', title: 'Block' + who, total: df.amt, math: rs.math + modText(m) + (g ? modText(g) : ''), defense: df });
    } else {
      rollCheck(name + who, type === 'dodge' ? mod('AGL') + defBonus('dodge') : mod('DEX') + defBonus('parry'), 'check', { defense: df });
    }
  }
  $('#defs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-def]');
    if (!b || b.disabled) return;
    useDefense(b.dataset.def);
  });

  // ---------- Dice tray: roll for stats ----------
  const rollsEl = $('#rolls');
  const fresh = new Set();
  function rollStatDice() {
    const d = [1 + randInt(6), 1 + randInt(6), 1 + randInt(12)];
    return { v: d[0] + d[1] + d[2], d };
  }
  function statOfRoll(i) { const k = Object.keys(state.alloc).find((s) => state.alloc[s] === i); return k || null; }
  function assignRoll(i, k) {
    const r = state.pool[i];
    if (!r || !STATS.some((s) => s.k === k)) return;
    const from = statOfRoll(i);
    if (from === k) return;
    const prev = state.alloc[k];
    if (from) delete state.alloc[from];
    state.alloc[k] = i;
    writeScore(k, r.v);
    if (prev != null && prev !== i && from) {
      // Swap: the result that was on this stat moves to the stat this one came from.
      state.alloc[from] = prev;
      writeScore(from, state.pool[prev].v);
    } else if (from) {
      clearScoreIfEqual(from, r.v);
    }
  }
  function unassignRoll(i) {
    const k = statOfRoll(i);
    if (!k) return;
    delete state.alloc[k];
    clearScoreIfEqual(k, state.pool[i].v);
  }
  function scramble(i) {
    if (reduceMotion) return;
    const el = rollsEl.querySelector('.roll-chip[data-id="' + i + '"] .rv');
    const r = state.pool[i];
    if (!el || !r) return;
    let n = 0;
    const timer = setInterval(() => {
      n++;
      if (!el.isConnected) { clearInterval(timer); return; }
      if (n >= 8) { clearInterval(timer); el.textContent = r.v; return; }
      el.textContent = 3 + randInt(22);
    }, 45);
  }
  function renderRolls() {
    let html = '';
    for (let i = 0; i < 8; i++) {
      const r = state.pool[i];
      if (!r) {
        html += '<div class="roll-chip empty" aria-hidden="true"><span class="rv">—</span><span class="rd">&nbsp;</span><span class="rtag">&nbsp;</span></div>';
        continue;
      }
      const used = statOfRoll(i);
      const sel = !!(selected && selected.kind === 'roll' && selected.id === String(i));
      html += '<div class="roll-chip' + (used ? ' used' : '') + (sel ? ' selected' : '') + '" data-drag="roll" data-id="' + i + '">' +
        '<button type="button" class="chip-main" aria-pressed="' + sel + '" aria-label="Rolled ' + r.v + (used ? ', placed on ' + used : '') + '. Select it, then choose a stat.">' +
          '<span class="rv">' + r.v + '</span>' +
          '<span class="rd">' + r.d.join(' + ') + '</span>' +
          '<span class="rtag">' + (used ? '→ ' + used : '&nbsp;') + '</span>' +
        '</button>' +
        (used ? '<button type="button" class="xbtn del chip-x" data-id="' + i + '" aria-label="Take ' + r.v + ' back off ' + used + '">×</button>' : '') +
        '</div>';
    }
    rollsEl.innerHTML = html;
    const full = state.pool.length >= 8;
    $('#rollOne').disabled = full;
    $('#rollAll').textContent = full ? 'Reroll all' : 'Roll all';
    $('#rollClear').disabled = !state.pool.length;
    fresh.forEach((i) => scramble(i));
    fresh.clear();
  }
  $('#rollOne').addEventListener('click', () => {
    if (state.pool.length >= 8) return;
    state.pool.push(rollStatDice());
    fresh.add(state.pool.length - 1);
    refreshAll();
    save();
  });
  $('#rollAll').addEventListener('click', () => {
    if (state.pool.length >= 8) {
      state.pool = [];
      state.alloc = {};
      if (selected && selected.kind === 'roll') selected = null;
    }
    while (state.pool.length < 8) {
      state.pool.push(rollStatDice());
      fresh.add(state.pool.length - 1);
    }
    refreshAll();
    save();
  });
  $('#rollClear').addEventListener('click', () => {
    state.pool = [];
    state.alloc = {};
    if (selected && selected.kind === 'roll') selected = null;
    refreshAll();
    save();
  });

  // ---------- Rolling ----------
  // d20 + modifier for checks and attacks. Wonder can reroll any roll that isn't an attack;
  // from FTH 21 (Defy Fate), it counts a check as a success instead.
  const toastEl = $('#toast');
  const apCost = window.WBCombat.attackApCost;
  const modText = (m) => (m >= 0 ? ' + ' : ' \u2212 ') + Math.abs(m);
  const defyFate = () => reached('FTH', 21);
  let lastRoll = null;
  function flatOf(str) {
    let t = 0;
    String(str || '').replace(/\d*\s*d\s*\d+/gi, '').replace(/([+-]?)\s*(\d+)/g, (m, sg, n) => { t += (sg === '-' ? -1 : 1) * Number(n); return m; });
    return t;
  }
  function showRoll(r) {
    lastRoll = r;
    const tot = $('#toastTotal');
    tot.hidden = r.total == null;
    tot.textContent = r.total == null ? '' : String(r.total);
    tot.classList.toggle('nat20', r.d20 === 20);
    tot.classList.toggle('nat1', r.d20 === 1);
    $('#toastTitle').textContent = r.title;
    $('#toastMath').textContent = r.math;
    const notes = [];
    if (r.d20 === 20) notes.push('Natural 20');
    if (r.d20 === 1) notes.push('Natural 1');
    if (r.note) notes.push(r.note);
    let take = null;
    let won = false;
    const df = r.defense;
    if (df) {
      const outcome = window.WBCombat.defenseResult(df, r.total, r.success);
      won = outcome.won;
      take = outcome.take;
      if (df.type === 'block') {
        if (take != null) {
          notes.push(take === 0 ? 'Blocked completely' : (df.ally ? 'They take ' : 'You take ') + take);
        } else {
          notes.push('Take ' + df.amt + ' off the damage, after Armor Rating');
        }
      } else if (outcome.unresolved) {
        notes.push(df.area ? 'Meet the save DC to halve the damage' : 'Beat their attack roll to ' + (df.type === 'parry' ? 'negate it' : 'avoid it'));
      } else {
        const verdict = won ? (df.type === 'parry' ? 'Parried' : df.area ? 'Saved, half damage' : 'Dodged') : df.area ? 'Failed the save' : 'Hit';
        notes.push(verdict + (take != null ? (df.ally ? '. They take ' : '. You take ') + take : ''));
      }
    } else if (r.dc != null) {
      won = !!r.success || r.total >= r.dc;
      notes.push((won ? 'Success' : 'Failed') + ' against DC ' + r.dc + (won && r.winNote ? ': ' + r.winNote : ''));
      // Indomitable: making the roll stops your own bleeding.
      if (won && r.indom && state.down && !state.down.stable && !isDead()) { state.down.stable = true; refreshAll(); save(); }
    }
    // Against a target from the battlemap: whether it hits, and how much gets through its Armor Rating.
    const foe = r.foe ? foeById(r.foe) : null;
    if (foe && r.kind === 'attack' && r.total != null) {
      // A natural 20 always hits.
      r.hit = window.WBCombat.attackHits(r.total, foe.ev, r.d20);
      notes.unshift(r.d20 === 20 ? 'Hits ' + foe.name + ': a natural 20 can’t be dodged, only blocked or parried' : (r.hit ? 'Hits ' : 'Misses ') + foe.name + ' (Evasion ' + foe.ev + ')');
    }
    if (foe && r.kind === 'dual') {
      const hits = window.WBCombat.dualHits(r.dual.ta, r.dual.tb, r.dual.a, r.dual.b, foe.ev);
      r.mainHit = hits.main;
      r.offHit = hits.off;
      notes.unshift('Main hand ' + (r.mainHit ? 'hits' : 'misses') + ', off-hand ' + (r.offHit ? 'hits' : 'misses') + ' (Evasion ' + foe.ev + ')');
    }
    if (foe && r.kind === 'damage' && r.hurt != null) {
      notes.unshift(r.hurt > 0 ? foe.name + ' takes ' + r.hurt + ' after Armor Rating ' + foe.ar + (r.perHit ? ' on each hit' : '') : 'Armor Rating ' + foe.ar + ' stops all of it');
    }
    r.take = take;
    $('#toastNote').textContent = notes.join(' \u00b7 ');
    const acts = (r.acts || []).slice();
    if (r.kind === 'check' && !r.success && !won) {
      const left = wonderTracker.avail();
      // Defy Fate turns a failure into a success, except on initiative, which it still rerolls.
      if (left > 0) acts.push(defyFate() && !r.noDefy ? ['defy', 'Defy Fate: count it as a success (' + left + ' left)'] : ['wonder', 'Reroll with Wonder (' + left + ' left)']);
    }
    // A failed Dodge can still be blocked with another reaction.
    if (df && df.type === 'dodge' && df.vs != null && !won && canBlock()) {
      const rl = reactTracker.avail();
      if (rl > 0) acts.push(['block', 'Block it (' + rl + (rl === 1 ? ' reaction' : ' reactions') + ' left)']);
    }
    if (r.kind === 'attack' && (!foe || r.hit)) {
      acts.push(['dmg', 'Roll damage']);
      if (r.d20 === 20) acts.push(['crit', 'Roll critical damage']);
    }
    if (r.kind === 'dual') {
      const c = (d) => (d === 20 ? ' (crit)' : '');
      const both = r.dual.a === 20 && r.dual.b === 20 ? ' (both crit)' : r.dual.a === 20 ? ' (main crit)' : r.dual.b === 20 ? ' (off-hand crit)' : '';
      if (!foe) acts.push(['dualboth', 'Damage: both hit' + both], ['dualmain', 'Main hand only' + c(r.dual.a)], ['dualoff', 'Off-hand only' + c(r.dual.b)]);
      else if (r.mainHit && r.offHit) acts.push(['dualboth', 'Roll damage, both hit' + both]);
      else if (r.mainHit) acts.push(['dualmain', 'Roll damage, main hand' + c(r.dual.a)]);
      else if (r.offHit) acts.push(['dualoff', 'Roll damage, off-hand' + c(r.dual.b)]);
    }
    if ((r.kind === 'attack' || r.kind === 'dual') && r.apSpent && reactTracker.avail() > 0) acts.push(['toreact', 'It was an opportunity attack (use a reaction, get ' + r.apSpent + ' AP back)']);
    if (take != null && take > 0 && !(df && df.ally)) acts.push(['take', 'Take ' + take + ' damage']);
    if (foe && r.kind === 'damage' && r.hurt > 0) acts.push(['hurt', 'Take ' + r.hurt + ' off ' + foe.name + '’s Health']);
    $('#toastActions').innerHTML = acts.map((a) => '<button type="button" class="btn' + (a[0] === 'wonder' || a[0] === 'defy' ? ' strong' : '') + '" data-act="' + a[0] + '">' + esc(a[1]) + '</button>').join('');
    toastEl.hidden = false;
    toastEl.classList.remove('pop-in');
    void toastEl.offsetWidth;
    toastEl.classList.add('pop-in');
  }
  // Every d20 follows the dice mode at the bottom of the screen: normal, advantage or disadvantage.
  const advMode = () => state.advMode || 'norm';
  function rollD20(mode) {
    const a = 1 + randInt(20);
    if (mode !== 'adv' && mode !== 'dis') return { d: a, txt: 'd20 (' + a + ')', mode: 'norm' };
    const b = 1 + randInt(20);
    const d = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
    return { d, txt: (mode === 'adv' ? 'Advantage, d20 (' : 'Disadvantage, d20 (') + a + ', ' + b + ')', mode };
  }
  function rollCheck(title, m, kind, extra) {
    const r = rollD20(advMode());
    showRoll(Object.assign({ title, kind, mod: m, d20: r.d, mode: r.mode, total: r.d + m, math: r.txt + modText(m) }, extra || {}));
  }
  function rollSet(str, crit) {
    let t = 0;
    const ps = [];
    eachDie(str, (c, n) => {
      const rs = [];
      for (let i = 0; i < c; i++) rs.push(1 + randInt(n));
      t += rs.reduce((a, b) => a + b, 0);
      ps.push(c + 'd' + n + ' (' + rs.join(', ') + ')');
    });
    let math = ps.join(' + ');
    // Critical hit: the dice's maximum, plus the dice rolled again.
    if (crit) { const mx = diceMax(str); t = window.WBCombat.criticalTotal(t, mx, true); math = 'max ' + mx + ' + ' + math; }
    const flat = flatOf(str);
    return { t: t + flat, math: math + (flat ? modText(flat) : '') };
  }
  // Damage for one weapon: its dice and modifier, plus extra dice from it and from worn gear.
  function damageOf(w, crit) {
    const fx = effectsFor(w);
    const m = mod(w.stat);
    const fb = sumEff(fx, 'flat');
    const base = rollSet(w.dmg, crit);
    const extras = fx.filter((e) => e.k === 'dmg').map((e) => ({
      effect: e, roll: rollSet(e.dice, crit)
    }));
    const packet = window.WBCombat.damagePacket(base.t, m, fb, extras.map(x => x.roll.t));
    let math = base.math + modText(m) + (fb ? modText(fb) : '');
    const split = [];
    extras.forEach((x, i) => {
      math += ', ' + x.roll.math + (x.effect.dt ? ' ' + x.effect.dt : '');
      split.push(packet.extras[i] + (x.effect.dt ? ' ' + x.effect.dt : ' extra'));
    });
    const hits = fx.filter((e) => e.k === 'onhit').map((e) => e.text);
    return { total: packet.total, math, weaponDmg: packet.weaponDmg, split, hits };
  }
  function rollDamage(w, crit, foeId) {
    const d = damageOf(w, crit);
    const notes = [];
    if (d.split.length) notes.push(d.weaponDmg + ' weapon', ...d.split);
    if (d.hits.length) notes.push('On hit: ' + d.hits.join(', '));
    const foe = foeId ? foeById(foeId) : null;
    // Against a target from the map, its Armor Rating comes off the hit.
    const hurt = foe ? window.WBCombat.armorDamage(d.total, foe.ar) : null;
    showRoll({ title: w.name + (crit ? ' critical damage' : ' damage') + (foe ? ' to ' + foe.name : ''), kind: 'damage', total: d.total, math: d.math, weapon: w, note: notes.join(' · ') || undefined, foe: foe ? foe.id : null, hurt });
  }

  // Dual wielding: one attack that swings both weapons. Each rolls to hit; the off-hand hit does half damage, rounded down.
  function dualReady() {
    const mw = itemById(state.equip.main);
    const ow = itemById(state.equip.off);
    return !!(mw && ow && TYPES[mw.type].weapon && mw.type !== 'twohand' && TYPES[ow.type].weapon);
  }
  function rollDual(extra) {
    const mw = itemById(state.equip.main);
    const ow = itemById(state.equip.off);
    const a = rollD20(advMode());
    const b = rollD20(advMode());
    const ma = atkMod(mw);
    const oa = atkMod(ow);
    const notes = [];
    if (extra && extra.note) notes.push(extra.note);
    [['Main hand', a.d], ['Off-hand', b.d]].forEach(([n, d]) => { if (d === 20) notes.push(n + ' natural 20'); if (d === 1) notes.push(n + ' natural 1'); });
    showRoll(Object.assign({}, extra || {}, {
      title: 'Dual wield attack' + (extra && extra.foe && foeById(extra.foe) ? ' on ' + foeById(extra.foe).name : ''), kind: 'dual', total: null,
      dual: { a: a.d, b: b.d, ta: a.d + ma, tb: b.d + oa },
      math: 'Main hand ' + (a.d + ma) + ' (' + a.txt + modText(ma) + ') · Off-hand ' + (b.d + oa) + ' (' + b.txt + modText(oa) + ')',
      note: notes.join(' · ') || undefined
    }));
  }
  function rollDualDamage(mainHit, offHit, mainCrit, offCrit, foeId) {
    const mw = itemById(state.equip.main);
    const ow = itemById(state.equip.off);
    if (!mw || !ow) return;
    const foe = foeId ? foeById(foeId) : null;
    const parts = [];
    const hits = [];
    let total = 0;
    // Against a target from the map, its Armor Rating comes off each hit separately (the off-hand after halving).
    let mainTotal = 0;
    let offTotal = 0;
    if (mainHit) {
      const d = damageOf(mw, mainCrit);
      total += d.total;
      mainTotal = d.total;
      parts.push('Main hand' + (mainCrit ? ' crit' : '') + ': ' + d.math + ' = ' + d.total);
      hits.push(...d.hits);
    }
    if (offHit) {
      const d = damageOf(ow, offCrit);
      const half = window.WBCombat.offhandDamage(d.total);
      total += half;
      offTotal = d.total;
      parts.push('Off-hand' + (offCrit ? ' crit' : '') + ': ' + d.math + ' = ' + d.total + ', halved to ' + half);
      hits.push(...d.hits);
    }
    const hurt = foe ? window.WBCombat.dualArmorDamage(mainTotal, offTotal, foe.ar, mainHit, offHit) : 0;
    const uniq = hits.filter((h, i) => hits.indexOf(h) === i);
    showRoll({ title: 'Dual wield damage' + (foe ? ' to ' + foe.name : ''), kind: 'damage', total, math: parts.join(' · '), note: uniq.length ? 'On hit: ' + uniq.join(', ') : undefined,
      foe: foe ? foe.id : null, hurt: foe ? hurt : null, perHit: !!(foe && mainHit && offHit) });
  }

  // Opportunity attacks are the only attacks that use a reaction instead of AP.
  function opportunity(slot, foeId) {
    const rl = reactTracker.avail();
    if (rl < 1) { showRoll({ kind: 'notice', title: 'Opportunity attack', math: 'No reactions left. They come back at the start of your turn.' }); return; }
    spendReaction();
    const note = 'Opportunity attack, used a reaction (' + reactTracker.avail() + ' left)';
    const foe = foeId ? foeById(foeId) : null;
    if (slot === 'dual') { rollDual({ note, foe: foe ? foe.id : null }); return; }
    const w = itemById(state.equip[slot]);
    if (w) rollCheck(w.name + ' opportunity attack' + (foe ? ' on ' + foe.name : ''), atkMod(w), 'attack', { weapon: w, note, foe: foe ? foe.id : null });
  }
  // An attack with what's in one hand, or both when dual wielding. It costs AP; damage doesn't, since it follows
  // the attack, and dual wielding costs the same as one attack. With a target from the battlemap, the roll is
  // checked against its Evasion and damage can come off its Health.
  function attackWith(slot, foeId) {
    const dual = slot === 'dual';
    if (dual ? !dualReady() : !itemById(state.equip[slot])) return;
    const w = dual ? itemById(state.equip.main) : itemById(state.equip[slot]);
    const foe = foeId ? foeById(foeId) : null;
    const cost = apCost(mod(w.stat));
    const have = apHave();
    const name = (dual ? 'Dual wield attack' : w.name + ' attack') + (foe ? ' on ' + foe.name : '');
    if (have < cost) {
      const rl = reactTracker.avail();
      showRoll({ kind: 'notice', title: name, math: 'This attack costs ' + cost + ' AP and you have ' + have + ' left.', weapon: w, oppSlot: slot, oppFoe: foe ? foe.id : null,
        acts: rl ? [['opp', 'It’s an opportunity attack (use a reaction, ' + rl + ' left)']] : [] });
      return;
    }
    spendAp(cost);
    apTracker.render();
    renderGiven();
    renderMove();
    save();
    const note = 'Spent ' + cost + ' AP, ' + leftText();
    if (dual) rollDual({ apSpent: cost, note, foe: foe ? foe.id : null });
    else rollCheck(name, atkMod(w), 'attack', { weapon: w, apSpent: cost, note, foe: foe ? foe.id : null });
    renderMap();
  }
  function onRollButton(b) {
    if (b.classList.contains('roll-stat')) {
      const st = STATS.find((x) => x.k === b.dataset.stat);
      rollCheck(st.n + ' check', mod(st.k), 'check');
    } else if (b.id === 'rollInit') {
      const v = num($('#init').value);
      rollCheck('Initiative', isNaN(v) ? mod('WIS') : v, 'check', { noDefy: true });
    } else if (b.id === 'concRoll') {
      rollCheck('Concentration (VIT)', mod('VIT'), 'check', { note: 'DC 12, or half the damage you took if that\u2019s higher' });
    } else {
      const slot = b.dataset.slot;
      const dual = slot === 'dual';
      if (dual ? !dualReady() : !itemById(state.equip[slot])) return;
      const w = dual ? itemById(state.equip.main) : itemById(state.equip[slot]);
      if (b.classList.contains('atk-opp')) {
        opportunity(slot);
      } else if (b.classList.contains('atk-roll')) {
        attackWith(slot, null);
      } else if (dual) {
        rollDualDamage(true, true, false, false);
      } else {
        rollDamage(w, false);
      }
    }
  }
  $('#toastActions').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b || !lastRoll) return;
    const r = lastRoll;
    const act = b.dataset.act;
    if (act === 'wonder' || act === 'defy') {
      state.wonderAvail = Math.max(0, wonderTracker.avail() - 1);
      wonderTracker.render();
      save();
    }
    if (act === 'wonder') {
      const rr = rollD20(r.mode);
      showRoll(Object.assign({}, r, { d20: rr.d, total: rr.d + r.mod, math: rr.txt + modText(r.mod), note: 'Rerolled with Wonder (was ' + r.total + ')' }));
    } else if (act === 'defy') {
      showRoll(Object.assign({}, r, { success: true, note: 'Counts as a success (Defy Fate)' }));
    } else if (act === 'dmg') {
      rollDamage(r.weapon, false, r.foe);
    } else if (act === 'crit') {
      rollDamage(r.weapon, true, r.foe);
    } else if (act === 'dualboth' || act === 'dualmain' || act === 'dualoff') {
      rollDualDamage(act !== 'dualoff', act !== 'dualmain', r.dual.a === 20, r.dual.b === 20, r.foe);
    } else if (act === 'hurt') {
      const f = foeById(r.foe);
      if (!f) return;
      const before = f.hp;
      f.hp = Math.max(-999, before - r.hurt);
      save();
      renderMap();
      showRoll({ kind: 'notice', title: f.name, math: 'Health ' + before + ' → ' + f.hp + ' of ' + f.max, note: f.hp <= 0 ? 'Down' : undefined, foeUndo: { id: f.id, hp: before }, acts: [['unhurt', 'Undo']] });
    } else if (act === 'unhurt') {
      const f = r.foeUndo ? foeById(r.foeUndo.id) : null;
      if (f) { f.hp = r.foeUndo.hp; save(); renderMap(); }
      toastEl.hidden = true;
    } else if (act === 'take') {
      if (r.defense) clearIncoming();
      applyDamage(r.take);
    } else if (act === 'undo') {
      undoRest();
    } else if (act === 'undoap') {
      undoAp();
    } else if (act === 'block') {
      useDefense('block');
    } else if (act === 'opp') {
      opportunity(r.oppSlot, r.oppFoe);
    } else if (act === 'toreact') {
      if (reactTracker.avail() < 1) return;
      refundAp(r.apSpent);
      apTracker.render();
      renderGiven();
      renderMove();
      spendReaction();
      showRoll(Object.assign({}, r, { apSpent: 0, note: 'Opportunity attack: used a reaction and got ' + r.apSpent + ' AP back' }));
    } else if (act === 'conc') {
      rollCheck('Concentration (VIT)', mod('VIT'), 'check', { dc: r.concDc || 12 });
    } else if (act === 'indom') {
      rollIndomitable();
    } else if (act === 'stable') {
      setStable(true);
      showRoll({ kind: 'notice', title: 'Indomitable', math: 'You stop bleeding. You’re still unconscious until you’re healed.' });
    } else if (act === 'gostats') {
      $('#asiBar').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      toastEl.hidden = true;
    }
  });
  $('#toastClose').addEventListener('click', () => { toastEl.hidden = true; });

  // ---------- Health: damage, healing, bleeding out and death ----------
  const fmtHp = (n) => (n < 0 ? '−' + Math.abs(n) : String(n));
  function hpMaxNow() { const m = num($('#hpMax').value); return isNaN(m) ? null : m; }
  function hpNow() {
    const c = num(state.fields.hpCur);
    return isNaN(c) ? hpMaxNow() : c;
  }
  // Death Threshold: level + VIT, 5 closer for each Trauma since your last long rest.
  function deathThreshold() {
    return window.WBCombat.deathThreshold(level(), score('VIT'), state.trauma);
  }
  // At a Death Threshold of 0, going below 0 at all kills you.
  const diesAt = window.WBCombat.diesAt;
  function isDead() { const h = hpNow(); return h != null && diesAt(h, deathThreshold()); }
  // Tracks the current time at 0 or below: whether Death's Mercy is used up and whether you're stabilized.
  function syncDown() {
    const h = hpNow();
    if (h == null || h > 0) state.down = null;
    else if (!state.down) state.down = { mercy: h < 0, stable: false };
  }
  function setStable(on) {
    syncDown();
    if (state.down) state.down.stable = !!on;
    refreshAll();
    save();
  }
  function applyDamage(amt, opts) {
    opts = opts || {};
    amt = Math.max(0, Math.round(amt));
    const before = hpNow();
    if (before == null) { showRoll({ kind: 'notice', title: 'Health', math: 'Set your Health first, or enter VIT so it can be worked out.' }); return; }
    const dt = deathThreshold();
    const outcome = window.WBCombat.damageHealth(before, amt, dt, state.down);
    const after = outcome.after;
    const dropped = outcome.dropped;
    const dead = outcome.dead;
    const notes = [];
    state.down = outcome.down;
    if (outcome.mercyCapped) notes.push("Death's Mercy stopped it at " + fmtHp(after));
    state.fields.hpCur = String(after);
    if (dead) notes.push(dt === 0 ? 'Below 0 with a Death Threshold of 0' : 'Death Threshold reached');
    else if (dropped) notes.push('Unconscious and bleeding out');
    const acts = [];
    // Taking more damage than your VIT mod calls for a Concentration check.
    const concDc = outcome.concentrationDc;
    if (!opts.bleed && !dead && state.fields.concOn === '1' && amt > mod('VIT')) acts.push(['conc', 'Concentration check (DC ' + concDc + ')']);
    if (dropped && !dead && reached('VIT', 21)) acts.push(['indom', 'Indomitable roll']);
    fillInputs();
    refreshAll();
    save();
    showRoll({ kind: 'notice', title: opts.bleed ? 'Bleeding out' : 'Health', math: (opts.bleed ? 'Lost ' + amt + ' to bleeding' : 'Took ' + amt + ' damage') + '. Health is now ' + fmtHp(after) + '.', note: notes.join(' · ') || undefined, acts, concDc });
  }
  // Coming back above 0 after going down adds a Trauma.
  function recover(notes) {
    state.trauma = (state.trauma || 0) + 1;
    state.down = null;
    notes.push('Trauma ' + state.trauma + ': Death Threshold ' + (5 * state.trauma) + ' closer until your next long rest');
  }
  function applyHeal(amt) {
    amt = Math.max(0, Math.round(amt));
    const before = hpNow();
    if (before == null) { showRoll({ kind: 'notice', title: 'Healing', math: 'Set your Health first, or enter VIT so it can be worked out.' }); return; }
    const max = hpMaxNow();
    let after = before + amt;
    if (max != null && after > max) after = Math.max(before, max);
    const notes = [];
    if (before <= 0 && after > 0) recover(notes);
    state.fields.hpCur = String(after);
    fillInputs();
    refreshAll();
    save();
    showRoll({ kind: 'notice', title: 'Healing', math: 'Healed ' + (after - before) + '. Health is now ' + fmtHp(after) + '.', note: notes.join(' · ') || undefined });
  }
  function hpButton(heal) {
    const el = $('#hpAmt');
    const v = num(el.value);
    if (isNaN(v) || v <= 0) { el.focus(); return; }
    el.value = '';
    if (heal) applyHeal(v); else applyDamage(v);
  }
  $('#hpHeal').addEventListener('click', () => hpButton(true));
  $('#treatedBtn').addEventListener('click', () => {
    const before = hpNow();
    if (before == null || before > 0 || isDead()) return;
    const notes = [];
    recover(notes);
    state.fields.hpCur = '1';
    fillInputs();
    refreshAll();
    save();
    showRoll({ kind: 'notice', title: 'Treated', math: 'Ten minutes of treatment after combat: back to 1 Health.', note: notes.join(' · ') });
  });
  function rollIndomitable() { rollCheck('Indomitable (VIT)', mod('VIT'), 'check', { dc: 12, indom: true, winNote: 'you stop bleeding, though you\u2019re still unconscious' }); }
  // Stabilizing someone else: 5 AP and d20 + INT mod against DC 12.
  $('#stabBtn').addEventListener('click', () => {
    const have = apHave();
    if (have < 5) { showRoll({ kind: 'notice', title: 'Stabilize', math: 'Stabilizing costs 5 AP and you have ' + have + ' left.' }); return; }
    spendAp(5);
    apTracker.render();
    renderGiven();
    renderMove();
    save();
    rollCheck('Stabilize (INT)', mod('INT'), 'check', { dc: 12, winNote: 'they stop bleeding', note: 'Spent 5 AP, ' + leftText() });
  });
  $('#indomBtn').addEventListener('click', rollIndomitable);
  $('#stableOn').addEventListener('change', (e) => setStable(e.target.checked));
  $('#traumaUp').addEventListener('click', () => { state.trauma = (state.trauma || 0) + 1; refreshAll(); save(); });
  $('#traumaDown').addEventListener('click', () => { state.trauma = Math.max(0, (state.trauma || 0) - 1); refreshAll(); save(); });
  function renderDeath() {
    const dt = deathThreshold();
    const tr = state.trauma || 0;
    const v = score('VIT');
    $('#dtVal').textContent = dt == null ? '—' : fmtHp(-dt);
    $('#dtSrc').textContent = dt == null ? 'Enter VIT to work it out' : 'Level ' + level() + ' + VIT ' + v + (tr ? ' \u2212 ' + (5 * tr) + ' Trauma' : '') + (dt === 0 ? '. Going below 0 kills you.' : '');
    $('#traumaN').textContent = String(tr);
    $('#traumaDown').disabled = !tr;
    const h = hpNow();
    const box = $('#dying');
    const down = h != null && h <= 0;
    box.hidden = !down;
    if (!down) return;
    const dead = diesAt(h, dt);
    const stable = !!(state.down && state.down.stable);
    box.classList.toggle('dead', dead);
    box.classList.toggle('stable', stable && !dead);
    $('#dyingTitle').textContent = dead ? 'Dead' : stable ? 'Stabilized' : 'Bleeding out';
    $('#dyingSub').textContent = dead ? '' : 'Unconscious';
    $('#deathBar').style.width = (dt == null || dt <= 0 ? 100 : Math.min(100, Math.max(0, (-h / dt) * 100))) + '%';
    let txt;
    if (dead) {
      txt = 'Health ' + fmtHp(h) + (dt === 0 ? ' went below 0 with a Death Threshold of 0.' : ' reached your Death Threshold of ' + fmtHp(-dt) + '.');
    } else {
      txt = 'Health ' + fmtHp(h) + '.' + (dt == null ? '' : dt === 0 ? ' Your Death Threshold is 0, so going below 0 kills you.' : ' You die at ' + fmtHp(-dt) + ', ' + (h + dt) + ' away.');
      txt += stable
        ? ' You’ve stopped bleeding but you’re still unconscious.'
        : ' You lose 4 at the start of each of your turns until someone stabilizes you (5 AP, d20 + INT mod against DC 12). Armor and resistance don\u2019t reduce it.';
      if (!(state.down && state.down.mercy) && dt != null && dt > 0) txt += " Death's Mercy: the first hit that takes you below 0 can't take you past " + fmtHp(-Math.floor(Math.max(0, dt) / 2)) + '.';
    }
    $('#dyingTxt').textContent = txt;
    $('#stableOn').checked = stable;
    $('#stableOn').disabled = dead;
    $('#indomBtn').hidden = dead || stable || !reached('VIT', 21);
    $('#treatedBtn').hidden = dead;
  }

  // ---------- Dice mode ----------
  function renderAdv() {
    const m = advMode();
    const bar = $('#advBar');
    bar.dataset.mode = m;
    bar.querySelectorAll('button[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  }
  $('#advBar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    state.advMode = b.dataset.mode;
    renderAdv();
    save();
  });

  // ---------- Stat increases at levels 4, 8, 12, 16 and 19 ----------
  let spending = false;
  let asiAsk = false;
  $('#asiLog').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.asiEdit) {
      spending = true;
      spendLv = Number(b.dataset.asiEdit);
      refreshAll();
      $('#asiBar').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    if (b.dataset.asiReset) { delete state.asi[b.dataset.asiReset]; save(); }
    else if (b.dataset.asiAll === 'ask') asiAsk = true;
    else if (b.dataset.asiAll === 'no') asiAsk = false;
    else if (b.dataset.asiAll === 'yes') { state.asi = {}; asiAsk = false; spendLv = null; save(); }
    refreshAll();
    const again = $('#asiLog [data-asi-all]');
    if (b.dataset.asiAll && again) again.focus();
  });
  let spendLv = null;
  const asiOf = (L) => state.asi[L] || {};
  const asiSpent = (L) => STATS.reduce((t, s) => t + (asiOf(L)[s.k] || 0), 0);
  const earnedAsi = () => ASI_LEVELS.filter((L) => L <= level());
  const unspentPts = () => earnedAsi().reduce((t, L) => t + Math.max(0, 4 - asiSpent(L)), 0);
  const asiText = (L) => STATS.filter((s) => asiOf(L)[s.k]).map((s) => s.k + ' +' + asiOf(L)[s.k]).join(', ');
  function asiTarget() {
    const e = earnedAsi();
    if (spendLv != null && e.includes(spendLv)) return spendLv;
    const u = e.find((L) => asiSpent(L) < 4);
    return u != null ? u : (e.length ? e[e.length - 1] : null);
  }
  function renderAsi() {
    const bar = $('#asiBar');
    const e = earnedAsi();
    if (!e.length) spending = false;
    const L = spending ? asiTarget() : null;
    $('#attrGroups').classList.toggle('spending', L != null);
    bar.classList.toggle('spending', L != null);
    if (!e.length) {
      bar.innerHTML = '';
    } else if (L == null) {
      const left = unspentPts();
      bar.innerHTML = left
        ? '<button type="button" class="btn strong" data-asi="start">Spend stat points</button><span class="asi-sum">' + left + ' to spend from level ' + listJoin(e.filter((x) => asiSpent(x) < 4).map(String)) + '</span>'
        : '<button type="button" class="btn-link" data-asi="start">Change stat increases</button>';
    } else {
      const left = 4 - asiSpent(L);
      bar.innerHTML = '<span class="asi-title">Level ' + L + ' increase</span>' +
        (e.length > 1 ? '<div class="pick" role="group" aria-label="Which level up">' + e.map((x) => '<button type="button" data-asi-lv="' + x + '" aria-pressed="' + (x === L) + '">Lv ' + x + (asiSpent(x) < 4 ? ' (' + (4 - asiSpent(x)) + ')' : '') + '</button>').join('') + '</div>' : '') +
        '<span class="asi-left">' + left + ' of 4 points left</span>' +
        '<span class="asi-sum">' + (asiText(L) || 'Nothing added yet. Up to 2 in any one stat.') + '</span>' +
        '<span class="asi-push"><button type="button" class="btn" data-asi="reset"' + (asiSpent(L) ? '' : ' disabled') + '>Reset level ' + L + '</button><button type="button" class="btn strong" data-asi="done">Done</button></span>';
    }
    STATS.forEach((s) => {
      const got = L == null ? 0 : (asiOf(L)[s.k] || 0);
      const el = document.getElementById('asiGot-' + s.k);
      el.textContent = L == null ? '' : got ? '+' + got + ' at Lv ' + L : (hasScore(s.k) ? 'No points' : 'Enter a score');
      el.classList.toggle('on', !!got);
      const tile = document.getElementById('stat-' + s.k);
      tile.querySelector('.asi-minus').disabled = L == null || !got;
      tile.querySelector('.asi-plus').disabled = L == null || got >= 2 || asiSpent(L) >= 4 || !hasScore(s.k);
    });
  }
  $('#asiBar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.asiLv) spendLv = Number(b.dataset.asiLv);
    else if (b.dataset.asi === 'start') { spending = true; spendLv = null; }
    else if (b.dataset.asi === 'done') { spending = false; spendLv = null; }
    else if (b.dataset.asi === 'reset') { const L = asiTarget(); if (L != null) { delete state.asi[L]; spendLv = L; save(); } }
    refreshAll();
    const again = b.dataset.asi === 'start' ? document.querySelector('#asiBar [data-asi="done"]') : b.dataset.asi === 'done' ? document.querySelector('#asiBar [data-asi="start"]') : null;
    if (again) again.focus();
  });
  $('#attrGroups').addEventListener('click', (e) => {
    const b = e.target.closest('.asi-plus, .asi-minus');
    if (!b) return;
    e.stopPropagation();
    if (b.disabled) return;
    const L = asiTarget();
    if (L == null) return;
    const k = b.dataset.stat;
    const plus = b.classList.contains('asi-plus');
    const a = Object.assign({}, asiOf(L));
    if (plus) {
      if ((a[k] || 0) >= 2 || asiSpent(L) >= 4 || !hasScore(k)) return;
      a[k] = (a[k] || 0) + 1;
    } else {
      if (!a[k]) return;
      a[k] -= 1;
      if (!a[k]) delete a[k];
    }
    if (Object.keys(a).length) state.asi[L] = a; else delete state.asi[L];
    spendLv = L;
    refreshAll();
    save();
    const again = document.querySelector('#stat-' + k + ' .' + (plus ? 'asi-plus' : 'asi-minus'));
    const other = document.querySelector('#stat-' + k + ' .' + (plus ? 'asi-minus' : 'asi-plus'));
    if (again && !again.disabled) again.focus(); else if (other && !other.disabled) other.focus();
  });

  // Concentration
  function refreshConc() {
    const on = state.fields.concOn === '1';
    $('#concOn').checked = on;
    $('#concBox').classList.toggle('on', on);
  }
  $('#concOn').addEventListener('change', (e) => {
    state.fields.concOn = e.target.checked ? '1' : '';
    refreshConc();
    save();
  });

  // ---------- Equipment ----------
  const packEl = $('#pack');
  const wornEl = $('#wornList');
  function renderEquipmentProfile() {
    const selectedForm = (state.abilityLoadouts || []).find(f => f.id === state.activeAbilityLoadoutId);
    const label = $('#equipmentProfileName');
    label.textContent = selectedForm ? selectedForm.name : 'Base';
    $('#equipmentCopyBase').disabled = !selectedForm;
    $('#equipmentClearForm').disabled = !Object.keys(state.equip || {}).length;
    $('#equipmentProfileNote').textContent = selectedForm ?
      'Worn equipment is saved for this form. All forms share the same inventory; switching does not reset gear bonuses, AP or spent items.' :
      'Base equipment is worn while no special form is selected. Other forms keep their own worn-slot layouts.';
  }
  $('#equipmentCopyBase').addEventListener('click', () => {
    if (!window.WBEquipment.copyBase(state)) return;
    selected = null;
    refreshAll();
    save();
  });
  $('#equipmentClearForm').addEventListener('click', () => {
    if (!window.confirm('Unequip all gear in this form? The items stay in your shared inventory.')) return;
    window.WBEquipment.clearCurrent(state);
    selected = null;
    refreshAll();
    save();
  });
  function newId() { return 'i' + Date.now().toString(36) + randInt(1e6).toString(36); }
  function toPack(slot) {
    const id = state.equip[slot];
    if (!id) return;
    delete state.equip[slot];
    delete state.settled[id];
  }
  function equip(id, slot) {
    const it = itemById(id);
    if (!it) return;
    if (it.type === 'twohand') slot = 'main';
    if (isPair(it)) slot = PAIRS[it.type].a;
    if (!fits(it.type, slot)) return;
    const from = slotOf(id);
    const prev = state.equip[slot];
    if (!from) delete state.settled[id];
    if (from) delete state.equip[from];
    if (prev && prev !== id && !from) delete state.settled[prev];
    state.equip[slot] = id;
    // Moving between two arm, ring, leg or hand slots swaps the pieces. A set can't swap, so it goes to the pack.
    if (prev && prev !== id && from) {
      const p = itemById(prev);
      if (p && fits(p.type, from) && !isPair(p)) state.equip[from] = prev; else delete state.settled[prev];
    }
    // A two-handed weapon needs both hands; a weapon in the off hand puts a two-handed one away.
    if (it.type === 'twohand') toPack('off');
    if (slot === 'off') { const m = itemById(state.equip.main); if (m && m.type === 'twohand') toPack('main'); }
    // A set fills both slots; a single piece in a set's second slot puts the set away.
    if (isPair(it)) toPack(PAIRS[it.type].b);
    else {
      const t = Object.keys(PAIRS).find((k) => PAIRS[k].b === slot);
      if (t && isPair(itemById(state.equip[PAIRS[t].a]))) toPack(PAIRS[t].a);
    }
  }
  function unequip(id) { const s = slotOf(id); if (s) toPack(s); }
  function removeItem(id) {
    unequip(id);
    delete state.spent[id];
    state.items = state.items.filter((it) => it.id !== id);
    window.WBEquipment.removeItem(state, id); // No deleted gear can reappear on a form switch.
    if (selected && selected.id === id) selected = null;
    if (editingId === id) resetForge();
  }
  function orderList() {
    const o = [];
    (Array.isArray(state.order) ? state.order : []).forEach((k) => { if (ORDER.includes(k) && !o.includes(k)) o.push(k); });
    return o.concat(ORDER.filter((k) => !o.includes(k)));
  }
  function moveWorn(slot, dir) {
    const ord = orderList();
    const worn = ord.filter((k) => itemById(state.equip[k]));
    const i = worn.indexOf(slot);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= worn.length) return;
    const a = ord.indexOf(worn[i]);
    const b = ord.indexOf(worn[j]);
    const tmp = ord[a]; ord[a] = ord[b]; ord[b] = tmp;
    state.order = ord;
  }
  function abilText(a) {
    const n = String(a.name || '').trim().replace(/[.:]\s*$/, '');
    const e = String(a.effect || '').trim();
    if (n && e) return '<b>' + esc(n) + '.</b> ' + esc(e);
    return n ? '<b>' + esc(n) + '</b>' : esc(e);
  }
  // Limited-use abilities: pips in the Equipped list, refilled at the start of your turn (per round) or by a long rest.
  function usesLeft(id, i, a) { const sp = (state.spent[id] || {})[i] || 0; return Math.max(0, a.uses - sp); }
  function usesHTML(it, i, a) {
    if (!a.uses) return '';
    const left = usesLeft(it.id, i, a);
    const nm = isSet(a.name) ? String(a.name).trim() : 'Ability';
    let h = '<div class="uses-line"><span class="use-pips" role="group" aria-label="' + esc(nm) + ' uses">';
    for (let j = 0; j < a.uses; j++) {
      h += '<button type="button" class="pip' + (j < left ? ' on' : '') + '" data-use="' + esc(it.id) + '" data-ai="' + i + '" data-j="' + j + '" aria-pressed="' + (j < left) + '" aria-label="' + esc(nm) + ' use ' + (j + 1) + ': ' + (j < left ? 'ready' : 'spent') + '"></button>';
    }
    return h + '</span><span class="uses-txt">' + left + '/' + a.uses + ' ' + perText(a) + '</span></div>';
  }
  function cardHTML(it, ghost) {
    const sel = !ghost && !!(selected && selected.kind === 'item' && selected.id === it.id);
    const ab = it.abilities || [];
    const abName = (a) => (isSet(a.name) ? String(a.name).trim() : 'Ability');
    const label = it.name + ', ' + TYPES[it.type].n.toLowerCase() + (isPair(it) ? ' set, worn on ' + PAIRS[it.type].on : '') + ', armor rating ' + it.ar + (gearLine(it).length ? ', ' + gearLine(it).join(', ') : '') + (ab.length ? ', abilities: ' + ab.map(abName).join(', ') : '') + '. Select it, then choose a slot.';
    const chips = ab.map((a) => {
      const n = abName(a);
      const e = (isSet(a.effect) ? String(a.effect).trim() : 'No description yet.') + (a.uses ? ' (' + a.uses + ' ' + perText(a) + ')' : '');
      return ghost
        ? '<span class="abil-chip">' + esc(n) + '</span>'
        : '<button type="button" class="abil-chip has-tip" aria-expanded="false" aria-label="' + esc(n + ': ' + e) + '">' + esc(n) +
            '<span class="pop" role="tooltip"><b>' + esc(n) + '</b>' + esc(e) + '</span></button>';
    }).join('');
    return '<div class="card' + (sel ? ' selected' : '') + (ghost ? ' ghost' : '') + '"' + (ghost ? '' : ' data-drag="item" data-id="' + esc(it.id) + '"') + '>' +
      '<span class="card-icon">' + ICONS[it.type] + '</span>' +
      (ghost ? '<span class="card-main">' : '<button type="button" class="card-main" aria-pressed="' + sel + '" aria-label="' + esc(label) + '">') +
        '<span class="card-name">' + esc(it.name) + '</span>' +
        '<span class="card-meta">' + TYPES[it.type].n + (isPair(it) ? ' · Set' : '') + (TYPES[it.type].weapon ? ' \u00b7 ' + esc(it.dmg) + ' ' + it.stat : '') + '</span>' +
        (gearLine(it).length ? '<span class="card-bonus">' + esc(gearLine(it).join(' \u00b7 ')) + '</span>' : '') +
      (ghost ? '</span>' : '</button>') +
      (TYPES[it.type].weapon
        ? '<span class="card-ar" aria-hidden="true"><b class="sm">' + esc(it.dmg) + '</b><span>DMG</span></span>'
        : '<span class="card-ar" aria-hidden="true"><b>' + it.ar + '</b><span>AR</span></span>') +
      (ghost ? '' :
        '<span class="card-tools">' +
          '<button type="button" class="xbtn card-edit" aria-label="Edit ' + esc(it.name) + '">' + PEN + '</button>' +
          '<button type="button" class="xbtn del card-x" aria-label="Delete ' + esc(it.name) + '">×</button>' +
        '</span>') +
      (ab.length ? '<span class="card-abils">' + chips + '</span>' : '') +
      '</div>';
  }
  function renderEquip() {
    renderEquipmentProfile();
    SLOTS.forEach((s) => {
      const el = document.querySelector('.slot[data-slot="' + s.k + '"]');
      const it = itemById(state.equip[s.k]);
      const sel = !!(it && selected && selected.kind === 'item' && selected.id === it.id);
      const blockedBy = it ? null : coveredBy(s.k);
      const label = isPair(it) ? PAIRS[it.type].n : s.n;
      el.classList.toggle('blocked', !!blockedBy);
      el.classList.toggle('filled', !!it);
      el.classList.toggle('selected', sel);
      if (it) { el.dataset.drag = 'item'; el.dataset.id = it.id; }
      else { delete el.dataset.drag; delete el.dataset.id; }
      el.title = it ? it.name : blockedBy ? blockedBy.name : '';
      const coverText = blockedBy ? (blockedBy.type === 'twohand' ? 'Both hands: ' : PAIRS[blockedBy.type].n + ': ') + blockedBy.name : '';
      el.innerHTML =
        '<button type="button" class="slot-main" aria-label="' + esc(label + (it ? ': ' + it.name + ', armor rating ' + it.ar : blockedBy ? ': ' + coverText : ': empty')) + '">' +
          '<span class="slot-label">' + label + '</span>' +
          (it
            ? '<span class="slot-name">' + esc(it.name) + '</span><span class="slot-ar">' + (TYPES[it.type].weapon ? esc(it.dmg) + modText(mod(it.stat)) : 'AR ' + it.ar) + '</span>'
            : '<span class="slot-empty">' + (blockedBy ? esc(coverText) : 'Empty') + '</span>') +
        '</button>' +
        (it ? '<button type="button" class="xbtn del slot-x" aria-label="Take off ' + esc(it.name) + '">×</button>' : '');
      document.querySelectorAll('.figure [data-part="' + s.k + '"]').forEach((p) => p.classList.toggle('worn', !!it || !!blockedBy));
    });

    // Equipped list, in body order unless the player has reordered it
    const ord = orderList();
    const worn = ord.filter((k) => itemById(state.equip[k]));
    wornEl.innerHTML = worn.length
      ? worn.map((k, i) => {
          const it = itemById(state.equip[k]);
          const ab = it.abilities || [];
          return '<li class="worn-row">' +
            '<span class="worn-slot">' + (isPair(it) ? PAIRS[it.type].n : SLOT_BY[k].n) + '</span>' +
            '<div class="worn-body">' +
              '<div class="worn-top"><span class="worn-name">' + esc(it.name) + '</span><span class="worn-ar">' + (TYPES[it.type].weapon ? esc(it.dmg) + ' ' + it.stat : 'AR ' + it.ar) + '</span></div>' +
              (!state.settled[it.id] && (it.bonuses || []).some((b) => b.t === 'VIT' || b.t === 'INT' || b.t === 'FTH') ? '<p class="worn-rest">Counts toward level-ups after your next long rest</p>' : '') +
              (gearLine(it).length ? '<p class="worn-bonus">' + esc(gearLine(it).join(' \u00b7 ')) + '</p>' : '') +
              (ab.length ? '<ul class="abils">' + ab.map((a, ai) => '<li>' + abilText(a) + usesHTML(it, ai, a) + '</li>').join('') + '</ul>' : '<p class="worn-none">No abilities</p>') +
            '</div>' +
            '<div class="worn-tools">' +
              '<button type="button" class="xbtn worn-up" data-slot="' + k + '" aria-label="Move ' + esc(it.name) + ' up"' + (i === 0 ? ' disabled' : '') + '>' + UP + '</button>' +
              '<button type="button" class="xbtn worn-down" data-slot="' + k + '" aria-label="Move ' + esc(it.name) + ' down"' + (i === worn.length - 1 ? ' disabled' : '') + '>' + DOWN + '</button>' +
              '<button type="button" class="xbtn worn-edit" data-id="' + esc(it.id) + '" aria-label="Edit ' + esc(it.name) + '">' + PEN + '</button>' +
            '</div>' +
          '</li>';
        }).join('')
      : '<li class="worn-empty">Nothing worn yet. Drag a piece from your pack onto the body.</li>';
    $('#wornCount').textContent = worn.length ? worn.length + (worn.length === 1 ? ' piece worn' : ' pieces worn') : '';
    $('#orderReset').hidden = ord.join() === ORDER.join();

    const loose = state.items.filter((it) => !slotOf(it.id));
    packEl.innerHTML = loose.length
      ? loose.map((it) => cardHTML(it, false)).join('')
      : '<p class="pack-empty">' + (state.items.length ? "You're wearing everything you own." : 'Your pack is empty. Forge a piece to fill it.') + '</p>';
    $('#packCount').textContent = loose.length === 1 ? '1 piece' : loose.length + ' pieces';
    // Attacks with what's in your hands. With a weapon in each hand you can attack with either, at full damage,
    // or with both at once for the same AP, when the off-hand hit does half damage.
    const mainW = itemById(state.equip.main);
    const offW = itemById(state.equip.off);
    const dual = dualReady();
    const held = [];
    if (mainW && TYPES[mainW.type].weapon) held.push(['main', mainW]);
    if (offW && TYPES[offW.type].weapon && !(mainW && mainW.type === 'twohand')) held.push(['off', offW]);
    const extraOf = (fx) => fx.filter((e) => e.k === 'dmg').map((e) => ' + ' + e.dice + (e.dt ? ' ' + e.dt : '')).join('');
    const oppBtn = (slot) => '<button type="button" class="btn atk-opp" data-slot="' + slot + '">Opportunity attack</button>';
    let atkHtml = held.map(([slot, w]) => {
      const m = mod(w.stat);
      const fx = effectsFor(w);
      const hits = fx.filter((e) => e.k === 'onhit').map((e) => e.text);
      return '<div class="atk">' +
        '<div class="atk-top"><span class="atk-name">' + (dual ? (slot === 'main' ? 'Main hand: ' : 'Off hand: ') : '') + esc(w.name) + '</span><span class="atk-ap">' + apCost(m) + ' AP</span></div>' +
        '<div class="atk-line">Attack ' + fmt(atkMod(w)) + ' · Damage ' + esc(w.dmg) + modText(m + sumEff(fx, 'flat')) + esc(extraOf(fx)) + ' · ' + w.stat + ' · Range ' + rangeOf(w) + ' ft</div>' +
        (hits.length ? '<div class="atk-eff">On hit: ' + esc(hits.join(', ')) + '</div>' : '') +
        '<div class="atk-btns"><button type="button" class="btn atk-roll" data-slot="' + slot + '">Attack</button><button type="button" class="btn atk-dmg" data-slot="' + slot + '">Damage</button>' + oppBtn(slot) + '</div>' +
      '</div>';
    }).join('');
    if (dual) {
      const line = (w) => { const fx = effectsFor(w); return esc(w.name) + ' ' + fmt(atkMod(w)) + ' to hit, ' + esc(w.dmg) + modText(mod(w.stat) + sumEff(fx, 'flat')) + esc(extraOf(fx)); };
      const hits = effectsFor(mainW).concat(effectsFor(offW)).filter((e) => e.k === 'onhit').map((e) => e.text).filter((h, i, a) => a.indexOf(h) === i);
      atkHtml += '<div class="atk dual">' +
        '<div class="atk-top"><span class="atk-name">Dual wield</span><span class="atk-ap">' + apCost(mod(mainW.stat)) + ' AP</span></div>' +
        '<div class="atk-sub">Main hand: ' + line(mainW) + '</div>' +
        '<div class="atk-sub">Off-hand: ' + line(offW) + ', then halved</div>' +
        (hits.length ? '<div class="atk-eff">On hit: ' + esc(hits.join(', ')) + '</div>' : '') +
        '<div class="atk-btns"><button type="button" class="btn atk-roll" data-slot="dual">Attack with both</button><button type="button" class="btn atk-dmg" data-slot="dual">Damage</button>' + oppBtn('dual') + '</div>' +
      '</div>';
    }
    $('#attacks').innerHTML = atkHtml || '<p class="atk-empty">No weapon in hand.</p>';
    $('#dollAr').textContent = String(Math.max(0, armorTotal() + vitArmor()));
    $('#dollWorn').textContent = (adamantine() ? 'Half VIT ' + sgn(vitArmor()) : 'VIT mod ' + fmt(mod('VIT'))) + (worn.length ? ', ' + sgn(armorTotal()) + ' from ' + worn.length + (worn.length === 1 ? ' piece' : ' pieces') + ' worn' : ', nothing worn yet');
  }

  // Forge: make a new piece or edit an existing one
  const forgeEl = $('#forge');
  const abilRows = $('#abilRows');
  const MAX_ABILS = 4;
  let forgeType = 'head';
  let editingId = null;
  let abilSeq = 0;
  function setForgeType(t) {
    forgeType = TYPES[t] ? t : 'head';
    $('#forgeType').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.type === forgeType)));
    $('#forgeName').placeholder = TYPES[forgeType].def;
    $('#weaponRow').hidden = !TYPES[forgeType].weapon;
    $('#shieldRow').hidden = forgeType !== 'shield';
    $('#setRow').hidden = !PAIRS[forgeType];
    if (PAIRS[forgeType]) $('#setLab').textContent = 'Set: worn on ' + PAIRS[forgeType].on;
  }
  let forgeStat = 'STR';
  function setForgeStat(st) {
    forgeStat = st === 'DEX' ? 'DEX' : 'STR';
    $('#forgeStat').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.stat === forgeStat)));
  }
  $('#forgeStat').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-stat]');
    if (b) setForgeStat(b.dataset.stat);
  });
  function syncAbilButton() { $('#addAbil').disabled = abilRows.children.length >= MAX_ABILS; }
  function addAbilRow(a, focus) {
    if (abilRows.children.length >= MAX_ABILS) return;
    abilSeq++;
    const row = document.createElement('div');
    row.className = 'abil-row';
    row.innerHTML =
      '<input id="abilName' + abilSeq + '" class="abil-name" type="text" maxlength="40" placeholder="Ability name" aria-label="Ability name" autocomplete="off">' +
      '<button type="button" class="xbtn del abil-del" aria-label="Remove this ability">×</button>' +
      '<textarea id="abilEffect' + abilSeq + '" class="abil-effect" rows="2" maxlength="400" placeholder="What it does" aria-label="What the ability does"></textarea>' +
      '<div class="abil-uses"><label for="abilN' + abilSeq + '">Uses</label>' +
        '<input id="abilN' + abilSeq + '" class="abil-n" type="number" inputmode="numeric" min="1" max="20" placeholder="\u221e" autocomplete="off">' +
        '<select id="abilPer' + abilSeq + '" class="abil-per" aria-label="When the uses come back"><option value="rest">per long rest</option><option value="round">per round</option></select>' +
        '<span>Leave it empty for no limit.</span></div>';
    if (a) {
      row.querySelector('.abil-name').value = a.name || '';
      row.querySelector('.abil-effect').value = a.effect || '';
      if (a.uses) { row.querySelector('.abil-n').value = String(a.uses); row.querySelector('.abil-per').value = a.per; }
    }
    abilRows.appendChild(row);
    syncAbilButton();
    if (focus) row.querySelector('.abil-name').focus();
  }
  const bonusRows = $('#bonusRows');
  const MAX_BONUSES = 8;
  let bonusSeq = 0;
  const BONUS_OPTIONS = ['Stats', 'Vitals'].map((grp) =>
    '<optgroup label="' + grp + '">' + BONUS.filter((b) => b.grp === grp).map((b) => '<option value="' + b.k + '">' + b.label + '</option>').join('') + '</optgroup>').join('');
  function syncBonusButton() { $('#addBonus').disabled = bonusRows.children.length >= MAX_BONUSES; }
  function addBonusRow(b, focus) {
    if (bonusRows.children.length >= MAX_BONUSES) return;
    bonusSeq++;
    const row = document.createElement('div');
    row.className = 'bonus-row';
    row.innerHTML =
      '<select id="bonusT' + bonusSeq + '" class="bonus-t" aria-label="What it raises">' + BONUS_OPTIONS + '</select>' +
      '<input id="bonusV' + bonusSeq + '" class="bonus-v" type="number" inputmode="numeric" placeholder="+1" aria-label="Amount" autocomplete="off">' +
      '<button type="button" class="xbtn del bonus-del" aria-label="Remove this bonus">\u00d7</button>';
    if (b) {
      row.querySelector('.bonus-t').value = b.t;
      row.querySelector('.bonus-v').value = String(b.v);
    }
    bonusRows.appendChild(row);
    syncBonusButton();
    if (focus) row.querySelector('.bonus-t').focus();
  }
  $('#addBonus').addEventListener('click', () => addBonusRow(null, true));
  bonusRows.addEventListener('click', (e) => {
    const b = e.target.closest('.bonus-del');
    if (!b) return;
    b.closest('.bonus-row').remove();
    syncBonusButton();
    $('#addBonus').focus();
  });
  const effRows = $('#effRows');
  const MAX_EFFECTS = 6;
  let effSeq = 0;
  const EFF_OPTIONS = EFFECTS.map((e) => '<option value="' + e.k + '">' + e.n + '</option>').join('');
  function effParams(row, k, e) {
    const id = row.dataset.seq;
    const p = row.querySelector('.eff-params');
    const amt = '<input class="eff-v" id="effV' + id + '" type="number" inputmode="numeric" placeholder="+1" aria-label="Amount" autocomplete="off">';
    const dt = (ph, w) => '<input class="eff-dt' + (w ? ' wide' : '') + '" id="effDt' + id + '" type="text" list="dmgTypes" placeholder="' + ph + '" aria-label="Damage type" autocomplete="off" spellcheck="false">';
    let h;
    if (k === 'dmg') h = '<input class="eff-dice" id="effDice' + id + '" type="text" placeholder="1d6" aria-label="Extra damage dice" autocomplete="off" spellcheck="false">' + dt('Type, like fire', true);
    else if (k === 'atk') h = amt + '<span class="eff-lab">to attack rolls</span>';
    else if (k === 'flat') h = amt + '<span class="eff-lab">to damage</span>';
    else if (k === 'def') h = amt + '<span class="eff-lab">to</span><select class="eff-on" id="effOn' + id + '" aria-label="Which defense"><option value="all">all defenses</option><option value="block">Block</option><option value="dodge">Dodge</option><option value="parry">Parry</option></select>';
    else if (k === 'res') h = '<span class="eff-lab">Halves</span>' + dt('fire') + '<span class="eff-lab">damage</span>';
    else h = '<input class="eff-text wide" id="effText' + id + '" type="text" maxlength="60" placeholder="Bleed, or knocked prone" aria-label="What happens on a hit" autocomplete="off">';
    p.innerHTML = h;
    const put = (sel, v) => {
      const el = p.querySelector(sel);
      if (!el || v == null || v === '' || (typeof v === 'number' && isNaN(v))) return;
      el.value = String(v);
    };
    if (e) { put('.eff-dice', e.dice); put('.eff-dt', e.dt); put('.eff-v', e.v); put('.eff-on', e.on); put('.eff-text', e.text); }
  }
  function readEff(row) {
    const k = row.querySelector('.eff-k').value;
    const g = (sel) => { const el = row.querySelector(sel); return el ? el.value.trim() : ''; };
    const e = { k };
    if (k === 'dmg') { e.dice = g('.eff-dice').replace(/\s+/g, ''); e.dt = g('.eff-dt').slice(0, 20); }
    else if (k === 'atk' || k === 'flat') e.v = Math.round(num(g('.eff-v')));
    else if (k === 'def') { e.v = Math.round(num(g('.eff-v'))); e.on = g('.eff-on') || 'all'; }
    else if (k === 'res') e.dt = g('.eff-dt').slice(0, 20);
    else e.text = g('.eff-text');
    return e;
  }
  function syncEffButton() { $('#addEff').disabled = effRows.children.length >= MAX_EFFECTS; }
  function addEffRow(e, focus) {
    if (effRows.children.length >= MAX_EFFECTS) return;
    effSeq++;
    const row = document.createElement('div');
    row.className = 'eff-row';
    row.dataset.seq = String(effSeq);
    row.innerHTML = '<select id="effK' + effSeq + '" class="eff-k" aria-label="Effect">' + EFF_OPTIONS + '</select>' +
      '<button type="button" class="xbtn del eff-del" aria-label="Remove this effect">\u00d7</button>' +
      '<div class="eff-params"></div>';
    const k = e && EFF_BY[e.k] ? e.k : 'dmg';
    row.querySelector('.eff-k').value = k;
    effParams(row, k, e);
    effRows.appendChild(row);
    syncEffButton();
    if (focus) row.querySelector('.eff-k').focus();
  }
  $('#addEff').addEventListener('click', () => addEffRow(null, true));
  effRows.addEventListener('click', (e) => {
    const b = e.target.closest('.eff-del');
    if (!b) return;
    b.closest('.eff-row').remove();
    syncEffButton();
    $('#addEff').focus();
  });
  effRows.addEventListener('change', (e) => {
    const sel = e.target.closest('.eff-k');
    if (!sel) return;
    const row = sel.closest('.eff-row');
    effParams(row, sel.value, readEff(row));
  });
  function resetForge() {
    editingId = null;
    $('#forgeName').value = '';
    $('#forgeAr').value = '';
    $('#forgeDmg').value = '';
    $('#forgeRange').value = '';
    $('#forgeBlock').value = '';
    $('#forgeSet').checked = false;
    setForgeStat('STR');
    abilRows.innerHTML = '';
    syncAbilButton();
    bonusRows.innerHTML = '';
    syncBonusButton();
    effRows.innerHTML = '';
    syncEffButton();
    $('#forgeTitle').textContent = 'Forge a Piece';
    $('#forgeSubmit').textContent = 'Add to pack';
    $('#forgeCancel').hidden = true;
    $('#forgeError').hidden = true;
    forgeEl.classList.remove('editing');
  }
  function startEdit(id) {
    const it = itemById(id);
    if (!it) return;
    resetForge();
    editingId = id;
    $('#forgeName').value = it.name;
    $('#forgeAr').value = String(it.ar);
    setForgeType(it.type);
    if (TYPES[it.type].weapon) { $('#forgeDmg').value = it.dmg || ''; $('#forgeRange').value = it.range ? String(it.range) : ''; setForgeStat(it.stat); }
    if (it.type === 'shield') $('#forgeBlock').value = it.block || '';
    $('#forgeSet').checked = isPair(it);
    (it.abilities || []).forEach((a) => addAbilRow(a, false));
    (it.bonuses || []).forEach((b) => addBonusRow(b, false));
    (it.effects || []).forEach((e) => addEffRow(e, false));
    $('#forgeTitle').textContent = 'Edit ' + it.name;
    $('#forgeSubmit').textContent = 'Save changes';
    $('#forgeCancel').hidden = false;
    forgeEl.classList.add('editing');
    forgeEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    $('#forgeName').focus({ preventScroll: true });
  }
  $('#forgeType').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-type]');
    if (b) setForgeType(b.dataset.type);
  });
  $('#addAbil').addEventListener('click', () => addAbilRow(null, true));
  abilRows.addEventListener('click', (e) => {
    const b = e.target.closest('.abil-del');
    if (!b) return;
    b.closest('.abil-row').remove();
    syncAbilButton();
    $('#addAbil').focus();
  });
  $('#forgeCancel').addEventListener('click', () => { resetForge(); refreshAll(); });
  forgeEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameEl = $('#forgeName');
    const arEl = $('#forgeAr');
    const errEl = $('#forgeError');
    const arRaw = arEl.value.trim();
    const ar = num(arRaw);
    if (arRaw !== '' && (isNaN(ar) || !isFinite(ar))) {
      errEl.textContent = 'Armor needs to be a whole number, like 2.';
      errEl.hidden = false;
      arEl.focus();
      return;
    }
    errEl.hidden = true;
    const name = (nameEl.value.trim() || TYPES[forgeType].def).slice(0, 40);
    const abilities = Array.from(abilRows.querySelectorAll('.abil-row'))
      .map((r) => {
        const a = { name: r.querySelector('.abil-name').value.trim(), effect: r.querySelector('.abil-effect').value.trim() };
        const n = Math.round(num(r.querySelector('.abil-n').value));
        if (isFinite(n) && n >= 1) { a.uses = Math.min(20, n); a.per = r.querySelector('.abil-per').value === 'round' ? 'round' : 'rest'; }
        return a;
      })
      .filter((a) => a.name || a.effect);
    const bonuses = Array.from(bonusRows.querySelectorAll('.bonus-row'))
      .map((r) => ({ t: r.querySelector('.bonus-t').value, v: Math.round(num(r.querySelector('.bonus-v').value)) }))
      .filter((b) => BONUS_BY[b.t] && isFinite(b.v) && b.v !== 0);
    const isW = !!TYPES[forgeType].weapon;
    const dmg = isW ? ($('#forgeDmg').value.trim() || '1d6') : '';
    if (isW && !eachDie(dmg, () => {})) {
      errEl.textContent = 'Damage needs dice, like 1d8 or 2d6+1.';
      errEl.hidden = false;
      $('#forgeDmg').focus();
      return;
    }
    const rgRaw = isW ? $('#forgeRange').value.trim() : '';
    const rg = num(rgRaw);
    if (rgRaw !== '' && (isNaN(rg) || rg < 5)) {
      errEl.textContent = 'Range needs to be 5 ft or more, like 5 or 60.';
      errEl.hidden = false;
      $('#forgeRange').focus();
      return;
    }
    const range = rgRaw === '' ? 5 : Math.min(1000, Math.max(5, Math.round(rg / 5) * 5));
    const isS = forgeType === 'shield';
    const blk = isS ? $('#forgeBlock').value.replace(/\s+/g, '') : '';
    if (blk && !eachDie(blk, () => {})) {
      errEl.textContent = 'The Block die needs dice, like 1d8.';
      errEl.hidden = false;
      $('#forgeBlock').focus();
      return;
    }
    const effects = [];
    let badDice = null;
    Array.from(effRows.querySelectorAll('.eff-row')).forEach((row) => {
      const e = readEff(row);
      if (validEff(e)) effects.push(e);
      else if (e.k === 'dmg' && (e.dice || e.dt) && !badDice) badDice = row.querySelector('.eff-dice');
    });
    if (badDice) {
      errEl.textContent = 'Extra damage needs dice, like 1d6 or 2d4.';
      errEl.hidden = false;
      badDice.focus();
      return;
    }
    const data = { name, type: forgeType, ar: arRaw === '' ? 0 : Math.round(ar), abilities, bonuses, effects };
    if (isW) { data.dmg = dmg; data.stat = forgeStat; }
    if (isW && range > 5) data.range = range;
    if (blk) data.block = blk;
    const asSet = !!PAIRS[forgeType] && $('#forgeSet').checked;
    if (asSet) data.pair = true;
    const it = editingId ? itemById(editingId) : null;
    if (it) {
      Object.assign(it, data);
      delete state.spent[it.id];
      if (!isW) { delete it.dmg; delete it.stat; }
      if (!data.range) delete it.range;
      if (!blk) delete it.block;
      if (!asSet) delete it.pair;
      const s = slotOf(it.id);
      if (s && !fits(it.type, s)) toPack(s);
      { const mw = itemById(state.equip.main); if (mw && mw.type === 'twohand') toPack('off'); }
      fixPairs();
      flash = 'Saved ' + name + '.';
    } else {
      state.items.push(Object.assign({ id: newId() }, data));
      flash = 'Added ' + name + ' to your pack.';
    }
    resetForge();
    refreshAll();
    save();
  });

  // ---------- Selection, drag and drop ----------
  function markTargets(k, id) {
    if (k === 'roll') {
      document.querySelectorAll('.stat').forEach((el) => el.classList.add('drop-ok'));
      return;
    }
    const it = itemById(id);
    if (!it) return;
    SLOTS.forEach((s) => {
      if (!fits(it.type, s.k) && !(it.type === 'twohand' && s.k === 'off')) return;
      document.querySelector('.slot[data-slot="' + s.k + '"]').classList.add('drop-ok');
      document.querySelectorAll('.figure .part[data-part="' + s.k + '"]').forEach((p) => p.classList.add('target'));
    });
    if (slotOf(id)) packEl.classList.add('drop-ok');
  }
  function renderSelection() {
    document.querySelectorAll('.drop-ok, .drop-hover').forEach((el) => el.classList.remove('drop-ok', 'drop-hover'));
    document.querySelectorAll('.figure .target').forEach((el) => el.classList.remove('target'));
    const src = drag && drag.active ? drag : selected;
    if (src) markTargets(src.kind, src.id);

    let rh;
    const sr = selected && selected.kind === 'roll' ? state.pool[Number(selected.id)] : null;
    if (sr) rh = 'Tap a stat to give it ' + sr.v + '. Tap the result again to cancel.';
    else if (!state.pool.length) rh = 'Roll one result at a time, or all eight at once.';
    else if (Object.keys(state.alloc).length < state.pool.length) rh = 'Drag a result onto a stat, or tap a result and then a stat.';
    else rh = state.pool.length < 8 ? 'Every result is placed. Roll again for more.' : 'All eight results are placed.';
    $('#rollHint').textContent = rh;

    const it = selected && selected.kind === 'item' ? itemById(selected.id) : null;
    let eh;
    if (it) eh = 'Tap a highlighted slot to wear ' + it.name + (slotOf(it.id) ? ', or tap the pack to take it off.' : '.');
    else eh = flash || (state.items.length ? 'Drag a piece onto the body, or tap a piece and then a slot.' : '');
    $('#equipHint').textContent = eh;
  }
  function rerender() { renderRolls(); renderEquip(); renderSelection(); }

  let suppressClick = false;
  let scrollRAF = 0;
  let scrollV = 0;
  function targetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const t = el && el.closest('[data-drop]');
    return t && t.classList.contains('drop-ok') ? t : null;
  }
  function updateOver(x, y) {
    const t = targetAt(x, y);
    if (drag.over === t) return;
    if (drag.over) drag.over.classList.remove('drop-hover');
    if (t) t.classList.add('drop-hover');
    drag.over = t;
  }
  function autoScroll() {
    if (!drag || !drag.active || !scrollV) { scrollRAF = 0; return; }
    window.scrollBy(0, scrollV);
    updateOver(drag.lastX, drag.lastY);
    scrollRAF = requestAnimationFrame(autoScroll);
  }
  function beginDrag() {
    drag.active = true;
    let html;
    if (drag.kind === 'roll') {
      const r = state.pool[Number(drag.id)];
      html = '<div class="roll-chip ghost"><span class="rv">' + r.v + '</span><span class="rd">' + r.d.join(' + ') + '</span></div>';
    } else {
      html = cardHTML(itemById(drag.id), true);
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    drag.ghost = wrap.firstElementChild;
    document.body.appendChild(drag.ghost);
    drag.src.classList.add('lifting');
    document.body.classList.add('dragging');
    const a = document.activeElement;
    if (a && a.blur && a !== document.body) a.blur();
    renderSelection();
  }
  function dropOn(k, id, t) {
    if (k === 'roll' && t.dataset.drop === 'stat') assignRoll(Number(id), t.dataset.stat);
    else if (k === 'item' && t.dataset.drop === 'slot') equip(id, t.dataset.slot);
    else if (k === 'item' && t.dataset.drop === 'pack') unequip(id);
  }
  function endDrag(e, cancel) {
    const d = drag;
    drag = null;
    scrollV = 0;
    if (!d || !d.active) return;
    const t = cancel ? null : targetAt(e.clientX, e.clientY);
    d.ghost.remove();
    d.src.classList.remove('lifting');
    document.body.classList.remove('dragging');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (t) {
      dropOn(d.kind, d.id, t);
      selected = null;
      flash = '';
      refreshAll();
      save();
    } else {
      renderSelection();
    }
  }
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    const src = e.target.closest('[data-drag]');
    if (!src || e.target.closest('.xbtn')) return;
    drag = { kind: src.dataset.drag, id: src.dataset.id, src, x0: e.clientX, y0: e.clientY, pid: e.pointerId, active: false, ghost: null, over: null, lastX: e.clientX, lastY: e.clientY };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      beginDrag();
    }
    e.preventDefault();
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    updateOver(e.clientX, e.clientY);
    const edge = 56;
    const h = window.innerHeight;
    scrollV = e.clientY < edge ? -Math.ceil((edge - e.clientY) / 4)
      : e.clientY > h - edge ? Math.ceil((e.clientY - (h - edge)) / 4) : 0;
    if (scrollV && !scrollRAF) scrollRAF = requestAnimationFrame(autoScroll);
  }, { passive: false });
  document.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.pid) endDrag(e, false); });
  document.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.pid) endDrag(e, true); });

  // Tap to select, then tap where it goes
  document.addEventListener('click', (e) => {
    if (suppressClick) return;
    const t = e.target;
    if (!t.closest || t.closest('#forge')) return;
    const rb = t.closest('.roll-stat, .atk-roll, .atk-dmg, .atk-opp, #rollInit, #concRoll');
    if (rb) { closeTips(); onRollButton(rb); return; }
    const chip = t.closest('.has-tip');
    const wasOpen = !!(chip && chip.classList.contains('open'));
    closeTips();
    if (chip) {
      if (!wasOpen) { chip.classList.add('open'); chip.setAttribute('aria-expanded', 'true'); }
      return;
    }
    let el;
    let changed = false;
    let touched = true;
    if ((el = t.closest('.chip-x'))) {
      unassignRoll(Number(el.dataset.id));
      selected = null;
      changed = true;
    } else if ((el = t.closest('.chip-main'))) {
      const id = el.closest('.roll-chip').dataset.id;
      selected = selected && selected.kind === 'roll' && selected.id === id ? null : { kind: 'roll', id };
    } else if ((el = t.closest('.card-x'))) {
      removeItem(el.closest('.card').dataset.id);
      changed = true;
    } else if ((el = t.closest('.card-edit'))) {
      startEdit(el.closest('.card').dataset.id);
    } else if ((el = t.closest('.card-main'))) {
      const id = el.closest('.card').dataset.id;
      selected = selected && selected.kind === 'item' && selected.id === id ? null : { kind: 'item', id };
    } else if ((el = t.closest('.slot-x'))) {
      unequip(el.closest('.slot').dataset.id);
      selected = null;
      changed = true;
    } else if ((el = t.closest('.slot-main'))) {
      const k = el.closest('.slot').dataset.slot;
      const it = selected && selected.kind === 'item' ? itemById(selected.id) : null;
      if (it && (fits(it.type, k) || (it.type === 'twohand' && k === 'off')) && state.equip[k] !== it.id) {
        equip(it.id, k);
        selected = null;
        changed = true;
      } else if (state.equip[k]) {
        const id = state.equip[k];
        selected = selected && selected.id === id ? null : { kind: 'item', id };
      } else {
        touched = false;
      }
    } else if ((el = t.closest('button[data-use]'))) {
      const it = itemById(el.dataset.use);
      const i = Number(el.dataset.ai);
      const j = Number(el.dataset.j);
      const a = it && it.abilities[i];
      if (a && a.uses) {
        const left = usesLeft(it.id, i, a);
        const nl = j < left ? j : j + 1;
        state.spent[it.id] = Object.assign({}, state.spent[it.id], { [i]: a.uses - nl });
        useFocus = 'button[data-use="' + it.id + '"][data-ai="' + i + '"][data-j="' + j + '"]';
      }
      changed = true;
    } else if ((el = t.closest('.worn-up, .worn-down'))) {
      const dir = el.classList.contains('worn-up') ? -1 : 1;
      moveWorn(el.dataset.slot, dir);
      pendingFocus = [el.classList.contains('worn-up') ? '.worn-up' : '.worn-down', el.dataset.slot];
      changed = true;
    } else if ((el = t.closest('.worn-edit'))) {
      startEdit(el.dataset.id);
    } else if (t.closest('#orderReset')) {
      state.order = [];
      changed = true;
    } else if (selected && selected.kind === 'roll' && (el = t.closest('.stat'))) {
      const a = document.activeElement;
      if (a && el.contains(a)) a.blur();
      assignRoll(Number(selected.id), el.dataset.stat);
      selected = null;
      changed = true;
    } else if (selected && selected.kind === 'item' && t.closest('#pack') && slotOf(selected.id)) {
      unequip(selected.id);
      selected = null;
      changed = true;
    } else {
      touched = false;
    }
    if (!touched) return;
    flash = '';
    if (changed) { refreshAll(); save(); } else { rerender(); }
    if (useFocus) { const u = document.querySelector(useFocus); useFocus = null; if (u) u.focus(); }
    if (pendingFocus) {
      const [cls, slot] = pendingFocus;
      pendingFocus = null;
      const b = document.querySelector(cls + '[data-slot="' + slot + '"]');
      const other = document.querySelector((cls === '.worn-up' ? '.worn-down' : '.worn-up') + '[data-slot="' + slot + '"]');
      if (b && !b.disabled) b.focus(); else if (other) other.focus();
    }
  });
  let useFocus = null;
  function closeTips() {
    document.querySelectorAll('.has-tip.open').forEach((c) => { c.classList.remove('open'); c.setAttribute('aria-expanded', 'false'); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTips();
    if (e.key === 'Escape' && selected) {
      selected = null;
      rerender();
    } else if (e.key === 'Enter' && selected && selected.kind === 'roll' && e.target.closest) {
      const tile = e.target.closest('.stat');
      if (!tile) return;
      e.preventDefault();
      if (e.target.blur) e.target.blur();
      assignRoll(Number(selected.id), tile.dataset.stat);
      selected = null;
      refreshAll();
      save();
    }
  });

  // Advancement table
  const logBody = $('#logBody');
  const logTable = $('#logTable');
  let logSig = '';
  function renderLog() {
    const L = level();
    const ms = msStat();
    const holy = ms === 'FTH';
    $('#msHead').textContent = ms;
    $('#mpHead').textContent = holy ? 'Holy' : 'Mana';
    logTable.classList.toggle('holy', holy);
    if (String(L) !== logSig) {
      logSig = String(L);
      let html = '';
      for (let n = 1; n <= L; n++) {
        const asi = ASI_LEVELS.includes(n);
        const rollCell = n === 1
          ? '<span class="maxnote" id="lv1-max"></span>'
          : '<span class="roll"><input class="roll-in" id="lv' + n + '-roll" data-roll-lv="' + n + '" type="number" inputmode="numeric" aria-label="Health roll for level ' + n + '" autocomplete="off">' +
            '<button type="button" class="die-btn" data-roll="' + n + '" aria-label="Roll for level ' + n + '">' + DIE_SVG + '</button></span>';
        html += '<tr' + (asi ? ' class="asi"' : '') + '>' +
          '<th scope="row">' + n + '</th>' +
          '<td class="snap" id="lv' + n + '-vit"></td>' +
          '<td>' + rollCell + '</td>' +
          '<td class="out hp" id="lv' + n + '-hp"></td>' +
          '<td class="snap" id="lv' + n + '-ms"></td>' +
          '<td class="out mp" id="lv' + n + '-mp"></td>' +
          '<td class="out pts">' + (asi ? '+4' : '') + '</td>' +
          '</tr>';
      }
      logBody.innerHTML = html;
    }
    const active = document.activeElement;
    log.rows.forEach((row) => {
      const n = row.n;
      document.getElementById('lv' + n + '-vit').innerHTML = row.vit == null ? '—' : row.vit + (row.vg ? ' <span class="gear">(' + sgn(row.vg) + ' gear)</span>' : '');
      document.getElementById('lv' + n + '-ms').innerHTML = row.msv == null ? '—' : row.msv + (row.mg ? ' <span class="gear">(' + sgn(row.mg) + ' gear)</span>' : '');
      if (n === 1) {
        $('#lv1-max').textContent = row.dieMax ? row.dieMax + ' max' : '—';
      } else {
        const el = document.getElementById('lv' + n + '-roll');
        const btn = el.nextElementSibling;
        el.placeholder = row.die || '—';
        if (el !== active) el.value = isSet(state.rolls[n]) ? state.rolls[n] : '';
        btn.disabled = !row.die;
        btn.setAttribute('aria-label', row.die ? 'Roll ' + row.die + ' for level ' + n : 'Enter VIT to roll for level ' + n);
      }
      document.getElementById('lv' + n + '-hp').textContent = row.gain == null ? '—' : '+' + row.gain;
      document.getElementById('lv' + n + '-mp').textContent = row.mgain == null ? '—' : '+' + row.mgain;
    });
    $('#logHp').textContent = log.hp == null ? '—' : String(log.hp);
    $('#logMp').textContent = log.mp == null ? '—' : String(log.mp);
    const pts = pointsBy(L);
    $('#logPts').textContent = String(pts);
    $('#levelNow').textContent = 'Level ' + L;
    const next = ASI_LEVELS.find((x) => x > L);
    const unspent = unspentPts();
    $('#ptsNow').textContent = (pts ? pts + ' stat points earned' + (unspent ? ', ' + unspent + ' not spent yet' : '') : 'No stat points yet') + (next ? '. Next 4 at level ' + next + '.' : '.');
    const asiLog = $('#asiLog');
    const earned = earnedAsi();
    asiLog.hidden = !earned.length;
    asiLog.innerHTML = !earned.length ? '' :
      '<span class="foot-label">Stat increases</span>' +
      earned.map((x) => '<div class="asi-item"><b>Level ' + x + '</b><span>' + (asiText(x) || 'Nothing yet') + (asiSpent(x) < 4 ? ' (' + (4 - asiSpent(x)) + ' unspent)' : '') + '</span>' +
        '<button type="button" class="btn-link" data-asi-edit="' + x + '">Change</button>' +
        (asiSpent(x) ? '<button type="button" class="btn-link" data-asi-reset="' + x + '">Reset</button>' : '') + '</div>').join('') +
      (Object.keys(state.asi).length
        ? (asiAsk
          ? '<div class="asi-all"><span>Undo every stat increase?</span><button type="button" class="btn danger" data-asi-all="yes">Reset all</button><button type="button" class="btn" data-asi-all="no">Keep</button></div>'
          : '<div class="asi-all"><button type="button" class="btn-link" data-asi-all="ask">Reset all stat increases</button></div>')
        : '');
    const missEl = $('#logMissing');
    let msg = '';
    if (!hasScore('VIT')) {
      msg = 'Enter your VIT score to work out Health.';
    } else {
      const miss = log.missing.filter((x) => x > 1);
      if (miss.length) msg = 'Roll for level' + (miss.length > 1 ? 's ' : ' ') + listJoin(miss) + ' to finish your max Health.';
    }
    missEl.hidden = !msg;
    missEl.textContent = msg;
  }
  logBody.addEventListener('click', (e) => {
    const b = e.target.closest('.die-btn');
    if (!b || b.disabled) return;
    const n = Number(b.dataset.roll);
    const row = log.rows[n - 1];
    if (!row || !row.die) return;
    const v = rollDice(row.die);
    if (v == null) {
      setStatus("That hit die can't be rolled. Use a format like 1d8 or 1d12+1d4.", true);
      return;
    }
    state.rolls[n] = String(v);
    refreshAll();
    save();
    const el = document.getElementById('lv' + n + '-roll');
    if (el) {
      el.classList.remove('rolled');
      void el.offsetWidth;
      el.classList.add('rolled');
    }
  });
  const levelInput = $('#level');
  $('#levelUp').addEventListener('click', () => {
    setLevel(level() + 1);
    const L = level();
    if (ASI_LEVELS.includes(L)) { spending = true; spendLv = L; }
    refreshAll();
    save();
    if (ASI_LEVELS.includes(L)) showRoll({ kind: 'notice', title: 'Level ' + L, math: 'You have 4 stat points to spend, no more than 2 in any one stat. Use the + buttons on your attributes.', acts: [['gostats', 'Show me']] });
  });
  // The level badge applies when you finish typing, so passing through other numbers
  // on the way (like clearing 5 to type 6) never undoes levels.
  levelInput.addEventListener('change', () => {
    setLevel(num(levelInput.value));
    refreshAll();
    save();
  });

  // Portrait forms: one picture per form, for characters with transformations.
  const pImg = $('#portraitImg');
  const pEmpty = $('#portraitEmpty');
  const pClear = $('#portraitClear');
  const formStrip = $('#formStrip');
  const formName = $('#formName');
  const activeForm = () => state.portraits.find((f) => f.id === state.formId) || state.portraits[0] || null;
  const formLabel = (f) => (f.name ? f.name : 'Form ' + (state.portraits.indexOf(f) + 1));
  function showPortrait() {
    const f = activeForm();
    if (f) { pImg.src = f.src; pImg.alt = 'Character portrait: ' + formLabel(f); } else pImg.removeAttribute('src');
    pImg.hidden = !f;
    pEmpty.hidden = !!f;
    pClear.hidden = !f;
    pClear.setAttribute('aria-label', f ? 'Remove ' + formLabel(f) : 'Remove this form');
    formStrip.innerHTML = state.portraits.map((x) =>
      '<button type="button" class="form-thumb" data-form="' + esc(x.id) + '" aria-pressed="' + (x === f) + '" title="' + esc(formLabel(x)) + '" aria-label="Show ' + esc(formLabel(x)) + '"><img src="' + esc(x.src) + '" alt=""></button>').join('') +
      '<button type="button" class="form-add" title="Add a form" aria-label="Add a form">+</button>' +
      (state.portraits.length < 2 ? '<span class="form-hint">' + (f ? 'Add another picture for each transformation.' : 'Add a picture, then one for each transformation.') + '</span>' : '');
    formName.hidden = !f;
    if (f && document.activeElement !== formName) formName.value = f.name || '';
  }
  function readPortrait(file, done) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setStatus("That file isn't an image. Choose a PNG, JPG or WebP.", true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 360;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) * 0.25; // favor the top, where faces usually are
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        done(c.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => setStatus("That image couldn't be opened. Try a PNG or JPG.", true);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  // Pictures are saved right away; one that doesn't fit in this browser's storage is taken back out.
  function storeNow() {
    clearTimeout(saveTimer);
    try {
      window.WBEquipment.capture(state);
      repositories.characters.save(state);
      return true;
    } catch (e) { return false; }
  }
  const NO_ROOM = "There's no room left in this browser for that picture. Remove a form, or export your character to keep a copy.";
  function addForm(src) {
    const prev = state.formId;
    const prevAbilityForm = state.activeAbilityLoadoutId;
    const f = { id: newId(), src, name: '' };
    state.portraits.push(f);
    window.WBAbilities.selectPortrait(state, f.id);
    if (storeNow()) setStatus(DEFAULT_STATUS);
    else {
      state.portraits.pop();
      state.formId = prev;
      state.activeAbilityLoadoutId = prevAbilityForm;
      setStatus(NO_ROOM, true);
    }
    refreshAll();
  }
  // Tapping the big portrait changes this form's picture, or adds the first one.
  $('#portraitFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    readPortrait(file, (src) => {
      const f = activeForm();
      if (!f) { addForm(src); return; }
      const old = f.src;
      f.src = src;
      if (storeNow()) setStatus(DEFAULT_STATUS);
      else { f.src = old; setStatus(NO_ROOM, true); }
      showPortrait();
    });
  });
  $('#formFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    readPortrait(file, addForm);
  });
  formStrip.addEventListener('click', (e) => {
    const t = e.target.closest('.form-thumb, .form-add');
    if (!t) return;
    if (t.classList.contains('form-add')) { $('#formFile').click(); return; }
    // Clicking a portrait is also a mechanical form switch, not just a picture swap.
    const linked=(state.abilityLoadouts||[]).filter(f=>f.portraitId===t.dataset.form);
    const dest=linked.find(f=>f.id===state.activeAbilityLoadoutId)||linked[0];
    const check=window.WBAbilities.entryCost(state,dest?dest.id:'',formEntryControls);
    if(!check.ok) {
      showRoll({kind:'notice',title:'Cannot change form',math:check.message});
      return;
    }
    if (!window.WBAbilities.selectPortrait(state, t.dataset.form, formEntryControls)) return;
    refreshAll(); // Updates stats, defenses, Movement, available abilities and portrait together.
    save();
    const again = formStrip.querySelector('.form-thumb[aria-pressed="true"]');
    if (again) again.focus();
  });
  formName.addEventListener('input', () => {
    const f = activeForm();
    if (!f) return;
    f.name = formName.value.slice(0, 30);
    showPortrait();
    save();
  });
  pClear.addEventListener('click', () => {
    const f = activeForm();
    if (!f) return;
    const i = state.portraits.indexOf(f);
    const remaining=state.portraits.filter(p=>p.id!==f.id);
    const nextCandidate=remaining[Math.max(0,i-1)];
    const linked=nextCandidate?(state.abilityLoadouts||[]).filter(x=>x.portraitId===nextCandidate.id):[];
    const dest=linked.find(x=>x.id===state.activeAbilityLoadoutId)||linked[0];
    const check=window.WBAbilities.entryCost(state,dest?dest.id:'',formEntryControls);
    if(!check.ok) {
      showRoll({kind:'notice',title:'Cannot remove portrait',math:check.message});
      return;
    }
    state.portraits.splice(i, 1);
    // Do not keep links to deleted pictures on mechanical ability forms.
    state.abilityLoadouts.forEach(loadout => {
      if (loadout.portraitId === f.id) loadout.portraitId = '';
    });
    const next = state.portraits[Math.max(0, i - 1)];
    if (next) window.WBAbilities.selectPortrait(state, next.id, formEntryControls);
    else {
      state.formId = null;
      window.WBAbilities.selectLoadout(state, '', formEntryControls);
    }
    refreshAll();
    save();
  });

  // ---------- Battlemap ----------
  // A grid of 5 ft squares, drawn in layers: an optional map picture, the squares you can reach, the grid lines
  // (their strength is adjustable, so the picture never has lines baked in), then your token on top.
  // Moves find the shortest way around walls and pillars, every square costs 5 ft (diagonals too), difficult
  // terrain costs 10 ft a square, and paying goes through spendMove, so leftover feet, Surge and AP from a
  // Command work the same as in the Movement panel.
  const SQ_FT = 5;
  const MAP_EDGE = 24;
  // Maps that come with the sheet. Terrain rows: # wall, O pillar, B broken pillar, r rubble, w shallow water,
  // b bones, s stairs, d open door, x sealed door, c sarcophagus, n burial niche, f brazier, u urns; anything else is floor.
  // Links: standing on a square of that letter offers to take you to another map, arriving on a set square.
  // Maps live in js/maps.js so new ones can be added without touching the app.
  const MAPS = window.WB_MAPS;
  const TERRAIN = { '#': 'wall', O: 'pillar', B: 'broken', r: 'rubble', w: 'water', b: 'bones', s: 'stairs', d: 'door', x: 'sealed', c: 'coffin', n: 'niche', f: 'brazier', u: 'urns' };
  const TERRAIN_NAME = {
    wall: 'a wall', pillar: 'a pillar', broken: 'a broken pillar', rubble: 'rubble', water: 'shallow water', bones: 'a pile of bones',
    sealed: 'a sealed door', coffin: 'a sarcophagus', niche: 'a burial niche', brazier: 'a brazier', urns: 'a cluster of urns'
  };
  const BLOCKS = ['wall', 'pillar', 'broken', 'sealed', 'coffin', 'niche', 'brazier', 'urns'];
  const isBlocked = (k) => BLOCKS.includes(k);
  const isRough = (k) => k === 'rubble' || k === 'water' || k === 'bones';
  const mainEl = document.querySelector('main.sheet');
  const mapSvg = $('#mapSvg');
  const mapStage = $('#mapStage');
  const mapTok = $('#mapTok');
  const mapWrap = $('#mapWrap');
  let view = 'sheet';
  let mapKey = '';
  let tokKey = '';
  let mapTarget = null;
  let mapHover = null;
  let tokDrag = null;
  let mapDown = null;
  let mapNote = '';
  let walk = null;      // a move being shown square by square: { route, i, timer, spotted }
  let mapFoe = null;    // id of the enemy you're targeting
  let foeDrag = null;   // an enemy being dragged to a new square
  let placing = null;   // enemies waiting to be placed: { name, hp, ev, ar }
  $('#mapPick').innerHTML = Object.keys(MAPS).map((k) => '<option value="' + k + '">' + esc(MAPS[k].name) + '</option>').join('');
  const cellPx = () => { try { return window.matchMedia('(max-width: 560px)').matches ? 36 : 44; } catch (e) { return 44; } };
  function mapState() {
    const m = game.map || {};
    const id = MAPS[m.id] ? m.id : 'blank';
    const def = MAPS[id];
    const cl = (v, d) => { const n = Math.round(Number(v)); return isFinite(n) && n >= 5 ? Math.min(60, n) : d; };
    const cols = def.cols || cl(m.cols, 20);
    const rows = def.rows || cl(m.rows, 15);
    const st = def.start || { x: 2, y: Math.floor(rows / 2) };
    const t = myTok() || st;
    const x = Math.max(0, Math.min(cols - 1, t.x));
    const y = Math.max(0, Math.min(rows - 1, t.y));
    const v = game.view || {};
    const g = Number(v.grid);
    const grid = v.grid != null && isFinite(g) ? Math.max(0, Math.min(100, Math.round(g))) : (def.img ? (def.dark ? 35 : 45) : 100);
    return { id, def, cols, rows, x, y, free: !!m.free, grid, showTerrain: !!v.terrainOn, showReach: !v.reachOff, fogOff: !!m.fogOff };
  }

  // ---------- Line of sight, light and fog of war ----------
  // A square is visible when a straight line from the middle of your square reaches it without passing through
  // something that blocks sight (walls, pillars, sealed doors, burial niches, magical darkness) AND it is lit, or
  // within your sight in the dark: the farther of your darkvision and the light you carry. The squares right next
  // to you are always visible, except magical darkness, which nobody can see into or through. Low things like
  // sarcophagi, braziers, urns, rubble and broken pillars don't block sight. A line that runs exactly through a
  // corner is only blocked if both squares beside the corner block sight.
  const OPAQUE = '#Oxn';
  const fogOn = (ms) => !!ms.def.terrain && !ms.fogOff;
  const darkMap = (ms) => ms.def.light === 'dark';
  // Your sight in the dark, in feet.
  const darkvisionFt = () => { const v = Math.round(num(state.fields.darkvision)); return Math.max(0, (isNaN(v) ? 0 : v) + gear('sight')); };
  const lightFt = () => { const v = Math.round(num(state.fields.light)); return Math.max(0, isNaN(v) ? 0 : v, gear('light')); };
  const sightFt = () => Math.max(darkvisionFt(), lightFt());
  let opqMemo = { key: '', opq: null, voids: null };
  function opaqueGrid(ms) {
    const key = ms.id + '|' + ms.cols + '|' + ms.rows;
    if (opqMemo.key === key) return opqMemo.opq;
    const N = ms.cols * ms.rows;
    const opq = new Uint8Array(N);
    const voids = new Uint8Array(N);
    for (let y = 0; y < ms.rows; y++) {
      for (let x = 0; x < ms.cols; x++) {
        const i = y * ms.cols + x;
        if (ms.def.void && ms.def.void[y] && ms.def.void[y][x] === '#') { voids[i] = 1; opq[i] = 1; }
        if (ms.def.terrain && OPAQUE.indexOf(ms.def.terrain[y][x]) >= 0) opq[i] = 1;
      }
    }
    opqMemo = { key, opq, voids };
    return opq;
  }
  const isVoid = (ms, x, y) => { opaqueGrid(ms); return !!opqMemo.voids[y * ms.cols + x]; };
  // Walks the squares a line passes through, from the middle of square (px, py) to the point (tx, ty) inside square (gx, gy).
  function rayClear(opq, C, R, px, py, tx, ty, gx, gy) {
    const ox = px + 0.5, oy = py + 0.5;
    const dx = tx - ox, dy = ty - oy;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    const tdx = sx ? Math.abs(1 / dx) : Infinity;
    const tdy = sy ? Math.abs(1 / dy) : Infinity;
    let tmx = sx ? 0.5 * tdx : Infinity;
    let tmy = sy ? 0.5 * tdy : Infinity;
    let cx = px, cy = py;
    for (let guard = 0; guard < 500; guard++) {
      if (cx === gx && cy === gy) return true;
      if (Math.abs(tmx - tmy) < 1e-9) {
        if (opq[cy * C + cx + sx] && opq[(cy + sy) * C + cx]) return false;
        cx += sx; cy += sy; tmx += tdx; tmy += tdy;
      } else if (tmx < tmy) { cx += sx; tmx += tdx; } else { cy += sy; tmy += tdy; }
      if (cx < 0 || cy < 0 || cx >= C || cy >= R) return false;
      if (cx === gx && cy === gy) return true;
      if (opq[cy * C + cx]) return false;
    }
    return false;
  }
  // Points tried inside a square: its middle, then near each corner, so the face of a wall counts as seen.
  const SIGHT_PTS = [[0.5, 0.5], [0.06, 0.06], [0.94, 0.06], [0.06, 0.94], [0.94, 0.94]];
  // A clear straight line between two squares (light aside).
  function sees(ms, a, b) {
    if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1) return !isVoid(ms, b.x, b.y);
    if (!ms.def.terrain && !ms.def.void) return true;
    const opq = opaqueGrid(ms);
    return SIGHT_PTS.some((p) => rayClear(opq, ms.cols, ms.rows, a.x, a.y, b.x + p[0], b.y + p[1], b.x, b.y));
  }
  // Squares lit by the map: all of them on a lit map; on a dark map, those its light sources reach.
  let litMemo = { key: '', lit: null };
  function litGrid(ms) {
    const key = ms.id + '|' + ms.cols + '|' + ms.rows;
    if (litMemo.key === key) return litMemo.lit;
    const lit = new Uint8Array(ms.cols * ms.rows);
    if (!darkMap(ms)) lit.fill(1);
    else {
      (ms.def.lights || []).forEach((L) => {
        const r = Math.floor((L.ft || 0) / SQ_FT);
        for (let y = Math.max(0, L.y - r); y <= Math.min(ms.rows - 1, L.y + r); y++) {
          for (let x = Math.max(0, L.x - r); x <= Math.min(ms.cols - 1, L.x + r); x++) {
            if (sees(ms, L, { x, y })) lit[y * ms.cols + x] = 1;
          }
        }
      });
    }
    litMemo = { key, lit };
    return lit;
  }
  let visMemo = { key: '', vis: null };
  function visibleFrom(ms, p) {
    const sight = sightFt();
    const key = ms.id + '|' + ms.cols + '|' + ms.rows + '|' + p.x + '|' + p.y + '|' + sight;
    if (visMemo.key === key) return visMemo.vis;
    const vis = new Uint8Array(ms.cols * ms.rows);
    const lit = litGrid(ms);
    for (let y = 0; y < ms.rows; y++) {
      for (let x = 0; x < ms.cols; x++) {
        const i = y * ms.cols + x;
        const d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
        if (d > 1 && !lit[i] && d * SQ_FT > sight) continue;
        vis[i] = sees(ms, p, { x, y }) ? 1 : 0;
      }
    }
    visMemo = { key, vis };
    return vis;
  }
  // Squares the party has seen on this map, kept in the game so the map stays explored.
  let fogMem = null;
  let fogVer = 0;
  function seenFor(ms) {
    if (fogMem && fogMem.id === ms.id && fogMem.n === ms.cols * ms.rows) return fogMem.seen;
    const N = ms.cols * ms.rows;
    const seen = new Uint8Array(N);
    const rec = game.fog[ms.id];
    if (rec && rec.rev === (ms.def.rev || null) && rec.seen.length === N) for (let i = 0; i < N; i++) seen[i] = rec.seen.charCodeAt(i) === 49 ? 1 : 0;
    fogMem = { id: ms.id, n: N, seen };
    fogVer++;
    return seen;
  }
  function storeSeen(ms) {
    const seen = seenFor(ms);
    game.fog = Object.assign({}, game.fog, { [ms.id]: { rev: ms.def.rev || null, seen: Array.prototype.join.call(seen, '') } });
  }
  // Marks what you can see from square p as explored. Returns true if anything new came into view.
  function revealFrom(ms, p) {
    if (!ms.def.terrain) return false;
    const vis = visibleFrom(ms, p);
    const seen = seenFor(ms);
    let fresh = false;
    for (let i = 0; i < vis.length; i++) if (vis[i] && !seen[i]) { seen[i] = 1; fresh = true; }
    if (fresh) fogVer++;
    return fresh;
  }
  // The fog drawn as two layers of squares, softened at the edges. Past the map's edge counts as unseen,
  // so the blur doesn't leave a light rim.
  function fogMarkup(ms, p, S) {
    if (!fogOn(ms)) return '';
    const vis = visibleFrom(ms, p);
    const seen = seenFor(ms);
    let dark = '';
    let dim = '';
    for (let y = -1; y <= ms.rows; y++) {
      let runK = 0, run0 = 0;
      for (let x = -1; x <= ms.cols + 1; x++) {
        let k = 0;
        if (x > ms.cols) k = -1;
        else if (x < 0 || y < 0 || x >= ms.cols || y >= ms.rows) k = 2;
        else { const i = y * ms.cols + x; k = vis[i] ? 0 : seen[i] ? 1 : 2; }
        if (k !== runK) {
          if (runK > 0) {
            const d = 'M' + (MAP_EDGE + run0 * S) + ' ' + (MAP_EDGE + y * S) + 'h' + ((x - run0) * S) + 'v' + S + 'h' + (-(x - run0) * S) + 'z';
            if (runK === 2) dark += d; else dim += d;
          }
          runK = k;
          run0 = x;
        }
      }
    }
    return '<path class="m-fog-dim" d="' + dim + '"/><path class="m-fog-dark" d="' + dark + '"/>';
  }

  // ---------- Enemies on the map ----------
  function foeById(id) { return game.foes.find((f) => f.id === id) || null; }
  const foesHere = (ms) => game.foes.filter((f) => f.map === ms.id && f.x < ms.cols && f.y < ms.rows);
  const foeDown = (f) => f.hp <= 0;
  // Standing enemies take up their square: you can't move through or onto it. Downed ones don't.
  const foeAt = (ms, x, y, skip) => game.foes.find((f) => f.map === ms.id && f.x === x && f.y === y && f.id !== skip && !foeDown(f)) || null;
  const anyFoeAt = (ms, x, y, skip) => game.foes.find((f) => f.map === ms.id && f.x === x && f.y === y && f.id !== skip) || null;
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  function rangeOf(w) { return w && w.range > 5 ? w.range : 5; }
  // "Draugr 2" shows as D2 on its token, "Bone Archer" as BA.
  function foeLabel(f) {
    const w = f.name.trim().split(/\s+/);
    const n = w.length > 1 && /^\d+$/.test(w[w.length - 1]) ? w.pop() : '';
    return (w.slice(0, n ? 1 : 2).map((s) => s.charAt(0)).join('').toUpperCase() || '?') + n;
  }
  // Whether an enemy can be seen right now (always, with fog of war off or while placing enemies).
  function foeSeen(ms, f, p) {
    if (!fogOn(ms) || placing) return true;
    return !!visibleFrom(ms, p)[f.y * ms.cols + f.x];
  }
  // What you know about a square: one you haven't seen yet counts as open floor until you find out otherwise.
  const unseenAt = (ms, x, y) => fogOn(ms) && !ms.free && !seenFor(ms)[y * ms.cols + x];
  const knownKind = (ms, x, y) => (unseenAt(ms, x, y) ? 'floor' : kindAt(ms, x, y));
  // Enemies you know are there: the ones you can see right now (all of them with fog of war off).
  const knownFoes = (ms) => { const at = { x: ms.x, y: ms.y }; return foesHere(ms).filter((f) => foeSeen(ms, f, at)); };
  // Your attack options with what's in your hands, the same ones the Attacks panel shows.
  function attackOptions() {
    const mainW = itemById(state.equip.main);
    const offW = itemById(state.equip.off);
    const dual = dualReady();
    const out = [];
    if (mainW && TYPES[mainW.type].weapon) out.push({ slot: 'main', w: mainW, label: mainW.name, range: rangeOf(mainW) });
    if (offW && TYPES[offW.type].weapon && !(mainW && mainW.type === 'twohand')) out.push({ slot: 'off', w: offW, label: offW.name, range: rangeOf(offW) });
    if (dual) out.push({ slot: 'dual', w: mainW, label: 'Both weapons', range: Math.min(rangeOf(mainW), rangeOf(offW)) });
    return out;
  }
  const inReachFrom = (ms, from, f, range) => cheb(from, f) * SQ_FT <= range && sees(ms, from, f);
  const kindAt = (ms, x, y) => (ms.def.terrain ? TERRAIN[ms.def.terrain[y][x]] || 'floor' : 'floor');
  const linkAt = (ms, x, y) => (ms.def.terrain ? (ms.def.links || []).find((l) => ms.def.terrain[y][x] === l.ch) || null : null);
  // When a map that comes with the sheet is redrawn, a token saved on the old version goes back to the start.
  function syncMapRev() {
    const m = game.map || {};
    const def = MAPS[m.id];
    if (!def || !def.rev || m.rev === def.rev) return;
    game.map = Object.assign({}, m, { rev: def.rev });
    if (def.start) setTok({ x: def.start.x, y: def.start.y });
    save();
  }
  // Taking the stairs: switch to the linked map and arrive on its landing. The move onto the stairs already paid.
  function takeLink(lk) {
    const def = MAPS[lk.to];
    if (!def) return;
    game.map = Object.assign({}, game.map, { id: lk.to, rev: def.rev || null });
    game.view = Object.assign({}, game.view, { grid: null });
    setTok({ x: lk.arrive.x, y: lk.arrive.y });
    apUndo = null;
    mapTarget = null;
    mapHover = null;
    mapFoe = null;
    placing = null;
    mapNote = lk.done;
    toastEl.hidden = true;
    refreshAll();
    save();
    centerToken();
    mapSvg.focus({ preventScroll: true });
  }
  function colName(i) {
    let s = '';
    let n = i + 1;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  const cellName = (c) => colName(c.x) + (c.y + 1);
  const sameCell = (a, b) => !!(a && b && a.x === b.x && a.y === b.y);
  const freeFeet = () => moveNow().left + surgeLeft() * speedNow();
  // Shared pathfinder: unknown fog tiles are treated as open floor. Only
  // visible opponents enter occupancy planning; a walk rechecks each step.
  let pathMemo = { key: '', dist: null, to: null };
  function paths(ms, target = null) {
    const visible = knownFoes(ms);
    const fog = fogOn(ms) && !ms.free;
    const key = [ms.id,ms.cols,ms.rows,ms.x,ms.y,
      target ? target.x + ',' + target.y : 'all',
      visible.map(f=>f.id+':'+f.x+','+f.y+':'+f.hp).join(';'),
      fog ? fogVer : 'all'].join('|');
    if(pathMemo.key===key)return pathMemo;
    const plan=window.WBRouting.findPaths({
      cols:ms.cols,rows:ms.rows,start:{x:ms.x,y:ms.y},
      terrain:ms.def.terrain||[],
      side:'party',
      occupants:visible.map(f=>({x:f.x,y:f.y,hp:f.hp,side:'enemy'})),
      seen:fog?seenFor(ms):null,
      goal:target
    });
    pathMemo={key,...plan};
    return pathMemo;
  }
  function routeTo(ms,t) {
    const route=paths(ms,t).to(t.x,t.y);
    return route.ok?route.path:[];
  }
  function cellFromPoint(cx, cy) {
    const ms = mapState();
    const S = cellPx();
    const r = mapStage.getBoundingClientRect();
    const x = Math.floor((cx - r.left - MAP_EDGE) / S);
    const y = Math.floor((cy - r.top - MAP_EDGE) / S);
    return x >= 0 && y >= 0 && x < ms.cols && y < ms.rows ? { x, y } : null;
  }
  // What a move to square t costs, and whether you can afford it.
  function mapPlan(t) {
    const ms = mapState();
    const k = ms.free ? kindAt(ms, t.x, t.y) : knownKind(ms, t.x, t.y);
    if (isBlocked(k)) return { ft: null, ok: false, text: 'That square is ' + TERRAIN_NAME[k] + '.' };
    const fa = ms.free ? anyFoeAt(ms, t.x, t.y) : knownFoes(ms).find((f) => f.x === t.x && f.y === t.y);
    if (fa) return { ft: null, ok: false, text: fa.name + (foeDown(fa) ? ' is lying there.' : ' is standing there.') };
    if (ms.free) return { ft: null, ok: true, text: 'Free placement, so no AP is spent.' };
    const ft = Math.round(paths(ms,t).dist[t.y * ms.cols + t.x]);
    if (!isFinite(ft)) return { ft: null, ok: false, text: 'There’s no way through to there.' };
    const way = routeTo(ms, t).slice(1);
    const rough = way.filter((c) => isRough(knownKind(ms, c.x, c.y))).length;
    const unknown = way.some((c) => unseenAt(ms, c.x, c.y));
    const roughNote = rough ? ' (' + rough + (rough === 1 ? ' square' : ' squares') + ' of difficult terrain at 10 ft)' : '';
    const unknownNote = unknown ? ' Part of the way is through squares you haven’t seen.' : '';
    const p = movePlan(ft);
    if (!p.sp && p.fromLeft < p.ft) return { ft, ok: false, text: ft + ' ft' + roughNote + '. Your Movement is 0' + (moveNow().left ? ' and you only have ' + moveNow().left + ' ft left over.' : '.') };
    if (p.paid > apHave()) return { ft, ok: false, text: ft + ' ft' + roughNote + ' costs ' + planText(p) + '. You have ' + apHave() + ' AP.' };
    return { ft, ok: true, text: ft + ' ft' + roughNote + ' costs ' + planText(p) + (p.leftAfter ? ', leaving ' + p.leftAfter + ' ft over.' : '.') + unknownNote };
  }
  function tokenFace() {
    const f = activeForm();
    if (f) return '<img src="' + f.src + '" alt="">';
    const nm = String(state.fields.charName || '').trim();
    const ini = nm ? nm.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '?';
    return '<span>' + esc(ini) + '</span>';
  }
  function renderMap(force) {
    if (view !== 'map') return;
    syncMapRev();
    const ms = mapState();
    const S = cellPx();
    const nm = String(state.fields.charName || '').trim() || 'Your character';
    // Heads-up line: who, where, AP and how far you can still go.
    $('#hudName').textContent = nm;
    $('#hudAt').textContent = (ms.def.short ? ms.def.short + ' · ' : '') + 'Square ' + cellName(ms);
    const g = givenAp();
    $('#hudAp').textContent = apTracker.avail() + '/' + apTracker.max() + (g ? ' + ' + g : '');
    $('#hudMoved').textContent = moveNow().ft + ' ft';
    $('#hudReach').textContent = ms.free ? 'Anywhere' : maxMove() + ' ft';
    // Sight: on a dark map, how far you see without the map's own light.
    const sf = sightFt();
    $('#hudSight').textContent = darkMap(ms) ? (sf ? sf + ' ft' : 'Next to you') : 'Lit';
    $('#hudSightLab').textContent = darkMap(ms) ? 'Sight in the dark' : 'Sight';
    renderLightPick();
    $('#mapFree').checked = ms.free;
    $('#mapReach').checked = ms.showReach;
    $('#mapPick').value = ms.id;
    $('#mapTerrain').checked = ms.showTerrain;
    $('#mapTerrain').closest('label').hidden = !ms.def.terrain;
    $('#fogOpt').hidden = !ms.def.terrain;
    $('#mapFog').checked = fogOn(ms);
    $('#fogReset').hidden = !fogOn(ms);
    if (document.activeElement !== $('#mapGrid')) $('#mapGrid').value = String(ms.grid);
    $('#mapGridVal').textContent = ms.grid + '%';
    const fixed = !!ms.def.cols;
    $('#sizeIn').hidden = fixed;
    $('#sizeFixed').hidden = !fixed;
    $('#sizeFixed').textContent = ms.cols + ' × ' + ms.rows + ' squares, set by the map';
    const ci = $('#mapCols');
    const ri = $('#mapRows');
    if (document.activeElement !== ci) ci.value = String(ms.cols);
    if (document.activeElement !== ri) ri.value = String(ms.rows);
    const f = activeForm();
    const tk = (f ? f.id + ':' + f.src.length : 'none') + '|' + nm;
    if (tk !== tokKey) {
      tokKey = tk;
      const face = tokenFace();
      mapTok.innerHTML = face;
      $('#hudToken').innerHTML = face;
    }
    mapTok.setAttribute('aria-label', nm + ' on square ' + cellName(ms));
    // While a move is being walked, the token and the fog follow it square by square.
    const at = walk ? walk.route[walk.i] : { x: ms.x, y: ms.y };
    if (revealFrom(ms, at) && !walk) { storeSeen(ms); save(); }
    const shade = !ms.free && !walk && ms.showReach;
    const reachFt = shade ? maxMove() : -1;
    const freeFt = shade ? freeFeet() : -1;
    const foeKey = (walk ? [] : knownFoes(ms)).filter((x) => !foeDown(x)).map((x) => x.x + ',' + x.y).join(';');
    const key = [ms.id, ms.cols, ms.rows, ms.x, ms.y, ms.free, ms.grid, ms.showTerrain, reachFt, freeFt, S, !!walk, foeKey, fogOn(ms) ? fogVer : 'off', sf].join('|');
    placeTok(at, S);
    renderFoes(ms, at, S);
    renderFoeList(ms);
    if (force || key !== mapKey) {
      mapKey = key;
      const W = MAP_EDGE + ms.cols * S + 1;
      const H = MAP_EDGE + ms.rows * S + 1;
      const X = (x) => MAP_EDGE + x * S;
      const Y = (y) => MAP_EDGE + y * S;
      const pm = paths(ms);
      // Squares within reach, as one rectangle per run along each row, plus an outline around the area.
      const area = (limit, cls) => {
        if (limit < SQ_FT) return '';
        let rects = '';
        let edges = '';
        // Shading only goes on squares you've seen, so it never draws over the fog.
        const inside = (x, y) => x >= 0 && y >= 0 && x < ms.cols && y < ms.rows && Math.round(pm.dist[y * ms.cols + x]) <= limit && !unseenAt(ms, x, y);
        for (let y = 0; y < ms.rows; y++) {
          let run = -1;
          for (let x = 0; x <= ms.cols; x++) {
            const on = x < ms.cols && inside(x, y);
            if (on && run < 0) run = x;
            if (!on && run >= 0) { rects += '<rect class="' + cls + '" x="' + X(run) + '" y="' + Y(y) + '" width="' + ((x - run) * S) + '" height="' + S + '"/>'; run = -1; }
            if (on) {
              if (!inside(x, y - 1)) edges += 'M' + X(x) + ' ' + (Y(y) + 0.5) + 'H' + X(x + 1);
              if (!inside(x, y + 1)) edges += 'M' + X(x) + ' ' + (Y(y + 1) - 0.5) + 'H' + X(x + 1);
              if (!inside(x - 1, y)) edges += 'M' + (X(x) + 0.5) + ' ' + Y(y) + 'V' + Y(y + 1);
              if (!inside(x + 1, y)) edges += 'M' + (X(x + 1) - 0.5) + ' ' + Y(y) + 'V' + Y(y + 1);
            }
          }
        }
        return rects + (edges ? '<path class="m-edge' + (cls === 'm-free' ? ' free' : '') + '" d="' + edges + '"/>' : '');
      };
      let terr = '';
      if (ms.showTerrain && ms.def.terrain) {
        for (let y = 0; y < ms.rows; y++) {
          for (let x = 0; x < ms.cols; x++) {
            const k = kindAt(ms, x, y);
            if (isBlocked(k)) terr += '<rect class="m-wall" x="' + X(x) + '" y="' + Y(y) + '" width="' + S + '" height="' + S + '"/><rect class="m-wallbox" x="' + (X(x) + 2.5) + '" y="' + (Y(y) + 2.5) + '" width="' + (S - 5) + '" height="' + (S - 5) + '"/>';
            else if (isRough(k)) terr += '<rect class="m-rough" x="' + X(x) + '" y="' + Y(y) + '" width="' + S + '" height="' + S + '"/>';
            else if (k === 'stairs') terr += '<rect class="m-stairs" x="' + (X(x) + 2.5) + '" y="' + (Y(y) + 2.5) + '" width="' + (S - 5) + '" height="' + (S - 5) + '"/>';
          }
        }
      }
      // A marker in the middle of each set of stairs, so it's clear they lead somewhere.
      let marks = '';
      (ms.def.links || []).forEach((lk) => {
        let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
        ms.def.terrain.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === lk.ch) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } });
        if (x1 < 0) return;
        const mx = (X(x0) + X(x1 + 1)) / 2, my = (Y(y0) + Y(y1 + 1)) / 2;
        const ar = lk.dir === 'up' ? 'M' + (mx - 6) + ' ' + (my + 3) + 'L' + mx + ' ' + (my - 4) + 'L' + (mx + 6) + ' ' + (my + 3)
          : 'M' + (mx - 6) + ' ' + (my - 3) + 'L' + mx + ' ' + (my + 4) + 'L' + (mx + 6) + ' ' + (my - 3);
        marks += '<g class="m-link"><circle cx="' + mx + '" cy="' + my + '" r="13"/><path d="' + ar + '"/></g>';
      });
      let d = '';
      for (let i = 0; i <= ms.cols; i++) d += 'M' + (X(i) + 0.5) + ' ' + MAP_EDGE + 'V' + (H - 0.5);
      for (let j = 0; j <= ms.rows; j++) d += 'M' + MAP_EDGE + ' ' + (Y(j) + 0.5) + 'H' + (W - 0.5);
      let labs = '';
      for (let i = 0; i < ms.cols; i++) labs += '<text class="m-lab" x="' + (X(i) + S / 2) + '" y="' + (MAP_EDGE - 8) + '" text-anchor="middle">' + colName(i) + '</text>';
      for (let j = 0; j < ms.rows; j++) labs += '<text class="m-lab" x="' + (MAP_EDGE - 6) + '" y="' + (Y(j) + S / 2 + 4) + '" text-anchor="end">' + (j + 1) + '</text>';
      mapSvg.setAttribute('width', String(W));
      mapSvg.setAttribute('height', String(H));
      mapSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      mapSvg.classList.toggle('has-img', !!ms.def.img);
      mapSvg.classList.toggle('dark-map', !!ms.def.dark);
      mapSvg.innerHTML =
        '<defs>' +
          '<pattern id="mHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="m-hatch" x1="0" y1="0" x2="0" y2="8"/></pattern>' +
          '<pattern id="mDots" width="9" height="9" patternUnits="userSpaceOnUse"><circle class="m-dot" cx="4.5" cy="4.5" r="1.6"/></pattern>' +
          '<clipPath id="mClip"><rect x="' + MAP_EDGE + '" y="' + MAP_EDGE + '" width="' + (ms.cols * S) + '" height="' + (ms.rows * S) + '"/></clipPath>' +
          '<filter id="mBlur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="' + (S * 0.14).toFixed(1) + '"/></filter>' +
        '</defs>' +
        '<rect class="m-floor" x="' + MAP_EDGE + '" y="' + MAP_EDGE + '" width="' + (ms.cols * S) + '" height="' + (ms.rows * S) + '"/>' +
        (ms.def.img ? '<image href="' + esc(ms.def.img) + '" x="' + MAP_EDGE + '" y="' + MAP_EDGE + '" width="' + (ms.cols * S) + '" height="' + (ms.rows * S) + '" preserveAspectRatio="none"/>' : '') +
        terr +
        (ms.grid > 0 ? '<path class="m-grid" stroke-opacity="' + (ms.grid / 100) + '" d="' + d + '"/>' : '') +
        marks +
        '<g id="mapFogLayer" class="m-fog" clip-path="url(#mClip)"><g filter="url(#mBlur)" id="mapFogIn"></g></g>' +
        area(reachFt, 'm-reach') + area(freeFt, 'm-free') +
        labs + '<g id="mapOver"></g>';
      mapStage.style.width = W + 'px';
      mapStage.style.height = H + 'px';
      fogDrawn = '';
    }
    renderFog(ms, at, S);
    renderMapOverlay();
  }
  // The token sits over its square (or the square it has walked to so far).
  function placeTok(at, S) {
    const pad = Math.round(S * 0.1);
    mapTok.style.width = mapTok.style.height = (S - 2 * pad) + 'px';
    mapTok.style.left = (MAP_EDGE + at.x * S + pad) + 'px';
    mapTok.style.top = (MAP_EDGE + at.y * S + pad) + 'px';
    mapTok.style.fontSize = Math.round(S * 0.36) + 'px';
  }
  let fogDrawn = '';
  function renderFog(ms, at, S) {
    const fk = [ms.id, ms.cols, S, fogOn(ms), fogVer, at.x, at.y, !!placing, sightFt()].join('|');
    if (fk === fogDrawn) return;
    const g = document.getElementById('mapFogIn');
    if (!g) return;
    fogDrawn = fk;
    g.innerHTML = fogMarkup(ms, at, S);
    document.getElementById('mapFogLayer').classList.toggle('lifted', !!placing);
  }
  // Enemy tokens: shown where you can see them, with a Health bar, and a ring on the one you're targeting.
  let foeEls = {};
  let foeVisible = {};
  function renderFoes(ms, at, S) {
    const box = $('#mapFoes');
    const here = foesHere(ms);
    const pad = Math.round(S * 0.1);
    const keep = {};
    here.forEach((f) => {
      keep[f.id] = true;
      let el = foeEls[f.id];
      if (!el || !el.isConnected) {
        el = document.createElement('div');
        el.className = 'map-foe';
        el.dataset.id = f.id;
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        el.innerHTML = '<span class="foe-disc"></span><span class="foe-hp"><span></span></span>';
        box.appendChild(el);
        foeEls[f.id] = el;
      }
      const shown = foeSeen(ms, f, at);
      const dragging = foeDrag && foeDrag.id === f.id && foeDrag.moved;
      if (shown && !foeVisible[f.id] && !reduceMotion && walk) { el.classList.remove('spotted'); void el.offsetWidth; el.classList.add('spotted'); }
      if (shown && !foeVisible[f.id] && walk) walk.spotted.push(f.id);
      foeVisible[f.id] = shown;
      el.hidden = !shown;
      el.classList.toggle('down', foeDown(f));
      el.classList.toggle('targeted', mapFoe === f.id);
      el.style.width = el.style.height = (S - 2 * pad) + 'px';
      if (!dragging) {
        el.style.left = (MAP_EDGE + f.x * S + pad) + 'px';
        el.style.top = (MAP_EDGE + f.y * S + pad) + 'px';
      }
      const disc = el.firstChild;
      const lab = foeLabel(f);
      if (disc.textContent !== lab) disc.textContent = lab;
      disc.style.fontSize = Math.round(S * (lab.length > 2 ? 0.27 : 0.33)) + 'px';
      el.lastChild.firstChild.style.width = Math.max(0, Math.min(100, (f.hp / f.max) * 100)) + '%';
      el.setAttribute('aria-label', f.name + ', ' + (foeDown(f) ? 'down' : 'Health ' + f.hp + ' of ' + f.max) + ', on square ' + cellName(f) + '. Tap to target.');
    });
    Object.keys(foeEls).forEach((id) => { if (!keep[id]) { foeEls[id].remove(); delete foeEls[id]; delete foeVisible[id]; } });
    if (mapFoe && (!keep[mapFoe] || !foeVisible[mapFoe])) mapFoe = null;
  }
  // Standing on stairs shows a small prompt above the token: "Stairs down into the barrow · Go down".
  function renderPrompt() {
    const ms = mapState();
    const box = $('#mapPrompt');
    const lk = tokDrag || walk || placing ? null : linkAt(ms, ms.x, ms.y);
    box.hidden = !lk;
    if (!lk) return;
    $('#mapPromptWhat').textContent = lk.what;
    const btn = $('#mapPromptGo');
    btn.textContent = lk.go;
    btn.onclick = () => takeLink(lk);
    const S = cellPx();
    const stageW = parseFloat(mapStage.style.width) || mapStage.clientWidth;
    const w = box.offsetWidth;
    const cx = MAP_EDGE + ms.x * S + S / 2;
    box.style.left = Math.max(4, Math.min(stageW - w - 4, cx - w / 2)) + 'px';
    const above = MAP_EDGE + ms.y * S - box.offsetHeight - 8;
    box.style.top = (above > 4 ? above : MAP_EDGE + (ms.y + 1) * S + 8) + 'px';
  }
  // The route, target square and cost for the square you're pointing at, dragging to or have picked.
  function renderMapOverlay() {
    renderPrompt();
    const gEl = document.getElementById('mapOver');
    if (!gEl) return;
    const ms = mapState();
    const S = cellPx();
    const t = tokDrag ? tokDrag.cur : (mapTarget || mapHover);
    const plan = $('#mapPlan');
    const go = $('#mapGo');
    $('#mapUndo').hidden = !(apUndo && apUndo.label === 'move') || !!walk;
    renderFoePanel(ms);
    if (walk) {
      gEl.innerHTML = '';
      go.hidden = true;
      plan.textContent = 'Moving to ' + cellName(walk.route[walk.route.length - 1]) + '…';
      return;
    }
    if (placing) {
      const h = mapTarget || mapHover;
      const ok = h && placeOk(ms, h);
      gEl.innerHTML = h ? '<rect class="m-target' + (ok ? '' : ' bad') + '" x="' + (MAP_EDGE + h.x * S + 1.5) + '" y="' + (MAP_EDGE + h.y * S + 1.5) + '" width="' + (S - 2) + '" height="' + (S - 2) + '"/>' : '';
      go.hidden = true;
      plan.textContent = (mapNote ? mapNote + ' ' : '') + 'Tap empty squares to place ' + placing.name + '. Each tap adds one.';
      return;
    }
    if (!t || sameCell(t, ms)) {
      gEl.innerHTML = '';
      go.hidden = true;
      const lk = linkAt(ms, ms.x, ms.y);
      plan.textContent = mapNote || (lk ? 'You’re on the ' + lk.what.charAt(0).toLowerCase() + lk.what.slice(1) + '. ' + lk.go + ', or keep moving.'
        : ms.free ? 'Free placement: drag your token anywhere that isn’t a wall. No AP is spent.'
        : 'Drag your token, or tap a square to see what it costs. You can go ' + maxMove() + ' ft right now.');
      return;
    }
    const info = mapPlan(t);
    const c = (v) => MAP_EDGE + v * S + S / 2;
    const bad = info.ok ? '' : ' bad';
    const route = ms.free ? [{ x: ms.x, y: ms.y }, t] : routeTo(ms, t);
    const line = route.length > 1 ? '<path class="m-path' + bad + '" d="' + route.map((p, i) => (i ? 'L' : 'M') + c(p.x) + ' ' + c(p.y)).join('') + '"/>' : '';
    const tagY = t.y === 0 ? MAP_EDGE + S + 14 : MAP_EDGE + t.y * S - 5;
    gEl.innerHTML = line +
      '<rect class="m-target' + bad + '" x="' + (MAP_EDGE + t.x * S + 1.5) + '" y="' + (MAP_EDGE + t.y * S + 1.5) + '" width="' + (S - 2) + '" height="' + (S - 2) + '"/>' +
      (info.ft != null ? '<text class="m-tag" x="' + c(t.x) + '" y="' + tagY + '" text-anchor="middle">' + info.ft + ' ft</text>' : '');
    plan.textContent = cellName(ms) + ' to ' + cellName(t) + ': ' + info.text + (mapTarget && !tokDrag && info.ok ? ' Tap it again to move.' : '');
    go.hidden = !(mapTarget && !tokDrag && info.ok);
    go.textContent = 'Move to ' + cellName(t);
  }
  function mapMoveTo(t) {
    const ms = mapState();
    const info = mapPlan(t);
    mapTarget = null;
    mapHover = null;
    if (sameCell(t, ms) || !info.ok) { renderMap(); return; }
    const ft = info.ft;
    if (ms.free) {
      setTok({ x: t.x, y: t.y });
      mapNote = '';
      refreshAll();
      save();
      centerOn(t);
      return;
    }
    const route = routeTo(ms, t);
    // What you could pay for before this move, so something found on the way can't make you overspend.
    const budget = maxMove();
    const p = spendMove(ft);
    if (!p) { renderMap(); return; }
    const snap = apUndo.data;
    setTok({ x: t.x, y: t.y });
    // On the map the result shows under the grid with its own Undo, so no pop-up covers the squares.
    toastEl.hidden = true;
    mapNote = '';
    startWalk({ route, planned: ft, budget, snap, plan: p });
    refreshAll();
    save();
  }
  // Showing a move: the token steps along its route one square at a time, the fog clears as it goes and the view
  // stays centered on it. The route was planned on what you knew, so before each step the next square (which is
  // right next to you by then, so you can see it) is checked for something you couldn't see: a wall or obstacle,
  // an enemy in the way, or difficult terrain that costs more than you have left. The walk stops there and you
  // only pay for the distance you actually walked.
  const STEP_MS = 130;
  function startWalk(w) {
    endWalk();
    if (w.route.length < 2) return;
    walk = Object.assign({ i: 0, timer: null, spotted: [], ft: 0, stop: '' }, w);
    if (reduceMotion) { while (walk && stepOnce()) { /* walk it all at once */ } endWalk(); return; }
    mapTok.style.setProperty('--step', STEP_MS + 'ms');
    mapTok.classList.add('walking');
    walk.timer = setTimeout(stepWalk, 40);
  }
  // Why the next step can't be taken, or '' if it can.
  function walkBlock(ms, cur, next, last) {
    const k = kindAt(ms, next.x, next.y);
    if (isBlocked(k)) return 'There’s ' + TERRAIN_NAME[k] + ' at ' + cellName(next) + '.';
    const dx = next.x - cur.x, dy = next.y - cur.y;
    if (dx && dy && isBlocked(kindAt(ms, cur.x + dx, cur.y)) && isBlocked(kindAt(ms, cur.x, cur.y + dy))) return 'You can’t squeeze past the corner at ' + cellName(next) + '.';
    const f = anyFoeAt(ms, next.x, next.y);
    if (f && (!foeDown(f) || last)) return f.name + (foeDown(f) ? ' is lying at ' : ' is in the way at ') + cellName(next) + '.';
    return '';
  }
  // One square further. Returns false when the walk is over, finished or stopped.
  function stepOnce() {
    const ms = mapState();
    const cur = walk.route[walk.i];
    const next = walk.route[walk.i + 1];
    if (!next) return false;
    const why = walkBlock(ms, cur, next, walk.i + 1 === walk.route.length - 1);
    if (why) { walk.stop = why; return false; }
    const cost = isRough(kindAt(ms, next.x, next.y)) ? 2 * SQ_FT : SQ_FT;
    if (walk.ft + cost > walk.budget) { walk.stop = 'The ' + TERRAIN_NAME[kindAt(ms, next.x, next.y)] + ' at ' + cellName(next) + ' takes more movement than you have left.'; return false; }
    walk.ft += cost;
    walk.i++;
    revealFrom(ms, next);
    return true;
  }
  function stepWalk() {
    if (!walk) return;
    if (!stepOnce()) { endWalk(); return; }
    const ms = mapState();
    const S = cellPx();
    const at = walk.route[walk.i];
    placeTok(at, S);
    renderFoes(ms, at, S);
    renderFog(ms, at, S);
    centerOn(at);
    walk.timer = setTimeout(stepWalk, STEP_MS);
  }
  function endWalk() {
    if (!walk) return;
    clearTimeout(walk.timer);
    const w = walk;
    walk = null;
    mapTok.classList.remove('walking');
    const ms = mapState();
    const at = w.route[w.i];
    w.route.slice(0, w.i + 1).forEach((c) => revealFrom(ms, c));
    storeSeen(ms);
    let p = w.plan;
    if (w.i < w.route.length - 1 || w.ft !== w.planned) {
      // Pay for what you actually walked: put things back as they were before the move, then spend again.
      const snap = JSON.parse(w.snap);
      setTok(snap.token);
      delete snap.token;
      Object.assign(state, snap);
      apUndo = null;
      p = w.ft > 0 ? spendMove(w.ft) || null : null;
      if (w.ft > 0 && !p) p = spendMove(w.planned) || w.plan;
      setTok(at);
    }
    const back = w.plan.paid - (p && w.ft > 0 ? p.paid : 0);
    mapNote = (w.stop ? w.stop + ' ' : '') + (w.ft
      ? 'Moved ' + w.ft + ' ft to ' + cellName(at) + ' using ' + planText(p) + (back > 0 ? ' (' + back + ' AP back)' : back < 0 ? ' (' + (-back) + ' more AP than planned)' : '') + '. ' + leftText() + (p.leftAfter ? ', and ' + p.leftAfter + ' ft left over.' : '.')
      : 'You didn’t move, so nothing was spent.');
    const spotted = w.spotted.map(foeById).filter((f) => f && !foeDown(f) && w.stop.indexOf(f.name + ' ') !== 0);
    if (spotted.length) mapNote += ' You spot ' + listJoin(spotted.map((f) => f.name)) + '.';
    refreshAll();
    save();
    centerOn(at);
  }
  // Scrolls the map so a square sits in the middle of what's showing.
  function centerOn(c, instant) {
    const S = cellPx();
    const left = Math.max(0, MAP_EDGE + c.x * S + S / 2 - mapWrap.clientWidth / 2);
    const top = Math.max(0, MAP_EDGE + c.y * S + S / 2 - mapWrap.clientHeight / 2);
    try { mapWrap.scrollTo({ left, top, behavior: instant || reduceMotion ? 'auto' : 'smooth' }); } catch (e) { mapWrap.scrollLeft = left; mapWrap.scrollTop = top; }
  }

  // ---------- Targeting and placing enemies ----------
  // A square an enemy can stand on: not blocked, not your square, nobody else there.
  function placeOk(ms, c, skipId) {
    return !isBlocked(kindAt(ms, c.x, c.y)) && !sameCell(c, ms) && !anyFoeAt(ms, c.x, c.y, skipId);
  }
  // The nearest square you can walk to from which an enemy is in reach and in sight.
  let approachMemo = { key: '', cell: null };
  function approachSquare(ms, f, range) {
    const pm = paths(ms);
    const key = pm.key + '|' + f.id + '|' + f.x + ',' + f.y + '|' + range;
    if (approachMemo.key === key) return approachMemo.cell;
    const r = Math.floor(range / SQ_FT);
    let best = null;
    let bd = Infinity;
    for (let y = Math.max(0, f.y - r); y <= Math.min(ms.rows - 1, f.y + r); y++) {
      for (let x = Math.max(0, f.x - r); x <= Math.min(ms.cols - 1, f.x + r); x++) {
        const d = pm.dist[y * ms.cols + x];
        if (!isFinite(d) || d >= bd || anyFoeAt(ms, x, y)) continue;
        if (!sees(ms, { x, y }, f)) continue;
        best = { x, y };
        bd = d;
      }
    }
    approachMemo = { key, cell: best };
    return best;
  }
  function targetFoe(id) {
    const ms = mapState();
    const f = foeById(id);
    if (!f || walk) return;
    mapNote = '';
    if (mapFoe === id) { mapFoe = null; mapTarget = null; renderMap(); return; }
    mapFoe = id;
    mapTarget = null;
    // Out of reach: show the way to the nearest square you could attack from.
    const opts = attackOptions();
    if (!foeDown(f) && opts.length && !ms.free) {
      const best = Math.max(...opts.map((o) => o.range));
      if (!inReachFrom(ms, ms, f, best)) mapTarget = approachSquare(ms, f, best);
    }
    renderMap();
  }
  function renderFoePanel(ms) {
    const box = $('#foePanel');
    const f = mapFoe ? foeById(mapFoe) : null;
    if (!f || f.map !== ms.id || placing) { box.hidden = true; box.innerHTML = ''; return; }
    const dist = cheb(ms, f) * SQ_FT;
    const opts = attackOptions();
    const seeIt = sees(ms, ms, f);
    let btns = '';
    let hint = '';
    let goTo = null;
    if (foeDown(f)) hint = f.name + ' is down.';
    else if (!opts.length) hint = 'You have no weapon in hand. Equip one on the Sheet to attack.';
    else {
      btns = opts.map((o) => {
        const ok = !walk && dist <= o.range && seeIt;
        return '<button type="button" class="btn' + (ok ? ' strong' : '') + '" data-foe-atk="' + o.slot + '"' + (ok ? '' : ' disabled') + '>' + esc(o.label) + ' · ' + apCost(mod(o.w.stat)) + ' AP</button>';
      }).join('');
      const best = Math.max(...opts.map((o) => o.range));
      if (dist > best || !seeIt) {
        hint = dist <= best ? 'Something is in the way between you and ' + f.name + '.'
          : f.name + ' is ' + dist + ' ft away and ' + (opts.length === 1 ? 'your ' + (opts[0].slot === 'dual' ? 'weapons reach ' : opts[0].w.name + ' reaches ') + opts[0].range + ' ft.' : 'your longest reach is ' + best + ' ft.');
        goTo = ms.free || walk ? null : approachSquare(ms, f, best);
        hint += goTo ? ' Move to ' + cellName(goTo) + ' to get in reach.' : ms.free ? '' : ' There’s no square in reach you can get to right now.';
      } else if (opts.some((o) => dist > o.range)) {
        hint = 'Only some of your weapons reach from here.';
      }
    }
    const facts = cellName(f) + ' · ' + dist + ' ft away · ' + (foeDown(f) ? 'Down' : 'Health ' + f.hp + '/' + f.max) + ' · Evasion ' + f.ev + ' · Armor Rating ' + f.ar;
    box.hidden = false;
    box.classList.toggle('down', foeDown(f));
    box.innerHTML =
      '<div class="foe-top"><span class="foe-chip">' + esc(foeLabel(f)) + '</span>' +
        '<span class="foe-title"><span class="foe-name">' + esc(f.name) + '</span><span class="foe-facts">' + facts + '</span></span>' +
        '<button type="button" class="xbtn" data-foe-close aria-label="Stop targeting ' + esc(f.name) + '">×</button></div>' +
      '<div class="foe-atks">' + btns + (goTo && !sameCell(goTo, mapTarget) ? '<button type="button" class="btn" data-foe-go="' + goTo.x + ',' + goTo.y + '">Show the way to ' + cellName(goTo) + '</button>' : '') + '</div>' +
      '<p class="hint">' + esc(hint) + '</p>';
  }
  $('#foePanel').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || walk) return;
    if (b.hasAttribute('data-foe-close')) { mapFoe = null; mapTarget = null; renderMap(); return; }
    if (b.dataset.foeGo) { const [x, y] = b.dataset.foeGo.split(',').map(Number); mapTarget = { x, y }; renderMapOverlay(); return; }
    if (b.dataset.foeAtk && mapFoe) attackWith(b.dataset.foeAtk, mapFoe);
  });
  // Enemy tokens: tap to target, drag to move (no AP, it's the DM moving them).
  const foesBox = $('#mapFoes');
  foesBox.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.map-foe');
    if (!el || e.button !== 0 || walk) return;
    e.preventDefault();
    foeDrag = { id: el.dataset.id, el, pid: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  });
  foesBox.addEventListener('pointermove', (e) => {
    if (!foeDrag || e.pointerId !== foeDrag.pid) return;
    const dx = e.clientX - foeDrag.x0;
    const dy = e.clientY - foeDrag.y0;
    if (!foeDrag.moved && Math.hypot(dx, dy) < 6) return;
    foeDrag.moved = true;
    foeDrag.el.classList.add('dragging');
    foeDrag.el.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
  });
  function endFoeDrag(e, cancel) {
    if (!foeDrag || e.pointerId !== foeDrag.pid) return;
    const d = foeDrag;
    foeDrag = null;
    d.el.style.transform = '';
    requestAnimationFrame(() => requestAnimationFrame(() => d.el.classList.remove('dragging')));
    if (cancel) { renderMap(); return; }
    if (!d.moved) { if (placing) return; targetFoe(d.id); return; }
    const ms = mapState();
    const f = foeById(d.id);
    const c = cellFromPoint(e.clientX, e.clientY);
    if (f && c && placeOk(ms, c, f.id)) { f.x = c.x; f.y = c.y; save(); }
    renderMap();
  }
  foesBox.addEventListener('pointerup', (e) => endFoeDrag(e, false));
  foesBox.addEventListener('pointercancel', (e) => endFoeDrag(e, true));
  foesBox.addEventListener('keydown', (e) => {
    const el = e.target.closest('.map-foe');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); targetFoe(el.dataset.id); }
  });
  // Names a new enemy: the first Draugr is "Draugr"; adding a second renames it "Draugr 1" and calls the new one "Draugr 2".
  function nextFoeName(base) {
    const re = new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?: (\\d+))?$', 'i');
    const same = game.foes.filter((f) => re.test(f.name));
    if (!same.length) return base;
    let max = 0;
    same.forEach((f) => { const m = re.exec(f.name); if (m[1]) max = Math.max(max, Number(m[1])); });
    same.forEach((f) => { if (!re.exec(f.name)[1]) { max++; f.name = base + ' ' + max; } });
    return base + ' ' + (max + 1);
  }
  function placeFoe(c) {
    const ms = mapState();
    if (!placing) return;
    if (!placeOk(ms, c)) {
      const k = kindAt(ms, c.x, c.y);
      mapNote = isBlocked(k) ? 'That square is ' + TERRAIN_NAME[k] + '.' : 'That square is taken.';
      renderMapOverlay();
      return;
    }
    game.foes.push({ id: newId(), map: ms.id, x: c.x, y: c.y, name: nextFoeName(placing.name), hp: placing.hp, max: placing.hp, ev: placing.ev, ar: placing.ar });
    mapNote = '';
    save();
    renderMap();
  }
  function stopPlacing() {
    placing = null;
    mapHover = null;
    mapTarget = null;
    mapNote = '';
    $('#foeAdd').hidden = false;
    renderMap(true);
  }

  // The enemy roster under the map: rename, change Health, Evasion and Armor Rating, or remove.
  let foeListKey = '';
  function renderFoeList(ms) {
    $('#foePlacing').hidden = !placing;
    $('#foeAdd').hidden = !!placing || !$('#foeForm').hidden;
    if (placing) $('#foePlaceHint').textContent = 'Tap empty squares on the map to place ' + placing.name + '. Each tap adds one.' + (fogOn(ms) ? ' The fog is lifted while you place.' : '');
    const list = $('#foeList');
    const here = foesHere(ms);
    const clr = $('#foeClear');
    clr.hidden = !here.length;
    if (list.contains(document.activeElement)) return;
    const at = walk ? walk.route[walk.i] : ms;
    const k = ms.id + JSON.stringify(here.map((f) => [f.id, f.name, f.hp, f.max, f.ev, f.ar, f.x, f.y, foeSeen(ms, f, at)]));
    if (k === foeListKey) return;
    foeListKey = k;
    const numIn = (f, key, label, v) => '<input type="number" inputmode="numeric" data-k="' + key + '" value="' + v + '" aria-label="' + esc(label + ' of ' + f.name) + '">';
    list.innerHTML = here.length ? here.map((f) => {
      const seen = foeSeen(ms, f, at);
      return '<li class="foe-row' + (foeDown(f) ? ' down' : '') + '" data-id="' + esc(f.id) + '">' +
        '<span class="foe-chip">' + esc(foeLabel(f)) + '</span>' +
        '<input class="nm-in" type="text" data-k="name" maxlength="30" value="' + esc(f.name) + '" aria-label="Name">' +
        '<span class="where">' + cellName(f) + (seen ? '' : ' · unseen') + '</span>' +
        '<span class="nums">' +
          '<span class="num"><span class="foot-label">Health</span>' + numIn(f, 'hp', 'Health', f.hp) + '<span class="pool-src">/</span>' + numIn(f, 'max', 'Max Health', f.max) + '</span>' +
          '<span class="num"><span class="foot-label">Evasion</span>' + numIn(f, 'ev', 'Evasion', f.ev) + '</span>' +
          '<span class="num"><span class="foot-label">Armor</span>' + numIn(f, 'ar', 'Armor Rating', f.ar) + '</span>' +
        '</span>' +
        (seen && !foeDown(f) ? '<button type="button" class="btn-link" data-foe-target>Target</button>' : '') +
        '<button type="button" class="xbtn del" data-foe-del aria-label="Remove ' + esc(f.name) + '">×</button>' +
      '</li>';
    }).join('') : '<li class="foe-empty">No enemies on this map yet.</li>';
  }
  $('#foeList').addEventListener('change', (e) => {
    const inp = e.target.closest('input[data-k]');
    const row = e.target.closest('.foe-row');
    const f = row ? foeById(row.dataset.id) : null;
    if (!inp || !f) return;
    const k = inp.dataset.k;
    if (k === 'name') {
      f.name = (inp.value.trim() || f.name).slice(0, 30);
    } else {
      const v = Math.round(num(inp.value));
      if (!isNaN(v)) {
        if (k === 'max') f.max = Math.max(1, Math.min(9999, v));
        else if (k === 'ar') f.ar = Math.max(0, Math.min(999, v));
        else f[k] = Math.max(-999, Math.min(9999, v));
      }
    }
    foeListKey = '';
    save();
    renderMap();
  });
  $('#foeList').addEventListener('focusout', (e) => {
    if (!e.relatedTarget || !$('#foeList').contains(e.relatedTarget)) setTimeout(() => { foeListKey = ''; renderFoeList(mapState()); }, 0);
  });
  $('#foeList').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); });
  $('#foeList').addEventListener('click', (e) => {
    const row = e.target.closest('.foe-row');
    if (!row) return;
    if (e.target.closest('[data-foe-del]')) {
      game.foes = game.foes.filter((f) => f.id !== row.dataset.id);
      if (mapFoe === row.dataset.id) { mapFoe = null; mapTarget = null; }
      foeListKey = '';
      save();
      renderMap();
    } else if (e.target.closest('[data-foe-target]')) {
      if (mapFoe !== row.dataset.id) targetFoe(row.dataset.id);
      mapWrap.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    }
  });
  // Buttons that need a second tap before they throw something away.
  function armTwice(btn, again, run) {
    if (btn.dataset.armed) { clearTimeout(Number(btn.dataset.armed)); delete btn.dataset.armed; btn.textContent = btn.dataset.label; run(); return; }
    btn.dataset.label = btn.textContent;
    btn.textContent = again;
    btn.dataset.armed = String(setTimeout(() => { delete btn.dataset.armed; btn.textContent = btn.dataset.label; }, 4000));
  }
  $('#foeClear').addEventListener('click', (e) => {
    const ms = mapState();
    const n = foesHere(ms).length;
    armTwice(e.currentTarget, 'Tap again to remove all ' + n, () => {
      game.foes = game.foes.filter((f) => f.map !== ms.id);
      mapFoe = null;
      foeListKey = '';
      save();
      renderMap();
    });
  });
  $('#foeAdd').addEventListener('click', () => {
    $('#foeForm').hidden = false;
    $('#foeAdd').hidden = true;
    $('#foeName').focus();
  });
  $('#foeCancel').addEventListener('click', () => { $('#foeForm').hidden = true; $('#foeAdd').hidden = false; });
  $('#foeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id, d) => { const v = Math.round(num($(id).value)); return isNaN(v) ? d : v; };
    placing = {
      name: ($('#foeName').value.trim() || 'Enemy').slice(0, 24),
      hp: Math.max(1, Math.min(9999, val('#foeHp', 10))),
      ev: Math.max(-99, Math.min(99, val('#foeEv', 10))),
      ar: Math.max(0, Math.min(999, val('#foeAr', 0)))
    };
    $('#foeForm').hidden = true;
    mapFoe = null;
    mapTarget = null;
    mapNote = '';
    renderMap(true);
    mapWrap.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  });
  $('#foeDone').addEventListener('click', stopPlacing);
  // Dragging the token
  mapTok.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || walk || placing) return;
    e.preventDefault();
    const ms = mapState();
    tokDrag = { pid: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, cur: { x: ms.x, y: ms.y } };
    try { mapTok.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  });
  mapTok.addEventListener('pointermove', (e) => {
    if (!tokDrag || e.pointerId !== tokDrag.pid) return;
    const dx = e.clientX - tokDrag.x0;
    const dy = e.clientY - tokDrag.y0;
    if (!tokDrag.moved && Math.hypot(dx, dy) < 5) return;
    if (!tokDrag.moved) { tokDrag.moved = true; mapTarget = null; mapTok.classList.add('dragging'); }
    mapTok.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
    const c = cellFromPoint(e.clientX, e.clientY);
    if (c && !sameCell(c, tokDrag.cur)) { tokDrag.cur = c; renderMapOverlay(); }
  });
  function endTokDrag(e, cancel) {
    if (!tokDrag || e.pointerId !== tokDrag.pid) return;
    const d = tokDrag;
    tokDrag = null;
    // Drop in place without the slide animation, then let later moves animate again.
    mapTok.style.transform = '';
    requestAnimationFrame(() => requestAnimationFrame(() => mapTok.classList.remove('dragging')));
    if (!cancel && d.moved && !sameCell(d.cur, mapState())) {
      const info = mapPlan(d.cur);
      if (info.ok) { mapMoveTo(d.cur); return; }
      showRoll({ kind: 'notice', title: 'Can\u2019t move to ' + cellName(d.cur), math: info.text });
    }
    renderMapOverlay();
  }
  mapTok.addEventListener('pointerup', (e) => endTokDrag(e, false));
  mapTok.addEventListener('pointercancel', (e) => endTokDrag(e, true));
  // Tapping squares: the first tap shows the cost, a second tap on the same square moves.
  mapSvg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const c = cellFromPoint(e.clientX, e.clientY);
    mapDown = c ? { pid: e.pointerId, c, x0: e.clientX, y0: e.clientY } : null;
  });
  mapSvg.addEventListener('pointercancel', () => { mapDown = null; });
  mapSvg.addEventListener('pointerup', (e) => {
    const d = mapDown;
    mapDown = null;
    if (!d || d.pid !== e.pointerId || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8 || walk) return;
    if (placing) { placeFoe(d.c); return; }
    if (sameCell(d.c, mapState())) { mapTarget = null; renderMapOverlay(); return; }
    if (sameCell(d.c, mapTarget) && mapPlan(d.c).ok) { mapMoveTo(d.c); return; }
    mapTarget = d.c;
    mapNote = '';
    renderMapOverlay();
  });
  mapSvg.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || tokDrag || walk) return;
    const c = cellFromPoint(e.clientX, e.clientY);
    if (sameCell(c, mapHover) || (!c && !mapHover)) return;
    mapHover = c;
    if (!mapTarget) renderMapOverlay();
  });
  mapSvg.addEventListener('pointerleave', () => { mapHover = null; if (!mapTarget) renderMapOverlay(); });
  mapSvg.addEventListener('keydown', (e) => {
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const ms = mapState();
    if (walk) return;
    if (placing && e.key === 'Escape') { e.preventDefault(); stopPlacing(); return; }
    if (placing && (e.key === 'Enter' || e.key === ' ') && mapTarget) { e.preventDefault(); placeFoe(mapTarget); return; }
    if (dirs[e.key]) {
      e.preventDefault();
      const b = mapTarget || { x: ms.x, y: ms.y };
      mapTarget = { x: Math.max(0, Math.min(ms.cols - 1, b.x + dirs[e.key][0])), y: Math.max(0, Math.min(ms.rows - 1, b.y + dirs[e.key][1])) };
      renderMapOverlay();
    } else if ((e.key === 'Enter' || e.key === ' ') && mapTarget) {
      e.preventDefault();
      if (mapPlan(mapTarget).ok) mapMoveTo(mapTarget);
    } else if (e.key === 'Escape' && mapTarget) {
      mapTarget = null;
      renderMapOverlay();
    }
  });
  $('#mapUndo').addEventListener('click', () => { mapNote = ''; undoAp(); });
  $('#mapGo').addEventListener('click', () => { if (mapTarget && mapPlan(mapTarget).ok) mapMoveTo(mapTarget); });
  $('#mapTurn').addEventListener('click', () => { mapTarget = null; $('#turnReset').click(); });
  $('#statusNextTurn').addEventListener('click', () => $('#turnReset').click());
  $('#mapPick').addEventListener('change', (e) => {
    endWalk();
    const id = MAPS[e.target.value] ? e.target.value : 'blank';
    const prev = game.map || {};
    // The grid strength goes back to the new map's default; the token starts where the map says.
    game.map = { id, rev: MAPS[id].rev || null, cols: prev.cols, rows: prev.rows, free: !!prev.free, fogOff: !!prev.fogOff };
    game.view = Object.assign({}, game.view, { grid: null });
    const def = MAPS[id];
    if (def.start) setTok({ x: def.start.x, y: def.start.y });
    else if (myTok()) { const ms = mapState(); setTok({ x: ms.x, y: ms.y }); }
    mapTarget = null;
    mapFoe = null;
    placing = null;
    mapNote = '';
    refreshAll();
    save();
    centerToken();
  });
  $('#mapGrid').addEventListener('input', (e) => {
    game.view = Object.assign({}, game.view, { grid: Math.round(num(e.target.value)) });
    renderMap();
    save();
  });
  $('#mapTerrain').addEventListener('change', (e) => {
    game.view = Object.assign({}, game.view, { terrainOn: e.target.checked });
    renderMap();
    save();
  });
  $('#mapFree').addEventListener('change', (e) => {
    game.map = Object.assign({}, game.map, { free: e.target.checked });
    mapTarget = null;
    renderMap(true);
    save();
  });
  $('#mapReach').addEventListener('change', (e) => {
    game.view = Object.assign({}, game.view, { reachOff: !e.target.checked });
    renderMap(true);
    save();
  });
  // The light you carry, picked on the map; it's the same as Light carried on the sheet.
  const LIGHT_STEPS = [0, 5, 10, 15, 20, 30, 40, 60];
  function renderLightPick() {
    const el = $('#hudLight');
    if (document.activeElement === el) return;
    const v = Math.round(num(state.fields.light)) || 0;
    const steps = LIGHT_STEPS.includes(v) ? LIGHT_STEPS : LIGHT_STEPS.concat(v).sort((a, b) => a - b);
    const h = steps.map((n) => '<option value="' + n + '">' + (n ? n + ' ft' : 'None') + '</option>').join('');
    if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; }
    el.value = String(v);
  }
  $('#hudLight').addEventListener('change', (e) => {
    const v = Math.round(num(e.target.value));
    if (v > 0) state.fields.light = String(v); else delete state.fields.light;
    fillInputs();
    refreshAll();
    save();
  });
  $('#mapFog').addEventListener('change', (e) => {
    game.map = Object.assign({}, game.map, { fogOff: !e.target.checked });
    mapTarget = null;
    renderMap(true);
    save();
  });
  // Forgets what you've explored on this map, so it's dark again except what you can see from where you stand.
  $('#fogReset').addEventListener('click', (e) => {
    armTwice(e.currentTarget, 'Tap again to hide this map again', () => {
      const ms = mapState();
      const f = Object.assign({}, game.fog);
      delete f[ms.id];
      game.fog = f;
      fogMem = null;
      visMemo = { key: '', vis: null };
      mapTarget = null;
      mapNote = '';
      renderMap(true);
      save();
    });
  });
  ['mapCols', 'mapRows'].forEach((id) => {
    $('#' + id).addEventListener('change', (e) => {
      const v = Math.round(num(e.target.value));
      const ms = mapState();
      if (!isNaN(v)) {
        const n = Math.max(5, Math.min(60, v));
        game.map = Object.assign({ cols: ms.cols, rows: ms.rows }, game.map, id === 'mapCols' ? { cols: n } : { rows: n });
        const now = mapState();
        if (myTok()) setTok({ x: now.x, y: now.y });
        mapTarget = null;
        save();
      }
      e.target.value = String(id === 'mapCols' ? mapState().cols : mapState().rows);
      renderMap(true);
    });
  });
  function centerToken() {
    const ms = mapState();
    const S = cellPx();
    mapWrap.scrollLeft = Math.max(0, MAP_EDGE + ms.x * S + S / 2 - mapWrap.clientWidth / 2);
    mapWrap.scrollTop = Math.max(0, MAP_EDGE + ms.y * S + S / 2 - mapWrap.clientHeight / 2);
  }
  // Independent destinations: Character Sheet (with its own sub-tabs) and Battlemap.
  // Keep old #sheet, #status and #map URLs usable alongside #sheet/abilities etc.
  const SHEET_TABS = ['overview', 'attributes', 'equipment', 'abilities', 'statuses'];
  let activeSheetTab = 'overview';
  function setView(destination, tab) {
    view = destination === 'map' ? 'map' : 'sheet';
    if (tab && SHEET_TABS.includes(tab)) activeSheetTab = tab;
    const onSheet = view === 'sheet';
    mainEl.classList.toggle('view-map', !onSheet);
    document.querySelectorAll('#viewNav button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    document.querySelectorAll('#sheetTabs button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.sheetTab === activeSheetTab)));
    document.querySelectorAll('[data-sheet-section]').forEach(section => {
      section.hidden = !onSheet || section.dataset.sheetSection !== activeSheetTab;
    });
    if (!onSheet) { mapTarget = null; renderMap(true); centerToken(); }
    if (onSheet && activeSheetTab === 'statuses') statusManager.render();
    if (onSheet && activeSheetTab === 'abilities') abilityLibrary.render(); // Fresh portrait choices from Overview.
  }
  function viewFromHash() {
    const hash = location.hash.replace(/^#/, '').toLowerCase();
    if (hash === 'map') setView('map');
    else if (hash === 'status') setView('sheet', 'statuses'); // legacy Status link
    else if (hash.startsWith('sheet/')) setView('sheet', hash.slice(6));
    else setView('sheet', 'overview'); // legacy #sheet and default
  }
  $('#viewNav').addEventListener('click', e => {
    const button = e.target.closest('button[data-view]');
    if (!button) return;
    const hash = button.dataset.view === 'map' ? '#map' : '#sheet/' + activeSheetTab;
    try { location.hash = hash; } catch (err) { /* hash not available */ }
    setView(button.dataset.view, activeSheetTab);
  });
  $('#sheetTabs').addEventListener('click', e => {
    const button = e.target.closest('button[data-sheet-tab]');
    if (!button || !SHEET_TABS.includes(button.dataset.sheetTab)) return;
    const tab = button.dataset.sheetTab;
    try { location.hash = '#sheet/' + tab; } catch (err) { /* hash not available */ }
    setView('sheet', tab);
  });
  window.addEventListener('hashchange', viewFromHash);
  let resizeT = null;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => renderMap(), 150); });

  // Rendering
  function fillInputs() {
    document.querySelectorAll('[data-field]').forEach((el) => {
      el.value = state.fields[el.id] != null ? state.fields[el.id] : '';
    });
  }
  function refreshAll() {
    log = computeLog();
    const active = document.activeElement;
    if (levelInput !== active) levelInput.value = String(level());
    STATS.forEach((s) => {
      const el = document.getElementById('score-' + s.k);
      if (el !== active) {
        // Shows your score with gear included; tapping in switches to your own score so you can edit it.
        const own = scoreAt(s.k, level());
        const g = gear(s.k);
        const formBonus = window.WBAbilities.formStatBonus(state, s.k);
        el.value = own == null ? '' : String(own + g + window.WBAbilities.effectBonus(state, 'stat', s.k) + formBonus);
        el.classList.toggle('geared', own != null && !!(g || window.WBAbilities.effectBonus(state, 'stat', s.k) || formBonus));
      }
    });
    Object.keys(AUTO).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const o = state.over[id];
      const manual = isSet(o);
      el.classList.toggle('manual', manual);
      const statKey = id.startsWith('mod-') ? id.slice(4) : null;
      const affectedStat = statKey ? statKey :
        id === 'evasion' || id === 'speed' ? 'AGL' :
        id === 'armor' ? 'VIT' : null;
      if (id === 'armor' || id === 'evasion' || statKey)
        el.classList.toggle('ability-adjusted', !manual &&
          (!!window.WBAbilities.effectBonus(state, id) ||
            !!(affectedStat && (window.WBAbilities.effectBonus(state, 'stat', affectedStat) ||
              window.WBAbilities.formStatBonus(state, affectedStat)))));
      el.title = manual ? 'Set by hand. Clear it to go back to the automatic value.' : '';
      if (el === active) return;
      if (id === 'speed') {
        const bonus = window.WBAbilities.movementBonus(state);
        const base = manual ? num(o) : num(AUTO.speed());
        // Manual overrides remain orange and editable. Automatic effect bonuses
        // are rendered teal, never stored as manual overrides.
        el.classList.toggle('ability-adjusted', !manual && (!!bonus || !!gear('move') || !!window.WBAbilities.effectBonus(state, 'stat', 'AGL') || !!window.WBAbilities.formStatBonus(state, 'AGL')));
        el.title = manual
          ? 'Manually set base Movement. Effective movement: ' + window.WBAbilities.effectiveMovement(state, base) + ' ft/AP.'
          : bonus ? 'Base: ' + base + ' ft/AP. Abilities: ' + (bonus > 0 ? '+' : '') + bonus + ' ft/AP.' : '';
        if (el === active) return;
        el.value = manual ? o : window.WBAbilities.effectiveMovement(state, base);
      } else {
        el.value = manual ? o : AUTO[id]();
      }
    });
    STATS.forEach((s) => {
      const sc = score(s.k);
      const tile = document.getElementById('stat-' + s.k);
      const g = gear(s.k);
      const gEl = document.getElementById('gear-' + s.k);
      gEl.hidden = !(g || window.WBAbilities.effectBonus(state, 'stat', s.k) || window.WBAbilities.formStatBonus(state, s.k));
      const bs = baseScore(s.k);
      const abilityStatBonus = window.WBAbilities.effectBonus(state, 'stat', s.k);
      const formBonus = window.WBAbilities.formStatBonus(state, s.k);
      gEl.textContent = [g ? sgn(g) + ' gear' : '', abilityStatBonus ? sgn(abilityStatBonus) + ' ability' : '',
        formBonus ? sgn(formBonus) + ' form' : ''].filter(Boolean).join(' · ');
      gEl.title = g && bs != null ? 'Your own score is ' + bs + '. Gear adds ' + sgn(g) + '.' : '';
      tile.querySelectorAll('.milestones li').forEach((li) => {
        li.classList.toggle('reached', sc != null && sc >= Number(li.dataset.at));
      });
      tile.classList.toggle('ascended', sc != null && sc >= 28);
    });
    const vit = score('VIT');
    $('#hpRule').textContent = (vit == null ? 'Enter VIT to work out Health' : 'Next level: roll ' + rowDie(vit) + ' + ' + Math.floor(vit / 2)) + poolGearNote('hp');
    const msv = score(msStat());
    $('#mpRule').textContent = (msv == null ? 'Enter ' + msStat() + ' to work it out' : 'Next level: +' + manaPerLevel(msv)) + poolGearNote(kind() === 'holy' ? 'holy' : 'mp');
    $('#evSrc').textContent = '10 + AGL mod' + gearNote('ev') + (window.WBAbilities.effectBonus(state, 'evasion') ? ' · ability ' + fmt(window.WBAbilities.effectBonus(state, 'evasion')) : '');
    $('#armorSrc').textContent = (adamantine() ? 'Half VIT (Adamantine Body)' : 'VIT mod') + ' + worn armor' + (window.WBAbilities.effectBonus(state, 'armor') ? ' · ability ' + fmt(window.WBAbilities.effectBonus(state, 'armor')) : '');
    $('#initSrc').textContent = 'WIS mod' + gearNote('init');
    const effectSpeed = window.WBAbilities.movementBonus(state);
    $('#moveSrc').textContent = '5 ft + 5 per AGL mod' + gearNote('move') +
      (effectSpeed ? ' · ' + (effectSpeed > 0 ? '+' : '') + effectSpeed + ' ft/AP from abilities' +
        (isSet(state.over.speed) ? ' · effective ' + speedNow() + ' ft/AP' : '') : '');
    $('#moveSrc').classList.toggle('ability-bonus-label', !!effectSpeed);
    $('#dvSrc').textContent = 'How far you see in the dark' + (gear('sight') ? ', ' + sgn(gear('sight')) + ' ft from gear (' + darkvisionFt() + ' ft)' : '');
    $('#lightSrc').textContent = gear('light') ? 'Your gear sheds ' + gear('light') + ' ft; the larger counts' : 'A torch, lantern or spell';
    $('#hpCur').placeholder = $('#hpMax').value || '—';
    $('#mpCur').placeholder = $('#mpMax').value || '—';
    updateManaKind();
    resourceManager.render();
    abilityLibrary.render();
    statusManager.render();
    updatePool('hp');
    updatePool('mp');
    syncDown();
    renderDeath();
    renderAdv();
    renderAsi();
    trackers.forEach((t) => t.render());
    renderGiven();
    renderMove();
    renderCommand();
    renderMap();
    renderLog();
    refreshConc();
    renderDefense();
    showPortrait();
    rerender();
  }

  let scoreTarget = null;
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t.classList && t.classList.contains('score')) {
      scoreTarget = hasScore(t.dataset.stat) ? level() : 1;
      const own = scoreAt(t.dataset.stat, level());
      t.value = own == null ? '' : String(own);
      t.classList.remove('geared');
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t === levelInput) return;
    if (t.classList.contains('score')) {
      const k = t.dataset.stat;
      const lv = scoreTarget || (hasScore(k) ? level() : 1);
      if (!state.hist[k]) state.hist[k] = {};
      // Stored without stat increases, which are added back on top.
      const v = num(t.value);
      if (t.value.trim() === '' || isNaN(v)) delete state.hist[k][lv]; else state.hist[k][lv] = String(v - asiSum(k, level()));
      // Typing a different number unlinks any rolled result placed here.
      if (state.alloc[k] != null) {
        const r = state.pool[state.alloc[k]];
        if (!r || num(t.value) !== r.v) delete state.alloc[k];
      }
    } else if (t.hasAttribute('data-field')) {
      state.fields[t.id] = t.value;
    } else if (t.hasAttribute('data-auto')) {
      // An automatically buffed Movement field displays the effective value.
      // Focusing it for editing shows its unbuffed base; only intentional edits
      // create an orange manual override.
      if (t.id === 'speed' && t.dataset.editingBase === 'true' && t.value === t.dataset.initialBase) {
        delete t.dataset.editingBase;
        delete t.dataset.initialBase;
        refreshAll();
        return;
      }
      if (t.id === 'speed') {
        delete t.dataset.editingBase;
        delete t.dataset.initialBase;
      }
      if (t.value.trim() === '') delete state.over[t.id]; else state.over[t.id] = t.value;
    } else if (t.dataset && t.dataset.rollLv) {
      const n = t.dataset.rollLv;
      if (t.value.trim() === '') delete state.rolls[n]; else state.rolls[n] = t.value;
    } else {
      return;
    }
    refreshAll();
    save();
  });
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (!t || t.id !== 'speed' || !window.WBAbilities.movementBonus(state)) return;
    const base = speedBase();
    t.dataset.editingBase = 'true';
    t.dataset.initialBase = String(base);
    t.value = String(base);
  });
  document.addEventListener('focusout', (e) => {
    const t = e.target;
    if (t && t.id === 'speed' && t.dataset.editingBase === 'true') {
      const original = t.dataset.initialBase;
      if (t.value === original) {
        delete t.dataset.editingBase;
        delete t.dataset.initialBase;
        refreshAll();
        return;
      }
      delete t.dataset.editingBase;
      delete t.dataset.initialBase;
    }
    if (!t || !t.matches || !t.matches('[data-auto], .score, .roll-in')) return;
    if (t.classList.contains('score')) scoreTarget = null;
    refreshAll();
  });

  // Footer: export, import and clear, each with an in-page confirmation where it replaces things
  const clearBtn = $('#clearBtn');
  const clearConfirm = $('#clearConfirm');
  const footBtns = $('#footBtns');
  const importConfirm = $('#importConfirm');
  function resetSession() {
    selected = null;
    flash = '';
    spending = false;
    spendLv = null;
    asiAsk = false;
    restUndo = null;
    apUndo = null;
    toastEl.hidden = true;
    // The battlemap's working state belongs to the old character.
    if (walk) { clearTimeout(walk.timer); walk = null; mapTok.classList.remove('walking'); }
    fogMem = null;
    visMemo = { key: '', vis: null };
    mapFoe = null;
    mapTarget = null;
    placing = null;
    foeListKey = '';
    mapNote = '';
    resetForge();
    fillInputs();
    refreshAll();
  }
  clearBtn.addEventListener('click', () => {
    footBtns.hidden = true;
    clearConfirm.hidden = false;
    $('#clearNo').focus();
  });
  $('#clearNo').addEventListener('click', () => {
    clearConfirm.hidden = true;
    footBtns.hidden = false;
    clearBtn.focus();
  });
  $('#clearYes').addEventListener('click', () => {
    // A cleared sheet is a new character: the old one's token leaves the game, the rest of the game stays.
    setTok(null);
    state = blank();
    state.id = newCharId();
    try { repositories.characters.remove(); } catch (e) { /* ignore */ }
    resetSession();
    clearConfirm.hidden = true;
    footBtns.hidden = false;
    setStatus('Sheet cleared.');
  });

  // Export: the whole character, portraits included, as a .json file to keep or load elsewhere.
  // The battlemap isn't part of it: that belongs to the game.
  let downloads = null;
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('downloads').then((d) => { downloads = d; }).catch(() => {});
    }
  } catch (e) { /* not inside Claude: plain browser download */ }
  function exportFilename() {
    const n = String(state.fields.charName || '').trim().replace(/[\\/:*?"<>|]+/g, '').slice(0, 60);
    return (n || 'Worlds Beyond character') + '.json';
  }
  $('#exportBtn').addEventListener('click', async () => {
    const filename = exportFilename();
    window.WBEquipment.capture(state); // Export includes the latest currently worn items.
    const data = window.WBPersistence.exportCharacter(state);
    if (downloads) {
      try {
        await downloads.save({ filename, data });
        setStatus('Exported ' + filename + '.');
      } catch (err) {
        const code = err && err.code;
        if (code === 'declined') setStatus('Export cancelled.');
        else if (code === 'rate_limited') setStatus('Another save is already waiting. Try again in a moment.', true);
        else setStatus('Files can\u2019t be saved from this view. Open the sheet in claude.ai to export.', true);
      }
      return;
    }
    try {
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatus('Exported ' + filename + '.');
    } catch (e) {
      setStatus('This browser couldn\u2019t save the file.', true);
    }
  });

  // Import: load a character file, replacing what's on the sheet once you confirm.
  let pendingImport = null;
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const st = window.WBPersistence.parseCharacterFile(String(reader.result));
      if (!st) { setStatus('That file isn\u2019t a Worlds Beyond character.', true); return; }
      pendingImport = st;
      const nm = st.fields && isSet(st.fields.charName) ? String(st.fields.charName).trim() : 'the character in that file';
      $('#importMsg').textContent = 'Replace this sheet with ' + nm + '? Export the current character first if you want to keep it.';
      footBtns.hidden = true;
      clearConfirm.hidden = true;
      importConfirm.hidden = false;
      $('#importNo').focus();
    };
    reader.onerror = () => setStatus('That file couldn\u2019t be read.', true);
    reader.readAsText(file);
  });
  $('#importNo').addEventListener('click', () => {
    pendingImport = null;
    importConfirm.hidden = true;
    footBtns.hidden = false;
    $('#importBtn').focus();
  });
  $('#importYes').addEventListener('click', () => {
    if (!pendingImport) return;
    const oldId = state.id;
    state = Object.assign(blank(), pendingImport);
    pendingImport = null;
    normalizeState();
    // The character this replaces takes their token off the map.
    if (oldId && oldId !== state.id) { const tokens = Object.assign({}, game.tokens); delete tokens[oldId]; game.tokens = tokens; }
    resetSession();
    importConfirm.hidden = true;
    footBtns.hidden = false;
    const nm = String(state.fields.charName || '').trim();
    if (storeNow()) setStatus('Imported ' + (nm || 'the character') + '.');
    else setStatus('Imported, but this browser can\u2019t save it. Export it again before you close the page.', true);
  });

  fillInputs();
  refreshAll();
  viewFromHash();
})();
