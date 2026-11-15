import { useCallback, useEffect, useState } from 'react';
import { Archive, ArrowLeft, CalendarClock, CheckCircle2, Eye, EyeOff, HelpCircle, Lightbulb, MailOpen, RotateCcw, Send, Sparkles, Star, Wand2 } from 'lucide-react';
import { api } from '../api.js';
import { Avatar, Button, ErrorState, ProviderMark, RESP, RespBadge, ReviewFlag, Spinner, cx, fmtDateTime, pctWidthClass, timeAgo, useToast } from './ui.jsx';

const TONES = [
  ['professional', 'Professional'],
  ['concise', 'Concise'],
  ['warm', 'Warm'],
  ['executive', 'Executive voice'],
];

function IconBtn({ label, onClick, active, children }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={cx('rounded-lg p-2 transition hover:bg-slate-100', active ? 'text-amber-500' : 'text-slate-500')}>
      {children}
    </button>
  );
}

export default function ThreadDetail({ id, onChanged, onClose, onAsk }) {
  const toast = useToast();
  const [conv, setConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [tone, setTone] = useState('professional');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');

  const apply = useCallback(
    (c, { silent = false } = {}) => {
      setConv(c);
      if (!silent) onChanged?.(c);
    },
    [onChanged]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { conversation } = await api.get(`/conversations/${id}`);
      setConv(conversation);
      setDraft(conversation.draftReply?.body || '');
      setNote(conversation.paContextNote || '');
      if (conversation.isUnread) {
        const r = await api.patch(`/conversations/${id}`, { isUnread: false });
        apply(r.conversation);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, apply]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      const r = await fn();
      if (r?.conversation) apply(r.conversation);
      if (okMsg) toast.push(okMsg);
      return r;
    } catch (e) {
      toast.push(e.message, { type: 'error' });
      return null;
    } finally {
      setBusy('');
    }
  };

  const patch = (body, msg) => run('patch', () => api.patch(`/conversations/${id}`, body), msg);

  if (loading && !conv)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!conv) return null;

  const r = RESP[conv.responsibility];
  const closed = conv.status === 'completed' || conv.status === 'archived';
  const lastIsInbound = conv.messages.at(-1)?.direction === 'inbound';

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header */}
      <div className="flex items-start gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
        <button onClick={onClose} className="mt-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Back to list">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">{conv.subject}</h2>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <ProviderMark provider={conv.provider} /> {conv.clientName}’s inbox · {conv.messages.length} message{conv.messages.length > 1 ? 's' : ''} · {timeAgo(conv.lastMessageAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <IconBtn label={conv.isImportant ? 'Remove important' : 'Mark important'} active={conv.isImportant} onClick={() => patch({ isImportant: !conv.isImportant })}>
            <Star className={cx('h-[18px] w-[18px]', conv.isImportant && 'fill-amber-400')} />
          </IconBtn>
          <IconBtn label="Mark as unread" onClick={async () => { await patch({ isUnread: true }, 'Marked as unread'); onClose(); }}>
            <EyeOff className="h-[18px] w-[18px]" />
          </IconBtn>
          <IconBtn label="Archive" onClick={async () => { await patch({ status: 'archived' }, 'Archived'); onClose(); }}>
            <Archive className="h-[18px] w-[18px]" />
          </IconBtn>
          <IconBtn label="Mark completed" onClick={async () => { await patch({ status: 'completed' }, 'Marked completed'); onClose(); }}>
            <CheckCircle2 className="h-[18px] w-[18px]" />
          </IconBtn>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {closed && (
          <div className="flex items-center justify-between gap-3 bg-slate-100 px-5 py-2.5 text-sm text-slate-600">
            <span>This conversation is {conv.status}.</span>
            <button onClick={() => patch({ status: 'open' }, 'Reopened')} className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline">
              <RotateCcw className="h-3.5 w-3.5" /> Reopen
            </button>
          </div>
        )}

        {conv.needsReview && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3.5 sm:px-5">
            <div className="flex items-start gap-3">
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-rose-800">AI isn’t sure who should reply ({Math.round(conv.aiConfidence * 100)}% confident)</p>
                <p className="mt-0.5 text-sm text-rose-700">{conv.classificationReason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(RESP).map(([k, v]) => (
                    <Button key={k} size="sm" variant="secondary" onClick={() => patch({ responsibility: k }, `Set to “${v.label}”`)}>
                      {v.label}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => patch({ dismissReview: true }, 'Keeping the AI’s pick')}>
                    Keep AI’s pick
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI insights */}
        <section className="m-4 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/70 to-white sm:m-5">
          <div className="flex items-center justify-between gap-2 border-b border-indigo-100/70 px-4 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" /> AI insights
            </span>
            <button onClick={() => run('reanalyze', () => api.post(`/conversations/${id}/reanalyze`), 'Re-analyzed')} disabled={busy === 'reanalyze'} className="text-xs font-semibold text-slate-500 hover:text-indigo-600">
              {busy === 'reanalyze' ? 'Analyzing…' : 'Re-analyze'}
            </button>
          </div>
          <div className="space-y-4 p-4">
            <p className="font-display text-[15px] font-bold leading-snug text-slate-900">{conv.oneLineTakeaway}</p>
            <p className="text-sm leading-relaxed text-slate-600">{conv.aiSummary}</p>

            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-xs font-semibold text-slate-500">Who replies</span>
                <RespBadge value={conv.responsibility} />
                {conv.needsReview && <ReviewFlag />}
                <label className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                  Change
                  <select
                    aria-label="Change reply responsibility"
                    value={conv.responsibility}
                    onChange={(e) => patch({ responsibility: e.target.value }, `Moved to “${RESP[e.target.value].label}”`)}
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
                  >
                    {Object.entries(RESP).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className={cx('h-full rounded-full', r.bar, pctWidthClass(conv.aiConfidence * 100))} />
                </div>
                <span className="text-xs font-semibold tabular-nums text-slate-500">{conv.manualOverride ? 'Set manually' : `${Math.round(conv.aiConfidence * 100)}% confident`}</span>
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[13px] text-slate-600">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> {conv.classificationReason}
              </p>
              {conv.clientActionWhy && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-amber-200">
                  <b>Why the client:</b> {conv.clientActionWhy}
                </p>
              )}
              {conv.delegatedByClientNote && (
                <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-[13px] text-indigo-900 ring-1 ring-indigo-200">
                  <b>Client note:</b> “{conv.delegatedByClientNote}”
                </p>
              )}
            </div>

            {(conv.highlights?.length > 0 || conv.extractedDates?.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {conv.highlights?.map((h) => (
                  <span key={h} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                    {h}
                  </span>
                ))}
                {conv.extractedDates?.map((d) => (
                  <span key={d.dateText + d.label} className={cx('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ring-1', d.type === 'deadline' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-sky-50 text-sky-700 ring-sky-200')}>
                    <CalendarClock className="h-3 w-3" /> {d.dateText}
                  </span>
                ))}
              </div>
            )}

            {conv.responsibilityHistory?.length > 1 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Ownership timeline</p>
                <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
                  {conv.responsibilityHistory.map((h, i) => (
                    <li key={i} className="relative text-[13px] text-slate-600">
                      <span className={cx('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', RESP[h.to]?.dot)} />
                      <b className="text-slate-800">{RESP[h.to]?.label}</b> <span className="text-slate-400">· {h.source === 'assistant' ? 'you' : h.source === 'client' ? 'client' : 'AI'} · {timeAgo(h.at)}</span>
                      <br />
                      <span className="text-slate-500">{h.reason}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-indigo-100/70 pt-3">
              <Button size="sm" variant="secondary" icon={Wand2} onClick={() => onAsk('Summarize this conversation', id)}>
                Ask AI to summarize
              </Button>
              <Button size="sm" variant="secondary" icon={HelpCircle} onClick={() => onAsk(`Why has this email been assigned to the ${conv.responsibility === 'client_to_reply' ? 'client' : conv.responsibility === 'assistant_to_reply' ? 'assistant' : 'no-reply bucket'}?`, id)}>
                Why this owner?
              </Button>
            </div>
          </div>
        </section>

        {/* Messages */}
        <section className="space-y-3 px-4 pb-6 sm:px-5">
          {conv.messages.map((m) => {
            const out = m.direction === 'outbound';
            return (
              <article key={m._id} className={cx('flex gap-3', out && 'flex-row-reverse')}>
                <Avatar name={m.senderName} size="sm" tone={out ? 'indigo' : 'slate'} />
                <div className={cx('max-w-[88%] rounded-2xl px-4 py-3 text-sm', out ? 'rounded-tr-sm bg-indigo-600 text-white' : 'rounded-tl-sm bg-slate-100 text-slate-800')}>
                  <p className={cx('mb-1 flex flex-wrap items-baseline gap-x-2 text-xs', out ? 'text-indigo-200' : 'text-slate-500')}>
                    <b className={out ? 'text-white' : 'text-slate-700'}>{m.senderName}</b>
                    <span className="truncate">&lt;{m.senderEmail}&gt;</span>
                    <span>{fmtDateTime(m.sentAt)}</span>
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              </article>
            );
          })}
        </section>
      </div>

      {/* Composer */}
      {!closed && (
        <div className="border-t border-slate-200 bg-slate-50/80 p-3 sm:p-4">
          {conv.stagedForClient && (
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Send className="h-3.5 w-3.5" /> Staged — waiting for the client to approve & send
              <button className="ml-auto font-semibold text-slate-500 hover:text-slate-800" onClick={() => patch({ stagedForClient: false }, 'Unstaged')}>
                Unstage
              </button>
            </p>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder={lastIsInbound ? 'Write a reply, or let AI draft one…' : 'Write a follow-up, or let AI draft one…'}
            className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm leading-relaxed outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            aria-label="Reply draft"
          />
          {conv.responsibility === 'client_to_reply' && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional 1-line note for the client (e.g. “Counsel reviewed — I’d counter”)"
              className="mt-2 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              aria-label="Note for client"
            />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Draft tone" className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
              {TONES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              icon={Sparkles}
              loading={busy === 'draft'}
              onClick={async () => {
                const res = await run('draft', () => api.post(`/conversations/${id}/draft`, { tone, asClient: tone === 'executive' }));
                if (res) setDraft(res.draft);
              }}
            >
              {draft ? 'Redraft with AI' : 'Draft with AI'}
            </Button>
            <span className="flex-1" />
            {conv.responsibility === 'client_to_reply' && (
              <Button
                size="sm"
                variant="amber"
                icon={Eye}
                disabled={!draft.trim() && !note.trim()}
                loading={busy === 'stage'}
                onClick={() => run('stage', () => api.patch(`/conversations/${id}`, { stagedForClient: true, paContextNote: note, draftBody: draft }), 'Staged for the client’s one-tap approval')}
              >
                Stage for client
              </Button>
            )}
            <Button size="sm" variant="primary" icon={MailOpen} disabled={!draft.trim()} loading={busy === 'send'} onClick={async () => { const res = await run('send', () => api.post(`/conversations/${id}/reply`, { body: draft }), 'Reply sent'); if (res) { setDraft(''); } }}>
              Approve & send
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">AI drafts are never sent automatically — review, edit, then approve.</p>
        </div>
      )}
    </div>
  );
}
