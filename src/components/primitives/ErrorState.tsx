import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import type { ReactNode } from 'react';

export interface ErrorStateProps {
  title?: string;
  message: string;
  hint?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, hint, onRetry }: ErrorStateProps): ReactNode {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 3 }} role="alert">
      <ErrorOutlineIcon sx={{ fontSize: 42, color: 'severity.critical', mb: 1 }} />
      <Typography variant="h3" gutterBottom>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: 'auto' }}>
        {message}
      </Typography>
      {hint !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, opacity: 0.7 }}>{hint}</Typography>
      )}
      {onRetry !== undefined && (
        <Button variant="outlined" size="small" onClick={onRetry} sx={{ mt: 2 }}>Retry</Button>
      )}
    </Box>
  );
}
