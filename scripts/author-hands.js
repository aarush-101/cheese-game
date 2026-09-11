// Original Rat Race asset source. Reproducible without Blender; run export-hands.mjs.
// A skinned mesh per arm, articulated wrists/thumbs/fingers and authored GLB clips.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function authorHands(){
 const scene=new T.Scene(),clips=[];
 for(const side of ['Left','Right']){
  const root=new T.Group();root.name=side+'Arm';scene.add(root);
  const bones=[],parts=[],bone=(name,parent,x,y,z)=>{const b=new T.Bone();b.name=side+name;b.position.set(x,y,z);(parent??root).add(b);bones.push(b);return b;};
  const elbow=bone('Elbow',null,0,0,.48),wrist=bone('Wrist',elbow,0,0,-.48);
  const attachment=bone('Item',wrist,0,0,-.13);
  function part(geo,index,color,transform){
   geo.applyMatrix4(transform);const n=geo.attributes.position.count,ids=[],weights=[],colors=[];
   for(let i=0;i<n;i++){ids.push(index,0,0,0);weights.push(1,0,0,0);colors.push(...new T.Color(color).toArray());}
   geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));parts.push(geo);
  }
  const matrix=(x,y,z,sx,sy,sz,rotation=0)=>new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),rotation),new T.Vector3(sx,sy,sz));
  part(new T.CylinderGeometry(.095,.075,.48,12,5),0,'#64785d',matrix(0,0,.3,1,1,1,Math.PI/2));
  part(new T.CylinderGeometry(.079,.079,.08,16),1,'#493d34',matrix(0,0,.055,1,1,1,Math.PI/2));
  part(new T.SphereGeometry(1,16,10),1,'#d9a480',matrix(0,0,-.045,.084,.042,.1));
  const fingers=[];
  for(let f=0;f<4;f++){
   let parent=wrist,absZ=-.1;const x=(f-1.5)*.038,length=.055+(f===1||f===2?.01:0);
   for(let j=0;j<3;j++){
    const b=bone(`Finger${f}_${j}`,parent,j===0?x:0,j===0?-.003:0,j===0?-.1:-length);fingers.push(b);
    const idx=bones.length-1;
    part(new T.CapsuleGeometry(j===2?.016:.018,length-.025,3,8),idx,'#d9a480',matrix(x,-.003,absZ-length/2,1,1,1,Math.PI/2));
    absZ-=length;parent=b;
   }
  }
  const sign=side==='Left'?-1:1,thumb=bone('Thumb',wrist,-sign*.077,0,-.03),tip=bone('ThumbTip',thumb,-sign*.025,0,-.052);
  part(new T.CapsuleGeometry(.026,.04,3,8),bones.indexOf(thumb),'#d9a480',matrix(-sign*.09,0,-.056,1,1,1,Math.PI/2));
  part(new T.CapsuleGeometry(.022,.025,3,8),bones.indexOf(tip),'#d9a480',matrix(-sign*.1,0,-.103,1,1,1,Math.PI/2));
  const geo=mergeGeometries(parts,false),mesh=new T.SkinnedMesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.74}));mesh.name=side+'Skin';root.add(mesh);scene.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));parts.forEach(g=>g.dispose());
  const q=(x=0,y=0,z=0)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z)).toArray();
  for(const [name,poses,times] of [
   ['Hold',[[.0,0,0],[.015,0,.008],[0,0,0]],[0,1.2,2.4]],
   ['Empty',[[0,0,0],[.01,0,0],[0,0,0]],[0,1.2,2.4]],
   ['Walk',[[.025,0,.025],[-.025,0,-.025],[.025,0,.025]],[0,.3,.6]],
   ['Run',[[.12,0,.07],[-.06,0,-.07],[.12,0,.07]],[0,.22,.44]],
   ['Climb',[[-.6,0,0],[.35,0,0],[-.6,0,0]],[0,.4,.8]],
   ['Throw',[[0,0,0],[.45,-.12,-.08],[-.62,0,.06],[-.38,0,.06],[0,0,0]],[0,.1,.18,.28,.56]],
   ['Pickup',[[.1,0,0],[-.35,0,.1],[0,0,0]],[0,.18,.36]],
   ['Refill',[[0,0,0],[-.4,.1,0],[0,0,0]],[0,.2,.42]],
  ]){
   const tracks=[new T.QuaternionKeyframeTrack(wrist.name+'.quaternion',times,poses.flatMap(p=>q(...p)))];
   for(const f of fingers){const segment=Number(f.name.at(-1)),base=name==='Empty'?.16:name==='Climb'?.3:[.4,.85,.65][segment];
    tracks.push(new T.QuaternionKeyframeTrack(f.name+'.quaternion',times,times.flatMap(t=>q(name==='Throw'&&t>=.18&&t<.4?.08:base))));
   }
   tracks.push(new T.QuaternionKeyframeTrack(thumb.name+'.quaternion',times,times.flatMap(()=>q(.25,sign*-.5,sign*-.2))),new T.QuaternionKeyframeTrack(tip.name+'.quaternion',times,times.flatMap(()=>q(.6))));
   clips.push(new T.AnimationClip(side+name,times.at(-1),tracks));
  }
 }
 return {scene,clips};
}
