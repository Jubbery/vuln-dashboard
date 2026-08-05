/// <reference lib="webworker" />
/**
 * Ingest worker — the only place raw scan data ever exists.
 * Single pass: stream -> tokenize -> normalize -> intern -> dedupe -> aggregate.
 * The main thread receives progress numbers and one finished payload.
 */

import type { WorkerRequest, WorkerResponse, SerializedDataset } from '../types/worker.ts';
import { createImageTokenizer } from './tokenizer.ts';
import { createNormalizer } from './normalize.ts';
import { computeAggregates } from './aggregate.ts';

declare const self: DedicatedWorkerGlobalScope;

const PROGRESS_INTERVAL_MS = 150;

const post = (msg: WorkerResponse): void => self.postMessage(msg);

async function ingest(url: string): Promise<void> {
  const t0 = performance.now();

  const res = await fetch(url);
  if (!res.ok) {
    post({ type: 'ERROR', message: `Fetch failed: ${res.status} ${res.statusText}`, recoverable: true });
    return;
  }
  if (res.body === null) {
    post({ type: 'ERROR', message: 'Response has no body stream', recoverable: false });
    return;
  }
  const totalBytes = Number(res.headers.get('Content-Length') ?? 0);

  const normalizer = createNormalizer();
  const tokenizer = createImageTokenizer((e) =>
    normalizer.addImage(e.group, e.repo, e.imageKey, e.raw),
  );

  const decoder = new TextDecoder('utf-8');
  const reader = res.body.getReader();
  let bytesRead = 0;
  let lastProgress = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    tokenizer.push(decoder.decode(value, { stream: true }));
    const now = performance.now();
    if (now - lastProgress > PROGRESS_INTERVAL_MS) {
      lastProgress = now;
      post({ type: 'PROGRESS', bytesRead, totalBytes, phase: 'parsing' });
    }
  }
  tokenizer.push(decoder.decode()); // flush trailing multi-byte sequence

  post({ type: 'PROGRESS', bytesRead, totalBytes, phase: 'aggregating' });

  const tok = tokenizer.finish();
  const norm = normalizer.finish();
  const aggregates = computeAggregates(
    norm.occurrences,
    norm.imageMeta,
    norm.cveCatalog,
    { groups: tok.groupCount, repos: tok.repoCount },
    { byRiskFactor: norm.byRiskFactor, withFixCount: norm.withFixCount },
  );

  const payload: SerializedDataset = {
    cveCatalogEntries: [...norm.cveCatalog.entries()],
    occurrences: norm.occurrences,
    imageMeta: norm.imageMeta,
    groupNames: norm.groupNames,
    repoNames: norm.repoNames,
    aggregates,
    diagnostics: {
      truncated: tok.truncated,
      unparsedTailBytes: tok.unparsedTailBytes,
      partialTailPath: tok.partialTailPath,
      recordFailures: norm.recordFailures,
      duplicateIds: norm.duplicateIds,
      parseTimeMs: Math.round(performance.now() - t0),
    },
  };

  post({ type: 'DONE', payload });
}

self.onmessage = (e: MessageEvent<WorkerRequest>): void => {
  if (e.data.type === 'START') {
    ingest(e.data.url).catch((err: unknown) => {
      post({
        type: 'ERROR',
        message: err instanceof Error ? err.message : String(err),
        recoverable: false,
      });
    });
  }
};
