import Chip from '@mui/material/Chip';
import { useTheme, alpha } from '@mui/material/styles';
import BoltIcon from '@mui/icons-material/Bolt';
import type { ReactNode } from 'react';
import { ACTIONABLE_RISK_FACTORS } from '../../theme/severity.ts';

export interface RiskFactorChipProps {
  label: string;
  onClick?: () => void;
  selected?: boolean;
}

/**
 * Risk-factor tag. "Exploit exists - in the wild" and "Remote execution" get
 * high-visibility treatment — those are what a security team acts on (§8.3).
 */
export function RiskFactorChip({ label, onClick, selected = false }: RiskFactorChipProps): ReactNode {
  const theme = useTheme();
  const actionable = ACTIONABLE_RISK_FACTORS.has(label);
  const color = actionable ? theme.palette.severity.critical : theme.palette.text.secondary;
  return (
    <Chip
      size="small"
      label={label}
      onClick={onClick}
      icon={actionable ? <BoltIcon sx={{ fontSize: 14 }} /> : undefined}
      sx={{
        color: actionable ? color : theme.palette.text.primary,
        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.25) : alpha(color, actionable ? 0.16 : 0.08),
        border: `1px solid ${selected ? theme.palette.primary.main : alpha(color, actionable ? 0.5 : 0.25)}`,
        '& .MuiChip-icon': { color },
      }}
    />
  );
}
