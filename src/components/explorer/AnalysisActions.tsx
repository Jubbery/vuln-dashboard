import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { alpha, useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/index.ts';
import { analysisToggled, aiAnalysisToggled } from '../../store/filtersSlice.ts';
import { formatNumber, formatPercent } from '../../utils/format.ts';

/**
 * The two triage action buttons from the assignment spec:
 * - "Analysis"    — filters out records dismissed by manual analysis
 *                   (kaiStatus "invalid - norisk")
 * - "AI Analysis" — filters out records dismissed by AI analysis
 *                   (kaiStatus "ai-invalid-norisk")
 *
 * Design notes: each button carries the count it would remove from the
 * CURRENT filter context (computed in the same selector pass as the rows, so
 * it stays truthful under combined filters). The impact bar underneath
 * animates the removed share out of the visible set — filter transitions are
 * something you watch happen, not just a number that changes.
 */

interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  sublabel: string;
  count: number;
  active: boolean;
  accent: string;
  onToggle: () => void;
}

function ActionButton({ icon, label, sublabel, count, active, accent, onToggle }: ActionButtonProps): ReactNode {
  const theme = useTheme();
  return (
    <ButtonBase
      onClick={onToggle}
      aria-pressed={active}
      aria-label={`${label}: ${active ? 'showing' : 'hiding'} ${formatNumber(count)} dismissed records — toggle`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.75,
        py: 1,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: active ? accent : 'divider',
        bgcolor: active ? alpha(accent, 0.14) : 'transparent',
        boxShadow: active ? `0 0 12px ${alpha(accent, 0.35)}` : 'none',
        transition: theme.transitions.create(['background-color', 'border-color', 'box-shadow'], {
          duration: 250,
        }),
        '&:hover': { borderColor: accent, bgcolor: alpha(accent, active ? 0.2 : 0.06) },
      }}
    >
      <Box sx={{
        display: 'flex',
        color: active ? accent : 'text.secondary',
        transition: 'color 250ms, transform 250ms',
        transform: active ? 'scale(1.12)' : 'scale(1)',
      }}>
        {icon}
      </Box>
      <Box sx={{ textAlign: 'left' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: active ? accent : 'text.primary', lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ lineHeight: 1.2, display: 'block' }}>
          {active ? `hiding ${formatNumber(count)}` : sublabel}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

export interface AnalysisActionsProps {
  /** Manual-analysis dismissals within the current filter context. */
  manualDismissed: number;
  /** AI-analysis dismissals within the current filter context. */
  aiDismissed: number;
  /** Rows currently visible after all filters. */
  visible: number;
}

export function AnalysisActions({ manualDismissed, aiDismissed, visible }: AnalysisActionsProps): ReactNode {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const analysisOn = useAppSelector((s) => s.filters.analysisOn);
  const aiAnalysisOn = useAppSelector((s) => s.filters.aiAnalysisOn);

  const manualAccent = theme.palette.severity.medium;
  const aiAccent = theme.palette.primary.main;

  const removedManual = analysisOn ? manualDismissed : 0;
  const removedAi = aiAnalysisOn ? aiDismissed : 0;
  const contextTotal = visible + removedManual + removedAi;

  const pct = (n: number): string => (contextTotal > 0 ? `${(n / contextTotal) * 100}%` : '0%');

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
        <ActionButton
          icon={<FactCheckIcon fontSize="small" />}
          label="Analysis"
          sublabel={`${formatNumber(manualDismissed)} manually dismissed`}
          count={manualDismissed}
          active={analysisOn}
          accent={manualAccent}
          onToggle={() => dispatch(analysisToggled())}
        />
        <ActionButton
          icon={<SmartToyIcon fontSize="small" />}
          label="AI Analysis"
          sublabel={`${formatNumber(aiDismissed)} AI dismissed`}
          count={aiDismissed}
          active={aiAnalysisOn}
          accent={aiAccent}
          onToggle={() => dispatch(aiAnalysisToggled())}
        />
        {(removedManual + removedAi > 0) && (
          <Typography variant="caption" sx={{ ml: 0.5 }} aria-live="polite">
            triage removed {formatNumber(removedManual + removedAi)} of {formatNumber(contextTotal)}
            {' '}({formatPercent(removedManual + removedAi, contextTotal)})
          </Typography>
        )}
      </Box>

      {/* Impact bar: visible vs. removed shares of the current context.
          Widths animate on toggle — the "engaging transition" the spec asks
          for, and an honest one: proportions are real. */}
      <Tooltip
        title={`${formatNumber(visible)} shown · ${formatNumber(removedManual)} removed by Analysis · ${formatNumber(removedAi)} removed by AI Analysis`}
      >
        <Box
          role="img"
          aria-label={`Filter impact: ${formatNumber(visible)} of ${formatNumber(contextTotal)} records shown`}
          sx={{
            mt: 1,
            display: 'flex',
            height: 6,
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: alpha(theme.palette.text.secondary, 0.12),
          }}
        >
          <Box sx={{ width: pct(visible), bgcolor: alpha(theme.palette.text.primary, 0.55), transition: 'width 400ms ease' }} />
          <Box sx={{ width: pct(removedManual), bgcolor: alpha(manualAccent, 0.75), transition: 'width 400ms ease' }} />
          <Box sx={{ width: pct(removedAi), bgcolor: alpha(aiAccent, 0.75), transition: 'width 400ms ease' }} />
        </Box>
      </Tooltip>
    </Box>
  );
}
