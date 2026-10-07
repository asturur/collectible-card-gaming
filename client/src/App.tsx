import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation, type RouteObject } from 'react-router';
import MtgLog from './components/MtgLog';
import ZaffApp from './components/ZaffApp';
import { registroRoutes } from './components/mtglog/RegistroPages';
import { paths } from './router';

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = pathname.replace(/\/+$/, '') === paths.zaff ? 'ZAFF — Collectible Card Gaming' : 'Registro partite di Magic';
  }, [pathname]);
  return <><Outlet /><ScrollRestoration /></>;
}

export const appRoutes: RouteObject[] = [{
  element: <App />,
  children: [
    { path: 'zaff', element: <ZaffApp /> },
    { element: <MtgLog />, children: registroRoutes },
  ],
}];
