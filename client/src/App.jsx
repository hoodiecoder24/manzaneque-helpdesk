import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { NavBar } from './components/NavBar.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { LogCallPage } from './pages/LogCallPage.jsx';
import { ProblemListPage } from './pages/ProblemListPage.jsx';
import { ProblemDetailPage } from './pages/ProblemDetailPage.jsx';
import { KnowledgeLookupPage } from './pages/KnowledgeLookupPage.jsx';
import { ReportsPage } from './pages/ReportsPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';

// Each role lands directly on the screen they work in — no dashboard
// (ARCHITECTURE.md §4.2).
const HOME_BY_ROLE = {
  OPERATOR: '/log-call',
  SPECIALIST: '/problems',
  ANALYST: '/reports',
  ADMIN: '/admin'
};

function Home() {
  const { user } = useAuth();
  return <Navigate to={HOME_BY_ROLE[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavBar />
      <main>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/log-call" element={<ProtectedRoute roles={['OPERATOR', 'ADMIN']}><LogCallPage /></ProtectedRoute>} />
          <Route path="/problems" element={<ProtectedRoute roles={['OPERATOR', 'SPECIALIST', 'ADMIN']}><ProblemListPage /></ProtectedRoute>} />
          <Route path="/problems/:id" element={<ProtectedRoute roles={['OPERATOR', 'SPECIALIST', 'ADMIN']}><ProblemDetailPage /></ProtectedRoute>} />
          <Route path="/knowledge" element={<ProtectedRoute roles={['OPERATOR', 'ADMIN']}><KnowledgeLookupPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute roles={['ANALYST', 'ADMIN']}><ReportsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </AuthProvider>
  );
}
