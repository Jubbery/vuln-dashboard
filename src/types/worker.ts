/** Message contract between the main thread and the ingest worker (§6.2). */

import type { Aggregates, CveMeta, ImageMeta, IngestDiagnostics, Occurrence } from './vulnerability.ts';

export type WorkerRequest = { type: 'START'; url: string };

/**
 * Maps do not survive structured cloning cleanly alongside large payloads in
 * all engines — the catalog crosses the boundary as an entries array and is
 * rebuilt into a Map on the main thread.
 */
export interface SerializedDataset {
  cveCatalogEntries: Array<[string, CveMeta]>;
  occurrences: Occurrence[];
  imageMeta: ImageMeta[];
  groupNames: string[];
  repoNames: string[];
  aggregates: Aggregates;
  diagnostics: IngestDiagnostics;
}

export type WorkerResponse =
  | { type: 'PROGRESS'; bytesRead: number; totalBytes: number; phase: 'parsing' | 'aggregating' }
  | { type: 'DONE'; payload: SerializedDataset }
  | { type: 'ERROR'; message: string; recoverable: boolean };
