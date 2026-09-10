import { getMap, nearbyLadder, distance } from './map.js';
const $=id=>document.getElementById(id);

export class GameUI {
  constructor(audio){
    this.audio=audio;this.lastEvent=0;this.toastUntil=0;this.lastCountdown=null;this.ctx=$('minimap').getContext('2d');
    this.nodes=Object.fromEntries(['home-score','rival-score','timer','phase-label','home-poison','rival-poison','cheese','cheese-fill','cheese-hint','followers','poison-held','poison-hint','context-hint','countdown-number'].map(id=>[id,$(id)]));
  }
  reset(){this.lastEvent=0;this.lastCountdown=null;this.toastUntil=0;$('toast').classList.remove('show');}
  notify(text){$('toast').textContent=text;$('toast').classList.add('show');this.toastUntil=performance.now()+3200;}
  update(state){
    const n=this.nodes,p=state.players[0],home=state.bases[0];
    n['home-score'].textContent=home.count;n['rival-score'].textContent=state.bases[1].count;
    const seconds=Math.ceil(state.remaining);
    n.timer.textContent=state.phase==='sudden-death'?'OT':`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    n['phase-label'].textContent=state.phase==='sudden-death'?'SUDDEN DEATH':'RAT RACE';
    n.timer.parentElement.classList.toggle('urgent',seconds<=30&&state.phase==='playing');
    n.timer.parentElement.classList.toggle('sudden',state.phase==='sudden-death');
    for(const b of state.bases)n[b.id===0?'home-poison':'rival-poison'].textContent=b.poisonedUntil>state.time?`POISONED · ${Math.ceil(b.poisonedUntil-state.time)}s`:'';
    n.cheese.textContent=Math.ceil(p.cheese);n['cheese-fill'].style.width=`${p.cheese}%`;
    const map=getMap(state.mapId),atHome=distance(p,home)<=5&&Math.abs(p.y-home.y)<1;
    $('altitude').textContent=p.ladderId?'CLIMBING · W ↑ / S ↓ · SPACE TO JUMP':`${map.name.toUpperCase()} · ${p.y<0.2?'GROUND LEVEL':`${p.y.toFixed(1)}m ABOVE GROUND`}`;
    n['cheese-hint'].textContent=atHome&&p.cheese<99?`Refilling… ${Math.round(p.refillProgress*100)}%`:p.followers?`−${p.followers*2} cheese / sec · ${p.followers} hungry ${p.followers===1?'rat':'rats'}`:p.cheese<30?'Head home to refill your cheese.':'Right hand · always ready to lure.';
    document.querySelector('.cheese-inventory').classList.toggle('low',p.cheese<30);
    n.followers.textContent=p.followers;
    n['poison-held'].textContent=p.poison?'READY':'EMPTY';
    n['poison-hint'].textContent=p.poison?'Left hand · aim at a rival cheese board.':'Walk over a green pickup to collect.';
    document.querySelector('.poison-inventory').classList.toggle('held',p.poison);
    n['context-hint'].textContent=p.ladderId?'W / S to climb · Space to jump off.':nearbyLadder(p,map)?'Face the ladder · W to climb up · S to climb down.':state.phase==='sudden-death'?'Next new rat captured wins. Make it yours.':home.poisonedUntil>state.time?'Your base is poisoned. Rally the escapees!':p.cheese<1?'No cheese, no friends. Get home to refill.':atHome&&p.followers?'Rats that enter your base stay here and eat.':atHome?'Your base · stand here for 1 second to refill.':p.followers?'Bring your little entourage back to the yellow base.':'Find the rats. Make a good first impression.';
    if(state.phase==='countdown'){
      const count=Math.max(1,Math.ceil(state.countdown));n['countdown-number'].textContent=count;
      if(count!==this.lastCountdown){this.audio.play('countdown');this.lastCountdown=count;}
    }
    for(const event of state.events){
      if(event.id<=this.lastEvent)continue;this.lastEvent=event.id;
      if(event.type==='capture'){
        if(event.baseId===0){this.audio.play('capture');this.notify('Rat secured! Eating at home until the base is poisoned.');}
      }else if(event.type==='pickup'&&event.playerId===0){this.audio.play('pickup');this.notify('Poison acquired. Left click to lob it at a base.');}
      else if(event.type==='poison'){this.audio.play('poison');this.notify(event.baseId===0?'Your base is poisoned! Cheese disabled for 15 seconds.':'Rival base poisoned. Their rats are making an exit.');}
      else if(event.type==='miss'&&event.playerId===0)this.notify('No base hit. That one was just for dramatic effect.');
      else if(event.type==='throw'&&event.playerId===0)this.audio.play('throw');
      else if(event.type==='refill'&&event.playerId===0)this.audio.play('refill');
      else if(event.type==='start'){this.audio.play('start');this.notify('The rat race is on. Follow your nose.');}
      else if(event.type==='sudden-death'){this.audio.play('sudden-death');this.notify('Sudden death! The first new capture wins.');}
      else if(event.type==='end')this.audio.play(event.winner===0?'win':'lose');
    }
    if(performance.now()>this.toastUntil)$('toast').classList.remove('show');
    this.drawMap(state);
  }
  drawMap(state){
    const map=getMap(state.mapId),ctx=this.ctx,N=360,scale=N/(map.size+8),coord=n=>(n+map.half+4)*scale;
    ctx.clearRect(0,0,N,N);ctx.fillStyle='#d7ccb4';ctx.fillRect(0,0,N,N);
    ctx.strokeStyle='#a3967a';ctx.lineWidth=4;ctx.strokeRect(coord(-map.half),coord(-map.half),map.size*scale,map.size*scale);
    for(const o of map.platforms){ctx.fillStyle=o.y>9?'#798d89':'#a9b4a0';ctx.fillRect(coord(o.x-o.w/2),coord(o.z-o.d/2),o.w*scale,o.d*scale);}
    for(const r of map.ramps){ctx.fillStyle='#cbbd86';ctx.fillRect(coord(r.x-r.w/2),coord(r.z-r.d/2),r.w*scale,r.d*scale);}
    for(const l of map.ladders){ctx.fillStyle='#f7e393';ctx.fillRect(coord(l.x)-2,coord(l.z)-3,4,6);}
    for(const b of state.bases){ctx.fillStyle=b.poisonedUntil>state.time?'#9db963':b.id===0?'#e8c362':'#de997d';ctx.beginPath();ctx.arc(coord(b.x),coord(b.z),5*scale,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#a6987c';for(const o of map.obstacles)ctx.fillRect(coord(o.x-o.w/2),coord(o.z-o.d/2),o.w*scale,o.d*scale);
    for(const p of state.pickups)if(p.availableAt<=state.time){ctx.fillStyle='#6c9239';ctx.beginPath();ctx.arc(coord(p.x),coord(p.z),5,0,Math.PI*2);ctx.fill();}
    for(const rat of state.rats){ctx.fillStyle=rat.fleeUntil>state.time?'#acd065':rat.y>state.players[0].y+2?'#8ce3ea':'#fff8e5';ctx.strokeStyle='#8e917e';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(coord(rat.x),coord(rat.z),4.5,0,Math.PI*2);ctx.fill();ctx.stroke();}
    for(const p of state.players){ctx.save();ctx.translate(coord(p.x),coord(p.z));ctx.rotate(-p.yaw);ctx.fillStyle=p.id===0?'#5a663c':'#bb543c';ctx.strokeStyle='#fff9dc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,7);ctx.lineTo(0,3);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
  }
  drawMapPreview(canvas,map){
    const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
    ctx.fillStyle=map.theme==='forest'?'#dce2cf':map.theme==='ruins'?'#d6e0df':'#e8deca';ctx.fillRect(0,0,W,H);
    const scale=0.96*W/map.size;
    const project=(x,y,z)=>({x:W/2+(x-z)*scale*0.5,y:H*0.52+(x+z)*scale*0.22-y*2.3});
    const face=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>{const q=project(...p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.fill();};
    face([[-map.half,0,-map.half],[map.half,0,-map.half],[map.half,0,map.half],[-map.half,0,map.half]],'#b9b79c');
    const boxes=[...map.obstacles.filter(o=>o.kind!=='pillar'),...map.platforms].sort((a,b)=>(a.x+a.z)-(b.x+b.z));
    for(const o of boxes){const x=o.x-o.w/2,z=o.z-o.d/2,y=o.y??0,t=y+o.h;
      face([[x,y,z+o.d],[x+o.w,y,z+o.d],[x+o.w,t,z+o.d],[x,t,z+o.d]],'#8b927b');
      face([[x+o.w,y,z],[x+o.w,y,z+o.d],[x+o.w,t,z+o.d],[x+o.w,t,z]],'#717e70');
      face([[x,t,z],[x+o.w,t,z],[x+o.w,t,z+o.d],[x,t,z+o.d]],o.kind==='wood'?'#b2986d':map.color);
    }
    for(const b of map.bases){const p=project(b.x,0,b.z);ctx.fillStyle=b.color;ctx.beginPath();ctx.ellipse(p.x,p.y,7,3.2,0,0,Math.PI*2);ctx.fill();}
  }
  showScreen(name){
    $('screen-layer').hidden=!name;$('screen-layer').classList.toggle('counting',name==='countdown');
    for(const screen of ['countdown','pause','end'])$(`${screen}-screen`).hidden=screen!==name;
    if(name==='pause')$('resume-button').focus();
    if(name==='end')$('rematch-button').focus();
  }
  end(state){
    const won=state.winner===0;
    $('end-title').innerHTML=won?'TOP OF THE<br/>FOOD CHAIN.':'OUT-CHEESED.';
    $('end-description').textContent=won?'A small victory. A very large ego.':'Crumb Bot got the last laugh. And the rats.';
    $('end-home').textContent=state.bases[0].count;$('end-rival').textContent=state.bases[1].count;
    this.showScreen('end');
  }
}
