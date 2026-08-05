#!/usr/bin/env node
/**
 * Phase 0 — data reconnaissance for ui_demo.json
 *
 * Zero-dependency streaming inspector. Scans the 4-level nested JSON
 * (groups → repos → images → vulnerabilities[]) with a string-aware
 * brace-depth tokenizer, emitting each complete *image* object for
 * JSON.parse as its closing brace arrives. The full tree is never resident.
 *
 * Deliberately tolerant of a truncated file: everything parsed before the
 * point of truncation is reported, and the loss is quantified.
 *
 * Usage: node scripts/inspect-data.mjs <path-to-ui_demo.json>
 */

import { createReadStream, statSync } from 'node:fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/inspect-data.mjs <path-to-ui_demo.json>');
  process.exit(1);
}
const fileBytes = statSync(filePath).size;
const t0 = performance.now();

// ---------------------------------------------------------------- stats ---

const EXPECTED_EMPTY = ['cause', 'vecStr', 'exploit', 'type', 'advisoryType', 'path'];
const DATE_FIELDS = ['createTime', 'published', 'fixDate', 'layerTime'];
const DATE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const stats = {
  groups: 0,
  repos: 0,
  images: 0,
  occurrences: 0,
  imagesMissingVulnKey: 0,
  imagesEmptyVulns: 0,
  groupsMissingRepos: 0,
  malformedImages: 0,
  descBytesRaw: 0,      // sum of description lengths across ALL occurrences
  linkBytesRaw: 0,
  maxImageBytes: 0,
  maxVulnsPerImage: 0,
};

const sevCounts = new Map();
const pkgTypeCounts = new Map();
const riskFactorCounts = new Map();
let riskFactorNonEmptyValues = 0;
const ownerCounts = new Map();
const buildTypeCounts = new Map();
const statusSamples = new Set();
let statusDistinctOverflow = false;

const emptyFieldViolations = Object.fromEntries(
  EXPECTED_EMPTY.map((f) => [f, { count: 0, samples: [] }])
);

const dateStats = Object.fromEntries(
  DATE_FIELDS.map((f) => [
    f,
    { ok: 0, badFormat: 0, badSamples: [], empty: 0, epochZero: 0, min: null, max: null },
  ])
);

const vulnKeys = new Set();          // union of keys seen on vulnerability records
const EXPECTED_VULN_KEYS = new Set([
  'cve','severity','cvss','status','cause','description','vecStr','exploit',
  'riskFactors','link','type','packageName','packageVersion','packageType',
  'layerTime','published','fixDate','applicableRules','owner','advisoryType','path',
]);
const missingKeyCounts = new Map();  // expected key -> #records missing it
let applicableRulesNonArray = 0;

/** cve -> { count, cvss, cvssConflicts:Set, sev, sevConflicts:Set, descLen, descLenConflict } */
const cveMap = new Map();

// ------------------------------------------------------- image processing ---

function noteDate(field, v) {
  const d = dateStats[field];
  if (v == null || v === '') { d.empty++; return; }
  if (typeof v !== 'string' || !DATE_RE.test(v)) {
    d.badFormat++;
    if (d.badSamples.length < 3) d.badSamples.push(JSON.stringify(v));
    return;
  }
  if (v === '1970-01-01 00:00:00') { d.epochZero++; return; }
  d.ok++;
  if (d.min === null || v < d.min) d.min = v;
  if (d.max === null || v > d.max) d.max = v;
}

function bump(map, key) { map.set(key, (map.get(key) ?? 0) + 1); }

