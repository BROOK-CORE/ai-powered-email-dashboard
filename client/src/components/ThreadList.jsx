import { Clock, Send, Star, UserCheck } from 'lucide-react';
import { Avatar, ErrorState, EmptyState, ListSkeleton, ProviderMark, RespBadge, ReviewFlag, cx, timeAgo } from './ui.jsx';

function Row({ c, selected, onSelect }) {
  const sender = c.participants?.find((p) => p.email !== undefined)?.name || c.clientName;
  const inbound = (c.participants || []).filter((p) => !/\(for /.test(p.name || ''));
  const who = inbound[0]?.name || sender;
  return (
    <li>
      <button
        onClick={() => onSelect(c.id)}
        aria-current={selected}
        className={cx(
          'group relative flex w-full gap-3 border-l-[3px] px-4 py-3.5 text-left transition',
          selected ? 'border-l-indigo-600 bg-indigo-50/60' : 'border-l-transparent hover:bg-slate-50',
          c.isUnread ? 'bg-white' : ''
        )}
      >
        <Avatar name={who} tone={c.responsibility === 'client_to_reply' ? 'amber' : c.responsibility === 'no_reply_needed' ? 'slate' : 'indigo'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {c.isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" aria-label="Unread" />}
            <span className={cx('truncate text-sm', c.isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700')}>{who}</span>
            <ProviderMark provider={c.provider} />
            <span className="ml-auto shrink-0 text-xs text-slate-400">{timeAgo(c.lastMessageAt)}</span>
          </div>
          <p className={cx('mt-0.5 truncate text-sm', c.isUnread ? 'font-semibold text-slate-800' : 'text-slate-600')}>{c.subject}</p>
          <p className="mt-0.5 line-clamp-1 text-[13px] text-slate-500">{c.oneLineTakeaway || c.snippet}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <RespBadge value={c.responsibility} compact />
            {c.needsReview && <ReviewFlag />}
            {c.isImportant && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Important" />}
            {c.status === 'waiting_response' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
                <Clock className="h-3 w-3" /> Waiting
              </span>
            )}
            {c.stagedForClient && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <Send className="h-3 w-3" /> Staged for client
              </span>
            )}
            {c.manualOverride && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400" title="Classification changed manually">
                <UserCheck className="h-3 w-3" /> manual
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

export default function ThreadList({ items, loading, error, onRetry, selectedId, onSelect, hasFilters, onClear, onConnect }) {
  if (loading && !items.length) return <ListSkeleton />;
  if (error && !items.length) return <ErrorState message={error} onRetry={onRetry} />;
  if (!items.length)
    return hasFilters ? (
      <EmptyState title="No conversations match" text="Try a different segment or clear your search." action={<button onClick={onClear} className="text-sm font-semibold text-indigo-600 hover:underline">Clear filters</button>} />
    ) : (
      <EmptyState title="Nothing here yet" text="Connect a mailbox or simulate an incoming email to see AI triage in action." action={onConnect && <button onClick={onConnect} className="text-sm font-semibold text-indigo-600 hover:underline">Connect an inbox</button>} />
    );
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((c) => (
        <Row key={c.id} c={c} selected={c.id === selectedId} onSelect={onSelect} />
      ))}
    </ul>
  );
}
