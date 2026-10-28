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
    const startCell=actor.y*width+actor.x, finish=toY*width+toX;
    // Paths with the same number of movement feet should look natural:
    // prefer fewer unnecessary diagonals, then fewer direction changes, then
    // cells closer to the direct line to the destination. To compare turns
    // correctly, each (cell, incoming-direction) needs its own Dijkstra state.
    const DIRS=CELLS.length, stride=DIRS+1, origin=startCell*stride+DIRS;
    const best=new Array(total*stride).fill(null);
    const previous=new Int32Array(total*stride).fill(-1);
    const compare=(a,b)=>{
      for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];
      return 0;
    };
    const heap=[];
    const push=(score,index)=>{
      heap.push({score,index});
      let i=heap.length-1;
      while(i>0){
        const parent=(i-1)>>1;
        if(compare(heap[parent].score,heap[i].score)<=0)break;
        [heap[parent],heap[i]]=[heap[i],heap[parent]];i=parent;
      }
    };
    const pop=()=>{
      const top=heap[0],last=heap.pop();
      if(heap.length){
        heap[0]=last;let i=0;
        for(;;){
          const l=2*i+1,r=l+1;let pick=i;
          if(l<heap.length&&compare(heap[l].score,heap[pick].score)<0)pick=l;
          if(r<heap.length&&compare(heap[r].score,heap[pick].score)<0)pick=r;
          if(pick===i)break;
          [heap[i],heap[pick]]=[heap[pick],heap[i]];i=pick;
        }
      }
      return top;
    };
    const dxGoal=toX-actor.x,dyGoal=toY-actor.y;
    best[origin]=[0,0,0,0];push(best[origin],origin);
    let finished=-1;
    while(heap.length){
      const {score,index}=pop();
      if(compare(score,best[index])!==0)continue;
      const cell=Math.floor(index/stride),dir=index%stride;
      if(cell===finish){finished=index;break;}
      const x=cell%width,y=Math.floor(cell/width);
      for(let i=0;i<DIRS;i++){
        const [dx,dy]=CELLS[i],nx=x+dx,ny=y+dy;
        if(nx<0||ny<0||nx>=map.cols||ny>=map.rows)continue;
        const nextCell=ny*width+nx;
        if(blocked(map,nx,ny)||occupied.has(nextCell))continue;
        if(dx&&dy&&blocked(map,x+dx,y)&&blocked(map,x,y+dy))continue;
        const terrain=map.def&&map.def.terrain&&map.def.terrain[ny];
        const rough=!!(terrain&&ROUGH.includes(terrain[nx]));
        const deviation=Math.abs((nx-actor.x)*dyGoal-(ny-actor.y)*dxGoal);
        const nextScore=[
          score[0]+(rough?10:5),
          score[1]+(dx&&dy?1:0),
          score[2]+(dir!==DIRS&&dir!==i?1:0),
          score[3]+deviation
        ];
        const next=nextCell*stride+i;
        if(!best[next]||compare(nextScore,best[next])<0){
          best[next]=nextScore;previous[next]=index;push(nextScore,next);
        }
      }
    }
    if(finished<0)return {ok:false,error:'NO_PATH'};
    const path=[];
    let rough=0,index=finished;
    while(index!==-1){
      const cell=Math.floor(index/stride);
      const x=cell%width,y=Math.floor(cell/width);
      path.push({x,y});
      if(cell!==startCell){
        const terrain=map.def&&map.def.terrain&&map.def.terrain[y];
        if(terrain&&ROUGH.includes(terrain[x]))rough++;
      }
      index=previous[index];
    }
    path.reverse();
    return {ok:true,ft:best[finished][0],rough,path};
  }

  window.WBEncounterMap={mapModel,blocked,tokenActors,checkPlacement,squareName,movementRoute};
})();