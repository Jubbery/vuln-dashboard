import { describe, it, expect } from 'vitest';
import { filterOccurrencesDetailed, sortOccurrences, computeExplorerResult } from './selectors.ts';
import type { Dataset, CveMeta, Occurrence, Severity } from '../types/vulnerability.ts';
import type { FiltersState } from '../store/filtersSlice.ts';

function occ(o: Partial<Occurrence> & { cve: string; severity: Severity }): Occurrence {
  return {
    id: `${o.cve}-${o.packageName ?? 'p'}-${o.kaiStatus ?? 'none'}`,
    groupId: 0, repoId: 0, imageId: 0,
    packageName: 'pkg', packageVersion: '1.0', packageType: 'jar',
    status: '', fixDate: null, applicableRules: [], kaiStatus: null,
    ...o,
  };
}

function meta(cve: string, severity: Severity, cvss: number, riskFactors: string[] = []): CveMeta {
  return { cve, severity, cvss, description: '', link: '', riskFactors, published: null, occurrenceCount: 1 };
}

function dataset(occurrences: Occurrence[], catalog: Array<[string, CveMeta]>): Dataset {
  return {
    occurrences,
    cveCatalog: new Map(catalog),
    imageMeta: [{
      id: 0, groupId: 0, repoId: 0, name: 'img', version: '1.0',
      baseImage: '', buildType: '', maintainer: '', createTime: null,
    }],
    groupNames: ['g'],
    repoNames: ['r'],
    aggregates: {} as Dataset['aggregates'],
    diagnostics: {} as Dataset['diagnostics'],
  };
}

const baseFilters: FiltersState = {
  severities: [], riskFactors: [], packageTypes: [],
  groupId: null, repoId: null, search: '', fix: 'all',
  analysisOn: false, aiAnalysisOn: false,
};

describe('triage action-button filtering', () => {
  const ds = dataset(
    [
      occ({ cve: 'CVE-1', severity: 'high' }),
      occ({ cve: 'CVE-2', severity: 'high', kaiStatus: 'invalid - norisk' }),
      occ({ cve: 'CVE-3', severity: 'high', kaiStatus: 'ai-invalid-norisk' }),
    ],
    [
      ['CVE-1', meta('CVE-1', 'high', 8)],
      ['CVE-2', meta('CVE-2', 'high', 8)],
      ['CVE-3', meta('CVE-3', 'high', 8)],
    ],
  );

  it('tallies both verdicts even when neither button is engaged', () => {
    const r = filterOccurrencesDetailed(ds, baseFilters);
    expect(r.rows).toHaveLength(3);
    expect(r.manualDismissed).toBe(1);
    expect(r.aiDismissed).toBe(1);
  });

  it('Analysis hides only manual dismissals', () => {
    const r = filterOccurrencesDetailed(ds, { ...baseFilters, analysisOn: true });
    expect(r.rows.map((o) => o.cve)).toEqual(['CVE-1', 'CVE-3']);
  });

  it('AI Analysis hides only AI dismissals', () => {
    const r = filterOccurrencesDetailed(ds, { ...baseFilters, aiAnalysisOn: true });
    expect(r.rows.map((o) => o.cve)).toEqual(['CVE-1', 'CVE-2']);
  });

  it('both engaged leaves only untriaged records', () => {
    const r = filterOccurrencesDetailed(ds, { ...baseFilters, analysisOn: true, aiAnalysisOn: true });
    expect(r.rows.map((o) => o.cve)).toEqual(['CVE-1']);
  });

  it('counts tallies within the current filter context, not globally', () => {
    // Severity filter excludes the manual dismissal, so its tally drops to 0 —
    // this is what keeps the button badge honest under combined filters.
    const mixed = dataset(
      [
        occ({ cve: 'CVE-1', severity: 'low', kaiStatus: 'invalid - norisk' }),
        occ({ cve: 'CVE-2', severity: 'high', kaiStatus: 'ai-invalid-norisk' }),
      ],
      [['CVE-1', meta('CVE-1', 'low', 2)], ['CVE-2', meta('CVE-2', 'high', 8)]],
    );
    const r = filterOccurrencesDetailed(mixed, { ...baseFilters, severities: ['high'] });
    expect(r.manualDismissed).toBe(0);
    expect(r.aiDismissed).toBe(1);
  });
});

