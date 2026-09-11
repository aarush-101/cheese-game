// Usage: node scripts/export-hands.mjs (development server on localhost:5173).
// Playwright is an authoring-only dependency; the game needs no build step.
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true});
try{
 const page=await browser.newPage();await page.route('**/src/main.js*',route=>route.abort());await page.goto('http://127.0.0.1:5173');
 const data=await page.evaluate(async()=>{const {authorHands}=await import('/scripts/author-hands.js');const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');const {scene,clips}=authorHands();const buffer=await new GLTFExporter().parseAsync(scene,{binary:true,animations:clips});return Array.from(new Uint8Array(buffer));});
 await writeFile(new URL('../assets/models/viewmodel/arms.glb',import.meta.url),new Uint8Array(data));console.log('Exported rig, skeletons and 16 clips:',data.length,'bytes');
}finally{await browser.close();}
