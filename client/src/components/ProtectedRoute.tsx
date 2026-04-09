import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
