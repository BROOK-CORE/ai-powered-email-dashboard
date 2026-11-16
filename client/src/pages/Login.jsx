import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, Lock, Menu, ShieldCheck, Sparkles, UserCheck, X, Zap } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Button, Logo, Modal, ProviderMark, RespBadge, cx } from '../components/ui.jsx';

const TAGLINE_WORDS =
  'Assistants clear routine scheduling and billing threads in seconds while executives only see the high stakes decisions that require their personal judgment.'.split(
    ' '
  );

const PREVIEW_THREADS = [
  {
    sender: 'Elena Rostova',
    org: 'Benchmark Capital',
    provider: 'gmail',
    secondaryProvider: 'outlook',
    subject: 'Series A revised term sheet and board seat allocation',
    takeaway: 'Needs executive approval on the 20M valuation cap before Friday.',
    responsibility: 'client_to_reply',
    confidence: 96,
  },
  {
    sender: 'David Chen',
    org: 'Board Operations',
    provider: 'outlook',
    secondaryProvider: 'gmail',
    subject: 'Q3 board dinner venue confirmation and dietary list',
    takeaway: 'Routine scheduling request that your assistant can confirm directly.',
    responsibility: 'assistant_to_reply',
    confidence: 92,
  },
  {
    sender: 'Stripe Treasury',
    org: 'Automated Settlement',
    provider: 'gmail',
    secondaryProvider: null,
    subject: 'Monthly payout receipt for Lumen Labs operating account',
    takeaway: 'Informational settlement notice stored for records with zero reply required.',
    responsibility: 'no_reply_needed',
    confidence: 98,
  },
];

const BENEFITS = [
  {
    metric: '74% fewer interrupts',
    title: 'Clear ownership on every thread',
    detail:
      'Every incoming conversation is classified into Assistant to reply, Client to reply, or No reply needed with a plain language explanation.',
  },
  {
    metric: 'Under 30 seconds',
    title: 'Executive decision cards with voice brief',
    detail:
      'Clients never face a cluttered inbox. They open one calm queue with a spoken summary, a ready draft, and one tap approval chips.',
  },
  {
    metric: '75% confidence gate',
    title: 'Human review when signals conflict',
    detail:
      'Whenever an email blends administrative logistics with a personal decision, Inboxly flags it for assistant review before surfacing it to the client.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Connect client mailboxes',
    detail: 'Link Google Workspace, Microsoft Outlook, or an API bridge in under a minute and import active conversations.',
  },
  {
    step: '02',
    title: 'Review AI ownership and drafts',
    detail: 'Inspect confidence scores, extracted meeting dates, and tailored reply drafts written in your executive voice.',
  },
  {
    step: '03',
    title: 'Stage decisions for one tap sign off',
    detail: 'Executives approve drafts, tap quick response chips, dictate short instructions by voice, or hand threads back to you.',
  },
];

const FAQS = [
  {
    q: 'How does Inboxly decide whether the assistant or the client should reply?',
    a: 'The triage engine evaluates sender context, financial or legal stakes, scheduling signals, and conversation history. Routine calendar, billing, and vendor threads route to the assistant, while investor, legal, and personal sign offs route to the client.',
  },
  {
    q: 'What happens when the AI is uncertain about who owns a conversation?',
    a: 'Any thread scoring below the 75 percent confidence threshold is automatically placed in the Needs review segment so the assistant can assign ownership with one click.',
  },
  {
    q: 'Does Inboxly ever send an email without human approval?',
    a: 'Never. Drafts are prepared automatically, but every outbound reply requires explicit approval from either the assistant or the client, complete with a 5 second undo window.',
  },
  {
    q: 'What does the executive client actually see when they sign in?',
    a: 'Clients only see open conversations assigned to Client to reply. Administrative threads, newsletters, and archived items remain hidden from their portal.',
  },
  {
    q: 'Can the client hand an email back to the assistant?',
    a: 'Yes. Every executive decision card includes a handover action with an optional note that immediately moves the thread back to the assistant queue and triggers a notification.',
  },
  {
    q: 'Can we test the full workflow right now without connecting a live mailbox?',
    a: 'Yes. Use the Demo as Assistant or Demo as Client buttons at the top of this page, or create a free workspace and use the built in email simulator.',
  },
];

