import {empty,finish,box,slab,wall,stairs,house} from './kit.js';
export function foundry(){
 const m=empty({id:'gouda-aqueduct',name:'Cheese Foundry',number:'02',width:280,depth:220,theme:'industrial',levels:6,highest:25,color:'#567e8c',tag:'PRODUCTION FLOORS • SILOS • GANTRIES',description:'Six floors. One enormous bad idea.',detail:'An industrial processing hall with stacked galleries, switchback stairs and overhead maintenance routes.',bases:[{x:-30,y:0,z:30},{x:30,y:0,z:-30}],spawn:{x:0,y:0,z:0}});
 for(const y of [0,5,10,15,20,25]){
  wall(m,-70,0,120,'z',y,5,'factory',[-48,0,48]);wall(m,70,0,120,'z',y,5,'factory',[-48,0,48]);wall(m,0,-60,140,'x',y,5,'factory',[-40,0,40]);wall(m,0,60,140,'x',y,5,'factory',[-40,0,40]);
  if(y===0)continue;
  for(const x of [-48,48])m.platforms.push(slab(x,0,12,96,y,'metal'));for(const z of [-46,46])m.platforms.push(slab(0,z,108,12,y,'metal'));
  if(y===10||y===20)m.platforms.push(slab(0,0,96,5,y,'metal'));
  for(const x of [-41.8,41.8])m.obstacles.push(box(x,0,.22,70,1,'railing',y));m.rooms.push({x:0,z:0,w:110,d:104,y,name:`PROCESSING / LEVEL ${y/5+1}`});
 }
 for(const x of [-61,61]){
  stairs(m,x,0,0,5,5,20,5);for(const y of [0,5,10,15,20,25])for(const z of [-11.5,11.5])m.platforms.push(slab(x>0?55:-55,z,16,3,y,'metal'));
  m.ladders.push({x:x>0?40.8:-40.8,z:25,bottom:0,top:10,exitX:x>0?44:-44,exitZ:25,nx:x>0?-1:1,nz:0},{x:x>0?40.8:-40.8,z:-25,bottom:10,top:25,exitX:x>0?44:-44,exitZ:-25,nx:x>0?-1:1,nz:0});
 }
 for(const x of [-25,25])for(const z of [-17,17])m.obstacles.push(box(x,z,11,11,18,'silo'));
 for(const x of [-69,69])for(const z of [-52,-26,0,26,52])m.obstacles.push(box(x,z,1.4,1.4,31,'steel'));
 for(const x of [-51,51])m.platforms.push(slab(x,0,40,120,30,'roof'));m.decor.push({kind:'factory-roof',x:0,z:0,y:30,w:140,d:120});
 for(const x of [-25,25])m.decor.push({kind:'pipe',x,z:0,y:22,length:100});
 for(const z of [-78,78])for(const x of [-46,46])m.obstacles.push(box(x,z,16,6,4,'container'));
 for(const x of [-108,108])house(m,x,0,{stories:2,kind:'factory',name:'DISPATCH',roof:false});for(const x of [-110,110])for(const z of [-75,75])m.obstacles.push(box(x,z,12,12,25,'silo'));
 for(const x of [-46,46])for(const z of [-45,45])m.decor.push({kind:'lamp',x,z,y:0});
 for(const l of m.ladders)m.platforms.push(slab(l.x,l.z,3,3,l.bottom,'metal'));
 m.pickups=[{x:-48,y:25,z:25},{x:0,y:0,z:0},{x:48,y:20,z:-25}];m.tour=[{x:0,y:2,z:28,tx:0,ty:12,tz:-24},{x:46,y:16.7,z:26,tx:-40,ty:13,tz:-30},{x:0,y:21.7,z:0,tx:52,ty:22,tz:0}];return finish(m);
}
