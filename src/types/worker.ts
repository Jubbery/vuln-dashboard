/** Message contract between the main thread and the ingest worker (§6.2). */

import type { Aggregates, CveMeta, ImageMeta, IngestDiagnostics, Occurrence } from './vulnerability.ts';

/** Ingest from a URL, or from a user-picked File — a File's stream() is the
 *  same ReadableStream the fetch path uses, so both run the identical
 *  tokenize → normalize → aggregate pipeline. */
export type WorkerRequest =
  | { type: 'START'; url: string }
  | { type: 'START_FILE'; file: File };

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
