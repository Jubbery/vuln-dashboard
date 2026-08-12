import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import { useState, type ReactNode } from 'react';
import { useDataset } from '../../data/useDataset.ts';
import { useDatasetControl } from '../../data/DatasetProvider.tsx';
import { ScanFilePicker } from './ScanFilePicker.tsx';
import { formatNumber } from '../../utils/format.ts';

/**
 * Shown only on the deployed build, which serves a committed 44MB sample
 * because the full 270MB scan exceeds free-tier hosting limits. Without this,
 * a reviewer could reasonably assume the smaller record count is the whole
 * story — so the app says so itself and offers the fix in place.
 *
 * Dismissible, and it disappears permanently once a file has been loaded.
 */
export function SampleDataNotice(): ReactNode {
  const { isSample } = useDatasetControl();
  const dataset = useDataset();
  const [dismissed, setDismissed] = useState(false);

  if (!isSample) return null;

  const { totals } = dataset.aggregates;

  return (
    <Collapse in={!dismissed}>
      <Alert
        severity="info"
        variant="outlined"
        onClose={() => setDismissed(true)}
        sx={{ mb: 2, alignItems: 'center' }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
            <ScanFilePicker label="Load ui_demo.json" />
          </Box>
        }
      >
        <AlertTitle sx={{ mb: 0.25 }}>You're viewing a sample of the scan</AlertTitle>
        This deployment serves a committed 44MB excerpt
        ({formatNumber(totals.occurrences)} findings across {totals.groups} groups)
        because the full 270MB file exceeds free-tier hosting limits.
        {' '}<strong>Load your own <code>ui_demo.json</code></strong> to run the
        complete 171,711-record scan — it streams through the identical worker
        pipeline and never leaves your browser.
      </Alert>
    </Collapse>
  );
}
