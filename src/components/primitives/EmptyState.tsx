import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps): ReactNode {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 3, color: 'text.secondary' }}>
      <Box sx={{ fontSize: 42, mb: 1, display: 'flex', justifyContent: 'center' }}>
        {icon ?? <SearchOffIcon fontSize="inherit" />}
      </Box>
      <Typography variant="h3" color="text.primary" gutterBottom>{title}</Typography>
      {description !== undefined && (
        <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto' }}>{description}</Typography>
      )}
      {actionLabel !== undefined && onAction !== undefined && (
        <Button variant="outlined" size="small" onClick={onAction} sx={{ mt: 2 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
