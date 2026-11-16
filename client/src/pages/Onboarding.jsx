import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BrainCircuit, Eye, Inbox, Sparkles } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import ConnectWizard from '../components/ConnectWizard.jsx';
import { Button, Logo, cx } from '../components/ui.jsx';

const INTRO = [
  {
    icon: Inbox,
    title: 'One calm workspace for every client inbox',
    text: 'Connect Google Workspace and Microsoft Outlook mailboxes and monitor sync health in one view.',
  },
  {
    icon: BrainCircuit,
    title: 'AI decides who needs to reply',
    text: 'Every conversation is sorted into Assistant to reply, Client to reply, or No reply needed with a clear reason.',
  },
  {
    icon: Eye,
    title: 'Clients only see what truly needs them',
    text: 'Leaders open a calm decision queue with a 1 line takeaway, a ready draft, and one tap actions.',
  },
];

export default function Onboarding() {
  const { user, completeOnboarding } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);

  const finish = async () => {
    await completeOnboarding();
    nav('/assistant', { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#FAFAFA]">
      <header className="flex items-center justify-between border-b border-[#EBEBEB] bg-white px-6 py-4">
        <Logo />
        <div className="flex items-center gap-2 caption-3 text-[#73706D]">
          {['Welcome', 'Connect inbox'].map((s, i) => (
            <span key={s} className={cx('flex items-center gap-2', i === step ? 'text-[#171717]' : '')}>
              <span
                className={cx(
                  'caption-3 font-mono flex h-6 w-6 items-center justify-center rounded-full border',
                  i <= step ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#D4D4D8] bg-white text-[#73706D]'
                )}
              >
                {i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
              {i === 0 && <span className="mx-1 h-px w-6 bg-[#D4D4D8]" />}
            </span>
          ))}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          {step === 0 ? (
            <div className="animate-fade-up rounded-2xl border border-[#EBEBEB] bg-white p-8 text-center">
              <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EBF5FF] text-[#0070F3]">
                <Sparkles className="h-6 w-6" />
              </div>
              <h1 className="heading-4 text-[#171717]">Welcome, {user?.name?.split(' ')[0]}</h1>
              <p className="body-3 mx-auto mt-2 max-w-md text-[#4D4D4D]">
                Connect your first executive mailbox so AI can sort incoming threads and draft replies.
              </p>
              <ul className="mt-8 space-y-3 text-left">
                {INTRO.map(({ icon: I, title, text }) => (
                  <li key={title} className="flex gap-4 rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#EBEBEB] bg-white text-[#0070F3]">
                      <I className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="title-4 block text-[#171717]">{title}</span>
                      <span className="body-6 mt-0.5 block text-[#4D4D4D]">{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <Button variant="primary" size="lg" className="mt-8 w-full sm:w-auto" onClick={() => setStep(1)}>
                Connect an inbox <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#EBEBEB] bg-white p-6 sm:p-8">
              <ConnectWizard onDone={finish} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
