/**
 * Filter → sort over the occurrence array. Pure functions; pages memoize with
 * useMemo keyed on (dataset, filters, sort) — filters/sort come from Redux,
 * the array never does (§2.1).
 *
 * Semantics, documented deliberately:
 * - Risk-factor filter matches at the CVE level (catalog union) because
 *   occurrence rows deliberately don't carry riskFactor arrays.
 * - Has-fix filter is record-level truth: fixDate !== null. (Phase 0: 1,880
 *   records carry the "Has fix" label with an empty fixDate — the label is
 *   CVE-level, the date is occurrence-level.)
 * - Triage exclusion uses the kaiStatus field discovered in Phase 0: the
 *   Analysis / AI Analysis action buttons each hide one dismissal verdict
 *   ("invalid - norisk" / "ai-invalid-norisk").
 */

import type { Dataset, Occurrence, Severity } from '../types/vulnerability.ts';
import { SEVERITY_RANK, SEVERITY_WEIGHT } from '../types/vulnerability.ts';
import type { FiltersState } from '../store/filtersSlice.ts';
import { KAI_MANUAL_INVALID, KAI_AI_INVALID } from '../store/filtersSlice.ts';
import type { SortState } from '../store/uiSlice.ts';

/** Rows passing every filter, plus the triage tallies the action buttons and
 *  impact bar need — counted WITHIN the current filter context, so "Analysis
 *  removes N" stays truthful when other filters are active. */
export interface FilterResult {
  rows: Occurrence[];
  /** Records matching all other filters that are manual-analysis dismissals. */
  manualDismissed: number;
  /** Records matching all other filters that are AI-analysis dismissals. */
  aiDismissed: number;
}

export function filterOccurrences(dataset: Dataset, f: FiltersState): Occurrence[] {
  return filterOccurrencesDetailed(dataset, f).rows;
}

export function filterOccurrencesDetailed(dataset: Dataset, f: FiltersState): FilterResult {
  const severities = f.severities.length > 0 ? new Set(f.severities) : null;
  const packageTypes = f.packageTypes.length > 0 ? new Set(f.packageTypes) : null;
  const riskFactors = f.riskFactors.length > 0 ? f.riskFactors : null;
  const search = f.search.trim().toLowerCase();

  // Pre-resolve the CVE set matching the risk-factor filter once (1,228
  // catalog entries) instead of per-occurrence array scans (171k rows).
  let rfCves: Set<string> | null = null;
  if (riskFactors !== null) {
    rfCves = new Set();
    for (const meta of dataset.cveCatalog.values()) {
      if (riskFactors.every((rf) => meta.riskFactors.includes(rf))) rfCves.add(meta.cve);
    }
  }

  const out: Occurrence[] = [];
  let manualDismissed = 0;
  let aiDismissed = 0;
  for (const o of dataset.occurrences) {
    if (f.groupId !== null && o.groupId !== f.groupId) continue;
    if (f.repoId !== null && o.repoId !== f.repoId) continue;
    if (severities !== null && !severities.has(o.severity)) continue;
    if (packageTypes !== null && !packageTypes.has(o.packageType)) continue;
    if (f.fix === 'with-fix' && o.fixDate === null) continue;
    if (f.fix === 'without-fix' && o.fixDate !== null) continue;
    if (rfCves !== null && !rfCves.has(o.cve)) continue;
    if (search !== '' &&
      !o.cve.toLowerCase().includes(search) &&
      !o.packageName.toLowerCase().includes(search)) continue;
    // Triage tallies are counted before exclusion so the action buttons can
    // report their impact whether or not they're engaged.
    if (o.kaiStatus === KAI_MANUAL_INVALID) {
      manualDismissed++;
      if (f.analysisOn) continue;
    } else if (o.kaiStatus === KAI_AI_INVALID) {
      aiDismissed++;
      if (f.aiAnalysisOn) continue;
    }
    out.push(o);
  }
  return { rows: out, manualDismissed, aiDismissed };
}

/**
 * Decorate–sort–undecorate: sort keys are extracted ONCE per row (O(n) Map/
 * table lookups) instead of per comparison (O(n log n) — measured 636ms for
 * a CVSS sort the naive way, ~10x faster this way). Plain <,> comparison on
 * strings, not localeCompare: identifiers don't need collation and
 * localeCompare dominated the severity sort profile.
 */
type KeyFn = (o: Occurrence, ds: Dataset) => number | string;

const SORT_KEYS: Record<string, KeyFn> = {
  severity: (o) => SEVERITY_RANK[o.severity],
  cvss: (o, ds) => ds.cveCatalog.get(o.cve)?.cvss ?? 0,
  cve: (o) => o.cve,
  packageName: (o) => o.packageName,
  packageType: (o) => o.packageType,
  fixDate: (o) => o.fixDate ?? Number.MAX_SAFE_INTEGER, // nulls last (asc)
  image: (o, ds) => ds.imageMeta[o.imageId]?.name ?? '',
};

