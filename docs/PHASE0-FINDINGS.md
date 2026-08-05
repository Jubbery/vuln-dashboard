# Phase 0 — Data Reconnaissance Findings

Run: `node scripts/inspect-data.mjs ../ui_demo.json` (zero-dependency streaming inspector; full output in `docs/phase0-report.txt`).
Scanned 269.9MB in 3.9s, peak RSS 118.6MB.

## Headline numbers

| Metric | Value |
|---|---|
| Groups | 6 |
| Repos | 501 |
| Images | 756 |
| Vulnerability occurrences | 171,711 |
| Unique CVEs | 1,228 |
| **Dedup ratio** | **139.8×** |
| Raw description bytes | 75.0MB (27.8% of file) |
| Deduped description bytes | 0.5MB (saves 74.5MB) |
| Largest single image object | 1.3MB (max 846 vulns/image) |

## Findings that changed the plan

1. **The file is truncated.** It ends mid-string inside an image object
   (`1501-ci-cd / app_fdcgrbes / R3.36.0`, ~0.5MB unparsed tail). Any parser
   assuming well-formed JSON (`JSON.parse`, or `stream-json`'s clean-EOF path)
   fails outright. The ingest tokenizer therefore emits *complete image
   objects* as their closing brace arrives and treats EOF-mid-record as a
   quantified, reported condition — not an error.
2. **CVE metadata is not globally consistent.** 55 CVEs carry conflicting CVSS
   scores across occurrences (e.g. `CVE-2024-22243`: 3.4 vs 8.1) and 83 carry
   conflicting severities. Descriptions are 100% consistent per CVE. Catalog
   policy: descriptions/links dedupe safely; catalog `cvss` = max observed,
   catalog `severity` = worst observed (documented); per-occurrence
   severity/cvss remain authoritative on occurrence rows.
3. **Undocumented `kaiStatus` field** on 20,950 records (~12%):
   `"invalid - norisk"` (11,624) and `"ai-invalid-norisk"` (9,326) — the
   scanner's own triage verdict, including AI-dismissed findings. Kept on
   occurrences and exposed as a filter.
4. **Severity value set confirmed:** `critical` (990), `high` (33,021),
   `medium` (93,111), `low` (44,589). Union type updated; `unknown` retained
   as a defensive fallback.

## Quirk verification (brief §3.2)

| Quirk | Verdict |
|---|---|
| A. Redundancy | Confirmed, 139.8× — dedup is the memory win |
| B. `cve` not unique per image | Confirmed via composite-key design; uniqueness asserted at ingest |
| C. severity/CVSS divergence | Confirmed: 227 unique CVEs with CVSS ≥ 7 labeled low/medium |
| D. riskFactors object-as-set | Confirmed: 13 distinct labels, value objects always empty |
| E. Malformed unicode | Confirmed: literal `u00a0` ×21,658, `u2019` ×1,923, `u201c` ×2,623, `\\'` ×18,713 |
| F. Epoch-zero sentinel | Confirmed: layerTime ×8,782, fixDate ×31,218 → null |
| G. Non-ISO dates | Confirmed: 100% match `YYYY-MM-DD HH:mm:ss`, zero deviations → manual UTC parse |
| H. Six always-empty fields | **Confirmed across all 171,711 records** → dropped at ingest |
| I. Severity values | critical/high/medium/low (no others) |

## Other facts

- `owner`: only `"system"` (123,021) and `"user"` (48,690) — low signal, dropped.
- `packageType`: package (102,002), jar (66,947), python (2,530), app (175), nodejs (57).
- `status`: 798 distinct free-text strings ("fixed in …") — display-only, not facetable.
- `fixDate` empties: 1,880 `""` + 31,218 epoch-zero → both normalize to null.
- No image lacks `vulnerabilities`; no group lacks `repos`; zero malformed image objects (before the truncation point).
- Risk factor labels (13): Has fix, Attack vector: network, Attack complexity: low,
  Medium severity, DoS - High, DoS - Low, High severity, Package in use,
  Recent vulnerability, Remote execution, Exploit exists - POC,
  Exploit exists - in the wild, Critical severity.
