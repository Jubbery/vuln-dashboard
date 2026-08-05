import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { store } from './store/index.ts';
import { theme } from './theme/theme.ts';
import { DatasetProvider } from './data/DatasetProvider.tsx';
import App from './App.tsx';

const rootEl = document.getElementById('root');
if (rootEl === null) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <DatasetProvider>
          <App />
        </DatasetProvider>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
);
