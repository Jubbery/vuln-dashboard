import { StrictMode, useMemo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { store, useAppSelector } from './store/index.ts';
import { buildTheme } from './theme/theme.ts';
import { DatasetProvider } from './data/DatasetProvider.tsx';
import App from './App.tsx';

/** Theme follows the persisted preference (dark console default; light
 *  "enterprise" variant available from the header toggle). */
function ThemedRoot({ children }: { children: ReactNode }): ReactNode {
  const mode = useAppSelector((s) => s.ui.themeMode);
  const theme = useMemo(() => buildTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

const rootEl = document.getElementById('root');
if (rootEl === null) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <Provider store={store}>
      <ThemedRoot>
        <DatasetProvider>
          <App />
        </DatasetProvider>
      </ThemedRoot>
    </Provider>
  </StrictMode>,
);
