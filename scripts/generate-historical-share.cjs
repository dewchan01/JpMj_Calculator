// Local conversion utility. Inputs are never modified; output contains share credentials.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText, filename);
const { presetRules, tableRules } = require('../packages/mahjong-rules/index.ts');
const { balances } = require('../packages/mahjong-core/ledger.ts');
const { finalStandings, adjustFinalPoints } = require('../packages/mahjong-core/final-results.ts');
const { parseArchive, gameArchive } = require('../apps/web/src/app/features/records/data-transfer/data-archive.ts');
const { gamesCsv, parseGamesCsv } = require('../apps/web/src/app/features/records/data-transfer/data-csv.ts');
function csv(source) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') { if (quoted && source[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  if (quoted) throw Error('Unclosed CSV quote');
  const headers = rows.shift();
  return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((h,i)=>[h,r[i] ?? ''])));
}
async function main() {
  const [pointsFile, scoresFile, output = 'artifacts/historical-share'] = process.argv.slice(2);
  if (!pointsFile || !scoresFile) throw Error('Pass points CSV, scores CSV and optional output directory.');
  const rows = csv(fs.readFileSync(pointsFile, 'utf8').replace(/^\uFEFF/, ''));
  const scores = csv(fs.readFileSync(scoresFile, 'utf8').replace(/^\uFEFF/, ''));
  if (rows.length !== scores.length) throw Error('CSV row counts differ');
  const corrections = [], comparisons = [];
  const matches = rows.map((row, index) => {
    const count = row.Mode === '4p' ? 4 : row.Mode === '3p' ? 3 : 0;
    const names = Object.keys(row).filter(k => !['Date','Time','Mode','Ruleset','Note'].includes(k) && row[k] !== '');
    if (names.length !== count || !count) throw Error(`Invalid players at row ${index+2}`);
    for (const k of ['Date','Time','Mode','Ruleset']) if (row[k] !== scores[index][k]) throw Error('CSV order differs');
    let points = names.map(n => Number(row[n]));
    if (points.some(p => !Number.isSafeInteger(p))) throw Error('Invalid points');
    const expected = count * (count === 4 ? 25000 : 35000);
    const sum = points.reduce((a,b)=>a+b,0);
    if (sum !== expected) {
      if (sum <= 0 || points.some(p=>p<0)) throw Error('Cannot proportionally normalize this row');
      const exact = points.map(p => p / sum * expected / 100);
      const units = exact.map(Math.floor);
      const order = exact.map((v,i)=>({i,f:v-units[i]})).sort((a,b)=>b.f-a.f || a.i-b.i);
      const remaining = expected/100-units.reduce((a,b)=>a+b,0);
      for(let j=0;j<remaining;j++) units[order[j].i]++;
      points = units.map(v=>v*100);
      corrections.push({row:index+2,date:row.Date,time:row.Time,method:'Proportional normalization, largest remainder, 100-point units; estimated, not recovered facts',players:names.map((n,i)=>({name:n,before:Number(row[n]),after:points[i],change:points[i]-Number(row[n])}))});
    }
    const preset = count === 4 ? 'm-league' : 'mahjong-soul';
    if (row.Ruleset !== (count === 4 ? 'M-League' : 'Mahjong Soul')) throw Error('Unexpected rules');
    const base = presetRules(preset,count);
    const rules = {...base,table:{...tableRules(base),uma:count===4?[30,10,-10,-30]:[15,0,-15],rounding:'none',tiedRanks:'seat-order'}};
    // Missing times use local midnight, without inventing elapsed hand history or game length.
    const timestamp = new Date(`${row.Date}T${row.Time || '00:00'}:00+08:00`).toISOString();
    const match = {id:`history-${crypto.createHash('sha256').update(JSON.stringify(row)+index).digest('hex').slice(0,24)}`,schemaVersion:1,createdAt:timestamp,updatedAt:timestamp,name:`${row.Date} ${row.Ruleset} #${index+1}`,playerCount:count,rules,
      players:names.map((name,i)=>({id:`p${i}`,name,profileId:`history-player-${crypto.createHash('sha256').update(name).digest('hex').slice(0,24)}`})),
      initialBalances:Object.fromEntries(names.map((_,i)=>[`p${i}`,base.startingPoints])),initialDealerId:'p0',dealerId:'p0',events:[],roundWind:'east',handNumber:1,honba:0,ended:true,endReason:'Imported final points only; round and dealer unavailable'};
    const imported = adjustFinalPoints(match,Object.fromEntries(names.map((_,i)=>[`p${i}`,points[i]])),`${match.id}-final-points`,timestamp);
    // Equal-point ties use CSV column order: source does not record initial seats.
    const standings = finalStandings(imported);
    for(const standing of standings) {
      const original = Number(scores[index][standing.name]);
      if (!Number.isFinite(original)) throw Error('Missing source score');
      comparisons.push({row:index+2,name:standing.name,points:standing.points,score:standing.finalScore,sourceScore:original});
      if (sum === expected && Math.abs(original-standing.finalScore)>1e-7) throw Error(`Score mismatch at row ${index+2}: ${standing.name}`);
    }
    if(Object.values(balances(imported).players).reduce((a,b)=>a+b,0)!==expected) throw Error('Points do not reconcile');
    if(Math.abs(standings.reduce((s,r)=>s+r.finalScore,0))>1e-7) throw Error('Scores do not reconcile');
    return imported;
  });
  const archive = JSON.stringify(gameArchive(matches));
  parseArchive(archive);
  const compatibleCsv = gamesCsv(matches);
  if(parseGamesCsv(compatibleCsv).matches.length !== matches.length) throw Error('CSV roundtrip failed');
  fs.mkdirSync(output,{recursive:true});
  const id=crypto.randomBytes(32).toString('hex'), secret=crypto.randomBytes(32).toString('hex');
  const hash=crypto.createHash('sha256').update(secret).digest('hex').toUpperCase();
  const bytes=Buffer.from(archive,'utf8');
  // One batch, no GO or explicit transaction: suitable for AdminNeo SQL Server execution.
  const sql=`-- SQL Server / AdminNeo: one standalone statement, no block or GO.\n-- Safe to rerun without extending expiry.\nINSERT INTO [Shares] ([Id],[Content],[Size],[ExpiresAt],[DeleteHash])\nSELECT '${id}',0x${bytes.toString('hex')},${bytes.length},DATEDIFF_BIG(SECOND,CONVERT(datetime2,'1970-01-01'),SYSUTCDATETIME())+86400,'${hash}'\nWHERE NOT EXISTS (SELECT 1 FROM [Shares] WHERE [Id]='${id}')\n`;
  fs.writeFileSync(path.join(output,'insert-share.adminneo.sql'),sql);
  fs.writeFileSync(path.join(output,'games.csv'),'\uFEFF'+compatibleCsv);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({games:matches.length,corrections,comparisons,timezone:'+08:00',missingTimes:'00:00',ties:'CSV column order; source has no seat order',deletionSecret:secret,id},null,2));
  fs.writeFileSync(path.join(output,'transfer-id.txt'),id+'\n');
  await require('qrcode').toFile(path.join(output,'share-qr.png'),JSON.stringify({format:'riichi-share',version:1,id}),{width:640,margin:4});
  console.log(JSON.stringify({games:matches.length,bytes:bytes.length,corrections,output},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