describe('filtering', () => {
  const ds = dataset(
    [
      occ({ cve: 'CVE-1', severity: 'critical', packageName: 'spring-web', fixDate: 1000 }),
      occ({ cve: 'CVE-2', severity: 'low', packageName: 'axios', packageType: 'nodejs' }),
    ],
    [
      ['CVE-1', meta('CVE-1', 'critical', 9.8, ['Has fix', 'Remote execution'])],
      ['CVE-2', meta('CVE-2', 'low', 2.0, [])],
    ],
  );

  it('matches search against CVE id and package name, case-insensitively', () => {
    expect(filterOccurrencesDetailed(ds, { ...baseFilters, search: 'SPRING' }).rows).toHaveLength(1);
    expect(filterOccurrencesDetailed(ds, { ...baseFilters, search: 'cve-2' }).rows).toHaveLength(1);
    expect(filterOccurrencesDetailed(ds, { ...baseFilters, search: 'nomatch' }).rows).toHaveLength(0);
  });

  it('filters by severity, package type, and fix availability', () => {
    expect(filterOccurrencesDetailed(ds, { ...baseFilters, severities: ['critical'] }).rows).toHaveLength(1);
    expect(filterOccurrencesDetailed(ds, { ...baseFilters, packageTypes: ['nodejs'] }).rows).toHaveLength(1);
    expect(filterOccurrencesDetailed(ds, { ...baseFilters, fix: 'with-fix' }).rows).toHaveLength(1);
    expect(filterOccurrencesDetailed(ds, { ...baseFilters, fix: 'without-fix' }).rows).toHaveLength(1);
  });

  it('matches risk factors at CVE level, requiring all selected', () => {
    expect(filterOccurrencesDetailed(ds, { ...baseFilters, riskFactors: ['Remote execution'] }).rows)
      .toHaveLength(1);
    expect(filterOccurrencesDetailed(ds, { ...baseFilters, riskFactors: ['Remote execution', 'Nope'] }).rows)
      .toHaveLength(0);
  });
});

describe('sortOccurrences', () => {
  const rows = [
    occ({ cve: 'CVE-B', severity: 'low', packageName: 'b' }),
    occ({ cve: 'CVE-A', severity: 'critical', packageName: 'a' }),
  ];
  const ds = dataset(rows, [
    ['CVE-A', meta('CVE-A', 'critical', 9.8)],
    ['CVE-B', meta('CVE-B', 'low', 2.0)],
  ]);

  it('sorts by severity rank, not alphabetically', () => {
    const sorted = sortOccurrences(rows, { field: 'severity', direction: 'asc' }, ds);
    expect(sorted[0]?.severity).toBe('critical');   // 'critical' < 'low' by rank, not by string
  });

  it('sorts by catalog CVSS even though occurrences do not store it', () => {
    const sorted = sortOccurrences(rows, { field: 'cvss', direction: 'desc' }, ds);
    expect(sorted[0]?.cve).toBe('CVE-A');
  });

  it('returns rows untouched for an unknown sort field', () => {
    const sorted = sortOccurrences(rows, { field: 'nope', direction: 'asc' }, ds);
    expect(sorted).toBe(rows);
  });
});

describe('computeExplorerResult topRisks', () => {
  it('ranks exploited CVEs above more severe non-exploited ones', () => {
    const ds = dataset(
      [
        occ({ cve: 'CVE-CRIT', severity: 'critical' }),
        occ({ cve: 'CVE-EXPL', severity: 'high' }),
      ],
      [
        ['CVE-CRIT', meta('CVE-CRIT', 'critical', 9.9)],
        ['CVE-EXPL', meta('CVE-EXPL', 'high', 7.5, ['Exploit exists - in the wild'])],
      ],
    );
    const { topRisks } = computeExplorerResult(ds, baseFilters, { field: 'severity', direction: 'asc' });
    expect(topRisks[0]?.cve).toBe('CVE-EXPL');
    expect(topRisks[0]?.exploited).toBe(true);
    expect(topRisks[1]?.cve).toBe('CVE-CRIT');
  });

  it('dedupes by CVE and counts occurrences in the current view', () => {
    const ds = dataset(
      [
        occ({ cve: 'CVE-1', severity: 'high', packageName: 'a' }),
        occ({ cve: 'CVE-1', severity: 'high', packageName: 'b' }),
      ],
      [['CVE-1', meta('CVE-1', 'high', 8)]],
    );
    const { topRisks } = computeExplorerResult(ds, baseFilters, { field: 'severity', direction: 'asc' });
    expect(topRisks).toHaveLength(1);
    expect(topRisks[0]?.count).toBe(2);
  });
});
