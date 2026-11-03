import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(process.argv[2]??'docs/blueprint/evidence/ui-existing-2026-11-02');
const runs=fs.readdirSync(root).filter(n=>n.startsWith('restart-')&&fs.existsSync(path.join(root,n,'results.json')));
const rows=[],manifests=[];
for(const run of runs){
 const m=JSON.parse(fs.readFileSync(path.join(root,run,'results.json'),'utf8'));
 manifests.push({run,startedAt:m.startedAt,finishedAt:m.finishedAt,baselineCommit:m.baselineCommit,specSha256:m.specSha256});
 for(const r of m.results)rows.push({...r,run});
}
const allCases=rows.filter(r=>['passed','failed','blocked'].includes(r.status));
const selected=new Map();
for(const r of rows.filter(r=>r.status==='metadata'))selected.set(r.device,r.run);
const cases=allCases.filter(r=>selected.get(r.device)===r.run);
const evidenceCompleteness={cases:cases.length,withScreenshot:cases.filter(r=>r.evidence?.screenshot).length,withCaseJson:cases.filter(r=>r.evidence?.details).length,missingScreenshot:cases.filter(r=>!r.evidence?.screenshot).map(({run,device,id,status,evidenceError})=>({run,device,id,status,evidenceError}))};
const stats=rs=>({total:rs.length,passed:rs.filter(r=>r.status==='passed').length,failed:rs.filter(r=>r.status==='failed').length,blocked:rs.filter(r=>r.status==='blocked').length});
const devices=[...new Set(cases.map(r=>r.device))];
const esc=s=>String(s??'').replaceAll('|','\\|').replaceAll('\n',' ');
const link=(r,k,label)=>r.evidence?.[k]?`[${label}](${r.run}/${r.evidence[k]})`:'—';
const summary={generatedAt:new Date().toISOString(),manifests,selectionRule:'Latest completed device attempt (META-browser present); partial/blocked earlier attempts remain in raw results but are excluded from primary totals',selectedRuns:Object.fromEntries(selected),allAttemptStats:stats(allCases),stats:stats(cases),evidenceCompleteness,devices:devices.map(d=>({device:d,...stats(cases.filter(r=>r.device===d))})),screenCoverage:Array.from({length:38},(_,i)=>{const id='U'+String(i+1).padStart(2,'0'),rs=cases.filter(r=>r.screens?.includes(id));return{id,...stats(rs),devices:[...new Set(rs.map(r=>r.device))]};}),failures:cases.filter(r=>r.status!=='passed').map(r=>({run:r.run,device:r.device,id:r.id,status:r.status,error:r.error?.message,evidenceError:r.evidenceError,evidence:r.evidence})),metadata:rows.filter(r=>r.status==='metadata'&&selected.get(r.device)===r.run)};
fs.writeFileSync(path.join(root,'coverage.json'),JSON.stringify(summary,null,2));
const md=['# Evidence index — existing UI','',`Generated ${summary.generatedAt}. Baseline 5491081. Only restart-* runs below; pilot folders are diagnostic. These are browser viewport/touch emulations, not physical device certification.`, '', '## Runs','',...manifests.map(m=>`- [${m.run}](${m.run}/results.json): ${m.finishedAt?'finished '+m.finishedAt:'IN PROGRESS'}; spec SHA256 ${m.specSha256}`),'','## Device totals','','| Device | Cases | Passed | Failed | Blocked |','|---|---:|---:|---:|---:|',...summary.devices.map(d=>`| ${d.device} | ${d.total} | ${d.passed} | ${d.failed} | ${d.blocked} |`),'','## Screen IDs','','Presence means at least one case references the screen. It does not prove every control/state was exercised.','','| Screen | Passed cases | Failed cases | Device count |','|---|---:|---:|---:|',...summary.screenCoverage.map(s=>`| ${s.id} | ${s.passed} | ${s.failed} | ${s.devices.length} |`),'','## Case register','','Each JSON includes assertions, state before/after, rendered control inventory and layout. PNGs show the actual result, including failures.','','| Run / device | Case | Status | Method | Evidence |','|---|---|---|---|---|',...cases.map(r=>`| ${r.run} / ${r.device} | ${r.id}: ${esc(r.title)} | ${r.status} | ${esc(r.method)} | ${link(r,'screenshot','PNG')} ${link(r,'scrolledScreenshot','bottom')} ${link(r,'details','JSON')} |`),'','## Failures requiring triage','','A failed assertion alone does not establish an application defect. See the audit report for classification.','','| Device | Case | Error |','|---|---|---|',...summary.failures.map(r=>`| ${r.device} (${r.run}) | ${r.id} | ${esc(r.error)} |`),''];
md.push('## Browser evidence','','| Device | Selected run | Trace and logs |','|---|---|---|',...devices.map(d=>{const run=selected.get(d),p=run+'/'+d;return `| ${d} | ${run} | [trace](${p}/trace.zip) [exceptions](${p}/browser-errors.json) [console](${p}/console.json) [network](${p}/network.json) |`;}),'');
for(const folder of ['state-catalog','followup-stable','text-scale']){
 const file=path.join(root,folder,'results.json');if(!fs.existsSync(file))continue;
 const data=JSON.parse(fs.readFileSync(file,'utf8'));md.push('## '+folder,'',`[Full JSON](${folder}/results.json). Supplementary cases are excluded from primary functional totals.`,'','| Device | Case / state | Status | Screenshot |','|---|---|---|---|');
 for(const r of data.results){const png=r.screenshot?`[PNG](${folder}/${r.screenshot})`:folder==='text-scale'?`[100%](${folder}/${r.device}-100.png) [200%](${folder}/${r.device}-200.png)`:'—';md.push(`| ${r.device} | ${r.id??r.key} | ${r.status} | ${png} |`);}md.push('');
}
fs.writeFileSync(path.join(root,'README.md'),md.join('\n').replaceAll('IN PROGRESS','not completed (diagnostic/superseded unless this is the current final run)'));
const inventory=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory()){walk(p);}else if(entry.name!=='sha256.json'){const b=fs.readFileSync(p);inventory.push({path:path.relative(root,p).replaceAll('\\','/'),bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}}}
walk(root);fs.writeFileSync(path.join(root,'sha256.json'),JSON.stringify(inventory,null,2));
console.log(JSON.stringify({stats:summary.stats,devices:summary.devices,screens:summary.screenCoverage.filter(s=>s.total).length,files:inventory.length},null,2));
