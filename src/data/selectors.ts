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
 * - Triage filter uses the kaiStatus field discovered in Phase 0:
 *   'active' = not dismissed by Kai's triage, 'dismissed' = kaiStatus set.
 */

import type { Dataset, Occurrence } from '../types/vulnerability.ts';
import { SEVERITY_RANK } from '../types/vulnerability.ts';
import type { FiltersState } from '../store/filtersSlice.ts';
import type { SortState } from '../store/uiSlice.ts';

export function filterOccurrences(dataset: Dataset, f: FiltersState): Occurrence[] {
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
  for (const o of dataset.occurrences) {
    if (f.groupId !== null && o.groupId !== f.groupId) continue;
    if (f.repoId !== null && o.repoId !== f.repoId) continue;
    if (severities !== null && !severities.has(o.severity)) continue;
    if (packageTypes !== null && !packageTypes.has(o.packageType)) continue;
    if (f.triage === 'active' && o.kaiStatus !== null) continue;
    if (f.triage === 'dismissed' && o.kaiStatus === null) continue;
    if (f.fix === 'with-fix' && o.fixDate === null) continue;
    if (f.fix === 'without-fix' && o.fixDate !== null) continue;
    if (rfCves !== null && !rfCves.has(o.cve)) continue;
    if (search !== '' &&
      !o.cve.toLowerCase().includes(search) &&
      !o.packageName.toLowerCase().includes(search)) continue;
    out.push(o);
  }
  return out;
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
