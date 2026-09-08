import { ARENA, BASES, PICKUP_SPAWNS, OBSTACLES, clamp, distance, moveBody, isFree, findPath, clearPath } from './map.js';

export const FIXED_DT = 1 / 60;
export const RULES = Object.freeze({ duration: 180, ratCount: 10, walkSpeed: 5.2, sprintSpeed: 8.3, ratSpeed: 4.4, attractRadius: 12, baseCheese: 40, cheeseDecay: 2, poisonDuration: 15, fleeDuration: 3, pickupRespawn: 20 });

export function random(state) {
  let v = state.rng;
  v ^= v << 13; v ^= v >>> 17; v ^= v << 5;
  state.rng = v >>> 0;
  return state.rng / 4294967296;
}
export function emit(state, type, data = {}) {
  state.events.push({ id: ++state.eventSequence, time: state.time, type, ...data });
  if (state.events.length > 40) state.events.shift();
}

/** Plain JSON data only. Restore with JSON.parse; no Three.js or DOM dependency.
 * `controllers` can be ['human', 'human'] on a future authoritative server.
 * Commands are keyed by player ID; stepGame is the sole state transition.
 */
export function createGameState(seed = 12345, { controllers = ['human', 'bot'] } = {}) {
  const state = {
    version: 2, rng: (seed >>> 0) || 1, tick: 0, time: 0, phase: 'lobby',
    countdown: 3, remaining: RULES.duration, winner: null,
    players: BASES.map((b, id) => ({
      id, controller: controllers[id], x: b.x, z: b.z, yaw: id === 0 ? -Math.PI / 4 : Math.PI * 0.75,
      pitch: 0, cheese: 100, poison: false, refillProgress: 0, followers: 0, moving: false, sprinting: false,
      bot: { mode: 'LURE', nextDecision: 0.8, target: null, path: [], nextPath: 0, waitSince: null },
    })),
    bases: BASES.map(b => ({ ...b, poisonedUntil: 0, count: 0 })),
    rats: [], pickups: PICKUP_SPAWNS.map((p, id) => ({ ...p, id, availableAt: 0 })),
    projectiles: [], nextProjectileId: 0, events: [], eventSequence: 0,
  };
  for (let i = 0; i < RULES.ratCount; i++) {
    const angle = i / RULES.ratCount * Math.PI * 2, radius = 2.5 + random(state) * 3.5;
    state.rats.push({ id: i, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, yaw: angle,
      target: null, capturedBy: null, nextEvaluate: i * 0.02, nextWander: 0, wander: null,
      fleeUntil: 0, fleeDirection: { x: 0, z: 0 }, path: [], nextPath: 0, moving: false, eating: false });
  }
  return state;
}

