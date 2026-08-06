import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { Severity } from '../../types/vulnerability.ts';
import { SEVERITY_ORDER, SEVERITY_LABEL } from '../../theme/severity.ts';
import { formatNumber } from '../../utils/format.ts';

export interface SeverityStackedBarProps {
  counts: Record<Severity, number>;
  height?: number;
}

/** Proportional severity composition bar for rollup rows. */
export function SeverityStackedBar({ counts, height = 8 }: SeverityStackedBarProps): ReactNode {
  const theme = useTheme();
  const total = SEVERITY_ORDER.reduce((s, sev) => s + counts[sev], 0);
  if (total === 0) return null;

  const label = SEVERITY_ORDER
    .filter((s) => counts[s] > 0)
    .map((s) => `${SEVERITY_LABEL[s]}: ${formatNumber(counts[s])}`)
    .join(' · ');

  return (
    <Tooltip title={label}>
      <Box
        role="img"
        aria-label={`Severity composition — ${label}`}
        sx={{ display: 'flex', height, borderRadius: height / 2, overflow: 'hidden', width: '100%' }}
      >
        {SEVERITY_ORDER.filter((s) => counts[s] > 0).map((s) => (
          <Box
            key={s}
            sx={{
              width: `${(counts[s] / total) * 100}%`,
              backgroundColor: theme.palette.severity[s],
              minWidth: 2,
            }}
          />
        ))}
      </Box>
    </Tooltip>
  );
}
