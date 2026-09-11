import {empty,finish,box,slab,stairs} from './kit.js';
// A separate authoring/QA course, available at /?practice=1.
export function practice(){
 const m=empty({id:'movement-lab',name:'Movement Lab',number:'QA',width:84,depth:64,theme:'industrial',levels:3,highest:10,color:'#7b9387',tag:'SPRINT • JUMP • CLIMB',description:'A small course for a better scurry.',detail:'Sprint lanes, jump gaps, a low ceiling, stairs, and a ladder landing.',bases:[{x:-28,y:0,z:20},{x:28,y:0,z:-20}],spawn:{x:0,y:0,z:0}});
 stairs(m,-20,0,0,2,5,20,5);m.platforms.push(slab(-10,0,14,22,10),slab(7,0,8,12,10),slab(17,0,8,12,10),slab(0,19,12,8,2.4));
 m.ladders.push({x:-10,z:12,bottom:0,top:10,exitX:-10,exitZ:9,nx:0,nz:1});
 m.obstacles.push(box(0,-18,12,1,3,'factory'),box(12,17,1,14,4,'factory'));m.pickups=[{x:-10,y:10,z:0},{x:0,y:0,z:0},{x:17,y:10,z:0}];m.tour=[{x:-28,y:1.8,z:20,tx:-20,ty:7,tz:0}];return finish(m);
}
