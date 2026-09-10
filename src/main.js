import { MAPS, getMap, DEFAULT_MAP_ID } from './map.js';
import { createGameState, startMatch, stepGame, FIXED_DT } from './simulation.js';
import { GameRenderer } from './renderer.js';
import { PlayerInput } from './input.js';
import { GameAudio } from './audio.js';
import { GameUI } from './ui.js';

const $=id=>document.getElementById(id);
const canvas=$('game-canvas'),audio=new GameAudio(),ui=new GameUI(audio);
let selectedMap=DEFAULT_MAP_ID;
try{const saved=localStorage.getItem('rat-race-map');if(MAPS.some(m=>m.id===saved))selectedMap=saved;}catch{}
let state=createGameState(12345,{mapId:selectedMap}),previous=null,inGame=false,paused=false,accumulator=0,last=performance.now(),lastUI=0,endedShown=false;
let settings={sensitivity:1,sound:true};
try{const saved=JSON.parse(localStorage.getItem('rat-race-settings')??'null');if(saved){if(Number.isFinite(saved.sensitivity))settings.sensitivity=Math.max(0.3,Math.min(2.5,saved.sensitivity));if(typeof saved.sound==='boolean')settings.sound=saved.sound;}}catch{/* Private browsing still works. */}

const renderer=await GameRenderer.create(canvas,(loaded,total)=>{
  $('scene-loading').querySelector('span').textContent=`Unpacking the arenas… ${loaded} / ${total}`;
});
function selectMap(id) {
  if(inGame)return;
  selectedMap=id;const map=getMap(id);state=createGameState(12345,{mapId:id});previous=null;renderer.setMap(id);
  $('arena-number').textContent=map.number;$('arena-title').textContent=map.name.toUpperCase();
  $('arena-description').textContent=map.description;$('arena-detail').textContent=map.detail;
  $('arena-coordinate').textContent=`${map.size} × ${map.size} / ${map.levels} LEVELS / ${map.highest}m HIGH`;
  $('minimap-title').textContent=map.name.toUpperCase();
  $('map-select').value=id;
  $('selected-map-details').textContent=`${map.size} × ${map.size} · ${map.levels} levels · ${map.highest}m high`;
  document.querySelectorAll('.map-option').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.map===id)));
  try{localStorage.setItem('rat-race-map',id);}catch{}
}
$('map-select').replaceChildren();
for(const map of MAPS){
  const option=document.createElement('option');option.value=map.id;option.textContent=map.name;$('map-select').append(option);
  const button=document.createElement('button');button.className='map-option';button.dataset.map=map.id;
  button.setAttribute('aria-pressed','false');button.style.setProperty('--map-accent',map.color);
  button.innerHTML=`<canvas width="240" height="160" aria-hidden="true"></canvas><span class="map-number">${map.number}</span><span class="map-copy"><small>${map.tag}</small><strong>${map.name}</strong><span>${map.size} × ${map.size} <i>·</i> ${map.levels} levels <i>·</i> ${map.highest}m high</span></span><span class="map-check" aria-hidden="true">✓</span>`;
  button.addEventListener('click',()=>selectMap(map.id));$('map-options').append(button);ui.drawMapPreview(button.querySelector('canvas'),map);
}
selectMap(selectedMap);
$('map-select').disabled=false;
$('map-select').addEventListener('change',event=>selectMap(event.target.value));

const input=new PlayerInput(canvas,locked=>{
  if(!inGame||state.phase==='ended')return;
  paused=!locked;accumulator=0;last=performance.now();
  if(locked){$('pause-description').textContent='Your match is paused. The cheese is safe. For now.';ui.showScreen(state.phase==='countdown'?'countdown':null);}
  else ui.showScreen('pause');
},showLockError);

function showLockError(message){
  if(!inGame)return;
  paused=true;$('pause-description').textContent=message;ui.showScreen('pause');
}
function applySettings(){
  input.sensitivity=settings.sensitivity;audio.enabled=settings.sound;
  $('sensitivity').value=settings.sensitivity;$('sensitivity-value').textContent=`${settings.sensitivity.toFixed(1)}×`;
  $('sound-setting').checked=settings.sound;
  $('sound-button').setAttribute('aria-label',settings.sound?'Mute sound':'Enable sound');
  $('sound-button').title=settings.sound?'Mute sound':'Enable sound';
  $('sound-button').querySelector('use').setAttribute('href',settings.sound?'#i-sound':'#i-muted');
  try{localStorage.setItem('rat-race-settings',JSON.stringify(settings));}catch{/* Settings can stay in memory. */}
}
applySettings();

