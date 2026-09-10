import { getMap } from './maps.js';
export { MAPS, getMap, DEFAULT_MAP_ID } from './maps.js';
// Defaults for authoring tools. Runtime passes its own map: simultaneous games
// on different arenas never share mutable state.
export const ARENA = getMap();
export const OBSTACLES = ARENA.obstacles, BASES = ARENA.bases, PICKUP_SPAWNS = ARENA.pickups;
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z,(a.y??0)-(b.y??0));
export const flatDistance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const inside = (x,z,o,r=0) => Math.abs(x-o.x)<=o.w/2+r && Math.abs(z-o.z)<=o.d/2+r;
export function rampHeight(r,x,z) {
  const length=r.axis==='x'?r.w:r.d;
  return r.low+(r.high-r.low)*clamp(0.5+((r.axis==='x'?x-r.x:z-r.z)*r.direction)/length,0,1);
}
export function surfaces(x,z,map=ARENA) {
  const heights=[0];
  for(const o of map.obstacles) if(inside(x,z,o)) heights.push((o.y??0)+o.h);
  for(const o of map.platforms) if(inside(x,z,o)) heights.push(o.y+o.h);
  for(const r of map.ramps) if(inside(x,z,r)) heights.push(rampHeight(r,x,z));
  return heights;
}
export function floorHeight(x,z,ceiling=Infinity,map=ARENA) {
  return Math.max(0,...surfaces(x,z,map).filter(y=>y<=ceiling+1e-5));
}
export function isFree(x,z,radius=0.5,map=ARENA,y=0,height=1.8) {
  if(Math.abs(x)>map.half-radius||Math.abs(z)>map.half-radius) return false;
  for(const o of [...map.obstacles,...map.platforms]) {
    if(y+height>(o.y??0)+0.01 && y<(o.y??0)+o.h-0.22 && inside(x,z,o,radius))return false;
  }
  return !map.ramps.some(r=>inside(x,z,r,radius)&&y+height>r.low+0.01&&y<rampHeight(r,x,z)-0.18);
}

// Capsule / AABB sliding with feet height and head clearance. Ramps provide
// inclined support, so climbing and descending never teleport between floors.
export function moveBody(body,dx,dz,radius,map=ARENA,height=1.8) {
  body.y??=0;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(radius*0.7)));
  for(let step=0;step<steps;step++) {
    const oldY=body.y;
    body.x=clamp(body.x+dx/steps,-map.half+radius,map.half-radius);
    body.z=clamp(body.z+dz/steps,-map.half+radius,map.half-radius);
    const floor=floorHeight(body.x,body.z,oldY+0.32,map);
    if(body.grounded!==false && (body.vy??0)<=0 && floor>=oldY-0.35) body.y=floor;
    for(let pass=0;pass<3;pass++) {
      const solids=[...map.obstacles,...map.platforms,...map.ramps.map(r=>({...r,y:r.low,h:rampHeight(r,body.x,body.z)-r.low}))];
      for(const o of solids) {
        if(body.y+height<=(o.y??0)+0.01||body.y>=(o.y??0)+o.h-0.015||
          (body.grounded!==false&&(body.vy??0)<=0&&body.y+0.32>=(o.y??0)+o.h))continue;
        const left=o.x-o.w/2,right=o.x+o.w/2,back=o.z-o.d/2,front=o.z+o.d/2;
        const px=clamp(body.x,left,right),pz=clamp(body.z,back,front);
        const vx=body.x-px,vz=body.z-pz,d=Math.hypot(vx,vz);
        if(d>=radius)continue;
        if(d>0.00001){body.x=px+vx/d*radius;body.z=pz+vz/d*radius;}
        else {
          const sides=[{d:body.x-left,x:left-radius,z:body.z},{d:right-body.x,x:right+radius,z:body.z},
            {d:body.z-back,x:body.x,z:back-radius},{d:front-body.z,x:body.x,z:front+radius}].sort((a,b)=>a.d-b.d);
          body.x=sides[0].x;body.z=sides[0].z;
        }
      }
    }
    if(body.y!==oldY && floorHeight(body.x,body.z,body.y+0.01,map)<body.y-0.35)body.y=oldY;
  }
}

export function updateVertical(body,dt,map=ARENA,height=1.8) {
  body.y??=0;body.vy??=0;
  const oldY=body.y;
  body.vy-=22*dt;
  let next=oldY+body.vy*dt;
  if(body.vy>0)for(const o of [...map.platforms,...map.obstacles]) {
    const bottom=o.y??0;
    if(inside(body.x,body.z,o,0.25)&&oldY+height<=bottom+0.02&&next+height>=bottom){next=bottom-height;body.vy=0;}
  }
  const floor=floorHeight(body.x,body.z,oldY+0.02,map);
  if(body.vy<=0&&next<=floor){body.y=floor;body.vy=0;body.grounded=true;}
  else {body.y=next;body.grounded=false;}
}
export function nearbyLadder(body,map=ARENA) {
  return map.ladders.find(l=>flatDistance(body,l)<1.25&&body.y>=l.bottom-0.2&&body.y<=l.top+0.3);
}
export function movePlayer(body,input,dt,map=ARENA,speed=5.2) {
  body.ladderCooldown=Math.max(0,(body.ladderCooldown??0)-dt);
  let ladder=map.ladders.find(l=>l.id===body.ladderId);
  if(!ladder&&!body.ladderCooldown&&input.climb) {
    const near=nearbyLadder(body,map);
    if(near&&((body.y>=near.top-0.2&&input.climb<0)||(-Math.sin(body.yaw)*near.nx-Math.cos(body.yaw)*near.nz)<-0.35)) {
      ladder=near;body.ladderId=near.id;
    }
  }
  if(ladder) {
    if(input.jump) {
      body.ladderId=null;body.ladderCooldown=0.6;body.vy=7.8;body.grounded=false;
      body.x+=ladder.nx*0.7;body.z+=ladder.nz*0.7;
    } else {
      body.x=ladder.x;body.z=ladder.z;body.vy=0;body.grounded=false;
      body.y=clamp(body.y+clamp(input.climb??0,-1,1)*4*dt,ladder.bottom,ladder.top);
      if(body.y>=ladder.top&&input.climb>0){body.x=ladder.exitX;body.z=ladder.exitZ;body.ladderId=null;body.grounded=true;body.ladderCooldown=0.4;}
      if(body.y<=ladder.bottom&&input.climb<0){body.ladderId=null;body.grounded=true;body.ladderCooldown=0.4;}
      return;
    }
  } else if(input.jump&&body.grounded){body.vy=8.5;body.grounded=false;}
  moveBody(body,(input.moveX??0)*speed*dt,(input.moveZ??0)*speed*dt,0.45,map);
  updateVertical(body,dt,map);
}

