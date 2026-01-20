import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ScannerDashboard from './pages/ScannerDashboard';
import StudentCard from './pages/StudentCard';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={user.role === 'ADMIN' ? '/admin' : '/scan'} /> : <Login />}
      />
      <Route
        path="/admin"
        element={
          user?.role === 'ADMIN' ? <AdminDashboard /> : <Navigate to="/login" />
        }
      />
      <Route
        path="/scan"
        element={
          user?.role === 'SCANNER' ? <ScannerDashboard /> : <Navigate to="/login" />
        }
      />
      <Route
        path="/card"
        element={<StudentCard />}
      />
      <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;

