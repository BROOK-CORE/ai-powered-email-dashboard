import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Inbox, Info, Loader2, X } from 'lucide-react';

/* ----------------------------- Helpers ------------------------------------------------- */

export const cx = (...a) => a.filter(Boolean).join(' ');

const PCT_WIDTH = [
  'w-0', 'w-[5%]', 'w-[10%]', 'w-[15%]', 'w-[20%]', 'w-[25%]', 'w-[30%]',
  'w-[35%]', 'w-[40%]', 'w-[45%]', 'w-[50%]', 'w-[55%]', 'w-[60%]', 'w-[65%]',
  'w-[70%]', 'w-[75%]', 'w-[80%]', 'w-[85%]', 'w-[90%]', 'w-[95%]', 'w-full',
];

export const pctWidthClass = (pct) => PCT_WIDTH[Math.max(0, Math.min(20, Math.round(Number(pct || 0) / 5)))];

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

/* ----------------------------- Reply responsibility (Zero Violet) ---------------------- */

export const RESP = {
  assistant_to_reply: {
    label: 'Assistant to reply',
    short: 'Assistant',
    badge: 'bg-[#EBF5FF] text-[#0070F3] border border-[#BFDBFE]',
    dot: 'bg-[#0070F3]',
    bar: 'bg-[#0070F3]',
  },
  client_to_reply: {
    label: 'Client to reply',
    short: 'Client',
    badge: 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]',
    dot: 'bg-[#D97706]',
    bar: 'bg-[#D97706]',
  },
  no_reply_needed: {
    label: 'No reply needed',
    short: 'No reply',
    badge: 'bg-[#F4F4F5] text-[#52525B] border border-[#E4E4E7]',
    dot: 'bg-[#71717A]',
    bar: 'bg-[#71717A]',
  },
};

export function RespBadge({ value, compact = false, className = '' }) {
  const r = RESP[value] || RESP.no_reply_needed;
  return (
    <span className={cx('caption-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5', r.badge, className)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', r.dot)} />
      {compact ? r.short : r.label}
    </span>
  );
}

export function ReviewFlag({ className = '' }) {
  return (
    <span className={cx('caption-3 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-0.5 text-[#DC2626]', className)}>
      <AlertTriangle className="h-3 w-3" /> Needs review
    </span>
  );
}

/* Real Full-Color Brand SVG Icons (design-taste-frontend House Rule 7) */
export function ProviderMark({ provider, size = 'sm' }) {
  const dim = size === 'lg' ? 'h-9 w-9 p-1.5 rounded-lg' : 'h-5 w-5 p-0.5 rounded-md';
  if (provider === 'outlook') {
    return (
      <span title="Microsoft Outlook" className={cx('inline-flex shrink-0 items-center justify-center border border-[#EBEBEB] bg-white', dim)}>
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <rect x="6" y="3" width="16" height="18" rx="2" fill="#0078D4" />
          <path d="M6 8l8 5 8-5" fill="none" stroke="#50E6FF" strokeWidth="1.8" />
          <rect x="2" y="7" width="10" height="10" rx="2" fill="#0364B8" />
          <circle cx="7" cy="12" r="2.7" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
        </svg>
      </span>
    );
  }
  if (provider === 'custom_api') {
    return (
      <span title="IMAP / API Bridge" className={cx('inline-flex shrink-0 items-center justify-center border border-[#EBEBEB] bg-[#FAFAFA]', dim)}>
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" fill="#171717" />
          <path d="M8 9l3 3-3 3M13 15h3" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span title="Google Gmail" className={cx('inline-flex shrink-0 items-center justify-center border border-[#EBEBEB] bg-white', dim)}>
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
        <path d="M3 6.5V18a2 2 0 002 2h2V9.8l5 3.7 5-3.7V20h2a2 2 0 002-2V6.5a2 2 0 00-3.2-1.6L12 9.2 6.2 4.9A2 2 0 003 6.5z" fill="#EA4335" />
        <path d="M3 6.5V18a2 2 0 002 2h2V9.8L3 6.8V6.5z" fill="#4285F4" />
        <path d="M17 20h2a2 2 0 002-2V6.5l-4 3.3V20z" fill="#34A853" />
        <path d="M17 9.8V4.9l.8-.6A2 2 0 0121 6.5v.3l-4 3z" fill="#FBBC04" />
        <path d="M7 9.8V4.9L12 8.7l5-3.8v4.9l-5 3.7-5-3.7z" fill="#EA4335" />
      </svg>
    </span>
  );
}

export function Avatar({ name, size = 'md', tone = 'cobalt' }) {
  const tones = {
    cobalt: 'bg-[#EBF5FF] text-[#0070F3] border border-[#BFDBFE]',
    indigo: 'bg-[#EBF5FF] text-[#0070F3] border border-[#BFDBFE]',
    amber: 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]',
    slate: 'bg-[#F4F4F5] text-[#4D4D4D] border border-[#E4E4E7]',
    dark: 'bg-[#171717] text-white border border-[#171717]',
  };
  const sizes = {
    sm: 'h-7 w-7 caption-3',
    md: 'h-9 w-9 caption-3',
    lg: 'h-11 w-11 body-4',
  };
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full', tones[tone] || tones.cobalt, sizes[size])}>
      {initials(name)}
    </span>
  );
}

