import {practice} from './maps/practice.js';
import { oldTown } from './maps/old-town.js';
import { foundry } from './maps/foundry.js';
import { citadel } from './maps/citadel.js';
export const MAPS=Object.freeze([oldTown(),foundry(),citadel()]);
export const PRACTICE_MAP=practice();
export const DEFAULT_MAP_ID=MAPS[0].id;
export function getMap(id=DEFAULT_MAP_ID){const m=id===PRACTICE_MAP.id?PRACTICE_MAP:MAPS.find(m=>m.id===id);if(!m)throw new RangeError(`Unknown arena: ${id}`);return m;}
