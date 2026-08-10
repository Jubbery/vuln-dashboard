import Paper from '@mui/material/Paper';
import { useCallback, useState, type ReactNode, type MouseEvent } from 'react';

export interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

/**
 * Tooltip state for SVG charts. `show` reads offsetX/offsetY from the native
 * event, which are relative to the SVG — and therefore to the ResponsiveChart
 * wrapper the tooltip is absolutely positioned in, since the SVG fills it.
 */
export function useChartTooltip(): {
  tip: TooltipState | null;
  show: (e: MouseEvent, content: ReactNode) => void;
  hide: () => void;
} {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const show = useCallback((e: MouseEvent, content: ReactNode) => {
    setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, content });
  }, []);
  const hide = useCallback(() => { setTip(null); }, []);
  return { tip, show, hide };
}

/** Floating readout rendered inside the ResponsiveChart wrapper. */
export function ChartTooltip({ tip, width }: { tip: TooltipState | null; width: number }): ReactNode {
  if (tip === null) return null;
  // Clamp so the tooltip never overflows the chart's horizontal bounds.
  const x = Math.min(Math.max(tip.x, 70), width - 70);
  return (
    <Paper
      role="status"
      sx={{
        position: 'absolute',
        left: x,
        top: tip.y,
        transform: 'translate(-50%, calc(-100% - 10px))',
        pointerEvents: 'none',
        px: 1.25,
        py: 0.75,
        zIndex: 2,
        fontSize: '0.75rem',
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        bgcolor: '#232c38',
        borderColor: '#33404f',
      }}
    >
      {tip.content}
    </Paper>
  );
}
