import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store/index.ts';
import { DatasetProvider } from './data/DatasetProvider.tsx';
import App from './App.tsx';

const rootEl = document.getElementById('root');
if (rootEl === null) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <Provider store={store}>
      <DatasetProvider>
        <App />
      </DatasetProvider>
    </Provider>
  </StrictMode>,
);