function Field({ label, id, ...rest }) {
  return (
    <label htmlFor={id} className="block">
      <span className="title-4 text-[#171717]">{label}</span>
      <input
        id={id}
        {...rest}
        className="motion-transition body-5 mt-1.5 h-10 w-full rounded-lg border border-[#D4D4D8] bg-white px-3 text-[#171717] outline-none placeholder:text-[#73706D] focus:border-[#0070F3] focus:ring-2 focus:ring-[#0070F3]/20"
      />
    </label>
  );
}

function TaglineReveal() {
  const containerRef = useRef(null);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setActiveCount(TAGLINE_WORDS.length);
      return undefined;
    }

    let timer = null;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          let i = 0;
          timer = setInterval(() => {
            i += 1;
            setActiveCount(i);
            if (i >= TAGLINE_WORDS.length) clearInterval(timer);
          }, 35);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <section
      id="triage"
      ref={containerRef}
      aria-label="Core benefit statement"
      className="border-y border-[#EBEBEB] bg-white px-6 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <p className="caption-3 uppercase tracking-wider text-[#0070F3]">Built for high trust delegation</p>
        <h2 className="heading-3 sm:heading-2 mt-4 max-w-[680px] text-balance">
          {TAGLINE_WORDS.map((word, idx) => (
            <span
              key={`${word}-${idx}`}
              className={cx(
                'motion-layout inline-block mr-2.5',
                idx < activeCount ? 'text-[#171717] opacity-100' : 'text-[#171717] opacity-25'
              )}
            >
              {word}
            </span>
          ))}
        </h2>
      </div>
    </section>
  );
}

