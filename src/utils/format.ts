const NUM = new Intl.NumberFormat('en-US');
const DATE = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
});

export const formatNumber = (n: number): string => NUM.format(n);

export const formatCompact = (n: number): string =>
  n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : NUM.format(n);

/** Epoch ms -> "Mar 20, 2024"; null-safe (epoch-zero sentinel is already null). */
export const formatDate = (ms: number | null): string => (ms === null ? '—' : DATE.format(ms));

export const formatBytes = (n: number): string => {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)}MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${n}B`;
};

export const formatPercent = (part: number, whole: number): string =>
  whole === 0 ? '0%' : `${((part / whole) * 100).toFixed(part / whole < 0.1 ? 1 : 0)}%`;
