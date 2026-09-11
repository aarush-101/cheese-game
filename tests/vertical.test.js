import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,findPath,clearPath,distance,movePlayer,moveBody,updateVertical,floorHeight,projectileHits,isFree} from '../src/map.js';
import {createGameState,stepGame,attractorScore} from '../src/simulation.js';
const DT=1/60,advance=(s,t,commands={})=>{for(let i=0;i<Math.round(t/DT);i++)stepGame(s,commands);};
const actor=p=>({...p,y:p.y??0,vy:0,vx:0,vz:0,grounded:true,yaw:0,ladderId:null});
for(const map of MAPS){
 test(`${map.name}: large distinct layout, connected objective floors and rat routes`,()=>{
  assert.ok(map.width*map.depth>=48000);assert.ok(map.levels>=6);assert.ok(map.rooms.length>=6);assert.ok(map.ladders.length>=4);
  for(const base of map.bases)for(const target of map.pickups){
   const path=findPath(base,target,.3,map);assert.ok(path.length,`No route to ${JSON.stringify(target)}`);
   let old=base;for(const n of path){assert.ok(clearPath(old,n,.3,map));old=n;}
   const p=actor(base);
   for(let i=0;i<7000&&path.length;i++){
    const n=path[0],d=Math.hypot(n.x-p.x,n.z-p.z);if(distance(p,n)<.12){path.shift();continue;}
    moveBody(p,(n.x-p.x)/Math.max(d,.001)*Math.min(6.2*DT,d),(n.z-p.z)/Math.max(d,.001)*Math.min(6.2*DT,d),.28,map,.65);updateVertical(p,DT,map,.65);
   }
   assert.ok(distance(p,target)<.3,`Rat stuck at ${JSON.stringify(p)}`);
  }
 });
 test(`${map.name}: every stair flight has support and a route from home`,()=>{
  for(const r of map.ramps){
   const a={x:r.x,y:r.low,z:r.z-r.d/2*r.direction},b={x:r.x,y:r.high,z:r.z+r.d/2*r.direction};
   assert.ok(clearPath(a,b,.45,map),`Blocked stairs ${r.id}`);assert.ok(findPath(map.bases[0],b,.55,map).length,`Disconnected stairs ${r.id}`);
   const p=actor(a);let peak=p.y;
   for(let i=0;i<Math.ceil(r.d/6.8/DT)+70&&p.y<r.high-.08;i++){const old={...p};movePlayer(p,{moveZ:r.direction},DT,map);peak=Math.max(peak,p.y);assert.ok(distance(p,old)<.3,'No relocation during stair travel');}
   assert.ok(peak>=r.high-.35,`Could not ascend ${r.id}: ${peak}/${r.high}`);
  }
 });
 test(`${map.name}: ladder entry, exit, descent and jump-off remain continuous`,()=>{
  for(const l of map.ladders){
   const p=actor({x:l.x,y:l.bottom,z:l.z});p.yaw=Math.atan2(l.nx,l.nz);
   for(let i=0;i<(l.top-l.bottom+12)/4/DT;i++){const old={...p};movePlayer(p,{climb:1},DT,map);assert.ok(distance(p,old)<.2,'Ladder teleported');if(p.ladderId===null&&p.y===l.top)break;}
   assert.equal(p.y,l.top);assert.equal(p.ladderId,null);assert.ok(Math.hypot(p.x-l.exitX,p.z-l.exitZ)<.05);
   Object.assign(p,{x:l.x,z:l.z,ladderCooldown:0});
   for(let i=0;i<(l.top-l.bottom+4)/4/DT;i++){movePlayer(p,{climb:-1},DT,map);if(p.ladderId===null&&p.y===l.bottom)break;}
   assert.equal(p.y,l.bottom);assert.equal(p.ladderId,null);
   p.ladderCooldown=0;movePlayer(p,{climb:1},DT,map);const old={...p};movePlayer(p,{jump:true},DT,map);
   assert.equal(p.ladderId,null);assert.ok(p.vy>0);assert.ok(distance(p,old)<.2,'Jump-off moved backwards instantly');
  }
 });
 test(`${map.name}: bot completes a match and preserves playable floor bounds`,()=>{
  const s=createGameState(8,{mapId:map.id});s.phase='playing';advance(s,180);
  assert.equal(s.phase,'ended');assert.equal(s.winner,1);assert.ok(s.bases[1].count>=2);assert.ok(s.players.every(p=>Number.isFinite(p.y)&&p.y>=map.minY));
 });
}
test('the arenas have different topology, height profiles, and architecture',()=>{
 assert.equal(new Set(MAPS.map(m=>m.theme)).size,3);assert.equal(new Set(MAPS.map(m=>m.rooms.length)).size,3);
 assert.equal(MAPS[0].minY,-4);assert.equal(MAPS[1].minY,0);assert.equal(MAPS[2].minY,-8);
 assert.ok(MAPS[1].obstacles.some(o=>o.kind==='silo'));assert.ok(MAPS[2].obstacles.some(o=>o.kind==='turret'));
});
test('basements and ravines have real floors and overhead head collision',()=>{
 const town=MAPS[0];assert.equal(floorHeight(0,66,-1,town),-4);assert.equal(floorHeight(0,66,1,town),0);
 const p=actor({x:0,y:-4,z:66});for(let i=0;i<60;i++)movePlayer(p,{},DT,town);assert.equal(p.y,-4);
 Object.assign(p,{y:-2.25,vy:8,grounded:false});updateVertical(p,DT,town);assert.ok(p.y+1.8<=-.4+.01);assert.equal(p.vy,0);
 const ravine=MAPS[2];assert.equal(floorHeight(0,0,-1,ravine),-8);assert.equal(floorHeight(0,0,1,ravine),0);
 assert.equal(projectileHits({x:0,y:-4,z:22},ravine),false);assert.equal(projectileHits({x:0,y:-8,z:22},ravine),true);
});
test('jump obeys gravity and support; snapshots retain pending actions and air motion',()=>{
 const a=createGameState(7,{controllers:['human','human']});a.phase='playing';const p=a.players[0];
 Object.assign(p,{x:0,z:10,poison:true});stepGame(a,{0:{jump:true,throw:true,moveX:.7,moveZ:.7}});assert.ok(p.y>0&&p.vy>0);
 const speed=p.vy;stepGame(a,{0:{jump:true}});assert.ok(p.vy<speed);
 const restored=JSON.parse(JSON.stringify(a));for(let i=0;i<180;i++){stepGame(a,{0:{moveX:1}});stepGame(restored,{0:{moveX:1}});}assert.deepEqual(a,restored);assert.equal(a.version,4);
});
test('vertical range matters for scent and pickup collection',()=>{
 assert.equal(attractorScore({x:0,y:13,z:0},{x:0,y:0,z:0,cheese:100}),0);
 const s=createGameState(32,{controllers:['human','human']});s.phase='playing';const p=s.players[0],pickup=s.pickups[0];
 Object.assign(p,{x:pickup.x,y:0,z:pickup.z});stepGame(s);assert.equal(p.poison,false);
 Object.assign(p,{x:pickup.x,y:pickup.y,z:pickup.z,vy:0,grounded:true});stepGame(s);assert.equal(p.poison,true);
});
test('a rooftop throw launches from that floor after its windup',()=>{
 const s=createGameState(53,{controllers:['human','human']});s.phase='playing';const p=s.players[0],target=s.pickups[0];
 target.availableAt=100;Object.assign(p,{...target,poison:true,grounded:true});stepGame(s,{0:{throw:true}});assert.ok(p.pendingThrow);assert.equal(s.projectiles.length,0);advance(s,.2);
 assert.ok(s.projectiles[0].origin.y>20);assert.equal(p.poison,false);advance(s,5);assert.ok(s.bases.every(b=>b.poisonedUntil===0));
});
