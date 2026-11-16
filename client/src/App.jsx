import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import { Button, Logo, Spinner, ToastProvider } from './components/ui.jsx';
import Accounts from './pages/Accounts.jsx';
import Assistant from './pages/Assistant.jsx';
import Client from './pages/Client.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';

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
      <div className="flex h-dvh items-center justify-center bg-[#FAFAFA]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AuthGate() {
  const { loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-dvh items-center justify-center bg-[#FAFAFA]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  return <Home />;
}

/* Custom branded 404 page (landing-page-design B10 ship requirement) */
function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#FAFAFA] px-4 text-center">
      <Logo className="mb-6" />
      <p className="caption-3 font-mono text-[#0070F3]">ERROR 404</p>
      <h1 className="heading-4 mt-2 text-[#171717]">Page not found</h1>
      <p className="body-6 mt-2 max-w-sm text-[#73706D]">
        The workspace route you requested does not exist or has been moved.
      </p>
      <Link to="/" className="mt-6">
        <Button variant="primary">Return to workspace</Button>
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<AuthGate />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/onboarding"
              element={
                <Guard roles={['assistant']}>
                  <Onboarding />
                </Guard>
              }
            />
            <Route
              path="/assistant"
              element={
                <Guard roles={['assistant']}>
                  <Assistant />
                </Guard>
              }
            />
            <Route
              path="/accounts"
              element={
                <Guard roles={['assistant']}>
                  <Accounts />
                </Guard>
              }
            />
            <Route
              path="/client"
              element={
                <Guard roles={['assistant', 'client']}>
                  <Client />
                </Guard>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
