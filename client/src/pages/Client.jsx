import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Check, ChevronDown, Clock, HandHelping, LogOut, Mic, PartyPopper, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, Button, ErrorState, Logo, Modal, ProviderMark, Spinner, cx, fmtDateTime, timeAgo, useToast } from '../components/ui.jsx';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function ThreadModal({ id, onClose }) {
  const [conv, setConv] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id) return;
    setConv(null);
    setError('');
    api.get(`/conversations/${id}`).then((d) => setConv(d.conversation)).catch((e) => setError(e.message));
  }, [id]);
  return (
    <Modal open={Boolean(id)} onClose={onClose} title={conv?.subject || 'Original conversation'} subtitle={conv ? `${conv.messages.length} message${conv.messages.length > 1 ? 's' : ''}` : ''} wide>
      {error ? <ErrorState message={error} /> : !conv ? <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div> : (
        <div className="space-y-4">
          {conv.messages.map((m) => (
            <article key={m._id} className={cx('rounded-xl p-4 text-sm', m.direction === 'outbound' ? 'bg-indigo-50' : 'bg-slate-50')}>
              <p className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
                <b className="text-slate-800">{m.senderName}</b> <span>{fmtDateTime(m.sentAt)}</span>
              </p>
              <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{m.body}</p>
            </article>
          ))}
        </div>
      )}
    </Modal>
  );
}