export function sortOccurrences(rows: Occurrence[], sort: SortState, dataset: Dataset): Occurrence[] {
  const keyFn = SORT_KEYS[sort.field];
  if (keyFn === undefined) return rows;
  const dir = sort.direction === 'asc' ? 1 : -1;

  const decorated: Array<{ k: number | string; o: Occurrence }> =
    rows.map((o) => ({ k: keyFn(o, dataset), o }));

  // No explicit tiebreak: Array.prototype.sort is spec-stable (ES2019), so
  // equal keys keep input order — deterministic, and skipping a long-string
  // id comparison roughly halves sort time on low-cardinality keys.
  decorated.sort((a, b) => (a.k < b.k ? -dir : a.k > b.k ? dir : 0));

  return decorated.map((d) => d.o);
}

export function computeExplorerRows(dataset: Dataset, filters: FiltersState, sort: SortState): Occurrence[] {
  return sortOccurrences(filterOccurrences(dataset, filters), sort, dataset);
}

export interface TopRisk {
  cve: string;
  severity: Severity;
  cvss: number;
  exploited: boolean;   // "Exploit exists - in the wild"
  count: number;        // occurrences within the current view
}

export interface ExplorerResult extends FilterResult {
  rows: Occurrence[];   // filtered AND sorted
  /** The most dangerous distinct CVEs in the CURRENT view — recomputed as
   *  filters change so the answer to "what do I fix first" tracks what the
   *  analyst is looking at (email spec: highlight the most critical
   *  vulnerabilities after filtering). */
  topRisks: TopRisk[];
}

const TOP_RISKS = 3;
const EXPLOIT_WILD = 'Exploit exists - in the wild';

function computeTopRisks(rows: Occurrence[], dataset: Dataset): TopRisk[] {
  const byCve = new Map<string, TopRisk>();
  for (const o of rows) {
    const existing = byCve.get(o.cve);
    if (existing !== undefined) {
      existing.count++;
      continue;
    }
    const meta = dataset.cveCatalog.get(o.cve);
    if (meta === undefined) continue;
    byCve.set(o.cve, {
      cve: o.cve,
      severity: meta.severity,
      cvss: meta.cvss,
      exploited: meta.riskFactors.includes(EXPLOIT_WILD),
      count: 1,
    });
  }
  // Danger order: actively exploited first, then severity, then CVSS.
  return [...byCve.values()]
    .sort((a, b) =>
      Number(b.exploited) - Number(a.exploited) ||
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.cvss - a.cvss)
    .slice(0, TOP_RISKS);
}

/** Explorer's one expensive computation: filter (with triage tallies) → sort. */
export function computeExplorerResult(dataset: Dataset, filters: FiltersState, sort: SortState): ExplorerResult {
  const r = filterOccurrencesDetailed(dataset, filters);
  return { ...r, rows: sortOccurrences(r.rows, sort, dataset), topRisks: computeTopRisks(r.rows, dataset) };
}

// ------------------------------------------------------------- hierarchy ---
// Rolled-up counts for the drill-down pages. Single pass over the occurrence
// array (20–50ms at 171k rows), memoized by the calling page with useMemo.

export interface SeverityRollup {
  counts: Record<Severity, number>;
  total: number;
  weightedScore: number;
}

const emptyRollup = (): SeverityRollup => ({
  counts: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
  total: 0,
  weightedScore: 0,
});

function addTo(r: SeverityRollup, severity: Severity): void {
  r.counts[severity]++;
  r.total++;
  r.weightedScore += SEVERITY_WEIGHT[severity];
}

/** Per-repo rollups within a group, ordered by weighted risk desc. */
export function rollupReposInGroup(
  dataset: Dataset,
  groupId: number,
): Array<{ repoId: number; imageCount: number } & SeverityRollup> {
  // Seed from imageMeta, not occurrences, so a clean repo (zero findings)
  // still appears in the drill-down instead of silently vanishing.
  const byRepo = new Map<number, SeverityRollup>();
  const imageCounts = new Map<number, number>();
  for (const img of dataset.imageMeta) {
    if (img.groupId === groupId) {
      if (!byRepo.has(img.repoId)) byRepo.set(img.repoId, emptyRollup());
      imageCounts.set(img.repoId, (imageCounts.get(img.repoId) ?? 0) + 1);
    }
  }
  for (const o of dataset.occurrences) {
    if (o.groupId !== groupId) continue;
    let r = byRepo.get(o.repoId);
    if (r === undefined) { r = emptyRollup(); byRepo.set(o.repoId, r); }
    addTo(r, o.severity);
  }
  return [...byRepo.entries()]
    .map(([repoId, r]) => ({ repoId, imageCount: imageCounts.get(repoId) ?? 0, ...r }))
    .sort((a, b) => b.weightedScore - a.weightedScore);
}

