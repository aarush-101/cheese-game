import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameState,stepGame,FIXED_DT} from '../src/simulation.js';
import {snapshot,transform,PresentationClock} from '../src/presentation.js';
import {movePlayer,MOVEMENT} from '../src/movement.js';
import {MAPS} from '../src/map.js';
const empty={id:'test-yard',width:100,depth:100,half:50,halfX:50,halfZ:50,minY:0,terrain:[{x:0,z:0,w:100,d:100,y:0}],obstacles:[],platforms:[],ramps:[],ladders:[]};
const actor=()=>({x:0,y:0,z:0,vx:0,vz:0,vy:0,grounded:true,yaw:0,ladderId:null});
test('diagonal movement keeps its angle through jump at every camera heading',()=>{
 for(let yaw=-Math.PI;yaw<Math.PI;yaw+=Math.PI/12){
  const s=createGameState(1,{controllers:['human','human']});s.phase='playing';const p=s.players[0];Object.assign(p,{x:0,z:0});
  const x=-Math.sin(yaw)+Math.cos(yaw),z=-Math.cos(yaw)-Math.sin(yaw),norm=Math.hypot(x,z);
  for(let i=0;i<24;i++){const before={...p};stepGame(s,{0:{moveX:x,moveZ:z,yaw,sprint:true,jump:i===12}});assert.ok((p.x-before.x)*x+(p.z-before.z)*z>=-1e-8,'Takeoff moved backwards');}
  const d=Math.hypot(p.x,p.z);assert.ok(Math.abs(p.x/d-x/norm)<1e-6);assert.ok(Math.abs(p.z/d-z/norm)<1e-6);
 }
});
test('fixed movement and jump presentation agree at 30, 60, 120 and 144 FPS',()=>{
 const finals=[];
 for(const fps of [30,60,120,144]){
  const s=createGameState(3,{controllers:['human','human']});s.phase='playing';Object.assign(s.players[0],{x:0,z:0});let accumulator=0,previous=snapshot(s),last={...s.players[0]},air=false;
  for(let frame=0;frame<fps;frame++){
   accumulator+=1/fps;
   while(accumulator+1e-10>=FIXED_DT){previous=snapshot(s);stepGame(s,{0:{moveX:.8,moveZ:.6,sprint:true,jump:s.tick===20}});accumulator-=FIXED_DT;}
   const pose=transform(previous.players[0],s.players[0],Math.max(0,accumulator/FIXED_DT));
   assert.ok((pose.x-last.x)*.8+(pose.z-last.z)*.6>=-1e-7,'Camera rewound on jump');last=pose;air ||=pose.y>.5;
  }
  assert.ok(air);finals.push([s.players[0].x,s.players[0].y,s.players[0].z]);
 }
 for(const f of finals)for(let i=0;i<3;i++)assert.ok(Math.abs(f[i]-finals[0][i])<1e-7);
});
test('sprint is faster without a diagonal speed bonus and preserves takeoff momentum',()=>{
 const results=[];for(const [x,z,speed] of [[1,0,MOVEMENT.walk],[1,0,MOVEMENT.sprint],[1,1,MOVEMENT.sprint]]){
  const p=actor();for(let i=0;i<120;i++)movePlayer(p,{moveX:x,moveZ:z,jump:i===60},FIXED_DT,empty,speed);results.push(Math.hypot(p.x,p.z));
 }
 assert.ok(results[1]>results[0]*1.5);assert.ok(Math.abs(results[1]-results[2])<1e-6);
});
test('ground jump near a ladder does not auto-grab or relocate',()=>{
 const map=MAPS[0],l=map.ladders[0],p={...actor(),x:l.x,y:l.bottom,z:l.z,yaw:Math.atan2(l.nx,l.nz)};
 movePlayer(p,{jump:true,climb:1,moveX:.5,moveZ:.5},FIXED_DT,map);
 assert.equal(p.ladderId,null);assert.ok(p.vy>0);assert.ok(Math.hypot(p.x-l.x,p.z-l.z)<.02);
});
test('pause holds all presentation timing; rematch clears interpolation history',()=>{
 const clock=new PresentationClock(),state={time:5};clock.update(state,.5,100,false,false);const a=clock.update(state,1,101,false,true),b=clock.update(state,1,200,false,true);assert.equal(a.time,b.time);assert.equal(b.dt,0);
 state.time=0;const reset=clock.update(state,0,201,false,false);assert.ok(reset.reset);assert.equal(reset.time,0);assert.equal(reset.dt,0);
});
test('throw windup reserves one bottle and releases exactly once across JSON restore',()=>{
 const s=createGameState(55,{controllers:['human','human']});s.phase='playing';const p=s.players[0];Object.assign(p,{x:0,z:8,poison:true});
 stepGame(s,{0:{throw:true}});assert.ok(p.poison&&p.pendingThrow);assert.equal(s.projectiles.length,0);const copy=JSON.parse(JSON.stringify(s));
 for(let i=0;i<30;i++){stepGame(s,{0:{throw:true}});stepGame(copy,{0:{throw:true}});}assert.deepEqual(s,copy);assert.equal(s.events.filter(e=>e.type==='throw').length,1);assert.equal(p.poison,false);assert.equal(p.pendingThrow,null);
});
