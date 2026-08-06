/** Phase 4 smoke test: run the real pipeline, then cross-validate the
 *  hierarchy selectors against independent ground truth. */
import { createReadStream } from 'node:fs';
import { createImageTokenizer } from '../src/workers/tokenizer.ts';
import { createNormalizer } from '../src/workers/normalize.ts';
import { computeAggregates } from '../src/workers/aggregate.ts';
import {
  rollupReposInGroup, rollupImagesInRepo, occurrencesForCve, packagesForImage,
} from '../src/data/selectors.ts';
import type { Dataset } from '../src/types/vulnerability.ts';

const filePath = process.argv[2]!;
const normalizer = createNormalizer();
const tokenizer = createImageTokenizer((e) => normalizer.addImage(e.group, e.repo, e.imageKey, e.raw));
const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1 << 20 });
for await (const chunk of stream) tokenizer.push(chunk as string);
const tok = tokenizer.finish();
const norm = normalizer.finish();
const aggregates = computeAggregates(
  norm.occurrences, norm.imageMeta, norm.cveCatalog,
  { groups: tok.groupCount, repos: tok.repoCount },
  { byRiskFactor: norm.byRiskFactor, withFixCount: norm.withFixCount },
);
const dataset: Dataset = {
  cveCatalog: norm.cveCatalog, occurrences: norm.occurrences, imageMeta: norm.imageMeta,
  groupNames: norm.groupNames, repoNames: norm.repoNames, aggregates,
  diagnostics: { truncated: false, unparsedTailBytes: 0, partialTailPath: null, recordFailures: 0, duplicateIds: 0, parseTimeMs: 0 },
};

let failures = 0;
const check = (name: string, ok: boolean, detail = ''): void => {
  if (!ok) { failures++; console.log(`FAIL ${name} ${detail}`); } else console.log(`ok   ${name}`);
};

// 1. Sum of all group→repo rollup totals === total occurrences.
let sumRepoTotals = 0, sumImageCounts = 0;
for (let g = 0; g < dataset.groupNames.length; g++) {
  for (const r of rollupReposInGroup(dataset, g)) { sumRepoTotals += r.total; sumImageCounts += r.imageCount; }
}
check('repo rollups sum to total occurrences', sumRepoTotals === dataset.occurrences.length, `${sumRepoTotals} vs ${dataset.occurrences.length}`);
check('image counts sum to imageMeta length', sumImageCounts === dataset.imageMeta.length, `${sumImageCounts} vs ${dataset.imageMeta.length}`);

// 2. Every image appears in exactly one repo rollup path; per-image totals match.
let sumImageTotals = 0, imagesSeen = 0;
for (let g = 0; g < dataset.groupNames.length; g++) {
  for (const r of rollupReposInGroup(dataset, g)) {
    for (const ir of rollupImagesInRepo(dataset, g, r.repoId)) { sumImageTotals += ir.total; imagesSeen++; }
  }
}
check('image rollups cover all images', imagesSeen === dataset.imageMeta.length, `${imagesSeen} vs ${dataset.imageMeta.length}`);
check('image rollups sum to total occurrences', sumImageTotals === dataset.occurrences.length, `${sumImageTotals} vs ${dataset.occurrences.length}`);

// 3. occurrencesForCve count matches catalog occurrenceCount for top + random CVEs.
const metas = [...dataset.cveCatalog.values()];
metas.sort((a, b) => b.occurrenceCount - a.occurrenceCount);
const sample = [metas[0]!, metas[Math.floor(metas.length / 2)]!, metas[metas.length - 1]!];
for (const m of sample) {
  const n = occurrencesForCve(dataset, m.cve).length;
  check(`occurrencesForCve(${m.cve}) matches catalog count`, n === m.occurrenceCount, `${n} vs ${m.occurrenceCount}`);
}

// 4. packagesForImage totals match the image rollup for the riskiest image.
const top = aggregates.topRiskImages[0]!;
const pkgs = packagesForImage(dataset, top.imageId);
const pkgTotal = pkgs.reduce((s, p) => s + p.rows.length, 0);
const imgRollup = rollupImagesInRepo(dataset, dataset.imageMeta[top.imageId]!.groupId, dataset.imageMeta[top.imageId]!.repoId)
  .find((r) => r.imageId === top.imageId)!;
check('packagesForImage total matches image rollup', pkgTotal === imgRollup.total, `${pkgTotal} vs ${imgRollup.total}`);
check('packages sorted by weighted risk desc', pkgs.every((p, i) => i === 0 || pkgs[i - 1]!.rollup.weightedScore >= p.rollup.weightedScore));

// 5. Rollups ordered by weighted risk desc.
const g0 = rollupReposInGroup(dataset, 0);
check('repo rollup ordered desc', g0.every((r, i) => i === 0 || g0[i - 1]!.weightedScore >= r.weightedScore));

console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
