/** Targeted independent follow-up: valid import readiness and modal accessibility. */
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.resolve('docs/blueprint/evidence/ui-existing-2026-11-02/followup-stable');
fs.mkdirSync(out,{recursive:true});
const results=[];
for(const d of [{id:'phone-390',width:390,height:844,touch:true},{id:'desktop-1440',width:1440,height:900,touch:false}]){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const ctx=await browser.newContext({viewport:{width:d.width,height:d.height},hasTouch:d.touch,isMobile:d.touch,deviceScaleFactor:1});
 await ctx.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const p=await ctx.newPage();p.setDefaultTimeout(15000);const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({baseline:'5491081',results},null,2));
 async function test(id,fn){const r={device:d.id,id,status:'running',startedAt:new Date().toISOString()};results.push(r);try{await fn(r);r.status='passed';}catch(e){r.status='failed';r.error=e.message;}r.url=p.url();r.body=await p.locator('body').innerText().catch(()=>null);r.errors=[...errors];r.screenshot=`${d.id}-${id}.png`;await p.screenshot({path:path.join(out,r.screenshot),timeout:30000}).catch(e=>r.evidenceError=e.message);r.finishedAt=new Date().toISOString();save();console.log(d.id+' '+id+' '+r.status);}
 try{
 await p.goto('http://127.0.0.1:5186',{timeout:120000}); await p.waitForFunction(() => window.__mnm, null, { timeout: 60000 });await p.waitForFunction(()=>window.__mnm?.initialized,null,{timeout:90000});await p.evaluate(async()=>{window.__auditUI=(await import('/src/ui/store.ts')).useUI;});
 await test('F01-valid-import-ready',async r=>{
  await p.evaluate(async()=>{const {useUI}=await import('/src/ui/store.ts');useUI.getState().set({screen:'menu',overlay:'saves'});});
  await p.locator('input[type=file]').setInputFiles(path.resolve('docs/blueprint/evidence/ui-existing-2026-11-02/restart-a/phone-390/save-export.json'));
  await p.waitForFunction(()=>window.__auditUI.getState().screen==='game'&&!!window.__mnm.view&&!!window.__mnm.s&&!window.__mnm.booting,null,{timeout:120000});
  r.state=await p.evaluate(()=>({name:window.__mnm.s.character.name,episode:window.__mnm.s.life.episode.state,balance:window.__mnm.s.life.account.balance}));
  assert.equal(r.state.episode,'admitted');
 });
 await test('F02-tabs-arrow-focus',async r=>{
  await p.evaluate(async()=>{(await import('/src/ui/store.ts')).useUI.getState().set({overlay:'profile',profileTab:'profile'});});
  await p.waitForFunction(()=>window.__auditUI.getState().screen==='game'&&!window.__mnm.booting);const tabs=p.getByRole('tab');await tabs.first().focus();await p.keyboard.press('ArrowRight');
  r.focus=await p.evaluate(()=>({active:document.activeElement?.textContent,selected:document.querySelector('[role=tab][aria-selected=true]')?.textContent}));
  assert.equal(r.focus.active,r.focus.selected,'ArrowRight should move focus to the newly selected tab');
 });
 await test('F03-quickmenu-focus',async r=>{
  await p.evaluate(async()=>{(await import('/src/ui/store.ts')).useUI.getState().set({overlay:'quickmenu'});});
  const menu=p.getByRole('dialog',{name:'Menu',exact:true});await menu.waitFor();
  r.focusOnOpen=await menu.evaluate(e=>e.contains(document.activeElement));
  await menu.getByRole('button').last().focus();await p.keyboard.press('Tab');
  r.focusAfterTab=await menu.evaluate(e=>e.contains(document.activeElement));
  assert.ok(r.focusOnOpen&&r.focusAfterTab,'Modal should receive and contain keyboard focus');
 });
 await test('F04-gamepad-start-held',async r=>{
  await p.evaluate(()=>{window.__auditUI.getState().set({overlay:null});window.__auditPad={id:'Synthetic audit gamepad',index:0,connected:true,mapping:'standard',buttons:Array.from({length:17},()=>({pressed:false,value:0,touched:false})),axes:[0,0,0,0],timestamp:performance.now()};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__auditPad]});});
  await p.waitForFunction(()=>window.__mnm.view?.gameplayInput);await p.waitForTimeout(300);await p.evaluate(()=>window.__auditPad.buttons[9]={pressed:true,value:1,touched:true});await p.waitForTimeout(500);
  r.overlay=await p.evaluate(()=>{const o=window.__auditUI.getState().overlay;window.__auditPad.buttons[9]={pressed:false,value:0,touched:false};return o;});assert.equal(r.overlay,'pause','Holding Start should leave pause open');
 });
 }catch(e){results.push({device:d.id,id:'SETUP',status:'blocked',error:e.message});save();}
 finally{await ctx.close();await browser.close();}
}
console.log(JSON.stringify(results.map(({device,id,status,error})=>({device,id,status,error}))));
if(results.some(r=>r.status!=='passed'))process.exitCode=1;
