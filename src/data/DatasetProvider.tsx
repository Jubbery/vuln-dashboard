/**
 * Owns the ingest worker lifecycle and the dataset itself.
 *
 * The dataset (~60MB normalized) lives in a module-level singleton exposed
 * through Context — deliberately OUTSIDE Redux (brief §2.1). It is immutable
 * after ingestion, so it needs no reducer, and keeping it out of the store
 * keeps devtools serialization and RTK's dev-mode checks fast.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Dataset } from '../types/vulnerability.ts';
import type { WorkerRequest, WorkerResponse } from '../types/worker.ts';
import { useAppDispatch } from '../store/index.ts';
import { ingestStarted, ingestProgress, ingestReady, ingestFailed } from '../store/ingestionSlice.ts';

/**
 * Local dev reads the full 270MB file from public/. Deployed builds set
 * VITE_DATA_URL to the committed sample (the full file exceeds free-tier
 * hosting limits) — the ingest path is byte-for-byte identical either way.
 */
const DATA_URL: string = import.meta.env.VITE_DATA_URL ?? '/ui_demo.json';
/** The deployed build points at the committed sample; local dev doesn't. */
const SERVING_SAMPLE = DATA_URL.includes('sample');

/** Module-level singleton. Never mutated after DONE; replaced wholesale when
 *  the user loads a different scan file. */
let datasetSingleton: Dataset | null = null;

export const DatasetContext = createContext<Dataset | null>(null);

/** Imperative dataset actions — separate context so data consumers don't
 *  re-render when the control object is created. */
export interface DatasetControl {
  /** Re-ingest from a user-picked scan file (email-adjacent feature: lets the
   *  deployed sample build run the full 270MB scan entirely client-side). */
  loadFile: (file: File) => void;
  /** True while showing the committed sample rather than a full scan — the
   *  deployed build. Drives the "load your own file" notice so a reviewer
   *  isn't left thinking 28k records is all there is. */
  isSample: boolean;
  /** Name of a user-loaded file, once one has been ingested. */
  loadedFileName: string | null;
}
export const DatasetControlContext = createContext<DatasetControl | null>(null);

export function useDatasetControl(): DatasetControl {
  const ctl = useContext(DatasetControlContext);
  if (ctl === null) throw new Error('useDatasetControl outside DatasetProvider');
  return ctl;
}

export function DatasetProvider({ children }: { children: ReactNode }): ReactNode {
  const dispatch = useAppDispatch();
  const [dataset, setDataset] = useState<Dataset | null>(datasetSingleton);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const startedRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  const start = useCallback((req: WorkerRequest): void => {
    workerRef.current?.terminate(); // abandon any in-flight ingest

    const worker = new Worker(new URL('../workers/ingest.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'PROGRESS':
          dispatch(ingestProgress(msg));
          break;
        case 'DONE': {
          const p = msg.payload;
          datasetSingleton = {
            cveCatalog: new Map(p.cveCatalogEntries), // rebuilt from entries (§6.2)
            occurrences: p.occurrences,
            imageMeta: p.imageMeta,
            groupNames: p.groupNames,
            repoNames: p.repoNames,
            aggregates: p.aggregates,
            diagnostics: p.diagnostics,
          };
          setDataset(datasetSingleton);
          dispatch(ingestReady(p.diagnostics));
          worker.terminate();
          break;
        }
        case 'ERROR':
          dispatch(ingestFailed(msg.message));
          worker.terminate();
          break;
      }
    };
    worker.onerror = (e) => dispatch(ingestFailed(e.message || 'Worker crashed'));

    dispatch(ingestStarted());
    worker.postMessage(req);
  }, [dispatch]);

  useEffect(() => {
    if (startedRef.current || datasetSingleton !== null) return; // StrictMode double-mount guard
    startedRef.current = true;
    start({ type: 'START', url: DATA_URL });
  }, [start]);

  const control = useMemo<DatasetControl>(() => ({
    loadFile: (file: File) => {
      datasetSingleton = null;
      setDataset(null);   // back to the gate; RouterProvider unmounts
      setLoadedFileName(file.name);
      start({ type: 'START_FILE', file });
    },
    isSample: SERVING_SAMPLE && loadedFileName === null,
    loadedFileName,
  }), [start, loadedFileName]);

  return (
    <DatasetControlContext.Provider value={control}>
      <DatasetContext.Provider value={dataset}>{children}</DatasetContext.Provider>
    </DatasetControlContext.Provider>
  );
}
