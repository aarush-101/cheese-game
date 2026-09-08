# Rat Race

A first-person, single-player cheese heist built with Three.js. Ten roaming rats,
two corner bases, a mildly devious bot, and three minutes to bring the most rats home.

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
An internet connection is needed for that module. Google Fonts is optional; system
fonts are used if it is unavailable. Authored GLB models and their texture atlases are included in `assets/models/`, so
playing does not depend on asset-hosting services. See [asset credits](assets/CREDITS.md).
The rat and opponent use skeletal animations; the rats also nibble when eating.
The flask, first-person hands, paving textures, icons, and sound effects are generated locally.

## Play

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| Shift | Sprint |
| Left click | Throw held poison in a ballistic arc |
| Escape | Release the mouse and pause this single-player match |

Click **Enter the rat race** to capture the mouse and start the countdown. Mouse and
keyboard are required; the lobby responds to narrow screens, but touch gameplay is
not implemented. The lobby includes instructions, mouse sensitivity, sound settings,
and an expandable live arena preview. Settings persist on the device.

- Free rats reevaluate both hands and both base stacks every 0.2 seconds. Attraction is
  `cheese / distance`, with a 12-unit cutoff and a 0.001-unit guard at exact overlap.
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
src/map.js             Shared arena data, capsule collision, A* navigation
src/simulation.js      Rules, seeded randomness, rat AI, bot AI, projectiles, match state
src/input.js           Browser events → plain player command packets
src/renderer.js        Three.js scene; reads state and interpolates transforms
src/assets.js          Local GLB loading, shared instances, skeletal animation
assets/models/         Rat, opponent, food, and environment models with textures
src/ui.js              HUD, minimap, notifications, and match screens
src/audio.js           Optional Web Audio feedback
src/main.js            Client lifecycle and fixed 60 Hz accumulator
tests/simulation.test.js
```

The simulation imports **no DOM, Three.js, browser input, clocks, or audio**. The
renderer never writes to simulation state. Static map/navigation data is shared;
every evolving AI timer, path, random seed, and projectile is stored in GameState.
The client interpolates positions between steps and caps the catch-up backlog after
long frames to keep the browser responsive. Pausing is a local client concern.

## Future network mode

The same simulation can run in Node on an authoritative server:

```js
import { createGameState, startMatch, stepGame, FIXED_DT } from './src/simulation.js';

const state = createGameState(1234, { controllers: ['human', 'human'] });
startMatch(state);

// Invoke once per authoritative 60 Hz tick. Commands are keyed by player ID.
stepGame(state, {
  0: { moveX: 1, moveZ: 0, yaw: -Math.PI / 2, pitch: 0, sprint: false, throw: false },
  1: { moveX: 0, moveZ: -1, yaw: 0, pitch: 0, sprint: false, throw: false },
}, FIXED_DT);

const wireSnapshot = JSON.stringify(state);
const restoredState = JSON.parse(wireSnapshot);
stepGame(restoredState, {});
```

Movement commands use world X/Z axes and are normalized/clamped by the simulation.
`throw` is a one-tick action. The server must authenticate player IDs, sequence input
packets, and own tick timing. Transport, lobbies, reconciliation, and prediction are
not implemented. The browser currently renders from player 0's perspective; a
network client will need to choose its local player ID when applying snapshots.

For inspection in the browser console:

```js
window.GameState         // The current plain state object (also available during play).
window.RatRace.snapshot() // A detached, serializable copy.
```

## Validate

Requires Node.js 20 or newer, with no test dependencies:

```sh
npm test
```

Tests cover deterministic snapshot replay, countdown and match timing, attraction
and secured feeding, cheese decay/refill, collision and navigation, pickups, ballistic
hits/misses, left-hand throws, poison release and recapture, sudden death, full bot matches, and
independent human command slots. State schema version 2 adds `rat.eating` and
keeps `capturedBy` latched until a base is poisoned.
