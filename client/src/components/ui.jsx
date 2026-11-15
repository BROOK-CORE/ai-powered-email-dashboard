import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, Inbox } from 'lucide-react';

/* ----------------------------- Helpers ------------------------------------------------- */

export const cx = (...a) => a.filter(Boolean).join(' ');

export function timeAgo(date) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const fmtDateTime = (date) =>
  new Date(date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const initials = (name = '') =>
  name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/* ----------------------------- Reply responsibility ------------------------------------ */

export const RESP = {
  assistant_to_reply: {
    label: 'Assistant to reply',
    short: 'Assistant',
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    dot: 'bg-indigo-500',
    bar: 'bg-indigo-500',
  },
  client_to_reply: {
    label: 'Client to reply',
    short: 'Client',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
  },
  no_reply_needed: {
    label: 'No reply needed',
    short: 'No reply',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
    bar: 'bg-slate-400',
  },
};

export function RespBadge({ value, compact = false, className = '' }) {
  const r = RESP[value] || RESP.no_reply_needed;
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', r.badge, className)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', r.dot)} />
      {compact ? r.short : r.label}
    </span>
  );
}

export function ReviewFlag({ className = '' }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200', className)}>
      <AlertTriangle className="h-3 w-3" /> Needs review
    </span>
  );
}

export function ProviderMark({ provider, size = 'sm' }) {
  const map = {
    gmail: { bg: 'bg-red-50 text-red-600 ring-red-100', t: 'G', name: 'Gmail' },
    outlook: { bg: 'bg-blue-50 text-blue-700 ring-blue-100', t: 'O', name: 'Outlook' },
    custom_api: { bg: 'bg-violet-50 text-violet-700 ring-violet-100', t: 'A', name: 'API' },
  };
  const p = map[provider] || map.gmail;
  return (
    <span
      title={p.name}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-md font-bold ring-1 ring-inset', p.bg, size === 'sm' ? 'h-5 w-5 text-[10px]' : 'h-9 w-9 text-sm')}
    >
      {p.t}
    </span>
  );
}

export function Avatar({ name, size = 'md', tone = 'indigo' }) {
  const tones = { indigo: 'bg-indigo-100 text-indigo-700', amber: 'bg-amber-100 text-amber-800', slate: 'bg-slate-200 text-slate-700' };
  const sizes = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' };
  return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-bold', tones[tone], sizes[size])}>{initials(name)}</span>;
}

/* ----------------------------- Buttons & states ---------------------------------------- */

const BTN = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 disabled:bg-indigo-300',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 disabled:bg-emerald-300',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  amber: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20 disabled:bg-amber-300',
};

export function Button({ variant = 'secondary', size = 'md', loading = false, icon: Icon, className = '', children, ...rest }) {
  const sizes = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' };
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx('inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed', BTN[variant], sizes[size], className)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={cx('animate-spin text-indigo-600', className)} />;
}

export function EmptyState({ icon: Icon = Inbox, title, text, action, className = '' }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-up', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {text && <p className="mt-1 max-w-xs text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h3 className="text-base font-bold text-slate-800">Something went wrong</h3>
      <p className="mt-1 max-w-xs text-sm text-slate-500">{message}</p>
      {onRetry && (
        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4 py-4">
          <div className="skeleton h-9 w-9 shrink-0 !rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-2/5" />
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Overlays ------------------------------------------------ */

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, subtitle, children, wide = false, footer }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('animate-pop relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-slide-in relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-white px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ----------------------------- Toasts (with optional Undo) ----------------------------- */

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message, opts = {}) => {
      const id = ++idRef.current;
      const duration = opts.duration ?? 4000;
      setToasts((t) => [...t.slice(-3), { id, message, type: opts.type || 'success', action: opts.action, duration }]);
      setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={{ push, dismiss }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.type === 'error' ? AlertTriangle : t.type === 'info' ? Info : CheckCircle2;
          const color = t.type === 'error' ? 'text-rose-400' : t.type === 'info' ? 'text-sky-400' : 'text-emerald-400';
          return (
            <div key={t.id} className="animate-fade-up pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-xl bg-slate-900 text-white shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3">
                <Icon className={cx('h-5 w-5 shrink-0', color)} />
                <p className="flex-1 text-sm font-medium">{t.message}</p>
                {t.action && (
                  <button
                    onClick={() => {
                      t.action.onClick();
                      dismiss(t.id);
                    }}
                    className="rounded-md px-2 py-1 text-sm font-bold text-indigo-300 hover:bg-white/10"
                  >
                    {t.action.label}
                  </button>
                )}
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {t.action && <div className="absolute bottom-0 left-0 h-0.5 bg-indigo-400" style={{ animation: `drain ${t.duration}ms linear forwards` }} />}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function Logo({ className = '' }) {
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">Inboxly</span>
    </div>
  );
}