export function startMatch(state) { state.phase = 'countdown'; state.countdown = 3; }
export function attractorScore(rat, attractor) {
  const d = distance(rat, attractor);
  return d > RULES.attractRadius ? 0 : attractor.cheese / Math.max(0.001, d);
}
function getAttractors(state) {
  return [
    ...state.players.map(p => ({ x: p.x, z: p.z, cheese: p.cheese, key: `player:${p.id}` })),
    ...state.bases.map(b => ({ x: b.x, z: b.z, cheese: b.poisonedUntil > state.time ? 0 : RULES.baseCheese, key: `base:${b.id}` })),
  ];
}
function chooseRatTarget(state, rat, attractors) {
  if (rat.capturedBy !== null && state.bases[rat.capturedBy].poisonedUntil <= state.time) {
    rat.target = `base:${rat.capturedBy}`;
    rat.nextEvaluate = state.time + 0.2;
    return;
  }
  let best = null, score = 0;
  for (const attractor of attractors) {
    const candidate = attractorScore(rat, attractor);
    if (candidate > score) { score = candidate; best = attractor.key; }
  }
  if (best !== rat.target) { rat.path = []; rat.nextPath = 0; }
  rat.target = best;
  rat.nextEvaluate = state.time + 0.2;
}
function routeDirection(state, body, target, radius, interval = 0.65) {
  if (clearPath(body, target, radius)) {
    body.path = [];
    const d = distance(body, target);
    return d > 0.01 ? { x: (target.x - body.x) / d, z: (target.z - body.z) / d } : { x: 0, z: 0 };
  }
  if (state.time >= body.nextPath || !body.path.length) {
    body.path = findPath(body, target, radius); body.nextPath = state.time + interval;
  }
  while (body.path.length && distance(body, body.path[0]) < 0.55) body.path.shift();
  const point = body.path[0];
  if (!point) return { x: 0, z: 0 };
  const d = distance(body, point);
  return { x: (point.x - body.x) / d, z: (point.z - body.z) / d };
}
function updateRats(state, dt) {
  const attractors = getAttractors(state);
  for (const rat of state.rats) {
    let dir = { x: 0, z: 0 }, speed = RULES.ratSpeed;
    rat.eating = false;
    if (rat.fleeUntil > state.time) {
      dir = rat.fleeDirection; speed *= 1.4; rat.target = null;
    } else {
      if (state.time + 1e-8 >= rat.nextEvaluate) chooseRatTarget(state, rat, attractors);
      let target = attractors.find(a => a.key === rat.target);
      const home = rat.capturedBy === null ? null : state.bases[rat.capturedBy];
      if (home && home.poisonedUntil <= state.time) {
        // Each resident has a place around the endless cheese board. Hand cheese
        // is ignored until poison explicitly releases ownership.
        rat.target = `base:${home.id}`;
        const angle = rat.id / RULES.ratCount * Math.PI * 2;
        target = { x: home.x + Math.sin(angle) * 1.85, z: home.z + Math.cos(angle) * 1.85 };
        rat.eating = distance(rat, target) <= 0.16;
        if (rat.eating) rat.yaw = Math.atan2(home.x - rat.x, home.z - rat.z);
      }
      if (!target) {
        if (!rat.wander || state.time >= rat.nextWander || distance(rat, rat.wander) < 0.5) {
          const angle = random(state) * Math.PI * 2, length = 2 + random(state) * 4;
          const x = clamp(rat.x + Math.cos(angle) * length, -28, 28), z = clamp(rat.z + Math.sin(angle) * length, -28, 28);
          rat.wander = isFree(x, z, 0.3) ? { x, z } : { x: rat.x, z: rat.z };
          rat.nextWander = state.time + 2 + random(state) * 3;
        }
        target = rat.wander; speed = 1.3;
      }
      const stoppingDistance = home ? 0.1 : rat.target?.startsWith('player:') ? 1.05 : 0.5;
      if (target && distance(rat, target) > stoppingDistance) {
        dir = routeDirection(state, rat, target, 0.3);
        speed = Math.min(speed, Math.max(0, distance(rat, target) - stoppingDistance) / dt);
      }
    }
    let dx = dir.x * speed, dz = dir.z * speed;
    // Mild separation prevents ten rats from rendering as one box.
    for (const other of state.rats) if (other.id !== rat.id) {
      const d = distance(rat, other);
      if (d > 0.001 && d < 0.72) { dx += (rat.x - other.x) / d * (0.72 - d) * 3; dz += (rat.z - other.z) / d * (0.72 - d) * 3; }
    }
    rat.moving = Math.hypot(dx, dz) > 0.2;
    if (rat.moving) rat.yaw = Math.atan2(dx, dz);
    moveBody(rat, dx * dt, dz * dt, 0.28);
  }
}

export function poisonBase(state, baseId) {
  const base = state.bases[baseId];
  base.poisonedUntil = state.time + RULES.poisonDuration;
  base.count = 0;
  for (const rat of state.rats) if (rat.capturedBy === baseId || distance(rat, base) <= ARENA.baseRadius) {
    const outward = Math.atan2(rat.z - base.z, rat.x - base.x);
    let angle = outward + (random(state) - 0.5) * 1.8;
    // Corner bases: select an outward escape that remains inside the arena.
    for (let i = 0; i < 8; i++) {
      if (isFree(rat.x + Math.cos(angle) * 8, rat.z + Math.sin(angle) * 8, 0.3)) break;
      angle = outward + (random(state) - 0.5) * Math.PI;
    }
    rat.fleeUntil = state.time + RULES.fleeDuration;
    rat.fleeDirection = { x: Math.cos(angle), z: Math.sin(angle) };
    rat.capturedBy = null; rat.eating = false;
    rat.target = null; rat.nextEvaluate = rat.fleeUntil; rat.path = [];
  }
  emit(state, 'poison', { baseId });
}
function throwPoison(state, player) {
  if (!player.poison) return;
  player.poison = false;
  const elevation = clamp(player.pitch + 0.4, -0.8, 1.25), speed = 14;
  state.projectiles.push({ id: state.nextProjectileId++, owner: player.id,
    x: player.x - Math.sin(player.yaw) * 0.7 - Math.cos(player.yaw) * 0.3,
    y: 1.4, z: player.z - Math.cos(player.yaw) * 0.7 + Math.sin(player.yaw) * 0.3,
    vx: -Math.sin(player.yaw) * Math.cos(elevation) * speed,
    vy: Math.sin(elevation) * speed, vz: -Math.cos(player.yaw) * Math.cos(elevation) * speed,
  });
  emit(state, 'throw', { playerId: player.id });
}
function updateProjectiles(state, dt) {
  state.projectiles = state.projectiles.filter(p => {
    // Swept substeps keep fast throws from passing through thin cover.
    const steps = 3, sub = dt / steps;
    for (let i = 0; i < steps; i++) {
      p.vy -= 14 * sub; p.x += p.vx * sub; p.y += p.vy * sub; p.z += p.vz * sub;
      const hit = p.y <= 0.2 || Math.abs(p.x) >= 29.8 || Math.abs(p.z) >= 29.8 || OBSTACLES.some(o =>
        p.y <= o.h + 0.2 && Math.abs(p.x - o.x) <= o.w / 2 + 0.2 && Math.abs(p.z - o.z) <= o.d / 2 + 0.2);
      if (hit) {
        const base = state.bases.find(b => distance(p, b) <= ARENA.poisonRadius);
        if (base) poisonBase(state, base.id);
        else emit(state, 'miss', { x: p.x, z: p.z, playerId: p.owner });
        return false;
      }
    }
    return true;
  });
}

