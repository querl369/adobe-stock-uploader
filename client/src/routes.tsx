import { createBrowserRouter } from 'react-router';
import { Root } from './pages/Root';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { Plans } from './pages/Plans';
import { AccountLayout } from './pages/AccountLayout';
import { AccountProfile } from './pages/AccountProfile';
import { History } from './pages/History';
import { Billing } from './pages/Billing';
import { ErrorPage } from './pages/ErrorPage';
import { ProtectedRoute } from './components/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    ErrorBoundary: ErrorPage,
    children: [
      { index: true, Component: Home },
      { path: 'login', Component: Login },
      { path: 'signup', Component: SignUp },
      { path: 'plans', Component: Plans },
      {
        path: 'account',
        Component: ProtectedRoute,
        children: [
          {
            Component: AccountLayout,
            children: [
              { index: true, Component: AccountProfile },
              { path: 'history', Component: History },
              { path: 'billing', Component: Billing },
            ],
          },
        ],
      },
    ],
  },
]);