function ArchitectureDiagram() {
  return (
    <div
      data-diagram="hub-lanes"
      className="rounded-2xl border border-[#EBEBEB] bg-[#FAFAFA] p-6"
      aria-label="Inboxly AI triage routing diagram"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="title-4 text-[#171717]">Live triage routing pipeline</span>
        <span className="caption-4 font-mono text-[#73706D]">LATENCY &lt; 180MS</span>
      </div>
      <svg viewBox="0 0 680 220" className="w-full h-auto" role="img" aria-label="Mailboxes connect into AI triage engine and branch into three queues">
        {/* Input hub */}
        <rect x="16" y="44" width="148" height="56" rx="10" fill="#FFFFFF" stroke="#D4D4D8" />
        <text x="34" y="69" fill="#171717" fontSize="13" fontWeight="600">Gmail Workspace</text>
        <text x="34" y="87" fill="#73706D" fontSize="11">Inbound stream</text>

        <rect x="16" y="120" width="148" height="56" rx="10" fill="#FFFFFF" stroke="#D4D4D8" />
        <text x="34" y="145" fill="#171717" fontSize="13" fontWeight="600">Microsoft Outlook</text>
        <text x="34" y="163" fill="#73706D" fontSize="11">Executive mailbox</text>

        {/* Connector lines to central processor */}
        <path d="M164 72 C205 72, 205 110, 246 110" fill="none" stroke="#D4D4D8" strokeWidth="2" />
        <path d="M164 148 C205 148, 205 110, 246 110" fill="none" stroke="#D4D4D8" strokeWidth="2" />
        <path d="M164 72 C205 72, 205 110, 246 110" fill="none" stroke="#0070F3" strokeWidth="2.5" className="animate-diagram-pulse" />

        {/* Central processor */}
        <rect x="246" y="68" width="168" height="84" rx="14" fill="#171717" />
        <text x="270" y="102" fill="#FFFFFF" fontSize="13" fontWeight="600">AI Triage Engine</text>
        <text x="270" y="122" fill="#A1A1AA" fontSize="11">Ownership + Confidence</text>
        <text x="270" y="138" fill="#10B981" fontSize="10" fontFamily="monospace">THRESHOLD &gt;= 75%</text>

        {/* Three output lanes */}
        <path d="M414 92 C452 92, 452 42, 492 42" fill="none" stroke="#BFDBFE" strokeWidth="2" />
        <path d="M414 110 L492 110" fill="none" stroke="#FDE68A" strokeWidth="2" />
        <path d="M414 128 C452 128, 452 178, 492 178" fill="none" stroke="#E4E4E7" strokeWidth="2" />
        <path d="M414 110 L492 110" fill="none" stroke="#D97706" strokeWidth="2.5" className="animate-diagram-pulse" />

        <rect x="492" y="16" width="172" height="52" rx="10" fill="#EBF5FF" stroke="#BFDBFE" />
        <circle cx="510" cy="42" r="4" fill="#0070F3" />
        <text x="522" y="39" fill="#0070F3" fontSize="12" fontWeight="600">Assistant to reply</text>
        <text x="522" y="55" fill="#4D4D4D" fontSize="10">Scheduling &amp; operations</text>

        <rect x="492" y="84" width="172" height="52" rx="10" fill="#FEF3C7" stroke="#FDE68A" />
        <circle cx="510" cy="110" r="4" fill="#D97706" />
        <text x="522" y="107" fill="#B45309" fontSize="12" fontWeight="600">Client to reply</text>
        <text x="522" y="123" fill="#4D4D4D" fontSize="10">1 tap executive queue</text>

        <rect x="492" y="152" width="172" height="52" rx="10" fill="#F4F4F5" stroke="#E4E4E7" />
        <circle cx="510" cy="178" r="4" fill="#71717A" />
        <text x="522" y="175" fill="#52525B" fontSize="12" fontWeight="600">No reply needed</text>
        <text x="522" y="191" fill="#73706D" fontSize="10">Newsletters &amp; receipts</text>
      </svg>
    </div>
  );
}