function nearestRatCluster(state, player) {
  const rats = state.rats.filter(r => r.capturedBy === null && r.fleeUntil <= state.time);
  let best = null, bestScore = -Infinity;
  for (const rat of rats) {
    const neighbors = rats.filter(r => distance(r, rat) < 6);
    const score = neighbors.length * 2 - distance(player, rat) * 0.45 + random(state) * 1.1;
    if (score > bestScore) {
      bestScore = score;
      best = { x: neighbors.reduce((n, r) => n + r.x, 0) / neighbors.length, z: neighbors.reduce((n, r) => n + r.z, 0) / neighbors.length };
    }
  }
  return best;
}
export function botCommand(state, player) {
  const ai = player.bot, home = state.bases[player.id], enemy = state.bases[1 - player.id];
  const followers = state.rats.filter(r => r.target === `player:${player.id}`);
  let throwNow = false;
  if (state.time >= ai.nextDecision) {
    ai.nextDecision = state.time + 0.45 + random(state) * 0.45;
    const pickup = state.pickups.filter(p => p.availableAt <= state.time && distance(player, p) < 10).sort((a,b) => distance(player,a) - distance(player,b))[0];
    if (player.cheese < 30 || (ai.mode === 'REFILL' && player.cheese < 99)) {
      ai.mode = 'REFILL'; ai.target = { x: home.x, z: home.z };
    } else if (player.poison && enemy.count >= 3 && enemy.poisonedUntil <= state.time) {
      ai.mode = 'INTERRUPT';
      const d = distance(player, enemy), vx = (player.x - enemy.x) / Math.max(d, 0.01), vz = (player.z - enemy.z) / Math.max(d, 0.01);
      ai.target = { x: enemy.x + vx * 11, z: enemy.z + vz * 11 };
      if (d >= 8 && d <= 12.5 && clearPath(player, enemy, 0.2)) {
        player.yaw = Math.atan2(-(enemy.x - player.x), -(enemy.z - player.z));
        player.pitch = -0.05 + (random(state) - 0.5) * 0.06;
        throwNow = true;
      } else if (d < 8) ai.target = { x: enemy.x + vx * 10, z: enemy.z + vz * 10 };
    } else if (!player.poison && pickup) {
      ai.mode = 'INTERRUPT'; ai.target = { x: pickup.x, z: pickup.z };
    } else if (!player.poison && !state.rats.some(r => r.capturedBy === null) && enemy.count >= 3) {
      // Once every rat is secured, poison is the only way to contest a base.
      const nextPickup = state.pickups.slice().sort((a,b) =>
        (Math.max(0,a.availableAt-state.time)*3 + distance(player,a)) -
        (Math.max(0,b.availableAt-state.time)*3 + distance(player,b)))[0];
      ai.mode = 'INTERRUPT'; ai.target = { x: nextPickup.x, z: nextPickup.z };
    } else if (ai.mode === 'RETURN' || followers.length >= 2) {
      ai.mode = 'RETURN'; ai.target = { x: home.x, z: home.z };
      if (distance(player, home) < 0.8) {
        ai.waitSince ??= state.time;
        if (state.time - ai.waitSince > 3.5 || followers.length === 0) {
          ai.mode = 'LURE'; ai.waitSince = null;
          ai.target = nearestRatCluster(state, player) ?? { x: 0, z: 0 };
        }
      } else ai.waitSince = null;
    } else {
      ai.mode = 'LURE'; ai.waitSince = null;
      ai.target = nearestRatCluster(state, player) ?? { x: 0, z: 0 };
    }
  }
  const target = ai.target;
  if (!target || throwNow) return { moveX: 0, moveZ: 0, yaw: player.yaw, pitch: player.pitch, throw: throwNow };
  // Give free rats time to gather before returning to the cheese board.
  const stop = ai.mode === 'LURE' ? 2.4 : ai.mode === 'REFILL' || ai.mode === 'RETURN' ? 0.5 : 0.7;
  if (distance(player, target) < stop) return { yaw: player.yaw };
  const nav = { x: player.x, z: player.z, path: ai.path, nextPath: ai.nextPath };
  const dir = routeDirection(state, nav, target, 0.55, 0.9);
  ai.path = nav.path; ai.nextPath = nav.nextPath;
  return { moveX: dir.x * 0.91, moveZ: dir.z * 0.91, yaw: Math.atan2(-dir.x, -dir.z), pitch: 0, sprint: false };
}

