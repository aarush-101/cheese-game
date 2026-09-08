// Procedural audio: no downloaded assets, and no effects in the simulation.
export class GameAudio {
  constructor(){this.enabled=true;this.context=null;}
  unlock(){
    try{this.context??=new(window.AudioContext||window.webkitAudioContext)();if(this.context.state==='suspended')this.context.resume().catch(()=>{});}catch{/* Audio is optional. */}
  }
  tone(frequency,duration=0.1,delay=0,type='sine',volume=0.045){
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const ctx=this.context,osc=ctx.createOscillator(),gain=ctx.createGain(),time=ctx.currentTime+delay;
    osc.type=type;osc.frequency.setValueAtTime(frequency,time);osc.connect(gain);gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+0.008);gain.gain.exponentialRampToValueAtTime(0.001,time+duration);
    osc.start(time);osc.stop(time+duration+0.02);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  play(type){
    if(type==='capture'){this.tone(620);this.tone(830,0.15,0.07);}
    else if(type==='pickup'){this.tone(420,0.12);this.tone(630,0.12,0.08);this.tone(840,0.2,0.16);}
    else if(type==='poison'){this.tone(160,0.3,0,'triangle');this.tone(110,0.4,0.12,'triangle');}
    else if(type==='throw'){this.tone(280,0.12,0,'triangle',0.02);}
    else if(type==='refill'){this.tone(550,0.15,0,'sine',0.025);}
    else if(type==='countdown')this.tone(500,0.1);
    else if(type==='start'){this.tone(850,0.22);this.tone(1050,0.25,0.08);}
    else if(type==='sudden-death'){this.tone(330,0.25);this.tone(440,0.25,0.22);}
    else if(type==='win'){[520,650,780,1040].forEach((n,i)=>this.tone(n,0.35,i*0.11));}
    else if(type==='lose'){[390,330,260].forEach((n,i)=>this.tone(n,0.3,i*0.13));}
  }
}
