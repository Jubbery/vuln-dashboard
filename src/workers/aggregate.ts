/**
 * Aggregate computation — one pass over normalized records, in the worker.
 * The main thread never computes an aggregate. Pure and unit-testable.
 */

import type {
  Aggregates, CveMeta, ImageMeta, Occurrence, Severity,
} from '../types/vulnerability.ts';
import { SEVERITIES, SEVERITY_WEIGHT } from '../types/vulnerability.ts';

const TOP_IMAGES = 10;
const CVSS_BIN_WIDTH = 0.5;

const emptySeverityRecord = (): Record<Severity, number> => {
  const r = {} as Record<Severity, number>;
  for (const s of SEVERITIES) r[s] = 0;
  return r;
};

export function computeAggregates(
  occurrences: Occurrence[],
  imageMeta: ImageMeta[],
  cveCatalog: Map<string, CveMeta>,
  counts: { groups: number; repos: number },
  /** Accumulated per-record by the normalizer (see NormalizerOutput docs). */
  riskFactorTallies: { byRiskFactor: Record<string, number>; withFixCount: number },
): Aggregates {
  const bySeverity = emptySeverityRecord();
  const byPackageType: Record<string, number> = {};
  const byKaiStatus: Record<string, number> = {};

  // per-image severity tallies
  const imageCounts: Array<Record<Severity, number>> = imageMeta.map(emptySeverityRecord);

  for (const o of occurrences) {
    bySeverity[o.severity]++;
    byPackageType[o.packageType] = (byPackageType[o.packageType] ?? 0) + 1;
    byKaiStatus[o.kaiStatus ?? 'none'] = (byKaiStatus[o.kaiStatus ?? 'none'] ?? 0) + 1;
    const img = imageCounts[o.imageId];
    if (img !== undefined) img[o.severity]++;
  }

  const topRiskImages = imageCounts
    .map((c, imageId) => ({
      imageId,
      weightedScore: SEVERITIES.reduce((sum, s) => sum + c[s] * SEVERITY_WEIGHT[s], 0),
      counts: c,
    }))
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, TOP_IMAGES);

  const severityVsCvss: Aggregates['severityVsCvss'] = [];
  const bins = new Map<number, number>();
  const byYear = new Map<number, Record<Severity, number>>();
  for (const meta of cveCatalog.values()) {
    severityVsCvss.push({ cve: meta.cve, severity: meta.severity, cvss: meta.cvss });
    const bin = Math.min(Math.floor(meta.cvss / CVSS_BIN_WIDTH) * CVSS_BIN_WIDTH, 10 - CVSS_BIN_WIDTH);
    bins.set(bin, (bins.get(bin) ?? 0) + 1);
    if (meta.published !== null) {
      const year = new Date(meta.published).getUTCFullYear();
      let rec = byYear.get(year);
      if (rec === undefined) { rec = emptySeverityRecord(); byYear.set(year, rec); }
      rec[meta.severity]++;
    }
  }

  // Contiguous year axis — gap years render as zero, not as missing ticks.
  const publishedTrend: Aggregates['publishedTrend'] = [];
  if (byYear.size > 0) {
    const years = [...byYear.keys()];
    const min = Math.min(...years);
    const max = Math.max(...years);
    for (let y = min; y <= max; y++) {
      publishedTrend.push({ year: y, counts: byYear.get(y) ?? emptySeverityRecord() });
    }
  }
  const cvssHistogram = [...bins.entries()]
    .map(([bin, count]) => ({ bin, count }))
    .sort((a, b) => a.bin - b.bin);

  return {
    totals: {
      groups: counts.groups,
      repos: counts.repos,
      images: imageMeta.length,
      uniqueCves: cveCatalog.size,
      occurrences: occurrences.length,
    },
    bySeverity,
    byRiskFactor: riskFactorTallies.byRiskFactor,
    byPackageType,
    byKaiStatus,
    topRiskImages,
    severityVsCvss,
    cvssHistogram,
    fixAvailability: {
      withFix: riskFactorTallies.withFixCount,
      withoutFix: occurrences.length - riskFactorTallies.withFixCount,
    },
    publishedTrend,
  };
}
