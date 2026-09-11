import {ARENA,surfaces,isFree,clearPath,distance,flatDistance} from './map.js';
// A cached floor/sector graph selects the corridor; local surface nodes resolve
// doorways and stairs. No mutable actor data or Three.js objects enter this cache.
const cache=new WeakMap(),CELL=2,SECTOR=24;
class Heap{
 a=[];push(id,score){const v={id,score};let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p].score<=score)break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}
 pop(){const first=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1].score<this.a[c].score)c++;if(last.score<=this.a[c].score)break;this.a[i]=this.a[c];i=c;}this.a[i]=last;}return first.id;}
}
function grid(map){
 if(cache.has(map))return cache.get(map);
 const W=Math.ceil(map.width/CELL),D=Math.ceil(map.depth/CELL),nodes=[],cells=new Map(),zones=new Map();
 for(let iz=0;iz<D;iz++)for(let ix=0;ix<W;ix++){
  const x=-map.halfX+ix*CELL,z=-map.halfZ+iz*CELL,list=[];
  for(const y of new Set(surfaces(x,z,map)))if(isFree(x,z,.58,map,y)){
   const zone=`${Math.floor(x/SECTOR)},${Math.round(y/5)},${Math.floor(z/SECTOR)}`;
   const n={x,y,z,ix,iz,id:nodes.length,zone,edges:null};nodes.push(n);list.push(n);
   if(!zones.has(zone))zones.set(zone,{id:zone,x,y,z,edges:new Set()});
  }
  cells.set(iz*W+ix,list);
 }
 const g={W,D,nodes,cells,zones};cache.set(map,g);
 // Sector adjacency is conservative. Narrow corridor failures fall back to the
 // full local graph; broad-phase connectivity can never authorize a wall cut.
 for(const n of nodes)for(const [dx,dz] of [[1,0],[0,1]])for(const t of cells.get((n.iz+dz)*W+n.ix+dx)??[])if(Math.abs(n.y-t.y)<1.5&&n.zone!==t.zone){zones.get(n.zone).edges.add(t.zone);zones.get(t.zone).edges.add(n.zone);}
 return g;
}
function edges(n,g,map){
 if(n.edges)return n.edges;n.edges=[];
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
  const ix=n.ix+dx,iz=n.iz+dz;if(ix<0||iz<0||ix>=g.W||iz>=g.D)continue;
  for(const t of g.cells.get(iz*g.W+ix)??[])if(Math.abs(n.y-t.y)<1.5&&clearPath(n,t,.58,map))n.edges.push(t.id);
 }return n.edges;
}
function sectorCorridor(start,end,g){
 const q=[start.zone],parents=new Map([[start.zone,null]]);let index=0;
 while(index<q.length){const id=q[index++];if(id===end.zone)break;for(const next of g.zones.get(id).edges)if(!parents.has(next)){parents.set(next,id);q.push(next);}}
 if(!parents.has(end.zone))return null;
 const allowed=new Set();for(let id=end.zone;id!==null;id=parents.get(id)){allowed.add(id);for(const next of g.zones.get(id).edges)allowed.add(next);}return allowed;
}
export function findPath(from,to,radius=.55,map=ARENA){
 if(clearPath(from,to,radius,map))return [{x:to.x,y:to.y??0,z:to.z}];
 const g=grid(map),closest=p=>{
  const ix=Math.round((p.x+map.halfX)/CELL),iz=Math.round((p.z+map.halfZ)/CELL),near=[];
  for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++)for(const n of g.cells.get((iz+dz)*g.W+ix+dx)??[])if(Math.abs(n.y-(p.y??0))<1.5)near.push(n);
  return near.sort((a,b)=>distance(a,p)-distance(b,p)).find(n=>clearPath(p,n,radius,map));
 };
 const start=closest(from),end=closest(to);if(!start||!end)return [];
 const search=allowed=>{
  const open=new Heap(),cost=new Map([[start.id,0]]),parents=new Map(),closed=new Set();open.push(start.id,distance(start,end));
  while(open.a.length){let id=open.pop();if(closed.has(id))continue;
   if(id===end.id){const path=[{x:to.x,y:to.y??0,z:to.z}];while(id!==start.id){const n=g.nodes[id];path.unshift({x:n.x,y:n.y,z:n.z});id=parents.get(id);}path.unshift({x:start.x,y:start.y,z:start.z});return path;}
   closed.add(id);const n=g.nodes[id];
   for(const next of edges(n,g,map))if(!closed.has(next)&&(!allowed||allowed.has(g.nodes[next].zone))){const t=g.nodes[next],v=cost.get(id)+distance(n,t);if(v<(cost.get(next)??Infinity)){cost.set(next,v);parents.set(next,id);open.push(next,v+distance(t,end));}}
  }return null;
 };
 const corridor=sectorCorridor(start,end,g),path=search(corridor)??(corridor?search(null):null);if(!path)return [];
 const smooth=[];let anchor=from,i=0;
 while(i<path.length){let far=i;for(let j=i+1;j<Math.min(path.length,i+32);j++){if(clearPath(anchor,path[j],radius,map))far=j;else break;}smooth.push(path[far]);anchor=path[far];i=far+1;}return smooth;
}
export function warmNavigation(map){const g=grid(map);for(const base of map.bases)for(const p of map.pickups)findPath(base,p,.55,map);return {nodes:g.nodes.length,sectors:g.zones.size};}
export function navigationStats(map){const g=cache.get(map);return g?{nodes:g.nodes.length,sectors:g.zones.size}:{nodes:0,sectors:0};}
