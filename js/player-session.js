/* Local player encounter adapter.
 * Pure filter + command boundary for a same-browser preview. Selecting a seat
 * is NOT identity proof. A real multiplayer server must authenticate owners,
 * authorize every command and enforce map/visibility permissions.
 */
(function () {
  'use strict';
  const has = (value,key) => Object.prototype.hasOwnProperty.call(value || {},key);
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const copy = v => JSON.parse(JSON.stringify(v));
  const allowed = ['MoveToken','SpendAP','EndTurn'];
  function seats(encounter) {
    if (!isRecord(encounter) || !Array.isArray(encounter.order) ||
        !isRecord(encounter.actors)) return [];
    return encounter.order.filter(id => has(encounter.actors,id))
      .map(id=>encounter.actors[id])
      .filter(actor=>actor && actor.kind==='pc' && typeof actor.ownerId==='string' &&
        actor.ownerId.length>0)
      .map(actor=>({id:actor.id,name:actor.name}));
  }
  function view(encounter,actorId,map) {
    if (!isRecord(encounter) || !isRecord(encounter.actors)) return null;
    const actor = has(encounter.actors,actorId) ? encounter.actors[actorId] : null;
    if (!actor || actor.kind!=='pc' || !actor.ownerId) return null;
    const currentId = encounter.phase==='active' ?
      encounter.order[encounter.turnIndex] : null;
    const current = currentId && has(encounter.actors,currentId) ?
      encounter.actors[currentId] : null;
    // This view contains only this player's mechanical details, plus the
    // public name, token and initiative position of all combatants.
    const publicActors = encounter.order.filter(id=>has(encounter.actors,id))
      .map(id=>{
        const item=encounter.actors[id];
        return {id:item.id,name:item.name,kind:item.kind,
          initiative:item.initiative, x:item.mapId===map.id?item.x:null,
          y:item.mapId===map.id?item.y:null};
      });
    return {
      id:encounter.id,revision:encounter.revision,phase:encounter.phase,
      round:encounter.round,turnIndex:encounter.turnIndex,
      currentId,currentName:current?current.name:'',
      isTurn:encounter.phase==='active'&&currentId===actorId,
      self:copy(actor),actors:publicActors,mapId:map.id
    };
  }
  function issue(encounter,actorId,type,detail,actionId,map) {
    if (!allowed.includes(type)) return {ok:false,error:'PLAYER_ACTION_NOT_ALLOWED'};
    if (!isRecord(encounter) || !has(encounter.actors,actorId))
      return {ok:false,error:'ACTOR_NOT_FOUND'};
    const actor = encounter.actors[actorId];
    if (!actor || actor.kind!=='pc' || !actor.ownerId)
      return {ok:false,error:'PLAYER_SEAT_REQUIRED'};
    // Never accept an arbitrary actorId, expectedRevision or caller-supplied
    // role/userId in detail; enforce the chosen seat and latest revision here.
    const safe = type==='MoveToken'
      ? {x:detail && detail.x,y:detail && detail.y}
      : type==='SpendAP' ? {cost:detail && detail.cost} : {};
    return window.WBEncounter.applyAction(encounter,{
      id:actionId,type,actorId,expectedRevision:encounter.revision,...safe
    },{role:'player',userId:actor.ownerId,map});
  }
  window.WBPlayerSession={seats,view,issue};
})();