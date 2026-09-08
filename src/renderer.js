import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AssetLibrary, ModelAnimator } from './assets.js';
import { OBSTACLES, BASES, PICKUP_SPAWNS } from './map.js';

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

export class GameRenderer {
  static async create(canvas, onProgress) {
    const assets = await AssetLibrary.load(onProgress);
    return new GameRenderer(canvas, assets);
  }

  constructor(canvas, assets) {
    this.canvas = canvas;
    this.assets = assets;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#d2e0d9');
    this.scene.fog = new THREE.Fog('#d2e0d9', 65, 150);
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.055, 300);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight('#e2edff', '#786b48', 1.6));
    const sun = new THREE.DirectionalLight('#ffe2ab', 3.4);
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
    this.buildSky(); this.buildArena(); this.buildActors(); this.buildHands();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
    // Read-only rendering diagnostics for asset and browser verification.
    this.canvas.dataset.models = String(assets.models.size);
  }

  mesh(geometry, mat, parent = this.scene) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  place(name, dimensions, x, y, z, rotation = 0, parent = this.scene) {
    const instance = this.assets.instance(name, { ...dimensions, rotation });
    instance.root.position.set(x, y, z);
    parent.add(instance.root);
    return instance.root;
  }

  ring(radius, color, x, z, width = 0.08, y = 0.03, parent = this.scene) {
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
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(200,32,20),new THREE.MeshBasicMaterial({map,side:THREE.BackSide,fog:false,depthWrite:false}));
    this.sky.renderOrder=-2; this.scene.add(this.sky);
  }

  buildArena() {
    const ground = this.mesh(new THREE.PlaneGeometry(60, 60), this.pavingMaterial());
    ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
    const foundation = this.mesh(new THREE.BoxGeometry(64, 2.2, 64), this.mats.earth);
    foundation.position.y = -1.16;
    const land = this.mesh(new THREE.CylinderGeometry(57, 60, 1.4, 64), material('#8d9b79'));
    land.position.y = -2.3;
    const background = this.mesh(new THREE.PlaneGeometry(1000, 1000), material('#c3cfbf'));
    background.rotation.x = -Math.PI / 2; background.position.y = -3.05; background.castShadow = false;

    // Authored stone modules form the same 60 × 60 collision boundary.
    for (const sign of [-1, 1]) {
      for (let p = -28.5; p <= 28.5; p += 3) {
        this.place('wall', { width: 3.03, height: 3, depth: 0.8 }, p, 0, sign * 30.45, Math.PI / 2);
        this.place('wall', { width: 0.8, height: 3, depth: 3.03 }, sign * 30.45, 0, p);
      }
      for (let p = -30; p <= 30; p += 10) {
        this.place('pillar', { width: 1.1, depth: 1.1, height: 3.5 }, p, 0, sign * 30.45);
        this.place('pillar', { width: 1.1, depth: 1.1, height: 3.5 }, sign * 30.45, 0, p);
      }
    }
    for (const o of OBSTACLES) {
      if (o.kind === 'crate') {
        this.place('barrel', { width: o.w, height: o.h, depth: o.d }, o.x, 0, o.z, o.id * 0.37);
        const band = this.ring(o.w * 0.5 + 0.12, '#9b977a', o.x, o.z, 0.035);
        band.material.transparent = true; band.material.opacity = 0.4;
      } else if (o.kind === 'wall') {
        const alongX = o.w > o.d, length = Math.max(o.w, o.d), count = Math.ceil(length / 2.5);
        for (let i = 0; i < count; i++) {
          const offset = -length / 2 + (i + 0.5) * length / count;
          const rock = this.place('rock', { width: alongX ? length / count * 1.03 : o.w, height: o.h * (i % 2 ? 0.88 : 1), depth: alongX ? o.d : length / count * 1.03 },
            o.x + (alongX ? offset : 0), 0, o.z + (alongX ? 0 : offset), i * Math.PI);
          rock.traverse(node => {
            if (!node.isMesh) return;
            node.material = material(i % 2 ? '#97988a' : '#a4a496');
          });
        }
      } else {
        this.place('cart', { width: o.w, depth: o.d, height: o.h * 0.88 }, o.x, 0, o.z, Math.PI / 2);
        for (let i = 0; i < 5; i++) this.place(i % 2 ? 'cabbage' : 'pumpkin', { height: o.h * 0.24 }, o.x + (i - 2) * 0.42, o.h * 0.66, o.z + (i % 2) * 0.28);
      }
    }
    this.ring(7.5, '#dbd2b4', 0, 0, 0.12);
    this.ring(7.8, '#d7d0b5', 0, 0, 0.05);
    for (const base of BASES) this.buildBase(base);
    for (const spawn of PICKUP_SPAWNS) {
      this.place('board', { width: 1.7, height: 0.12, depth: 1.7 }, spawn.x, 0.03, spawn.z);
      this.ring(1.15, '#94b45a', spawn.x, spawn.z, 0.08);
      const bottle = this.poisonModel(); bottle.position.set(spawn.x, 0.9, spawn.z);
      this.scene.add(bottle); this.pickupMeshes.push(bottle);
    }
    this.buildSurroundings();
  }

  buildSurroundings() {
    // Set dressing is outside the playable walls, preserving navigation geometry.
    for (const sign of [-1, 1]) {
      for (const x of [-20, -9, 8, 20]) {
        const z = sign * 36.5, h = 5 + Math.abs(x) % 3;
        this.place('wall', { width: 8, height: h, depth: 5 }, x, -1.7, z, Math.PI / 2);
        this.place('roof', { width: 9, height: 3, depth: 6.2 }, x, h - 1.75, z, Math.PI / 2);
        this.place('window', { width: 1.6, height: 2, depth: 0.24 }, x - 2, 0.4, z - sign * 2.56, Math.PI / 2);
        this.place('window', { width: 1.6, height: 2, depth: 0.24 }, x + 2, 0.4, z - sign * 2.56, Math.PI / 2);
      }
      for (let i = 0; i < 5; i++) {
        const z = -27 + i * 13, x = sign * (34 + i % 2 * 2);
        this.place(i % 2 ? 'roundTree' : 'tree', { height: 8 + i % 3 }, x, -1.6, z, i);
        this.place('hedge', { width: 3.5, height: 1.4, depth: 1.2 }, x - sign * 1.8, -1.3, z + 2, Math.PI / 2);
        this.place('rock', { height: 0.8 }, x + sign * 1.3, -1.4, z + 1.6, i);
      }
      this.place(sign === 1 ? 'greenStall' : 'redStall', { height: 5.5 }, -sign * 25, -1.6, sign * 34.5);
      this.place('cart', { height: 1.8 }, -sign * 32.5, -1.6, sign * 15, 0.6);
      this.place('barrel', { height: 2.1 }, -sign * 33, -1.6, sign * 19, 0.4);
      this.place('bag', { height: 1.3 }, -sign * 33.5, -1.6, sign * 20.5);
    }
    // Ground-hugging leaves add variation without obscuring rats or collision.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.06,0,0, 0.03,0.4,0.025, 0.06,0,0], 3));
    geometry.computeVertexNormals();
    const grass = new THREE.InstancedMesh(geometry, material('#74804e', { side: THREE.DoubleSide }), 240);
    const transform = new THREE.Object3D();
    for (let i = 0; i < 240; i++) {
      const side = Math.floor(i / 60), t = (i % 60) - 29.5, edge = 29.4 + Math.sin(i * 4.3) * 0.3;
      transform.position.set(side < 2 ? t : (side === 2 ? edge : -edge), 0.01, side < 2 ? (side === 0 ? edge : -edge) : t);
      transform.rotation.y = i * 2.4; transform.scale.setScalar(0.7 + (i % 5) * 0.17);
      transform.updateMatrix(); grass.setMatrixAt(i, transform.matrix);
    }
    grass.receiveShadow = true; this.scene.add(grass);
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
    const root = new THREE.Group(); root.name = 'Poison flask';
    const profile = [[0,0],[0.18,0],[0.25,0.04],[0.29,0.15],[0.3,0.35],[0.27,0.49],[0.15,0.58],[0.115,0.66],[0.115,0.8],[0.15,0.81],[0.15,0.86],[0.105,0.87]];
    const glass = new THREE.MeshPhysicalMaterial({ color: '#a4ce67', roughness: 0.14, metalness: 0.05,
      transparent: true, opacity: 0.48, depthWrite: false, transmission: 0.12, thickness: 0.07, clearcoat: 1, side: THREE.DoubleSide });
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
    root.userData.liquid = liquid;
    return root;
  }

  buildBase(base) {
    const pad = this.mesh(new THREE.CircleGeometry(4.95, 96), material(base.color, { transparent: true, opacity: 0.19, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(base.x, 0.015, base.z); pad.castShadow = false;
    const ring = this.ring(5, base.color, base.x, base.z, 0.13);
    this.ring(4.72, '#f2e5b4', base.x, base.z, 0.035);
    this.place('board', { width: 2.9, depth: 2.9, height: 0.13 }, base.x, 0.03, base.z);
    for (const [x,z,y,width,rot] of [[-0.43,0.05,0.16,1.15,-0.4],[0.48,0.05,0.16,1.15,1.6],[0,0,0.64,0.88,0.5]]) {
      const cheese = this.cheeseModel(width); cheese.position.set(base.x+x,y,base.z+z); cheese.rotation.y=rot; this.scene.add(cheese);
    }
    const sign = this.label(base.id===0 ? 'YOUR CHEESE BOARD' : 'RIVAL CHEESE BOARD', base.id===0 ? '#58451a' : '#693726', base.id===0 ? '#f3ce66' : '#eda889');
    sign.position.set(base.x,4.7,base.z); this.scene.add(sign);
    const banner = this.place(base.id===0 ? 'greenBanner' : 'redBanner', { height: 2.5 }, base.x + (base.id===0 ? -4.2 : 4.2), 0, base.z + (base.id===0 ? 4.2 : -4.2), Math.PI/2);
    const particles = new THREE.Group(); particles.position.set(base.x,0,base.z); this.scene.add(particles);
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

  handModel(side) {
    const root = new THREE.Group();
    // Contoured forearm, leather cuff, palm and curved fingers instead of boxes.
    const sleeve = this.mesh(new THREE.CylinderGeometry(0.12,0.155,0.62,20),this.mats.sleeve,root);
    sleeve.rotation.x=Math.PI/2; sleeve.position.set(side*0.018,-0.1,0.25);
    const cuff = this.mesh(new THREE.CylinderGeometry(0.13,0.13,0.09,20),this.mats.leather,root);
    cuff.rotation.x=Math.PI/2; cuff.position.set(0,-0.06,-0.05);
    const palm = this.mesh(new THREE.SphereGeometry(1,24,16),this.mats.skin,root);
    palm.scale.set(0.115,0.063,0.145); palm.position.set(0,-0.035,-0.15);
    for(let i=0;i<4;i++) {
      const x=(i-1.5)*0.048;
      const points=[new THREE.Vector3(x,-0.02,-0.19),new THREE.Vector3(x,-0.025,-0.27),new THREE.Vector3(x,0.023,-0.31),new THREE.Vector3(x,0.055,-0.27)];
      this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),10,0.023,8,false),this.mats.skin,root);
    }
    const thumb=[new THREE.Vector3(-side*0.08,-0.02,-0.1),new THREE.Vector3(-side*0.15,0.015,-0.17),new THREE.Vector3(-side*0.12,0.06,-0.22)];
    this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(thumb),10,0.03,8,false),this.mats.skin,root);
    root.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=false;}});
    return root;
  }

  buildHands() {
    this.rightHand=this.handModel(1); this.rightHand.name='Right hand — cheese'; this.camera.add(this.rightHand);
    this.leftHand=this.handModel(-1); this.leftHand.name='Left hand — poison'; this.camera.add(this.leftHand);
    this.handCheese=this.cheeseWedge(); this.handCheese.position.set(0,0.025,-0.22); this.handCheese.rotation.y=0.55; this.rightHand.add(this.handCheese);
    this.handPoison=this.poisonModel(); this.handPoison.scale.setScalar(0.5); this.handPoison.position.set(0,-0.09,-0.23); this.leftHand.add(this.handPoison);
    for (const hand of [this.rightHand,this.leftHand]) hand.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=false;}});
    this.throwTime=-Infinity; this.lastThrowId=0;
  }

  resize() {
    const {width,height}=this.canvas.parentElement.getBoundingClientRect();
    if(!width||!height)return;
    this.renderer.setSize(width,height,false); this.camera.aspect=width/height; this.camera.updateProjectionMatrix();
  }

  render(state, {preview=false,time=0,alpha=1,previous=null}={}) {
    this.sky.visible=!preview;
    const delta=this.lastTime===null?0:Math.min(0.1,Math.max(0,time-this.lastTime)); this.lastTime=time;
    const lerp=(a,b)=>a+(b-a)*alpha;
    const animationTime=preview?time:state.time;
    const simulationDelta=preview?delta:Math.min(0.1,Math.max(0,state.time-(this.lastSimulationTime??state.time)));
    if(state.time<(this.lastSimulationTime??0)){this.throwTime=-Infinity;this.lastThrowId=0;}
    this.lastSimulationTime=state.time;
    if(preview) {
      const angle=0.68+Math.sin(time*0.04)*0.035, radius=this.camera.aspect<1.1?123:109;
      this.camera.position.set(Math.sin(angle)*radius,75,Math.cos(angle)*radius);
      this.camera.fov=44; this.camera.lookAt(0,-2,0);
      this.rightHand.visible=false; this.leftHand.visible=false;
      this.scene.fog.near=140; this.scene.fog.far=270;
    } else {
      const p=state.players[0],old=previous?.players[0]??p;
      this.camera.position.set(lerp(old.x,p.x),1.65+(p.moving?Math.sin(animationTime*(p.sprinting?17:12))*0.026:0),lerp(old.z,p.z));
      this.camera.rotation.set(p.pitch,p.yaw,0,'YXZ');
      this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,p.sprinting?83:76,0.12);
      this.rightHand.visible=true; this.leftHand.visible=p.poison;
      this.handCheese.visible=true; this.handPoison.visible=p.poison;
      // Keep the two equipment slots visible together, independently of ownership.
      const bob=p.moving?Math.sin(animationTime*10)*0.012:Math.sin(animationTime*2)*0.004;
      this.rightHand.position.set(0.48,-0.41+bob,-0.88); this.rightHand.rotation.set(0.02,0.08,p.sprinting?-0.1:0.035);
      this.leftHand.position.set(-0.46,-0.37-bob,-0.88); this.leftHand.rotation.set(0.04,-0.15,-0.07);
      const thrown=state.events.findLast(e=>e.type==='throw'&&e.playerId===0);
      if(thrown&&thrown.id!==this.lastThrowId){this.lastThrowId=thrown.id;this.throwTime=state.time;}
      const age=state.time-this.throwTime;
      if(age>=0&&age<0.35&&!p.poison){this.leftHand.visible=true;this.leftHand.rotation.x=-Math.sin(age/0.35*Math.PI)*0.9;this.leftHand.position.z-=Math.sin(age/0.35*Math.PI)*0.13;}
      this.canvas.dataset.cheeseHand='right'; this.canvas.dataset.poisonHand=p.poison?'left':'empty';
      this.scene.fog.near=65; this.scene.fog.far=150;
    }
    this.camera.updateProjectionMatrix();
    state.rats.forEach((rat,i)=>{
      const actor=this.rats[i],old=previous?.rats[i]??rat;
      actor.root.position.set(lerp(old.x,rat.x),0.015,lerp(old.z,rat.z));
      const desired=rat.yaw;
      actor.root.rotation.y+=Math.atan2(Math.sin(desired-actor.root.rotation.y),Math.cos(desired-actor.root.rotation.y))*Math.min(1,delta*12);
      const mode=rat.eating?'eat':rat.fleeUntil>state.time?'run':rat.moving?'walk':'idle';
      actor.animator.update(mode,simulationDelta,animationTime,i*0.23);
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
    this.bot.position.set(lerp(old.x,bot.x),0,lerp(old.z,bot.z)); this.bot.rotation.y=bot.yaw;
    this.botAnimator.update(bot.moving?(bot.sprinting?'run':'walk'):'idle',simulationDelta,animationTime);
    this.previewPlayer.visible=preview;
    this.previewPlayer.position.set(state.players[0].x,0,state.players[0].z); this.previewPlayer.rotation.y=state.players[0].yaw;
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
      model.position.y=0.78+Math.sin(animationTime*2+i)*0.12; model.rotation.y=animationTime*0.6;
    });
    const ids=new Set(state.projectiles.map(p=>p.id));
    for(const[id,model]of this.projectileMeshes)if(!ids.has(id)){
      this.scene.remove(model);
      // Each flask owns its geometry and custom materials. Shared hand materials
      // belong to the renderer and remain alive for the next match.
      model.traverse(node=>{if(node.isMesh){node.geometry.dispose();if(!Object.values(this.mats).includes(node.material)){node.material.map?.dispose();node.material.dispose();}}});
      this.projectileMeshes.delete(id);
    }
    for(const p of state.projectiles){
      let model=this.projectileMeshes.get(p.id);
      if(!model){model=this.poisonModel();model.scale.setScalar(0.65);this.projectileMeshes.set(p.id,model);this.scene.add(model);}
      model.position.set(p.x,p.y,p.z); model.rotation.z=animationTime*6;
    }
    this.renderer.render(this.scene,this.camera);
  }
}