function updatePlayers(state, commands, dt) {
  for (const p of state.players) {
    const input = p.controller === 'bot' ? botCommand(state, p) : (commands[p.id] ?? {});
    const finite = v => Number.isFinite(v) ? v : 0;
    if (Number.isFinite(input.yaw)) p.yaw = input.yaw;
    if (Number.isFinite(input.pitch)) p.pitch = clamp(input.pitch, -1.35, 1.35);
    let x = clamp(finite(input.moveX), -1, 1), z = clamp(finite(input.moveZ), -1, 1);
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    p.moving = length > 0.01; p.sprinting = Boolean(input.sprint) && p.moving;
    const speed = p.sprinting ? RULES.sprintSpeed : RULES.walkSpeed;
    moveBody(p, x * speed * dt, z * speed * dt, 0.45);
    p.followers = state.rats.filter(r => r.target === `player:${p.id}` && r.fleeUntil <= state.time).length;
    p.cheese = Math.max(0, p.cheese - p.followers * RULES.cheeseDecay * dt);
    if (distance(p, state.bases[p.id]) <= ARENA.baseRadius) {
      p.refillProgress += dt;
      if (p.refillProgress + 1e-8 >= 1) {
        if (p.cheese < 99) emit(state, 'refill', { playerId: p.id });
        p.cheese = 100; p.refillProgress = 0;
      }
    } else p.refillProgress = 0;
    for (const pickup of state.pickups) if (!p.poison && pickup.availableAt <= state.time && distance(p, pickup) < 1.25) {
      p.poison = true; pickup.availableAt = state.time + RULES.pickupRespawn;
      emit(state, 'pickup', { playerId: p.id });
    }
    if (input.throw) throwPoison(state, p);
  }
}
function updateCaptures(state) {
  for (const b of state.bases) b.count = 0;
  const captures = [];
  for (const rat of state.rats) {
    const secured = rat.capturedBy === null ? null : state.bases[rat.capturedBy];
    const base = secured && secured.poisonedUntil <= state.time ? secured :
      rat.fleeUntil > state.time ? null : state.bases.find(b => b.poisonedUntil <= state.time && distance(rat, b) <= ARENA.baseRadius);
    const next = base?.id ?? null;
    if (next !== null && rat.capturedBy !== next) {
      captures.push(next); emit(state, 'capture', { baseId: next, ratId: rat.id });
    }
    rat.capturedBy = next;
    if (base) { base.count++; rat.target = `base:${base.id}`; }
  }
  for (const player of state.players) player.followers = state.rats.filter(r => r.target === `player:${player.id}` && r.capturedBy === null && r.fleeUntil <= state.time).length;
  // Existing rats at the buzzer do not trigger sudden death. Only new entries do.
  // Simultaneous opposing entries in one tick are a draw for that tick.
  if (state.phase === 'sudden-death' && captures.length && captures.every(id => id === captures[0])) finish(state, captures[0]);
}
function finish(state, winner) {
  state.winner = winner; state.phase = 'ended'; emit(state, 'end', { winner });
}

export function stepGame(state, commands = {}, dt = FIXED_DT) {
  if (state.phase === 'lobby' || state.phase === 'ended') return;
  state.tick++;
  if (state.phase === 'countdown') {
    state.countdown = Math.max(0, state.countdown - dt);
    if (state.countdown < 1e-8) { state.phase = 'playing'; emit(state, 'start'); }
    return;
  }
  state.time += dt;
  updatePlayers(state, commands, dt);
  updateProjectiles(state, dt);
  updateRats(state, dt);
  updateCaptures(state);
  if (state.phase === 'playing') {
    state.remaining = Math.max(0, state.remaining - dt);
    if (state.remaining < 1e-8) {
      state.remaining = 0;
      const [a,b] = state.bases.map(base => base.count);
      if (a === b) { state.phase = 'sudden-death'; emit(state, 'sudden-death'); }
      else finish(state, a > b ? 0 : 1);
    }
  }
}
