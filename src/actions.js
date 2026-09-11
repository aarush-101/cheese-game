// Timings and item attachment/launch data shared by simulation and presentation.
export const ACTIONS=Object.freeze({throw:{release:.18,duration:.56,offset:{x:-.3,y:1.4,z:-.7},speed:14},pickup:.36,refill:.42});
export function launchTransform(p){const o=ACTIONS.throw.offset;return {x:p.x+Math.cos(p.yaw)*o.x+Math.sin(p.yaw)*o.z,y:p.y+o.y,z:p.z-Math.sin(p.yaw)*o.x+Math.cos(p.yaw)*o.z};}
