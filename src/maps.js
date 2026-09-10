// Original arenas. All coordinates, colliders and routes are plain shared data.
// Platforms are solid slabs (walk underneath or on top); ramps are solid wedges.
const mirror = items => items.flatMap(o => [o, { ...o, x: -o.x, z: -o.z,
  ...(o.axis ? { direction: -o.direction } : {}) }]);
const deck = (x,z,w,d,top,kind='stone') => ({x,z,w,d,y:top-0.6,h:0.6,kind});
const ramp = (x,z,w,d,low,high,axis,direction) => ({x,z,w,d,low,high,axis,direction});
const cover = (x,z,w,d,h,kind='crate',y=0) => ({x,z,w,d,h,kind,y});

function arena(spec) {
  const { baseOffset, ...data } = spec;
  data.half = data.size / 2;
  data.baseRadius = 5; data.poisonRadius = 4;
  data.bases = [
    {id:0,x:-baseOffset,y:0,z:baseOffset,color:'#edb82f',name:'HOME'},
    {id:1,x:baseOffset,y:0,z:-baseOffset,color:'#ef785c',name:'RIVAL'},
  ];
  for(const p of data.platforms) {
    for(const sx of [-1,1])for(const sz of [-1,1]) {
      const x=p.x+sx*(p.w/2-0.7),z=p.z+sz*(p.d/2-0.7);
      const below=data.platforms.filter(b=>b!==p&&b.y+b.h<=p.y&&Math.abs(x-b.x)<=b.w/2&&Math.abs(z-b.z)<=b.d/2);
      const y=Math.max(0,...below.map(b=>b.y+b.h));
      data.obstacles.push({x,z,y,w:data.theme==='ruins'?1.1:0.65,d:data.theme==='ruins'?1.1:0.65,h:p.y-y,kind:'pillar'});
    }
    if(p.w>p.d*2)for(const side of [-1,1])data.obstacles.push({x:p.x,z:p.z+side*(p.d/2-0.15),y:p.y+p.h,w:p.w-2,d:0.25,h:0.75,kind:'rail'});
  }
  data.obstacles = data.obstacles.map((o,id)=>o.kind==='tree'?({...o,id,visualWidth:o.w,visualHeight:o.h,w:1.1,d:1.1,h:2.6}):({...o,id}));
  data.platforms = data.platforms.map((o,id)=>({...o,id:`deck-${id}`}));
  data.ramps = data.ramps.map((o,id)=>({...o,id:`ramp-${id}`}));
  data.ladders = data.ladders.flatMap(l => [l, {...l,x:-l.x,z:-l.z,exitX:-l.exitX,exitZ:-l.exitZ,nx:-l.nx,nz:-l.nz}])
    .map((l,id)=>({...l,id:`ladder-${id}`}));
  return Object.freeze(data);
}