function processImage(groupName, repoName, version, raw) {
  let img;
  try {
    img = JSON.parse(raw);
  } catch {
    stats.malformedImages++;
    return;
  }
  stats.images++;
  if (raw.length > stats.maxImageBytes) stats.maxImageBytes = raw.length;
  noteDate('createTime', img.createTime);
  bump(buildTypeCounts, img.buildType ?? '<missing>');

  const vulns = img.vulnerabilities;
  if (vulns === undefined) { stats.imagesMissingVulnKey++; return; }
  if (!Array.isArray(vulns) || vulns.length === 0) { stats.imagesEmptyVulns++; return; }
  if (vulns.length > stats.maxVulnsPerImage) stats.maxVulnsPerImage = vulns.length;

  for (const v of vulns) {
    stats.occurrences++;

    for (const k of Object.keys(v)) vulnKeys.add(k);
    for (const k of EXPECTED_VULN_KEYS) {
      if (!(k in v)) bump(missingKeyCounts, k);
    }

    bump(sevCounts, String(v.severity));
    bump(pkgTypeCounts, String(v.packageType));
    bump(ownerCounts, String(v.owner));

    if (statusSamples.size < 2000) statusSamples.add(String(v.status));
    else statusDistinctOverflow = true;

    // quirk H — supposedly always-empty fields
    for (const f of EXPECTED_EMPTY) {
      const val = v[f];
      if (val !== '' && val !== undefined && val !== null) {
        const rec = emptyFieldViolations[f];
        rec.count++;
        if (rec.samples.length < 3) rec.samples.push(JSON.stringify(val).slice(0, 120));
      }
    }

    // quirk D — riskFactors object-as-set
    if (v.riskFactors && typeof v.riskFactors === 'object') {
      for (const [label, val] of Object.entries(v.riskFactors)) {
        bump(riskFactorCounts, label);
        if (val && typeof val === 'object' && Object.keys(val).length > 0) riskFactorNonEmptyValues++;
      }
    }

    if (!Array.isArray(v.applicableRules)) applicableRulesNonArray++;

    noteDate('published', v.published);
    noteDate('fixDate', v.fixDate);
    noteDate('layerTime', v.layerTime);

    const descLen = typeof v.description === 'string' ? v.description.length : 0;
    stats.descBytesRaw += descLen;
    stats.linkBytesRaw += typeof v.link === 'string' ? v.link.length : 0;

    // CVE catalog consistency — is dedup by CVE id actually safe?
    const cve = String(v.cve);
    let m = cveMap.get(cve);
    if (!m) {
      m = { count: 0, cvss: v.cvss, cvssConflicts: null, sev: v.severity, sevConflicts: null, descLen, descLenConflict: false };
      cveMap.set(cve, m);
    }
    m.count++;
    if (v.cvss !== m.cvss) (m.cvssConflicts ??= new Set([m.cvss])).add(v.cvss);
    if (v.severity !== m.sev) (m.sevConflicts ??= new Set([m.sev])).add(v.severity);
    if (descLen !== m.descLen) m.descLenConflict = true;
  }
}

// ------------------------------------------------------------- tokenizer ---

// Depth convention: root '{' -> 1; groups obj -> 2; group obj -> 3; repos -> 4;
// repo obj -> 5; images -> 6; image obj -> 7.
const keyAtDepth = [];
let depth = 0;
let inString = false;
let escaped = false;
let curStr = '';
let pendingString = null;   // completed string awaiting key/value disambiguation
let capturing = false;
let captureStart = -1;
let curGroup = null, curRepo = null, curImage = null;
let groupHadRepos = false;

let buf = '';
let scanFrom = 0;
let bytesRead = 0;
let lastProgress = 0;

function isImagePath() {
  return keyAtDepth[1] === 'groups' && keyAtDepth[3] === 'repos' && keyAtDepth[5] === 'images';
}

function scan(endIdx) {
  for (let i = scanFrom; i < endIdx; i++) {
    const c = buf.charCodeAt(i);

    if (inString) {
      if (escaped) { escaped = false; if (!capturing) curStr += buf[i]; continue; }
      if (c === 92 /* \ */) { escaped = true; if (!capturing) curStr += buf[i]; continue; }
      if (c === 34 /* " */) { inString = false; if (!capturing) { pendingString = curStr; curStr = ''; } continue; }
      if (!capturing) curStr += buf[i];
      continue;
    }

    switch (c) {
      case 34: // "
        inString = true;
        if (!capturing) curStr = '';
        break;
      case 58: // :
        if (!capturing && pendingString !== null) {
          keyAtDepth[depth] = pendingString;
          pendingString = null;
        }
        break;
      case 123: // {
      case 91:  // [
        if (!capturing) pendingString = null;
        depth++;
        if (!capturing && c === 123 && depth === 7 && isImagePath()) {
          capturing = true;
          captureStart = i;
          curGroup = keyAtDepth[2]; curRepo = keyAtDepth[4]; curImage = keyAtDepth[6];
        }
        if (!capturing) {
          if (c === 123 && depth === 3 && keyAtDepth[1] === 'groups') {
            stats.groups++;
            groupHadRepos = false;
          }
          if (c === 123 && depth === 4 && keyAtDepth[3] === 'repos') groupHadRepos = true;
          if (c === 123 && depth === 5 && keyAtDepth[1] === 'groups' && keyAtDepth[3] === 'repos') stats.repos++;
        }
        break;
      case 125: // }
      case 93:  // ]
        depth--;
        if (capturing && depth === 6) {
          processImage(curGroup, curRepo, curImage, buf.slice(captureStart, i + 1));
          capturing = false;
          captureStart = -1;
        }
        if (!capturing && depth === 2 && keyAtDepth[1] === 'groups' && c === 125 && !groupHadRepos) {
          // closing a group object that never opened a repos entry
          stats.groupsMissingRepos++;
        }
        if (!capturing) pendingString = null;
        break;
      default:
        if (c === 44 /* , */) { if (!capturing) pendingString = null; }
        break;
    }
  }
  scanFrom = endIdx;
}

