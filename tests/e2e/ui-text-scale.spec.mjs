import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.resolve('docs/blueprint/evidence/ui-existing-2026-11-02/text-scale');fs.mkdirSync(out,{recursive:true});
const results=[];
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
for(const d of [{id:'phone-390',width:390,height:844,touch:true},{id:'phone-landscape',width:844,height:390,touch:true},{id:'desktop-1440',width:1440,height:900,touch:false}]){
 const ctx=await browser.newContext({viewport:{width:d.width,height:d.height},hasTouch:d.touch,isMobile:d.touch});
 const p=await ctx.newPage();p.setDefaultTimeout(30000);await ctx.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const r={id:'TEXT-200',device:d.id,method:'UI controls on settings screen; no gameplay/world fixture',status:'running'};results.push(r);
 const measure=()=>p.evaluate(()=>Object.fromEntries(['.panel-head h2','.panel .tab','.panel-body','.panel .btn'].map(sel=>{const e=document.querySelector(sel);return[sel,e?{text:e.textContent.trim().slice(0,80),fontSize:parseFloat(getComputedStyle(e).fontSize)}:null];})));
 try{
  await p.goto('http://127.0.0.1:5186',{timeout:120000});await p.waitForFunction(()=>window.__mnm?.initialized,null,{timeout:90000});
  await p.evaluate(async()=>{const {useUI}=await import('/src/ui/store.ts');useUI.getState().set({screen:'menu',overlay:'settings',settingsTab:'access'});});
  const input=p.getByLabel('Cỡ chữ giao diện (số)',{exact:true});await input.waitFor();r.before=await measure();
  await p.screenshot({path:path.join(out,d.id+'-100.png'),timeout:30000});await input.fill('2');await p.waitForTimeout(200);r.after=await measure();
  r.cssScale=await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ts'));
  await p.screenshot({path:path.join(out,d.id+'-200.png'),timeout:30000});
  for(const selector of ['.panel-head h2','.panel .tab'])assert.ok(r.after[selector].fontSize/r.before[selector].fontSize>=1.9,selector+' should grow with interface text scale 200%');
  r.status='passed';
 }catch(e){r.status='failed';r.error=e.message;}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({baseline:'5491081',results},null,2));await ctx.close();console.log(d.id+' '+r.status);}
}
await browser.close();if(results.some(r=>r.status==='failed'))process.exitCode=1;
