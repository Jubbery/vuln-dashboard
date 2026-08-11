/**
 * Client-side export of the CURRENT filtered view (email spec). Builds the
 * file in memory from the same row array the grid renders — what you see is
 * exactly what you get.
 */

import type { Dataset, Occurrence } from '../types/vulnerability.ts';

interface ExportRow {
  cve: string;
  severity: string;
  cvss: number;
  packageName: string;
  packageVersion: string;
  packageType: string;
  group: string;
  repo: string;
  imageVersion: string;
  fixDate: string;
  status: string;
  kaiStatus: string;
}

function toExportRow(o: Occurrence, dataset: Dataset): ExportRow {
  const img = dataset.imageMeta[o.imageId];
  return {
    cve: o.cve,
    severity: o.severity,
    cvss: dataset.cveCatalog.get(o.cve)?.cvss ?? 0,
    packageName: o.packageName,
    packageVersion: o.packageVersion,
    packageType: o.packageType,
    group: dataset.groupNames[o.groupId] ?? '',
    repo: dataset.repoNames[o.repoId] ?? '',
    imageVersion: img?.version ?? '',
    fixDate: o.fixDate === null ? '' : new Date(o.fixDate).toISOString().slice(0, 10),
    status: o.status,
    kaiStatus: o.kaiStatus ?? '',
  };
}

const CSV_HEADER: ReadonlyArray<keyof ExportRow> = [
  'cve', 'severity', 'cvss', 'packageName', 'packageVersion', 'packageType',
  'group', 'repo', 'imageVersion', 'fixDate', 'status', 'kaiStatus',
];

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportRows(rows: Occurrence[], dataset: Dataset, format: 'csv' | 'json'): void {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  let blob: Blob;
  if (format === 'csv') {
    const lines = [CSV_HEADER.join(',')];
    for (const o of rows) {
      const r = toExportRow(o, dataset);
      lines.push(CSV_HEADER.map((k) => csvEscape(r[k])).join(','));
    }
    blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  } else {
    blob = new Blob(
      [JSON.stringify(rows.map((o) => toExportRow(o, dataset)), null, 2)],
      { type: 'application/json' },
    );
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vulnerabilities-${stamp}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
