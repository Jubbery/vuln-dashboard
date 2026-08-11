import { describe, it, expect } from 'vitest';
import {
  sanitizeText, parseScanDate, flattenRiskFactors, buildOccurrenceId,
  normalizeSeverity, worstSeverity, createNormalizer,
} from './normalize.ts';

describe('sanitizeText (quirk E)', () => {
  it('repairs unicode escapes that lost their backslash upstream', () => {
    expect(sanitizeText('Springu2019s bugu00a0here')).toBe('Spring’s bug here');
    expect(sanitizeText('u201cquotedu201d')).toBe('“quoted”');
  });
  it('unescapes apostrophes and normalizes nbsp', () => {
    expect(sanitizeText("doesn\\'t")).toBe("doesn't");
    expect(sanitizeText('a b')).toBe('a b');
  });
  it('trims and leaves clean text alone', () => {
    expect(sanitizeText('  plain text  ')).toBe('plain text');
  });
});

describe('parseScanDate (quirks F, G)', () => {
  it('parses the scan format as UTC epoch ms', () => {
    expect(parseScanDate('2024-03-20 13:58:02')).toBe(Date.UTC(2024, 2, 20, 13, 58, 2));
  });
  it('maps the epoch-zero sentinel to null (quirk F)', () => {
    expect(parseScanDate('1970-01-01 00:00:00')).toBeNull();
  });
  it('maps empty and malformed values to null', () => {
    expect(parseScanDate('')).toBeNull();
    expect(parseScanDate('2024-03-20T13:58:02Z')).toBeNull();  // ISO is NOT the scan format
    expect(parseScanDate('not a date')).toBeNull();
    expect(parseScanDate(undefined)).toBeNull();
    expect(parseScanDate(1234)).toBeNull();
  });
});

describe('flattenRiskFactors (quirk D)', () => {
  it('flattens the object-as-set to its keys', () => {
    expect(flattenRiskFactors({ 'Has fix': {}, 'High severity': {} }))
      .toEqual(['Has fix', 'High severity']);
  });
  it('returns [] for null, arrays, and non-objects', () => {
    expect(flattenRiskFactors(null)).toEqual([]);
    expect(flattenRiskFactors(['Has fix'])).toEqual([]);
    expect(flattenRiskFactors('Has fix')).toEqual([]);
    expect(flattenRiskFactors(undefined)).toEqual([]);
  });
});

describe('buildOccurrenceId (quirk B)', () => {
  it('produces distinct keys for the same CVE on different packages', () => {
    const a = buildOccurrenceId('g', 'r', '1.0', 'spring-web', '5.3.30', 'CVE-2022-22968');
    const b = buildOccurrenceId('g', 'r', '1.0', 'spring-context', '5.3.30', 'CVE-2022-22968');
    expect(a).not.toBe(b);
  });
});

describe('normalizeSeverity (quirk I)', () => {
  it('passes known values and maps anything else to unknown', () => {
    expect(normalizeSeverity('critical')).toBe('critical');
    expect(normalizeSeverity('low')).toBe('low');
    expect(normalizeSeverity('CRITICAL')).toBe('unknown');
    expect(normalizeSeverity('')).toBe('unknown');
    expect(normalizeSeverity(9.8)).toBe('unknown');
  });
});

describe('worstSeverity', () => {
  it('picks the more severe of the pair', () => {
    expect(worstSeverity('medium', 'critical')).toBe('critical');
    expect(worstSeverity('low', 'unknown')).toBe('low');
  });
});

// ---------------------------------------------------------------------------

function vuln(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    cve: 'CVE-2000-0001', severity: 'medium', cvss: 5.0,
    description: 'desc', link: 'https://nvd.example/x',
    riskFactors: { 'Has fix': {} },
    published: '2020-06-01 00:00:00', fixDate: '',
    packageName: 'pkg', packageVersion: '1.0', packageType: 'jar',
    status: 'fixed in 2.0', applicableRules: [], kaiStatus: '',
    ...overrides,
  };
}

function image(vulns: unknown[], version = '1.0'): string {
  return JSON.stringify({
    name: 'reg.example/g/app', version, baseImage: 'alpine:3', buildType: 'ci',
    maintainer: 'team', createTime: '2024-03-20 13:58:02', vulnerabilities: vulns,
  });
}

