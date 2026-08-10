import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, alpha } from '@mui/material/styles';
import * as d3 from 'd3';
import { ACTIONABLE_RISK_FACTORS } from '../../theme/severity.ts';
import { useAppDispatch } from '../../store/index.ts';
import { riskFactorsSet } from '../../store/filtersSlice.ts';
import { EmptyState } from '../primitives/EmptyState.tsx';
import { ChartTooltip, useChartTooltip } from './ChartTooltip.tsx';
import { formatCompact, formatNumber, formatPercent } from '../../utils/format.ts';

export interface RiskFactorBarProps {
  byRiskFactor: Record<string, number>;
  /** For the tooltip's "% of occurrences" context. */
  totalOccurrences: number;
  width: number;
  height: number;
}

const MARGIN = { top: 4, right: 52, bottom: 4, left: 0 };
const LABEL_WIDTH = 200;

/**
 * §8.3 — risk-factor frequency over occurrences. The two labels a security
 * team acts on first ("Exploit exists - in the wild", "Remote execution")
 * are emphasized in the critical accent; everything else stays muted.
 * Clicking a bar filters the Explorer by that risk factor.
 */
export function RiskFactorBar({ byRiskFactor, totalOccurrences, width, height }: RiskFactorBarProps): ReactNode {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { tip, show, hide } = useChartTooltip();

  const rows = useMemo(
    () => Object.entries(byRiskFactor).map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    [byRiskFactor],
  );

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right - LABEL_WIDTH);
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const y = useMemo(
    () => d3.scaleBand<string>().domain(rows.map((r) => r.label)).range([0, innerH]).padding(0.32),
    [rows, innerH],
  );
  const x = useMemo(
    () => d3.scaleLinear().domain([0, d3.max(rows, (r) => r.count) ?? 1]).range([0, innerW]),
    [rows, innerW],
  );

  if (rows.length === 0) {
    return <EmptyState title="No risk factors" description="No risk-factor data available." />;
  }

  const truncate = (s: string): string => (s.length > 28 ? `${s.slice(0, 27)}…` : s);

  return (
    <>
      <svg width={width} height={height} role="img" aria-label="Risk factor frequency across occurrences">
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {rows.map((r) => {
            const actionable = ACTIONABLE_RISK_FACTORS.has(r.label);
            const color = actionable ? theme.palette.severity.critical : alpha(theme.palette.primary.main, 0.65);
            const yPos = y(r.label) ?? 0;
            return (
              <g
                key={r.label}
                transform={`translate(0,${yPos})`}
                cursor="pointer"
                onClick={() => {
                  dispatch(riskFactorsSet([r.label]));
                  void navigate('/explorer');
                }}
                onMouseMove={(e) => {
                  show(e, (
                    <span>
                      <strong>{r.label}</strong> {formatNumber(r.count)} occurrences
                      {' · '}{formatPercent(r.count, totalOccurrences)}
                      {actionable && <><br />actionable — click to triage in Explorer</>}
                    </span>
                  ));
                }}
                onMouseLeave={hide}
                aria-label={`${r.label}: ${formatNumber(r.count)} occurrences — filter Explorer`}
              >
                <rect x={0} y={-2} width={width - MARGIN.right} height={y.bandwidth() + 4} fill="transparent" />
                <text
                  x={LABEL_WIDTH - 10}
                  y={y.bandwidth() / 2}
                  dy="0.35em"
                  textAnchor="end"
                  fill={actionable ? theme.palette.severity.critical : theme.palette.text.primary}
                  fontSize={12}
                  fontWeight={actionable ? 600 : 400}
                >
                  {truncate(r.label)}
                </text>
                <rect
                  x={LABEL_WIDTH}
                  y={0}
                  width={Math.max(x(r.count), 1)}
                  height={y.bandwidth()}
                  rx={2}
                  fill={color}
                />
                <text
                  x={LABEL_WIDTH + x(r.count) + 8}
                  y={y.bandwidth() / 2}
                  dy="0.35em"
                  fill={theme.palette.text.secondary}
                  fontSize={11}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatCompact(r.count)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <ChartTooltip tip={tip} width={width} />
    </>
  );
}