// ------------------------------------------------------------------ main ---

const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1 << 20 });

for await (const chunk of stream) {
  bytesRead += Buffer.byteLength(chunk);
  buf += chunk;
  scan(buf.length);
  // trim processed text
  if (capturing) {
    buf = buf.slice(captureStart);
    scanFrom = buf.length;
    captureStart = 0;
  } else {
    buf = '';
    scanFrom = 0;
  }
  if (bytesRead - lastProgress > 50 * 1024 * 1024) {
    lastProgress = bytesRead;
    console.error(`  … ${(bytesRead / 1048576).toFixed(0)}MB / ${(fileBytes / 1048576).toFixed(0)}MB`);
  }
}

const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
const mem = process.memoryUsage();

// ---------------------------------------------------------------- report ---

const fmt = (n) => n.toLocaleString('en-US');
const mb = (n) => `${(n / 1048576).toFixed(1)}MB`;
const sortDesc = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);

const uniqueCves = cveMap.size;
const cvssConflicts = [...cveMap.entries()].filter(([, m]) => m.cvssConflicts);
const sevConflicts = [...cveMap.entries()].filter(([, m]) => m.sevConflicts);
const descConflicts = [...cveMap.entries()].filter(([, m]) => m.descLenConflict);
let cvssMin = Infinity, cvssMax = -Infinity, cvssNonNumber = 0;
for (const [, m] of cveMap) {
  if (typeof m.cvss === 'number') {
    if (m.cvss < cvssMin) cvssMin = m.cvss;
    if (m.cvss > cvssMax) cvssMax = m.cvss;
  } else cvssNonNumber++;
}

// severity vs cvss divergence (per unique CVE, first-seen values)
let highCvssLowSev = 0;
for (const [, m] of cveMap) {
  if (typeof m.cvss === 'number' && m.cvss >= 7 && (m.sev === 'low' || m.sev === 'medium')) highCvssLowSev++;
}

