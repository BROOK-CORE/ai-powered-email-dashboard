import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Eye, HelpCircle, Send, UserCheck } from 'lucide-react';
import { api } from '../api.js';
import { cx, timeAgo } from './ui.jsx';

const ICONS = {
  client_delegated: UserCheck,
  client_handled: CheckCheck,
  client_sent: Send,
  needs_review: HelpCircle,
  new_client_item: Eye,
  info: Bell,
};

export default function NotificationBell({ onOpenThread, refreshKey }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const ref = useRef(null);

  const load = useCallback(() => api.get('/notifications').then(setData).catch(() => {}), []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, refreshKey]);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && data.unread) {
      await api.patch('/notifications/read-all').catch(() => {});
      setTimeout(load, 1200);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`}
        className="motion-transition relative rounded-lg border border-[#EBEBEB] bg-white p-2 text-[#4D4D4D] hover:bg-[#FAFAFA] hover:text-[#171717]"
      >
        <Bell className="h-4 w-4" />
        {data.unread > 0 && (
          <span className="caption-3 font-mono absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#DC2626] px-1 text-white">
            {data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="animate-pop absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white shadow-xl">
          <div className="border-b border-[#EBEBEB] px-4 py-3 title-4 text-[#171717]">Notifications</div>
          <ul className="max-h-96 divide-y divide-[#EBEBEB] overflow-y-auto">
            {data.items.length === 0 && <li className="body-6 px-4 py-8 text-center text-[#73706D]">You are all caught up.</li>}
            {data.items.map((n) => {
              const I = ICONS[n.type] || Bell;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (n.conversationId) onOpenThread(n.conversationId);
                    }}
                    className={cx('motion-transition flex w-full gap-3 px-4 py-3 text-left hover:bg-[#FAFAFA]', !n.read && 'bg-[#EBF5FF]/40')}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] text-[#4D4D4D]">
                      <I className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="body-4 block text-[#171717]">{n.title}</span>
                      <span className="caption-4 block truncate text-[#4D4D4D]">{n.body}</span>
                      <span className="caption-5 font-mono mt-0.5 block text-[#73706D]">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
