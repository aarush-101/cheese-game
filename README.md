# Rat Race

A first-person, single-player cheese heist built with Three.js. Ten roaming rats,
two opposing base districts, a mildly devious bot, and three minutes to bring the most rats home.
Choose between three original arenas with enterable buildings and connected stories.

## Run

From this directory:

```sh
python3 -m http.server 5173
```

Open **http://localhost:5173** in a desktop browser. `npm start` runs the same command.
There is no build step and no package installation is needed to play. Any static
web server works. Use HTTP rather than opening `index.html` as a `file://` URL.

Three.js is pinned to `0.180.0` and loaded from jsDelivr using an import map, following
the [Three.js static installation approach](https://threejs.org/manual/en/installation.html).
Local JavaScript modules and CSS use a shared release version in `index.html` to
prevent new HTML from loading older cached game code. Bump those versioned URLs
together when releasing changes.
An internet connection is needed for the Three.js module. Google Fonts is optional; system
fonts are used if it is unavailable. Authored GLB models and their texture atlases are included in `assets/models/`, so
playing does not depend on asset-hosting services. See [asset credits](assets/CREDITS.md).
The rat, opponent, and first-person arms use skeletal animations; the rats also nibble
when eating. The included arm rig has 16 action clips. Architecture, materials,
the flask, cheese depletion, icons, and sound effects are authored in local code.

## Play

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| Shift | Sprint (hold by default; toggle available in Settings) |
| Space | Jump / jump off a ladder |
| W / S at a ladder | Climb up / down |
| Left click | Throw held poison in a ballistic arc |
| Escape | Release the mouse and pause this single-player match |

Use **Choose your map** directly above the yellow start button to select an arena.
The larger map cards below the preview stay in sync with that selector.
Click **Enter the rat race** to capture the mouse and start the countdown. Mouse and
keyboard are required; the lobby responds to narrow screens, but touch gameplay is
not implemented. The lobby includes instructions, mouse sensitivity, sound settings,
an expandable live arena preview, and a player-height tour. Settings include sprint
toggle, reduced camera motion, graphics quality, and 60–100% render resolution.
Settings and the selected arena persist on the device.

### Arenas

| Map | Size | Traversal |
| --- | --- | --- |
| Old Town | 240 × 200 | Street grid, multistory apartments, internal stairs, roof bridges, −4m cellar, 20m rooftops |
| Cheese Foundry | 280 × 220 | Six-story industrial hall, ring galleries, silos, gantries, 25m maintenance routes |
| Canopy Citadel | 260 × 260 | Wooded fortress, −8m ravine, crypt, cliff terraces, offset bridges, 28m upper keep |

The footprints are approximately 2.6–3.3 times their preceding versions. Their layouts
are independently designed: a town grid, stacked industrial loops, and a fortress
around a ravine. Each has two base districts, three poison spawns, and ten rats near
the center. Bases stay close enough to the foraging district for the cheese budget;
outer and upper routes provide exploration and poison approaches. All poison
objectives have stair/ramp access for rats and the bot.
Face a ladder and hold W to ascend; use S near its upper landing to descend. Space
jumps off a ladder or ledge. There is no fall damage. Rats and the bot use ramps,
so take the longer route when herding. The minimap shows decks, ramps, ladders,
and cyan rats when they are more than two units above you. The HUD shows altitude.

Map layouts are original; Shell Shockers’ connected floors, alternative approaches,
and upper-level cover informed the traversal design.

Open the [interactive floor-plan atlas](docs/map-atlas.html) through the local server
to inspect each level and its connectors. The separate
[Movement Lab](http://localhost:5173/?practice=1) has stairs, a low ceiling, a ladder,
and jump gaps for testing controls.

Walking is 6.8 units/sec and sprinting is 11.5. Horizontal velocity continues through
takeoff, with bounded air steering, 80ms coyote time, and 100ms jump buffering.
Diagonal commands are normalized as a vector, and the camera interpolates all
three axes together, preventing the old backward shift when running and jumping.

- Free rats reevaluate both hands and both base stacks every 0.2 seconds. Attraction is
  `cheese / 3D distance`, with a 12-unit cutoff and a 0.001-unit guard at exact overlap.
  Bases provide 40 cheese, hands hold up to 100, and each follower eats 2 per second.
- Stand inside your own 5-unit base radius for a continuous second to refill.
- Once a rat enters a healthy base, it stays there and eats the unlimited base
  cheese. It ignores both players, does not drain hand cheese, and cannot be lured
  away. Poison releases every resident; poisoned bases cannot capture rats until
  the 15-second effect expires. After fleeing for 3 seconds, rats can be lured again.
- Cheese stays in your right hand. Walk over a green pickup to carry poison in
  your left hand at the same time. Throwing never removes your cheese. Aim level from roughly
  10–12 units away and throw toward a base. Landing within 4 units of its center
  disables the stack for 15 seconds and makes resident rats flee for 3 seconds.
  A miss is consumed without affecting a base. Pickups return 20 seconds after collection.
- The most rats physically inside a base at 0:00 wins. A tie enters sudden death;
  a **new entry** into a base wins. Existing residents do not count as new captures.
  Opposing entries on the same simulation tick keep sudden death running.
- Losing pointer lock, switching tabs, or leaving the browser pauses the local
  match, including poison and pickup timers. Resume requires another click.

## Structure

```text
index.html             Lobby, HUD, dialogs, import map
style.css              Responsive visual presentation
src/maps.js            Arena catalog (stable IDs retained for saved selections)
src/maps/              Independent layouts, shared architectural kit, Movement Lab
src/map.js             Spatial collision, terrain holes, vertical support, gravity
src/movement.js        Velocity, sprint, jump buffering, coyote time, ladders
src/navigation.js      Cached floor/sector graph and local A* paths
src/simulation.js      Rules, seeded randomness, rat AI, bot AI, projectiles, match state
src/actions.js         Shared authoritative throw timing and launch offsets
src/input.js           Browser events → plain player command packets
src/renderer.js        Three.js scene; reads state and interpolates transforms
src/presentation.js    Common transform interpolation and pause-aware visual clock
src/viewmodel.js       Separate first-person scene, arm clips, grip and item actions
src/architecture.js    Sector-batched architecture, stairs, trim, and themed materials
src/assets.js          Local GLB loading, shared instances, skeletal animation
assets/models/         Rat, opponent, arms, food, and environment models with textures
src/ui.js              HUD, minimap, notifications, and match screens
src/audio.js           Optional Web Audio feedback
src/main.js            Client lifecycle and fixed 60 Hz accumulator
tests/                 Rules, replay, navigation, traversal, and movement regressions
scripts/               Optional browser QA and reproducible arm-rig authoring
```

The simulation imports **no DOM, Three.js, browser input, clocks, or audio**. The
renderer never writes to simulation state. Static map/navigation data is shared;
every evolving AI timer, path, random seed, pending action, and projectile is stored in GameState.
The client interpolates positions between steps and caps the catch-up backlog after
long frames to keep the browser responsive. Pausing is a local client concern.

## Future network mode

The same simulation can run in Node on an authoritative server:

```js
import { createGameState, startMatch, stepGame, FIXED_DT } from './src/simulation.js';

const state = createGameState(1234, { controllers: ['human', 'human'], mapId: 'gouda-aqueduct' });
startMatch(state);

// Invoke once per authoritative 60 Hz tick. Commands are keyed by player ID.
stepGame(state, {
  0: { moveX: 1, moveZ: 0, yaw: -Math.PI / 2, pitch: 0, sprint: false, jump: false, climb: 0, throw: false },
  1: { moveX: 0, moveZ: -1, yaw: 0, pitch: 0, sprint: false, jump: false, climb: 0, throw: false },
}, FIXED_DT);

const wireSnapshot = JSON.stringify(state);
const restoredState = JSON.parse(wireSnapshot);
stepGame(restoredState, {});
```

Movement commands use world X/Z axes and are normalized together by the simulation.
`throw` and `jump` are one-tick actions. `climb` is a held value from -1 to 1.
Schema version 4 snapshots include `mapId`, player/rat `y`, `vy`, and `grounded`, plus
player `vx`, `vz`, traversal state, `ladderId`, reattachment cooldown, and pending throw.
A throw reserves the bottle, then consumes it and spawns one projectile at its fixed
release tick (0.18 seconds into a 0.56-second action). Rendering never supplies a
bone transform to the simulation. The server and clients must use the same
map catalog version. Navigation caches contain only map-derived data and are keyed
by immutable map object; different maps can run concurrently without a global active-map switch. The server must authenticate player IDs, sequence input
packets, and own tick timing. Transport, lobbies, reconciliation, and prediction are
not implemented. The browser currently renders from player 0's perspective; a
network client will need to choose its local player ID when applying snapshots.

For inspection in the browser console:

```js
window.GameState         // The current plain state object (also available during play).
window.RatRace.snapshot() // A detached, serializable copy.
window.RatRace.diagnostics // Draw calls, triangles, resource counts, camera and quality.
```

## Validate

Requires Node.js 20 or newer, with no test dependencies:

```sh
npm test
```

The 43 tests cover deterministic snapshot replay, countdown and match timing, attraction
and secured feeding, cheese decay/refill, collision and navigation, pickups, ballistic
hits/misses, left-hand throws, poison release and recapture, sudden death, full bot matches, and
independent human command slots, distinct map layouts, every stair flight, all ladder endpoints,
falls and jumps, elevated pickups, deck impacts, and independent multi-map snapshot
replay. Diagonal takeoff and interpolation are checked at 30/60/120/144 FPS, alongside
sprint speed, continuous ladder exits, and exactly-once throw release after restoring
JSON. `rat.eating` and latched `capturedBy` behavior are retained.

Optional browser QA requires Playwright and a running local server:

```sh
node scripts/browser-smoke.mjs
```

The script checks all three maps, pause during throw, depletion/refill, rematches,
settings, the Movement Lab, and the atlas. It writes captures and a report under
`docs/research/release/`. Set `PLAYWRIGHT_MODULE` to an installed Playwright module
path and/or `CHROME_PATH` to a Chrome executable when needed. These tools are not
runtime dependencies. [Implementation and measured limits](docs/IMPLEMENTATION.md)
records the release checks; headless samples are not a reference-laptop GPU benchmark.

## Adding a map

Add a layout factory under `src/maps/` and register it in `src/maps.js`. The lobby generates its card and live
preview automatically. Coordinates use X/Z horizontally and Y up, with units in
meters. `platforms` are solid slabs (`y` is the underside); `ramps` are solid wedges
with `low`, `high`, `axis`, and `direction`. Keep ramps gentle (at most 1:3), at least
5 units wide, and connect their ends exactly to walkable decks. All AI routes need
ramp access; ladders are player shortcuts. Ladders define bottom/top heights, an
outward normal, and a safe top exit point. Keep exits clear of pillars and cover.

All solid set pieces belong in shared obstacle data so visual placement and
collision agree. Use `holes` for lower terrain; never place a basement under an
unbroken ground plane. The shared kit builds real wall openings and connected
stairs. Repeated static parts are instanced or merged within visibility sectors.
The chosen map loads first, shaders prewarm before the countdown, and at most two
map scenes remain cached. Animated characters and hands are reused.
The selected map changes only in the lobby; a rematch keeps the same arena.

`scripts/author-hands.js` contains the original arm mesh, skeleton, and animation
source. With the server running and the optional Playwright dependency available,
`node scripts/export-hands.mjs` regenerates `assets/models/viewmodel/arms.glb`.
