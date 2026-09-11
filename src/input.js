// Browser input adapter. Produces plain command packets; never changes GameState.
export class PlayerInput {
  constructor(canvas, onLockChange, onError) {
    this.canvas=canvas;this.keys=new Set();this.yaw=0;this.pitch=0;this.sensitivity=1;this.throwQueued=false;this.jumpQueued=false;this.sprintLatched=false;
    document.addEventListener('pointerlockchange',()=>{
      this.keys.clear();this.sprintLatched=false;this.throwQueued=false;this.jumpQueued=false;onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror',()=>onError('Your browser blocked mouse capture. Click resume to try again.'));
    document.addEventListener('mousemove',event=>{
      if(!this.locked)return;
      this.yaw-=event.movementX*0.002*this.sensitivity;
      this.pitch=Math.max(-1.35,Math.min(1.35,this.pitch-event.movementY*0.002*this.sensitivity));
    });
    document.addEventListener('keydown',event=>{
      if(!this.locked)return;
      if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space','Tab','ArrowUp','ArrowDown'].includes(event.code))event.preventDefault();
      if(event.code==='Space'&&!event.repeat)this.jumpQueued=true;
      if((event.code==='ShiftLeft'||event.code==='ShiftRight')&&!event.repeat&&this.sprintToggle)this.sprintLatched=!this.sprintLatched;
      this.keys.add(event.code);
    });
    document.addEventListener('keyup',event=>this.keys.delete(event.code));
    canvas.addEventListener('mousedown',event=>{if(this.locked&&event.button===0)this.throwQueued=true;});
    canvas.addEventListener('contextmenu',event=>event.preventDefault());
    window.addEventListener('blur',()=>{this.keys.clear();this.throwQueued=false;this.jumpQueued=false;if(this.locked)document.exitPointerLock();});
  }
  get locked(){return document.pointerLockElement===this.canvas;}
  async lock(){
    if(!this.canvas.requestPointerLock)throw new Error('Mouse capture is unavailable. Please use a desktop browser with a mouse and keyboard.');
    await this.canvas.requestPointerLock();
  }
  reset(player){this.keys.clear();this.sprintLatched=false;this.throwQueued=false;this.jumpQueued=false;this.yaw=player.yaw;this.pitch=player.pitch;}
  sample(){
    if(!this.locked)return{};
    const forward=Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS'));
    const right=Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA'));
    const command={
      moveX:-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*right,
      moveZ:-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*right,
      yaw:this.yaw,pitch:this.pitch,sprint:this.sprintToggle?this.sprintLatched:(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')),throw:this.throwQueued,jump:this.jumpQueued,climb:forward,
    };
    this.throwQueued=false;this.jumpQueued=false;return command;
  }
}
