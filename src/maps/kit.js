// Shared authoring dimensions produce visuals, collision and navigation.
export const box=(x,z,w,d,h,kind='masonry',y=0)=>({x,z,w,d,h,kind,y});
export const slab=(x,z,w,d,top,kind='floor')=>box(x,z,w,d,.4,kind,top-.4);
export function empty(s){return {...s,size:Math.max(s.width,s.depth),half:Math.max(s.width,s.depth)/2,halfX:s.width/2,halfZ:s.depth/2,baseRadius:5,poisonRadius:4,obstacles:[],platforms:[],ramps:[],ladders:[],decor:[],rooms:[],holes:[],terrain:[],tour:[]};}
export function wall(m,x,z,length,axis,y,height=5,kind='masonry',doors=[0]){
 const count=Math.round(length/4),step=length/count;
 for(let i=0;i<count;i++){
  const offset=(i+.5)*step-length/2,door=doors.some(p=>Math.abs(offset-p)<step*.51),X=x+(axis==='x'?offset:0),Z=z+(axis==='z'?offset:0);
  const part=(o,w,h,Y)=>m.obstacles.push(box(X+(axis==='x'?o:0),Z+(axis==='z'?o:0),axis==='x'?w:.45,axis==='z'?w:.45,h,kind,Y));
  part(-(step+2.2)/4,(step-2.2)/2,height,y);part((step+2.2)/4,(step-2.2)/2,height,y);
  if(!door)part(0,2.2,1.05,y);part(0,2.2,height-(door?3.2:3.7),y+(door?3.2:3.7));
  m.decor.push({kind:'window-trim',x:X,z:Z,y:y+(door?0:1.05),axis,w:2.4,h:door?3.2:2.65,door});
 }
}
export function stairs(m,x,z,base,stories,rise=5,length=20,width=5){
 for(let i=0;i<stories;i++){
  const direction=i%2?-1:1,low=base+i*rise,high=low+rise,X=x+(i%2?width/2:-width/2);
  m.ramps.push({x:X,z,w:width,d:length,low,high,axis:'z',direction,kind:'stairs'});
  for(const sign of [-1,1])m.platforms.push(slab(x,z+sign*(length/2+1.5),width*2+1,3,sign===direction?high:low));
 }
}
export function house(m,x,z,{stories=4,base=0,rise=5,name='HOUSE',w=20,d=24,kind='plaster',roof=true}={}){
 for(let i=0;i<stories;i++){
  const y=base+i*rise;
  wall(m,x,z-d/2,w,'x',y,rise,kind);wall(m,x,z+d/2,w,'x',y,rise,kind);
  wall(m,x-w/2,z,d,'z',y,rise,kind,[-d/2+2,0,d/2-2]);wall(m,x+w/2,z,d,'z',y,rise,kind,[-d/2+2,0,d/2-2]);
  for(const side of [-1,1])wall(m,x+side*(w/2+9.5),z,d,'z',y,rise,kind,[-d/2+2,0,d/2-2]);
  m.rooms.push({x,z,w:w-1,d:d-1,y,name:`${name} / ${i+1}`});m.platforms.push(slab(x,z,w,d,y+rise));
  for(const side of [-1,1])for(const end of [-1,1])m.platforms.push(slab(x+side*(w/2+5),z+end*(d/2-1),11,4,y));
 }
 for(const side of [-1,1]){
  stairs(m,x+side*(w/2+5),z,base,stories,rise,d-6,4);
  for(const end of [-1,1])m.platforms.push(slab(x+side*(w/2+5),z+end*(d/2-1),11,4,base+stories*rise));
  m.ladders.push({x,z:z+side*(d/2+.8),bottom:base,top:base+stories*rise,exitX:x,exitZ:z+side*(d/2-1),nx:0,nz:side});
 }
 if(roof)m.obstacles.push(box(x,z,w*.6,d*.55,3.6,'roof-collision',base+stories*rise));
 for(const side of [-1,1])for(const end of [-1,1])m.obstacles.push(box(x+side*(w/2+9.5),z+end*(d/2+1),.35,.35,stories*rise,'column',base));
 m.decor.push({kind:'house',x,z,w,d,y:base,h:stories*rise,roof,name});
}
function subtract(r,h){
 const l=Math.max(r.x-r.w/2,h.x-h.w/2),rr=Math.min(r.x+r.w/2,h.x+h.w/2),b=Math.max(r.z-r.d/2,h.z-h.d/2),f=Math.min(r.z+r.d/2,h.z+h.d/2);
 if(l>=rr||b>=f)return [r];
 return [[r.x-r.w/2,l,r.z-r.d/2,r.z+r.d/2],[rr,r.x+r.w/2,r.z-r.d/2,r.z+r.d/2],[l,rr,r.z-r.d/2,b],[l,rr,f,r.z+r.d/2]].filter(([a,b,c,d])=>b-a>.01&&d-c>.01).map(([a,b,c,d])=>({x:(a+b)/2,z:(c+d)/2,w:b-a,d:d-c,y:r.y}));
}
export function finish(m){
 m.terrain=[{x:0,z:0,w:m.width,d:m.depth,y:0}];for(const h of m.holes){m.terrain=m.terrain.flatMap(r=>subtract(r,h));m.terrain.push({...h});}
 m.minY=Math.min(0,...m.terrain.map(t=>t.y));
 m.obstacles.forEach((o,i)=>o.id=i);m.platforms.forEach((o,i)=>o.id=`deck-${i}`);m.ramps.forEach((o,i)=>o.id=`ramp-${i}`);m.ladders.forEach((o,i)=>o.id=`ladder-${i}`);
 m.bases=m.bases.map((b,id)=>({...b,id,color:id?'#ef785c':'#edb82f',name:id?'RIVAL':'HOME'}));return Object.freeze(m);
}
