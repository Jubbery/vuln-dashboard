/**
 * Severity design tokens. A deliberate scale for a dark security console —
 * not stock red/yellow/green. Low is blue (cool = low urgency) rather than
 * green, which would wrongly read as "safe". All values checked for ≥4.5:1
 * contrast as text on the app background (#0e1218) and ≥3:1 for large UI.
 */

import type { Severity } from '../types/vulnerability.ts';

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#ff4d6d',
  high: '#ff9e57',
  medium: '#f2c94c',
  low: '#5fa8f5',
  unknown: '#8b97a5',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  unknown: 'Unknown',
};

/** Display order, most severe first. */
export const SEVERITY_ORDER: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'unknown'];

/**
 * Risk factors a security team acts on first (§8.3) — visually emphasized
 * wherever risk factors appear.
 */
export const ACTIONABLE_RISK_FACTORS: ReadonlySet<string> = new Set([
  'Exploit exists - in the wild',
  'Remote execution',
]);

/** Band color for a raw CVSS score (NVD v3 bands). */
export function cvssColor(score: number): string {
  if (score >= 9) return SEVERITY_COLOR.critical;
  if (score >= 7) return SEVERITY_COLOR.high;
  if (score >= 4) return SEVERITY_COLOR.medium;
  if (score > 0) return SEVERITY_COLOR.low;
  return SEVERITY_COLOR.unknown;
}
