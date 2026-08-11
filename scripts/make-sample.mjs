/**
 * Builds a deployable sample of the scan file.
 *
 * Takes whole groups from the source file until the output would exceed the
 * size budget, then closes the JSON. The result has the SAME nested shape as
 * the original, so the deployed build exercises the identical code path:
 * same tokenizer, same normalizer, same aggregation.
 *
 * Usage: node scripts/make-sample.mjs <source.json> [outPath] [budgetMB]
 *
 * Zero dependencies; streams — never holds the source in memory.
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

/**
 * Brace-depth scan (string-aware) over the `groups` object, emitting one
 * top-level group at a time. Mirrors src/workers/tokenizer.ts.
 */
async function main() {
  const total = statSync(src).size;
  const out = createWriteStream(outPath);
  out.write('{"_note":"Truncated sample of ui_demo.json — whole groups, identical schema. See README.","name":"default","groups":{');

  let buf = '';
  let inGroups = false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let groupStart = -1;
  let pendingKey = null;
  let written = 0;
  let groups = 0;
  let bytesRead = 0;

  const stream = createReadStream(src, { encoding: 'utf8', highWaterMark: 1 << 20 });

  for await (const chunk of stream) {
    bytesRead += Buffer.byteLength(chunk);
    buf += chunk;

    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];

      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        if (!inGroups) {
          // looking for the "groups" key
          const ahead = buf.slice(i, i + 9);
          if (ahead === '"groups":' || ahead.startsWith('"groups"')) {
            const colon = buf.indexOf(':', i);
            const brace = buf.indexOf('{', colon);
            if (colon !== -1 && brace !== -1) {
              inGroups = true;
              i = brace;
              depth = 0;
            }
          }
        } else if (depth === 0) {
          // a group name key at the top level of `groups`
          const end = buf.indexOf('"', i + 1);
          if (end === -1) break;            // need more data
          pendingKey = buf.slice(i, end + 1);
          i = end;
          inString = false;
        }
        continue;
      }

      if (!inGroups) continue;

      if (c === '{') {
        if (depth === 0) groupStart = i;
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0 && groupStart !== -1 && pendingKey !== null) {
          const body = buf.slice(groupStart, i + 1);
          const entry = `${groups > 0 ? ',' : ''}${pendingKey}:${body}`;
          if (written + entry.length > BUDGET) {
            out.write('}}\n');
            out.end();
            await new Promise((r) => out.on('close', r));
            console.log(`\nWrote ${outPath}`);
            console.log(`  groups: ${groups}`);
            console.log(`  size:   ${mb(statSync(outPath).size)} (budget ${mb(BUDGET)})`);
            console.log(`  source: ${mb(total)} — sample is ${((statSync(outPath).size / total) * 100).toFixed(1)}%`);
            return;
          }
          out.write(entry);
          written += entry.length;
          groups++;
          process.stdout.write(`\r  ${groups} groups · ${mb(written)} · read ${mb(bytesRead)}/${mb(total)}`);
          groupStart = -1;
          pendingKey = null;
        } else if (depth < 0) {
          // end of the groups object
          out.write('}}\n');
          out.end();
          await new Promise((r) => out.on('close', r));
          console.log(`\nWrote ${outPath} (entire source fit): ${groups} groups, ${mb(statSync(outPath).size)}`);
          return;
        }
      }
    }

    // Retain only the in-flight group; drop everything already emitted.
    if (groupStart !== -1) {
      buf = buf.slice(groupStart);
      groupStart = 0;
    } else if (pendingKey === null) {
      buf = buf.slice(-16);   // keep a small tail in case a key straddles chunks
    }
  }

  out.write('}}\n');
  out.end();
  await new Promise((r) => out.on('close', r));
  console.log(`\nWrote ${outPath}: ${groups} groups, ${mb(statSync(outPath).size)} (source truncated before budget)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
