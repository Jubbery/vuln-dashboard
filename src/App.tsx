/**
 * Ingestion gate: the routed dashboard mounts only once the dataset is ready,
 * so every page can use the strict useDataset() without null checks.
 */

import { RouterProvider } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { router } from './router.tsx';
import { useAppSelector } from './store/index.ts';
import { useDatasetOrNull } from './data/useDataset.ts';
import { LoadingState } from './components/primitives/LoadingState.tsx';
import { ErrorState } from './components/primitives/ErrorState.tsx';
import { formatBytes } from './utils/format.ts';

function GateFrame({ children }: { children: ReactNode }): ReactNode {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default' }}>
      <Paper sx={{ width: 'min(560px, 92vw)', p: 2 }}>
        <Typography variant="h3" component="h1" sx={{ px: 2, pt: 1.5 }}>Vulnerability Dashboard</Typography>
        {children}
      </Paper>
    </Box>
  );
}

export default function App(): ReactNode {
  const ingestion = useAppSelector((s) => s.ingestion);
  const dataset = useDatasetOrNull();

  if (ingestion.status === 'error') {
    return (
      <GateFrame>
        <ErrorState
          title="Ingestion failed"
          message={ingestion.error ?? 'Unknown error'}
          hint="Is ui_demo.json present in public/? See the README for setup."
        />
      </GateFrame>
    );
  }

  if (dataset === null) {
    const pct = ingestion.totalBytes > 0
      ? Math.min(100, (ingestion.bytesRead / ingestion.totalBytes) * 100)
      : undefined;
    return (
      <GateFrame>
        <LoadingState
          label={ingestion.status === 'aggregating' ? 'Aggregating…' : 'Parsing scan file…'}
          percent={pct}
          detail={`${formatBytes(ingestion.bytesRead)} of ${formatBytes(ingestion.totalBytes)} — streamed off the main thread`}
        />
      </GateFrame>
    );
  }

  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
