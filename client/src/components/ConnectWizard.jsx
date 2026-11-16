import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Lock, Mail, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { api } from '../api.js';
import { Button, ProviderMark, cx, pctWidthClass } from './ui.jsx';

const PROVIDERS = [
  { id: 'gmail', name: 'Gmail', hint: 'Google Workspace or personal Gmail', consent: 'Google' },
  { id: 'outlook', name: 'Outlook and Microsoft 365', hint: 'Outlook, Exchange, or Microsoft 365', consent: 'Microsoft' },
  { id: 'custom_api', name: 'Custom API or IMAP Bridge', hint: 'Connect any enterprise mailbox via API / IMAP', consent: 'your mail provider' },
];

const SYNC_STEPS = [
  'Connecting to secure mail server',
  'Fetching latest conversations',
  'Running AI ownership triage & extraction',
  'Preparing decision queue & ready drafts',
];

export default function ConnectWizard({ onDone, onCancel, defaultClient = '' }) {
  const [step, setStep] = useState('provider');
  const [provider, setProvider] = useState(null);
  const [mode, setMode] = useState('live'); // 'live' or 'sandbox'
  const [form, setForm] = useState({
    clientName: defaultClient,
    clientEmail: '',
    appPassword: '',
    imapHost: '',
  });
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const p = PROVIDERS.find((x) => x.id === provider);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    if (!form.clientName.trim()) return 'Enter the client or your full name.';
    if (!/^\S+@\S+\.\S+$/.test(form.clientEmail)) return 'Enter a valid mailbox email address.';
    if (mode === 'live' && !form.appPassword.trim()) {
      return provider === 'gmail'
        ? 'Enter your 16-character Google App Password to sync live emails.'
        : 'Enter your mailbox or app password to connect.';
    }
    return '';
  };

  const connect = async () => {
    setStep('syncing');
    setProgress(0);
    setError('');
    const ticker = setInterval(() => setProgress((v) => Math.min(v + 3, 90)), 90);
    try {
      const res = await api.post('/accounts/connect', {
        provider,
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        connectionType: mode === 'live' ? 'imap_live' : 'oauth_simulated',
        appPassword: form.appPassword.trim(),
        imapHost: form.imapHost.trim(),
      });
      clearInterval(ticker);
      setProgress(100);
      setResult(res);
      setTimeout(() => setStep('done'), 400);
    } catch (e) {
      clearInterval(ticker);
      setError(e.message || 'Failed to connect mailbox.');
      setStep('details');
    }
  };

  const stage = Math.min(SYNC_STEPS.length - 1, Math.floor(progress / 26));

  return (
    <div className="animate-fade-up">
      {step === 'provider' && (
        <div>
          <h2 className="heading-5 text-[#171717]">Connect a mailbox</h2>
          <p className="body-6 mt-1 text-[#73706D]">Select your email provider to connect and triage with AI.</p>
          <div className="mt-6 space-y-3">
            {PROVIDERS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  setProvider(x.id);
                  setStep('details');
                }}
                className="card-lift group flex w-full items-center gap-4 rounded-xl border border-[#EBEBEB] bg-white p-4 text-left hover:border-[#0070F3]"
              >
                <ProviderMark provider={x.id} size="lg" />
                <span className="flex-1">
                  <span className="title-4 block text-[#171717]">{x.name}</span>
                  <span className="caption-2 block text-[#73706D]">{x.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-[#73706D] group-hover:text-[#0070F3]" />
              </button>
            ))}
          </div>
          <p className="caption-2 mt-5 flex items-start gap-2 rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] p-3 text-[#4D4D4D]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
            Supports live IMAP / App Password sync for real emails or instant sandbox testing.
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
          <button
            type="button"
            onClick={() => setStep('provider')}
            className="button-xsm mb-3 inline-flex items-center gap-1 text-[#73706D] hover:text-[#171717]"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            <ProviderMark provider={provider} size="lg" />
            <div>
              <h2 className="title-1 text-[#171717]">{p.name}</h2>
              <p className="body-6 text-[#73706D]">Configure how you want to connect this mailbox.</p>
            </div>
          </div>

          {/* Sync Mode Selector */}
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-1.5">
            <button
              type="button"
              onClick={() => {
                setMode('live');
                setError('');
              }}
              className={cx(
                'flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition',
                mode === 'live' ? 'bg-white text-[#171717] shadow-sm' : 'text-[#73706D] hover:text-[#171717]'
              )}
            >
              <Zap className="h-3.5 w-3.5 text-[#0070F3]" /> Live Sync (Real Emails)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('sandbox');
                setError('');
              }}
              className={cx(
                'flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition',
                mode === 'sandbox' ? 'bg-white text-[#171717] shadow-sm' : 'text-[#73706D] hover:text-[#171717]'
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#059669]" /> Sandbox Preview
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="title-4 text-[#171717]">Client / User name</span>
              <input
                value={form.clientName}
                onChange={set('clientName')}
                placeholder="Brook"
                className="body-5 mt-1.5 h-10 w-full rounded-lg border border-[#D4D4D8] bg-white px-3 text-[#171717] outline-none focus:border-[#0070F3] focus:ring-2 focus:ring-[#0070F3]/20"
              />
            </label>
            <label className="block">
              <span className="title-4 text-[#171717]">Mailbox email</span>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#73706D]" />
                <input
                  type="email"
                  value={form.clientEmail}
                  onChange={set('clientEmail')}
                  placeholder="you@gmail.com"
                  className="body-5 h-10 w-full rounded-lg border border-[#D4D4D8] bg-white pl-9 pr-3 text-[#171717] outline-none focus:border-[#0070F3] focus:ring-2 focus:ring-[#0070F3]/20"
                />
              </div>
            </label>

            {mode === 'live' && (
              <div>
                <label className="block">
                  <span className="title-4 flex items-center justify-between text-[#171717]">
                    <span>{provider === 'gmail' ? 'Google App Password' : 'App / IMAP Password'}</span>
                    {provider === 'gmail' && (
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="button-xsm text-[#0070F3] hover:underline"
                      >
                        Get Google App Password &rarr;
                      </a>
                    )}
                  </span>
                  <div className="relative mt-1.5">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#73706D]" />
                    <input
                      type="password"
                      value={form.appPassword}
                      onChange={set('appPassword')}
                      placeholder={provider === 'gmail' ? '16-character code (e.g. abcd efgh ijkl mnop)' : 'Mailbox password'}
                      className="body-5 h-10 w-full rounded-lg border border-[#D4D4D8] bg-white pl-9 pr-3 text-[#171717] outline-none focus:border-[#0070F3] focus:ring-2 focus:ring-[#0070F3]/20"
                    />
                  </div>
                </label>

                {provider === 'gmail' && (
                  <div className="mt-2.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3 text-xs text-[#1E40AF]">
                    <p className="font-semibold">How to get your 16-character Gmail App Password:</p>
                    <ol className="mt-1 list-decimal space-y-1 pl-4 text-[#1E3A8A]">
                      <li>Go to <b>Google Account &gt; Security &gt; 2-Step Verification</b></li>
                      <li>Scroll down to <b>App passwords</b></li>
                      <li>Name it <b>Inboxly</b> and copy the 16-letter code here</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {mode === 'sandbox' && (
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-xs text-[#4B5563]">
                <p className="font-semibold text-[#111827]">Instant Sandbox Mode</p>
                <p className="mt-0.5">
                  Generates realistic executive conversations for this email address so you can test AI routing, audio briefs, and reply drafting without entering a password.
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="body-5 mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[#DC2626]" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" className="mt-6 w-full">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}

      {step === 'consent' && (
        <div>
          <button
            type="button"
            onClick={() => setStep('details')}
            className="button-xsm mb-3 inline-flex items-center gap-1 text-[#73706D] hover:text-[#171717]"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="rounded-2xl border border-[#EBEBEB] bg-[#FAFAFA] p-6">
            <div className="flex items-center gap-3">
              <ProviderMark provider={provider} size="lg" />
              <div>
                <p className="caption-3 uppercase tracking-wider text-[#73706D]">
                  {mode === 'live' ? 'Authorize Live Sync' : 'Sandbox Verification'}
                </p>
                <p className="body-4 font-semibold text-[#171717]">{form.clientEmail}</p>
              </div>
            </div>
            <h3 className="title-3 mt-5 text-[#171717]">Inboxly AI Triage Permissions</h3>
            <ul className="mt-3 space-y-2.5 body-6 text-[#4D4D4D]">
              {[
                mode === 'live' ? 'Fetch real incoming email threads securely via TLS' : 'Seed sample executive thread history for this identity',
                'Analyze urgency, responsibility, and confidence with AI',
                'Prepare executive draft replies (nothing is sent without your approval)',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" /> {t}
                </li>
              ))}
            </ul>
            <p className="caption-4 mt-4 flex items-center gap-1.5 text-[#73706D]">
              <Lock className="h-3.5 w-3.5" /> TLS Encrypted · Credentials encrypted with AES-256-GCM
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setStep('details')}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={connect}>
                {mode === 'live' ? 'Sync Real Emails' : 'Open Sandbox Inbox'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'syncing' && (
        <div className="py-6 text-center" aria-live="polite">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EBF5FF] text-[#0070F3]">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <h3 className="title-2 text-[#171717]">{SYNC_STEPS[stage]}</h3>
          <p className="body-6 mt-1 text-[#73706D]">{form.clientEmail}</p>
          <div className="mx-auto mt-6 h-2 max-w-xs overflow-hidden rounded-full bg-[#EBEBEB]">
            <div className={cx('motion-layout h-full rounded-full bg-[#0070F3]', pctWidthClass(progress))} />
          </div>
          <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left caption-2">
            {SYNC_STEPS.map((s, i) => (
              <li key={s} className={cx('flex items-center gap-2', i <= stage ? 'text-[#171717]' : 'text-[#73706D]')}>
                <CheckCircle2 className={cx('h-4 w-4', i < stage ? 'text-[#059669]' : i === stage ? 'text-[#0070F3]' : 'text-[#D4D4D8]')} />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'done' && result && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="heading-5 text-[#171717]">
            {result.isLive ? 'Live Mailbox Connected!' : 'Mailbox Connected'}
          </h3>
          <p className="body-6 mt-1 text-[#4D4D4D]">
            Imported <b>{result.imported} conversation{result.imported === 1 ? '' : 's'}</b> from <b>{result.account.clientEmail}</b> and classified reply ownership.
          </p>
          <Button variant="primary" size="lg" className="mt-6 w-full" onClick={() => onDone?.(result.account)}>
            Open assistant inbox <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
