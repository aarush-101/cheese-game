import {empty,finish,box,slab,house,wall} from './kit.js';
export function citadel(){
 const m=empty({id:'timber-hollow',name:'Canopy Citadel',number:'03',width:260,depth:260,theme:'forest',levels:6,highest:28,color:'#65794c',tag:'RAVINE • CLIFF GALLERIES • UPPER KEEP',description:'Down in the ravine. Up to no good.',detail:'A wooded fortress with a deep culvert, terraced outposts, offset bridges and a four-story northern keep.',bases:[{x:-32,y:0,z:24},{x:32,y:0,z:-24}],spawn:{x:0,y:0,z:0}});
 m.holes.push({x:0,z:0,w:36,d:260,y:-8});
 for(const z of [-44,0,44]){m.platforms.push(slab(0,z,44,z===0?16:8,0,'wood'));for(const x of [-16,16])m.obstacles.push(box(x,z,1.4,1.4,7.6,'column',-8));for(const side of [-1,1])m.decor.push({kind:'bridge-arch',x:0,z:z+side*(z===0?8:4),y:-6,w:34,h:6});}
 for(const side of [-1,1]){m.ramps.push({x:side*10,z:side*24,w:7,d:32,low:-8,high:0,axis:'z',direction:side,kind:'stairs'});m.ladders.push({x:side*9,z:side*4,bottom:-8,top:0,exitX:side*9,exitZ:0,nx:0,nz:side});}
 house(m,-68,-64,{stories:4,rise:7,w:24,d:34,kind:'fortress',name:'THE HIGH KEEP',roof:false});house(m,70,62,{stories:2,rise:7,w:24,d:34,kind:'fortress',name:'EAST WATCH',roof:false});
 for(const [x,z,w,d,y] of [[-48,-5,24,22,7],[-48,24,24,34,14],[-68,44,24,18,21]]){m.obstacles.push(box(x,z,w,d,y-.4,'cliff'));m.platforms.push(slab(x,z,w+1,d+1,y,'wood'));}
 m.ramps.push({x:-48,z:-29,w:8,d:26,low:0,high:7,axis:'z',direction:1,kind:'stairs'},
  {x:-31,z:20,w:7,d:26,low:7,high:14,axis:'z',direction:1,kind:'stairs'},
  {x:-70,z:24,w:7,d:22,low:14,high:21,axis:'z',direction:1,kind:'stairs'},
  {x:-94,z:29,w:7,d:30,low:14,high:21,axis:'z',direction:1,kind:'stairs'});
 m.platforms.push(slab(-38,4,22,6,7,'wood'),slab(-38,36,22,6,14,'wood'),slab(-65,10,14,6,14,'wood'),slab(-94,-25,7,78,14,'wood'),slab(-82,47,30,6,21,'wood'),slab(-84,-64,20,7,14,'wood'));
 m.ladders.push({x:-61,z:24,bottom:0,top:14,exitX:-58,exitZ:24,nx:-1,nz:0});
 for(let i=0;i<68;i++){const side=i%2?1:-1,x=side*(42+(i*31%77)),z=(i*47%242)-121;if((x<0&&z< -35)||(x>42&&z>38)||Math.abs(z)<35&&Math.abs(x)<90)continue;m.obstacles.push({...box(x,z,1.1,1.1,3,'tree'),visualWidth:7+i%4,visualHeight:13+i%7});}
 for(const [x,z,w,d] of [[48,-70,14,22],[83,-40,18,10],[42,12,10,5],[-104,64,18,7]])m.obstacles.push(box(x,z,w,d,5,'rock'));
 m.decor.push({kind:'water',x:0,z:0,w:7,d:260,y:-7.97},{kind:'sign',x:-68,z:-43,y:3,text:'THE HIGH KEEP',color:'#87966b'});
 // A covered crypt and broken chapel make the lower and outer routes useful.
 m.platforms.push(slab(0,-90,44,28,0,'floor'));
 for(const z of [-97,-83])for(const x of [-10,10])m.obstacles.push(box(x,z,3,3,5,'column',-8));
 for(const [x,z,w,d,stories] of [[-68,-64,24,34,4],[70,62,24,34,2]])for(const sx of [-1,1])for(const sz of [-1,1])m.obstacles.push(box(x+sx*(w/2+2.5),z+sz*(d/2+2.5),4,4,stories*7+2.5,'turret'));
 wall(m,67,-72,34,'x',0,8,'fortress',[-8,8]);wall(m,52,-59,26,'z',0,6,'fortress',[0]);wall(m,82,-59,26,'z',0,6,'fortress',[0]);
 for(const x of [57,67,77])m.obstacles.push(box(x,-65,1.2,1.2,8,'column'));
 m.decor.push({kind:'sign',x:67,z:-73,y:4,text:'THE BROKEN CHAPEL',color:'#6e7d59'});
 for(let i=0;i<46;i++){const x=(i%2?1:-1)*(96+(i*13%23)),z=(i*37%244)-122;m.obstacles.push({...box(x,z,1,1,3,'tree'),visualWidth:7+i%5,visualHeight:12+i%8});}
 for(let i=0;i<14;i++){const x=(i%2?1:-1)*(42+i*17%59),z=i<7?-112:108;if(Math.abs(x)>80&&Math.abs(z)<80)continue;m.obstacles.push(box(x,z,5+i%3,4+i%5,3+i%4,'rock'));}
 m.pickups=[{x:-68,y:28,z:-64},{x:0,y:0,z:0},{x:70,y:14,z:62}];m.tour=[{x:0,y:-6.2,z:22,tx:0,ty:2,tz:0},{x:-49,y:15.8,z:28,tx:-68,ty:23,tz:-62},{x:70,y:15.7,z:62,tx:-68,ty:18,tz:-64}];return finish(m);
}
