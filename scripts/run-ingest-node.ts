/**
 * Node harness driving the EXACT worker pipeline (tokenizer -> normalize ->
 * aggregate) against the real file, for measurement and cross-validation
 * against scripts/inspect-data.mjs.
 *
 * Usage: node --experimental-strip-types scripts/run-ingest-node.ts <path-to-ui_demo.json>
 */

import { createReadStream, statSync } from 'node:fs';
import { createImageTokenizer } from '../src/workers/tokenizer.ts';
import { createNormalizer } from '../src/workers/normalize.ts';
import { computeAggregates } from '../src/workers/aggregate.ts';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node --experimental-strip-types scripts/run-ingest-node.ts <file>');
  process.exit(1);
}

const fileBytes = statSync(filePath).size;
const t0 = performance.now();

const normalizer = createNormalizer();
const tokenizer = createImageTokenizer((e) => normalizer.addImage(e.group, e.repo, e.imageKey, e.raw));

let peakRss = 0;
const sampleRss = (): void => {
  const rss = process.memoryUsage().rss;
  if (rss > peakRss) peakRss = rss;
};

const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1 << 20 });
let i = 0;
for await (const chunk of stream) {
  tokenizer.push(chunk as string);
  if (++i % 32 === 0) sampleRss();
}
const tParse = performance.now();

const tok = tokenizer.finish();
const norm = normalizer.finish();
sampleRss();
const aggregates = computeAggregates(
  norm.occurrences, norm.imageMeta, norm.cveCatalog,
  { groups: tok.groupCount, repos: tok.repoCount },
  { byRiskFactor: norm.byRiskFactor, withFixCount: norm.withFixCount },
);
const tAgg = performance.now();
sampleRss();

// Rough serialized size of the normalized dataset (what the tab retains).
const serializedBytes =
  JSON.stringify([...norm.cveCatalog.values()]).length +
  JSON.stringify(norm.occurrences).length +
  JSON.stringify(norm.imageMeta).length +
  JSON.stringify(aggregates).length;
sampleRss();

const mb = (n: number): string => `${(n / 1048576).toFixed(1)}MB`;
const fmt = (n: number): string => n.toLocaleString('en-US');

console.log(`file:            ${mb(fileBytes)}`);
console.log(`parse+normalize: ${((tParse - t0) / 1000).toFixed(2)}s`);
console.log(`aggregate:       ${((tAgg - tParse) / 1000).toFixed(2)}s`);
console.log(`peak RSS:        ${mb(peakRss)}`);
console.log(`normalized size: ~${mb(serializedBytes)} (JSON-serialized)`);
console.log('');
console.log(`groups=${aggregates.totals.groups} repos=${fmt(aggregates.totals.repos)} images=${fmt(aggregates.totals.images)}`);
console.log(`occurrences=${fmt(aggregates.totals.occurrences)} uniqueCves=${fmt(aggregates.totals.uniqueCves)}`);
console.log(`dedup ratio: ${(aggregates.totals.occurrences / aggregates.totals.uniqueCves).toFixed(1)}x`);
console.log(`bySeverity: ${JSON.stringify(aggregates.bySeverity)}`);
console.log(`byKaiStatus: ${JSON.stringify(aggregates.byKaiStatus)}`);
console.log(`fixAvailability: ${JSON.stringify(aggregates.fixAvailability)}`);
console.log(`truncated=${tok.truncated} tailBytes=${fmt(tok.unparsedTailBytes)} tailPath=${tok.partialTailPath}`);
console.log(`recordFailures=${norm.recordFailures} duplicateIds=${norm.duplicateIds}`);
console.log(`top risk image: ${JSON.stringify(aggregates.topRiskImages[0])}`);
console.log(`histogram bins: ${aggregates.cvssHistogram.length}, riskFactors: ${Object.keys(aggregates.byRiskFactor).length}`);

// -------- cross-validation against inspector ground truth ----------------
const expect = { occurrences: 171_711, uniqueCves: 1_228, images: 756, groups: 6, repos: 501 };
const errors: string[] = [];
if (aggregates.totals.occurrences !== expect.occurrences) errors.push(`occurrences ${aggregates.totals.occurrences} != ${expect.occurrences}`);
if (aggregates.totals.uniqueCves !== expect.uniqueCves) errors.push(`uniqueCves ${aggregates.totals.uniqueCves} != ${expect.uniqueCves}`);
if (aggregates.totals.images !== expect.images) errors.push(`images ${aggregates.totals.images} != ${expect.images}`);
if (aggregates.totals.groups !== expect.groups) errors.push(`groups ${aggregates.totals.groups} != ${expect.groups}`);
if (aggregates.totals.repos !== expect.repos) errors.push(`repos ${aggregates.totals.repos} != ${expect.repos}`);
console.log('');
if (errors.length > 0) {
  console.error(`CROSS-VALIDATION FAILED:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('cross-validation vs inspect-data.mjs: PASS');
