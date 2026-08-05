import Chip from '@mui/material/Chip';
import { useTheme, alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { Severity } from '../../types/vulnerability.ts';
import { SEVERITY_LABEL } from '../../theme/severity.ts';
import { formatCompact } from '../../utils/format.ts';

export interface SeverityBadgeProps {
  severity: Severity;
  /** Optional count rendered after the label, compact-formatted. */
  count?: number;
  size?: 'small' | 'medium';
}

export function SeverityBadge({ severity, count, size = 'small' }: SeverityBadgeProps): ReactNode {
  const theme = useTheme();
  const color = theme.palette.severity[severity];
  const label = count === undefined
    ? SEVERITY_LABEL[severity]
    : `${SEVERITY_LABEL[severity]} · ${formatCompact(count)}`;
  return (
    <Chip
      size={size}
      label={label}
      sx={{
        color,
        backgroundColor: alpha(color, 0.14),
        border: `1px solid ${alpha(color, 0.4)}`,
      }}
    />
  );
}
