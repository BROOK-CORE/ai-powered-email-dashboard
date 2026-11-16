import { Clock, Send, Star, UserCheck } from 'lucide-react';
import { Avatar, Button, EmptyState, ErrorState, ListSkeleton, ProviderMark, RespBadge, ReviewFlag, cx, timeAgo } from './ui.jsx';

function Row({ c, selected, onSelect }) {
  const sender = c.participants?.find((p) => p.email !== undefined)?.name || c.clientName;
  const inbound = (c.participants || []).filter((p) => !/\(for /.test(p.name || ''));
  const who = inbound[0]?.name || sender;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(c.id)}
        aria-current={selected}
        className={cx(
          'motion-transition group relative flex w-full gap-3 rounded-xl border p-3.5 text-left',
          selected
            ? 'border-[#0070F3] bg-[#EBF5FF]/45'
            : 'border-[#EBEBEB] bg-white hover:border-[#D4D4D8]'
        )}
      >
        <Avatar
          name={who}
          tone={c.responsibility === 'client_to_reply' ? 'amber' : c.responsibility === 'no_reply_needed' ? 'slate' : 'cobalt'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {c.isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#0070F3]" aria-label="Unread" />}
            <span className={cx('truncate', c.isUnread ? 'body-4 text-[#171717]' : 'body-5 text-[#4D4D4D]')}>{who}</span>
            <ProviderMark provider={c.provider} />
            <span className="caption-4 font-mono ml-auto shrink-0 text-[#73706D]">{timeAgo(c.lastMessageAt)}</span>
          </div>
          <p className={cx('mt-0.5 truncate', c.isUnread ? 'body-4 text-[#171717]' : 'body-6 text-[#4D4D4D]')}>{c.subject}</p>
          <p className="caption-2 mt-0.5 line-clamp-1 text-[#73706D]">{c.oneLineTakeaway || c.snippet}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <RespBadge value={c.responsibility} compact />
            {c.needsReview && <ReviewFlag />}
            {c.isImportant && <Star className="h-3.5 w-3.5 fill-[#D97706] text-[#D97706]" aria-label="Important" />}
            {c.status === 'waiting_response' && (
              <span className="caption-3 inline-flex items-center gap-1 rounded-full border border-[#BAE6FD] bg-[#F0F9FF] px-2 py-0.5 text-[#0369A1]">
                <Clock className="h-3 w-3" /> Waiting
              </span>
            )}
            {c.stagedForClient && (
              <span className="caption-3 inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[#059669]">
                <Send className="h-3 w-3" /> Staged for client
              </span>
            )}
            {c.manualOverride && (
              <span className="caption-4 inline-flex items-center gap-1 text-[#73706D]" title="Classification changed manually">
                <UserCheck className="h-3 w-3" /> manual
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

export default function ThreadList({ items, loading, error, onRetry, selectedId, onSelect, hasFilters, onClear, onConnect, onSimulate }) {
  if (loading && !items.length) return <ListSkeleton />;
  if (error && !items.length) return <ErrorState message={error} onRetry={onRetry} />;
  if (!items.length)
    return hasFilters ? (
      <EmptyState
        title="No conversations match"
        text="Try a different segment or clear your search filter."
        action={
          <button type="button" onClick={onClear} className="button-sm text-[#0070F3] hover:underline">
            Clear filters
          </button>
        }
      />
    ) : (
      <EmptyState
        title="No messages yet"
        text="Your inbox is clear. Simulate an incoming email to send the first message, or connect a new mailbox."
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onSimulate && (
              <Button variant="primary" size="sm" onClick={onSimulate}>
                Simulate first message
              </Button>
            )}
            {onConnect && (
              <button type="button" onClick={onConnect} className="button-sm text-[#0070F3] hover:underline">
                Connect an inbox
              </button>
            )}
          </div>
        }
      />
    );
  return (
    <ul className="space-y-2 p-3">
      {items.map((c) => (
        <Row key={c.id} c={c} selected={c.id === selectedId} onSelect={onSelect} />
      ))}
    </ul>
  );
}
