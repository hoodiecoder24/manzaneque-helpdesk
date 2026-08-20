import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Gates a route by authentication and, optionally, role. Mirrors the
// server's RBAC (server/src/middleware/rbac.js) — this is UX only, the
// API is the real enforcement point.
export function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="loading">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
