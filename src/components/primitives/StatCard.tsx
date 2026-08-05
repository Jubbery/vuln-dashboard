import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon?: ReactNode;
  /** Optional accent color for the value (e.g. severity color). */
  accent?: string;
}

export function StatCard({ label, value, sublabel, icon, accent }: StatCardProps): ReactNode {
  return (
    <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
      {icon !== undefined && (
        <Box sx={{ color: accent ?? 'text.secondary', display: 'flex', fontSize: 28 }}>{icon}</Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {label}
        </Typography>
        <Typography variant="h2" sx={{ color: accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
          {value}
        </Typography>
        {sublabel !== undefined && (
          <Typography variant="body2" color="text.secondary" noWrap>
            {sublabel}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