export const MAPS = Object.freeze([
  arena({id:'crumb-quarter',name:'Crumb Quarter',number:'01',size:120,baseOffset:44,
    theme:'market',levels:3,highest:12,tag:'ROOFTOPS & MARKET STREETS',color:'#c59653',
    description:'Busy streets below. A cheese heist above.',
    detail:'Cross the market bridge, climb the bell towers, or herd your rats up the long rooftop ramps.',
    platforms:[...mirror([deck(-20,0,16,32,6),deck(-20,-9,12,12,12)]),deck(0,0,24,7,6)],
    ramps:mirror([ramp(-20,26,7,20,0,6,'z',-1),ramp(-20,6,6,18,6,12,'z',-1)]),
    ladders:[{x:-28.7,z:0,bottom:0,top:6,exitX:-26.7,exitZ:0,nx:-1,nz:0},
      {x:-26.7,z:-9,bottom:6,top:12,exitX:-24.7,exitZ:-9,nx:-1,nz:0}],
    pickups:[{x:-20,y:12,z:-9},{x:0,y:0,z:0},{x:20,y:12,z:9}],
    obstacles:mirror([
      cover(-40,10,10,12,6,'building'),cover(-40,-24,10,12,8,'building'),
      cover(-8,39,11,8,6,'building'),cover(-39,33,5,2.5,1.3,'cover'),
      cover(-10,18,3,3,2,'crate'),cover(-34,-8,3,3,2,'crate'),
      cover(-7,-22,2,10,3,'wall'),cover(-47,-7,5,2,1.2,'cover'),
      cover(-4,29,3,3,1.3,'crate'),cover(-34,49,3,3,2.2,'crate'),cover(-51,20,4,4,2.4,'crate'),cover(-8,-48,8,3,2,'cover'),
      cover(-29,-43,7,4,2.8,'stall'),cover(-51,-44,4,4,2.2,'crate'),
      cover(-25,7,2,3,1.1,'cover',6),cover(-16,-12,2,2,1.2,'crate',12),
    ])}),
  arena({id:'gouda-aqueduct',name:'Gouda Aqueduct',number:'02',size:144,baseOffset:54,
    theme:'ruins',levels:3,highest:16,tag:'STONE ARCHES & HIGH VIADUCTS',color:'#7897a3',
    description:'Ancient stone. Questionable dairy.',
    detail:'A sweeping viaduct connects two fortresses. Take the winding ramps or climb straight to the lookout.',
    platforms:[...mirror([deck(-28,0,20,52,8),deck(-28,-10,16,16,16)]),deck(0,0,36,8,8),deck(-10,-10,20,6,16),deck(0,0,6,26,16),deck(10,10,20,6,16)],
    ramps:mirror([ramp(-28,40,8,28,0,8,'z',-1),ramp(-28,12,7,28,8,16,'z',-1)]),
    ladders:[{x:-38.7,z:-8,bottom:0,top:8,exitX:-36.7,exitZ:-8,nx:-1,nz:0},
      {x:-36.7,z:-10,bottom:8,top:16,exitX:-34.7,exitZ:-10,nx:-1,nz:0}],
    pickups:[{x:-28,y:16,z:-10},{x:0,y:8,z:0},{x:28,y:16,z:10}],
    obstacles:mirror([
      cover(-49,15,4,18,6,'wall'),cover(-48,-31,12,10,9,'ruin'),
      cover(-9,44,13,4,4,'wall'),cover(-16,-26,3,12,3,'wall'),
      cover(-39,53,3,3,2,'crate'),cover(-8,20,4,3,1.2,'cover'),
      cover(-57,-7,5,4,4,'rock'),cover(-4,61,6,4,3,'rock'),cover(-62,28,3,10,4,'wall'),cover(-23,-57,9,3,2.4,'wall'),
      cover(-43,-57,4,4,4,'rock'),cover(-13,31,4,4,2,'crate'),
      cover(-34,8,3,3,1.2,'crate',8),cover(-22,-14,2,2,1.2,'crate',16),
    ])}),
  arena({id:'timber-hollow',name:'Timber Hollow',number:'03',size:160,baseOffset:60,
    theme:'forest',levels:4,highest:15,tag:'MILL DECKS & FOREST CATWALKS',color:'#71865c',
    description:'Take the scenic route. Bring snacks.',
    detail:'Climb through four levels of timber walkways, cut through the mill, and jump down into the forest lanes.',
    platforms:[...mirror([deck(-24,0,16,44,5,'wood'),deck(-24,-12,12,24,10,'wood'),
      deck(-24,-22,8,8,15,'wood')]),deck(0,-14,32,6,5,'wood'),deck(0,14,32,6,5,'wood')],
    ramps:mirror([ramp(-24,31,7,18,0,5,'z',-1),ramp(-24,9,6,18,5,10,'z',-1),
      ramp(-24,-9,5,18,10,15,'z',-1)]),
    ladders:[{x:-32.7,z:-12,bottom:0,top:5,exitX:-30.7,exitZ:-12,nx:-1,nz:0},
      {x:-30.7,z:-10,bottom:5,top:10,exitX:-28.7,exitZ:-10,nx:-1,nz:0},
      {x:-28.7,z:-22,bottom:10,top:15,exitX:-26.7,exitZ:-22,nx:-1,nz:0}],
    pickups:[{x:-24,y:15,z:-22},{x:0,y:0,z:0},{x:24,y:15,z:22}],
    obstacles:mirror([
      cover(-49,13,12,14,7,'building'),cover(-48,-33,6,6,10,'tree'),
      cover(-56,38,5,5,11,'tree'),cover(-12,51,5,5,12,'tree'),
      cover(-9,-39,4,4,9,'tree'),cover(-64,-16,6,6,12,'tree'),
      cover(-10,20,4,4,2.6,'rock'),cover(-40,48,6,2.5,1.3,'cover'),
      cover(-38,-10,4,4,3,'rock'),cover(-4,66,5,5,10,'tree'),cover(-66,-47,7,7,14,'tree'),cover(-32,-57,6,6,12,'tree'),
      cover(-17,-63,4,4,2.4,'crate'),cover(-66,8,7,3,1.3,'cover'),cover(-12,33,5,5,9,'tree'),
      cover(-30,11,2,3,1.2,'cover',5),cover(-28,-16,2,2,1,'crate',10),
    ])}),
]);
export const DEFAULT_MAP_ID = MAPS[0].id;
export function getMap(id=DEFAULT_MAP_ID) {
  const map=MAPS.find(m=>m.id===id);
  if(!map) throw new RangeError(`Unknown arena: ${id}`);
  return map;
}
