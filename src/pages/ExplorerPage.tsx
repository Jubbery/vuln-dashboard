import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useDataset } from '../data/useDataset.ts';
import { formatNumber } from '../utils/format.ts';

/** Phase 3 mounts the virtualized DataGrid + FilterPanel here. */
export default function ExplorerPage(): ReactNode {
  const dataset = useDataset();
  return (
    <Box>
      <Typography variant="h1" gutterBottom>Explorer</Typography>
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="body2" color="text.secondary">
          {formatNumber(dataset.occurrences.length)} occurrences ready for the
          virtualized grid (Phase 3).
        </Typography>
      </Paper>
    </Box>
  );
}
