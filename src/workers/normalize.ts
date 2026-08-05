/**
 * Normalization: raw image objects -> interned, deduped, sanitized records.
 * Pure functions plus a stateful accumulator (`createNormalizer`). No
 * DOM/worker/Node APIs — unit-testable and shared with the Node harness.
 */

import type { CveMeta, ImageMeta, Occurrence, Severity } from '../types/vulnerability.ts';
import { SEVERITY_RANK } from '../types/vulnerability.ts';

// ------------------------------------------------------------- sanitizing ---

/**
 * Quirk E: descriptions contain unicode escapes whose backslash was lost
 * upstream (literal "u00a0" etc., 21k+ measured) and escaped apostrophes.
 * Only codepoints actually observed in the data are mapped — a blanket
 * /u[0-9a-f]{4}/ substitution could corrupt legitimate text.
 */
const LOST_ESCAPES: ReadonlyArray<[RegExp, string]> = [
  [/u00a0/g, ' '],
  [/u2019/g, '’'],
  [/u2018/g, '‘'],
  [/u201c/g, '“'],
  [/u201d/g, '”'],
  [/\\'/g, "'"],
  [/ /g, ' '], // genuine nbsp -> plain space for clean wrapping
];

export function sanitizeText(s: string): string {
  let out = s;
  for (const [re, sub] of LOST_ESCAPES) out = out.replace(re, sub);
  return out.trim();
}

// ------------------------------------------------------------------ dates ---

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const EPOCH_ZERO = '1970-01-01 00:00:00';

/**
 * Quirk G: "YYYY-MM-DD HH:mm:ss" is not reliably parseable by `new Date()`
 * across browsers — parse manually as UTC. Quirk F: epoch-zero is a null
 * sentinel. Empty strings (1,880 fixDates measured) are also null.
 */
export function parseScanDate(v: unknown): number | null {
  if (typeof v !== 'string' || v === '' || v === EPOCH_ZERO) return null;
  const m = DATE_RE.exec(v);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

// ------------------------------------------------------------ risk factors ---

/** Quirk D: riskFactors is an object-as-set; values are always empty objects. */
export function flattenRiskFactors(v: unknown): string[] {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return [];
  return Object.keys(v);
}

// -------------------------------------------------------------- composite id ---

/** Quirk B: `cve` alone is not unique — same CVE hits multiple packages in one image. */
export function buildOccurrenceId(
  group: string, repo: string, imageVersion: string,
  pkgName: string, pkgVersion: string, cve: string,
): string {
  return `${group}|${repo}|${imageVersion}|${pkgName}@${pkgVersion}|${cve}`;
}

// -------------------------------------------------------------- severity ---

const KNOWN_SEVERITIES = new Set<string>(['critical', 'high', 'medium', 'low']);

export function normalizeSeverity(v: unknown): Severity {
  return typeof v === 'string' && KNOWN_SEVERITIES.has(v) ? (v as Severity) : 'unknown';
}

export function worstSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b;
}

// ------------------------------------------------------------- normalizer ---

const asString = (v: unknown): string => (typeof v === 'string' ? v : '');
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export interface NormalizerOutput {
  cveCatalog: Map<string, CveMeta>;
  occurrences: Occurrence[];
  imageMeta: ImageMeta[];
  groupNames: string[];
  repoNames: string[];
  recordFailures: number;
  duplicateIds: number;
  /**
   * Per-record risk-factor tallies, accumulated here because Occurrence rows
   * deliberately don't store riskFactor arrays and the catalog's per-CVE
   * *union* would overcount (severity-tag labels vary per occurrence —
   * measured in Phase 0).
   */
  byRiskFactor: Record<string, number>;
  withFixCount: number;
}

interface Normalizer {
  /** Parse + normalize one raw image JSON slice. Defensive: failures are counted, not thrown. */
  addImage(group: string, repo: string, imageKey: string, raw: string): void;
  finish(): NormalizerOutput;
}

export function createNormalizer(): Normalizer {
  const groupIds = new Map<string, number>();
  const repoIds = new Map<string, number>();
  const groupNames: string[] = [];
  const repoNames: string[] = [];
  const cveCatalog = new Map<string, CveMeta>();
  const occurrences: Occurrence[] = [];
  const imageMeta: ImageMeta[] = [];
  const seenIds = new Set<string>();
  const byRiskFactor: Record<string, number> = {};
  let withFixCount = 0;
  let recordFailures = 0;
  let duplicateIds = 0;

  const intern = (table: Map<string, number>, names: string[], name: string): number => {
    let id = table.get(name);
    if (id === undefined) {
      id = names.length;
      names.push(name);
      table.set(name, id);
    }
    return id;
  };

  return {
    addImage(group, repo, imageKey, raw): void {
      let img: Record<string, unknown>;
      try {
        img = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        recordFailures++;
        return;
      }

      const groupId = intern(groupIds, groupNames, group);
      const repoId = intern(repoIds, repoNames, repo);
      const imageId = imageMeta.length;
      const version = asString(img.version) || imageKey;

      imageMeta.push({
        id: imageId,
        groupId,
        repoId,
        name: asString(img.name),
        version,
        baseImage: asString(img.baseImage),
        buildType: asString(img.buildType),
        maintainer: asString(img.maintainer),
        createTime: parseScanDate(img.createTime),
      });

      const vulns = img.vulnerabilities;
      if (!Array.isArray(vulns)) return;

      for (const rawVuln of vulns) {
        try {
          if (rawVuln === null || typeof rawVuln !== 'object') { recordFailures++; continue; }
          const v = rawVuln as Record<string, unknown>;

          const cve = asString(v.cve);
          if (!cve) { recordFailures++; continue; }

          const severity = normalizeSeverity(v.severity);
          const cvss = typeof v.cvss === 'number' ? v.cvss : 0;
          const riskFactors = flattenRiskFactors(v.riskFactors);
          let hasFix = false;
          for (const rf of riskFactors) {
            byRiskFactor[rf] = (byRiskFactor[rf] ?? 0) + 1;
            if (rf === 'Has fix') hasFix = true;
          }
          if (hasFix) withFixCount++;
          const published = parseScanDate(v.published);
          const packageName = asString(v.packageName);
          const packageVersion = asString(v.packageVersion);

          // Phase 0 found 3 records where even the composite key collides
          // (identical vuln listed twice in one image, e.g. CVE-2020-5411 on
          // spring-batch-core@4.1.2.RELEASE). Disambiguate so every row id is
          // unique (DataGrid/React requirement); count for diagnostics.
          let id = buildOccurrenceId(group, repo, version, packageName, packageVersion, cve);
          if (seenIds.has(id)) {
            duplicateIds++;
            let n = 2;
            while (seenIds.has(`${id}#${n}`)) n++;
            id = `${id}#${n}`;
          }
          seenIds.add(id);

          occurrences.push({
            id,
            groupId,
            repoId,
            imageId,
            packageName,
            packageVersion,
            packageType: asString(v.packageType),
            cve,
            severity,
            status: asString(v.status),
            fixDate: parseScanDate(v.fixDate),
            applicableRules: asStringArray(v.applicableRules),
            kaiStatus: typeof v.kaiStatus === 'string' && v.kaiStatus !== '' ? v.kaiStatus : null,
          });

          // Catalog merge. Phase 0: descriptions are consistent per CVE;
          // cvss/severity conflict for 55/83 CVEs -> keep max/worst.
          const existing = cveCatalog.get(cve);
          if (existing === undefined) {
            cveCatalog.set(cve, {
              cve,
              cvss,
              severity,
              description: sanitizeText(asString(v.description)),
              link: asString(v.link),
              riskFactors,
              published,
              occurrenceCount: 1,
            });
          } else {
            existing.occurrenceCount++;
            if (cvss > existing.cvss) existing.cvss = cvss;
            existing.severity = worstSeverity(existing.severity, severity);
            if (published !== null && (existing.published === null || published < existing.published)) {
              existing.published = published;
            }
            for (const rf of riskFactors) {
              if (!existing.riskFactors.includes(rf)) existing.riskFactors.push(rf);
            }
          }
        } catch {
          recordFailures++;
        }
      }
    },

    finish(): NormalizerOutput {
      return {
        cveCatalog, occurrences, imageMeta, groupNames, repoNames,
        recordFailures, duplicateIds, byRiskFactor, withFixCount,
      };
    },
  };
}
