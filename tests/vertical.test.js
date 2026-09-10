import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, getMap, findPath, clearPath, distance, movePlayer, moveBody, updateVertical, floorHeight, projectileHits, isFree } from '../src/map.js';
import { createGameState, stepGame, poisonBase, attractorScore } from '../src/simulation.js';
const DT=1/60;
const advance=(s,seconds,commands={})=>{for(let i=0;i<Math.round(seconds/DT);i++)stepGame(s,commands);};
const actor=(p)=>({...p,y:p.y??0,vy:0,grounded:true,yaw:0,ladderId:null});

for(const map of MAPS){
  test(`${map.name}: symmetric large arena and reachable pickups from both bases`,()=>{
    assert.ok(map.size>=120);assert.ok(map.platforms.length>=5);assert.ok(map.ladders.length>=4);
    assert.equal(map.bases[0].x,-map.bases[1].x);assert.equal(map.bases[0].z,-map.bases[1].z);
    for(const o of map.obstacles)assert.ok(map.obstacles.some(b=>b.x===-o.x&&b.z===-o.z&&b.y===o.y&&b.h===o.h));
    for(const base of map.bases)for(const pickup of map.pickups){
      const path=findPath(base,pickup,0.55,map);assert.ok(path.length,`No route from ${base.id} to ${JSON.stringify(pickup)}`);
      let p=base;for(const waypoint of path){assert.ok(clearPath(p,waypoint,0.55,map));p=waypoint;}
      assert.ok(distance(path.at(-1),pickup)<0.01);
    }
  });
  test(`${map.name}: walk ramps to the highest floor, then fall from the edge`,()=>{
    const ramp=map.ramps[0],p=actor({x:ramp.x,y:ramp.low,z:ramp.z+ramp.d/2+1});let peak=0,falling=false;
    for(let i=0;i<1300;i++){
      const before=p.y;movePlayer(p,{moveZ:-1},DT,map);peak=Math.max(peak,p.y);
      if(!p.grounded&&p.vy<0)falling=true;
      assert.ok(Math.abs(p.y-before)<1,'No teleport between floors');
    }
    assert.equal(peak,map.highest);assert.ok(falling);assert.equal(p.y,0);
  });
  test(`${map.name}: every ladder ascends, descends, and allows jumping off`,()=>{
    for(const l of map.ladders){
      const p=actor({x:l.x,z:l.z,y:l.bottom});p.yaw=Math.atan2(l.nx,l.nz);
      for(let i=0;i<Math.ceil((l.top-l.bottom)/4/DT)+1;i++)movePlayer(p,{climb:1},DT,map);
      assert.equal(p.y,l.top);assert.equal(p.ladderId,null);assert.equal(p.x,l.exitX);
      Object.assign(p,{x:l.x,z:l.z,ladderCooldown:0});
      for(let i=0;i<Math.ceil((l.top-l.bottom)/4/DT)+1;i++)movePlayer(p,{climb:-1},DT,map);
      assert.equal(p.y,l.bottom);assert.equal(p.ladderId,null);
      p.ladderCooldown=0;movePlayer(p,{climb:1},DT,map);movePlayer(p,{jump:true},DT,map);
      assert.equal(p.ladderId,null);assert.ok(p.vy>0);assert.ok(p.ladderCooldown>0);
    }
  });
  test(`${map.name}: a rat physically follows a complete route to elevated poison`,()=>{
    const target=map.pickups[0],p=actor(map.bases[0]),path=findPath(p,target,0.3,map);
    assert.ok(path.length);
    for(let i=0;i<4000&&path.length;i++){
      const next=path[0],d=Math.hypot(next.x-p.x,next.z-p.z);
      if(distance(p,next)<0.2){path.shift();continue;}
      moveBody(p,(next.x-p.x)/Math.max(d,.001)*Math.min(4.4*DT,d),(next.z-p.z)/Math.max(d,.001)*Math.min(4.4*DT,d),.28,map,.65);
      updateVertical(p,DT,map,.65);
    }
    assert.ok(distance(p,target)<0.3,`Stopped at ${JSON.stringify(p)}`);
  });
  test(`${map.name}: bot still captures rats over a complete match`,()=>{
    const s=createGameState(8,{mapId:map.id});s.phase='playing';advance(s,180);
    assert.equal(s.phase,'ended');assert.equal(s.winner,1);assert.ok(s.bases[1].count>=2);
    assert.ok(s.players.every(p=>Number.isFinite(p.y)&&p.y>=0));
  });
}

