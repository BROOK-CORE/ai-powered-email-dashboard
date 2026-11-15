import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BrainCircuit, Eye, Inbox, Sparkles } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import ConnectWizard from '../components/ConnectWizard.jsx';
import { Button, Logo, cx } from '../components/ui.jsx';

const INTRO = [
  { icon: Inbox, title: 'One calm place for every client inbox', text: 'Connect Gmail and Outlook mailboxes and see their status at a glance.' },
  { icon: BrainCircuit, title: 'AI decides who needs to reply', text: 'Every thread is sorted: assistant, client, or no reply — with the reason shown.' },
  { icon: Eye, title: 'Clients only see what needs them', text: 'A minimal view with a 1-line summary, a draft ready to approve, and one-tap actions.' },
];

export default function Onboarding() {
  const { user, completeOnboarding } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0); // 0 intro, 1 connect

  const finish = async () => {
    await completeOnboarding();
    nav('/assistant', { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-indigo-50/70 to-white">
      <header className="flex items-center justify-between px-5 py-4 sm:px-10">
        <Logo />
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          {['Welcome', 'Connect inbox'].map((s, i) => (
            <span key={s} className={cx('flex items-center gap-1.5', i === step ? 'text-indigo-600' : '')}>
              <span className={cx('flex h-5 w-5 items-center justify-center rounded-full text-[10px]', i <= step ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500')}>{i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
              {i === 0 && <span className="mx-1 h-px w-6 bg-slate-300" />}
            </span>
          ))}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-12">
        <div className="w-full max-w-xl">
          {step === 0 ? (
            <div className="animate-fade-up text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
                <Sparkles className="h-7 w-7" />
              </div>
              <h1 className="font-display text-3xl font-extrabold text-slate-900 sm:text-4xl">Welcome, {user?.name?.split(' ')[0]}</h1>
              <p className="mx-auto mt-3 max-w-md text-slate-500">Let’s get your first client’s inbox connected. It takes about a minute.</p>
              <ul className="mt-8 space-y-3 text-left">
                {INTRO.map(({ icon: I, title, text }) => (
                  <li key={title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <I className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-slate-900">{title}</span>
                      <span className="block text-sm text-slate-500">{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <Button variant="primary" size="lg" className="mt-8 w-full sm:w-auto" onClick={() => setStep(1)}>
                Connect an inbox <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
              <ConnectWizard onDone={finish} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