function DecisionCard({ c, busy, onAction, onOpen }) {
  const [text, setText] = useState('');
  const [showDraft, setShowDraft] = useState(true);
  const [delegating, setDelegating] = useState(false);
  const [note, setNote] = useState('');
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const hasDraft = Boolean(c.draftReply?.body);
  const sender = (c.participants || []).find((p) => !/\(for /.test(p.name || ''))?.name || 'Someone';

  const mic = () => {
    if (listening) return recRef.current?.stop();
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = true;
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(' '));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    setListening(true);
    r.start();
  };

  const draftIntent = async () => {
    if (text.trim().length < 3) return;
    await onAction(c.id, { action: 'quick_intent', text });
    setText('');
  };

  return (
    <article className="animate-fade-up overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md" aria-label={c.subject}>
      <div className="p-5 sm:p-6">
        {/* 1. Header */}
        <header className="flex items-start gap-3">
          <Avatar name={sender} tone="amber" size="lg" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-slate-900">
              {sender}
              <span className="flex items-center gap-1 text-xs font-medium text-slate-400"><ProviderMark provider={c.provider} /> {timeAgo(c.lastMessageAt)}</span>
            </p>
            <h2 className="mt-0.5 text-[15px] font-semibold text-slate-600">{c.subject}</h2>
          </div>
          {c.isImportant && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">Priority</span>}
        </header>

        {/* 2. Takeaway + why */}
        <h3 className="mt-4 font-display text-xl font-extrabold leading-snug text-slate-900">{c.oneLineTakeaway}</h3>
        <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200/70">
          <b>Why this needs you: </b>{c.clientActionWhy || 'Your assistant flagged this for your personal reply.'}
        </p>
        <button onClick={() => onOpen(c.id)} className="mt-3 text-sm font-semibold text-indigo-600 hover:underline">Read the original conversation →</button>

        {/* 3. Reply zone */}
        <div className="mt-5 space-y-3">
          {c.paContextNote && (
            <p className="flex items-start gap-2 text-sm text-slate-600">
              <Avatar name="Assistant" size="sm" />
              <span className="rounded-xl rounded-tl-sm bg-slate-100 px-3 py-2"><b className="text-slate-700">Your assistant:</b> {c.paContextNote}</span>
            </p>
          )}

          {hasDraft && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50">
              <button onClick={() => setShowDraft((s) => !s)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-bold text-emerald-800">
                <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Draft reply is ready</span>
                <ChevronDown className={cx('h-4 w-4 transition', showDraft && 'rotate-180')} />
              </button>
              {showDraft && <p className="whitespace-pre-wrap px-4 pb-3 text-sm leading-relaxed text-slate-700">{c.draftReply.body}</p>}
              <div className="px-4 pb-4">
                <Button variant="success" size="lg" className="w-full" icon={Send} loading={busy === `${c.id}:approve_and_send`} onClick={() => onAction(c.id, { action: 'approve_and_send' })}>
                  Approve & send
                </Button>
              </div>
            </div>
          )}

          {c.quickActionChips?.length > 0 && !hasDraft && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">One-tap reply</p>
              <div className="flex flex-wrap gap-2">
                {c.quickActionChips.map((chip, i) => (
                  <Button key={chip.label} variant={chip.actionType === 'decline' ? 'secondary' : 'primary'} loading={busy === `${c.id}:chip${i}`} onClick={() => onAction(c.id, { action: 'quick_chip', chipIndex: i }, `chip${i}`)}>
                    {chip.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {!hasDraft && (
            <form onSubmit={(e) => { e.preventDefault(); draftIntent(); }} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={listening ? 'Listening…' : 'Or say it in a few words…'}
                  aria-label="Reply in a few words"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-4 pr-11 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
                {SR && (
                  <button type="button" onClick={mic} aria-label={listening ? 'Stop dictation' : 'Dictate'} className={cx('absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition', listening ? 'animate-pulse-ring bg-rose-500 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700')}>
                    <Mic className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button type="submit" variant="secondary" size="md" disabled={text.trim().length < 3} loading={busy === `${c.id}:quick_intent`}>
                Draft
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* 4. Footer controls */}
      <footer className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
        {delegating ? (
          <form onSubmit={(e) => { e.preventDefault(); onAction(c.id, { action: 'delegate_to_assistant', note }); }} className="flex flex-col gap-2 sm:flex-row">
            <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note, e.g. “Accept, but ask for travel”" aria-label="Note for your assistant" className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="md" loading={busy === `${c.id}:delegate_to_assistant`}>Hand over</Button>
              <Button type="button" variant="ghost" onClick={() => setDelegating(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon={HandHelping} onClick={() => setDelegating(true)}>Have assistant handle this</Button>
            <Button variant="secondary" size="sm" icon={Check} loading={busy === `${c.id}:mark_handled`} onClick={() => onAction(c.id, { action: 'mark_handled' })}>Mark as handled</Button>
            <Button variant="ghost" size="sm" icon={Clock} className="ml-auto" loading={busy === `${c.id}:snooze`} onClick={() => onAction(c.id, { action: 'snooze' })}>Later</Button>
          </div>
        )}
      </footer>
    </article>
  );
}

export default function Client() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [openId, setOpenId] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const isAssistant = user.role === 'assistant';

  const load = useCallback(async () => {
    try {
      setData(await api.get('/conversations/client-queue'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const undo = useCallback(
    async (id) => {
      try {
        await api.post(`/conversations/${id}/undo-send`);
        toast.push('Send undone — your draft is back', { type: 'info' });
        load();
      } catch (e) {
        toast.push(e.message, { type: 'error' });
      }
    },
    [load, toast]
  );

  const act = async (id, body, key) => {
    setBusy(`${id}:${key || body.action}`);
    try {
      const res = await api.post(`/conversations/${id}/client-action`, body);
      if (res.undoUntil && ['approve_and_send', 'quick_chip'].includes(body.action)) {
        toast.push(res.message, { duration: 5000, action: { label: 'Undo', onClick: () => undo(id) } });
      } else toast.push(res.message);
      await load();
    } catch (e) {
      toast.push(e.message, { type: 'error' });
    } finally {
      setBusy('');
    }
  };

  const listen = () => {
    const synth = window.speechSynthesis;
    if (!synth) return toast.push('Audio brief isn’t supported in this browser', { type: 'info' });
    if (speaking) {
      synth.cancel();
      return setSpeaking(false);
    }
    const u = new SpeechSynthesisUtterance(data.audioBriefText);
    u.rate = 1.02;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  };

  const items = data?.items || [];
  const name = (data?.clientName || user.name).split(' ')[0];
  const subtitle = useMemo(() => {
    if (!items.length) return 'Nothing needs your attention.';
    return `${items.length} item${items.length > 1 ? 's' : ''} need${items.length > 1 ? '' : 's'} your personal response.`;
  }, [items.length]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-amber-50/60 via-white to-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            {isAssistant && (
              <Button variant="secondary" size="sm" icon={ArrowLeftRight} onClick={() => nav('/assistant')}>
                <span className="hidden sm:inline">Assistant view</span><span className="sm:hidden">Assistant</span>
              </Button>
            )}
            {!isAssistant && <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>Sign out</Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
        {!data && !error && (
          <div className="space-y-4" aria-busy="true">
            <div className="skeleton h-9 w-2/3" />
            <div className="skeleton h-5 w-1/2" />
            <div className="skeleton mt-6 h-64 !rounded-3xl" />
          </div>
        )}
        {error && !data && <ErrorState message={error} onRetry={load} />}

        {data && (
          <>
            <section className="mb-6 animate-fade-up">
              <h1 className="font-display text-3xl font-extrabold text-slate-900">{greeting()}, {name}</h1>
              <p className="mt-1.5 text-slate-500">{subtitle}</p>
              {items.length > 0 && (
                <button onClick={listen} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50">
                  {speaking ? <VolumeX className="h-4 w-4 text-rose-500" /> : <Volume2 className="h-4 w-4 text-indigo-600" />}
                  {speaking ? 'Stop' : 'Listen to 30s brief'}
                </button>
              )}
            </section>

            {items.length === 0 ? (
              <section className="animate-fade-up rounded-3xl border border-emerald-200 bg-white px-6 py-16 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                  <PartyPopper className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="font-display text-2xl font-extrabold text-slate-900">You’re all caught up</h2>
                <p className="mx-auto mt-2 max-w-sm text-slate-500">Nothing needs your personal attention. Your assistant has the rest covered.</p>
                {data.snoozedCount > 0 && <p className="mt-4 text-sm text-slate-400">{data.snoozedCount} snoozed item{data.snoozedCount > 1 ? 's' : ''} will come back tomorrow morning.</p>}
              </section>
            ) : (
              <div className="space-y-5">
                {items.map((c) => (
                  <DecisionCard key={c.id} c={c} busy={busy} onAction={act} onOpen={setOpenId} />
                ))}
                {data.snoozedCount > 0 && <p className="text-center text-sm text-slate-400">{data.snoozedCount} snoozed until tomorrow morning</p>}
              </div>
            )}
          </>
        )}
      </main>

      <ThreadModal id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
