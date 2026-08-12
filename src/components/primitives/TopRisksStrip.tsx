import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TopRisk } from '../../data/selectors.ts';

/** "Fix first" chips for any scope — exploited CVEs pulse. */
export function TopRisksStrip({ topRisks, scopeLabel }: { topRisks: TopRisk[]; scopeLabel?: string }): ReactNode {
  const theme = useTheme();
  const navigate = useNavigate();
  // On phones the "· exploited" suffix pushes every chip onto its own row;
  // the pulse already carries that signal.
  const narrow = useMediaQuery(theme.breakpoints.down('sm'));
  if (topRisks.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
      <Tooltip title={`Most dangerous distinct CVEs ${scopeLabel ?? 'in this scope'}: actively exploited first, then severity, then CVSS`}>
        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <WhatshotIcon sx={{ fontSize: 16, color: theme.palette.severity.critical }} />
          fix first:
        </Typography>
      </Tooltip>
      {topRisks.map((r) => (
        <Chip
          key={r.cve}
          size="small"
          onClick={() => { void navigate(`/cve/${r.cve}`); }}
          label={`${r.cve} · ${r.cvss.toFixed(1)}${r.exploited && !narrow ? ' · exploited' : ''}`}
          sx={{
            fontWeight: 600,
            color: theme.palette.severity[r.severity],
            backgroundColor: alpha(theme.palette.severity[r.severity], 0.12),
            border: `1px solid ${alpha(theme.palette.severity[r.severity], r.exploited ? 0.9 : 0.4)}`,
            ...(r.exploited && {
              animation: 'riskPulse 2s ease-in-out infinite',
              '@keyframes riskPulse': {
                '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.severity.critical, 0)}` },
                '50%': { boxShadow: `0 0 8px 1px ${alpha(theme.palette.severity.critical, 0.5)}` },
              },
            }),
          }}
        />
      ))}
    </Box>
  );
}
