import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { appRoutes } from './App';
import { ROUTER_BASE, localeBase, localeFromPath } from './router';
import i18n from './i18n';

const locale = localeFromPath(window.location.pathname);
if (!locale) {
  const base = ROUTER_BASE === '/' ? '' : ROUTER_BASE;
  const path = window.location.pathname.slice(base.length) || '/';
  window.location.replace(`${localeBase('it')}${path}${window.location.search}${window.location.hash}`);
} else {
  void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
}
const router = createBrowserRouter(appRoutes, { basename: localeBase(locale ?? 'it') });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
