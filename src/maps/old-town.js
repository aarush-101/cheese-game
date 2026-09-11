import {empty,finish,box,slab,wall,house} from './kit.js';
export function oldTown(){
 const m=empty({id:'crumb-quarter',name:'Old Town',number:'01',width:240,depth:200,theme:'market',levels:6,highest:20,color:'#c98558',tag:'CELLARS • APARTMENTS • ROOFTOPS',description:'A whole town. A thousand ways home.',detail:'Four-story apartments, covered market streets, cellar passages and rooftop crossings.',bases:[{x:-32,y:0,z:24},{x:32,y:0,z:-24}],spawn:{x:0,y:0,z:0}});
 for(const z of [-46,46])for(const x of [-82,-40,40,82])house(m,x,z,{stories:Math.abs(x)===40?4:3,name:x<0?'BAKERS ROW':'TANNERS ROW'});
 for(const z of [-82,82])for(const x of [-76,-28,28,76])house(m,x,z,{stories:2,name:'MERCHANT HOUSE'});
 for(const z of [-60,60]){
  m.platforms.push(slab(0,z,100,6,10));for(const x of [-22,22])m.obstacles.push(box(x,z,1.2,1.2,9.6,'column'));
  for(const side of [-1,1])m.obstacles.push(box(0,z+side*3,70,.25,1,'railing',10));
 }
 for(const x of [-18,18])for(const z of [-12,12]){m.obstacles.push(box(x,z,5,3,2.3,'stall'));}
 for(const z of [-18,18])for(const x of [-70,-56,56,70])m.obstacles.push(box(x,z,3,3,2,'crate'));
 m.holes.push({x:0,z:66,w:20,d:40,y:-4});m.platforms.push(slab(0,66,20,12,0));
 for(const direction of [-1,1])m.ramps.push({x:0,z:66+direction*13,w:8,d:14,low:-4,high:0,axis:'z',direction,kind:'stairs'});
 for(const x of [-9.8,9.8])wall(m,x,66,40,'z',-4,4,'masonry',[]);
 m.rooms.push({x:0,z:66,w:19,d:12,y:-4,name:'THE UNDERCELLAR'});m.decor.push({kind:'sign',x:0,z:60,y:2,text:'THE UNDERCELLAR',color:'#bf835c'});
 for(const z of [-20,20])for(const x of [-96,-64,64,96])m.decor.push({kind:'lamp',x,z,y:0});
 m.pickups=[{x:-40,y:20,z:-36},{x:0,y:0,z:0},{x:40,y:20,z:36}];
 m.tour=[{x:-31,y:2.3,z:22,tx:-40,ty:9,tz:-44},{x:-16,y:11.6,z:-60,tx:30,ty:11,tz:-60},{x:0,y:-2.3,z:66,tx:0,ty:0,tz:83}];return finish(m);
}
