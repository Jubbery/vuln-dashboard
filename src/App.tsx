/**
 * Phase 1 shell: proves the ingestion pipeline end to end in the browser —
 * real progress percentage, responsive main thread, diagnostics on completion.
 * Phase 2 replaces this with the routed MUI DashboardLayout.
 */

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { useAppSelector } from './store/index.ts';
import { useDatasetOrNull } from './data/useDataset.ts';

const mb = (n: number): string => `${(n / 1048576).toFixed(1)}MB`;
const fmt = (n: number): string => n.toLocaleString('en-US');

const page: CSSProperties = {
  minHeight: '100vh', display: 'grid', placeItems: 'center',
  background: '#0e1218', color: '#dbe2ea', fontFamily: 'system-ui, sans-serif',
};
const card: CSSProperties = {
  width: 'min(560px, 90vw)', padding: '32px 36px', borderRadius: 12,
  background: '#151b24', border: '1px solid #232c38',
};
const barTrack: CSSProperties = {
  height: 8, borderRadius: 4, background: '#232c38', overflow: 'hidden', margin: '16px 0 8px',
};

/** Ticks every animation frame — visibly freezes if the main thread blocks. */
function MainThreadPulse(): ReactNode {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    let alive = true;
    const loop = (): void => {
      if (!alive) return;
      setTick((t) => (t + 1) % 60);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);
  return (
    <span style={{ opacity: 0.5, fontSize: 12 }}>
      main thread live {'·'.repeat(1 + (tick % 3))}
    </span>
  );
}

export default function App(): ReactNode {
  const ingestion = useAppSelector((s) => s.ingestion);
  const dataset = useDatasetOrNull();

  const pct = ingestion.totalBytes > 0
    ? Math.min(100, (ingestion.bytesRead / ingestion.totalBytes) * 100)
    : 0;

  if (ingestion.status === 'error') {
    return (
      <div style={page}>
        <div style={card}>
          <h1 style={{ fontSize: 18, margin: 0 }}>Ingestion failed</h1>
          <p style={{ color: '#e5484d' }}>{ingestion.error}</p>
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            Is <code>ui_demo.json</code> in <code>public/</code>? See the README.
          </p>
        </div>
      </div>
    );
  }

  if (dataset === null) {
    const phase = ingestion.status === 'aggregating' ? 'Aggregating…' : 'Parsing scan file…';
    return (
      <div style={page}>
        <div style={card}>
          <h1 style={{ fontSize: 18, margin: 0 }}>Vulnerability Dashboard</h1>
          <div style={barTrack} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#4f8ef7', transition: 'width 150ms linear' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{phase} {pct.toFixed(0)}% ({mb(ingestion.bytesRead)} / {mb(ingestion.totalBytes)})</span>
            <MainThreadPulse />
          </div>
        </div>
      </div>
    );
  }

  const { totals } = dataset.aggregates;
  const d = dataset.diagnostics;
  return (
    <div style={page}>
      <div style={card}>
        <h1 style={{ fontSize: 18, margin: 0 }}>Dataset ready</h1>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          {fmt(totals.occurrences)} occurrences · {fmt(totals.uniqueCves)} unique CVEs ·{' '}
          {fmt(totals.images)} images · {fmt(totals.repos)} repos · {totals.groups} groups
          <br />
          parsed in {(d.parseTimeMs / 1000).toFixed(1)}s · dedup ratio{' '}
          {(totals.occurrences / totals.uniqueCves).toFixed(1)}×
        </p>
        {d.truncated && (
          <p style={{ fontSize: 13, color: '#f0b429' }}>
            Source file is truncated — one partial record ({mb(d.unparsedTailBytes)},{' '}
            {d.partialTailPath}) was discarded.
          </p>
        )}
        {d.recordFailures > 0 && (
          <p style={{ fontSize: 13, color: '#f0b429' }}>
            {fmt(d.recordFailures)} records failed to normalize and were skipped.
          </p>
        )}
        <p style={{ fontSize: 13, opacity: 0.6 }}>Phase 2 will mount the routed dashboard here.</p>
      </div>
    </div>
  );
}
