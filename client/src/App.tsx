import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation, type RouteObject } from 'react-router';
import MtgLog from './components/MtgLog';
import ZaffApp from './components/ZaffApp';
import { registroRoutes } from './components/mtglog/RegistroPages';
import { paths } from './router';
import { APP_NAME, ZAFF_NAME } from './appName';

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = pathname.replace(/\/+$/, '') === paths.zaff ? ZAFF_NAME : APP_NAME;
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