test('jump has gravity, requires support, and lands without fall damage',()=>{
  const s=createGameState(91,{controllers:['human','human']});s.phase='playing';
  const p=s.players[0];stepGame(s,{0:{jump:true}});assert.ok(p.y>0);assert.ok(p.vy>0);
  const velocity=p.vy;stepGame(s,{0:{jump:true}});assert.ok(p.vy<velocity,'Cannot double jump');
  advance(s,1);assert.equal(p.y,0);assert.equal(p.grounded,true);assert.equal(p.cheese,100);
});
test('underpasses do not snap actors onto overhead decks',()=>{
  const map=MAPS[0],p=actor({x:0,z:0});
  for(let i=0;i<60;i++)movePlayer(p,{moveX:1},DT,map);
  assert.equal(p.y,0);assert.ok(p.x>4);
  assert.equal(clearPath({x:0,y:0,z:0},{x:0,y:6,z:0},.5,map),false);
  assert.ok(projectileHits({x:0,y:5.7,z:0},map));
  assert.equal(projectileHits({x:0,y:2,z:0},map),false);
});
test('vertical proximity matters for attraction, collection, captures, and refills',()=>{
  assert.equal(attractorScore({x:0,y:13,z:0},{x:0,y:0,z:0,cheese:100}),0);
  const s=createGameState(32,{controllers:['human','human']});s.phase='playing';const p=s.players[0],pickup=s.pickups[0];
  Object.assign(p,{x:pickup.x,y:0,z:pickup.z});stepGame(s);assert.equal(p.poison,false);
  Object.assign(p,{x:pickup.x,y:pickup.y,z:pickup.z,vy:0,grounded:true});stepGame(s);assert.equal(p.poison,true);
  const base=s.bases[0],rat=s.rats[0];Object.assign(rat,{x:base.x,y:8,z:base.z,grounded:false});stepGame(s);assert.equal(rat.capturedBy,null);
  Object.assign(p,{x:base.x,y:8,z:base.z,vy:0,grounded:false,cheese:20});advance(s,.2);assert.equal(p.refillProgress,0);
});
test('throws inherit player height and elevated misses never poison ground bases',()=>{
  const s=createGameState(53,{controllers:['human','human']});s.phase='playing';const p=s.players[0];
  Object.assign(p,{x:0,y:6,z:0,poison:true,grounded:true});stepGame(s,{0:{throw:true}});
  assert.ok(s.projectiles[0].y>7);assert.equal(p.poison,false);assert.equal(p.cheese,100);
  advance(s,4);assert.ok(s.bases.every(b=>b.poisonedUntil===0));
});
test('independent map games and airborne snapshots resume deterministically',()=>{
  const a=createGameState(7,{mapId:MAPS[0].id}),b=createGameState(7,{mapId:MAPS[2].id});a.phase=b.phase='playing';
  stepGame(a,{0:{jump:true}});const restored=JSON.parse(JSON.stringify(a));
  for(let i=0;i<180;i++){stepGame(b);stepGame(a,{0:{moveX:1}});stepGame(restored,{0:{moveX:1}});}
  assert.deepEqual(a,restored);assert.notEqual(a.mapId,b.mapId);assert.equal(a.version,3);
  assert.throws(()=>createGameState(1,{mapId:'unknown-map'}),RangeError);
});
