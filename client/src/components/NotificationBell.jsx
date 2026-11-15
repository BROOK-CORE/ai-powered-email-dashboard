import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Eye, HelpCircle, Send, UserCheck } from 'lucide-react';
import { api } from '../api.js';
import { cx, timeAgo } from './ui.jsx';

const ICONS = { client_delegated: UserCheck, client_handled: CheckCheck, client_sent: Send, needs_review: HelpCircle, new_client_item: Eye, info: Bell };

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
      <button onClick={toggle} aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`} className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
        <Bell className="h-5 w-5" />
        {data.unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{data.unread}</span>}
      </button>
      {open && (
        <div className="animate-pop absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">Notifications</div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {data.items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">You’re all caught up.</li>}
            {data.items.map((n) => {
              const I = ICONS[n.type] || Bell;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      if (n.conversationId) onOpenThread(n.conversationId);
                    }}
                    className={cx('flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50', !n.read && 'bg-indigo-50/50')}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <I className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{n.title}</span>
                      <span className="block truncate text-xs text-slate-500">{n.body}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
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