// A continuous walk on connected surfaces. No shortcuts through ceilings or
// across rooftop gaps. Rats and bots use ramps; ladders are player shortcuts.
export function clearPath(a,b,radius=0.6,map=ARENA) {
  const steps=Math.max(1,Math.ceil(flatDistance(a,b)/0.45));
  let y=a.y??0;
  for(let i=1;i<=steps;i++) {
    const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
    const next=floorHeight(x,z,y+0.24,map);
    if(Math.abs(next-y)>0.3||!isFree(x,z,radius,map,next))return false;
    y=next;
  }
  return Math.abs(y-(b.y??0))<0.3;
}

// Caches are derived exclusively from static map data. Each cell has multiple
// floor nodes, joined by ramps. Evolving actor paths live in GameState.
const navigation=new Map(),CELL=2;
function grid(map) {
  if(navigation.has(map.id))return navigation.get(map.id);
  const N=map.size/CELL,nodes=[],cells=new Map();
  for(let iz=0;iz<N;iz++)for(let ix=0;ix<N;ix++) {
    const x=-map.half+1+ix*CELL,z=-map.half+1+iz*CELL,list=[];
    for(const y of new Set(surfaces(x,z,map)))if(isFree(x,z,0.6,map,y)) {
      const node={x,y,z,ix,iz,id:nodes.length,edges:null};nodes.push(node);list.push(node);
    }
    cells.set(iz*N+ix,list);
  }
  const result={N,nodes,cells};navigation.set(map.id,result);return result;
}
class MinHeap {
  items=[];
  push(id,score){const item={id,score};let i=this.items.length;this.items.push(item);while(i){const p=(i-1)>>1;if(this.items[p].score<=score)break;this.items[i]=this.items[p];i=p;}this.items[i]=item;}
  pop(){const first=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.items[c+1].score<this.items[c].score)c++;if(last.score<=this.items[c].score)break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return first.id;}
}
export function findPath(from,to,radius=0.6,map=ARENA) {
  if(clearPath(from,to,radius,map))return [{x:to.x,y:to.y??0,z:to.z}];
  const {N,nodes,cells}=grid(map);
  const closest=p=>nodes.filter(n=>Math.abs(n.y-(p.y??0))<1.5&&flatDistance(n,p)<5)
    .sort((a,b)=>distance(a,p)-distance(b,p)).find(n=>clearPath(p,n,radius,map));
  const start=closest(from),end=closest(to);
  if(!start||!end)return [];
  const open=new MinHeap(),cost=new Map([[start.id,0]]),parents=new Map(),closed=new Set();
  open.push(start.id,distance(start,end));
  while(open.items.length) {
    let current=open.pop();if(closed.has(current))continue;
    if(current===end.id) {
      const path=[{x:to.x,y:to.y??0,z:to.z}];
      while(current!==start.id){const n=nodes[current];path.unshift({x:n.x,y:n.y,z:n.z});current=parents.get(current);}
      path.unshift({x:start.x,y:start.y,z:start.z});
      const smooth=[];let anchor=from,index=0;
      while(index<path.length){let far=index;for(let j=index+1;j<path.length;j++){if(clearPath(anchor,path[j],radius,map))far=j;else break;}smooth.push(path[far]);anchor=path[far];index=far+1;}
      return smooth;
    }
    closed.add(current);const n=nodes[current];
    if(!n.edges) {
      n.edges=[];
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
        const ix=n.ix+dx,iz=n.iz+dz;if(ix<0||iz<0||ix>=N||iz>=N)continue;
        for(const next of cells.get(iz*N+ix)??[])if(Math.abs(next.y-n.y)<=1.1&&clearPath(n,next,0.6,map))n.edges.push(next.id);
      }
    }
    for(const next of n.edges)if(!closed.has(next)) {
      const score=cost.get(current)+distance(n,nodes[next]);
      if(score<(cost.get(next)??Infinity)){cost.set(next,score);parents.set(next,current);open.push(next,score+distance(nodes[next],end));}
    }
  }
  return [];
}
export function projectileHits(p,map=ARENA) {
  if(p.y<=0.2||Math.abs(p.x)>=map.half-0.2||Math.abs(p.z)>=map.half-0.2)return true;
  if([...map.obstacles,...map.platforms].some(o=>inside(p.x,p.z,o,0.18)&&p.y>=(o.y??0)-0.18&&p.y<=(o.y??0)+o.h+0.18))return true;
  return map.ramps.some(r=>inside(p.x,p.z,r,0.18)&&p.y>=r.low-0.18&&p.y<=rampHeight(r,p.x,p.z)+0.18);
}
