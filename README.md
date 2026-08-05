# Security Vulnerability Dashboard

> **Status: Phase 1 of 7** — ingestion pipeline complete and measured. UI shell,
> explorer, charts, and full README land in later phases.

React + TypeScript dashboard that ingests a 270MB nested container-image
vulnerability scan and makes it explorable across groups, repos, images,
packages, and CVEs — without freezing the browser.

## Setup

```bash
npm install
# place the scan file (not committed — 270MB):
cp /path/to/ui_demo.json public/ui_demo.json
npm run dev
```

Node scripts (no install needed, zero-dependency):

```bash
node scripts/inspect-data.mjs path/to/ui_demo.json      # Phase 0 recon report
npm run ingest-node -- path/to/ui_demo.json             # run the full pipeline in Node, measured
```

## Measured so far (Phase 0/1, full 269.9MB file)

| Metric | Value |
|---|---|
| Parse + normalize (Node, same code as worker) | **4.0s** |
| Aggregation | 0.05s |
| Peak RSS (Node harness) | 333MB |
| Normalized dataset (JSON-serialized) | ~60MB |
| Occurrences / unique CVEs | 171,711 / 1,228 (**dedup 139.8×**) |
| Raw description bytes deduped away | 74.5MB of 75.0MB |

Browser-side numbers (worker parse time, tab heap, time-to-interactive) will be
recorded in Phase 7 on the deployed build.

## Why not `fetch().json()`

A 270MB `fetch().json()` holds the raw text and the parsed tree simultaneously
(~900MB–1.2GB peak) and blocks for the whole parse. Worse, **this file is
truncated** — it ends mid-record — so `JSON.parse` (and any parser assuming
well-formed input, including `stream-json`'s clean-EOF path) fails outright on
it. See `docs/PHASE0-FINDINGS.md`.

The pipeline instead streams the response through a string-aware brace-depth
tokenizer (`src/workers/tokenizer.ts`) that emits each complete image object
the moment its closing brace arrives. Peak transient memory is one image
object (max 1.3MB, measured). The truncated tail is quantified and surfaced in
the UI, not silently swallowed. Zero parsing dependencies.

Everything happens in a single pass inside a Web Worker: tokenize → normalize
→ sanitize → intern → dedupe → aggregate. The main thread receives progress
percentages and one finished payload; it never sees a raw record.

## Repository layout

See `src/` — structure follows the implementation brief §4. Phase 0 tooling in
`scripts/`, findings in `docs/PHASE0-FINDINGS.md`.
