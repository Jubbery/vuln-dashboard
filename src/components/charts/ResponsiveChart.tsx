import Box from '@mui/material/Box';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface ChartSize {
  width: number;
  height: number;
}

export interface ResponsiveChartProps {
  /** Fixed pixel height; width tracks the container via ResizeObserver. */
  height: number;
  /** Render prop — receives the measured size once it is known. */
  children: (size: ChartSize) => ReactNode;
}

/**
 * Measures its own width with a ResizeObserver and hands concrete pixel
 * dimensions to the chart (§2.2: every chart takes width/height props and
 * never measures the DOM itself). position:relative so ChartTooltip can
 * absolutely position inside it.
 */
export function ResponsiveChart({ height, children }: ResponsiveChartProps): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      // Sub-pixel resize churn (scrollbars, zoom) shouldn't re-render charts.
      setWidth((prev) => (Math.abs(prev - w) < 1 ? prev : w));
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, []);

  return (
    <Box ref={ref} sx={{ width: '100%', height, position: 'relative' }}>
      {width > 0 ? children({ width, height }) : null}
    </Box>
  );
}