/** Per-image rollups within a repo, ordered by weighted risk desc. */
export function rollupImagesInRepo(
  dataset: Dataset,
  groupId: number,
  repoId: number,
): Array<{ imageId: number } & SeverityRollup> {
  // Seeded from imageMeta for the same clean-image reason as above.
  const byImage = new Map<number, SeverityRollup>();
  for (const img of dataset.imageMeta) {
    if (img.groupId === groupId && img.repoId === repoId) byImage.set(img.id, emptyRollup());
  }
  for (const o of dataset.occurrences) {
    if (o.groupId !== groupId || o.repoId !== repoId) continue;
    let r = byImage.get(o.imageId);
    if (r === undefined) { r = emptyRollup(); byImage.set(o.imageId, r); }
    addTo(r, o.severity);
  }
  return [...byImage.entries()]
    .map(([imageId, r]) => ({ imageId, ...r }))
    .sort((a, b) => b.weightedScore - a.weightedScore);
}

/** Every occurrence of one CVE across all images — the query the deduped
 *  catalog makes cheap (single filtered pass; the top CVE has 1,787 rows). */
export function occurrencesForCve(dataset: Dataset, cve: string): Occurrence[] {
  return dataset.occurrences.filter((o) => o.cve === cve);
}

// ---------------------------------------------------------- CVE impact ------

export interface CveImpact {
  total: number;
  images: number;
  repos: number;
  groups: number;
  withFix: number;
  manualDismissed: number;
  aiDismissed: number;
  /** Affected packages, most occurrences first. */
  packages: Array<{ name: string; version: string; count: number }>;
  /** Distinct scanner status strings ("fixed in 2.6.1"), most common first. */
  statuses: Array<{ status: string; count: number }>;
  severities: Record<Severity, number>;
  earliestFix: number | null;
  latestFix: number | null;
}

/** Blast radius + remediation summary for one CVE. Single pass over its
 *  occurrence rows (already cheap thanks to the catalog split). */
export function cveImpact(rows: Occurrence[]): CveImpact {
  const images = new Set<number>();
  const repos = new Set<number>();
  const groups = new Set<number>();
  const packages = new Map<string, { name: string; version: string; count: number }>();
  const statuses = new Map<string, number>();
  const severities: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  let withFix = 0;
  let manualDismissed = 0;
  let aiDismissed = 0;
  let earliestFix: number | null = null;
  let latestFix: number | null = null;

  for (const o of rows) {
    images.add(o.imageId);
    repos.add(o.repoId);
    groups.add(o.groupId);
    severities[o.severity]++;
    if (o.kaiStatus === KAI_MANUAL_INVALID) manualDismissed++;
    else if (o.kaiStatus === KAI_AI_INVALID) aiDismissed++;
    if (o.fixDate !== null) {
      withFix++;
      if (earliestFix === null || o.fixDate < earliestFix) earliestFix = o.fixDate;
      if (latestFix === null || o.fixDate > latestFix) latestFix = o.fixDate;
    }
    const pkgKey = `${o.packageName}@${o.packageVersion}`;
    const pkg = packages.get(pkgKey);
    if (pkg !== undefined) pkg.count++;
    else packages.set(pkgKey, { name: o.packageName, version: o.packageVersion, count: 1 });
    if (o.status !== '') statuses.set(o.status, (statuses.get(o.status) ?? 0) + 1);
  }

  return {
    total: rows.length,
    images: images.size,
    repos: repos.size,
    groups: groups.size,
    withFix,
    manualDismissed,
    aiDismissed,
    packages: [...packages.values()].sort((a, b) => b.count - a.count),
    statuses: [...statuses.entries()].map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    severities,
    earliestFix,
    latestFix,
  };
}

/** Share of unique CVEs in the scan scoring at or below this CVSS — "this
 *  score is higher than N% of the catalog". Uses the precomputed histogram. */
export function cvssPercentile(dataset: Dataset, cvss: number): number {
  const hist = dataset.aggregates.cvssHistogram;
  let below = 0;
  let total = 0;
  for (const b of hist) {
    total += b.count;
    if (b.bin < cvss) below += b.count;
  }
  return total === 0 ? 0 : (below / total) * 100;
}

export interface PackageGroup {
  key: string;             // "name@version"
  packageName: string;
  packageVersion: string;
  packageType: string;
  rows: Occurrence[];      // sorted most-severe-first
  rollup: SeverityRollup;
}

/** An image's vulnerabilities grouped by package, riskiest package first. */
export function packagesForImage(dataset: Dataset, imageId: number): PackageGroup[] {
  const byPkg = new Map<string, PackageGroup>();
  for (const o of dataset.occurrences) {
    if (o.imageId !== imageId) continue;
    const key = `${o.packageName}@${o.packageVersion}`;
    let g = byPkg.get(key);
    if (g === undefined) {
      g = {
        key,
        packageName: o.packageName,
        packageVersion: o.packageVersion,
        packageType: o.packageType,
        rows: [],
        rollup: emptyRollup(),
      };
      byPkg.set(key, g);
    }
    g.rows.push(o);
    addTo(g.rollup, o.severity);
  }
  for (const g of byPkg.values()) {
    g.rows.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  }
  return [...byPkg.values()].sort((a, b) => b.rollup.weightedScore - a.rollup.weightedScore);
}
