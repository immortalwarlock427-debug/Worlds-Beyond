/* Worlds Beyond encounter map model.
 * Pure geometry, placement checks and natural shortest-path routing.
 * Actual movement and AP spending are validated by WBEncounter.
 */
(function () {
  'use strict';
  const BLOCKED = '#OBxcnfu';
  const integer = value => typeof value === 'number' && Number.isInteger(value);
  function mapModel(game, maps) {
    const definitions = maps || {};
    const chosen = game && game.map && game.map.id;
    const id = Object.prototype.hasOwnProperty.call(definitions,chosen) ? chosen : 'blank';
    const def = definitions[id] || { name:'Blank grid' };
    const set = game && game.map || {};
    const dim = (v, fallback) => integer(v) && v >= 5 && v <= 60 ? v : fallback;
    const cols = def.cols || dim(set.cols,20);
    const rows = def.rows || dim(set.rows,15);
    return { id, name:def.name || id, def, cols, rows };
  }
  function blocked(map,x,y) {
    const line = map.def && map.def.terrain && map.def.terrain[y];
    return !!(line && BLOCKED.includes(line[x]));
  }
  function tokenActors(encounter,map) {
    if (!encounter || !Array.isArray(encounter.order)) return [];
    return encounter.order.map(id => encounter.actors && Object.prototype.hasOwnProperty.call(encounter.actors,id) ?
      encounter.actors[id] : null)
      .filter(actor => actor && actor.mapId === map.id &&
        integer(actor.x) && integer(actor.y) &&
        actor.x >= 0 && actor.x < map.cols && actor.y >= 0 && actor.y < map.rows);
  }
  function checkPlacement(encounter,map,actorId,x,y) {
    if (!map || !integer(x) || !integer(y) ||
        x < 0 || y < 0 || x >= map.cols || y >= map.rows) return {ok:false,error:'OUT_OF_BOUNDS'};
    if (!encounter || !encounter.actors ||
        !Object.prototype.hasOwnProperty.call(encounter.actors,actorId)) return {ok:false,error:'ACTOR_NOT_FOUND'};
    if (blocked(map,x,y)) return {ok:false,error:'BLOCKED_SQUARE'};
    const occupying = tokenActors(encounter,map).find(actor =>
      actor.id !== actorId && actor.x === x && actor.y === y);
    if (occupying) return {ok:false,error:'OCCUPIED_SQUARE',actorId:occupying.id,name:occupying.name};
    return {ok:true};
  }
  function squareName(x,y) {
    let column='', n=x+1;
    while(n>0){n--; column=String.fromCharCode(65+n%26)+column; n=Math.floor(n/26);}
    return column+(y+1);
  }

  function movementRoute(encounter,map,actorId,toX,toY) {
    const actor=encounter&&encounter.actors&&encounter.actors[actorId];
    if(!actor)return {ok:false,error:'ACTOR_NOT_FOUND'};
    if(!map||actor.mapId!==map.id||!integer(actor.x)||!integer(actor.y)||
        actor.x<0||actor.y<0||actor.x>=map.cols||actor.y>=map.rows)
      return {ok:false,error:'TOKEN_NOT_PLACED'};
    const others=tokenActors(encounter,map).filter(a=>a.id!==actorId);
    return window.WBRouting.findPaths({
      costMultiplier:actor.movementMultiplier||1,cols:map.cols,rows:map.rows,start:{x:actor.x,y:actor.y},
      terrain:map.def&&map.def.terrain||[],side:actor.side || (actor.kind==='npc'?'enemy':'party'),
      occupants:others,goal:{x:toX,y:toY}
    }).to(toX,toY);
  }

  window.WBEncounterMap={mapModel,blocked,tokenActors,checkPlacement,squareName,movementRoute};
})();