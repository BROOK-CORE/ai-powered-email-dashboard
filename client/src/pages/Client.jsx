import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Check, ChevronDown, Clock, HandHelping, LogOut, Mic, PartyPopper, Send, Sparkles, Volume2, VolumeX } from 'lucide-react';
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
    api
      .get(`/conversations/${id}`)
      .then((d) => setConv(d.conversation))
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <Modal
      open={Boolean(id)}
      onClose={onClose}
      title={conv?.subject || 'Original conversation'}
      subtitle={conv ? `${conv.messages.length} message${conv.messages.length > 1 ? 's' : ''}` : ''}
      wide
    >
      {error ? (
        <ErrorState message={error} />
      ) : !conv ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-3">
          {conv.messages.map((m) => (
            <article
              key={m._id}
              className={cx(
                'rounded-xl border p-4 body-6',
                m.direction === 'outbound' ? 'border-[#BFDBFE] bg-[#EBF5FF]/50' : 'border-[#EBEBEB] bg-[#FAFAFA]'
              )}
            >
              <p className="caption-4 mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[#73706D]">
                <b className="text-[#171717]">{m.senderName}</b> <span className="font-mono">{fmtDateTime(m.sentAt)}</span>
              </p>
              <p className="whitespace-pre-wrap text-[#171717]">{m.body}</p>
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
  const sender = (c.participants || []).find((p) => !/\(for /.test(p.name || ''))?.name || 'Sender';

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
    <article
      className="card-lift animate-fade-up overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white"
      aria-label={c.subject}
    >
      <div className="p-6">
        {/* 1. Sender header matching generated reference image 3 */}
        <header className="flex items-start gap-3">
          <div className="relative">
            <Avatar name={sender} tone="amber" size="lg" />
            <span className="absolute -bottom-1 -right-1">
              <ProviderMark provider={c.provider} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="body-4 text-[#171717]">{sender}</span>
              {c.isImportant && (
                <span className="caption-3 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2.5 py-0.5 text-[#B45309]">
                  Urgent Decision
                </span>
              )}
              <span className="caption-4 font-mono ml-auto text-[#73706D]">{timeAgo(c.lastMessageAt)}</span>
            </div>
            <h2 className="body-5 mt-0.5 text-[#4D4D4D]">{c.subject}</h2>
          </div>
        </header>

        {/* 2. Takeaway + Amber Why Callout */}
        <h3 className="heading-5 mt-5 text-[#171717]">{c.oneLineTakeaway}</h3>
        <div className="mt-3 rounded-lg border border-[#FDE68A] bg-[#FEF3C7]/60 px-4 py-3 body-6 text-[#92400E]">
          <b>Why this needs you: </b>
          {c.clientActionWhy || 'Your assistant flagged this thread for your personal decision.'}
        </div>
        <button type="button" onClick={() => onOpen(c.id)} className="button-sm mt-3 text-[#0070F3] hover:underline">
          Read full conversation
        </button>

        {/* 3. Reply & Action Zone */}
        <div className="mt-5 space-y-4">
          {c.paContextNote && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] p-3 body-6 text-[#4D4D4D]">
              <Avatar name="Assistant" size="sm" tone="dark" />
              <span>
                <b className="text-[#171717]">Assistant note:</b> {c.paContextNote}
              </span>
            </div>
          )}

          {hasDraft && (
            <div className="rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] p-4">
              <button
                type="button"
                onClick={() => setShowDraft((s) => !s)}
                className="flex w-full items-center justify-between text-left body-4 text-[#171717]"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#059669]" /> Draft reply prepared for your approval
                </span>
                <ChevronDown className={cx('motion-transition h-4 w-4 text-[#73706D]', showDraft && 'rotate-180')} />
              </button>
              {showDraft && <p className="body-6 mt-3 whitespace-pre-wrap text-[#4D4D4D]">{c.draftReply.body}</p>}
              <div className="mt-4">
                <Button
                  variant="success"
                  size="lg"
                  className="w-full sm:w-auto"
                  icon={Send}
                  loading={busy === `${c.id}:approve_and_send`}
                  onClick={() => onAction(c.id, { action: 'approve_and_send' })}
                >
                  Approve and send
                </Button>
              </div>
            </div>
          )}

          {c.quickActionChips?.length > 0 && !hasDraft && (
            <div>
              <p className="caption-3 mb-2 uppercase tracking-wider text-[#73706D]">One tap reply</p>
              <div className="flex flex-wrap gap-2">
                {c.quickActionChips.map((chip, i) => (
                  <Button
                    key={chip.label}
                    variant={chip.actionType === 'decline' ? 'secondary' : i === 0 ? 'success' : 'secondary'}
                    loading={busy === `${c.id}:chip${i}`}
                    onClick={() => onAction(c.id, { action: 'quick_chip', chipIndex: i }, `chip${i}`)}
                  >
                    {chip.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {!hasDraft && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                draftIntent();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={listening ? 'Listening...' : 'Tap mic or type a short instruction...'}
                  aria-label="Reply in a few words"
                  className="body-5 h-11 w-full rounded-full border border-[#D4D4D8] bg-white pl-5 pr-12 text-[#171717] outline-none focus:border-[#0070F3] focus:ring-2 focus:ring-[#0070F3]/20"
                />
                {SR && (
                  <button
                    type="button"
                    onClick={mic}
                    aria-label={listening ? 'Stop dictation' : 'Dictate'}
                    className={cx(
                      'motion-transition absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full',
                      listening ? 'animate-pulse-ring bg-[#DC2626] text-white' : 'bg-[#171717] text-white hover:bg-black'
                    )}
                  >
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
      <footer className="border-t border-[#EBEBEB] bg-[#FAFAFA] px-6 py-3">
        {delegating ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAction(c.id, { action: 'delegate_to_assistant', note });
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for your assistant (for example: Accept, but confirm travel)"
              aria-label="Note for your assistant"
              className="body-5 h-9 flex-1 rounded-lg border border-[#D4D4D8] bg-white px-3 text-[#171717] outline-none focus:border-[#0070F3]"
            />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" loading={busy === `${c.id}:delegate_to_assistant`}>
                Hand over
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDelegating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon={HandHelping} onClick={() => setDelegating(true)}>
              Have assistant handle this
            </Button>
            <Button variant="secondary" size="sm" icon={Check} loading={busy === `${c.id}:mark_handled`} onClick={() => onAction(c.id, { action: 'mark_handled' })}>
              Mark as handled
            </Button>
            <Button variant="ghost" size="sm" icon={Clock} className="ml-auto" loading={busy === `${c.id}:snooze`} onClick={() => onAction(c.id, { action: 'snooze' })}>
              Later
            </Button>
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
        toast.push('Send undone. Your draft is restored.', { type: 'info' });
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
    if (!synth) return toast.push('Audio brief is not supported in this browser', { type: 'info' });
    if (speaking) {
      synth.cancel();
      return setSpeaking(false);
    }
    const u = new SpeechSynthesisUtterance(data.audioBriefText);
    u.rate = 1.02;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    return synth.speak(u);
  };

  const items = data?.items || [];
  const name = (data?.clientName || user.name).split(' ')[0];
  const subtitle = useMemo(() => {
    if (!items.length) return 'Nothing needs your attention.';
    return `${items.length} item${items.length > 1 ? 's' : ''} need${items.length > 1 ? '' : 's'} your personal response.`;
  }, [items.length]);

  return (
    <div className="min-h-dvh bg-[#FAF9F6]">
      <header className="sticky top-0 z-20 border-b border-[#EBEBEB] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            {isAssistant && (
              <Button variant="secondary" size="sm" icon={ArrowLeftRight} onClick={() => nav('/assistant')}>
                <span className="hidden sm:inline">Assistant view</span>
                <span className="sm:hidden">Assistant</span>
              </Button>
            )}
            {!isAssistant && (
              <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-10">
        {!data && !error && (
          <div className="space-y-4" aria-busy="true">
            <div className="skeleton h-9 w-2/3" />
            <div className="skeleton h-5 w-1/2" />
            <div className="skeleton mt-6 h-64 !rounded-2xl" />
          </div>
        )}
        {error && !data && <ErrorState message={error} onRetry={load} />}

        {data && (
          <>
            {/* Executive Header Row matching generated reference image 3 */}
            <section className="mb-8 flex flex-wrap items-start justify-between gap-4 animate-fade-up">
              <div>
                <h1 className="heading-3 sm:heading-2 text-[#171717]">
                  {greeting()}, {name}
                </h1>
                <p className="body-2 mt-2 text-[#4D4D4D]">{subtitle}</p>
              </div>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={listen}
                  className="button-sm motion-transition inline-flex items-center gap-2 rounded-full bg-[#171717] px-4 py-2.5 text-white hover:bg-black active:scale-[0.98]"
                >
                  {speaking ? <VolumeX className="h-4 w-4 text-[#F87171]" /> : <Volume2 className="h-4 w-4 text-[#10B981]" />}
                  {speaking ? 'Stop audio brief' : 'Listen to 30s audio brief'}
                </button>
              )}
            </section>

            {items.length === 0 ? (
              <div className="animate-fade-up rounded-2xl border border-[#EBEBEB] bg-white p-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]">
                  <PartyPopper className="h-6 w-6" />
                </div>
                <h2 className="heading-5 text-[#171717]">You are all caught up</h2>
                <p className="body-6 mx-auto mt-1.5 max-w-sm text-[#73706D]">
                  Your assistant is handling the rest of your inbox. We will only interrupt when a decision requires you personally.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {items.map((c) => (
                  <DecisionCard key={c.id} c={c} busy={busy} onAction={act} onOpen={setOpenId} />
                ))}
              </div>
            )}

            {(data.handledCount > 0 || data.snoozedCount > 0) && (
              <p className="caption-2 mt-8 text-center font-mono text-[#73706D]">
                {data.handledCount > 0 && `${data.handledCount} handled`}
                {data.handledCount > 0 && data.snoozedCount > 0 && ' · '}
                {data.snoozedCount > 0 && `${data.snoozedCount} snoozed until tomorrow morning`}
              </p>
            )}
          </>
        )}
      </main>

      <ThreadModal id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
