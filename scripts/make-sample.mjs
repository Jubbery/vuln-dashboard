/**
 * Builds a deployable sample of the scan file.
 *
 * Streams the source and copies whole REPOS (not whole groups — the source
 * has only 6 groups averaging ~45MB, so group granularity could fit nothing
 * into the budget) until the output would exceed the size budget. The result
 * has the SAME nested shape as the original, so the deployed build exercises
 * the identical code path: same tokenizer, same normalizer, same aggregation.
 *
 * Usage: node scripts/make-sample.mjs <source.json> [outPath] [budgetMB]
 *
 * Zero dependencies. Sequential single-pass parse with an explicit cursor —
 * the buffer only ever holds the value currently being scanned.
 */

import { createReadStream, createWriteStream, statSync } from 'node:fs';
import process from 'node:process';

const [, , src, outPath = 'public/ui_demo.sample.json', budgetArg = '45'] = process.argv;

if (!src) {
  console.error('usage: node scripts/make-sample.mjs <source.json> [outPath] [budgetMB]');
  process.exit(1);
}

const BUDGET = Number(budgetArg) * 1024 * 1024;
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`;

// ---------------------------------------------------------------- reader ---
// Chunked reader with an absolute-position cursor. `need(i)` guarantees the
// buffer extends past index i (or throws at EOF). `drop(i)` discards
// everything before i so memory stays bounded by the largest single value.

const total = statSync(src).size;
const stream = createReadStream(src, { encoding: 'utf8', highWaterMark: 1 << 20 });
const chunks = stream[Symbol.asyncIterator]();
let buf = '';
let bytesRead = 0;
let eof = false;

async function need(i) {
  while (i >= buf.length) {
    const { value, done } = await chunks.next();
    if (done) { eof = true; return false; }
    bytesRead += Buffer.byteLength(value);
    buf += value;
  }
  return true;
}

function drop(i) {
  buf = buf.slice(i);
  return 0;
}

// ---------------------------------------------------------------- lexing ---

async function skipWs(i) {
  for (;;) {
    if (!(await need(i))) return i;
    const c = buf[i];
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === ',') i++;
    else return i;
  }
}

/** buf[i] must be '"'. Returns index just past the closing quote. */
async function scanString(i) {
  i++; // opening quote
  let escaped = false;
  for (;;) {
    if (!(await need(i))) throw new Error('EOF inside string');
    const c = buf[i];
    if (escaped) escaped = false;
    else if (c === '\\') escaped = true;
    else if (c === '"') return i + 1;
    i++;
  }
}

/** buf[i] must be '{' or '['. Returns index just past the matching close. */
async function scanContainer(i) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (;;) {
    if (!(await need(i))) throw new Error('EOF inside container');
    const c = buf[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === '{' || c === '[') {
      depth++;
    } else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
}

/** Scalar value (string/number/bool/null) starting at i. */
async function scanScalar(i) {
  if (buf[i] === '"') return scanString(i);
  for (;;) {
    if (!(await need(i))) return i;
    const c = buf[i];
    if (c === ',' || c === '}' || c === ']' || c === ' ' || c === '\n' || c === '\r' || c === '\t') return i;
    i++;
  }
}

// ----------------------------------------------------------------- main ----

async function main() {
  const out = createWriteStream(outPath);
  out.write('{"_note":"Truncated sample of ui_demo.json — whole repos, identical schema. See README.","name":"default","groups":{');

  // Position the cursor just past `"groups":` + '{'.
  for (;;) {
    const idx = buf.indexOf('"groups"');
    if (idx !== -1) {
      let i = buf.indexOf('{', idx + 8);
      while (i === -1) {
        if (!(await need(buf.length))) throw new Error('no groups object');
        i = buf.indexOf('{', idx + 8);
      }
      drop(i + 1);
      break;
    }
    if (!(await need(buf.length))) throw new Error('no "groups" key found');
  }

  let written = 0;
  let groupsOut = 0;
  let reposOut = 0;
  let budgetHit = false;

  // At the top level of the groups object.
  groupLoop:
  for (;;) {
    let i = await skipWs(0);
    if (eof && i >= buf.length) break;
    if (buf[i] === '}') break;                       // end of groups object

    // group key
    const keyEnd = await scanString(i);
    const groupKey = buf.slice(i, keyEnd);
    i = await skipWs(keyEnd);
    if (buf[i] !== ':') throw new Error(`expected : after group key ${groupKey}`);
    i = await skipWs(i + 1);
    if (buf[i] !== '{') throw new Error(`expected { for group ${groupKey}`);
    i = drop(i + 1);                                 // inside the group object

    // Walk the group object's fields; copy scalars, sample "repos".
    const scalarFields = [];
    const repoEntries = [];
    for (;;) {
      i = await skipWs(i);
      if (buf[i] === '}') { i++; break; }            // end of group object

      const fEnd = await scanString(i);
      const fieldKey = buf.slice(i, fEnd);
      i = await skipWs(fEnd);
      if (buf[i] !== ':') throw new Error(`expected : after ${fieldKey} in group ${groupKey}`);
      i = await skipWs(i + 1);

      if (fieldKey === '"repos"') {
        if (buf[i] !== '{') throw new Error(`expected { for repos of ${groupKey}`);
        i = drop(i + 1);                             // inside repos object
        for (;;) {
          i = await skipWs(i);
          if (buf[i] === '}') { i++; break; }        // end of repos

          const rEnd = await scanString(i);
          const repoKey = buf.slice(i, rEnd);
          i = await skipWs(rEnd);
          if (buf[i] !== ':') throw new Error(`expected : after repo ${repoKey}`);
          i = await skipWs(i + 1);
          const vEnd = await scanContainer(i);
          if (!budgetHit) {
            const entry = `${repoKey}:${buf.slice(i, vEnd)}`;
            if (written + entry.length > BUDGET) {
              budgetHit = true;                      // keep parsing, stop copying
            } else {
              repoEntries.push(entry);
              written += entry.length;
              reposOut++;
            }
          }
          i = drop(vEnd);
          process.stdout.write(`\r  ${groupsOut} groups · ${reposOut} repos · ${mb(written)} · read ${mb(bytesRead)}/${mb(total)}`);
        }
      } else if (buf[i] === '{' || buf[i] === '[') {
        const vEnd = await scanContainer(i);
        scalarFields.push(`${fieldKey}:${buf.slice(i, vEnd)}`);
        i = vEnd;
      } else {
        const vEnd = await scanScalar(i);
        scalarFields.push(`${fieldKey}:${buf.slice(i, vEnd)}`);
        i = vEnd;
      }
    }

    if (repoEntries.length > 0) {
      const head = scalarFields.length > 0 ? `${scalarFields.join(',')},` : '';
      out.write(`${groupsOut > 0 ? ',' : ''}${groupKey}:{${head}"repos":{${repoEntries.join(',')}}}`);
      groupsOut++;
    }
    i = drop(i);
    if (budgetHit) break groupLoop;                  // budget reached — done
  }

  out.write('}}\n');
  out.end();
  await new Promise((r) => out.on('close', r));
  const size = statSync(outPath).size;
  console.log(`\nWrote ${outPath}: ${groupsOut} groups, ${reposOut} repos, ${mb(size)}`);
  console.log(`  budget ${mb(BUDGET)} · source ${mb(total)} · sample is ${((size / total) * 100).toFixed(1)}% of source`);
  if (!budgetHit) console.log('  (entire source fit within the budget)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