/* ----------------------------- Buttons & states (B2: 8px/12px main padding) ------------ */

const BTN = {
  primary: 'bg-[#171717] text-white border border-[#171717] hover:bg-[#000000] disabled:bg-[#A1A1AA] disabled:border-[#A1A1AA]',
  cobalt: 'bg-[#0070F3] text-white border border-[#0070F3] hover:bg-[#0761D1] disabled:bg-[#93C5FD] disabled:border-[#93C5FD]',
  secondary: 'bg-white text-[#171717] border border-[#D4D4D8] hover:bg-[#FAFAFA] hover:border-[#A1A1AA] disabled:text-[#A1A1AA]',
  ghost: 'bg-transparent text-[#4D4D4D] border border-transparent hover:bg-[#F4F4F5] hover:text-[#171717] disabled:text-[#A1A1AA]',
  success: 'bg-[#059669] text-white border border-[#059669] hover:bg-[#047857] disabled:bg-[#6EE7B7] disabled:border-[#6EE7B7]',
  danger: 'bg-[#DC2626] text-white border border-[#DC2626] hover:bg-[#B91C1C] disabled:bg-[#FCA5A5] disabled:border-[#FCA5A5]',
  amber: 'bg-[#D97706] text-white border border-[#D97706] hover:bg-[#B45309] disabled:bg-[#FCD34D] disabled:border-[#FCD34D]',
};

export function Button({ variant = 'secondary', size = 'md', loading = false, icon: Icon, className = '', children, ...rest }) {
  const sizes = {
    sm: 'py-1.5 px-3 button-xsm gap-1.5 rounded-lg',
    md: 'py-2 px-3 button-sm gap-2 rounded-lg',
    lg: 'py-3 px-6 button-md gap-2 rounded-xl',
  };
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'motion-transition inline-flex shrink-0 items-center justify-center whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070F3] focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        BTN[variant] || BTN.secondary,
        sizes[size] || sizes.md,
        className
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={cx('animate-spin text-[#0070F3]', className)} />;
}

export function EmptyState({ icon: Icon = Inbox, title, text, action, className = '' }) {
  return (
    <div className={cx('animate-fade-up flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] text-[#73706D]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="title-3 text-[#171717]">{title}</h3>
      {text && <p className="body-6 mt-1 max-w-xs text-[#73706D]">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="title-3 text-[#171717]">Unable to load view</h3>
      <p className="body-6 mt-1 max-w-xs text-[#73706D]">{message}</p>
      {onRetry && (
        <Button className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-xl border border-[#EBEBEB] bg-white p-4">
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
      <div className="absolute inset-0 bg-[#171717]/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cx(
          'animate-pop relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#EBEBEB] bg-white shadow-2xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#EBEBEB] px-6 py-4">
          <div className="min-w-0">
            <h2 className="title-2 truncate text-[#171717]">{title}</h2>
            {subtitle && <p className="body-6 mt-0.5 text-[#73706D]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="motion-transition rounded-lg p-1.5 text-[#73706D] hover:bg-[#F4F4F5] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070F3]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="border-t border-[#EBEBEB] bg-[#FAFAFA] px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[#171717]/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-slide-in relative flex h-full w-full max-w-md flex-col border-l border-[#EBEBEB] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#EBEBEB] px-6 py-4">
          <div>
            <h2 className="title-2 text-[#171717]">{title}</h2>
            {subtitle && <p className="body-6 mt-0.5 text-[#73706D]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="motion-transition rounded-lg p-1.5 text-[#73706D] hover:bg-[#F4F4F5] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070F3]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-[#EBEBEB] bg-white px-4 py-3">{footer}</div>}
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
          const color = t.type === 'error' ? 'text-[#F87171]' : t.type === 'info' ? 'text-[#38BDF8]' : 'text-[#34D399]';
          return (
            <div key={t.id} className="animate-fade-up pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-xl border border-[#272727] bg-[#171717] text-white shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3">
                <Icon className={cx('h-5 w-5 shrink-0', color)} />
                <p className="body-5 flex-1">{t.message}</p>
                {t.action && (
                  <button
                    onClick={() => {
                      t.action.onClick();
                      dismiss(t.id);
                    }}
                    className="button-sm rounded-md px-2 py-1 text-[#60A5FA] hover:bg-white/10"
                  >
                    {t.action.label}
                  </button>
                )}
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="text-[#9A9794] hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {t.action && <div className="animate-drain absolute bottom-0 left-0 h-0.5 w-full bg-[#0070F3]" />}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function Logo({ className = '' }) {
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <img src="/favicon.svg" alt="Inboxly logo" className="h-7 w-7 rounded-lg" />
      <span className="title-2 tracking-tight text-[#171717]">Inboxly</span>
    </div>
  );
}
