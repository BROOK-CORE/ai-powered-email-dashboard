import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  HelpCircle,
  Inbox,
  Layers,
  LogOut,
  Mail,
  MailOpen,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UserCog,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ThemeToggle } from '../theme.jsx';
import ConnectWizard from '../components/ConnectWizard.jsx';
import CopilotDrawer from '../components/CopilotDrawer.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import SimulateModal from '../components/SimulateModal.jsx';
import ThreadDetail from '../components/ThreadDetail.jsx';
import ThreadList from '../components/ThreadList.jsx';
import { Avatar, Button, Logo, Modal, ProviderMark, cx, timeAgo, useToast } from '../components/ui.jsx';

const NAV = [
  {
    group: 'Segment navigation',
    items: [
      { id: 'all', label: 'All active', icon: Inbox, stat: 'total' },
      { id: 'unread', label: 'Unread', icon: MailOpen, stat: 'unread' },
      { id: 'assistant_to_reply', label: 'Assistant to reply', icon: UserCog, stat: 'assistantToReply', dot: 'bg-[#0070F3]' },
      { id: 'client_to_reply', label: 'Client to reply', icon: Eye, stat: 'clientToReply', dot: 'bg-[#D97706]' },
      { id: 'no_reply_needed', label: 'No reply needed', icon: CheckCircle2, stat: 'noReplyNeeded', dot: 'bg-[#71717A]' },
      { id: 'needs_review', label: 'Needs review', icon: HelpCircle, stat: 'needsReview', alert: true },
    ],
  },
  {
    group: 'Organise',
    items: [
      { id: 'action_required', label: 'Action required', icon: Zap, stat: 'actionRequired' },
      { id: 'waiting_response', label: 'Waiting for response', icon: Clock, stat: 'waitingResponse' },
      { id: 'meetings', label: 'Meetings and dates', icon: CalendarDays },
      { id: 'important', label: 'Important', icon: Star, stat: 'important' },
      { id: 'general', label: 'General', icon: Layers },
    ],
  },
  {
    group: 'Archive',
    items: [
      { id: 'completed', label: 'Completed', icon: CheckCircle2, stat: 'completed' },
      { id: 'archived', label: 'Archived', icon: Archive },
    ],
  },
];

const KPIS = [
  { id: 'all', label: 'Total', stat: 'total', tone: 'text-[#171717]' },
  { id: 'unread', label: 'Unread', stat: 'unread', tone: 'text-[#0070F3]' },
  { id: 'important', label: 'Important', stat: 'important', tone: 'text-[#D97706]' },
  { id: 'action_required', label: 'Action required', stat: 'actionRequired', tone: 'text-[#DC2626]' },
  { id: 'waiting_response', label: 'Waiting for response', stat: 'waitingResponse', tone: 'text-[#0284C7]' },
  { id: 'assistant_to_reply', label: 'Assistant to reply', stat: 'assistantToReply', tone: 'text-[#0070F3]' },
  { id: 'client_to_reply', label: 'Client to reply', stat: 'clientToReply', tone: 'text-[#D97706]' },
];

const SEGMENT_LABEL = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])));

