import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import * as d3 from 'd3';
import type { Severity } from '../../types/vulnerability.ts';
import { SEVERITY_ORDER, SEVERITY_LABEL } from '../../theme/severity.ts';
import { useAppDispatch } from '../../store/index.ts';
import { severitiesSet } from '../../store/filtersSlice.ts';
import { EmptyState } from '../primitives/EmptyState.tsx';
import { ChartTooltip, useChartTooltip } from './ChartTooltip.tsx';
import { formatCompact, formatNumber, formatPercent } from '../../utils/format.ts';

interface Slice {
  severity: Severity;
  count: number;
}

export interface SeverityDonutProps {
  bySeverity: Record<Severity, number>;
  width: number;
  height: number;
}

/**
 * §8.1 — severity distribution donut. D3 computes the arcs, React renders
 * them (§2.2). Clicking an arc applies that severity filter and jumps into
 * the Explorer — charts double as filter entry points.
 */
export function SeverityDonut({ bySeverity, width, height }: SeverityDonutProps): ReactNode {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { tip, show, hide } = useChartTooltip();
  const [hovered, setHovered] = useState<Severity | null>(null);

  const data: Slice[] = useMemo(
    () => SEVERITY_ORDER.filter((s) => bySeverity[s] > 0).map((s) => ({ severity: s, count: bySeverity[s] })),
    [bySeverity],
  );
  const total = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);

  const r = Math.min(width, height) / 2 - 4;
  const arcs = useMemo(
    () => d3.pie<Slice>().value((d) => d.count).sort(null)(data),
    [data],
  );
  const arcPath = useMemo(
    () => d3.arc<d3.PieArcDatum<Slice>>().innerRadius(r * 0.65).outerRadius(r).cornerRadius(2).padAngle(0.012),
    [r],
  );

  if (total === 0) {
    return <EmptyState title="No findings" description="Severity data is empty." />;
  }

  const goExplore = (s: Severity): void => {
    dispatch(severitiesSet([s]));
    void navigate('/explorer');
  };
  /** Enter/Space activate like a button (Phase 6 keyboard nav). */
  const keyActivate = (s: Severity) => (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goExplore(s);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <svg
          width={Math.min(width, height)}
          height={height}
          role="img"
          aria-label={`Severity distribution: ${data.map((d) => `${SEVERITY_LABEL[d.severity]} ${formatNumber(d.count)}`).join(', ')}`}
        >
          <g transform={`translate(${Math.min(width, height) / 2},${height / 2})`}>
            {arcs.map((a) => (
              <path
                key={a.data.severity}
                d={arcPath(a) ?? ''}
                fill={theme.palette.severityFill[a.data.severity]}
                opacity={hovered === null || hovered === a.data.severity ? 1 : 0.45}
                cursor="pointer"
                role="button"
                tabIndex={0}
                aria-label={`${SEVERITY_LABEL[a.data.severity]}: ${formatNumber(a.data.count)} — filter Explorer`}
                onClick={() => { goExplore(a.data.severity); }}
                onKeyDown={keyActivate(a.data.severity)}
                onMouseMove={(e) => {
                  setHovered(a.data.severity);
                  show(e, (
                    <span>
                      <strong>{SEVERITY_LABEL[a.data.severity]}</strong> {formatNumber(a.data.count)}
                      {' · '}{formatPercent(a.data.count, total)}
                    </span>
                  ));
                }}
                onMouseLeave={() => { setHovered(null); hide(); }}
                style={{ transition: 'opacity 120ms' }}
              />
            ))}
            <text textAnchor="middle" dy="-0.15em" fill={theme.palette.text.primary} fontSize={22} fontWeight={600}>
              {formatCompact(total)}
            </text>
            <text textAnchor="middle" dy="1.4em" fill={theme.palette.text.secondary} fontSize={11}>
              findings
            </text>
          </g>
        </svg>
        <ChartTooltip tip={tip} width={Math.min(width, height)} />
      </Box>
      <Stack spacing={0.75} sx={{ minWidth: 0 }}>
        {data.map((d) => (
          <Stack
            key={d.severity}
            direction="row"
            spacing={1}
            alignItems="center"
            role="button"
            tabIndex={0}
            aria-label={`${SEVERITY_LABEL[d.severity]}: ${formatNumber(d.count)} — filter Explorer`}
            onClick={() => { goExplore(d.severity); }}
            onKeyDown={keyActivate(d.severity)}
            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: theme.palette.severityFill[d.severity], flexShrink: 0 }} />
            <Typography variant="body2" noWrap>{SEVERITY_LABEL[d.severity]}</Typography>
            <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(d.count)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
