import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import type { ReactNode } from 'react';

export interface LoadingStateProps {
  label?: string;
  /** 0–100 renders a determinate bar with the value; undefined = indeterminate spinner. */
  percent?: number;
  detail?: string;
}

export function LoadingState({ label = 'Loading…', percent, detail }: LoadingStateProps): ReactNode {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 3 }} role="status" aria-live="polite">
      {percent === undefined ? (
        <CircularProgress size={28} sx={{ mb: 2 }} />
      ) : (
        <Box sx={{ maxWidth: 420, mx: 'auto', mb: 1.5 }}>
          <LinearProgress variant="determinate" value={Math.min(100, percent)} sx={{ height: 8, borderRadius: 4 }} />
        </Box>
      )}
      <Typography variant="body1" color="text.primary">
        {label}{percent !== undefined ? ` ${percent.toFixed(0)}%` : ''}
      </Typography>
      {detail !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{detail}</Typography>
      )}
    </Box>
  );
}
