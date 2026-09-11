# Rat Race — map, movement, and animation upgrade plan

Prepared 10 September 2026. Implementation updated 11 September 2026: the movement,
two-hand animation, three-map replacement, navigation, architecture, and quality
changes are now in the game. See [implementation status and verification](IMPLEMENTATION.md)
for delivered behavior, reproducible checks, captures, and performance targets still
requiring validation. The original research and proposed acceptance criteria are
preserved below; historical defect descriptions refer to the pre-upgrade version.

The next release should deliver three recognizably different places to explore, with usable interiors and several connected stories, alongside responsive movement and believable item handling. The current arenas are larger than the original prototype, but they still repeat the same central towers, exposed ramps, thin decks, and surrounding empty floor. Increasing the dimensions again will not, by itself, produce the intended experience.

## Evidence and reference study

I inspected the current source, exercised the local game in Chrome, checked Shell Shockers directly in a private Relic arena, and reviewed primary animation and level-design references. Observed behavior, published guidance, and proposed tuning values are distinguished below. No assumptions about Shell Shockers' proprietary animation implementation are needed.

The live reference inspection covered Relic's visible layered stone architecture, openings, cover, and the first-person weapon's ready pose and screen placement. Automated headless input did not reliably activate pointer lock or firing/reloading, so this study does not claim measured Shell Shockers action timings or a verified reload comparison. The animation recommendations below come from the reproduced Rat Race defects and the technical references, with proposed timings identified as tuning targets. A controlled reference recording of move/jump/inspect/reload/throw remains part of the first implementation review.

Blue Wizard's map-design retrospective describes improving connectivity, protected approaches, alternative paths, and the usefulness of different elevations. Its examples show why exposed central structures and excess empty space can play poorly. Those principles inform this plan; the proposed layouts are original. [Blue Wizard: Eggpic Map Refresh](https://bluewizard.com/shellshockers-eggpic-map-refresh/)

The studio's Trainyard update also emphasizes a substantial building as a defining map feature. This supports using traversable architectural landmarks, instead of only scattered scenery. [Blue Wizard: Trainyard](https://bluewizard.com/trainyard/)

Technical reference findings:

