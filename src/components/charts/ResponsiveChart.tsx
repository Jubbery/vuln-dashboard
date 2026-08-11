import Box from '@mui/material/Box';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface ChartSize {
  width: number;
  height: number;
}

export interface ResponsiveChartProps {
  /** Fixed pixel height, or 'fill' to track the container's height too
   *  (used inside the resizable dashboard grid). */
  height: number | 'fill';
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
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const fill = height === 'fill';

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    // Initial synchronous measure: don't depend on the observer's first
    // callback for the first paint (it can be lost across dev HMR swaps,
    // leaving the chart permanently unrendered at width 0).
    const rect = el.getBoundingClientRect();
    setSize({ w: rect.width, h: rect.height });
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r === undefined) return;
      // Sub-pixel resize churn (scrollbars, zoom) shouldn't re-render charts.
      setSize((prev) =>
        Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1
          ? prev
          : { w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, []);

  const measuredH = fill ? size.h : height;
  return (
    <Box ref={ref} sx={{ width: '100%', height: fill ? '100%' : height, position: 'relative' }}>
      {size.w > 0 && measuredH > 0 ? children({ width: size.w, height: measuredH }) : null}
    </Box>
  );
}
