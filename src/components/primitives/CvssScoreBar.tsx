import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { cvssColor } from '../../theme/severity.ts';

export interface CvssScoreBarProps {
  score: number;           // 0–10
  width?: number;          // px, of the bar track
  showValue?: boolean;
}

/** Compact CVSS meter: colored 0–10 track + numeric value. */
export function CvssScoreBar({ score, width = 64, showValue = true }: CvssScoreBarProps): ReactNode {
  const clamped = Math.max(0, Math.min(10, score));
  const color = cvssColor(clamped);
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
      aria-label={`CVSS score ${clamped.toFixed(1)} of 10`}>
      <Box sx={{ width, height: 6, borderRadius: 3, backgroundColor: alpha(color, 0.15) }}>
        <Box sx={{
          width: `${clamped * 10}%`, height: '100%', borderRadius: 3, backgroundColor: color,
        }} />
      </Box>
      {showValue && (
        <Typography variant="body2" sx={{ color, fontVariantNumeric: 'tabular-nums', minWidth: 28 }}>
          {clamped.toFixed(1)}
        </Typography>
      )}
    </Box>
  );
}
