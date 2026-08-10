import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Shared frame for Overview charts: title, optional context line, chart. */
export function ChartCard({ title, subtitle, children }: ChartCardProps): ReactNode {
  return (
    <Paper sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h3">{title}</Typography>
      {subtitle !== undefined && (
        <Typography variant="caption" component="p" sx={{ mt: 0.25 }}>{subtitle}</Typography>
      )}
      <Box sx={{ flex: 1, mt: 1.5, minHeight: 0 }}>{children}</Box>
    </Paper>
  );
}
