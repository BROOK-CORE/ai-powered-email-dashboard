import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Clock,
  Filter,
  HandHelping,
  LogOut,
  Mic,
  PartyPopper,
  Plus,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Tag,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ThemeToggle } from '../theme.jsx';
import { Avatar, Button, ErrorState, Logo, Modal, ProviderMark, Spinner, cx, fmtDateTime, timeAgo, useToast } from '../components/ui.jsx';
import RuleManagerModal from '../components/RuleManagerModal.jsx';

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
      subtitle={conv ? `${conv.messages?.length || 0} message${conv.messages?.length > 1 ? 's' : ''}` : ''}
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
          {conv.messages?.map((m) => (
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

function DecisionCard({ c, busy, onAction, onOpen, onQuickRule }) {
  const [text, setText] = useState('');
  const [showDraft, setShowDraft] = useState(true);
  const [delegating, setDelegating] = useState(false);
  const [note, setNote] = useState('');
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const hasDraft = Boolean(c.draftReply?.body);
  const senderObj = (c.participants || []).find((p) => !/\(for /.test(p.name || '')) || {};
  const sender = senderObj.name || 'Sender';
  const senderEmail = senderObj.email || '';

  const mic = () => {
    if (listening) return recRef.current?.stop();
    if (!SR) return;
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
      className="card-lift animate-fade-up overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white transition-colors"
      aria-label={c.subject}
    >
      <div className="p-6">
        {/* 1. Header with Category and Quick Rule Button */}
        <header className="flex items-start gap-3">
          <div className="relative">
            <Avatar name={sender} tone="amber" size="lg" />
            <span className="absolute -bottom-1 -right-1">
              <ProviderMark provider={c.provider} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="body-4 font-semibold text-[#171717]">{sender}</span>
              {senderEmail && <span className="caption-4 text-[#73706D]">&lt;{senderEmail}&gt;</span>}

              {/* Category Badges */}
              {c.customCategory && (
                <span className="caption-3 rounded-full border border-[#BFDBFE] bg-[#EBF5FF] px-2 py-0.5 text-[#0070F3]">
                  {c.customCategory}
                </span>
              )}
              {c.isImportant && !c.customCategory && (
                <span className="caption-3 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2.5 py-0.5 text-[#B45309]">
                  ⭐ Important
                </span>
              )}
              {c.segments?.includes('action_required') && !c.customCategory && (
                <span className="caption-3 rounded-full border border-[#FECACA] bg-[#FEF2F2] px-2 py-0.5 text-[#DC2626]">
                  ⚡ Immediate Action Required
                </span>
              )}

              <span className="caption-4 font-mono ml-auto text-[#73706D]">{timeAgo(c.lastMessageAt)}</span>
            </div>

            <h2 className="body-5 mt-1 font-medium text-[#171717]">{c.subject}</h2>
          </div>
        </header>

        {/* 2. Takeaway + Amber Why Callout */}
        <h3 className="heading-6 mt-4 text-[#171717]">{c.oneLineTakeaway || c.snippet}</h3>
        <div className="mt-3 rounded-lg border border-[#FDE68A] bg-[#FEF3C7]/60 px-4 py-3 body-6 text-[#92400E]">
          <b>Why this needs you: </b>
          {c.clientActionWhy || c.classificationReason || 'Flagged for your executive review and decision.'}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <button type="button" onClick={() => onOpen(c.id)} className="button-sm text-[#0070F3] hover:underline">
            Read full conversation &rarr;
          </button>
          {senderEmail && (
            <button
              type="button"
              onClick={() => onQuickRule(senderEmail, c.subject)}
              className="inline-flex items-center gap-1 rounded-md border border-[#EBEBEB] bg-[#FAFAFA] px-2 py-1 text-[11px] font-medium text-[#73706D] hover:border-[#D4D4D8] hover:text-[#171717]"
            >
              <Zap className="h-3 w-3 text-[#0070F3]" /> Always route this sender
            </button>
          )}
        </div>

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
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Or reply in a few words / voice dictation..."
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

            {/* Quick Category Assignment */}
            <select
              value={c.customCategory || ''}
              onChange={(e) => onAction(c.id, { action: 'assign_category', category: e.target.value })}
              className="body-6 h-8 rounded-lg border border-[#D4D4D8] bg-white px-2 text-[#73706D] outline-none"
            >
              <option value="">Category: Default</option>
              <option value="Important">⭐ Important</option>
              <option value="Action Required">⚡ Action Required</option>
              <option value="Waiting for Response">⏳ Waiting for Response</option>
              <option value="AI to Reply">🤖 AI to Reply</option>
            </select>

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
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'action_required' | 'important' | 'waiting_response' | 'ai_reply' | slug
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [openId, setOpenId] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [rulePrefill, setRulePrefill] = useState({ value: '', type: 'from_email' });

  const isAssistant = user?.role === 'assistant';

  const load = useCallback(async () => {
    try {
      const [queueData, catData] = await Promise.all([
        api.get(`/conversations/client-queue?category=${activeCategory}`),
        api.get('/rules/categories').catch(() => ({ categories: [] })),
      ]);
      setData(queueData);
      setCategories(catData.categories || []);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [activeCategory]);

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
        toast.push('Send undone');
        await load();
      } catch (e) {
        toast.push(e.message, { type: 'error' });
      }
    },
    [load, toast]
  );

  const act = useCallback(
    async (id, body, key = '') => {
      setBusy(`${id}:${key || body.action}`);
      try {
        const res = await api.post(`/conversations/${id}/client-action`, body);
        if (body.action === 'approve_and_send' || body.action === 'quick_chip') {
          toast.push(res.message, {
            action: { label: 'Undo', onClick: () => undo(id) },
          });
        } else {
          toast.push(res.message);
        }
        await load();
      } catch (e) {
        toast.push(e.message, { type: 'error' });
      } finally {
        setBusy('');
      }
    },
    [load, toast, undo]
  );

  const listen = () => {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const txt = data?.audioBriefText || 'You are all caught up. No immediate emails require your personal decision.';
    const u = new SpeechSynthesisUtterance(txt);
    u.rate = 1.05;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  const handleQuickRule = (email, subject) => {
    setRulePrefill({ value: email, type: 'from_email' });
    setRuleModalOpen(true);
  };

  const items = data?.items || [];
  const stats = data?.stats || {};
  const name = (data?.clientName || user?.name || 'Executive').split(' ')[0];

  const categoryTabs = [
    { id: 'all', label: 'All Active', count: stats.total || items.length },
    { id: 'action_required', label: '⚡ Immediate Action', count: stats.actionRequiredCount || 0 },
    { id: 'important', label: '⭐ Important', count: stats.importantCount || 0 },
    { id: 'waiting_response', label: '⏳ Waiting for Response', count: stats.waitingResponseCount || 0 },
    { id: 'ai_reply', label: '🤖 AI to Reply', count: stats.aiReplyCount || 0 },
    ...categories.map((c) => ({ id: c.slug, label: c.name, count: null, color: c.color })),
  ];

  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-[#171717] transition-colors">
      <header className="sticky top-0 z-20 border-b border-[#EBEBEB] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="secondary" size="sm" icon={Filter} onClick={() => setRuleModalOpen(true)}>
              <span className="hidden sm:inline">Rules & Categories</span>
              <span className="sm:hidden">Rules</span>
            </Button>
            <Button variant="secondary" size="sm" icon={SettingsIcon} onClick={() => nav('/settings')}>
              Settings
            </Button>
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

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-8">
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
            {/* Executive Greeting Row */}
            <section className="mb-6 flex flex-wrap items-start justify-between gap-4 animate-fade-up">
              <div>
                <h1 className="heading-3 sm:heading-2 text-[#171717]">
                  {greeting()}, {name}
                </h1>
                <p className="body-2 mt-1.5 text-[#4D4D4D]">
                  {items.length === 0
                    ? 'No conversations in this category.'
                    : `${items.length} conversation${items.length > 1 ? 's' : ''} in this view.`}
                </p>
              </div>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={listen}
                  className="button-sm motion-transition inline-flex items-center gap-2 rounded-full bg-[#171717] px-4 py-2 text-white hover:bg-black active:scale-[0.98]"
                >
                  {speaking ? <VolumeX className="h-4 w-4 text-[#F87171]" /> : <Volume2 className="h-4 w-4 text-[#10B981]" />}
                  {speaking ? 'Stop audio brief' : 'Listen to 30s audio brief'}
                </button>
              )}
            </section>

            {/* Category Selector Tabs */}
            <nav className="mb-6 flex gap-1.5 overflow-x-auto pb-2 text-xs font-semibold scrollbar-none">
              {categoryTabs.map((t) => {
                const active = activeCategory === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveCategory(t.id)}
                    className={cx(
                      'flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 transition',
                      active
                        ? 'border-[#0070F3] bg-[#0070F3] text-white shadow-sm'
                        : 'border-[#EBEBEB] bg-white text-[#73706D] hover:border-[#D4D4D8] hover:text-[#171717]'
                    )}
                  >
                    <span>{t.label}</span>
                    {t.count !== null && (
                      <span
                        className={cx(
                          'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                          active ? 'bg-white/20 text-white' : 'bg-[#FAFAFA] text-[#73706D]'
                        )}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {items.length === 0 ? (
              <div className="animate-fade-up rounded-2xl border border-[#EBEBEB] bg-white p-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]">
                  <PartyPopper className="h-6 w-6" />
                </div>
                <h2 className="heading-5 text-[#171717]">No conversations in this view</h2>
                <p className="body-6 mx-auto mt-1.5 max-w-sm text-[#73706D]">
                  All items for this category have been addressed or your assistant is handling them autonomously.
                </p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => setActiveCategory('all')}>
                  View all active threads
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {items.map((c) => (
                  <DecisionCard
                    key={c.id}
                    c={c}
                    busy={busy}
                    onAction={act}
                    onOpen={setOpenId}
                    onQuickRule={handleQuickRule}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <ThreadModal id={openId} onClose={() => setOpenId(null)} />

      {/* Rule & Category Manager Modal */}
      <RuleManagerModal
        open={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        initialMatchValue={rulePrefill.value}
        initialMatchType={rulePrefill.type}
        onRulesChanged={load}
      />
    </div>
  );
}
