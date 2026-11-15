import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../api.js';
import { Button, ProviderMark, cx, pctWidthClass } from './ui.jsx';

const PROVIDERS = [
  { id: 'gmail', name: 'Gmail', hint: 'Google Workspace or personal Gmail', consent: 'Google' },
  { id: 'outlook', name: 'Outlook / Microsoft 365', hint: 'Outlook.com, Exchange, Microsoft 365', consent: 'Microsoft' },
  { id: 'custom_api', name: 'Other (API key / IMAP bridge)', hint: 'Any mailbox via API key', consent: 'your mail provider' },
];

const SYNC_STEPS = ['Authorizing access', 'Fetching recent conversations', 'AI is reading every thread', 'Deciding who needs to reply'];

/**
 * Simulated email connection flow: choose provider -> details -> consent screen -> live sync progress.
 * Calls the real /accounts/connect endpoint, which imports a realistic sample inbox.
 */
export default function ConnectWizard({ onDone, onCancel, defaultClient = '' }) {
  const [step, setStep] = useState('provider'); // provider | details | consent | syncing | done
  const [provider, setProvider] = useState(null);
  const [form, setForm] = useState({ clientName: defaultClient, clientEmail: '', apiKey: '' });
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const p = PROVIDERS.find((x) => x.id === provider);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    if (!form.clientName.trim()) return 'Whose inbox is this? Enter the client’s name.';
    if (!/^\S+@\S+\.\S+$/.test(form.clientEmail)) return 'Enter a valid email address.';
    if (provider === 'custom_api' && form.apiKey.trim().length < 8) return 'Paste the API key (at least 8 characters).';
    return '';
  };

  const connect = async () => {
    setStep('syncing');
    setProgress(0);
    setError('');
    const ticker = setInterval(() => setProgress((v) => Math.min(v + 2, 92)), 70);
    try {
      const [res] = await Promise.all([
        api.post('/accounts/connect', { provider, clientName: form.clientName, clientEmail: form.clientEmail, connectionType: provider === 'custom_api' ? 'api_key_bridge' : 'oauth_simulated' }),
        new Promise((r) => setTimeout(r, 3200)),
      ]);
      clearInterval(ticker);
      setProgress(100);
      setResult(res);
      setTimeout(() => setStep('done'), 350);
    } catch (e) {
      clearInterval(ticker);
      setError(e.message);
      setStep('details');
    }
  };

  const stage = Math.min(SYNC_STEPS.length - 1, Math.floor(progress / 26));

  return (
    <div className="animate-fade-up">
      {step === 'provider' && (
        <div>
          <h2 className="font-display text-2xl font-extrabold text-slate-900">Connect a client’s inbox</h2>
          <p className="mt-1 text-sm text-slate-500">Choose where their email lives. You can add more mailboxes any time.</p>
          <div className="mt-6 space-y-3">
            {PROVIDERS.map((x) => (
              <button
                key={x.id}
                onClick={() => {
                  setProvider(x.id);
                  setStep('details');
                }}
                className="group flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100"
              >
                <ProviderMark provider={x.id} size="lg" />
                <span className="flex-1">
                  <span className="block text-sm font-bold text-slate-900">{x.name}</span>
                  <span className="block text-xs text-slate-500">{x.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
              </button>
            ))}
          </div>
          <p className="mt-5 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            Prototype note: connections are simulated — a realistic sample inbox is imported so you can explore every flow safely.
          </p>
          {onCancel && (
            <Button variant="ghost" className="mt-4" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      )}

      {step === 'details' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = validate();
            setError(v);
            if (!v) setStep('consent');
          }}
        >
          <button type="button" onClick={() => setStep('provider')} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            <ProviderMark provider={provider} size="lg" />
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900">{p.name}</h2>
              <p className="text-sm text-slate-500">Tell us whose mailbox this is.</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Client name</span>
              <input value={form.clientName} onChange={set('clientName')} placeholder="e.g. Arjun Mehta" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Mailbox email</span>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="email" value={form.clientEmail} onChange={set('clientEmail')} placeholder="client@company.com" className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
              </div>
            </label>
            {provider === 'custom_api' && (
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">API key</span>
                <div className="relative mt-1.5">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="password" value={form.apiKey} onChange={set('apiKey')} placeholder="Paste key (never stored in this demo)" className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
                </div>
              </label>
            )}
          </div>
          {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="mt-6 w-full">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}

      {step === 'consent' && (
        <div>
          <button type="button" onClick={() => setStep('details')} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <ProviderMark provider={provider} size="lg" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sign in with {p.consent}</p>
                <p className="text-sm font-bold text-slate-900">{form.clientEmail}</p>
              </div>
            </div>
            <h3 className="mt-5 text-base font-bold text-slate-900">Inboxly wants to access this mailbox</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
              {['Read emails and conversation history', 'Prepare reply drafts (nothing is sent without approval)', 'Label and organise conversations'].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5" /> Simulated consent screen for the prototype.
            </p>
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setStep('details')}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={connect}>
                Allow access
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'syncing' && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
            <Sparkles className="h-8 w-8 animate-pulse text-indigo-600" />
          </div>
          <h2 className="font-display text-xl font-extrabold text-slate-900">Syncing {form.clientName.split(' ')[0]}’s inbox</h2>
          <p className="mt-1 text-sm text-slate-500">{SYNC_STEPS[stage]}…</p>
          <div className="mx-auto mt-6 h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
            <div className={cx('h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-150', pctWidthClass(progress))} />
          </div>
          <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
            {SYNC_STEPS.map((s, i) => (
              <li key={s} className={cx('flex items-center gap-2 transition', i <= stage ? 'text-slate-800' : 'text-slate-300')}>
                <CheckCircle2 className={cx('h-4 w-4', i < stage || progress === 100 ? 'text-emerald-500' : i === stage ? 'text-indigo-500' : 'text-slate-200')} />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'done' && result && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>
          <h2 className="font-display text-2xl font-extrabold text-slate-900">Connected & synced</h2>
          <p className="mt-1 text-sm text-slate-500">
            {result.imported} conversations imported from <b>{form.clientEmail}</b> and sorted by AI.
          </p>
          <Button variant="primary" size="lg" className="mt-6" onClick={() => onDone(result.account)}>
            Open inbox <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function useBodyLock(active) {
  useEffect(() => undefined, [active]);
}
