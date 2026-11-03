/** Verify evidence completeness/integrity. Passing this does not mean the game passed QA. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve('docs/blueprint/evidence/ui-existing-2026-11-02');
const run=JSON.parse(fs.readFileSync(path.join(root,'restart-final/results.json'),'utf8'));
assert.ok(run.finishedAt,'Final run must have finished');
const cases=run.results.filter(r=>['passed','failed','blocked'].includes(r.status));
const devices=[...new Set(cases.map(r=>r.device))];assert.equal(devices.length,8);assert.equal(cases.length,712);
const screens=new Set();let screenshots=0;
for(const d of devices){assert.equal(cases.filter(r=>r.device===d).length,89);assert.ok(run.results.some(r=>r.device===d&&r.id==='META-browser'));}
for(const r of cases){
 assert.ok(r.evidence?.screenshot,r.device+' '+r.id+' missing screenshot');assert.ok(r.evidence?.details);
 for(const k of ['screenshot','scrolledScreenshot'])if(r.evidence[k]){const b=fs.readFileSync(path.join(root,'restart-final',r.evidence[k]));assert.equal(b.subarray(1,4).toString(),'PNG');assert.ok(b.readUInt32BE(16)>0&&b.readUInt32BE(20)>0);screenshots++;}
 JSON.parse(fs.readFileSync(path.join(root,'restart-final',r.evidence.details),'utf8'));r.screens?.forEach(s=>screens.add(s));
}
assert.equal(screens.size,38);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'spec-final.mjs'))).digest('hex'),run.specSha256);
const catalog=JSON.parse(fs.readFileSync(path.join(root,'state-catalog/results.json'),'utf8'));assert.ok(catalog.finishedAt);assert.equal(catalog.results.length,80);
for(const r of catalog.results){assert.equal(r.status,'passed',r.device+' '+r.key+': '+r.error);assert.ok(fs.existsSync(path.join(root,'state-catalog',r.screenshot)));}
let links=0;
for(const file of ['docs/blueprint/20-existing-ui-test-plan.md','docs/blueprint/21-existing-ui-audit-results.md',path.join(root,'README.md')]){
 const md=fs.readFileSync(file,'utf8');for(const m of md.matchAll(/\]\(([^)]+)\)/g)){const href=m[1];if(href.startsWith('http')||href.startsWith('#'))continue;assert.ok(fs.existsSync(path.resolve(path.dirname(file),href)),file+' broken link '+href);links++;}
}
const inventory=JSON.parse(fs.readFileSync(path.join(root,'sha256.json'),'utf8'));
for(const f of inventory){const b=fs.readFileSync(path.join(root,f.path));assert.equal(b.length,f.bytes,f.path);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256,f.path);}
console.log(JSON.stringify({evidenceIntegrity:'passed (not product QA verdict)',devices:devices.length,cases:cases.length,logicalScreens:screens.size,primaryPngsIncludingScrolled:screenshots,catalogScreenshots:catalog.results.length,checkedLinks:links,hashedFiles:inventory.length},null,2));
