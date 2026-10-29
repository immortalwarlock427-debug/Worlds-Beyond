/* Worlds Beyond: one pure, direction-aware map route finder for sheet and DM.
 * Square cost: 5 ft, rough terrain: 10 ft, diagonals allowed (not between two walls).
 * Known standing enemies block. Allies/downed creatures are traversable but NOT destinations.
 * A visibility mask can treat unseen terrain as floor and hide unknown occupants.
 * No DOM, storage, AP or player permissions; consumers validate/pay separately.
 */
(function () {
  'use strict';
  const BLOCKED = '#OBxcnfu', ROUGH = 'rwb';
  const DIRS = [[0,-1],[1,0],[0,1],[-1,0],[-1,-1],[1,-1],[1,1],[-1,1]];
  const integer = Number.isInteger;
  const cmp = (a,b) => { for (let i=0;i<a.length;i++) if (a[i]!==b[i]) return a[i]-b[i]; return 0; };
  const isDown = a => Number(a.hp) <= 0 || a.down === true;
  function findPaths({cols,rows,start,terrain=[],occupants=[],side='party',seen=null,goal=null}) {
    if (!integer(cols)||!integer(rows)||cols<1||rows<1||cols>60||rows>60||
        !start||!integer(start.x)||!integer(start.y)||
        start.x<0||start.y<0||start.x>=cols||start.y>=rows)
      return {dist:[],to:()=>({ok:false,error:'TOKEN_NOT_PLACED'})};
    const n=cols*rows, startCell=start.y*cols+start.x;
    const inside=(x,y)=>integer(x)&&integer(y)&&x>=0&&y>=0&&x<cols&&y<rows;
    const cell=(x,y)=>y*cols+x;
    const known=(x,y)=>!seen || !!seen[cell(x,y)];
    const kind=(x,y)=>known(x,y) && terrain[y] ? terrain[y][x] || '.' : '.';
    const wall=(x,y)=>BLOCKED.includes(kind(x,y));
    const rough=(x,y)=>ROUGH.includes(kind(x,y));
    const occupied=Array.from({length:n},()=>[]);
    for(const a of occupants){
      if(!a||!inside(a.x,a.y)||(a.x===start.x&&a.y===start.y))continue;
      // The caller can supply only visible actors; the mask is an additional safeguard.
      if(!known(a.x,a.y))continue;
      occupied[cell(a.x,a.y)].push(a);
    }
    const blockedActor=(x,y)=>occupied[cell(x,y)].some(a=>!isDown(a)&&(a.side||'enemy')!==side);
    const hasActor=(x,y)=>occupied[cell(x,y)].length>0;
    const stride=DIRS.length+1, origin=startCell*stride+DIRS.length;
    const best=Array(n*stride).fill(null), previous=new Int32Array(n*stride).fill(-1);
    const resolved=new Int32Array(n).fill(-1),dist=Array(n).fill(Infinity);
    const heap=[];
    const push=(score,index)=>{
      heap.push({score,index});let i=heap.length-1;
      while(i>0){const parent=(i-1)>>1;if(cmp(heap[parent].score,heap[i].score)<=0)break;
        [heap[parent],heap[i]]=[heap[i],heap[parent]];i=parent;}
    };
    const pop=()=>{
      const result=heap[0],last=heap.pop();
      if(heap.length){heap[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let p=i;
        if(l<heap.length&&cmp(heap[l].score,heap[p].score)<0)p=l;
        if(r<heap.length&&cmp(heap[r].score,heap[p].score)<0)p=r;
        if(p===i)break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;
      }}return result;
    };
    const goalCell=goal&&inside(goal.x,goal.y)?cell(goal.x,goal.y):-1;
    const dxGoal=goalCell>=0?goal.x-start.x:0,dyGoal=goalCell>=0?goal.y-start.y:0;
    best[origin]=[0,0,0,0];push(best[origin],origin);
    while(heap.length){
      const {score,index}=pop();
      if(cmp(score,best[index])!==0)continue;
      const c=Math.floor(index/stride),dir=index%stride,x=c%cols,y=Math.floor(c/cols);
      if(resolved[c]<0){resolved[c]=index;if(!hasActor(x,y))dist[c]=score[0];}
      if(c===goalCell)break;
      for(let i=0;i<DIRS.length;i++){
        const [dx,dy]=DIRS[i],nx=x+dx,ny=y+dy;
        if(!inside(nx,ny)||wall(nx,ny)||blockedActor(nx,ny))continue;
        if(dx&&dy&&wall(x+dx,y)&&wall(x,y+dy))continue;
        const next=cell(nx,ny)*stride+i;
        const deviation=goalCell>=0?Math.abs((nx-start.x)*dyGoal-(ny-start.y)*dxGoal):0;
        const nextScore=[score[0]+(rough(nx,ny)?10:5),
          score[1]+(dx&&dy?1:0),score[2]+(dir!==DIRS.length&&dir!==i?1:0),
          score[3]+deviation];
        if(!best[next]||cmp(nextScore,best[next])<0){
          best[next]=nextScore;previous[next]=index;push(nextScore,next);
        }
      }
    }
    function to(x,y){
      if(!inside(x,y))return {ok:false,error:'OUT_OF_BOUNDS'};
      if(x===start.x&&y===start.y)return {ok:false,error:'ALREADY_THERE'};
      if(wall(x,y))return {ok:false,error:'BLOCKED_SQUARE'};
      if(hasActor(x,y))return {ok:false,error:'OCCUPIED_SQUARE'};
      const end=resolved[cell(x,y)];
      if(end<0)return {ok:false,error:'NO_PATH'};
      const path=[];let countRough=0;
      for(let i=end;i>=0;i=previous[i]){
        const c=Math.floor(i/stride),px=c%cols,py=Math.floor(c/cols);
        path.push({x:px,y:py});if(c!==startCell&&rough(px,py))countRough++;
      }
      path.reverse();
      return {ok:true,ft:best[end][0],rough:countRough,path};
    }
    return {dist,to};
  }
  window.WBRouting={findPaths};
})();
