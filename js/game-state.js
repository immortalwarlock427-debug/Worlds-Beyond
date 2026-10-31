/* Reusable Worlds Beyond DM/game state shape. No DOM, storage or networking.
 * The character sheet and a future DM room must share the same normalizer.
 */
(function () {
  'use strict';
  const blankGame = () => ({ map: null, tokens: {}, fog: {}, foes: [], view: {} });
  const whole = (v, d) => { const n = Math.round(Number(v)); return isFinite(n) ? Math.max(-999, Math.min(9999, n)) : d; };
  function normalizeGame(g) {
    g = g && typeof g === 'object' ? g : {};
    const out = blankGame();
    const mp = g.map;
    if (mp && typeof mp === 'object') {
      out.map = {
        id: typeof mp.id === 'string' ? mp.id.slice(0, 40) : null, rev: Number(mp.rev) || null, cols: Number(mp.cols) || null, rows: Number(mp.rows) || null,
        free: !!mp.free, fogOff: !!mp.fogOff
      };
    }
    // Squares are column x and row y, from 0.
    if (g.tokens && typeof g.tokens === 'object') {
      Object.keys(g.tokens).slice(0, 50).forEach((id) => {
        const t = g.tokens[id];
        if (t && isFinite(t.x) && isFinite(t.y)) out.tokens[id.slice(0, 40)] = { x: Math.round(Number(t.x)), y: Math.round(Number(t.y)) };
      });
    }
    // Fog of war: per map, the squares seen so far, as a string of 0s and 1s row by row.
    if (g.fog && typeof g.fog === 'object' && !Array.isArray(g.fog)) {
      Object.keys(g.fog).slice(0, 40).forEach((id) => {
        const r = g.fog[id];
        if (r && typeof r.seen === 'string' && /^[01]{1,3600}$/.test(r.seen)) out.fog[id.slice(0, 40)] = { rev: Number(r.rev) || null, seen: r.seen };
      });
    }
    // Enemies: which map and square, name, Health, Evasion and Armor Rating.
    out.foes = (Array.isArray(g.foes) ? g.foes : []).filter((f) => f && typeof f === 'object' && typeof f.map === 'string' && isFinite(f.x) && isFinite(f.y)).slice(0, 300).map((f, i) => {
      const max = Math.max(1, whole(f.max, 10));
      return {
        id: typeof f.id === 'string' && f.id ? f.id.slice(0, 30) : 'e' + i, map: f.map.slice(0, 40), x: Math.round(Number(f.x)), y: Math.round(Number(f.y)),
        name: (typeof f.name === 'string' && f.name.trim() ? f.name.trim() : 'Enemy').slice(0, 30), hp: whole(f.hp, max), max,
        ev: whole(f.ev, 12), ar: Math.max(0, whole(f.ar, 0))
      };
    });
    // How this browser shows the map. Older saves kept these on the map itself.
    const v = g.view && typeof g.view === 'object' ? g.view : mp || {};
    out.view = {
      grid: v.grid != null && isFinite(Number(v.grid)) ? Number(v.grid) : null,
      terrainOn: !!v.terrainOn, reachOff: !!v.reachOff
    };
    // Encounter data belongs to the game save, never to the character.
    // Legacy games omit this optional field entirely.
    if (g.encounter != null && window.WBEncounter) {
      const encounter = window.WBEncounter.normalizeEncounter(g.encounter);
      if (encounter) out.encounter = encounter;
    }
    return out;
  }
  window.WBGameState = { blankGame, normalizeGame };
})();
