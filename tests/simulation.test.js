import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, startMatch, stepGame, FIXED_DT, RULES, attractorScore, poisonBase } from '../src/simulation.js';
import { OBSTACLES, distance, moveBody, findPath, clearPath } from '../src/map.js';

function game(seed=42){const s=createGameState(seed,{controllers:['human','human']});s.phase='playing';return s;}
function advance(state,seconds,commands={}){for(let i=0;i<Math.round(seconds/FIXED_DT);i++)stepGame(state,commands);}
function parkRats(s){s.rats.forEach((r,i)=>{r.x=-25+i*0.6;r.z=-25;r.nextWander=1e6;r.wander={x:r.x,z:r.z};r.nextEvaluate=1e6;r.target=null;});}

test('state is deterministic and a JSON snapshot resumes exactly',()=>{
  const a=createGameState(901),b=createGameState(901);startMatch(a);startMatch(b);
  const commands={0:{moveX:0.4,moveZ:-0.5,yaw:0.5}};
  advance(a,15,commands);advance(b,15,commands);assert.deepEqual(a,b);
  const restored=JSON.parse(JSON.stringify(a));advance(a,10,commands);advance(restored,10,commands);assert.deepEqual(a,restored);
  assert.equal(a.rats.length,10);assert.equal(a.players.length,2);
});
test('countdown does not consume match time, lobby and ended state do not advance',()=>{
  const s=createGameState();stepGame(s);assert.equal(s.tick,0);
  startMatch(s);advance(s,3);assert.equal(s.phase,'playing');assert.equal(s.remaining,180);
  advance(s,1);assert.ok(Math.abs(s.remaining-179)<1e-6);
  s.phase='ended';const before=JSON.stringify(s);stepGame(s);assert.equal(JSON.stringify(s),before);
});
test('attractor cutoff, scoring, and stronger nearby cheese',()=>{
  const rat={x:0,z:0};assert.equal(attractorScore(rat,{x:12.01,z:0,cheese:100}),0);
  assert.equal(attractorScore(rat,{x:10,z:0,cheese:100}),10);
  assert.equal(attractorScore(rat,{x:0.5,z:0,cheese:100}),200);
  assert.equal(attractorScore(rat,{x:0,z:0,cheese:0}),0);
  const s=game();parkRats(s);Object.assign(s.players[0],{x:0,z:1,cheese:60});Object.assign(s.players[1],{x:0,z:3,cheese:100});
  Object.assign(s.rats[0],{x:0,z:0,nextEvaluate:0});stepGame(s);assert.equal(s.rats[0].target,'player:0');
  s.players[0].cheese=0;advance(s,0.22);assert.equal(s.rats[0].target,'player:1');
});
test('base capture counts ten identities and nearby players can steal',()=>{
  const s=game();parkRats(s);s.players[0].x=0;s.players[0].z=0;
  const home=s.bases[0],rat=s.rats[0];Object.assign(rat,{x:home.x+1,z:home.z,nextEvaluate:0});
  stepGame(s);assert.equal(s.bases[0].count,1);assert.equal(rat.capturedBy,0);assert.equal(rat.target,'base:0');
  Object.assign(s.players[1],{x:rat.x-0.25,z:rat.z,cheese:65});advance(s,0.22);assert.equal(rat.target,'player:1');
  assert.equal(s.bases.reduce((n,b)=>n+b.count,0)+s.rats.filter(r=>r.capturedBy===null).length,10);
});
test('cheese drains per follower and requires a full second in home to refill',()=>{
  const s=game();parkRats(s);const p=s.players[0];Object.assign(p,{x:0,z:0,cheese:50});
  for(const rat of s.rats.slice(0,2)){rat.target='player:0';rat.nextEvaluate=100;rat.x=0;rat.z=1;}
  advance(s,0.5);assert.ok(Math.abs(p.cheese-48)<1e-6);
  s.rats.forEach(r=>r.target=null);Object.assign(p,{x:s.bases[0].x,z:s.bases[0].z});
  advance(s,0.9);assert.ok(p.cheese<100);advance(s,0.1);assert.equal(p.cheese,100);
  p.cheese=10;p.x=0;p.z=0;advance(s,1);assert.equal(p.cheese,10);
});
test('capsule slides against cover and cannot tunnel or leave the arena',()=>{
  const o=OBSTACLES[0],p={x:o.x-o.w/2-1,z:o.z};
  moveBody(p,10,0,0.45);assert.ok(p.x<=o.x-o.w/2-0.45+1e-6);
  const before=p.z;moveBody(p,1,1,0.45);assert.ok(p.z>before);
  moveBody(p,-100,100,0.45);assert.ok(p.x>=-29.55);assert.ok(p.z<=29.55);
});
test('navigation routes around walls without cutting through cover',()=>{
  const a={x:-7,z:12},b={x:-7,z:20},path=findPath(a,b);
  assert.ok(path.length>1);let previous=a;
  for(const waypoint of path){assert.ok(clearPath(previous,waypoint,0.6));previous=waypoint;}
  assert.ok(distance(path.at(-1),b)<0.01);
});
test('poison disables base attraction for 15 seconds and rats flee for 3',()=>{
  const s=game();parkRats(s);s.players[0].x=0;s.players[0].z=0;const b=s.bases[0],rat=s.rats[0];
  Object.assign(rat,{x:b.x,z:b.z,nextEvaluate:0});stepGame(s);poisonBase(s,0);
  assert.ok(Math.abs(b.poisonedUntil-s.time-15)<1e-6);assert.ok(Math.abs(rat.fleeUntil-s.time-3)<1e-6);
  advance(s,1);assert.equal(rat.target,null);assert.ok(distance(rat,b)>5);assert.equal(b.count,0);
  advance(s,2.1);assert.ok(rat.fleeUntil<=s.time);
  advance(s,12);assert.ok(b.poisonedUntil<=s.time);
  Object.assign(rat,{x:b.x+1,z:b.z,nextEvaluate:0});stepGame(s);assert.equal(rat.target,'base:0');
});
test('a pickup holds one poison and returns 20 seconds after collection',()=>{
  const s=game();parkRats(s);const p=s.players[0],pickup=s.pickups[1];Object.assign(p,{x:pickup.x,z:pickup.z});stepGame(s);
  assert.equal(p.poison,true);assert.ok(Math.abs(pickup.availableAt-s.time-20)<1e-6);
  p.x=5;p.z=5;p.poison=false;advance(s,19.9);assert.ok(pickup.availableAt>s.time);
  advance(s,0.2);assert.ok(pickup.availableAt<=s.time);p.x=0;p.z=0;stepGame(s);assert.equal(p.poison,true);
});
test('lobbed projectile hits a base, while a miss has no gameplay effect',()=>{
  const s=game();parkRats(s);const p=s.players[0],b=s.bases[1];Object.assign(p,{x:b.x,z:b.z+12,poison:true,yaw:0,pitch:0});
  stepGame(s,{0:{throw:true}});assert.equal(p.poison,false);assert.equal(s.projectiles.length,1);
  advance(s,3);assert.ok(b.poisonedUntil>s.time);assert.equal(s.projectiles.length,0);
  const miss=game();parkRats(miss);Object.assign(miss.players[0],{x:0,z:0,poison:true,yaw:0,pitch:0});
  stepGame(miss,{0:{throw:true}});advance(miss,3);assert.ok(miss.bases.every(base=>base.poisonedUntil===0));assert.ok(miss.events.some(e=>e.type==='miss'));
});
test('timer chooses majority; tied buzzer needs a new sudden-death capture',()=>{
  const s=game();parkRats(s);s.rats[0].x=s.bases[0].x;s.rats[0].z=s.bases[0].z;s.remaining=FIXED_DT;
  stepGame(s);assert.equal(s.phase,'ended');assert.equal(s.winner,0);
  const tie=game();parkRats(tie);
  for(let i=0;i<2;i++){tie.rats[i].x=tie.bases[i].x;tie.rats[i].z=tie.bases[i].z;}
  tie.remaining=FIXED_DT;stepGame(tie);assert.equal(tie.phase,'sudden-death');stepGame(tie);assert.equal(tie.phase,'sudden-death');
  tie.rats[2].x=tie.bases[1].x;tie.rats[2].z=tie.bases[1].z;stepGame(tie);assert.equal(tie.phase,'ended');assert.equal(tie.winner,1);
});
test('simultaneous opposing sudden-death entries keep the round alive',()=>{
  const s=game();parkRats(s);s.phase='sudden-death';for(let i=0;i<2;i++){s.rats[i].x=s.bases[i].x;s.rats[i].z=s.bases[i].z;}
  stepGame(s);assert.equal(s.phase,'sudden-death');assert.equal(s.winner,null);
});
test('bot navigates, gathers rats and deposits them during a complete match',()=>{
  const s=createGameState(8);s.phase='playing';advance(s,RULES.duration);
  assert.equal(s.phase,'ended');assert.equal(s.winner,1);assert.ok(s.bases[1].count>=2);
  assert.ok(s.events.some(e=>e.type==='capture'&&e.baseId===1));
  for(const p of s.players){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));assert.ok(p.cheese>=0&&p.cheese<=100);}
  assert.equal(s.rats.length,10);
});
test('human slots use commands independently and ignore invalid movement',()=>{
  const s=game(),before=s.players.map(p=>({x:p.x,z:p.z}));
  stepGame(s,{0:{moveX:NaN,moveZ:Infinity},1:{moveX:-1,moveZ:1}});
  assert.equal(s.players[0].x,before[0].x);assert.equal(s.players[0].z,before[0].z);
  assert.ok(s.players[1].x<before[1].x);assert.ok(s.players[1].z>before[1].z);
});
test('bot prioritizes refilling low cheese and interrupts to collect nearby poison',()=>{
  const s=createGameState(13);s.phase='playing';parkRats(s);const bot=s.players[1];bot.cheese=10;bot.bot.nextDecision=0;
  advance(s,0.5);assert.equal(bot.bot.mode,'REFILL');assert.equal(bot.cheese,10);
  advance(s,0.5);assert.equal(bot.cheese,100);
  Object.assign(bot,{x:2,z:0});bot.bot.nextDecision=0;
  advance(s,1);assert.equal(bot.poison,true);assert.ok(s.events.some(e=>e.type==='pickup'&&e.playerId===1));
});
test('bot carrying poison attacks an enemy base with at least three rats',()=>{
  const s=createGameState(31);s.phase='playing';parkRats(s);const home=s.bases[0],bot=s.players[1];
  Object.assign(s.players[0],{x:0,z:0});
  s.rats.slice(0,3).forEach((r,i)=>Object.assign(r,{x:home.x+i*0.2,z:home.z}));home.count=3;
  Object.assign(bot,{x:home.x,z:home.z-11,poison:true});bot.bot.nextDecision=0;
  stepGame(s);assert.equal(bot.bot.mode,'INTERRUPT');assert.equal(bot.poison,false);assert.equal(s.projectiles.length,1);
  advance(s,2);assert.ok(home.poisonedUntil>s.time);assert.ok(s.events.some(e=>e.type==='poison'&&e.baseId===0));
});
