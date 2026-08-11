import { describe, it, expect } from 'vitest';
import { computeAggregates } from './aggregate.ts';
import type { CveMeta, ImageMeta, Occurrence, Severity } from '../types/vulnerability.ts';

/** Minimal fixture builders — only the fields the aggregator reads. */
function occ(o: Partial<Occurrence> & { cve: string; severity: Severity }): Occurrence {
  return {
    id: `${o.cve}-${o.packageName ?? 'p'}-${o.imageId ?? 0}`,
    groupId: 0, repoId: 0, imageId: 0,
    packageName: 'pkg', packageVersion: '1.0', packageType: 'jar',
    status: '', fixDate: null, applicableRules: [], kaiStatus: null,
    ...o,
  };
}

function meta(m: Partial<CveMeta> & { cve: string; severity: Severity; cvss: number }): CveMeta {
  return {
    description: 'd', link: 'l', riskFactors: [], published: null, occurrenceCount: 1,
    ...m,
  };
}

function img(id: number): ImageMeta {
  return {
    id, groupId: 0, repoId: 0, name: `img${id}`, version: '1.0',
    baseImage: '', buildType: '', maintainer: '', createTime: null,
  };
}

const noTallies = { byRiskFactor: {}, withFixCount: 0 };

describe('computeAggregates', () => {
  it('counts severities and package types over occurrences', () => {
    const occurrences = [
      occ({ cve: 'CVE-1', severity: 'critical' }),
      occ({ cve: 'CVE-2', severity: 'low', packageType: 'python' }),
      occ({ cve: 'CVE-3', severity: 'low' }),
    ];
    const catalog = new Map([
      ['CVE-1', meta({ cve: 'CVE-1', severity: 'critical', cvss: 9.8 })],
      ['CVE-2', meta({ cve: 'CVE-2', severity: 'low', cvss: 2.0 })],
      ['CVE-3', meta({ cve: 'CVE-3', severity: 'low', cvss: 3.0 })],
    ]);
    const a = computeAggregates(occurrences, [img(0)], catalog, { groups: 1, repos: 1 }, noTallies);

    expect(a.bySeverity.critical).toBe(1);
    expect(a.bySeverity.low).toBe(2);
    expect(a.byPackageType).toEqual({ jar: 2, python: 1 });
    expect(a.totals).toMatchObject({ occurrences: 3, uniqueCves: 3, images: 1 });
  });

  it('ranks images by weighted severity score', () => {
    const occurrences = [
      occ({ cve: 'CVE-1', severity: 'low', imageId: 0 }),
      occ({ cve: 'CVE-2', severity: 'critical', imageId: 1 }),
    ];
    const catalog = new Map([
      ['CVE-1', meta({ cve: 'CVE-1', severity: 'low', cvss: 2 })],
      ['CVE-2', meta({ cve: 'CVE-2', severity: 'critical', cvss: 9.8 })],
    ]);
    const a = computeAggregates(occurrences, [img(0), img(1)], catalog, { groups: 1, repos: 1 }, noTallies);

    expect(a.topRiskImages[0]?.imageId).toBe(1);   // critical outranks low
    expect(a.topRiskImages[0]?.counts.critical).toBe(1);
  });

  it('builds severityVsCvss from the catalog, one point per unique CVE', () => {
    const occurrences = [
      occ({ cve: 'CVE-1', severity: 'medium', packageName: 'a' }),
      occ({ cve: 'CVE-1', severity: 'medium', packageName: 'b' }),
    ];
    const catalog = new Map([['CVE-1', meta({ cve: 'CVE-1', severity: 'medium', cvss: 9.8 })]]);
    const a = computeAggregates(occurrences, [img(0)], catalog, { groups: 1, repos: 1 }, noTallies);

    expect(a.severityVsCvss).toEqual([{ cve: 'CVE-1', severity: 'medium', cvss: 9.8 }]);
  });

  it('buckets publishedTrend by UTC year with a contiguous axis', () => {
    const catalog = new Map([
      ['CVE-1', meta({ cve: 'CVE-1', severity: 'high', cvss: 8, published: Date.UTC(2020, 0, 1) })],
      ['CVE-2', meta({ cve: 'CVE-2', severity: 'low', cvss: 2, published: Date.UTC(2020, 11, 31) })],
      ['CVE-3', meta({ cve: 'CVE-3', severity: 'critical', cvss: 9, published: Date.UTC(2023, 5, 1) })],
      ['CVE-4', meta({ cve: 'CVE-4', severity: 'low', cvss: 1, published: null })],  // excluded
    ]);
    const a = computeAggregates([], [], catalog, { groups: 0, repos: 0 }, noTallies);

    expect(a.publishedTrend.map((t) => t.year)).toEqual([2020, 2021, 2022, 2023]);
    expect(a.publishedTrend[0]?.counts).toMatchObject({ high: 1, low: 1 });
    expect(a.publishedTrend[1]?.counts.low).toBe(0);   // gap year zero-filled
    expect(a.publishedTrend[3]?.counts.critical).toBe(1);
  });

  it('separates manual and AI triage into overlap quadrants', () => {
    const occurrences = [
      occ({ cve: 'CVE-M', severity: 'low', kaiStatus: 'invalid - norisk' }),
      occ({ cve: 'CVE-A', severity: 'low', kaiStatus: 'ai-invalid-norisk' }),
      occ({ cve: 'CVE-B', severity: 'low', kaiStatus: 'invalid - norisk', packageName: 'x' }),
      occ({ cve: 'CVE-B', severity: 'low', kaiStatus: 'ai-invalid-norisk', packageName: 'y' }),
      occ({ cve: 'CVE-N', severity: 'low' }),
    ];
    const catalog = new Map(['CVE-M', 'CVE-A', 'CVE-B', 'CVE-N'].map((c) =>
      [c, meta({ cve: c, severity: 'low', cvss: 1 })]));
    const a = computeAggregates(occurrences, [img(0)], catalog, { groups: 1, repos: 1 }, noTallies);

    expect(a.analysisOverlap.cveQuadrants).toEqual({
      manualOnly: 1, aiOnly: 1, both: 1, neither: 1,
    });
    expect(a.analysisOverlap.bySeverity.low).toEqual({ manual: 2, ai: 2, total: 5 });
    expect(a.byKaiStatus).toMatchObject({ 'invalid - norisk': 2, 'ai-invalid-norisk': 2, none: 1 });
  });

  it('collects a sorted distinct package-name vocabulary', () => {
    const occurrences = [
      occ({ cve: 'CVE-1', severity: 'low', packageName: 'zlib' }),
      occ({ cve: 'CVE-2', severity: 'low', packageName: 'axios' }),
      occ({ cve: 'CVE-3', severity: 'low', packageName: 'zlib' }),
    ];
    const catalog = new Map(['CVE-1', 'CVE-2', 'CVE-3'].map((c) =>
      [c, meta({ cve: c, severity: 'low', cvss: 1 })]));
    const a = computeAggregates(occurrences, [img(0)], catalog, { groups: 1, repos: 1 }, noTallies);

    expect(a.packageNames).toEqual(['axios', 'zlib']);
  });

  it('derives fix availability from the normalizer tally, not the fixDate field', () => {
    const occurrences = [occ({ cve: 'CVE-1', severity: 'low' }), occ({ cve: 'CVE-2', severity: 'low' })];
    const catalog = new Map(['CVE-1', 'CVE-2'].map((c) => [c, meta({ cve: c, severity: 'low', cvss: 1 })]));
    const a = computeAggregates(occurrences, [img(0)], catalog, { groups: 1, repos: 1 },
      { byRiskFactor: { 'Has fix': 1 }, withFixCount: 1 });

    expect(a.fixAvailability).toEqual({ withFix: 1, withoutFix: 1 });
  });

  it('handles an empty dataset without throwing', () => {
    const a = computeAggregates([], [], new Map(), { groups: 0, repos: 0 }, noTallies);
    expect(a.totals.occurrences).toBe(0);
    expect(a.publishedTrend).toEqual([]);
    expect(a.topRiskImages).toEqual([]);
    expect(a.analysisOverlap.cveQuadrants.neither).toBe(0);
  });
});
