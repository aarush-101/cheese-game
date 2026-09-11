import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {ACTIONS,launchTransform} from './actions.js';
import {damp} from './presentation.js';
import {isFree} from './map.js';
export class Viewmodel{
 constructor(view){
  this.view=view;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(70,1,.025,8);this.scene.add(new THREE.HemisphereLight('#fff2d8','#45534d',1.7));
  const key=new THREE.DirectionalLight('#ffe4be',1.6);key.position.set(-2,4,3);this.scene.add(key);this.scene.environment=view.scene.environment;
  const asset=view.assets.models.get('arms');this.rig=clone(asset.scene);this.scene.add(this.rig);this.mixer=new THREE.AnimationMixer(this.rig);this.actions=new Map();
  for(const clip of asset.animations){const a=this.mixer.clipAction(clip);a.play();a.paused=true;a.setEffectiveWeight(0);this.actions.set(clip.name,a);}
  this.arms=['Left','Right'].map(side=>this.rig.getObjectByName(side+'Arm'));
  this.anchors=['Left','Right'].map(side=>this.rig.getObjectByName(side+'Item'));
  this.poison=view.poisonModel();this.poison.scale.setScalar(.34);this.poison.position.set(0,.015,-.1);this.anchors[0].add(this.poison);
  this.cheese=view.cheeseWedge();this.cheese.scale.setScalar(.43);this.cheese.position.set(0,.075,-.06);this.cheese.rotation.set(.06,.85,-.12);this.anchors[1].add(this.cheese);
  this.cheese.traverse(n=>{if(!n.isMesh)return;const original=n.geometry.attributes.position,target=original.clone();for(let i=0;i<target.count;i++){const z=original.getZ(i),factor=THREE.MathUtils.clamp((-z+.29)/.57,0,1);target.setXYZ(i,original.getX(i)*(1-factor*.8),original.getY(i)*(1-factor*.95),.22+(z-.22)*.02);}n.geometry.morphAttributes.position=[target];n.updateMorphTargets();});
  const geo=new THREE.IcosahedronGeometry(.014,0),mat=new THREE.MeshStandardMaterial({color:'#f3c849'});this.crumbs=new THREE.InstancedMesh(geo,mat,24);this.scene.add(this.crumbs);this.crumbData=[];this.dummy=new THREE.Object3D();
  this.rig.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=false;n.frustumCulled=false;}});this.reset();
 }
 reset(){this.amount=100;this.lastAmount=100;this.move=0;this.run=0;this.climb=0;this.swayX=0;this.swayY=0;this.land=0;this.proximity=0;this.crumbData=[];this.lastEvent=0;this.lastYaw=null;this.action={left:null,right:null};this.emptyWeights=[0,0];}
 pose(side,name,time,weight){const a=this.actions.get(side+name);if(a){a.time=THREE.MathUtils.clamp(time,0,a.getClip().duration);a.setEffectiveWeight(weight);}}
 update(state,{time,dt,pose,look,reset,map,bob=true}){
  if(reset)this.reset();const p=state.players[0];
  for(const a of this.actions.values())a.setEffectiveWeight(0);
  for(const e of state.events){if(e.id<=this.lastEvent||e.time>time+1e-6)continue;this.lastEvent=e.id;if(e.playerId!==0)continue;
   if(e.type==='throw-start')this.action.left={name:'Throw',time:e.time,duration:ACTIONS.throw.duration};
   if(e.type==='pickup')this.action.left={name:'Pickup',time:e.time,duration:ACTIONS.pickup};
   if(e.type==='refill')this.action.right={name:'Refill',time:e.time,duration:ACTIONS.refill};
   if(e.type==='land')this.land=Math.min(.1,e.impact*.008);
  }
  this.move=damp(this.move,Math.min(1,(p.speed??0)/6.8)*(p.grounded?1:0),12,dt);this.run=damp(this.run,p.sprinting?1:0,10,dt);this.climb=damp(this.climb,p.ladderId?1:0,14,dt);this.land=damp(this.land,0,15,dt);
  const dy=this.lastYaw===null?0:Math.atan2(Math.sin(look.yaw-this.lastYaw),Math.cos(look.yaw-this.lastYaw)),dp=this.lastPitch===undefined?0:look.pitch-this.lastPitch;
  this.lastYaw=look.yaw;this.lastPitch=look.pitch;this.swayX=damp(this.swayX,THREE.MathUtils.clamp(dy*3,-.07,.07),14,dt);this.swayY=damp(this.swayY,THREE.MathUtils.clamp(dp*3,-.05,.05),14,dt);
  const near=!isFree(p.x-Math.sin(look.yaw)*.85,p.z-Math.cos(look.yaw)*.85,.25,map,p.y+.35,1);
  this.proximity=damp(this.proximity,near?1:0,9,dt);
  const throwAction=this.action.left?.name==='Throw'?this.action.left:null,age=throwAction?time-throwAction.time:Infinity;
  const held=p.poison||age>=0&&age<ACTIONS.throw.release;
  this.poison.visible=held&&this.climb<.55;
  // Ease the modeled wedge toward its actual amount, keeping the grip fixed.
  this.amount=damp(this.amount,p.cheese,18,dt);
  this.cheese.visible=this.climb<.55&&(p.cheese>0||this.amount>.2);
  this.cheese.traverse(n=>{if(n.morphTargetInfluences)n.morphTargetInfluences[0]=1-this.amount/100;});
  if(p.cheese<this.lastAmount-.08){const origin=this.cheese.getWorldPosition(new THREE.Vector3());for(let i=0;i<2;i++)this.crumbData.push({born:time,origin:origin.clone(),vx:Math.sin(time*19+i)*.18,vz:-.15-i*.03});if(this.crumbData.length>24)this.crumbData.splice(0,this.crumbData.length-24);}
  this.lastAmount=p.cheese;
  for(let i=0;i<2;i++){
   const side=i?'Right':'Left',sign=i?1:-1,arm=this.arms[i],action=this.action[i?'right':'left'],a=action?time-action.time:Infinity;
   const actionWeight=action&&a>=0&&a<action.duration?Math.min(1,a/.055,(action.duration-a)/.12):0,base=1-actionWeight;
   const carrying=i?p.cheese>0:held;this.emptyWeights[i]=damp(this.emptyWeights[i],carrying?0:1,10,dt);const walk=(1-this.climb)*this.move*(1-this.run),run=(1-this.climb)*this.move*this.run;
   this.pose(side,carrying?'Hold':'Empty',time%2.4,base*(1-walk-run-this.climb));this.pose(side,'Walk',(pose.travel/2.8+(i?.3:0))%.6,base*walk);this.pose(side,'Run',(pose.travel/4+(i?.22:0))%.44,base*run);this.pose(side,'Climb',(time+(i?.4:0))%.8,base*this.climb);
   if(actionWeight)this.pose(side,action.name,a,actionWeight);
   const wave=bob?Math.sin(pose.travel*3.7+sign)*.012*this.move:0;
   arm.position.set(sign*(.32+this.run*.025)+this.swayX,-.31+wave-this.run*.065-this.land-this.proximity*.13,-.63+this.swayY+this.proximity*.07);
   arm.position.y-=this.emptyWeights[i]*.12*(1-this.climb);
   arm.rotation.set(this.run*.12+this.proximity*.25,sign*-.04,sign*(.04+this.run*.15));
   arm.position.y-=THREE.MathUtils.smoothstep(this.climb,0,.55)*(1-THREE.MathUtils.smoothstep(this.climb,.55,1))*.65;
   if(this.climb>.01){arm.position.y+=Math.sin(time*7+sign*Math.PI/2)*.16*this.climb;arm.position.z-=.13*this.climb;}
   if(actionWeight&&action.name==='Pickup'){arm.position.y-=Math.sin(Math.PI*a/action.duration)*.1;arm.position.z-=Math.sin(Math.PI*a/action.duration)*.13;}
   if(actionWeight&&action.name==='Refill'){arm.position.z-=Math.sin(Math.PI*a/action.duration)*.2;}
   if(actionWeight&&action.name==='Throw'){const wind=Math.sin(Math.min(1,a/.18)*Math.PI);arm.position.z+=wind*.12;arm.position.y+=wind*.06;}
  }
  this.mixer.update(0);this.scene.updateMatrixWorld(true);
  // At the release, put the held flask at the exact screen projection of the
  // shared world launch offset. This is presentation-only; no bone drives rules.
  if(age>=.1&&age<ACTIONS.throw.release){
   const launch=launchTransform({...p,...pose,yaw:look.yaw}),point=new THREE.Vector3(launch.x,launch.y,launch.z).applyMatrix4(this.view.camera.matrixWorldInverse);
   const ratio=Math.tan(THREE.MathUtils.degToRad(35))/Math.tan(THREE.MathUtils.degToRad(this.view.camera.fov/2));point.x*=ratio;point.y*=ratio;
   const actual=this.poison.getWorldPosition(new THREE.Vector3()),blend=THREE.MathUtils.smoothstep(age,.1,ACTIONS.throw.release);this.arms[0].position.add(point.sub(actual).multiplyScalar(blend));
  }
  if(this.poison.userData.liquid){this.poison.userData.liquid.rotation.z=this.swayX*.8;this.poison.userData.liquid.rotation.x=this.swayY*.6;}
  for(let i=0;i<24;i++){const c=this.crumbData[i],a=c?time-c.born:2;if(c&&a<.65){this.dummy.position.copy(c.origin).add(new THREE.Vector3(c.vx*a,-.6*a*a,c.vz*a));this.dummy.scale.setScalar(1-a/.65);}else this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.crumbs.setMatrixAt(i,this.dummy.matrix);}this.crumbs.instanceMatrix.needsUpdate=true;
  this.view.canvas.dataset.cheeseAmount=this.amount.toFixed(1);this.view.canvas.dataset.poisonHand=this.poison.visible?'left':'empty';this.view.canvas.dataset.cheeseHand='right';
 }
 render(renderer,aspect){this.camera.aspect=aspect;this.camera.updateProjectionMatrix();renderer.autoClear=false;renderer.clearDepth();renderer.render(this.scene,this.camera);renderer.autoClear=true;}
}
