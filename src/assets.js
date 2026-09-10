import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// Local authored assets, loaded once and instanced with shared geometry/textures.
// Provenance and original licenses live beside the models in assets/.
export const MODEL_FILES = {
  rat: 'characters/rat.glb', adventurer: 'characters/adventurer.glb',
  cheese: 'food/cheese.glb', barrel: 'food/barrel.glb', board: 'food/cutting-board-round.glb',
  bread: 'food/bread.glb', apple: 'food/apple.glb', bag: 'food/bag.glb', pumpkin: 'food/pumpkin.glb',
  cabbage: 'food/cabbage.glb', carrot: 'food/carrot.glb',
  cart: 'town/cart.glb', wall: 'town/wall.glb', brokenWall: 'town/wall-broken.glb',
  pillar: 'town/pillar-stone.glb', lantern: 'town/lantern.glb', tree: 'town/tree.glb',
  roundTree: 'town/tree-high-round.glb', rock: 'town/rock-large.glb', smallRock: 'town/rock-small.glb',
  redStall: 'town/stall-red.glb', greenStall: 'town/stall-green.glb', hedge: 'town/hedge.glb',
  fence: 'town/fence.glb', window: 'town/wall-window-shutters.glb', roof: 'town/roof-gable.glb',
  arch: 'town/wall-arch-top.glb', woodWall: 'town/wall-wood.glb', chimney: 'town/chimney.glb', timber: 'town/wall-wood-detail-cross.glb',
  doorway: 'town/wall-doorway-round.glb', redBanner: 'town/banner-red.glb', greenBanner: 'town/banner-green.glb',
};

export class AssetLibrary {
  constructor(models) { this.models = models; }

  static async load(onProgress = () => {}) {
    const loader = new GLTFLoader(), models = new Map();
    let loaded = 0;
    await Promise.all(Object.entries(MODEL_FILES).map(async ([name, file]) => {
      const model = await loader.loadAsync(new URL(`../assets/models/${file}`, import.meta.url).href);
      model.scene.traverse(node => {
        if (!node.isMesh) return;
        node.castShadow = true; node.receiveShadow = true;
        if (node.isSkinnedMesh) node.frustumCulled = false;
        for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
          mat.roughness = /eye|gold/i.test(mat.name) ? 0.35 : 0.83;
          mat.metalness = /gold/i.test(mat.name) ? 0.65 : 0;
          if (mat.map) mat.map.anisotropy = 8;
        }
      });
      models.set(name, model);
      onProgress(++loaded, Object.keys(MODEL_FILES).length);
    }));
    return new AssetLibrary(models);
  }

  instance(name, { height, width, depth, rotation = 0, tint = null } = {}) {
    const asset = this.models.get(name);
    if (!asset) throw new Error(`Missing model: ${name}`);
    const model = clone(asset.scene);
    const turn = new THREE.Group(); turn.add(model); turn.rotation.y = rotation;
    turn.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(turn);
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    const normalized = new THREE.Group(); normalized.add(turn);
    turn.position.set(-center.x, -bounds.min.y, -center.z);
    const uniform = height ? height / size.y : width ? width / size.x : depth ? depth / size.z : 1;
    normalized.scale.set(width ? width / size.x : uniform, height ? height / size.y : uniform, depth ? depth / size.z : uniform);
    const root = new THREE.Group(); root.name = `model:${name}`; root.add(normalized);
    if (tint) model.traverse(node => {
      if (!node.isMesh) return;
      const recolor = mat => { const next = mat.clone(); if (/Green|LightGreen/.test(mat.name)) next.color.set(tint); return next; };
      node.material = Array.isArray(node.material) ? node.material.map(recolor) : recolor(node.material);
    });
    root.userData.source = MODEL_FILES[name];
    // Animation targets remain below the normalizing transforms.
    return { root, model, clips: asset.animations, dimensions: size.multiply(normalized.scale) };
  }
}

export class ModelAnimator {
  constructor(instance) {
    this.model = instance.model;
    this.mixer = new THREE.AnimationMixer(instance.model);
    this.actions = new Map(); this.active = null;
    for (const clip of instance.clips) {
      const key = clip.name.split('|').at(-1).replace(/^Rat_/, '').toLowerCase();
      this.actions.set(key, this.mixer.clipAction(clip));
    }
    this.head = instance.model.getObjectByName('Head');
    this.headRest = this.head?.quaternion.clone();
  }

  update(mode, delta, time, phase = 0) {
    const key = mode === 'eat' ? 'idle' : mode;
    const action = this.actions.get(key) ?? this.actions.get('idle');
    if (action && action !== this.active) {
      this.active?.fadeOut(0.18);
      action.reset().fadeIn(0.18).play();
      action.time = phase % Math.max(0.01, action.getClip().duration);
      this.active = action;
    }
    if (this.head) this.head.quaternion.copy(this.headRest);
    this.mixer.update(delta);
    if (mode === 'eat' && this.head) {
      // Layer a nibbling motion over the authored idle skeleton.
      this.head.rotateX(0.13 + Math.sin(time * 13 + phase) * 0.08);
      this.head.rotateZ(Math.sin(time * 7 + phase) * 0.025);
    }
  }
}
