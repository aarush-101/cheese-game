// Start the static server first. Playwright is optional authoring/QA tooling.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],report=[];
page.on('pageerror',e=>errors.push(e.message));await mkdir('docs/research/release',{recursive:true});
try{
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.RatRace);
 await page.evaluate(async()=>{const {GameRenderer}=await import('/src/renderer.js'),old=GameRenderer.prototype.render;window.audit={renderer:null,frames:[],last:0};GameRenderer.prototype.render=function(s,o){const t=performance.now();old.call(this,s,o);window.audit.renderer=this;if(window.audit.last)window.audit.frames.push(t-window.audit.last);window.audit.last=t;};});
 for(const id of ['crumb-quarter','gouda-aqueduct','timber-hollow']){
  await page.selectOption('#map-select',id);await page.waitForTimeout(200);await page.screenshot({path:`docs/research/release/${id}.png`});
  await page.click('#start-button');await page.waitForFunction(()=>GameState.phase==='playing');
  await page.evaluate(()=>{GameState.players[1].controller='human';GameState.players[0].poison=true;window.audit.frames=[];});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>audit.renderer.viewmodel.poison.visible),true);
  await page.mouse.down();await page.mouse.up();await page.waitForFunction(()=>GameState.players[0].pendingThrow!==null);
  assert.equal(await page.evaluate(()=>GameState.players[0].poison),true);
  await page.keyboard.press('Escape');await page.waitForTimeout(60);
  const paused=await page.evaluate(()=>GameState.time);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>GameState.time),paused);
  await page.click('#resume-button');await page.waitForTimeout(650);
  assert.equal(await page.evaluate(()=>GameState.players[0].poison),false);assert.equal(await page.evaluate(()=>GameState.events.filter(e=>e.type==='throw').length),1);
  await page.evaluate(()=>{const p=GameState.players[0],b=GameState.bases[0];Object.assign(p,{x:b.x+8,y:0,z:b.z,cheese:0,vy:0,vx:0,vz:0,grounded:true});});await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>audit.renderer.viewmodel.cheese.visible),false);
  await page.evaluate(()=>{const p=GameState.players[0],b=GameState.bases[0];Object.assign(p,{x:b.x,z:b.z});});await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(()=>GameState.players[0].cheese),100);assert.equal(await page.evaluate(()=>audit.renderer.viewmodel.cheese.visible),true);
  await page.evaluate(()=>{GameState.players[0].poison=true;});await page.waitForTimeout(100);await page.screenshot({path:`docs/research/release/${id}-hands.png`});
  report.push(await page.evaluate(()=>{const a=audit.frames.slice().sort((a,b)=>a-b);return{map:GameState.mapId,frames:a.length,medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)],...RatRace.diagnostics};}));
  await page.evaluate(()=>{const b=GameState.bases[0];GameState.rats.forEach(r=>Object.assign(r,{x:b.x,y:b.y,z:b.z,capturedBy:0,target:'base:0'}));GameState.remaining=.001;});await page.waitForFunction(()=>GameState.phase==='ended');
  await page.click('#rematch-button');await page.waitForFunction(()=>GameState.phase==='playing');assert.equal(await page.evaluate(()=>GameState.projectiles.length),0);assert.equal(await page.evaluate(()=>GameState.players[0].poison),false);
  await page.keyboard.press('Escape');await page.click('#quit-button');
 }
 await page.click('#settings-button');await page.selectOption('#quality-setting','low');assert.equal(await page.evaluate(()=>audit.renderer.renderer.shadowMap.enabled),false);await page.check('#sprint-setting');await page.check('#bob-setting');await page.locator('#settings-dialog .primary-button').click();
 await page.click('#start-button');await page.waitForFunction(()=>GameState.phase==='playing');await page.keyboard.press('ShiftLeft');await page.keyboard.down('KeyW');await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>GameState.players[0].sprinting),true);await page.keyboard.press('ShiftLeft');await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>GameState.players[0].sprinting),false);await page.keyboard.up('KeyW');
 await page.goto('http://localhost:5173/?practice=1');await page.waitForFunction(()=>window.RatRace);assert.equal(await page.evaluate(()=>GameState.mapId),'movement-lab');
 await page.goto('http://localhost:5173/docs/map-atlas.html');await page.waitForFunction(()=>document.querySelector('#floor').options.length>1);await page.selectOption('#map','timber-hollow');await page.selectOption('#floor','-8');
 assert.deepEqual(errors,[]);await writeFile('docs/research/release/browser-report.json',JSON.stringify({viewport:[1440,900],note:'Headless Chrome smoke test; action, pause and screenshot frames are included. Not a hardware benchmark.',maps:report,errors},null,2));console.log(JSON.stringify({passed:true,maps:report,errors},null,2));
}finally{await browser.close();}
