import { buildArchitecture } from './architecture.js';
import { Viewmodel } from './viewmodel.js';
import { PresentationClock, transform, damp, angleLerp } from './presentation.js';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AssetLibrary, ModelAnimator } from './assets.js';
import { getMap, DEFAULT_MAP_ID } from './map.js';

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

export class GameRenderer {
  static async create(canvas, onProgress, mapId=DEFAULT_MAP_ID) {
    const assets = await AssetLibrary.load(onProgress);
    return new GameRenderer(canvas, assets, mapId);
  }

  constructor(canvas, assets, mapId=DEFAULT_MAP_ID) {
    this.canvas = canvas;
    this.assets = assets;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.quality='medium';this.resolution=1;this.reducedBob=false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.info.autoReset=false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .96;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#d2e0d9');
    this.scene.fog = new THREE.Fog('#d2e0d9', 65, 150);
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.055, 700);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight('#e2edff', '#786b48', 1.6));
    const sun = this.sun = new THREE.DirectionalLight('#ffe2ab', 3.4);
    sun.position.set(-26, 48, 23);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 120 });
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.00012;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#b5d2e0', 0.5);
    fill.position.set(25, 16, -28);
    this.scene.add(fill);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.06);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.3;
    room.dispose(); pmrem.dispose();
    this.rats = []; this.baseVisuals = []; this.pickupMeshes = [];
    this.projectileMeshes = new Map(); this.lastTime = null;
    this.mats = {
      stone: material('#898271'), earth: material('#85785d'), dark: material('#343c30'),
      brass: material('#b7994c', { metalness: 0.65, roughness: 0.3 }),
      cork: material('#856135'), leather: material('#594437'), sleeve: material('#667a55'),
      skin: material('#d0a17d', { roughness: 0.72 }), crumb: material('#eec44b'),
    };
    this.worlds=new Map();this.clock=new PresentationClock();this.projectilePool=[];
    this.shared=new Set();for(const a of assets.models.values())a.scene.traverse(n=>{if(n.isMesh){this.shared.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])this.shared.add(m);}});
    this.buildSky(); this.setMap(mapId); this.buildActors(); this.viewmodel=new Viewmodel(this);
    for(let i=0;i<8;i++){const flask=this.poisonModel();flask.scale.setScalar(.34);flask.visible=false;this.scene.add(flask);this.projectilePool.push(flask);}
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
    // Read-only rendering diagnostics for asset and browser verification.
    this.canvas.dataset.models = String(assets.models.size);
  }

  mesh(geometry, mat, parent = this.world ?? this.scene) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  place(name, dimensions, x, y, z, rotation = 0, parent = this.world ?? this.scene) {
    const instance = this.assets.instance(name, { ...dimensions, rotation });
    instance.root.position.set(x, y, z);
    parent.add(instance.root);
    return instance.root;
  }

  ring(radius, color, x, z, width = 0.08, y = 0.03, parent = this.world ?? this.scene) {
    const mesh = this.mesh(new THREE.RingGeometry(radius - width, radius, 96), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }), parent);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.castShadow = false;
    return mesh;
  }

  label(text, color, background, width = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background; ctx.beginPath(); ctx.roundRect(4, 4, width - 8, 120, 16); ctx.fill();
    ctx.fillStyle = color; ctx.font = '800 43px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, 68);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map }));
    sprite.scale.set(5.8, 1.45, 1);
    return sprite;
  }

  pavingMaterial() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#707364'; ctx.fillRect(0, 0, 1024, 1024);
    const palette = ['#b8b3a5', '#a8ada0', '#c2bcaa', '#a6aa9e', '#b7b09d', '#c3bdad'];
    for (let row = -1; row < 17; row++) for (let col = -1; col < 9; col++) {
      const x = col * 128 + (row % 2) * 64, y = row * 64;
      ctx.fillStyle = '#5f675d'; ctx.beginPath(); ctx.roundRect(x + 3, y + 3, 123, 60, 8); ctx.fill();
      ctx.fillStyle = palette[Math.abs(row * 7 + col * 11) % palette.length];
      ctx.beginPath(); ctx.roundRect(x + 5, y + 4, 118, 54, 7); ctx.fill();
      ctx.strokeStyle = '#d9d1b369'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 14, y + 7); ctx.lineTo(x + 113, y + 7); ctx.stroke();
      if ((row * 5 + col) % 7 === 0) {
        ctx.strokeStyle = '#72776570'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 63, y + 4); ctx.lineTo(x + 56, y + 16); ctx.lineTo(x + 61, y + 28); ctx.stroke();
      }
    }
    for (let i = 0; i < 17000; i++) {
      const x = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 1024;
      const y = ((Math.sin(i * 78.233) * 12345.6789) % 1 + 1) % 1 * 1024;
      ctx.fillStyle = i % 2 ? '#eff0da28' : '#424b3724'; ctx.fillRect(x, y, 1.8, 1.8);
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(8, 8);
    map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return material('#ffffff', { map, bumpMap: map, bumpScale: 0.04, roughness: 0.94 });
  }

  buildSky() {
    const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0,0,0,1024);
    gradient.addColorStop(0,'#79adce'); gradient.addColorStop(0.36,'#bdd8e4');
    gradient.addColorStop(0.53,'#e9e9d3'); gradient.addColorStop(1,'#e9e9d3');
    ctx.fillStyle = gradient; ctx.fillRect(0,0,2048,1024);
    ctx.filter = 'blur(9px)'; ctx.fillStyle = '#fffdf26b';
    for (let i=0;i<13;i++) {
      const x=80+i*160, y=280+Math.sin(i*2.1)*65;
      for(let j=0;j<5;j++) {
        ctx.beginPath(); ctx.ellipse(x+j*19,y-Math.sin(j/4*Math.PI)*13,38,12+Math.sin(j+1)*5,0,0,Math.PI*2); ctx.fill();
      }
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace=THREE.SRGBColorSpace;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500,32,20),new THREE.MeshBasicMaterial({map,side:THREE.BackSide,fog:false,depthWrite:false}));
    this.sky.renderOrder=-2; this.scene.add(this.sky);
  }

  setMap(id) {
    if(this.map?.id===id)return;
    this.map=getMap(id);if(this.world)this.world.visible=false;
    let cached=this.worlds.get(id);
    if(!cached){
      this.world=new THREE.Group();this.world.name=this.map.name;this.scene.add(this.world);
      this.baseVisuals=[];this.pickupMeshes=[];this.buildArena();
      cached={world:this.world,bases:this.baseVisuals,pickups:this.pickupMeshes};this.worlds.set(id,cached);
    }
    this.world=cached.world;this.world.visible=true;this.baseVisuals=cached.bases;this.pickupMeshes=cached.pickups;
    this.worlds.delete(id);this.worlds.set(id,cached);
    while(this.worlds.size>2){const [key,old]=this.worlds.entries().next().value;old.world.removeFromParent();const disposed=new Set();old.world.traverse(n=>{if(!n.isMesh&&!n.isSprite)return;for(const resource of [n.geometry,...(Array.isArray(n.material)?n.material:[n.material])])if(resource&&!this.shared.has(resource)&&!Object.values(this.mats).includes(resource)&&!disposed.has(resource)){disposed.add(resource);if(resource.map&&!this.shared.has(resource.map))resource.map.dispose();resource.dispose();}});this.worlds.delete(key);}
    this.canvas.dataset.map=id;
    this.scene.environmentIntensity=this.map.theme==='industrial'?.65:.3;
    this.sun.intensity=this.map.theme==='industrial'?1.8:2.5;
    Object.assign(this.sun.shadow.camera,{left:-36,right:36,top:36,bottom:-36,far:180});this.sun.shadow.camera.updateProjectionMatrix();
  }
  buildArena(){
    buildArchitecture(this,this.map);
    for(const b of this.map.bases)this.buildBase(b);
    for(const p of this.map.pickups){
      this.place('board',{width:1.7,height:.12,depth:1.7},p.x,p.y+.03,p.z);
      this.ring(1.15,'#94b45a',p.x,p.z,.08,p.y+.03);
      const flask=this.poisonModel();flask.position.set(p.x,p.y+.9,p.z);this.world.add(flask);this.pickupMeshes.push(flask);
      const label=this.label('POISON','#dff5b5','#465b39',256);label.scale.set(1.8,.9,1);label.position.set(p.x,p.y+2,p.z);this.world.add(label);
    }
    this.batchStatics();
  }
  batchStatics(){
    this.world.updateMatrixWorld(true);
    const batches=new Map(),dynamic=new Set([...this.pickupMeshes,...this.baseVisuals.flatMap(v=>[v.pad,v.ring,v.particles])]);
    const visit=node=>{if(dynamic.has(node))return;if(node.isMesh&&!node.isInstancedMesh&&!node.isSkinnedMesh&&!Array.isArray(node.material)){
      const p=new THREE.Vector3().setFromMatrixPosition(node.matrixWorld),key=node.geometry.uuid+node.material.uuid+Math.floor(p.x/40)+','+Math.floor(p.z/40);
      if(!batches.has(key))batches.set(key,[]);batches.get(key).push(node);
    }for(const child of node.children)visit(child);};visit(this.world);
    for(const list of batches.values())if(list.length>=3){const first=list[0],batch=new THREE.InstancedMesh(first.geometry,first.material,list.length);batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;list.forEach((n,i)=>{batch.setMatrixAt(i,n.matrixWorld);n.removeFromParent();});batch.computeBoundingSphere();this.world.add(batch);}
  }
  setQuality(quality='medium',resolution=1,reducedBob=false){
    this.quality=quality;this.resolution=resolution;this.reducedBob=reducedBob;
    this.flaskTemplate?.traverse(n=>{if(n.isMesh&&n.material.isMeshPhysicalMaterial){const t=quality==='high'?.12:0;if(n.material.transmission!==t){n.material.transmission=t;n.material.needsUpdate=true;}}});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,quality==='high'?2:1.5)*resolution);
    this.renderer.shadowMap.enabled=quality!=='low';this.renderer.shadowMap.needsUpdate=true;this.resize();
  }
  async prepare(){
    // Both render passes and all pooled effects are prepared outside the match.
    this.scene.updateMatrixWorld(true);
    if(this.renderer.compileAsync){await this.renderer.compileAsync(this.scene,this.camera);await this.renderer.compileAsync(this.viewmodel.scene,this.viewmodel.camera);}
  }
  cheeseModel(width = 1.1) {
    return this.assets.instance('cheese', { width }).root;
  }

  cheeseWedge() {
    const root = new THREE.Group(); root.name = 'Swiss cheese wedge';
    const shape = new THREE.Shape();
    shape.moveTo(-0.29,-0.24); shape.lineTo(0.29,-0.24); shape.lineTo(-0.16,0.28); shape.closePath();
    // Actual holes through the cheese mesh, including beveled rims.
    for (const [x,y,r] of [[-0.14,-0.09,0.051],[0.09,-0.15,0.04],[-0.13,0.09,0.036]]) {
      const hole = new THREE.Path(); hole.absarc(x,y,r,0,Math.PI*2,true); shape.holes.push(hole);
    }
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.245, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.009, bevelThickness: 0.009, curveSegments: 24, steps: 1 });
    geometry.rotateX(-Math.PI/2);
    this.mesh(geometry, material('#f1c346', { roughness: 0.68 }), root);
    return root;
  }

  poisonModel() {
    if(this.flaskTemplate){const copy=this.flaskTemplate.clone(true);copy.userData.liquid=copy.getObjectByName('liquid');return copy;}
    const root = new THREE.Group(); root.name = 'Poison flask';
    const profile = [[0,0],[0.18,0],[0.25,0.04],[0.29,0.15],[0.3,0.35],[0.27,0.49],[0.15,0.58],[0.115,0.66],[0.115,0.8],[0.15,0.81],[0.15,0.86],[0.105,0.87]];
    const glass = new THREE.MeshPhysicalMaterial({ color: '#a4ce67', roughness: 0.14, metalness: 0.05,
      transparent: true, opacity: 0.48, depthWrite: false, transmission: 0, thickness: 0.07, clearcoat: 1, side: THREE.DoubleSide });
    const shell = this.mesh(new THREE.LatheGeometry(profile.map(([x,y]) => new THREE.Vector2(x,y)), 40), glass, root);
    shell.castShadow = false;
    const liquidProfile = [[0,0.035],[0.17,0.035],[0.23,0.065],[0.265,0.16],[0.275,0.34],[0.25,0.45],[0,0.45]];
    const liquid = this.mesh(new THREE.LatheGeometry(liquidProfile.map(([x,y]) => new THREE.Vector2(x,y)), 32),
      material('#86bd32', { roughness: 0.23, emissive: '#609b19', emissiveIntensity: 0.55 }), root);
    const cork = this.mesh(new THREE.CylinderGeometry(0.1, 0.095, 0.16, 20), this.mats.cork, root);
    cork.position.y = 0.875;
    const neck = this.mesh(new THREE.TorusGeometry(0.125, 0.018, 6, 32), this.mats.brass, root);
    neck.rotation.x = Math.PI / 2; neck.position.y = 0.73;
    const labelCanvas = document.createElement('canvas'); labelCanvas.width = 128; labelCanvas.height = 128;
    const ctx = labelCanvas.getContext('2d');
    ctx.fillStyle = '#e7dcab'; ctx.fillRect(0,0,128,128);
    ctx.strokeStyle = '#6b713e'; ctx.lineWidth = 3; ctx.strokeRect(6,6,116,116);
    ctx.fillStyle = '#364329'; ctx.font = '800 42px Arial'; ctx.textAlign = 'center'; ctx.fillText('☠',64,65);
    ctx.font = '800 13px Arial'; ctx.fillText('RAT REPELLENT',64,94);
    const map = new THREE.CanvasTexture(labelCanvas); map.colorSpace = THREE.SRGBColorSpace;
    const label = this.mesh(new THREE.CylinderGeometry(0.301, 0.301, 0.3, 24, 1, true, -0.64, 1.28), material('#ffffff', { map, side: THREE.DoubleSide }), root);
    label.position.y = 0.3; label.castShadow = false;
    const bubbles = new THREE.Group(); root.add(bubbles);
    for (let i=0;i<5;i++) {
      const bubble = this.mesh(new THREE.SphereGeometry(0.025,8,6), material('#c7ed73', { emissive: '#80ac37', emissiveIntensity: 0.4 }), bubbles);
      bubble.position.set(Math.sin(i * 2.4) * 0.14, 0.15 + i * 0.055, Math.cos(i * 2.4) * 0.14);
    }
    liquid.name='liquid';root.userData.liquid=liquid;this.flaskTemplate=root;root.traverse(n=>{if(n.isMesh){this.shared.add(n.geometry);this.shared.add(n.material);if(n.material.map)this.shared.add(n.material.map);}});const copy=root.clone(true);copy.userData.liquid=copy.getObjectByName('liquid');return copy;
  }

  buildBase(base) {
    const pad = this.mesh(new THREE.CircleGeometry(4.95, 96), material(base.color, { transparent: true, opacity: 0.19, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(base.x, 0.015, base.z); pad.castShadow = false;
    const ring = this.ring(5, base.color, base.x, base.z, 0.13);
    this.ring(4.72, '#f2e5b4', base.x, base.z, 0.035);
    this.place('board', { width: 2.9, depth: 2.9, height: 0.13 }, base.x, 0.03, base.z);
    for (const [x,z,y,width,rot] of [[-0.43,0.05,0.16,1.15,-0.4],[0.48,0.05,0.16,1.15,1.6],[0,0,0.64,0.88,0.5]]) {
      const cheese = this.cheeseModel(width); cheese.position.set(base.x+x,y,base.z+z); cheese.rotation.y=rot; this.world.add(cheese);
    }
    const sign = this.label(base.id===0 ? 'YOUR CHEESE BOARD' : 'RIVAL CHEESE BOARD', base.id===0 ? '#58451a' : '#693726', base.id===0 ? '#f3ce66' : '#eda889');
    sign.position.set(base.x,4.7,base.z); this.world.add(sign);
    const banner = this.place(base.id===0 ? 'greenBanner' : 'redBanner', { height: 2.5 }, base.x + (base.id===0 ? -4.2 : 4.2), 0, base.z + (base.id===0 ? 4.2 : -4.2), Math.PI/2);
    const particles = new THREE.Group(); particles.position.set(base.x,0,base.z); this.world.add(particles);
    const particleMaterial = material('#9acd4b', { transparent: true, opacity: 0.6, emissive: '#71a430', emissiveIntensity: 0.4 });
    for(let i=0;i<24;i++) this.mesh(new THREE.SphereGeometry(0.08+(i%3)*0.05,8,6),particleMaterial,particles);
    this.baseVisuals.push({ pad, ring, sign, banner, particles });
  }

  buildActors() {
    for (let i=0;i<10;i++) {
      const instance = this.assets.instance('rat', { height: 0.68 });
      const root = instance.root; root.name = `Rat ${i+1}`;
      this.scene.add(root);
      const marker = this.ring(0.52,'#efcb64',0,0,0.055,0.018,root);
      const crumbs = new THREE.Group(); root.add(crumbs);
      for (let j=0;j<4;j++) this.mesh(new THREE.IcosahedronGeometry(0.025,0),this.mats.crumb,crumbs);
      // Slight coat variation while retaining the model's pink ears and tail.
      instance.model.traverse(node => {
        if (!node.isMesh) return;
        const vary = mat => {
          if (mat.name!=='Grey') return mat;
          const next=mat.clone(); next.color.set(['#858079','#6f6965','#99958a','#716c66','#a49985'][i%5]); return next;
        };
        node.material=Array.isArray(node.material)?node.material.map(vary):vary(node.material);
      });
      this.rats.push({ root, marker, crumbs, animator: new ModelAnimator(instance) });
    }
    const opponent = this.assets.instance('adventurer', { height: 1.95, rotation: Math.PI, tint: '#b75d41' });
    this.bot = opponent.root; this.bot.name='Crumb Bot'; this.scene.add(this.bot);
    this.botAnimator = new ModelAnimator(opponent);
    const label=this.label('CRUMB BOT','#753c29','#f4c2a4',400); label.position.y=2.6; label.scale.set(2.4,0.72,1); this.bot.add(label);
    const player = this.assets.instance('adventurer', { height: 1.95, rotation: Math.PI, tint: '#758251' });
    this.previewPlayer=player.root; this.scene.add(this.previewPlayer); this.previewAnimator=new ModelAnimator(player);
  }

  resize() {
    const {width,height}=this.canvas.parentElement.getBoundingClientRect();
    if(!width||!height)return;
    this.renderer.setSize(width,height,false); this.camera.aspect=width/height; this.camera.updateProjectionMatrix();
  }

  render(state,{preview=false,time=0,alpha=1,previous=null,paused=false,look=null,tour=false}={}){
    this.setMap(state.mapId);this.renderer.info.reset();
    const clock=this.clock.update(state,alpha,time,preview,paused),animationTime=clock.time,delta=clock.dt,simulationDelta=delta;
    const lerp=(a,b)=>a+(b-a)*alpha;
    this.sky.visible=!preview||tour;
    const p=state.players[0],pose=transform(previous?.players[0],p,alpha);
    if(preview){
      if(tour){const n=Math.floor(time/7)%this.map.tour.length,t=this.map.tour[n],drift=Math.sin(time*.4)*1.2;this.camera.position.set(t.x+drift,t.y,t.z);this.camera.fov=76;this.camera.lookAt(t.tx,t.ty,t.tz);}
      else {const angle=.62+Math.sin(time*.06)*.07,radius=this.map.size*(this.camera.aspect<1.1?1.62:1.25);this.camera.position.set(Math.sin(angle)*radius,this.map.size*.95,Math.cos(angle)*radius);this.camera.fov=44;this.camera.lookAt(0,7,0);}
      this.scene.fog.near=this.map.size*2;this.scene.fog.far=this.map.size*4;
    }else{
      this.cameraMotion=damp(this.cameraMotion??0,p.grounded?Math.min(1,(p.speed??0)/6.8):0,14,delta);
      const gaze=look??p,bob=this.reducedBob?0:Math.sin(pose.travel*4.6)*.017*this.cameraMotion;
      // Never switch coordinate sources on takeoff: XYZ use the same snapshot.
      this.camera.position.set(pose.x,pose.y+1.65+bob,pose.z);this.camera.rotation.set(gaze.pitch,gaze.yaw,0,'YXZ');
      this.camera.fov=clock.reset?76:damp(this.camera.fov,p.sprinting?(this.reducedBob?78:83):76,10,delta);
      this.scene.fog.near=this.map.theme==='industrial'?80:110;this.scene.fog.far=this.map.size*1.4;
    }
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
    this.sun.position.set((preview?0:pose.x)-30,(preview?0:pose.y)+65,(preview?0:pose.z)+25);this.sun.target.position.set(preview?0:pose.x,preview?0:pose.y,preview?0:pose.z);this.sun.target.updateMatrixWorld();
    state.rats.forEach((rat,i)=>{
      const actor=this.rats[i],old=previous?.rats[i]??rat;
      actor.root.position.set(lerp(old.x,rat.x),lerp(old.y??rat.y,rat.y)+0.015,lerp(old.z,rat.z));
      const desired=rat.yaw;
      actor.root.rotation.y=angleLerp(old.yaw??desired,desired,alpha);
      const mode=rat.eating?'eat':rat.fleeUntil>state.time?'run':rat.moving?'walk':'idle';
      actor.animator.update(mode,simulationDelta,animationTime,i*0.23,rat.speed??0);
      actor.root.userData.behavior=mode;
      actor.marker.visible=rat.target==='player:0'||rat.capturedBy!==null;
      actor.marker.material.color.set(rat.capturedBy===1?'#e69372':'#f1cb62');
      actor.crumbs.visible=rat.eating;
      actor.crumbs.children.forEach((crumb,j)=>{
        const cycle=(animationTime*2.7+j*0.24)%1;
        crumb.position.set(Math.sin(j*3+i)*0.13,0.12+Math.sin(cycle*Math.PI)*0.13,0.55+cycle*0.15);
        crumb.scale.setScalar(1-cycle*0.65);
      });
    });
    const bot=state.players[1],old=previous?.players[1]??bot;
    this.bot.position.set(lerp(old.x,bot.x),lerp(old.y??bot.y,bot.y),lerp(old.z,bot.z)); this.bot.rotation.y=angleLerp(old.yaw??bot.yaw,bot.yaw,alpha);
    this.botAnimator.update(bot.moving?(bot.sprinting?'run':'walk'):'idle',simulationDelta,animationTime,0,bot.speed??0);
    this.previewPlayer.visible=preview;
    this.previewPlayer.position.set(state.players[0].x,state.players[0].y,state.players[0].z); this.previewPlayer.rotation.y=state.players[0].yaw;
    if(preview)this.previewAnimator.update('idle',delta,time);
    state.bases.forEach((base,i)=>{
      const visual=this.baseVisuals[i],poisoned=base.poisonedUntil>state.time;
      const labelWidth=preview?5.8:Math.min(5.8,Math.max(1.8,Math.hypot(base.x-this.camera.position.x,base.z-this.camera.position.z)*0.27));
      visual.sign.scale.set(labelWidth,labelWidth/4,1);
      visual.pad.material.color.set(poisoned?'#86b63e':base.color);
      visual.pad.material.opacity=poisoned?0.48:0.19;
      visual.ring.material.color.set(poisoned?'#a2d744':base.color);
      visual.particles.visible=poisoned;
      if(poisoned)visual.particles.children.forEach((p,j)=>{const angle=j*2.399;p.position.set(Math.cos(angle)*(1+j%4),((animationTime*1.3+j*0.27)%3)+0.2,Math.sin(angle)*(1+j%4));});
    });
    state.pickups.forEach((pickup,i)=>{
      const model=this.pickupMeshes[i]; model.visible=pickup.availableAt<=state.time;
      model.position.y=pickup.y+0.78+Math.sin(animationTime*2+i)*0.12; model.rotation.y=animationTime*0.6;
    });
    const ids=new Set(state.projectiles.map(p=>p.id));
    for(const [id,model] of this.projectileMeshes)if(!ids.has(id)){model.visible=false;this.projectilePool.push(model);this.projectileMeshes.delete(id);}
    for(const projectile of state.projectiles){
      let model=this.projectileMeshes.get(projectile.id);
      if(!model){model=this.projectilePool.pop();if(!model){model=this.poisonModel();model.scale.setScalar(.34);this.scene.add(model);}this.projectileMeshes.set(projectile.id,model);}
      model.visible=animationTime+1e-6>=(projectile.born??0);
      const old=previous?.projectiles?.find(p=>p.id===projectile.id)??projectile.origin??projectile;
      const q=transform(old,projectile,alpha);model.position.set(q.x,q.y,q.z);model.rotation.z=(animationTime-(projectile.born??0))*6;
    }
    this.renderer.render(this.scene,this.camera);
    if(!preview){this.viewmodel.update(state,{...clock,pose,look:look??p,map:this.map,bob:!this.reducedBob});this.viewmodel.render(this.renderer,this.camera.aspect);}
    this.diagnostics={calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,presentationTime:animationTime,camera:this.camera.position.toArray(),quality:this.quality};
  }
}
