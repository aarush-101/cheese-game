import {clamp,moveBody,updateVertical,nearbyLadder,flatDistance} from './map.js';
export const MOVEMENT=Object.freeze({walk:6.8,sprint:11.5,rat:6.2,acceleration:65,braking:85,airAcceleration:22,jump:8.5,gravity:22,coyote:.08,buffer:.1,climb:4.8});
export function movePlayer(p,input,dt,map,speed=MOVEMENT.walk){
 p.vx??=0;p.vz??=0;p.vy??=0;p.y??=0;p.travel??=0;
 const ox=p.x,oz=p.z,wasGrounded=p.grounded,oldVy=p.vy;
 p.ladderCooldown=Math.max(0,(p.ladderCooldown??0)-dt);
 p.coyote=p.grounded?MOVEMENT.coyote:Math.max(0,(p.coyote??0)-dt);
 p.jumpBuffer=input.jump?MOVEMENT.buffer:Math.max(0,(p.jumpBuffer??0)-dt);
 let ladder=map.ladders.find(l=>l.id===p.ladderId);
 // A ground jump always takes priority over automatic ladder entry.
 if(!ladder&&!input.jump&&!p.pendingThrow&&!p.ladderCooldown&&input.climb){
  const near=nearbyLadder(p,map);
  if(near&&((p.y>=near.top-.2&&input.climb<0)||(-Math.sin(p.yaw)*near.nx-Math.cos(p.yaw)*near.nz)<-.35)){
   ladder=near;p.ladderId=near.id;p.traversal='climb';
  }
 }
 if(ladder&&input.jump){
  p.ladderId=null;p.traversal='air';p.ladderCooldown=.5;p.vy=MOVEMENT.jump;p.grounded=false;p.coyote=0;p.jumpBuffer=0;
  // Push with velocity, never relocate the player backwards at takeoff.
  p.vx=ladder.nx*4;p.vz=ladder.nz*4;ladder=null;p.jumped=true;
 }else if(ladder){
  p.vx=p.vz=p.vy=0;p.grounded=false;
  const exiting=p.y>=ladder.top-.01&&input.climb>0;
  const tx=exiting?ladder.exitX:ladder.x,tz=exiting?ladder.exitZ:ladder.z,d=Math.hypot(tx-p.x,tz-p.z),step=Math.min(d,5*dt);
  if(d>.001){p.x+=(tx-p.x)/d*step;p.z+=(tz-p.z)/d*step;}
  p.y=clamp(p.y+clamp(input.climb??0,-1,1)*MOVEMENT.climb*dt,ladder.bottom,ladder.top);
  if(exiting&&flatDistance(p,{x:tx,z:tz})<.03){p.ladderId=null;p.grounded=true;p.ladderCooldown=.45;}
  if(p.y<=ladder.bottom&&input.climb<0){p.ladderId=null;p.grounded=true;p.ladderCooldown=.45;}
  p.traversal=exiting?'mantle':'climb';p.speed=Math.hypot(p.x-ox,p.z-oz)/dt;p.moving=Boolean(input.climb);return;
 }
 if(p.jumpBuffer>0&&p.coyote>0){p.vy=MOVEMENT.jump;p.grounded=false;p.coyote=0;p.jumpBuffer=0;p.jumped=true;}
 let x=Number.isFinite(input.moveX)?input.moveX:0,z=Number.isFinite(input.moveZ)?input.moveZ:0;
 const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
 const accel=p.grounded?(len?MOVEMENT.acceleration:MOVEMENT.braking):MOVEMENT.airAcceleration;
 const tx=x*speed,tz=z*speed,dv=Math.hypot(tx-p.vx,tz-p.vz),amount=Math.min(dv,accel*dt);
 if(dv>.00001){p.vx+=(tx-p.vx)/dv*amount;p.vz+=(tz-p.vz)/dv*amount;}
 moveBody(p,p.vx*dt,p.vz*dt,.45,map);updateVertical(p,dt,map);
 const dx=p.x-ox,dz=p.z-oz;p.speed=Math.hypot(dx,dz)/dt;p.travel+=Math.hypot(dx,dz);p.moving=p.speed>.12;
 if(Math.abs(dx)<Math.abs(p.vx*dt)*.2)p.vx=dx/dt;if(Math.abs(dz)<Math.abs(p.vz*dt)*.2)p.vz=dz/dt;
 p.traversal=p.grounded?(p.moving?'move':'idle'):'air';
 if(!wasGrounded&&p.grounded){p.landed=Math.max(0,-oldVy);}
}
