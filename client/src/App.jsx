import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import { ToastProvider, Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Assistant from './pages/Assistant.jsx';
import Client from './pages/Client.jsx';
import Accounts from './pages/Accounts.jsx';

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'client') return <Navigate to="/client" replace />;
  return <Navigate to={user.onboardingCompleted ? '/assistant' : '/onboarding'} replace />;
}

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<AuthGate />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<Guard roles={['assistant']}><Onboarding /></Guard>} />
            <Route path="/assistant" element={<Guard roles={['assistant']}><Assistant /></Guard>} />
            <Route path="/accounts" element={<Guard roles={['assistant']}><Accounts /></Guard>} />
            <Route path="/client" element={<Guard roles={['assistant', 'client']}><Client /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

function AuthGate() {
  const { loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  return <Home />;
}