describe('createNormalizer', () => {
  it('dedupes the catalog and keeps every occurrence (quirk A)', () => {
    const n = createNormalizer();
    n.addImage('g1', 'r1', '1.0', image([
      vuln({ packageName: 'spring-web' }),
      vuln({ packageName: 'spring-context' }),
    ]));
    n.addImage('g1', 'r1', '2.0', image([vuln({ packageName: 'spring-web' })], '2.0'));
    const out = n.finish();
    expect(out.occurrences).toHaveLength(3);
    expect(out.cveCatalog.size).toBe(1);
    expect(out.cveCatalog.get('CVE-2000-0001')?.occurrenceCount).toBe(3);
  });

  it('resolves per-CVE cvss/severity conflicts to max/worst (quirk C)', () => {
    const n = createNormalizer();
    n.addImage('g1', 'r1', '1.0', image([
      vuln({ cvss: 5.3, severity: 'low', packageName: 'a' }),
      vuln({ cvss: 9.8, severity: 'medium', packageName: 'b' }),
    ]));
    const meta = n.finish().cveCatalog.get('CVE-2000-0001');
    expect(meta?.cvss).toBe(9.8);
    expect(meta?.severity).toBe('medium');   // never derived from cvss (quirk C)
  });

  it('sanitizes catalog descriptions (quirk E)', () => {
    const n = createNormalizer();
    n.addImage('g1', 'r1', '1.0', image([vuln({ description: 'Springu2019s CSRFu00a0hole' })]));
    expect(n.finish().cveCatalog.get('CVE-2000-0001')?.description).toBe('Spring’s CSRF hole');
  });

  it('interns group/repo names to stable indices', () => {
    const n = createNormalizer();
    n.addImage('g1', 'r1', '1.0', image([vuln({})]));
    n.addImage('g2', 'r2', '1.0', image([vuln({})]));
    n.addImage('g1', 'r1', '2.0', image([vuln({})], '2.0'));
    const out = n.finish();
    expect(out.groupNames).toEqual(['g1', 'g2']);
    expect(out.repoNames).toEqual(['r1', 'r2']);
    expect(out.occurrences[0]?.groupId).toBe(0);
    expect(out.occurrences[1]?.groupId).toBe(1);
    expect(out.occurrences[2]?.groupId).toBe(0);
  });

  it('disambiguates true composite-key collisions and counts them', () => {
    const n = createNormalizer();
    n.addImage('g1', 'r1', '1.0', image([vuln({}), vuln({})]));  // identical twice
    const out = n.finish();
    expect(out.duplicateIds).toBe(1);
    const ids = out.occurrences.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('counts malformed records instead of throwing', () => {
    const n = createNormalizer();
    n.addImage('g1', 'r1', '1.0', image(['garbage', null, vuln({}), vuln({ cve: '' })]));
    const out = n.finish();
    expect(out.recordFailures).toBe(3);
    expect(out.occurrences).toHaveLength(1);
  });

  it('normalizes kaiStatus: empty string becomes null, verdicts survive', () => {
    const n = createNormalizer();
    n.addImage('g1', 'r1', '1.0', image([
      vuln({ packageName: 'a', kaiStatus: '' }),
      vuln({ packageName: 'b', kaiStatus: 'invalid - norisk' }),
      vuln({ packageName: 'c', kaiStatus: 'ai-invalid-norisk' }),
    ]));
    const [a, b, c] = n.finish().occurrences;
    expect(a?.kaiStatus).toBeNull();
    expect(b?.kaiStatus).toBe('invalid - norisk');
    expect(c?.kaiStatus).toBe('ai-invalid-norisk');
  });

  it('tallies risk factors per record and fix availability', () => {
    const n = createNormalizer();
    n.addImage('g1', 'r1', '1.0', image([
      vuln({ packageName: 'a', riskFactors: { 'Has fix': {}, 'DoS - High': {} } }),
      vuln({ packageName: 'b', riskFactors: { 'DoS - High': {} } }),
    ]));
    const out = n.finish();
    expect(out.byRiskFactor['DoS - High']).toBe(2);
    expect(out.byRiskFactor['Has fix']).toBe(1);
    expect(out.withFixCount).toBe(1);
  });
});
