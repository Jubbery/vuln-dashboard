import { createTheme } from '@mui/material/styles';
import type { Severity } from '../types/vulnerability.ts';
import { SEVERITY_COLOR } from './severity.ts';

/** Severity palette lives on the theme (§7.1) — charts and primitives read
 *  from here, never from hardcoded hex. */
declare module '@mui/material/styles' {
  interface Palette {
    severity: Record<Severity, string>;
  }
  interface PaletteOptions {
    severity?: Record<Severity, string>;
  }
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0e1218',
      paper: '#151b24',
    },
    primary: { main: '#4f8ef7' },
    divider: '#232c38',
    text: {
      primary: '#dbe2ea',
      secondary: '#8b97a5',
    },
    severity: SEVERITY_COLOR,
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h1: { fontSize: '1.5rem', fontWeight: 600 },
    h2: { fontSize: '1.15rem', fontWeight: 600 },
    h3: { fontSize: '1rem', fontWeight: 600 },
    body2: { fontSize: '0.83rem' },
    caption: { color: '#8b97a5' },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Visible keyboard focus everywhere (Phase 6 a11y). ButtonBase resets
        // outline to 0, so it needs its own selector at equal specificity
        // declared here (CssBaseline styles win via insertion order for SVG
        // elements; the class selector wins for MUI components).
        ':focus-visible': {
          outline: '2px solid #4f8ef7',
          outlineOffset: '2px',
        },
        '.MuiButtonBase-root:focus-visible': {
          outline: '2px solid #4f8ef7',
          outlineOffset: '-2px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid #232c38',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: '#0e1218',
          borderBottom: '1px solid #232c38',
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { background: '#232c38', border: '1px solid #33404f', fontSize: '0.75rem' },
      },
    },
  },
});
