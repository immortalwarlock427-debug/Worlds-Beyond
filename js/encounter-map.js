/* Worlds Beyond encounter map model.
 * Pure, shared map geometry and DM placement checks. This is manual DM
 * positioning, not player movement or a path/AP spending engine.
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

  const ROUGH = 'rwb'; // rubble, shallow water, bones: 10 ft rather than 5 ft
  const CELLS = [[0,-1],[1,0],[0,1],[-1,0],[-1,-1],[1,-1],[1,1],[-1,1]];
  function movementRoute(encounter,map,actorId,toX,toY) {
    const actor = encounter && encounter.actors &&
      Object.prototype.hasOwnProperty.call(encounter.actors,actorId) ?
      encounter.actors[actorId] : null;
    if (!actor) return {ok:false,error:'ACTOR_NOT_FOUND'};
    if (!map || actor.mapId !== map.id ||
        !integer(actor.x) || !integer(actor.y) ||
        actor.x < 0 || actor.y < 0 || actor.x >= map.cols || actor.y >= map.rows)
      return {ok:false,error:'TOKEN_NOT_PLACED'};
    if (!integer(toX) || !integer(toY) || toX < 0 || toY < 0 ||
        toX >= map.cols || toY >= map.rows) return {ok:false,error:'OUT_OF_BOUNDS'};
    if (actor.x === toX && actor.y === toY) return {ok:false,error:'ALREADY_THERE'};
    const placement = checkPlacement(encounter,map,actorId,toX,toY);
    if (!placement.ok) return placement;
    const occupied = new Set(tokenActors(encounter,map)
      .filter(a=>a.id!==actorId).map(a=>a.y*map.cols+a.x));
    const width=map.cols, total=width*map.rows;
    const start=actor.y*width+actor.x, finish=toY*width+toX;
    const dist=new Array(total).fill(Infinity),prev=new Int32Array(total).fill(-1);
    // Dijkstra over 8 neighboring five-foot squares. Unlike a visual path
    // sent by the browser, this route is calculated from trusted map geometry.
    const heap=[];
    const push=(d,pos)=>{
      heap.push([d,pos]);
      let i=heap.length-1;
      while(i>0){
        const p=(i-1)>>1;
        if(heap[p][0]<=heap[i][0])break;
        [heap[p],heap[i]]=[heap[i],heap[p]];i=p;
      }
    };
    const pop=()=>{
      const first=heap[0],last=heap.pop();
      if(heap.length){
        heap[0]=last;let i=0;
        for(;;){
          const l=i*2+1,r=l+1;let small=i;
          if(l<heap.length&&heap[l][0]<heap[small][0])small=l;
          if(r<heap.length&&heap[r][0]<heap[small][0])small=r;
          if(small===i)break;
          [heap[i],heap[small]]=[heap[small],heap[i]];i=small;
        }
      }
      return first;
    };
    dist[start]=0;push(0,start);
    while(heap.length){
      const [distance,idx]=pop();
      if(distance!==dist[idx])continue;
      if(idx===finish)break;
      const x=idx%width,y=Math.floor(idx/width);
      for(const [dx,dy] of CELLS){
        const nx=x+dx,ny=y+dy;
        if(nx<0||ny<0||nx>=map.cols||ny>=map.rows)continue;
        const next=ny*width+nx;
        if(blocked(map,nx,ny)||occupied.has(next))continue;
        if(dx&&dy&&blocked(map,x+dx,y)&&blocked(map,x,y+dy))continue;
        const terrain=map.def && map.def.terrain && map.def.terrain[ny];
        const step=terrain&&ROUGH.includes(terrain[nx])?10:5;
        const nextDist=distance+step;
        if(nextDist<dist[next]){
          dist[next]=nextDist;prev[next]=idx;push(nextDist,next);
        }
      }
    }
    if(!Number.isFinite(dist[finish]))return {ok:false,error:'NO_PATH'};
    const path=[];
    let idx=finish,rough=0;
    while(idx!==-1){
      const x=idx%width,y=Math.floor(idx/width);
      path.push({x,y});
      if(idx!==start){
        const terrain=map.def&&map.def.terrain&&map.def.terrain[y];
        if(terrain&&ROUGH.includes(terrain[x]))rough++;
      }
      idx=prev[idx];
    }
    path.reverse();
    return {ok:true,ft:dist[finish],rough,path};
  }

  window.WBEncounterMap={mapModel,blocked,tokenActors,checkPlacement,squareName,movementRoute};
})();