function Sidebar({
  user,
  segment,
  setSegment,
  stats,
  accounts,
  accountId,
  setAccountId,
  onConnect,
  onNavigate,
  onSettings,
  onClientView,
  customCategories = [],
}) {
  return (
    <nav className="flex h-full flex-col overflow-y-auto bg-[#FAFAFA]" aria-label="Inbox segments">
      {/* Connected Mailboxes at top of sidebar (matching reference image 2) */}
      <div className="border-b border-[#EBEBEB] p-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="caption-3 uppercase tracking-wider text-[#73706D]">Connected Mailboxes</p>
          <button type="button" onClick={onSettings} className="button-xsm text-[#0070F3] hover:underline">
            Manage
          </button>
        </div>
        <ul className="space-y-1">
          {accounts.map((a) => {
            const active = accountId === a.id;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setAccountId(active ? '' : a.id);
                    onNavigate?.();
                  }}
                  className={cx(
                    'motion-transition flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left',
                    active ? 'border-[#0070F3] bg-[#EBF5FF]/50' : 'border-transparent hover:border-[#EBEBEB] hover:bg-white'
                  )}
                >
                  <ProviderMark provider={a.provider} />
                  <span className="min-w-0 flex-1">
                    <span className="caption-3 block truncate text-[#171717]">{a.clientEmail}</span>
                    <span className="caption-5 flex items-center gap-1.5 text-[#73706D]">
                      <span
                        className={cx(
                          'h-1.5 w-1.5 rounded-full',
                          a.status === 'connected' ? 'bg-[#059669]' : a.status === 'syncing' ? 'animate-pulse bg-[#D97706]' : 'bg-[#DC2626]'
                        )}
                      />
                      {a.status === 'connected' ? `Synced ${timeAgo(a.lastSyncedAt)}` : a.status}
                    </span>
                  </span>
                  {a.unreadCount > 0 && (
                    <span className="caption-3 font-mono rounded-full bg-[#0070F3] px-1.5 py-0.5 text-white">{a.unreadCount}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <Button variant="secondary" size="sm" className="mt-2 w-full" icon={Plus} onClick={onConnect}>
          Connect inbox
        </Button>
      </div>

      {/* Segment Navigation */}
      <div className="space-y-5 p-3">
        {NAV.map((g) => (
          <div key={g.group}>
            <p className="caption-3 mb-1.5 px-2 uppercase tracking-wider text-[#73706D]">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const n = i.stat ? stats?.[i.stat] : null;
                const active = segment === i.id && !accountId;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSegment(i.id);
                        onNavigate?.();
                      }}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'motion-transition flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left title-4',
                        active
                          ? 'border-[#BFDBFE] bg-[#EBF5FF] text-[#0070F3]'
                          : 'border-transparent text-[#4D4D4D] hover:bg-white hover:text-[#171717]'
                      )}
                    >
                      {i.dot ? <span className={cx('h-2 w-2 shrink-0 rounded-full', i.dot)} /> : <i.icon className="h-4 w-4 shrink-0" />}
                      <span className="flex-1 truncate">{i.label}</span>
                      {n > 0 && (
                        <span
                          className={cx(
                            'caption-3 font-mono rounded-full px-2 py-0.5 tabular-nums',
                            i.alert
                              ? 'bg-[#FEF2F2] text-[#DC2626]'
                              : active
                                ? 'bg-[#0070F3] text-white'
                                : 'bg-[#EBEBEB] text-[#4D4D4D]'
                          )}
                        >
                          {n}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {customCategories.length > 0 && (
          <div>
            <p className="caption-3 mb-1.5 px-2 uppercase tracking-wider text-[#73706D]">Client Categories</p>
            <ul className="space-y-0.5">
              {customCategories.map((cat) => {
                const active = segment === cat.slug && !accountId;
                return (
                  <li key={cat.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        setSegment(cat.slug);
                        onNavigate?.();
                      }}
                      className={cx(
                        'motion-transition flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left title-4',
                        active
                          ? 'border-[#BFDBFE] bg-[#EBF5FF] text-[#0070F3]'
                          : 'border-transparent text-[#4D4D4D] hover:bg-white hover:text-[#171717]'
                      )}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cat.color || '#0070F3' }} />
                      <span className="flex-1 truncate">{cat.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom Assistant Profile Card (matching reference image 2) */}
      <div className="mt-auto border-t border-[#EBEBEB] p-3">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#EBEBEB] bg-white p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={user?.name} size="sm" tone="dark" />
            <div className="min-w-0">
              <p className="caption-3 truncate text-[#171717]">{user?.name}</p>
              <p className="caption-5 truncate text-[#73706D]">{user?.title || 'Executive Assistant'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClientView}
            title="Switch to executive client portal"
            className="button-xsm motion-transition rounded-md border border-[#EBEBEB] bg-[#FAFAFA] px-2 py-1 text-[#171717] hover:border-[#D4D4D8]"
          >
            Client view
          </button>
        </div>
      </div>
    </nav>
  );
}

function Overview({ stats, upcoming, onOpen, onSegment, onSimulate }) {
  const empty = stats?.total === 0;
  return (
    <div className="mx-auto max-w-xl animate-fade-up px-6 py-12">
      <div className="mb-8 rounded-2xl border border-[#EBEBEB] bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EBF5FF] text-[#0070F3]">
          <Mail className="h-6 w-6" />
        </div>
        <h2 className="heading-5 text-[#171717]">{empty ? 'Inbox is ready' : 'Select a conversation'}</h2>
        <p className="body-6 mt-1.5 text-[#73706D]">
          {empty
            ? 'No messages yet. Send your first incoming email to test live AI triage.'
            : 'Choose a conversation from the queue to inspect AI ownership, confidence, and draft replies.'}
        </p>
        {empty && onSimulate && (
          <Button variant="primary" size="md" className="mt-4" icon={Zap} onClick={onSimulate}>
            Send first message
          </Button>
        )}
      </div>

      {stats?.needsReview > 0 && (
        <button
          type="button"
          onClick={() => onSegment('needs_review')}
          className="card-lift mb-4 flex w-full items-center gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-left"
        >
          <HelpCircle className="h-5 w-5 shrink-0 text-[#DC2626]" />
          <span className="body-5 flex-1 text-[#991B1B]">
            <b>
              {stats.needsReview} conversation{stats.needsReview > 1 ? 's' : ''}
            </b>{' '}
            need your ownership decision.
          </span>
          <span className="button-xsm text-[#DC2626]">Review</span>
        </button>
      )}

      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5">
        <h3 className="title-4 mb-3 flex items-center justify-between text-[#171717]">
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#0070F3]" /> Upcoming meetings and deadlines
          </span>
          <span className="caption-4 font-mono text-[#73706D]">EXTRACTED BY AI</span>
        </h3>
        {upcoming?.length ? (
          <ul className="space-y-2">
            {upcoming.map((e, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onOpen(e.conversationId)}
                  className="motion-transition flex w-full items-center gap-3 rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] p-3 text-left hover:border-[#0070F3]"
                >
                  <span
                    className={cx(
                      'caption-3 font-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                      e.type === 'deadline'
                        ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
                        : 'border-[#BFDBFE] bg-[#EBF5FF] text-[#0070F3]'
                    )}
                  >
                    {e.type === 'deadline' ? '!' : <CalendarDays className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="body-4 block truncate text-[#171717]">{e.label}</span>
                    <span className="caption-4 block truncate text-[#73706D]">
                      {e.dateText} · {e.clientName}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="body-6 py-4 text-center text-[#73706D]">No upcoming dates detected yet.</p>
        )}
      </section>
    </div>
  );
}

export default function Assistant() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();

  const [segment, setSegment] = useState('all');
  const [accountId, setAccountId] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [data, setData] = useState({ items: [], stats: null, upcoming: [] });
  const [accounts, setAccounts] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copilot, setCopilot] = useState({ open: false, pending: null });
  const [simulate, setSimulate] = useState(false);
  const [connect, setConnect] = useState(false);
  const [bellKey, setBellKey] = useState(0);
  const menuRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const qs = new URLSearchParams({ segment });
        if (accountId) qs.set('accountId', accountId);
        if (debounced.trim()) qs.set('search', debounced.trim());
        const [d, a, cats] = await Promise.all([
          api.get(`/conversations?${qs}`),
          api.get('/accounts'),
          api.get('/rules/categories').catch(() => ({ categories: [] })),
        ]);
        setData(d);
        setAccounts(a.accounts);
        setCustomCategories(cats?.categories || []);
        setError('');
      } catch (e) {
        if (!silent) setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [segment, accountId, debounced]
  );

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => loadRef.current(true), 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const h = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const onChanged = useCallback((c) => {
    setData((d) => ({ ...d, items: d.items.map((i) => (i.id === c.id ? { ...i, ...c, messages: undefined } : i)) }));
    loadRef.current(true);
    setBellKey((k) => k + 1);
  }, []);

  const openThread = useCallback(async (id) => {
    setSegment((s) => s);
    setSelectedId(id);
  }, []);

  const hasFilters = segment !== 'all' || Boolean(accountId) || Boolean(debounced);
  const selected = useMemo(
    () => data.items.find((i) => i.id === selectedId) || (selectedId ? { id: selectedId, subject: '' } : null),
    [data.items, selectedId]
  );
  const title = accountId
    ? accounts.find((a) => a.id === accountId)?.clientEmail
    : SEGMENT_LABEL[segment] || customCategories.find((c) => c.slug === segment)?.name || segment;

  const pickSegment = (s) => {
    setSegment(s);
    setSelectedId(null);
  };

  const clearInbox = async () => {
    setMenuOpen(false);
    try {
      await api.del('/conversations');
      setSelectedId(null);
      setSegment('all');
      setAccountId('');
      setSearch('');
      setBellKey((k) => k + 1);
      await load();
      toast.push('All messages removed. Ready for your first message.');
    } catch (e) {
      toast.push(e.message, { type: 'error' });
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-[#FAFAFA]">
      {/* Top Command Header */}
      <header className="z-30 flex shrink-0 items-center gap-3 border-b border-[#EBEBEB] bg-white px-4 py-2.5">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="rounded-lg p-2 text-[#4D4D4D] hover:bg-[#F4F4F5] lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden items-center gap-3 sm:flex lg:w-60">
          <Logo />
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#73706D]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sender, subject, or message..."
            aria-label="Search conversations"
            className="motion-transition body-5 h-9 w-full rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] pl-9 pr-9 text-[#171717] outline-none placeholder:text-[#73706D] focus:border-[#0070F3] focus:bg-white focus:ring-2 focus:ring-[#0070F3]/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#73706D] hover:text-[#171717]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={Zap} className="hidden md:inline-flex" onClick={() => setSimulate(true)}>
            Simulate email
          </Button>
          <Button variant="primary" size="sm" icon={Sparkles} onClick={() => setCopilot({ open: true, pending: null })}>
            <span className="hidden sm:inline">Ask AI</span>
          </Button>
          <NotificationBell refreshKey={bellKey} onOpenThread={openThread} />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => nav('/settings')}
            title="Settings & Admin"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#EBEBEB] bg-white text-[#73706D] hover:bg-[#FAFAFA] hover:text-[#171717]"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="motion-transition flex items-center gap-1.5 rounded-lg border border-[#EBEBEB] bg-white p-1 pr-2 hover:bg-[#FAFAFA]"
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              <Avatar name={user.name} size="sm" tone="dark" />
              <ChevronDown className="hidden h-4 w-4 text-[#73706D] sm:block" />
            </button>
            {menuOpen && (
              <div className="animate-pop absolute right-0 z-40 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white shadow-xl">
                <div className="border-b border-[#EBEBEB] px-4 py-3">
                  <p className="body-4 text-[#171717]">{user.name}</p>
                  <p className="caption-4 text-[#73706D]">{user.title}</p>
                </div>
                <div className="p-2 body-5">
                  <button
                    type="button"
                    onClick={() => nav('/settings')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[#171717] hover:bg-[#F4F4F5]"
                  >
                    <Settings2 className="h-4 w-4" /> Settings & Customization
                  </button>
                  <button
                    type="button"
                    onClick={() => nav('/client')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[#171717] hover:bg-[#FEF3C7]/60"
                  >
                    <Eye className="h-4 w-4 text-[#D97706]" /> Switch to Client view
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulate(true)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[#171717] hover:bg-[#F4F4F5] md:hidden"
                  >
                    <Zap className="h-4 w-4" /> Simulate incoming email
                  </button>
                  <button
                    type="button"
                    onClick={() => nav('/accounts')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[#171717] hover:bg-[#F4F4F5]"
                  >
                    <Settings2 className="h-4 w-4" /> Manage mailboxes
                  </button>
                  <button
                    type="button"
                    onClick={clearInbox}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[#DC2626] hover:bg-[#FEF2F2]"
                  >
                    <Trash2 className="h-4 w-4" /> Clear all messages
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[#DC2626] hover:bg-[#FEF2F2]"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-[#EBEBEB] bg-[#FAFAFA] lg:block">
          <Sidebar
            user={user}
            segment={segment}
            setSegment={pickSegment}
            stats={data.stats}
            accounts={accounts}
            accountId={accountId}
            setAccountId={setAccountId}
            onConnect={() => setConnect(true)}
            onSettings={() => nav('/settings')}
            onClientView={() => nav('/client')}
            customCategories={customCategories}
          />
        </aside>

        {/* Mobile nav drawer */}
        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-[#171717]/40" onClick={() => setNavOpen(false)} />
            <aside className="animate-fade-up absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-[#EBEBEB] bg-[#FAFAFA] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#EBEBEB] bg-white px-4 py-3">
                <Logo />
                <button
                  type="button"
                  onClick={() => setNavOpen(false)}
                  aria-label="Close menu"
                  className="rounded-lg p-1.5 text-[#73706D] hover:bg-[#F4F4F5]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="h-[calc(100%-57px)]">
                <Sidebar
                  user={user}
                  segment={segment}
                  setSegment={pickSegment}
                  stats={data.stats}
                  accounts={accounts}
                  accountId={accountId}
                  setAccountId={setAccountId}
                  onConnect={() => {
                    setNavOpen(false);
                    setConnect(true);
                  }}
                  onSettings={() => nav('/settings')}
                  onClientView={() => nav('/client')}
                  onNavigate={() => setNavOpen(false)}
                  customCategories={customCategories}
                />
              </div>
            </aside>
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          {/* Verification Status Banner for Assistant */}
          {user?.verificationStatus === 'pending' && (
            <div className="flex items-center justify-between gap-3 border-b border-[#FEF08A] bg-[#FEFCE8] px-4 py-2 text-xs text-[#854D0E]">
              <div className="flex items-center gap-2 truncate">
                <Clock className="h-4 w-4 shrink-0 text-[#CA8A04]" />
                <span>
                  Company verification pending for <b>{user.companyEmail || user.companyName}</b> (Emp ID: <b>{user.employeeId || 'N/A'}</b>).
                </span>
              </div>
              <button
                type="button"
                onClick={() => nav('/settings')}
                className="font-medium underline hover:text-[#713F12]"
              >
                Verification details &rarr;
              </button>
            </div>
          )}
          {user?.verificationStatus === 'unverified' && (
            <div className="flex items-center justify-between gap-3 border-b border-[#E0E7FF] bg-[#EEF2FF] px-4 py-2 text-xs text-[#3730A3]">
              <div className="flex items-center gap-2 truncate">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#4F46E5]" />
                <span>Verify your assistant company credentials to unlock enterprise authentication & badges.</span>
              </div>
              <button
                type="button"
                onClick={() => nav('/settings')}
                className="font-medium underline hover:text-[#312E81]"
              >
                Verify now &rarr;
              </button>
            </div>
          )}
          {/* 7-Card Geist Mono KPI Strip (matching reference image 2) */}
          <section aria-label="Inbox overview" className="shrink-0 border-b border-[#EBEBEB] bg-white">
            <div className="flex snap-x gap-2.5 overflow-x-auto px-4 py-3 lg:grid lg:grid-cols-7">
              {KPIS.map((k) => {
                const active = segment === k.id && !accountId;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => pickSegment(k.id)}
                    className={cx(
                      'card-lift min-w-[108px] shrink-0 snap-start rounded-xl border px-3.5 py-2.5 text-left lg:min-w-0',
                      active
                        ? 'border-[#0070F3] bg-[#EBF5FF]/45'
                        : 'border-[#EBEBEB] bg-white hover:border-[#D4D4D8]'
                    )}
                  >
                    <span className="caption-4 block truncate text-[#73706D]">{k.label}</span>
                    <span className={cx('heading-5 font-mono mt-0.5 block tabular-nums', k.tone)}>
                      {data.stats ? data.stats[k.stat] : <span className="skeleton inline-block h-6 w-8 align-middle" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex min-h-0 flex-1">
            {/* Center Thread List */}
            <section
              className="flex w-full min-w-0 flex-col border-r border-[#EBEBEB] bg-white lg:w-[410px] lg:shrink-0 xl:w-[450px]"
              aria-label="Conversations"
            >
              <div className="flex items-center justify-between border-b border-[#EBEBEB] px-4 py-2.5">
                <h1 className="body-4 truncate text-[#171717]">
                  {title} <span className="font-mono text-[#73706D]">· {data.items.length}</span>
                </h1>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSegment('all');
                      setAccountId('');
                      setSearch('');
                    }}
                    className="button-xsm text-[#0070F3] hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-[#FAFAFA]">
                <ThreadList
                  items={data.items}
                  loading={loading}
                  error={error}
                  onRetry={() => load()}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  hasFilters={hasFilters}
                  onClear={() => {
                    setSegment('all');
                    setAccountId('');
                    setSearch('');
                  }}
                  onConnect={() => setConnect(true)}
                  onSimulate={() => setSimulate(true)}
                />
              </div>
            </section>

            {/* Right Detail Pane */}
            <section
              className={cx('min-w-0 flex-1 bg-white', selectedId ? 'fixed inset-0 z-40 lg:static lg:z-auto' : 'hidden lg:block')}
              aria-label="Conversation detail"
            >
              {selectedId ? (
                <ThreadDetail
                  key={selectedId}
                  id={selectedId}
                  onChanged={onChanged}
                  onClose={() => setSelectedId(null)}
                  onAsk={(question, id) => setCopilot({ open: true, pending: { question, id } })}
                />
              ) : (
                <div className="h-full overflow-y-auto bg-[#FAFAFA]">
                  <Overview
                    stats={data.stats}
                    upcoming={data.upcoming}
                    onOpen={openThread}
                    onSegment={pickSegment}
                    onSimulate={() => setSimulate(true)}
                  />
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      <CopilotDrawer
        open={copilot.open}
        pending={copilot.pending}
        clearPending={() => setCopilot((c) => ({ ...c, pending: null }))}
        onClose={() => setCopilot({ open: false, pending: null })}
        onOpenThread={openThread}
        focusId={selectedId}
      />
      <SimulateModal
        open={simulate}
        onClose={() => setSimulate(false)}
        accounts={accounts}
        selected={selected && selected.subject ? selected : null}
        onDone={(c) => {
          setBellKey((k) => k + 1);
          load(true);
          setSelectedId(c.id);
        }}
      />
      <Modal open={connect} onClose={() => setConnect(false)} title="Add a mailbox">
        <ConnectWizard
          onCancel={() => setConnect(false)}
          onDone={(acc) => {
            setConnect(false);
            if (acc?.id) setAccountId(acc.id);
            toast.push('Mailbox connected and opened');
          }}
        />
      </Modal>
    </div>
  );
}
