import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const suite=process.env.QA_SUITE||'unknown';
const outcome=process.env.QA_TEST_OUTCOME||'unknown';
if(!/^[a-z0-9-]{2,64}$/.test(suite))throw new Error('INVALID_QA_SUITE');
if(!['success','failure','skipped','cancelled','unknown'].includes(outcome))throw new Error('INVALID_QA_OUTCOME');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('INVALID_TESTED_SHA');
const root=resolve('qa-output'),logs=resolve(root,'logs');
await mkdir(logs,{recursive:true});
const info=[];
for(const name of (await readdir(logs)).filter(n=>/^[a-z0-9-]+\.log$/.test(n)).sort()){
 const bytes=await readFile(resolve(logs,name)),body=bytes.toString('utf8');
 const counters=[...body.matchAll(/# (tests|pass|fail)\s+(\d+)/g)];
 const passed=[...body.matchAll(/(\d+) passed(?: \([\d.]+s\))?/g)].at(-1);
 const failed=[...body.matchAll(/(\d+) failed(?: \([\d.]+s\))?/g)].at(-1);
 const summaries=body.split('\n').filter(s=>/QA_(ORACLE_|NATIVE_PDF|REAL_PIXEL_OCR|REAL_OCR_UI|MOBILE_VIEWPORTS|LOCAL_STAGE)/.test(s));
 info.push({file:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
  node:Object.fromEntries(counters.map(m=>[m[1],Number(m[2])])),
  browserPassed:passed?Number(passed[1]):null,browserFailed:failed?Number(failed[1]):0,
  oracleSummaries:summaries.slice(-50).map(s=>s.slice(0,1500))});
}
const base=process.env.GITHUB_SERVER_URL&&process.env.GITHUB_REPOSITORY&&process.env.GITHUB_RUN_ID
 ?process.env.GITHUB_SERVER_URL+'/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID
 :null;
const manifest={schemaVersion:1,suite,runOutcome:outcome,testedCommitSha:sha,
 runId:process.env.GITHUB_RUN_ID||null,attempt:process.env.GITHUB_RUN_ATTEMPT||null,
 runUrl:base,createdAt:new Date().toISOString(),
 QAClass:'developer-automated',independentQA:'NOT RUN',productionDecision:'NO-GO',
 sourceData:'synthetic-only',logs:info};
await writeFile(resolve(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const report=[
 '# Äppejä Import Engine — CI QA -raportti','',
 'Testattu SHA: '+sha,
 'QA-kerros: '+suite,
 'Testin tila: '+outcome.toUpperCase(),
 'Automaattinen developer-QA; riippumaton QA NOT RUN; tuotanto NO-GO.',
 'GitHub Actions: '+(base||'ei saatavilla'),
 'Aikaleima: '+manifest.createdAt,'',
 'Raakalogit ja tarkisteet:',
 ...info.map(x=>'- logs/'+x.file+' : '+x.bytes+' tavua; sha256 '+x.sha256),'',
 'QA_* -tulokset on säilytetty manifestissa ja alkuperäisessä lokissa.',
 'Ladattava ZIP on määräaikainen. Pysyvä GO/NO-GO kirjataan PR-kommenttiin.',
 'Alkuperäisiä yksityisiä palkka- tai pankkitiedostoja ei saa lisätä tähän CI-pakettiin.',''
].join('\n');
await writeFile(resolve(root,'report.md'),report);
console.log('QA_ARCHIVE_MANIFEST '+JSON.stringify({suite,outcome,sha,logs:info.length}));
