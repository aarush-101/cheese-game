import { getMap } from './maps.js';
export { MAPS, getMap, DEFAULT_MAP_ID } from './maps.js';
// Defaults for authoring tools. Runtime passes its own map: simultaneous games
// on different arenas never share mutable state.
export const ARENA = getMap();
export const OBSTACLES = ARENA.obstacles, BASES = ARENA.bases, PICKUP_SPAWNS = ARENA.pickups;
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z,(a.y??0)-(b.y??0));
export const flatDistance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
export const inside = (x,z,o,r=0) => Math.abs(x-o.x)<=o.w/2+r && Math.abs(z-o.z)<=o.d/2+r;
export function rampHeight(r,x,z) {
  const length=r.axis==='x'?r.w:r.d;
  return r.low+(r.high-r.low)*clamp(0.5+((r.axis==='x'?x-r.x:z-r.z)*r.direction)/length,0,1);
}
// Immutable geometry gets a spatial broad phase; actor state remains JSON-only.
const indices=new WeakMap(),CELL=12;
function index(map){
 if(indices.has(map))return indices.get(map);
 const cells=new Map(),all=[...map.obstacles,...map.platforms,...map.ramps.map(r=>({...r,isRamp:true})),...(map.terrain??[]).map(t=>({...t,isTerrain:true,h:t.y-(map.minY??0)+1,y:(map.minY??0)-1}))];
 for(const o of all)for(let x=Math.floor((o.x-o.w/2-1)/CELL);x<=Math.floor((o.x+o.w/2+1)/CELL);x++)for(let z=Math.floor((o.z-o.d/2-1)/CELL);z<=Math.floor((o.z+o.d/2+1)/CELL);z++){
  const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(o);
 }
 indices.set(map,cells);return cells;
}
export function nearbySolids(x,z,map=ARENA){return index(map).get(Math.floor(x/CELL)+','+Math.floor(z/CELL))??[];}
export function surfaces(x,z,map=ARENA){
 const heights=map.terrain?[]:[0];
 for(const o of nearbySolids(x,z,map))if(inside(x,z,o))heights.push(o.isRamp?rampHeight(o,x,z):(o.y??0)+o.h);
 return heights;
}
export function floorHeight(x,z,ceiling=Infinity,map=ARENA){
 let best=(map.minY??0)-1;
 for(const y of surfaces(x,z,map))if(y<=ceiling+1e-5)best=Math.max(best,y);
 return best;
}
export function isFree(x,z,radius=.5,map=ARENA,y=0,height=1.8){
 if(Math.abs(x)>(map.halfX??map.half)-radius||Math.abs(z)>(map.halfZ??map.half)-radius)return false;
 for(const o of nearbySolids(x,z,map)){
  const bottom=o.isRamp?o.low:(o.y??0),top=o.isRamp?rampHeight(o,x,z):bottom+o.h;
  if(y+height>bottom+.01&&y<top-.32&&inside(x,z,o,radius))return false;
 }
 return true;
}

// Capsule / AABB sliding with feet height and head clearance. Ramps provide
// inclined support, so climbing and descending never teleport between floors.
export function moveBody(body,dx,dz,radius,map=ARENA,height=1.8) {
  body.y??=0;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(radius*0.7)));
  for(let step=0;step<steps;step++) {
    const oldY=body.y;
    body.x=clamp(body.x+dx/steps,-(map.halfX??map.half)+radius,(map.halfX??map.half)-radius);
    body.z=clamp(body.z+dz/steps,-(map.halfZ??map.half)+radius,(map.halfZ??map.half)-radius);
    const floor=floorHeight(body.x,body.z,oldY+0.32,map);
    if(body.grounded!==false && (body.vy??0)<=0 && floor>=oldY-0.35) body.y=floor;
    for(let pass=0;pass<3;pass++) {
      const solids=nearbySolids(body.x,body.z,map);
      for(const raw of solids) {
        const o=raw.isRamp?{...raw,y:raw.low,h:rampHeight(raw,body.x,body.z)-raw.low}:raw;
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
  if(body.vy>0)for(const o of nearbySolids(body.x,body.z,map)) {
    if(o.isRamp)continue;
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
export { movePlayer } from './movement.js';
export { findPath, warmNavigation, navigationStats } from './navigation.js';

// A continuous walk on connected surfaces. No shortcuts through ceilings or
// across rooftop gaps. Rats and bots use ramps; ladders are player shortcuts.
export function clearPath(a,b,radius=0.6,map=ARENA) {
  const steps=Math.max(1,Math.ceil(flatDistance(a,b)/0.45));
  let y=a.y??0;
  for(let i=1;i<=steps;i++) {
    const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
    const next=floorHeight(x,z,y+0.24,map);
    if(Math.abs(next-y)>0.3||!isFree(x,z,radius,map,next))return false;
    // Require support around the route, not only along its mathematical center.
    // Otherwise a smoothed diagonal clips a landing corner and falls a floor.
    for(const [dx,dz] of [[radius,0],[-radius,0],[0,radius],[0,-radius]])if(floorHeight(x+dx,z+dz,next+.35,map)<next-.4)return false;
    y=next;
  }
  return Math.abs(y-(b.y??0))<0.3;
}

export function projectileHits(p,map=ARENA){
 if(p.y<=(map.minY??0)-.8||Math.abs(p.x)>=(map.halfX??map.half)-.2||Math.abs(p.z)>=(map.halfZ??map.half)-.2)return true;
 return nearbySolids(p.x,p.z,map).some(o=>inside(p.x,p.z,o,.13)&&p.y>=(o.isRamp?o.low:o.y??0)-.13&&p.y<=(o.isRamp?rampHeight(o,p.x,p.z):(o.y??0)+o.h)+.13);
}
