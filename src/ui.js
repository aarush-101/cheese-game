import { OBSTACLES, distance } from './map.js';
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
    const atHome=distance(p,home)<=5;
    n['cheese-hint'].textContent=atHome&&p.cheese<99?`Refilling… ${Math.round(p.refillProgress*100)}%`:p.followers?`−${p.followers*2} cheese / sec · ${p.followers} hungry ${p.followers===1?'rat':'rats'}`:p.cheese<30?'Head home to refill your cheese.':'Your most persuasive argument.';
    document.querySelector('.cheese-inventory').classList.toggle('low',p.cheese<30);
    n.followers.textContent=p.followers;
    n['poison-held'].textContent=p.poison?'READY':'EMPTY';
    n['poison-hint'].textContent=p.poison?'Aim at a base. Make a little trouble.':'Walk over a green pickup to collect.';
    document.querySelector('.poison-inventory').classList.toggle('held',p.poison);
    n['context-hint'].textContent=state.phase==='sudden-death'?'Next new rat captured wins. Make it yours.':home.poisonedUntil>state.time?'Your base is poisoned. Rally the escapees!':p.cheese<1?'No cheese, no friends. Get home to refill.':atHome&&p.followers?'Let them gather. Sprint away to leave them home.':atHome?'Your base · stand here for 1 second to refill.':p.followers?'Bring your little entourage back to the yellow base.':'Find the rats. Make a good first impression.';
    if(state.phase==='countdown'){
      const count=Math.max(1,Math.ceil(state.countdown));n['countdown-number'].textContent=count;
      if(count!==this.lastCountdown){this.audio.play('countdown');this.lastCountdown=count;}
    }
    for(const event of state.events){
      if(event.id<=this.lastEvent)continue;this.lastEvent=event.id;
      if(event.type==='capture'){
        if(event.baseId===0){this.audio.play('capture');this.notify('A new rat at home. Excellent taste.');}
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
    const ctx=this.ctx,N=360,scale=N/64,coord=n=>(n+32)*scale;
    ctx.clearRect(0,0,N,N);ctx.fillStyle='#d7ccb4';ctx.fillRect(0,0,N,N);
    ctx.strokeStyle='#a3967a';ctx.lineWidth=4;ctx.strokeRect(coord(-30),coord(-30),60*scale,60*scale);
    for(const b of state.bases){ctx.fillStyle=b.poisonedUntil>state.time?'#9db963':b.id===0?'#e8c362':'#de997d';ctx.beginPath();ctx.arc(coord(b.x),coord(b.z),5*scale,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#a6987c';for(const o of OBSTACLES)ctx.fillRect(coord(o.x-o.w/2),coord(o.z-o.d/2),o.w*scale,o.d*scale);
    for(const p of state.pickups)if(p.availableAt<=state.time){ctx.fillStyle='#6c9239';ctx.beginPath();ctx.arc(coord(p.x),coord(p.z),5,0,Math.PI*2);ctx.fill();}
    for(const rat of state.rats){ctx.fillStyle=rat.fleeUntil>state.time?'#acd065':'#fff8e5';ctx.strokeStyle='#8e917e';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(coord(rat.x),coord(rat.z),4.5,0,Math.PI*2);ctx.fill();ctx.stroke();}
    for(const p of state.players){ctx.save();ctx.translate(coord(p.x),coord(p.z));ctx.rotate(-p.yaw);ctx.fillStyle=p.id===0?'#5a663c':'#bb543c';ctx.strokeStyle='#fff9dc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,7);ctx.lineTo(0,3);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
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
