import { lazy, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout.tsx';

const RELOAD_KEY = 'vuln-dashboard:chunk-reload';

/**
 * `lazy()` plus recovery from the classic stale-tab failure: a deploy replaces
 * content-hashed chunks while someone has the app open, so their old
 * index.html asks for a filename that no longer exists and the route dies with
 * "Failed to fetch dynamically imported module".
 *
 * A missing chunk is not a code error — it means the page is out of date — so
 * reload once to pick up the fresh index.html. The session flag ensures a
 * genuine failure (offline, broken build) surfaces instead of looping.
 */
function lazyRoute(load: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    try {
      const mod = await load();
      flag.clear();
      return mod;
    } catch (err) {
      if (!flag.isSet()) {
        flag.set();
        window.location.reload();
        return await new Promise<never>(() => { /* reload takes over */ });
      }
      throw err;   // second failure is real — let the error boundary show it
    }
  });
}

/** Storage can throw (private mode, blocked cookies). A recovery mechanism
 *  that crashes is worse than no recovery, so every access is guarded. */
const flag = {
  isSet: (): boolean => {
    try { return sessionStorage.getItem(RELOAD_KEY) !== null; } catch { return true; }
  },
  set: (): void => {
    try { sessionStorage.setItem(RELOAD_KEY, '1'); } catch { /* ignore */ }
  },
  clear: (): void => {
    try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ }
  },
};

// Route-level code splitting (email spec: lazy loading). The Overview stays
// eager — it's the landing route and would lazy-load immediately anyway; every
// other page ships as its own chunk fetched on first navigation. DataGrid
// (the heaviest dependency) leaves the initial bundle with the Explorer.
import OverviewPage from './pages/OverviewPage.tsx';
const ExplorerPage = lazyRoute(() => import('./pages/ExplorerPage.tsx'));
const GroupPage = lazyRoute(() => import('./pages/GroupPage.tsx'));
const RepoPage = lazyRoute(() => import('./pages/RepoPage.tsx'));
const ImageDetailPage = lazyRoute(() => import('./pages/ImageDetailPage.tsx'));
const CveDetailPage = lazyRoute(() => import('./pages/CveDetailPage.tsx'));
const ComparePage = lazyRoute(() => import('./pages/ComparePage.tsx'));
const NotFoundPage = lazyRoute(() => import('./pages/NotFoundPage.tsx'));

/** Data-router API (§ stack requirement). Mounted only after ingestion. */
export const router = createBrowserRouter([
  {
    element: <DashboardLayout />,
    children: [
      { path: '/', element: <OverviewPage /> },
      { path: '/explorer', element: <ExplorerPage /> },
      { path: '/groups/:groupId', element: <GroupPage /> },
      { path: '/groups/:groupId/repos/:repoId', element: <RepoPage /> },
      { path: '/images/:imageId', element: <ImageDetailPage /> },
      { path: '/cve/:cveId', element: <CveDetailPage /> },
      { path: '/compare', element: <ComparePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
], {
  // Opt in to v7 behaviors — silences upgrade warnings, keeps console clean.
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});
