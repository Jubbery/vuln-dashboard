import { createTheme, type Theme } from '@mui/material/styles';
import type { Severity } from '../types/vulnerability.ts';
import { SEVERITY_COLOR, SEVERITY_COLOR_LIGHT, SEVERITY_FILL_LIGHT } from './severity.ts';

/** Severity palettes live on the theme (§7.1) — charts and primitives read
 *  from here, never from hardcoded hex. Two token sets: `severity` is
 *  text-safe (chips, labels, colored numbers); `severityFill` is for chart
 *  areas, where light mode needs vivid, hue-separated colors instead of the
 *  contrast-darkened ones. Dark mode uses one set for both. */
declare module '@mui/material/styles' {
  interface Palette {
    severity: Record<Severity, string>;
    severityFill: Record<Severity, string>;
  }
  interface PaletteOptions {
    severity?: Record<Severity, string>;
    severityFill?: Record<Severity, string>;
  }
}

export type ThemeMode = 'dark' | 'light';

const shared = {
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h1: { fontSize: '1.5rem', fontWeight: 600 },
    h2: { fontSize: '1.15rem', fontWeight: 600 },
    h3: { fontSize: '1rem', fontWeight: 600 },
    body2: { fontSize: '0.83rem' },
  },
  shape: { borderRadius: 10 },
} as const;

function focusOverrides(outline: string): Record<string, object> {
  return {
    ':focus-visible': { outline: `2px solid ${outline}`, outlineOffset: '2px' },
    '.MuiButtonBase-root:focus-visible': { outline: `2px solid ${outline}`, outlineOffset: '-2px' },
  };
}

/** The default: dark security-console (see docs/DESIGN.md). */
function darkTheme(): Theme {
  return createTheme({
    ...shared,
    palette: {
      mode: 'dark',
      background: { default: '#0e1218', paper: '#151b24' },
      primary: { main: '#4f8ef7' },
      divider: '#232c38',
      text: { primary: '#dbe2ea', secondary: '#8b97a5' },
      severity: SEVERITY_COLOR,
      severityFill: SEVERITY_COLOR,
    },
    typography: { ...shared.typography, caption: { color: '#8b97a5' } },
    components: {
      MuiCssBaseline: { styleOverrides: focusOverrides('#4f8ef7') },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid #232c38' } } },
      MuiAppBar: {
        styleOverrides: {
          root: { background: '#0e1218', borderBottom: '1px solid #232c38', boxShadow: 'none' },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { background: '#232c38', border: '1px solid #33404f', fontSize: '0.75rem' },
        },
      },
    },
  });
}

/** Light "enterprise" variant — document-portal idiom (white surfaces,
 *  near-black text, hairline borders) for teams who live in tools like the
 *  Red Hat customer portal. Severity hues darkened for white; same scale
 *  semantics. */
function lightTheme(): Theme {
  return createTheme({
    ...shared,
    palette: {
      mode: 'light',
      background: { default: '#f4f5f7', paper: '#ffffff' },
      primary: { main: '#0057b8' },
      divider: '#d5d9de',
      text: { primary: '#151515', secondary: '#5c626b' },
      severity: SEVERITY_COLOR_LIGHT,
      severityFill: SEVERITY_FILL_LIGHT,
    },
    typography: { ...shared.typography, caption: { color: '#5c626b' } },
    components: {
      MuiCssBaseline: { styleOverrides: focusOverrides('#0057b8') },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none', border: '1px solid #d5d9de', boxShadow: 'none' } },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { background: '#ffffff', borderBottom: '1px solid #d5d9de', boxShadow: 'none' },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { background: '#151515', fontSize: '0.75rem' },
        },
      },
    },
  });
}

export function buildTheme(mode: ThemeMode): Theme {
  return mode === 'light' ? lightTheme() : darkTheme();
}

/** Kept for tests/back-compat; the app selects by preference at runtime. */
export const theme = darkTheme();