const R = [];
R.push(`# Phase 0 report — ${filePath}`);
R.push(`Scanned ${mb(bytesRead)} of ${mb(fileBytes)} in ${elapsed}s  |  peak RSS ${mb(mem.rss)}`);
R.push('');
R.push('## Truncation');
if (capturing || depth > 0) {
  R.push(`FILE IS TRUNCATED. Scanner ended at depth ${depth}${capturing ? ' inside an image object' : ''}.`);
  if (capturing) R.push(`Partial trailing image discarded: group="${curGroup}" repo="${curRepo}" image="${curImage}" (${mb(buf.length)} of unparsed tail)`);
} else {
  R.push('File parsed to a clean end (depth returned to 0).');
}
R.push('');
R.push('## Counts');
R.push(`groups: ${fmt(stats.groups)}   repos: ${fmt(stats.repos)}   images: ${fmt(stats.images)} (malformed: ${stats.malformedImages})`);
R.push(`occurrences: ${fmt(stats.occurrences)}   unique CVEs: ${fmt(uniqueCves)}`);
R.push(`DEDUP RATIO: ${(stats.occurrences / uniqueCves).toFixed(1)}x  (occurrences per unique CVE)`);
R.push(`images missing 'vulnerabilities' key: ${stats.imagesMissingVulnKey}   images with empty vulns: ${stats.imagesEmptyVulns}   groups without repos: ${stats.groupsMissingRepos}`);
R.push(`max vulns in one image: ${fmt(stats.maxVulnsPerImage)}   largest image object: ${mb(stats.maxImageBytes)}`);
R.push('');
R.push('## Redundancy');
R.push(`raw description chars across all occurrences: ${mb(stats.descBytesRaw)} (${((stats.descBytesRaw / fileBytes) * 100).toFixed(1)}% of file)`);
R.push(`raw link chars: ${mb(stats.linkBytesRaw)}`);
let dedupedDesc = 0;
for (const [, m] of cveMap) dedupedDesc += m.descLen;
R.push(`deduped description chars (one per CVE): ${mb(dedupedDesc)} — saves ${mb(stats.descBytesRaw - dedupedDesc)}`);
R.push('');
R.push('## Severity (quirk I)');
for (const [k, v] of sortDesc(sevCounts)) R.push(`  "${k}": ${fmt(v)}`);
R.push('');
R.push('## CVE catalog consistency (is dedup safe?)');
R.push(`CVEs with conflicting cvss across occurrences: ${cvssConflicts.length}${cvssConflicts.length ? '  e.g. ' + cvssConflicts.slice(0, 3).map(([c, m]) => `${c}:[${[...m.cvssConflicts]}]`).join(' ') : ''}`);
R.push(`CVEs with conflicting severity across occurrences: ${sevConflicts.length}${sevConflicts.length ? '  e.g. ' + sevConflicts.slice(0, 3).map(([c, m]) => `${c}:[${[...m.sevConflicts]}]`).join(' ') : ''}`);
R.push(`CVEs with differing description lengths: ${descConflicts.length}`);
R.push(`cvss range: ${cvssMin}–${cvssMax}   non-numeric cvss: ${cvssNonNumber}`);
R.push(`high-CVSS(≥7) labeled low/medium: ${fmt(highCvssLowSev)} unique CVEs (quirk C, scatter material)`);
R.push('');
R.push('## Package types');
for (const [k, v] of sortDesc(pkgTypeCounts)) R.push(`  "${k}": ${fmt(v)}`);
R.push('');
R.push('## Risk factors (quirk D)');
R.push(`distinct labels: ${riskFactorCounts.size}   non-empty value objects: ${riskFactorNonEmptyValues}`);
for (const [k, v] of sortDesc(riskFactorCounts)) R.push(`  "${k}": ${fmt(v)}`);
R.push('');
R.push('## Supposedly-empty fields (quirk H)');
for (const f of EXPECTED_EMPTY) {
  const rec = emptyFieldViolations[f];
  R.push(`  ${f}: ${rec.count === 0 ? 'ALWAYS empty ✓' : `${fmt(rec.count)} non-empty! samples: ${rec.samples.join(' | ')}`}`);
}
R.push('');
R.push('## Vulnerability record keys');
R.push(`union of keys seen: ${[...vulnKeys].join(', ')}`);
const unexpected = [...vulnKeys].filter((k) => !EXPECTED_VULN_KEYS.has(k));
R.push(`unexpected keys: ${unexpected.length ? unexpected.join(', ') : 'none'}`);
R.push(`missing expected keys: ${missingKeyCounts.size === 0 ? 'none' : [...missingKeyCounts.entries()].map(([k, v]) => `${k}(${fmt(v)})`).join(', ')}`);
R.push(`applicableRules non-array: ${applicableRulesNonArray}`);
R.push('');
R.push('## Dates (quirks F/G)');
for (const f of DATE_FIELDS) {
  const d = dateStats[f];
  R.push(`  ${f}: ok=${fmt(d.ok)} badFormat=${d.badFormat}${d.badSamples.length ? ' ' + d.badSamples.join(',') : ''} empty=${fmt(d.empty)} epochZero=${fmt(d.epochZero)} range=[${d.min} .. ${d.max}]`);
}
R.push('');
R.push('## Other fields');
R.push(`owner values: ${sortDesc(ownerCounts).slice(0, 5).map(([k, v]) => `"${k}"(${fmt(v)})`).join(' ')}`);
R.push(`buildType values: ${sortDesc(buildTypeCounts).slice(0, 10).map(([k, v]) => `"${k}"(${fmt(v)})`).join(' ')}`);
R.push(`distinct status strings: ${statusSamples.size}${statusDistinctOverflow ? '+ (capped)' : ''}   e.g. ${[...statusSamples].slice(0, 3).map((s) => `"${s}"`).join(' ')}`);
R.push('');
R.push('## Top 5 CVEs by occurrence count');
for (const [c, m] of [...cveMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5)) {
  R.push(`  ${c}: ${fmt(m.count)} occurrences (severity=${m.sev}, cvss=${m.cvss})`);
}

console.log(R.join('\n'));
