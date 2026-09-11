import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// Original modular kit, compiled by spatial sector and material. The decorative
// layer never creates gameplay collisions: openings come from the map data.
export function buildArchitecture(view,m){
 const world=view.world,industrial=m.theme==='industrial',forest=m.theme==='forest',batches=new Map(),materials=new Map();
 const colors=industrial?{wall:'#829399',trim:'#384b54',floor:'#84979a',roof:'#385360',wood:'#7a6550',metal:'#40515a',accent:'#e8ab44',cliff:'#55656b'}:forest?{wall:'#a1a88a',trim:'#626b53',floor:'#aeb493',roof:'#525e47',wood:'#92734f',metal:'#677259',accent:'#d6b676',cliff:'#737e67'}:{wall:'#dfc7a5',trim:'#755240',floor:'#b8b19b',roof:'#ad634a',wood:'#896346',metal:'#6a8178',accent:'#527d73',cliff:'#8f957e'};
 const texture=(key)=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#dfdfd8';c.fillRect(0,0,256,256);
  if(key==='wood'||key==='roof'){for(let i=0;i<8;i++){c.fillStyle=i%2?'#dad2be':'#eee6d2';c.fillRect(0,i*32,256,30);c.strokeStyle='#938779';for(let j=0;j<3;j++){c.beginPath();c.moveTo(0,i*32+8+j*6);c.bezierCurveTo(60,i*32+2+j*6,180,i*32+12+j*6,256,i*32+7+j*6);c.stroke();}}}
  else if(key==='floor'||key==='cliff'||forest&&key==='wall'){
   c.fillStyle='#858982';c.fillRect(0,0,256,256);for(let row=-1;row<9;row++)for(let col=-1;col<5;col++){const x=col*64+(row%2)*32,y=row*32;c.fillStyle=['#d5d5c9','#c5c8bd','#e3e1d5'][Math.abs(row+col*7)%3];c.fillRect(x+1,y+1,62,30);c.fillStyle='#f1eedb55';c.fillRect(x+3,y+2,58,2);}
  }else if(industrial){c.strokeStyle='#9ca6a8';c.lineWidth=2;c.strokeRect(3,3,250,250);for(const x of [9,247])for(const y of [9,247]){c.fillStyle='#727e83';c.beginPath();c.arc(x,y,2,0,Math.PI*2);c.fill();}}
  for(let i=0;i<3200;i++){const x=(i*73+i*i*11)%256,y=(i*127+i*i*3)%256;c.fillStyle=i%2?'#fff7df15':'#494e4020';c.fillRect(x,y,1,1);}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
 };
 const mat=(key)=>{
  if(materials.has(key))return materials.get(key);
  const material=new THREE.MeshStandardMaterial({color:colors[key]??key,roughness:key==='metal'?.48:.87,metalness:key==='metal'?.38:0});
  if(['wall','floor','wood','cliff','metal'].includes(key)){material.map=texture(key);material.bumpMap=material.map;material.bumpScale=.035;}
  materials.set(key,material);return material;
 };
 const boxGeo=new RoundedBoxGeometry(1,1,1,1,.035),plain=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,16),sphere=new THREE.IcosahedronGeometry(1,1);
 const add=(geometry,x,y,z,sx,sy,sz,key='wall',rotation=0)=>{
  const g=geometry.index?geometry.toNonIndexed():geometry.clone(),matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rotation),new THREE.Vector3(sx,sy,sz));g.applyMatrix4(matrix);
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;if(uv)for(let i=0;i<p.count;i++){const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));uv.setXY(i,(ax>ay&&ax>az?p.getZ(i):p.getX(i))/4,(ay>ax&&ay>az?p.getZ(i):p.getY(i))/4);}
  const sector=`${Math.floor(x/40)},${Math.floor(z/40)}:${key}`;if(!batches.has(sector))batches.set(sector,{key,list:[]});batches.get(sector).list.push(g);
 };
 const cube=(x,y,z,w,h,d,key='wall')=>add(key==='accent'&&w<1&&d<1?boxGeo:plain,x,y,z,w,h,d,key);
 const beam=(a,b,r,key='trim')=>{const dir=new THREE.Vector3().subVectors(b,a),g=new THREE.CylinderGeometry(r,r,dir.length(),8).toNonIndexed();g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());const k=`${Math.floor(a.x/40)},${Math.floor(a.z/40)}:${key}`;if(!batches.has(k))batches.set(k,{key,list:[]});batches.get(k).list.push(g);};
 const line=(x,y,z,w,d,key='trim')=>cube(x,y,z,w,.16,d,key);
 const rail=(x,y,z,w,d)=>{
  const along=w>d,len=along?w:d;
  for(const h of [.4,1])cube(x,y+h,z,along?len:.09,.09,along?.09:len,'trim');
  for(let k=-len/2;k<=len/2;k+=2.5)cube(x+(along?k:0),y+.5,z+(along?0:k),.1,1.1,.1,'trim');
 };
 // Ground polygons include cellar and ravine cutouts; no hidden infinite plane.
 for(const t of m.terrain){
  const g=plain.clone();for(let i=0;i<g.attributes.uv.count;i++)g.attributes.uv.setXY(i,g.attributes.uv.getX(i)*t.w/4,g.attributes.uv.getY(i)*t.d/4);const mesh=new THREE.Mesh(g,mat(t.y<0?'cliff':forest?'#8a9970':'floor'));
  mesh.scale.set(t.w,.3,t.d);mesh.position.set(t.x,t.y-.15,t.z);mesh.receiveShadow=true;world.add(mesh);
  if(t.y===0&&m.minY<0)cube(t.x,m.minY/2-.15,t.z,t.w,-m.minY,t.d,'cliff');
 }
 // Street paving / work lanes provide scale without thousands of loose props.
 if(!forest)for(const z of industrial?[-34,0,34]:[-24,0,24]){
  cube(0,.01,z,industrial?130:220,.018,industrial?1:8,industrial?'accent':'#b8aa91');
  if(!industrial)for(let x=-108;x<110;x+=6)line(x,.035,z,5.8,.05,'#d1c7af');
 }
 for(const p of m.platforms){
  cube(p.x,p.y+p.h/2,p.z,p.w,p.h,p.d,p.kind==='wood'?'wood':p.kind==='metal'?'metal':p.kind==='roof'?'roof':'floor');
  for(const side of [-1,1]){line(p.x,p.y+.08,p.z+side*p.d/2,p.w,.16);line(p.x+side*p.w/2,p.y+.08,p.z,.16,p.d);}
 }
 for(const r of m.ramps){
  const len=r.axis==='x'?r.w:r.d,width=r.axis==='x'?r.d:r.w,count=Math.ceil((r.high-r.low)/.2);
  // Real modeled tread silhouettes, on a smooth simulation incline.
  for(let i=0;i<count;i++){
   const t=(i+.5)/count,offset=(t-.5)*len*r.direction,top=r.low+(i+1)/count*(r.high-r.low);
   cube(r.x+(r.axis==='x'?offset:0),(r.low+top)/2,r.z+(r.axis==='z'?offset:0),r.axis==='x'?len/count+.02:width,Math.max(.08,top-r.low),r.axis==='z'?len/count+.02:width,industrial?'metal':forest?'wood':'floor');
  }
  for(const side of [-1,1]){
   const a=new THREE.Vector3(r.x+(r.axis==='x'?-len/2*r.direction:side*(width/2+.1)),r.low+1,r.z+(r.axis==='z'?-len/2*r.direction:side*(width/2+.1)));
   const b=new THREE.Vector3(r.x+(r.axis==='x'?len/2*r.direction:side*(width/2+.1)),r.high+1,r.z+(r.axis==='z'?len/2*r.direction:side*(width/2+.1)));beam(a,b,.06);
  }
 }
 for(const o of m.obstacles){
  const y=o.y??0;
  if(o.kind==='roof-collision')continue;
  if(['tree','stall','crate'].includes(o.kind)){
   if(o.kind==='tree')view.place(o.id%3?'tree':'roundTree',{width:o.visualWidth,height:o.visualHeight},o.x,y,o.z,o.id*.73);
   if(o.kind==='stall')view.place(o.id%2?'greenStall':'redStall',{width:o.w,height:o.h,depth:o.d},o.x,y,o.z,Math.PI/2);
   if(o.kind==='crate'){view.place('barrel',{height:o.h,width:o.w,depth:o.d},o.x,y,o.z);view.place('bag',{height:.65},o.x+.4,y+o.h,o.z);}
  }else if(o.kind==='railing')rail(o.x,y,o.z,o.w,o.d);
  else if(o.kind==='turret'){
   const radius=o.w/2,bodyHeight=o.h-.9;
   add(cylinder,o.x,y+bodyHeight/2,o.z,radius,bodyHeight,o.d/2,'cliff');
   for(const height of [.25,bodyHeight-.3])add(cylinder,o.x,y+height,o.z,radius+.08,.3,o.d/2+.08,'trim');
   for(let i=0;i<8;i++){const angle=i*Math.PI/4;add(plain,o.x+Math.sin(angle)*(radius-.35),y+bodyHeight+.45,o.z+Math.cos(angle)*(o.d/2-.35),.85,.9,.65,'wall',angle);}
  }
  else if(o.kind==='silo'){
   add(cylinder,o.x,y+o.h/2,o.z,o.w/2,o.h,o.d/2,'metal');add(sphere,o.x,y+o.h,o.z,o.w/2,1.4,o.d/2,'metal');
   for(let h=1;h<o.h;h+=4){const torus=new THREE.TorusGeometry(o.w/2+.08,.1,5,24);torus.rotateX(Math.PI/2);add(torus,o.x,y+h,o.z,1,1,1,'accent');torus.dispose();}
   for(const side of [-1,1])cube(o.x+side*o.w*.3,y+.7,o.z,o.w*.12,1.4,o.d*.6,'trim');
  }else if(o.kind==='rock'||o.kind==='cliff'){
   if(o.kind==='cliff')cube(o.x,y+o.h/2,o.z,o.w,o.h,o.d,'cliff');else add(sphere,o.x,y+o.h*.45,o.z,o.w*.55,o.h*.55,o.d*.55,'cliff',o.id);
   for(let h=1;h<o.h;h+=2.3)line(o.x,y+h,o.z+o.d/2+.02,o.w,.1,'#899079');
  }else if(o.kind==='container'){
   cube(o.x,y+o.h/2,o.z,o.w,o.h,o.d,o.id%2?'accent':'metal');for(let x=-o.w/2+.3;x<o.w/2;x+=.6)cube(o.x+x,y+o.h/2,o.z+o.d/2,.08,o.h,.12,'trim');
  }else cube(o.x,y+o.h/2,o.z,o.w,o.h,o.d,o.kind==='factory'?'wall':o.kind==='steel'?'metal':o.kind==='column'?'trim':o.kind==='fortress'?'cliff':'wall');
 }
 for(const l of m.ladders){
  const h=l.top-l.bottom;
  for(const s of [-1,1])cube(l.x+(l.nx?0:s*.5),l.bottom+h/2+.25,l.z+(l.nx?s*.5:0),.09,h+.8,.09,'accent');
  for(let y=l.bottom+.25;y<l.top+.2;y+=.35)cube(l.x,y,l.z,l.nx?.09:1.05,.065,l.nx?1.05:.09,'accent');
  const sign=view.label('CLIMB ↑','#f7efd0',industrial?'#3b4e58':'#60694b',256);sign.scale.set(1.2,.6,1);sign.position.set(l.x+l.nx*.2,l.bottom+1.9,l.z+l.nz*.2);world.add(sign);
 }
 for(const d of m.decor){
  if(d.kind==='window-trim'){
   const along=d.axis==='x',w=d.w,h=d.h;
   for(const s of [-1,1])cube(d.x+(along?s*w/2:0),d.y+h/2,d.z+(along?0:s*w/2),along?.13:.65,h,along?.65:.13,'trim');
   cube(d.x,d.y+h,d.z,along?w+.3:.65,.18,along?.65:w+.3,'trim');
   if(!d.door)cube(d.x,d.y-.03,d.z,along?w+.5:.85,.15,along?.85:w+.5,'trim');
  }else if(d.kind==='house'){
   const rise=forest?7:5;
   for(let y=d.y;y<=d.y+d.h;y+=rise)for(const s of [-1,1]){line(d.x,y+.12,d.z+s*(d.d/2+.08),d.w+.6,.24);line(d.x+s*(d.w/2+.08),y+.12,d.z,.24,d.d);}
   for(const x of [-1,1])for(const z of [-1,1])cube(d.x+x*d.w/2,d.y+d.h/2,d.z+z*d.d/2,.6,d.h,.6,'trim');
   if(d.roof){
    // Roof shelters a portion of the top floor; the remaining terrace is usable.
    view.place('roof',{width:d.w*.6,depth:d.d*.55,height:3.6},d.x,d.y+d.h,d.z,Math.PI/2);
    view.place('chimney',{height:3},d.x+d.w*.19,d.y+d.h+1,d.z-d.d*.13);
   }else if(forest){for(let x=-d.w/2;x<=d.w/2;x+=2.5)for(const s of [-1,1])cube(d.x+x,d.y+d.h+.65,d.z+s*d.d/2,1.3,1.3,.8,'wall');}
   const sign=view.label(d.name,industrial?'#f0d796':'#eee3c1',industrial?'#364d57':'#755844',512);sign.position.set(d.x,d.y+3.8,d.z+d.d/2+.4);sign.scale.set(5.5,1.1,1);world.add(sign);
   if(!industrial){view.place('lantern',{height:.85},d.x+2,d.y+2.6,d.z+d.d/2+.2);if(Math.abs(d.x)<45)view.place('cart',{height:1.4},d.x-3,d.y,d.z+d.d/2+1);}
  }else if(d.kind==='awning'){
   const geometry=new THREE.CylinderGeometry(d.w/2,d.w/2,d.d,16,1,true,0,Math.PI);geometry.rotateX(Math.PI/2);add(geometry,d.x,d.y,d.z,1,.2,1,'accent');geometry.dispose();
  }else if(d.kind==='pipe'){
   const geo=new THREE.CylinderGeometry(.8,.8,d.length,12);geo.rotateX(Math.PI/2);add(geo,d.x,d.y,d.z,1,1,1,'accent');geo.dispose();
  }else if(d.kind==='factory-roof'){
   for(let z=-d.d/2+5;z<d.d/2;z+=12){beam(new THREE.Vector3(-69,d.y,z),new THREE.Vector3(0,d.y+7,z),.26,'metal');beam(new THREE.Vector3(0,d.y+7,z),new THREE.Vector3(69,d.y,z),.26,'metal');cube(0,d.y+.2,z,140,.28,.22,'accent');}
   for(const s of [-1,1])cube(s*71,15,0,1,30,2,'accent');
   const label=view.label('GOUDA WORKS / 06','#ffd273','#283e48',512);label.scale.set(20,4,1);label.position.set(0,20,60.4);world.add(label);
  }else if(d.kind==='bridge-arch'){
   const curve=new THREE.EllipseCurve(0,0,d.w/2,d.h,0,Math.PI,false,0),pts=curve.getPoints(20);for(let i=1;i<pts.length;i++)beam(new THREE.Vector3(d.x+pts[i-1].x,d.y+pts[i-1].y,d.z),new THREE.Vector3(d.x+pts[i].x,d.y+pts[i].y,d.z),.28,'wood');
  }else if(d.kind==='water'){
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(d.w,d.d),new THREE.MeshStandardMaterial({color:'#608b85',roughness:.23,metalness:.28,transparent:true,opacity:.8}));mesh.rotation.x=-Math.PI/2;mesh.position.set(d.x,d.y,d.z);world.add(mesh);
  }else if(d.kind==='lamp'){
   cube(d.x,d.y+2.7,d.z,.14,5.4,.14,'trim');cube(d.x,d.y+5.4,d.z+.6,.12,.12,1.4,'trim');
   const lamp=new THREE.Mesh(new THREE.SphereGeometry(.28,8,6),new THREE.MeshBasicMaterial({color:'#ffe3a1'}));lamp.position.set(d.x,d.y+5.2,d.z+1);world.add(lamp);
   const glow=new THREE.Mesh(new THREE.CircleGeometry(2.2,24),new THREE.MeshBasicMaterial({color:'#f1d49d',transparent:true,opacity:.12,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.set(d.x,d.y+.04,d.z+1);world.add(glow);
  }else if(d.kind==='sign'){const label=view.label(d.text,'#eee6c9',d.color,512);label.position.set(d.x,d.y,d.z);label.scale.set(5,1,1);world.add(label);}
 }
 // Visually distinct enclosing silhouettes.
 for(const s of [-1,1]){
  cube(0,forest?3:2,s*(m.halfZ+.5),m.width+2,forest?6:4,1,forest?'cliff':industrial?'metal':'wall');
  cube(s*(m.halfX+.5),forest?3:2,0,1,forest?6:4,m.depth,forest?'cliff':industrial?'metal':'wall');
  for(let x=-m.halfX+6;x<m.halfX;x+=14){if(forest)view.place('tree',{height:18+(x%5)},x,-1,s*(m.halfZ+5));else cube(x,industrial?5:2.5,s*m.halfZ,1.2,industrial?10:5,1.4,'trim');}
 }
 for(const {key,list} of batches.values()){
  const geometry=mergeGeometries(list,false),mesh=new THREE.Mesh(geometry,mat(key));mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='sector:'+key;world.add(mesh);list.forEach(g=>g.dispose());
 }
 boxGeo.dispose();plain.dispose();cylinder.dispose();sphere.dispose();
 world.userData.ownedMaterials=[...materials.values()];
}
