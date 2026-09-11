# Rat Race upgrade implementation

Release 0.4.1, September 11, 2026. Implements the functional map, movement, item
animation, and rendering work in [the upgrade plan](UPGRADE-PLAN.md). The original
game rules remain intact, including captured rats staying at a healthy base until
poison releases them. The delivery and its measured limits are recorded separately
below so proposed performance targets are not mistaken for achieved benchmarks.

## Delivered

| Plan area | Result |
| --- | --- |
| Movement and timing | Shared XYZ interpolation fixes the camera's takeoff continuity. Raw diagonal input is normalized as one vector. Horizontal velocity, bounded air steering, 80ms coyote time, 100ms jump buffering, and continuous ladder entry/exit replace abrupt position changes. Walking is 6.8 units/sec; sprint is 11.5. |
| Sprint feedback | Hold or toggle Shift, HUD status, faster distance-based footsteps, blended running arms, gentle FOV change, landing recovery, and reduced camera motion setting. |
| Presentation | Latest mouse angles render at display cadence. Characters, projectiles, and action clips share interpolated, pause-aware time. Locomotion phases follow actual travel; AI yaw takes the shortest interpolated turn. Teleports and rematches clear history. |
| First-person rig | Local original skinned GLB arms, articulated wrists/fingers, and 16 authored clips. Separate viewmodel scene and FOV, blended independent actions, wall-proximity pose, left flask and right cheese. Source and export script included. |
| Item handling | Pickup/reach, throw anticipation/release/follow-through, cheese depletion morph with a fixed grip anchor and pooled crumbs, empty pose, refill reach, and climbing stow/restore. Bounded liquid response and simpler default glass. |
| Action authority | Shared launch offset and throw specification. A reserved bottle releases once at 0.18s into a 0.56s action. Event IDs prevent repeated presentation. Pause preserves pending actions; climbing cannot start during the throw and does not consume inventory. |
| Old Town | 240×200 street grid: enterable multistory shops/apartments, stairwells, roof links, covered streets, market, and a −4m cellar; upper objectives at 20m. |
| Cheese Foundry | 280×220 industrial hall: six stories of ring galleries, switchback stairs, overhead gantries, silos, loading areas, and 25m maintenance routes. |
| Canopy Citadel | 260×260 wooded fortress: −8m ravine, crypt, offset bridges, cliff galleries, round turrets, broken chapel, and a 28m keep. |
| Map selection and review | Selector above Play, separate map cards, distinct live previews, player-height tours, and an interactive floor-plan atlas. Legacy map IDs preserve existing selections. A separate Movement Lab provides traversal fixtures. |
| Collision and navigation | Rectangular bounds, real negative terrain, solid cliff sides, open doors/windows, capsule broad phase, ceiling collisions, supported stair landings, cached floor/sector navigation, and staggered route queries. |
| Rat and bot traversal | Every poison objective has a physically verified rat route from both bases. Bot decisions estimate return path time against cheese reserve; rats account for slopes. Base districts remain near central foraging rather than the distant map corners. |
| Architecture and rendering | Original modular openings, stairs, trim, supports, pipes, turrets, and themed procedural material maps. Static meshes are merged/instanced in visibility sectors. Local shadows, shader prewarming, pooled flasks/crumbs, quality presets, resolution scale, chosen-map-first loading, and a two-world cache limit. |
| Simulation boundary | Fixed 60Hz, no Three.js/DOM dependencies in rules, JSON GameState schema 4 with velocity/traversal/pending actions. Input, simulation, navigation, presentation, viewmodel, rendering, UI, and audio remain separate. |

The map atlas is at `/docs/map-atlas.html`; the Movement Lab is at `/?practice=1`.
Both run from the same static server. There is no game build step.

## Verification

`npm test`: **43 passing tests**. Coverage includes the retained game rules,
deterministic multi-map replay, full bot matches on all three maps, all stair flights,
all ladder endpoints and dismounts, physically traversed routes from both bases to
every poison objective, negative terrain and overhead collision, diagonal jumps
at multiple camera headings, and simulated presentation at 30/60/120/144 FPS.

`scripts/browser-smoke.mjs`: all three map selections, previews, countdowns, pointer
lock, throw windup/pause/resume and single release, visible cheese depletion/refill,
end/rematch reset, sprint toggle, low quality, reduced camera motion, Movement Lab,
and floor atlas pass without page errors. Captures use deliberately arranged
inventory and end-of-match state to exercise these cases, rather than claiming to
be recordings of unaided full human matches.

- [Old Town overview](research/release/crumb-quarter.png) and [first person](research/release/crumb-quarter-hands.png)
- [Foundry overview](research/release/gouda-aqueduct.png) and [first person](research/release/gouda-aqueduct-hands.png)
- [Citadel overview](research/release/timber-hollow.png) and [first person](research/release/timber-hollow-hands.png)
- [Machine-readable browser sample](research/release/browser-report.json)

The browser report records frame intervals, draw calls, triangles, resource counts,
quality, and camera position. Its 1440×900 headless Chrome samples include actions,
pause/resume, and screenshots. They are smoke-test measurements, not a GPU benchmark
or a guarantee for other machines. Run the script with a static server on port 5173
and an optional Playwright installation to reproduce them.

## Remaining measurement and art limits

The plan's reference-laptop 1080p target, physical 120/144Hz display review, GPU
timings, long-session allocation profiling, and controlled Shell Shockers action
recording have not been completed. Automated cadence tests establish movement and
interpolation consistency, not perceived quality on every display.

The initial normal-view budget of 250 draw calls is not met in all measured views:
the tested views use 268–384 calls, below the provisional worst-view budget of 400.
The final sample recorded 16.6–16.7ms median frame intervals and 17.4–18.0ms at the
95th percentile; these are short samples, not proof of a sustained 18ms ceiling or
absence of 33ms spikes. The linked JSON contains the final measurements.

Materials use authored procedural texture/bump detail and local shadow lighting;
there is no offline baked-lightmap pipeline. Arms are original stylized models with
authored clips, not motion-captured animation. Movement uses damped blending;
inertialization and moving elevators remain optional/deferred as described in the
plan. Further art polish and hardware profiling can proceed without changing the
simulation's rules or serialization boundary.
