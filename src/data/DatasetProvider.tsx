/**
 * Owns the ingest worker lifecycle and the dataset itself.
 *
 * The dataset (~60MB normalized) lives in a module-level singleton exposed
 * through Context — deliberately OUTSIDE Redux (brief §2.1). It is immutable
 * after ingestion, so it needs no reducer, and keeping it out of the store
 * keeps devtools serialization and RTK's dev-mode checks fast.
 */

import { createContext, useEffect, useRef, useState, type ReactNode } from 'react';
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

/** Module-level singleton. Never mutated after DONE. */
let datasetSingleton: Dataset | null = null;

export const DatasetContext = createContext<Dataset | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }): ReactNode {
  const dispatch = useAppDispatch();
  const [dataset, setDataset] = useState<Dataset | null>(datasetSingleton);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || datasetSingleton !== null) return; // StrictMode double-mount guard
    startedRef.current = true;

    const worker = new Worker(new URL('../workers/ingest.worker.ts', import.meta.url), {
      type: 'module',
    });

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
    const req: WorkerRequest = { type: 'START', url: DATA_URL };
    worker.postMessage(req);
  }, [dispatch]);

  return <DatasetContext.Provider value={dataset}>{children}</DatasetContext.Provider>;
}
