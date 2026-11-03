/** Supplementary visual states captured before actions dismiss them. Not user journeys. */
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const out=path.resolve('docs/blueprint/evidence/ui-existing-2026-11-02/state-catalog');fs.mkdirSync(out,{recursive:true});
const devices=[['desktop-1440',1440,900,false],['desktop-1280',1280,720,false],['phone-390',390,844,true],['phone-360',360,800,true],['phone-landscape',844,390,true],['tablet-portrait',768,1024,true],['tablet-landscape',1024,768,true],['edge-desktop',1280,720,false]];
const report={baseline:'5491081cf5b3ea364c69ad7cca4e203c61b4b74a',specSha256:crypto.createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex'),method:'Supplementary rendered-state fixtures: captions are actual browser UI, navigation/function evidence belongs to main suite',results:[]};
const flush=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
for(const [id,width,height,touch] of devices){
 const browser=await chromium.launch({executablePath:id==='edge-desktop'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const ctx=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,deviceScaleFactor:touch?2:1});
 await ctx.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const p=await ctx.newPage();p.setDefaultTimeout(30000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const ui=v=>p.evaluate(async v=>(await import('/src/ui/store.ts')).useUI.getState().set(v),v);
 async function capture(key,screens,setup){const r={device:id,key,screens,method:report.method,status:'running',startedAt:new Date().toISOString()};report.results.push(r);try{await setup();await p.waitForTimeout(200);r.body=await p.locator('body').innerText();r.state=await p.evaluate(async()=>{const u=(await import('/src/ui/store.ts')).useUI.getState();return{screen:u.screen,overlay:u.overlay,loading:u.loading?.stage};});r.screenshot=id+'-'+key+'.png';await p.screenshot({path:path.join(out,r.screenshot),timeout:45000});r.errors=[...errors];r.status='passed';}catch(e){r.status='failed';r.error=e.message;}r.finishedAt=new Date().toISOString();flush();console.log(id+' '+key+' '+r.status);}
 try{
  await p.goto('http://127.0.0.1:5186',{timeout:120000});await p.waitForFunction(()=>window.__mnm?.initialized,null,{timeout:90000});
  await capture('create-preview',['U03'],async()=>{await ui({screen:'create',overlay:null});await p.getByLabel(/Tên nhân vật/).fill('Kiểm Thử Preview');await p.locator('.preview3d canvas, canvas.preview3d').first().waitFor({timeout:90000});await p.waitForTimeout(500);});
  await capture('setup-custody',['U36'],async()=>{await p.getByLabel(/Tên nhân vật/).press('Enter');await p.getByRole('radio',{name:/Thụ án/}).click();await p.getByRole('radio',{name:'20 năm',exact:true}).click();});
  await capture('auth-unconfigured',['U02'],()=>ui({screen:'auth',overlay:null}));
  await capture('lobby-unavailable',['U24'],()=>ui({screen:'lobby',overlay:null}));
  await ui({screen:'menu',overlay:'settings',settingsTab:'graphics'});await p.getByRole('button',{name:'Thấp',exact:true}).click();await p.getByLabel('Tỉ lệ độ phân giải (số)',{exact:true}).fill('0.65');await p.getByLabel('Bóng đổ ngoài trời',{exact:false}).uncheck();
  await ui({overlay:'saves'});await p.evaluate(async()=>window.__auditUI=(await import('/src/ui/store.ts')).useUI);
  await p.locator('input[type=file]').setInputFiles(path.resolve('docs/blueprint/evidence/ui-existing-2026-11-02/restart-final/desktop-1440/save-export.json'));
  await p.waitForFunction(()=>window.__auditUI.getState().screen==='game'&&!!window.__mnm.s&&!!window.__mnm.view&&!window.__mnm.booting,null,{timeout:120000});
  for(const [key,screen] of [['handbook','U14'],['map','U13'],['sleep','U16']])await capture(key,[screen],async()=>{if(key==='sleep')await p.evaluate(async()=>{const c=window.__mnm,W=await import('/src/content/world.ts'),L=await import('/src/domain/life.ts');const slot=W.SLOTS.find(x=>x.propId===L.currentBed(c.s)&&x.kind==='sleep');c.s.player.pos={...slot.pos};c.s.player.zone=slot.zone;c.s.player.lastSafe={...slot.pos};c.bump();});await ui({overlay:key});await p.getByRole('dialog').first().waitFor();});
  await capture('scene',['U15'],()=>ui({overlay:'scene',overlayParams:{title:'Cuộc gọi kiểm thử',lines:'Người thân: Chào bạn.\nBạn: Mình vẫn ổn.\nNgười thân: Hẹn gặp lại.'}}));
  await capture('recovery',['U25'],async()=>{await ui({overlay:null,fatal:{title:'Không đọc được checkpoint',message:'Fixture giao diện recovery; không phải lỗi mất save thật.',code:'AUDIT-RECOVERY'}});await p.getByRole('alertdialog').waitFor();});
  await capture('ending',['U35'],()=>ui({fatal:null,screen:'ending',overlay:null,ending:{title:'Hành trình kiểm thử',text:['Fixture để chụp màn kết thúc; chưa chứng minh hoàn tất nhiệm vụ thật.'],summary:['Giữ biên nhận','Không lặp quyết toán']}}));
 }catch(e){report.results.push({device:id,key:'SETUP',status:'blocked',error:e.message});flush();}
 finally{await ctx.close();await browser.close();}
}
report.finishedAt=new Date().toISOString();flush();if(report.results.some(r=>r.status!=='passed'))process.exitCode=1;