function begin(){
  document.body.classList.remove('inspecting');
  state=createGameState(Date.now(),{mapId:selectedMap});startMatch(state);previous=null;inGame=true;paused=true;endedShown=false;accumulator=0;last=performance.now();
  input.reset(state.players[0]);ui.reset();audio.unlock();
  document.body.classList.add('in-game');$('game-hud').hidden=false;ui.update(state);ui.showScreen('countdown');renderer.resize();
  input.lock().catch(error=>showLockError(error.message));
}
function pause(){if(!inGame||state.phase==='ended')return;paused=true;accumulator=0;if(input.locked)document.exitPointerLock();ui.showScreen('pause');}
function resume(){audio.unlock();input.lock().catch(error=>showLockError(error.message));}
function lobby(){
  inGame=false;paused=false;if(input.locked)document.exitPointerLock();
  document.body.classList.remove('in-game');$('game-hud').hidden=true;ui.showScreen(null);
  state=createGameState(12345,{mapId:selectedMap});previous=null;accumulator=0;ui.reset();renderer.resize();$('start-button').focus();
}
$('start-button').addEventListener('click',begin);$('rematch-button').addEventListener('click',begin);
$('resume-button').addEventListener('click',resume);$('pause-button').addEventListener('click',pause);
$('quit-button').addEventListener('click',lobby);$('lobby-button').addEventListener('click',lobby);
$('help-button').addEventListener('click',()=>$('help-dialog').showModal());
$('settings-button').addEventListener('click',()=>$('settings-dialog').showModal());
document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}}));
$('sound-button').addEventListener('click',()=>{settings.sound=!settings.sound;audio.unlock();applySettings();if(settings.sound)audio.play('refill');});
$('sound-setting').addEventListener('change',event=>{settings.sound=event.target.checked;applySettings();});
$('sensitivity').addEventListener('input',event=>{settings.sensitivity=Number(event.target.value);applySettings();});
$('expand-button').addEventListener('click',()=>{
  const open=document.body.classList.toggle('inspecting');
  $('expand-button').setAttribute('aria-label',open?'Close arena preview':'Expand arena preview');$('expand-button').title=open?'Close arena preview':'Expand arena preview';
  $('expand-button').querySelector('use').setAttribute('href',open?'#i-close':'#i-expand');renderer.resize();
});
document.addEventListener('keydown',event=>{if(event.code==='Escape'){if(document.body.classList.contains('inspecting'))$('expand-button').click();else if(inGame&&state.phase!=='ended'&&!paused)pause();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});

// GameState is deliberately JSON-only. A server can run the same fixed step and
// broadcast this snapshot; rendering and input are independent adapters.
Object.defineProperty(window,'GameState',{get:()=>state});
window.RatRace=Object.freeze({get state(){return state;},snapshot:()=>JSON.parse(JSON.stringify(state))});

function frame(now){
  requestAnimationFrame(frame);
  const elapsed=Math.min((now-last)/1000,0.25);last=now;
  if(inGame&&!paused&&state.phase!=='ended'){
    accumulator+=elapsed;
    while(accumulator>=FIXED_DT){
      // Only transforms need interpolation. The authoritative state stays plain.
      previous={players:state.players.map(p=>({x:p.x,y:p.y,z:p.z})),rats:state.rats.map(r=>({x:r.x,y:r.y,z:r.z}))};
      stepGame(state,{0:input.sample()});accumulator-=FIXED_DT;
      if(state.phase==='ended')break;
    }
    if(state.phase!=='countdown'&&!$('countdown-screen').hidden)ui.showScreen(null);
  }
  if(inGame&&(now-lastUI>=80||state.phase==='ended'&&!endedShown)){ui.update(state);lastUI=now;}
  if(state.phase==='ended'&&!endedShown){endedShown=true;ui.end(state);if(input.locked)document.exitPointerLock();}
  renderer.render(state,{preview:!inGame,time:now/1000,previous:inGame?previous:null,alpha:paused?1:Math.min(1,accumulator/FIXED_DT)});
}
$('scene-loading').hidden=true;$('start-label').textContent='ENTER THE RAT RACE';$('start-button').disabled=false;
requestAnimationFrame(frame);
