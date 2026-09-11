# Model credits

Models are stored locally and loaded with Three.js GLTFLoader. The third-party
models listed below are used under their original CC0 1.0 public-domain dedications.
No purchase, login, or asset-server connection is needed to play.

| Local files | Author | Source |
| --- | --- | --- |
| `models/characters/rat.glb` | Quaternius | [Rat, including skeletal animations](https://poly.pizza/m/iltq5bVNaV) |
| `models/characters/adventurer.glb` | Quaternius | [Adventurer, including skeletal animations](https://poly.pizza/m/5EGWBMpuXq) |
| `models/town/*.glb` and texture atlas | Kenney | [Fantasy Town Kit 2.0](https://kenney.nl/assets/fantasy-town-kit) |
| `models/food/*.glb` and texture atlas | Kenney | [Food Kit](https://kenney.nl/assets/food-kit) |

Source packs were downloaded on September 8, 2026. Additional arch, timber, chimney,
and wall modules from the same Kenney pack were added on September 10, 2026. The Quaternius files are the
GLB versions served by the creators' public model viewers. The Kenney files were
extracted from the original downloadable packs, with their `License.txt` files
retained as `LICENSE.txt` alongside the assets.

Runtime changes: scale/orientation normalization, team and fur colors, roughness
adjustments, animation blending, and an extra head-nibbling motion over rat idle.
Original model and animation files are otherwise unchanged.

`models/viewmodel/arms.glb` is an original project asset, added September 11, 2026.
It contains two skinned arms with elbow, wrist, finger, and thumb bones, and 16
authored clips: Hold, Empty, Walk, Run, Climb, Throw, Pickup, and Refill for each arm.
The reproducible mesh, rig, and clip source is `scripts/author-hands.js`; the optional
export tool is `scripts/export-hands.mjs`. It does not modify the third-party rigs.

The Swiss cheese wedge and depletion morph, glass poison flask, crumbs, sky,
procedural cobble/stone/wood/metal materials, architecture kit, three map layouts,
and UI artwork are original code-created visuals in this project. Shell Shockers
provided design references; no Shell Shockers models, textures, maps, or animations
are included.

Third-party license: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
