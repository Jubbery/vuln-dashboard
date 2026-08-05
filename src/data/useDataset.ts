import { useContext } from 'react';
import type { Dataset } from '../types/vulnerability.ts';
import { DatasetContext } from './DatasetProvider.tsx';

/** Nullable variant — for components that render during ingestion. */
export function useDatasetOrNull(): Dataset | null {
  return useContext(DatasetContext);
}

/** Strict variant — for routes only reachable after ingestion completes. */
export function useDataset(): Dataset {
  const ds = useContext(DatasetContext);
  if (ds === null) {
    throw new Error('useDataset called before ingestion completed — gate the route on ingestion status');
  }
  return ds;
}
