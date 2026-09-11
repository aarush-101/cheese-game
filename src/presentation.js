// Presentation-only math. All axes share a snapshot and interpolation factor.
export const damp=(a,b,rate,dt)=>b+(a-b)*Math.exp(-rate*Math.max(0,dt));
export const angleLerp=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
export function snapshot(state){return {time:state.time,players:state.players.map(p=>({...p})),rats:state.rats.map(r=>({...r})),projectiles:state.projectiles.map(p=>({...p}))};}
export function transform(old,p,alpha=1){old??=p;const t=Math.max(0,Math.min(1,alpha));if(Math.hypot(p.x-old.x,p.z-old.z,(p.y??0)-(old.y??0))>5)old=p;return {x:old.x+(p.x-old.x)*t,y:(old.y??0)+((p.y??0)-(old.y??0))*t,z:old.z+(p.z-old.z)*t,yaw:angleLerp(old.yaw??0,p.yaw??0,t),travel:(old.travel??0)+((p.travel??0)-(old.travel??0))*t};}
export class PresentationClock{
 constructor(){this.last=null;this.stateTime=0;this.preview=true;}
 update(state,alpha,wall,preview,paused){
  const reset=this.last===null||state.time<this.stateTime||preview!==this.preview;
  const candidate=preview?wall:Math.max(0,state.time-(paused?0:(1-alpha)/60));
  const time=reset?candidate:Math.max(this.last,candidate),dt=reset||paused?0:Math.min(.1,time-this.last);
  this.last=time;this.stateTime=state.time;this.preview=preview;return {time,dt,reset};
 }
}
