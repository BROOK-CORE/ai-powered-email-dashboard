import { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Send,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react';
import { api } from '../api.js';
import {
  Avatar,
  Button,
  ErrorState,
  ProviderMark,
  RESP,
  RespBadge,
  ReviewFlag,
  Spinner,
  cx,
  fmtDateTime,
  pctWidthClass,
  timeAgo,
  useToast,
} from './ui.jsx';

const TONES = [
  ['professional', 'Professional'],
  ['concise', 'Concise'],
  ['warm', 'Warm'],
  ['executive', 'Executive voice'],
];

function IconBtn({ label, onClick, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx('motion-transition rounded-lg p-2 hover:bg-[#F4F4F5]', active ? 'text-[#D97706]' : 'text-[#73706D]')}
    >
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
      <div className="flex items-start gap-2 border-b border-[#EBEBEB] px-5 py-3.5">
        <button
          type="button"
          onClick={onClose}
          className="mt-0.5 rounded-lg p-1.5 text-[#73706D] hover:bg-[#F4F4F5] lg:hidden"
          aria-label="Back to list"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="title-2 truncate text-[#171717]">{conv.subject}</h2>
          <p className="caption-2 mt-0.5 flex items-center gap-2 text-[#73706D]">
            <ProviderMark provider={conv.provider} /> {conv.clientName} inbox · {conv.messages.length} message
            {conv.messages.length > 1 ? 's' : ''} · {timeAgo(conv.lastMessageAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <IconBtn
            label={conv.isImportant ? 'Remove important' : 'Mark important'}
            active={conv.isImportant}
            onClick={() => patch({ isImportant: !conv.isImportant })}
          >
            <Star className={cx('h-[18px] w-[18px]', conv.isImportant && 'fill-[#D97706]')} />
          </IconBtn>
          <IconBtn
            label="Mark as unread"
            onClick={async () => {
              await patch({ isUnread: true }, 'Marked as unread');
              onClose();
            }}
          >
            <EyeOff className="h-[18px] w-[18px]" />
          </IconBtn>
          <IconBtn
            label="Archive"
            onClick={async () => {
              await patch({ status: 'archived' }, 'Archived');
              onClose();
            }}
          >
            <Archive className="h-[18px] w-[18px]" />
          </IconBtn>
          <IconBtn
            label="Mark completed"
            onClick={async () => {
              await patch({ status: 'completed' }, 'Marked completed');
              onClose();
            }}
          >
            <CheckCircle2 className="h-[18px] w-[18px]" />
          </IconBtn>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {closed && (
          <div className="flex items-center justify-between gap-3 border-b border-[#EBEBEB] bg-[#FAFAFA] px-5 py-2.5 body-5 text-[#4D4D4D]">
            <span>This conversation is {conv.status}.</span>
            <button
              type="button"
              onClick={() => patch({ status: 'open' }, 'Reopened')}
              className="button-sm inline-flex items-center gap-1 text-[#0070F3] hover:underline"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reopen
            </button>
          </div>
        )}

        {conv.needsReview && (
          <div className="border-b border-[#FECACA] bg-[#FEF2F2] px-5 py-3.5">
            <div className="flex items-start gap-3">
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#DC2626]" />
              <div className="min-w-0 flex-1">
                <p className="body-4 text-[#991B1B]">
                  AI requires human review ({Math.round(conv.aiConfidence * 100)}% confidence)
                </p>
                <p className="body-6 mt-0.5 text-[#B91C1C]">{conv.classificationReason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(RESP).map(([k, v]) => (
                    <Button key={k} size="sm" variant="secondary" onClick={() => patch({ responsibility: k }, `Set to ${v.label}`)}>
                      {v.label}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => patch({ dismissReview: true }, 'Keeping AI selection')}>
                    Keep AI selection
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Triage Card (flat surface #FAFAFA, nested radius: outer rounded-2xl 16px, inner rounded-lg 8px) */}
        <section className="m-5 overflow-hidden rounded-2xl border border-[#EBEBEB] bg-[#FAFAFA]">
          <div className="flex items-center justify-between gap-2 border-b border-[#EBEBEB] bg-white px-4 py-2.5">
            <span className="caption-3 inline-flex items-center gap-1.5 uppercase tracking-wider text-[#0070F3]">
              <Sparkles className="h-3.5 w-3.5" /> AI Triage Card
            </span>
            <button
              type="button"
              onClick={() => run('reanalyze', () => api.post(`/conversations/${id}/reanalyze`), 'Reanalyzed thread')}
              disabled={busy === 'reanalyze'}
              className="button-xsm text-[#73706D] hover:text-[#0070F3]"
            >
              {busy === 'reanalyze' ? 'Analyzing...' : 'Reanalyze'}
            </button>
          </div>
          <div className="space-y-4 p-4">
            <p className="title-3 text-[#171717]">{conv.oneLineTakeaway}</p>
            <p className="body-6 text-[#4D4D4D]">{conv.aiSummary}</p>

            <div className="rounded-lg border border-[#EBEBEB] bg-white p-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="caption-3 text-[#73706D]">Who replies</span>
                <RespBadge value={conv.responsibility} />
                {conv.needsReview && <ReviewFlag />}
                <label className="caption-4 ml-auto flex items-center gap-2 text-[#73706D]">
                  Change
                  <select
                    aria-label="Change reply responsibility"
                    value={conv.responsibility}
                    onChange={(e) => patch({ responsibility: e.target.value }, `Moved to ${RESP[e.target.value].label}`)}
                    className="caption-3 h-8 rounded-md border border-[#D4D4D8] bg-white px-2 text-[#171717] outline-none focus:border-[#0070F3]"
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
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EBEBEB]">
                  <div className={cx('h-full rounded-full', r.bar, pctWidthClass(conv.aiConfidence * 100))} />
                </div>
                <span className="caption-3 font-mono tabular-nums text-[#4D4D4D]">
                  {conv.manualOverride ? 'Set manually' : `${Math.round(conv.aiConfidence * 100)}% confident`}
                </span>
              </div>
              <p className="body-6 mt-2.5 flex items-start gap-1.5 text-[#4D4D4D]">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D97706]" /> {conv.classificationReason}
              </p>
              {conv.clientActionWhy && (
                <p className="body-6 mt-2 rounded-lg border border-[#FDE68A] bg-[#FEF3C7]/60 px-3 py-2 text-[#92400E]">
                  <b>Why the client:</b> {conv.clientActionWhy}
                </p>
              )}
              {conv.delegatedByClientNote && (
                <p className="body-6 mt-2 rounded-lg border border-[#BFDBFE] bg-[#EBF5FF] px-3 py-2 text-[#1E40AF]">
                  <b>Client note:</b> {conv.delegatedByClientNote}
                </p>
              )}
            </div>

            {(conv.highlights?.length > 0 || conv.extractedDates?.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {conv.highlights?.map((h) => (
                  <span key={h} className="caption-4 font-mono rounded-md border border-[#EBEBEB] bg-white px-2.5 py-1 text-[#171717]">
                    {h}
                  </span>
                ))}
                {conv.extractedDates?.map((d) => (
                  <span
                    key={d.dateText + d.label}
                    className={cx(
                      'caption-3 inline-flex items-center gap-1 rounded-md border px-2.5 py-1',
                      d.type === 'deadline'
                        ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
                        : 'border-[#BFDBFE] bg-[#EBF5FF] text-[#0070F3]'
                    )}
                  >
                    <CalendarClock className="h-3 w-3" /> {d.dateText}
                  </span>
                ))}
              </div>
            )}

            {conv.responsibilityHistory?.length > 1 && (
              <div className="rounded-lg border border-[#EBEBEB] bg-white p-3.5">
                <p className="caption-3 mb-2.5 uppercase tracking-wider text-[#73706D]">Ownership timeline</p>
                <ol className="space-y-2">
                  {conv.responsibilityHistory.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 body-6 text-[#4D4D4D]">
                      <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', RESP[h.to]?.dot)} />
                      <span>
                        <b className="text-[#171717]">{RESP[h.to]?.label}</b>{' '}
                        <span className="caption-4 text-[#73706D]">
                          · {h.source === 'assistant' ? 'assistant' : h.source === 'client' ? 'client' : 'AI'} · {timeAgo(h.at)}
                        </span>
                        <span className="block text-[#73706D]">{h.reason}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-[#EBEBEB] pt-3">
              <Button size="sm" variant="secondary" icon={Wand2} onClick={() => onAsk('Summarize this conversation', id)}>
                Ask AI to summarize
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={HelpCircle}
                onClick={() =>
                  onAsk(
                    `Why has this email been assigned to the ${
                      conv.responsibility === 'client_to_reply'
                        ? 'client'
                        : conv.responsibility === 'assistant_to_reply'
                          ? 'assistant'
                          : 'archive bucket'
                    }?`,
                    id
                  )
                }
              >
                Why this owner?
              </Button>
            </div>
          </div>
        </section>

        {/* Messages */}
        <section className="space-y-3 px-5 pb-6">
          {conv.messages.map((m) => {
            const out = m.direction === 'outbound';
            return (
              <article key={m._id} className={cx('flex gap-3', out && 'flex-row-reverse')}>
                <Avatar name={m.senderName} size="sm" tone={out ? 'dark' : 'slate'} />
                <div
                  className={cx(
                    'max-w-[88%] rounded-2xl border px-4 py-3 body-6',
                    out ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#EBEBEB] bg-[#FAFAFA] text-[#171717]'
                  )}
                >
                  <p className={cx('caption-4 mb-1 flex flex-wrap items-baseline gap-x-2', out ? 'text-white/70' : 'text-[#73706D]')}>
                    <b className={out ? 'text-white' : 'text-[#171717]'}>{m.senderName}</b>
                    <span className="truncate">&lt;{m.senderEmail}&gt;</span>
                    <span className="font-mono">{fmtDateTime(m.sentAt)}</span>
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              </article>
            );
          })}
        </section>
      </div>

      {/* Docked Reply Composer */}
      {!closed && (
        <div className="border-t border-[#EBEBEB] bg-[#FAFAFA] p-4">
          {conv.stagedForClient && (
            <p className="caption-3 mb-2 flex items-center gap-1.5 text-[#059669]">
              <Send className="h-3.5 w-3.5" /> Staged for executive approval and send
              <button
                type="button"
                className="button-xsm ml-auto text-[#73706D] hover:text-[#171717]"
                onClick={() => patch({ stagedForClient: false }, 'Unstaged')}
              >
                Unstage
              </button>
            </p>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder={lastIsInbound ? 'Write a reply, or click Draft with AI...' : 'Write a follow up, or click Draft with AI...'}
            className="body-6 w-full resize-y rounded-xl border border-[#D4D4D8] bg-white p-3 text-[#171717] outline-none focus:border-[#0070F3] focus:ring-2 focus:ring-[#0070F3]/20"
            aria-label="Reply draft"
          />
          {conv.responsibility === 'client_to_reply' && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional 1 line note for the client (for example: Counsel reviewed, ready to sign)"
              className="body-6 mt-2 h-9 w-full rounded-lg border border-[#D4D4D8] bg-white px-3 text-[#171717] outline-none focus:border-[#0070F3] focus:ring-2 focus:ring-[#0070F3]/20"
              aria-label="Note for client"
            />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={Sparkles}
              loading={busy === 'draft'}
              onClick={async () => {
                const r = await run(
                  'draft',
                  () => api.post(`/conversations/${id}/draft`, { tone, asClient: conv.responsibility === 'client_to_reply' }),
                  'Draft generated'
                );
                if (r?.draft) setDraft(r.draft);
              }}
            >
              Draft with AI
            </Button>
            <select
              aria-label="Draft tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="caption-3 h-8 rounded-lg border border-[#D4D4D8] bg-white px-2.5 text-[#4D4D4D] outline-none focus:border-[#0070F3]"
            >
              {TONES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {conv.responsibility === 'client_to_reply' && (
                <Button
                  size="sm"
                  variant="amber"
                  icon={Eye}
                  loading={busy === 'stage'}
                  onClick={() =>
                    run(
                      'stage',
                      () => api.patch(`/conversations/${id}`, { draftBody: draft, tone, paContextNote: note, stagedForClient: true }),
                      'Staged in client queue'
                    )
                  }
                >
                  Stage for client
                </Button>
              )}
              <Button
                size="sm"
                variant="cobalt"
                icon={Send}
                disabled={!draft.trim()}
                loading={busy === 'send'}
                onClick={async () => {
                  const r = await run('send', () => api.post(`/conversations/${id}/reply`, { body: draft }), 'Reply sent');
                  if (r) setDraft('');
                }}
              >
                {conv.responsibility === 'client_to_reply' ? 'Send on client behalf' : 'Approve and send'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
