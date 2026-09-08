import * as THREE from 'three';
import { ARENA, OBSTACLES, BASES, PICKUP_SPAWNS } from './map.js';

const COLORS = { sand: 0xd8ccb4, wall: 0xe9dcc3, edge: 0xb9a487, wood: 0xc99454, darkWood: 0x886642, yellow: 0xf5c542, orange: 0xe47657, green: 0x9ed758, ink: 0x343b35 };
const material = (color, more = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.86, ...more });

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdce8e2);
    this.scene.fog = new THREE.Fog(0xdce8e2, 85, 180);
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.07, 250);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xf6f4df, 0xb3a384, 1.7));
    const sun = new THREE.DirectionalLight(0xffefd0, 2.5);
    sun.position.set(-30, 55, 20); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 120 });
    sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.00015;
    this.scene.add(sun);
    this.mats = Object.fromEntries(Object.entries(COLORS).map(([key,value]) => [key, material(value)]));
    this.ratMeshes = []; this.baseVisuals = []; this.pickupMeshes = []; this.projectileMeshes = new Map();
    this.buildArena(); this.buildActors(); this.buildHand();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
  }
  mesh(geometry, mat, parent = this.scene) {
    const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  box(w, h, d, x, y, z, mat, parent = this.scene) {
    const box = this.mesh(new THREE.BoxGeometry(w,h,d), mat, parent); box.position.set(x,y,z); return box;
  }
  ring(radius, color, x, z, width = 0.1, y = 0.045, parent = this.scene) {
    const ring = this.mesh(new THREE.RingGeometry(radius-width, radius, 80), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }), parent);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x,y,z); ring.castShadow = false; return ring;
  }
  label(text, color = '#364139', bg = '#f8f1d8', width = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(4, 4, width-8, 120, 18); ctx.fill();
    ctx.font = '800 46px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    ctx.fillText(text, width/2, 68);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true }));
    sprite.scale.set(6.5, 1.625, 1); return sprite;
  }
  groundTexture() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#d8cbb2'; ctx.fillRect(0,0,1024,1024);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#ddcfb6' : '#d8cbb2'; ctx.fillRect(x*128,y*128,128,128);
      ctx.strokeStyle = '#c6bba4'; ctx.lineWidth = 1.2; ctx.strokeRect(x*128,y*128,128,128);
    }
    for (let i = 0; i < 8500; i++) {
      const x = ((Math.sin(i*12.9898)*43758.5453)%1+1)%1*1024;
      const y = ((Math.sin(i*78.233)*12345.6789)%1+1)%1*1024;
      ctx.fillStyle = i%2 ? '#ab9f8810' : '#ffffef25'; ctx.fillRect(x,y,1.5,1.5);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy(); return texture;
  }
  buildArena() {
    this.box(63, 2.5, 63, 0,-1.36,0,material(0xa28d6e));
    this.box(63.4,0.35,63.4,0,-0.22,0,this.mats.edge);
    const ground = this.mesh(new THREE.PlaneGeometry(60,60), material(0xffffff, { map: this.groundTexture() }));
    ground.rotation.x = -Math.PI/2; ground.castShadow = false;
    const backdrop = this.mesh(new THREE.PlaneGeometry(1000,1000),material(0xd4dfd6));
    backdrop.rotation.x = -Math.PI/2; backdrop.position.y = -2.7; backdrop.castShadow = false;
    for (const side of [-1,1]) {
      this.box(62,2.8,1.15,0,1.4,side*30.6,this.mats.wall);
      this.box(62.4,0.25,1.4,0,2.85,side*30.6,this.mats.edge);
      this.box(1.15,2.8,60,side*30.6,1.4,0,this.mats.wall);
      this.box(1.4,0.25,60,side*30.6,2.85,0,this.mats.edge);
      this.box(60,0.5,0.05,0,0.3,side*30.01,material(0xbd9572));
      this.box(0.05,0.5,60,side*30.01,0.3,0,material(0xbd9572));
      for (let p = -24; p <= 24; p += 12) {
        this.box(1.1,3.2,1.5,p,1.6,side*30.6,this.mats.edge);
        this.box(1.5,3.2,1.1,side*30.6,1.6,p,this.mats.edge);
      }
    }
    this.ring(7.5,0xc0b198,0,0,0.12);
    this.ring(7.8,0xeae0ca,0,0,0.05);
    for (const o of OBSTACLES) {
      if (o.kind === 'crate') this.crate(o);
      else {
        this.box(o.w,o.h,o.d,o.x,o.h/2,o.z,this.mats.wall);
        this.box(o.w+0.12,0.16,o.d+0.12,o.x,o.h+0.04,o.z,this.mats.edge);
        this.box(o.w+0.02,0.35,o.d+0.02,o.x,0.2,o.z,material(0xbd9676));
      }
    }
    for (const base of BASES) this.buildBase(base);
    for (const spawn of PICKUP_SPAWNS) {
      const pad = this.mesh(new THREE.CylinderGeometry(0.95,1.1,0.16,32),material(0x879d70)); pad.position.set(spawn.x,0.09,spawn.z);
      this.ring(1.15,0x758a5a,spawn.x,spawn.z,0.06);
      const pickup = this.poisonModel(); pickup.position.set(spawn.x,1.2,spawn.z); this.scene.add(pickup); this.pickupMeshes.push(pickup);
    }
    // Painted route markers from each home toward the central rat yard.
    for (const base of BASES) for (let i = 0; i < 3; i++) {
      const t = 0.32 + i*0.09, x = base.x*(1-t), z = base.z*(1-t);
      const arrow = new THREE.Shape(); arrow.moveTo(-0.65,-0.5); arrow.lineTo(0,0.4); arrow.lineTo(0.65,-0.5); arrow.lineTo(0.65,-0.1); arrow.lineTo(0,0.85); arrow.lineTo(-0.65,-0.1); arrow.closePath();
      const paint = this.mesh(new THREE.ShapeGeometry(arrow),new THREE.MeshBasicMaterial({color:0xf7eed8,side:THREE.DoubleSide}));
      paint.rotation.set(-Math.PI/2,0,base.id===0?Math.PI/4:-Math.PI*0.75); paint.position.set(x,0.025,z); paint.castShadow=false;
    }
    // A few plants outside the walls keep the playable collision map exact.
    for (const [x,z] of [[-33,-26],[-32,-24],[33,25],[33,23],[-24,33],[24,-33]]) {
      const bush = this.mesh(new THREE.IcosahedronGeometry(1.3,0),material(0x849b72)); bush.position.set(x,-0.1,z); bush.scale.set(1,0.8,1);
    }
  }
  crate(o) {
    const mat = material(o.id%4<2?0xc69b64:0xb88a55);
    this.box(o.w,o.h,o.d,o.x,o.h/2,o.z,mat);
    const strip = this.mats.darkWood;
    for (const sign of [-1,1]) {
      for (const u of [-0.38,0.38]) {
        this.box(0.17,o.h+0.04,o.d+0.035,o.x+o.w*u,o.h/2,o.z,strip);
        this.box(o.w+0.035,0.14,0.12,o.x,o.h*(u+0.5),o.z+sign*o.d/2,strip);
      }
      const brace = this.box(o.w*0.88,0.13,0.07,o.x,o.h/2,o.z+sign*(o.d/2+0.045),strip);
      brace.rotation.z = sign*Math.atan2(o.h*0.7,o.w*0.85);
      for (let i = 1; i < 4; i++) this.box(o.w+0.03,0.018,0.02,o.x,o.h*i/4,o.z+sign*(o.d/2+0.02),strip);
    }
    this.box(o.w+0.07,0.15,o.d+0.07,o.x,o.h,o.z,mat);
  }
  cheeseModel(scale = 1) {
    const group = new THREE.Group();
    const shape = new THREE.Shape(); shape.moveTo(-0.65,-0.48); shape.lineTo(0.68,-0.48); shape.lineTo(-0.3,0.65); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape,{depth:0.55,bevelEnabled:true,bevelThickness:0.035,bevelSize:0.035,bevelSegments:1,steps:1});
    geo.rotateX(-Math.PI/2);
    this.mesh(geo,this.mats.yellow,group);
    const holeMat = material(0xc99222);
    for (const [x,z,r] of [[-0.3,0.23,0.12],[0.23,0.26,0.095],[-0.22,-0.22,0.085]]) {
      const hole = this.mesh(new THREE.CircleGeometry(r,16),holeMat,group); hole.rotation.x=-Math.PI/2; hole.position.set(x,0.588,z); hole.castShadow=false;
    }
    for (const [x,y,r] of [[-0.3,0.26,0.12],[0.25,0.32,0.1]]) {
      const hole=this.mesh(new THREE.CircleGeometry(r,16),holeMat,group); hole.position.set(x,y,0.519); hole.castShadow=false;
    }
    group.scale.setScalar(scale); return group;
  }
  poisonModel() {
    const group=new THREE.Group();
    const orb=this.mesh(new THREE.SphereGeometry(0.34,16,12),material(0xa6df55,{emissive:0x78ac22,emissiveIntensity:0.25}),group);
    orb.scale.y=1.1;
    const collar=this.mesh(new THREE.CylinderGeometry(0.13,0.15,0.16,12),this.mats.darkWood,group);collar.position.y=0.37;
    this.box(0.25,0.18,0.03,0,0.02,0.325,material(0xf1f0c9),group);
    const cross=this.box(0.12,0.03,0.025,0,0.02,0.347,this.mats.ink,group);cross.rotation.z=Math.PI/4;
    const cross2=this.box(0.12,0.03,0.025,0,0.02,0.347,this.mats.ink,group);cross2.rotation.z=-Math.PI/4;
    return group;
  }
  buildBase(base) {
    const padMat=material(base.color,{transparent:true,opacity:0.6});
    const pad=this.mesh(new THREE.CylinderGeometry(4.95,4.95,0.06,80),padMat);pad.position.set(base.x,0.04,base.z);pad.castShadow=false;
    const ring=this.ring(5,base.color,base.x,base.z,0.16,0.08);
    this.ring(4.65,0xfff2cc,base.x,base.z,0.06,0.085);
    for (let i=-1;i<=1;i++) this.box(2.5,0.12,0.6,base.x,0.16,base.z+i*0.72,this.mats.darkWood);
    for (const [x,z,y,rot] of [[-0.65,0,0.25,0.2],[0.65,0.1,0.25,1.2],[0,0,1.04,0.8]]) {
      const cheese=this.cheeseModel(1.35);cheese.position.set(base.x+x,y,base.z+z);cheese.rotation.y=rot;this.scene.add(cheese);
    }
    const sign=this.label(base.id===0?'YOUR BASE':'RIVAL BASE',base.id===0?'#534316':'#6e3223',base.id===0?'#f4cf60':'#f29b7d');
    sign.position.set(base.x,5.1,base.z);this.scene.add(sign);
    const particles=new THREE.Group();const bubbleMat=material(0x8ecb4a,{transparent:true,opacity:0.65,emissive:0x74b935,emissiveIntensity:0.3});
    for (let i=0;i<18;i++) this.mesh(new THREE.SphereGeometry(0.1+(i%3)*0.04,6,5),bubbleMat,particles);
    particles.position.set(base.x,0,base.z);this.scene.add(particles);
    this.baseVisuals.push({pad,ring,sign,particles});
  }
  ratModel(id) {
    const group=new THREE.Group(), fur=material([0x8f9289,0xb0aea1,0x788079,0xd2c9b5,0x939e91][id%5]);
    const pink=material(0xd4a499),black=material(0x252d27);
    this.box(0.47,0.36,0.67,0,0.32,-0.05,fur,group);
    this.box(0.37,0.3,0.33,0,0.32,0.36,fur,group);
    for (const side of [-1,1]) {
      const ear=this.mesh(new THREE.SphereGeometry(0.145,8,6),fur,group);ear.position.set(side*0.19,0.53,0.28);ear.scale.z=0.4;
      const inner=this.mesh(new THREE.SphereGeometry(0.1,8,6),pink,group);inner.position.set(side*0.19,0.54,0.318);inner.scale.z=0.25;
      const eye=this.mesh(new THREE.SphereGeometry(0.045,6,6),black,group);eye.position.set(side*0.19,0.39,0.48);
      for (const z of [-0.24,0.25]) this.box(0.13,0.11,0.18,side*0.2,0.09,z,pink,group);
    }
    const nose=this.mesh(new THREE.SphereGeometry(0.055,6,6),pink,group);nose.position.set(0,0.3,0.56);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0.2,-0.36),new THREE.Vector3(0.12,0.12,-0.7),new THREE.Vector3(0.35,0.09,-0.85),new THREE.Vector3(0.45,0.1,-1.03)]);
    const tail=this.mesh(new THREE.TubeGeometry(curve,8,0.035,5,false),pink,group);group.userData.tail=tail;
    const marker=this.ring(0.55,0xf4d16d,0,0,0.065,0.018,group);marker.visible=false;group.userData.marker=marker;
    return group;
  }
  buildActors() {
    for(let i=0;i<10;i++){const rat=this.ratModel(i);this.scene.add(rat);this.ratMeshes.push(rat);}
    this.bot=new THREE.Group();this.scene.add(this.bot);
    const body=this.mesh(new THREE.CapsuleGeometry(0.37,0.75,4,8),this.mats.orange,this.bot);body.position.y=0.96;
    this.box(0.57,0.25,0.1,0,1.43,-0.33,this.mats.ink,this.bot);
    for(const side of [-1,1])this.box(0.18,0.48,0.22,side*0.2,0.27,0,this.mats.ink,this.bot);
    const cap=this.mesh(new THREE.CylinderGeometry(0.39,0.39,0.15,8),material(0xbe573e),this.bot);cap.position.y=1.73;
    const cheese=this.cheeseModel(0.5);cheese.position.set(-0.35,0.8,-0.5);this.bot.add(cheese);
    const label=this.label('CRUMB BOT','#793925','#ffceac',400);label.position.y=2.65;label.scale.set(2.5,0.8,1);this.bot.add(label);
    this.previewPlayer=new THREE.Group();this.scene.add(this.previewPlayer);
    const p=this.mesh(new THREE.CapsuleGeometry(0.37,0.75,4,8),this.mats.yellow,this.previewPlayer);p.position.y=0.96;
    this.box(0.55,0.24,0.12,0,1.42,-0.33,this.mats.ink,this.previewPlayer);
  }
  buildHand() {
    this.hand=new THREE.Group();this.camera.add(this.hand);
    this.hand.scale.setScalar(0.67);
    const sleeve=material(0x637867),skin=material(0xd3a180);
    const arm=this.box(0.23,0.25,0.65,0.06,-0.15,0.22,sleeve,this.hand);arm.rotation.x=-0.16;
    this.box(0.24,0.2,0.23,0.04,-0.055,-0.1,skin,this.hand);
    this.handCheese=this.cheeseModel(0.43);this.handCheese.position.set(0,0.04,-0.21);this.handCheese.rotation.y=-0.5;this.hand.add(this.handCheese);
    this.handPoison=this.poisonModel();this.handPoison.scale.setScalar(0.9);this.handPoison.position.set(0,0.19,-0.2);this.hand.add(this.handPoison);
    this.hand.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  }
  resize() {
    const {width,height}=this.canvas.parentElement.getBoundingClientRect();
    if(!width||!height)return;
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
  }
  render(state, {preview=false,time=0,alpha=1,previous=null}={}) {
    const lerp=(a,b)=>a+(b-a)*alpha;
    if(preview){
      const angle=0.68+Math.sin(time*0.045)*0.035;
      const distance=this.camera.aspect<1.1?110:96;
      this.camera.position.set(Math.sin(angle)*distance,67,Math.cos(angle)*distance);
      this.camera.fov=44;this.camera.lookAt(0,-4,0);this.hand.visible=false;
      this.scene.fog.near=150;this.scene.fog.far=250;
    }else{
      const p=state.players[0],prev=previous?.players[0]??p;
      this.camera.position.set(lerp(prev.x,p.x),1.65+(p.moving?Math.sin(time*(p.sprinting?17:12))*0.035:0),lerp(prev.z,p.z));
      this.camera.rotation.set(p.pitch,p.yaw,0,'YXZ');
      this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,p.sprinting?83:76,0.1);
      this.hand.visible=true;this.handCheese.visible=!p.poison;this.handPoison.visible=p.poison;
      const bob=p.moving?Math.sin(time*10)*0.014:Math.sin(time*2)*0.005;
      this.hand.position.set(0.52,-0.47+bob,-0.9);this.hand.rotation.set(0.05,0.06,p.sprinting?-0.1:0.02);
      this.scene.fog.near=70;this.scene.fog.far=150;
    }
    this.camera.updateProjectionMatrix();
    state.rats.forEach((rat,i)=>{
      const mesh=this.ratMeshes[i],prev=previous?.rats[i]??rat;
      mesh.position.set(lerp(prev.x,rat.x)+(preview?Math.sin(time*0.65+i)*0.35:0),rat.moving||preview?Math.abs(Math.sin(time*14+i))*0.035:0,lerp(prev.z,rat.z));
      mesh.rotation.y=preview?rat.yaw+Math.sin(time*0.6+i)*0.5:rat.yaw;
      mesh.userData.tail.rotation.y=Math.sin(time*7+i)*0.13;
      mesh.userData.marker.visible=rat.target==='player:0'||rat.capturedBy!==null;
      mesh.userData.marker.material.color.setHex(rat.capturedBy===1?0xef8b6d:0xf4ce57);
    });
    const bot=state.players[1],oldBot=previous?.players[1]??bot;
    this.bot.position.set(lerp(oldBot.x,bot.x),0,lerp(oldBot.z,bot.z));this.bot.rotation.y=bot.yaw;
    this.previewPlayer.visible=preview;this.previewPlayer.position.set(state.players[0].x,0,state.players[0].z);this.previewPlayer.rotation.y=state.players[0].yaw;
    state.bases.forEach((base,i)=>{
      const visual=this.baseVisuals[i],poisoned=base.poisonedUntil>state.time;
      visual.pad.material.color.set(poisoned?0x91c744:base.color);visual.ring.material.color.set(poisoned?0x79aa36:base.color);
      visual.particles.visible=poisoned;
      if(poisoned)visual.particles.children.forEach((p,j)=>{const angle=j*2.399;p.position.set(Math.cos(angle)*(1+j%4),((time*1.3+j*0.27)%3)+0.2,Math.sin(angle)*(1+j%4));});
    });
    state.pickups.forEach((pickup,i)=>{const mesh=this.pickupMeshes[i];mesh.visible=pickup.availableAt<=state.time;mesh.position.y=1.2+Math.sin(time*2+i)*0.16;mesh.rotation.y=time*0.6;});
    const active=new Set(state.projectiles.map(p=>p.id));
    for(const[id,mesh]of this.projectileMeshes)if(!active.has(id)){this.scene.remove(mesh);mesh.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(!Object.values(this.mats).includes(o.material))o.material.dispose();}});this.projectileMeshes.delete(id);}
    for(const p of state.projectiles){let mesh=this.projectileMeshes.get(p.id);if(!mesh){mesh=this.poisonModel();this.projectileMeshes.set(p.id,mesh);this.scene.add(mesh);}mesh.position.set(p.x,p.y,p.z);mesh.rotation.z=time*6;}
    this.renderer.render(this.scene,this.camera);
  }
}
