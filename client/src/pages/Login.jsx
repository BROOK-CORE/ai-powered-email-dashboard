import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, BrainCircuit, CheckCheck, Eye, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Button, Logo, RespBadge } from '../components/ui.jsx';

function Field({ label, ...rest }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input {...rest} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
    </label>
  );
}

export default function Login() {
  const { user, demo, login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (user) return <Navigate to="/" replace />;

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      nav('/', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (mode === 'register' && !f.name.trim()) return setError('Enter your name.');
    if (!f.email || !f.password) return setError('Enter your email and password.');
    run('form', () => (mode === 'login' ? login(f.email, f.password) : register(f.name, f.email, f.password)));
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <span className="font-display text-xl font-extrabold">Inboxly</span>
        </div>
        <div className="relative max-w-lg">
          <h1 className="font-display text-4xl font-extrabold leading-tight xl:text-5xl">Know who replies — before you open a single email.</h1>
          <p className="mt-5 text-lg text-indigo-100">
            AI sorts every conversation into <b>assistant</b>, <b>client</b> or <b>no reply needed</b>. Your client only sees what truly needs them — one calm screen, one tap.
          </p>
          <div className="mt-8 space-y-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
            {[
              ['Series A — revised term sheet', 'client_to_reply'],
              ['Board dinner — can we reschedule?', 'assistant_to_reply'],
              ['Stripe payout is on its way', 'no_reply_needed'],
            ].map(([s, r]) => (
              <div key={s} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-slate-800 shadow-sm">
                <span className="truncate text-sm font-semibold">{s}</span>
                <RespBadge value={r} compact />
              </div>
            ))}
          </div>
        </div>
        <ul className="relative grid max-w-lg grid-cols-3 gap-4 text-sm text-indigo-100">
          {[
            [BrainCircuit, 'Auto triage'],
            [Eye, 'Client view'],
            [ShieldCheck, 'You approve every send'],
          ].map(([I, t]) => (
            <li key={t} className="flex items-center gap-2">
              <I className="h-4 w-4 shrink-0 text-amber-300" /> {t}
            </li>
          ))}
        </ul>
      </section>

      {/* Form panel */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md animate-fade-up">
          <Logo className="mb-8 lg:hidden" />
          <h2 className="font-display text-3xl font-extrabold text-slate-900">{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h2>
          <p className="mt-1.5 text-sm text-slate-500">{mode === 'login' ? 'Sign in to manage your clients’ inboxes.' : 'Start as a personal assistant in under a minute.'}</p>

          {/* Fast path for reviewers */}
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button variant="primary" size="lg" loading={busy === 'assistant'} onClick={() => run('assistant', () => demo('assistant'))} icon={Zap}>
              Demo as Assistant
            </Button>
            <Button variant="amber" size="lg" loading={busy === 'client'} onClick={() => run('client', () => demo('client'))} icon={CheckCheck}>
              Demo as Client
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">One click, pre-loaded with a realistic inbox. No sign-up needed.</p>

          <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or with email <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === 'register' && <Field label="Your name" value={f.name} onChange={set('name')} autoComplete="name" placeholder="Maya Lin" />}
            <Field label="Email" type="email" value={f.email} onChange={set('email')} autoComplete="email" placeholder="you@company.com" />
            <Field label="Password" type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 6 characters" />
            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
            <Button type="submit" variant="secondary" size="lg" loading={busy === 'form'} className="w-full">
              {mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">
            {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="font-semibold text-indigo-600 hover:underline"
            >
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