export default function Login() {
  const { user, demo, login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [legalModal, setLegalModal] = useState(null);
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
    if (mode === 'register' && !f.name.trim()) return setError('Enter your full name to create a workspace.');
    if (!f.email || !f.password) return setError('Enter your email address and password.');
    return run('form', () => (mode === 'login' ? login(f.email, f.password) : register(f.name, f.email, f.password)));
  };

  return (
    <div className="min-h-dvh bg-white text-[#171717]">
      {/* Skip link for keyboard accessibility (landing-page-design B10) */}
      <a
        href="#main-content"
        className="button-sm sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#171717] focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      {/* Floating compact translucent navigation bar (landing-page-design B7) */}
      <header className="sticky top-4 z-40 mx-auto max-w-6xl px-4 sm:px-6">
        <nav
          aria-label="Primary navigation"
          className="flex items-center justify-between rounded-2xl border border-[#EBEBEB] bg-white/85 px-4 py-2.5 shadow-sm backdrop-blur-md"
        >
          <Logo />
          <div className="hidden items-center gap-6 md:flex">
            <a href="#triage" className="title-4 motion-transition text-[#4D4D4D] hover:text-[#171717]">
              Triage
            </a>
            <a href="#architecture" className="title-4 motion-transition text-[#4D4D4D] hover:text-[#171717]">
              Architecture
            </a>
            <a href="#how" className="title-4 motion-transition text-[#4D4D4D] hover:text-[#171717]">
              How it works
            </a>
            <a href="#faq" className="title-4 motion-transition text-[#4D4D4D] hover:text-[#171717]">
              FAQ
            </a>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="secondary" size="sm" loading={busy === 'client'} onClick={() => run('client', () => demo('client'))}>
              Demo as Client
            </Button>
            <Button variant="primary" size="sm" loading={busy === 'assistant'} onClick={() => run('assistant', () => demo('assistant'))}>
              Open workspace
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenu((v) => !v)}
            aria-label={mobileMenu ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenu}
            className="motion-transition rounded-lg p-2 text-[#171717] hover:bg-[#F4F4F5] md:hidden"
          >
            {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {/* Full-height mobile menu panel (landing-page-design B7) */}
        {mobileMenu && (
          <div className="animate-fade-up fixed inset-0 top-20 z-50 flex flex-col justify-between bg-white/95 p-6 backdrop-blur-lg md:hidden">
            <div className="flex flex-col gap-4">
              {[
                ['#triage', 'Triage'],
                ['#architecture', 'Architecture'],
                ['#how', 'How it works'],
                ['#faq', 'FAQ'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenu(false)}
                  className="heading-5 border-b border-[#EBEBEB] pb-3 text-[#171717]"
                >
                  {label}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <Button variant="primary" size="lg" className="w-full" onClick={() => { setMobileMenu(false); run('assistant', () => demo('assistant')); }}>
                Demo as Assistant
              </Button>
              <Button variant="secondary" size="lg" className="w-full" onClick={() => { setMobileMenu(false); run('client', () => demo('client')); }}>
                Demo as Client
              </Button>
            </div>
          </div>
        )}
      </header>

      <main id="main-content">
        {/* Hero section (Screen 1 — asymmetric split hero matching generated reference) */}
        <section data-enter="true" className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16">
          <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            {/* Left column: Hero headline, demo actions, and workspace login */}
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-[#FAFAFA] px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-[#059669]" />
                <span className="caption-3 text-[#4D4D4D]">Executive email delegation system</span>
              </div>

              <h1 className="heading-2 sm:heading-1 hero-heading-gradient mt-6 max-w-[680px]">
                Every executive email
                <br />
                sorted before you
                <br />
                open the inbox
              </h1>

              <p className="body-2 mt-6 max-w-[680px] text-[#4D4D4D]">
                Autonomous AI triage and delegation for personal assistants and leadership teams. Connect Gmail and Outlook to route every conversation to assistant, client, or archive with a ready reply draft.
              </p>

              {/* Instant Reviewer Sandbox Entry */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  loading={busy === 'assistant'}
                  icon={Zap}
                  onClick={() => run('assistant', () => demo('assistant'))}
                >
                  Demo as Assistant
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  loading={busy === 'client'}
                  icon={Eye}
                  onClick={() => run('client', () => demo('client'))}
                >
                  Demo as Client
                </Button>
              </div>

              <p className="caption-2 mt-3 flex items-center gap-2 text-[#73706D]">
                <ShieldCheck className="h-4 w-4 text-[#059669]" />
                Instant sandbox workspace with connected mailboxes. No credit card required.
              </p>

              {/* Workspace Email Sign-In / Registration Card (Nested radius: outer rounded-2xl 16px, inner rounded-lg 8px) */}
              <div id="workspace" className="mt-8 max-w-md rounded-2xl border border-[#EBEBEB] bg-[#FAFAFA] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="title-3 text-[#171717]">
                    {mode === 'login' ? 'Sign in to your workspace' : 'Create an assistant workspace'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === 'login' ? 'register' : 'login');
                      setError('');
                    }}
                    className="button-xsm text-[#0070F3] hover:underline"
                  >
                    {mode === 'login' ? 'Create account' : 'Sign in instead'}
                  </button>
                </div>

                <form onSubmit={submit} className="space-y-3" noValidate>
                  {mode === 'register' && (
                    <Field
                      id="auth-name"
                      label="Full name"
                      value={f.name}
                      onChange={set('name')}
                      autoComplete="name"
                      placeholder="Maya Lin"
                    />
                  )}
                  <Field
                    id="auth-email"
                    label="Work email"
                    type="email"
                    value={f.email}
                    onChange={set('email')}
                    autoComplete="email"
                    placeholder="maya@company.com"
                  />
                  <Field
                    id="auth-password"
                    label="Password"
                    type="password"
                    value={f.password}
                    onChange={set('password')}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="At least 8 characters"
                  />
                  {error && (
                    <p role="alert" className="body-5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[#DC2626]">
                      {error}
                    </p>
                  )}
                  <Button type="submit" variant="cobalt" size="md" loading={busy === 'form'} className="w-full">
                    {mode === 'login' ? 'Sign in with email' : 'Create workspace'} <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>

            {/* Right column: Live App-Frame Triage Preview (matching generated reference image 1) */}
            <div className="animate-fade-up rounded-2xl border border-[#EBEBEB] bg-[#FAFAFA] p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between border-b border-[#EBEBEB] pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#EF4444]" />
                  <span className="h-3 w-3 rounded-full bg-[#F59E0B]" />
                  <span className="h-3 w-3 rounded-full bg-[#10B981]" />
                  <span className="caption-3 ml-2 text-[#171717]">Live Triage Queue</span>
                </div>
                <span className="caption-4 font-mono text-[#73706D]">2 MAILBOXES SYNCED</span>
              </div>

              <div className="space-y-3">
                {PREVIEW_THREADS.map((item) => (
                  <article
                    key={item.subject}
                    className="card-lift rounded-xl border border-[#EBEBEB] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ProviderMark provider={item.provider} />
                        {item.secondaryProvider && (
                          <>
                            <span className="caption-4 text-[#73706D]">+</span>
                            <ProviderMark provider={item.secondaryProvider} />
                          </>
                        )}
                        <div className="ml-1">
                          <p className="body-4 text-[#171717]">{item.sender}</p>
                          <p className="caption-5 text-[#73706D]">{item.org}</p>
                        </div>
                      </div>
                      <RespBadge value={item.responsibility} />
                    </div>
                    <h3 className="body-4 mt-3 text-[#171717]">{item.subject}</h3>
                    <p className="body-6 mt-1 text-[#4D4D4D]">{item.takeaway}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-[#F4F4F5] pt-2.5">
                      <span className="caption-4 font-mono text-[#73706D]">AI CONFIDENCE {item.confidence}%</span>
                      <button
                        type="button"
                        onClick={() => run('assistant', () => demo('assistant'))}
                        className="button-xsm text-[#0070F3] hover:underline"
                      >
                        Inspect in workspace
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Mandatory B11 Word-by-Word Scroll Tagline Reveal Section */}
        <TaglineReveal />

        {/* Section 3: Outcome Benefits & Live Architecture Diagram */}
        <section id="architecture" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-[680px]">
            <p className="caption-3 uppercase tracking-wider text-[#0070F3]">Deterministic triage architecture</p>
            <h2 className="heading-3 mt-2 text-[#171717]">Three clear queues instead of one overwhelming inbox</h2>
            <p className="body-3 mt-3 text-[#4D4D4D]">
              Inboxly reads the full conversation thread, extracts dates and financial commitments, and routes every message to the right person.
            </p>
          </div>

          <div className="mt-10">
            <ArchitectureDiagram />
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <article key={b.title} className="card-lift rounded-2xl border border-[#EBEBEB] bg-white p-6">
                <p className="caption-3 font-mono text-[#0070F3]">{b.metric}</p>
                <h3 className="title-2 mt-2 text-[#171717]">{b.title}</h3>
                <p className="body-6 mt-2 text-[#4D4D4D]">{b.detail}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Section 4: How It Works (3 steps) */}
        <section id="how" className="border-t border-[#EBEBEB] bg-[#FAFAFA] px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-[680px]">
              <p className="caption-3 uppercase tracking-wider text-[#0070F3]">How it works</p>
              <h2 className="heading-3 mt-2 text-[#171717]">From raw inbox clutter to approved replies in three steps</h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <article key={s.step} className="rounded-2xl border border-[#EBEBEB] bg-white p-6">
                  <span className="caption-3 font-mono inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] text-[#171717]">
                    {s.step}
                  </span>
                  <h3 className="title-2 mt-4 text-[#171717]">{s.title}</h3>
                  <p className="body-6 mt-2 text-[#4D4D4D]">{s.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: Objection-Handling FAQ (6 questions for AEO) */}
        <section id="faq" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-[680px]">
            <p className="caption-3 uppercase tracking-wider text-[#0070F3]">Frequently asked questions</p>
            <h2 className="heading-3 mt-2 text-[#171717]">Everything assistants and executives ask before connecting</h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {FAQS.map((item) => (
              <article key={item.q} className="rounded-2xl border border-[#EBEBEB] bg-white p-6">
                <h3 className="title-3 text-[#171717]">{item.q}</h3>
                <p className="body-6 mt-2 text-[#4D4D4D]">{item.a}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Section 6: Deep-Teal Closing CTA Band (Superhuman DESIGN.md signature #0E3030) */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl rounded-2xl bg-[#0E3030] px-6 py-16 text-white sm:px-12">
            <div className="max-w-[680px]">
              <h2 className="heading-3 text-white">Ready to give your executive a calm decision queue?</h2>
              <p className="body-2 mt-3 text-white/80">
                Launch the interactive assistant or client workspace in one click and test live email triage immediately.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => run('assistant', () => demo('assistant'))}
                  className="button-md motion-transition inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-[#0E3030] hover:bg-[#FAFAFA] active:scale-[0.98]"
                >
                  <Zap className="h-4 w-4" /> Open Assistant Demo
                </button>
                <button
                  type="button"
                  onClick={() => run('client', () => demo('client'))}
                  className="button-md motion-transition inline-flex items-center gap-2 rounded-lg border border-white/25 bg-[#155555] px-4 py-2.5 text-white hover:bg-[#1B6666] active:scale-[0.98]"
                >
                  <UserCheck className="h-4 w-4" /> Open Client Demo
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Semantic Footer with Legal & Security links (landing-page-design B10) */}
      <footer className="border-t border-[#EBEBEB] bg-white px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="caption-2 text-[#73706D]">Autonomous email triage for executive teams.</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <button type="button" onClick={() => setLegalModal('privacy')} className="caption-1 text-[#4D4D4D] hover:text-[#171717]">
              Privacy policy
            </button>
            <button type="button" onClick={() => setLegalModal('terms')} className="caption-1 text-[#4D4D4D] hover:text-[#171717]">
              Terms of service
            </button>
            <a href="#workspace" className="caption-1 text-[#0070F3] hover:underline">
              Sign in
            </a>
          </div>
        </div>
      </footer>

      <Modal
        open={Boolean(legalModal)}
        onClose={() => setLegalModal(null)}
        title={legalModal === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
        subtitle="Inboxly security and data governance"
        footer={
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setLegalModal(null)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-3 body-6 text-[#4D4D4D]">
          {legalModal === 'privacy' ? (
            <>
              <p>
                Inboxly processes connected mailbox metadata and message bodies strictly to classify reply ownership, surface deadlines, and generate draft replies for your workspace.
              </p>
              <p>
                Security telemetry is pseudonymized with HMAC SHA256 identifiers and scrubbed of bearer tokens, credentials, and raw email bodies. Sessions can be revoked immediately on sign out.
              </p>
            </>
          ) : (
            <>
              <p>
                Inboxly provides AI assisted email classification and draft generation. Outbound messages are never transmitted without explicit approval by an authenticated assistant or client user.
              </p>
              <p>
                Role boundaries are enforced server side so client portal accounts can only access conversations assigned to Client to reply.
              </p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