| Finding | Application to Rat Race |
| --- | --- |
| Fixed simulation steps and interpolated presentation address different timing problems. | Keep authoritative simulation at 60 Hz; interpolate presentation across display frames, including animation time and projectiles. [Glenn Fiedler: Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) |
| Three.js supports animation weights, crossfades, synchronized actions, and playback-speed changes. | Blend locomotion continuously and keep feet moving in proportion to actual displacement. [Three.js AnimationAction](https://threejs.org/docs/pages/AnimationAction.html) |
| Frame-independent damping uses elapsed time. | Replace per-frame smoothing constants for FOV, item sway, and secondary motion. [Three.js MathUtils.damp](https://threejs.org/docs/pages/MathUtils.html) |
| Spring-based transitions can retain position and velocity continuity. | Use controlled springs for hand follow-through and landing recovery; consider inertialization only if ordinary blending leaves visible interruptions. [Daniel Holden: Spring-Roll-Call](https://theorangeduck.com/page/spring-roll-call) |
| Shadow passes redraw shadow-casting geometry; repeated geometry can be instanced. | Budget lighting and geometry together, and batch repeated modules within visibility sectors. [Three.js Shadows](https://threejs.org/manual/en/shadows.html), [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) |

Shell Shockers' own controls use Shift to aim. Rat Race should keep Shift for sprint; the reference is its responsiveness and action readability, not an identical control scheme. [Shell Shockers](https://shellshock.io/)

## What is currently wrong

| Area | Evidence in this project | Consequence |
| --- | --- | --- |
| Map identity | `src/maps.js:35–89`: three variations of paired towers, long ramps, and bridging slabs. | Different themes still produce similar routes and silhouettes. |
| Architectural depth | `src/renderer.js` builds many buildings as a solid block with a roof and decorative doorway. | Doors suggest rooms that cannot be entered; upper floors feel like scaffolding. |
| Underground space | `src/map.js:floorHeight` always includes and clamps to ground height zero. | Real basements and tunnels below the ground require a terrain/collision change. |
| Sprint | `src/input.js` maps Shift; `src/simulation.js:4` defines 5.2 walking and 8.3 sprinting. Straight unobstructed simulation checks cover 10.4 and 16.6 units in two seconds. | Sprint exists, but discoverability and its visual/audio feedback are insufficient. |
| Animation cadence | `src/renderer.js:505–506` advances animation from fixed simulation time, while only positions are interpolated. | Poses and bob can repeat between simulation ticks on faster displays. |
| Input and turn presentation | Camera uses the last simulated angles; bot yaw is assigned directly. | Mouse response is limited by simulation sampling; bot turns can snap. |
| Frame-dependent transitions | `src/renderer.js:519` uses a fixed 0.12 FOV blend each frame. | The same transition settles at different rates on 30/60/120 Hz displays. |
| Bottle release | `src/simulation.js:156–166` consumes poison immediately; `src/renderer.js:520–529` hides it before the arm follows through. | The flask disappears, then an empty arm throws. |
| Cheese depletion | `src/renderer.js:521` keeps the full cheese mesh visible regardless of amount. | The HUD can read zero while the hand holds a full wedge. [Captured example](research/current-empty-cheese.png) |
| Grip and action poses | First-person hands are fixed procedural geometry, with a few whole-hand rotations. | Fingers do not adjust around the flask, and wrists have little believable articulation. [Current throw](research/current-throw-100ms.png) |
| Rendering headroom | A short 1440×900 headless Chrome sample recorded approximately 400 median renderer-reported draw calls and 230k triangles; render submission took 4.5 ms median and 9.2 ms at the 95th percentile. | More geometry must be accompanied by better batching, visibility, and material budgets. |

That short frame sample had a 16.7 ms median frame interval and 17.5 ms at the 95th percentile. It is not a GPU benchmark or a guarantee for the user's browser. A steady average frame rate can coexist with visibly discontinuous animation.

## 1. Establish responsive movement and a coherent presentation clock

Build a small movement test area with a staircase, ramp, low ceiling, narrow doorway, ladder, and several jump gaps. Use it to resolve movement and animation before expanding the worlds.

- Preserve 60 Hz simulation and serializable commands. Add horizontal velocity, grounded/airborne transition events, and explicit traversal states.
- Present local mouse look from the latest input at display cadence. Apply damping to the items and camera effects, not to the player's aim.
- Advance all visual motion on one interpolated, pause-aware presentation timeline. Interpolate remote/AI rotations and projectile transforms; clear interpolation history at teleports, spawns, and rematches.
- Use acceleration and braking that feel immediate without an abrupt body-speed switch. Initial tuning targets: 6.8 units/sec walk, 11.5 sprint, and approximately 6.2 rat movement. These are playtest candidates, not final balance values.
- Keep hold-Shift sprint, add a toggle option, show a brief first-match control cue, and display a restrained sprint indicator. Add faster footsteps, a lowered running grip, and a gentle FOV increase.
- Allow steering in the air without unlimited acceleration. Start with about 80 ms of coyote time and 100 ms of jump buffering; tune against collision tests.
- Blend ladder entry and exit through short controlled motions. Eliminate the current immediate horizontal repositioning at a landing. Include a clear exit landing, correct head clearance, and predictable jump-off direction.
- Add restrained takeoff and landing responses and an option to reduce camera bob. Keep no fall damage for this iteration.

Acceptance: equal travel distance with identical input at 30, 60, 120, and 144 render FPS; visible response on the next display frame; no snagging on stair edges, camera snaps at ladder exits, or extra jump impulses. Sprint should be obvious from a five-second silent recording.

## 2. Rebuild first-person hands and item actions

Use a skinned two-arm model with wrist and finger bones, authored grip poses, and named left/right item attachment points. Author the animation clips with the actual flask and cheese geometry in place, then export them as local GLB assets. This needs asset and animation work as well as code changes.

Use a dedicated first-person camera/layer so item framing can be tuned independently from the world camera. Reduce item screen coverage and keep the crosshair and central path readable. Add a gentle proximity pose near walls instead of allowing visible clipping.

| Action | Proposed presentation | Authoritative behavior |
| --- | --- | --- |
| Hold / move / sprint | Fingers maintain contact; small breathing and velocity-based sway; blend into a distinct running pose. | Ownership remains unchanged. |
| Pick up poison | Left hand reaches, closes around the flask, then settles into its grip. Initial clip target: 0.25–0.4 sec. | Pickup is awarded once; the animation follows its event. |
| Throw poison | Anticipation → release → follow-through → recovery. Initial total target: 0.45–0.6 sec, release around 0.15–0.2 sec. | A pending throw reserves the item. A fixed release tick spawns exactly one projectile and consumes poison. |
| Lose cheese | The wedge wears down around a fixed grip anchor; small crumbs explain consumption. | Visual amount follows the authoritative 0–100 amount. No visual animation modifies cheese. |
| Empty hand | The final fragment breaks away and the right hand settles into an empty pose. | Attraction stops immediately at zero, independently of visual recovery. |
| Refill | Reach toward the home cheese stack, acquire a new wedge at the refill event, and return to the ready grip. | The existing continuous one-second refill rule remains authoritative. |
| Climb | Stow carried items, climb with alternating hand contacts, then restore each item to its correct hand. | Inventory is retained. Define interruption behavior before implementation. |

For cheese, use a fixed-topology depletion morph or authored depletion stages with a concealed transition; do not scale the entire hand or simply switch the wedge off. Keep skin, flask, and cheese materials consistent under lighting changes. Give the liquid a small bounded response to motion; full fluid simulation is unnecessary.

Store throw timing and launch offsets in shared data. The renderer must not supply a bone transform back to the simulation. The displayed held object and projectile must meet at release, using the shared action specification and event. Include event IDs so a replay or future network correction cannot play the throw twice.

Separate upper-body actions from movement. Starting a jump should not restart a throw. Decide interruption rules for ladder entry, refill, and pause, and test them explicitly. Animation-only work must never grant a pickup, refill cheese, or apply poison.

Acceptance: frame-by-frame review shows no flask disappearing before release, duplicate bottle, sudden grip change, or full wedge at zero. Left poison and right cheese remain independent. Pause/resume and rematch cannot repeat a release or leave the hands in an invalid pose.

## 3. Replace the layouts with three different architectural plans

The following footprints are provisional playable-space targets, about 2.6–3.3 times their respective current map areas. Exact dimensions depend on route-time and performance checks. Every map needs actual rooms, overhead floors, windows, passageways, stairwells, and navigable roof areas.

| Arena concept | Proposed footprint / layers | Distinct layout and architecture |
| --- | --- | --- |
| **Old Town** — replaces Crumb Quarter | 240×200; six layers including cellars and roofs, roughly −4 to +20m | A dense street grid of connected multistory shops and apartments. Courtyards, indoor stairs, service alleys, cellars, balconies, roof links, and a central market hall. Routes repeatedly alternate indoors and outdoors. |
| **Cheese Foundry** — replaces Gouda Aqueduct | 280×220; six stories, roughly 0 to +25m | A large industrial interior organized around a tall central processing hall. Stacked production floors, side galleries, silos, loading bays, maintenance corridors, gantries, and a furnace landmark. The layout uses overlapping interior loops. |
| **Canopy Citadel** — replaces Timber Hollow | 260×260; five major elevations, roughly 0 to +28m | A fortress built around a wooded ravine: an outer trail, lower culverts, terraced courtyards, cliff galleries, and an upper keep. Offset bridges and switchback routes form rings and spokes, distinct from the town's grid and foundry's stacked hall. |

Map design requirements:

- At least three strategically different routes between team districts: a reliable herd route, an exposed fast route, and a route through cover/interiors.
- At least two independent approaches and two exits for each important upper area. Ladders are shortcuts, never the sole route to a rat objective.
- Build complete upper-floor loops. A climb should lead somewhere useful rather than end at a small poison platform.
- Use stairs with landings, switchback ramps, ladders, balconies, and intentional one-way drops. Add a few well-signposted jump shortcuts. Defer moving elevators until static traversal is reliable.
- Place cover to interrupt specific views and create choices. Use readable landmarks and floor names, with consistent team wayfinding. Keep important corridors wide enough for a herd.
- Keep main objective routes balanced between team ends. Visual neighborhoods can differ while route lengths, climb effort, cover access, and poison access remain comparable.
- Make doors and windows reflect real openings in the collision data. Match roofs, ceilings, beams, and stair clearance to the modeled architecture.
- Preserve the map dropdown above Play. Give each arena a distinct thumbnail and a short camera tour at player scale; an always-zoomed-out island view hides the difference in size.

Deliver a floor plan and a playable blockout for each concept before dressing it. A blockout must look different from the others with all colors and props removed.

## 4. Make larger maps work for a rat-herding game

Bigger maps introduce an economy problem that must be solved by design. With 100 cheese and the current drain of 2/sec per follower, two rats provide 25 seconds of carrying time; three provide only 16.7 seconds. A maze that exceeds that budget can make a capture impossible even when movement feels good.

Keep 10 rats, the 100-cheese capacity, current decay, capture locking, and poison rules initially. Place central foraging areas and opposing base courtyards so two-rat return routes take approximately 15–20 seconds at herd pace. Position bases within opposing districts as needed; keeping them at the outermost corners of much larger rectangles may conflict with this budget. This is an explicit layout proposal for testing.

Use the outer districts and upper stories for alternate approaches, poison interception, and longer exploratory routes. Distribute the ten rats across connected central foraging spaces where appropriate. Do not make every objective depend on crossing the full map.

Keep the three-minute round as the default during the first blockout tests. If the final routes still require longer rounds or additional refill options, propose that as a separate balance change with measured evidence.

Replace whole-map layered-grid searches with hierarchical navigation: a graph of rooms/floors and connectors, with local paths inside sectors. Cache static data per map; stagger queries and rebuild only when targets materially change. Rats need herd spacing, slope-aware speed, and reachable surface targets. Bots must understand route length, cheese budget, and elevation when choosing poison or returning home.

Expand collision support to rectangular bounds, actual ground surfaces, and negative elevations. Keep collision and navigation data independent of Three.js. Visual complexity must not require equally complex collision geometry.

Acceptance: bot and rat runs traverse all intended floors; no rat permanently sticks in a doorway or under an upper target; return trips succeed with the intended herd size and cheese budget. Automated route checks supplement recorded full matches.

## 5. Build a coherent architecture kit and keep performance predictable

Create modular floors, walls with openings, corners, columns, lintels, stair flights, railings, roofs, and supported bridges at consistent dimensions. Give each theme its own material and silhouette set. Use trim details, bevels, grime, signs, and local ambient shading to give buildings depth, with deliberate variation rather than stretching the same object across every structure.

Separate visible art, simple collision volumes, and navigation surfaces in each prefab. Store these relationships in authored data so a doorway or stair cannot accidentally become a solid box. Keep source files and licenses with the assets.

Optimization is part of the build:

- Batch shared geometry and materials within rooms or spatial sectors. Current world-wide batches can remain visible whenever any part intersects the camera frustum.
- Pool poison projectiles, crumbs, and particles. Prewarm shaders and frequent action assets before the match starts.
- Bake static architectural shading where useful; reserve live shadows for the local action. Reduce shadow-caster count and distance.
- Use simpler flask glass on the default quality tier; enable costly transmission only when the performance budget allows it.
- Add quality presets and a bounded render-resolution scale. Load the chosen detailed map first and cap cached-map memory.
- Record CPU, GPU where available, frame intervals, draw calls, and allocation spikes. Average FPS alone is insufficient.

Initial targets on a documented reference laptop at 1080p/medium: a steady 60 FPS experience, 95th-percentile frame interval at or below 18 ms, and no repeatable action-induced spikes above 33 ms after warm-up. Use provisional rendering budgets of about 250 draw calls in normal views, 400 in worst views, and 500k visible triangles; adjust against actual GPU measurements. Simulation and pathfinding should generally fit within 2 ms per display frame. These are targets, not achieved measurements.

## Delivery order and review gates

| Order | Deliverable | Must be demonstrated before proceeding |
| --- | --- | --- |
| 1 | Baseline recordings and movement test area | Reproducible walking, sprinting, turning, jumping, stairs, ladders, and frame-time captures. |
| 2 | Movement controller and presentation timing | Same movement outcomes across display rates; responsive aim; smooth sprint, landings, and ladder exits. |
| 3 | Finished two-hand rig and all item actions | Correct grip, synchronized bottle release, visible cheese depletion/refill, and safe interrupted actions. |
| 4 | One complete Old Town district | Several usable stories, a real interior-to-roof loop, a cellar, two approaches, rat navigation, and finished art at the performance target. |
| 5 | Full Old Town map | Measured base/foraging routes, coherent architecture, successful full matches, and no major dead areas. |
| 6 | Foundry and Citadel | Independently designed floor plans and silhouettes, equivalent gameplay checks, distinct match recordings. |
| 7 | Release candidate | Map selection/cache consistency, rematch/reset, all action states, 30/60/120/144 Hz presentation checks, performance captures, and source/license inventory. |

The first reviewable improvement should be a short playable route demonstrating sprint → stairs → ladder → jump → bottle throw → cheese depletion → refill. Once that feels convincing, apply it to a finished district, then expand to the three complete maps. Completing all blockouts at once would spread the same unresolved movement and presentation problems across more geometry.

Preserve the separation between simulation, input, rendering, audio, and UI throughout. Proposed module boundaries include `movement`, `navigation`, `presentation`, `viewmodel`, and per-map data files. Authoritative states and action events remain plain JSON so the later two-player mode can reuse them.
