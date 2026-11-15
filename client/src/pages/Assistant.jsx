import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, Bell, CalendarClock, CheckCircle2, ChevronDown, Clock, Eye, HelpCircle, Inbox, LayoutGrid, LogOut, Mail, Menu, Plus, Search,
  Settings2, Sparkles, Star, Trash2, UserCog, X, Zap, MailOpen, CalendarDays, Layers, Users,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import ConnectWizard from '../components/ConnectWizard.jsx';
import CopilotDrawer from '../components/CopilotDrawer.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import SimulateModal from '../components/SimulateModal.jsx';
import ThreadDetail from '../components/ThreadDetail.jsx';
import ThreadList from '../components/ThreadList.jsx';
import { Avatar, Button, Logo, Modal, ProviderMark, cx, timeAgo, useToast } from '../components/ui.jsx';

const NAV = [
  { group: null, items: [
    { id: 'all', label: 'All active', icon: Inbox, stat: 'total' },
    { id: 'unread', label: 'Unread', icon: MailOpen, stat: 'unread' },
  ] },
  { group: 'Who replies', items: [
    { id: 'assistant_to_reply', label: 'Assistant to reply', icon: UserCog, stat: 'assistantToReply', dot: 'bg-indigo-500' },
    { id: 'client_to_reply', label: 'Client to reply', icon: Eye, stat: 'clientToReply', dot: 'bg-amber-500' },
    { id: 'no_reply_needed', label: 'No reply needed', icon: CheckCircle2, stat: 'noReplyNeeded', dot: 'bg-slate-400' },
  ] },
  { group: 'Organise', items: [
    { id: 'action_required', label: 'Action required', icon: Zap, stat: 'actionRequired' },
    { id: 'waiting_response', label: 'Waiting for response', icon: Clock, stat: 'waitingResponse' },
    { id: 'meetings', label: 'Meetings & appointments', icon: CalendarDays },
    { id: 'important', label: 'Important', icon: Star, stat: 'important' },
    { id: 'general', label: 'General', icon: Layers },
    { id: 'needs_review', label: 'Needs review', icon: HelpCircle, stat: 'needsReview', alert: true },
  ] },
  { group: 'Done', items: [
    { id: 'completed', label: 'Completed', icon: CheckCircle2, stat: 'completed' },
    { id: 'archived', label: 'Archived', icon: Archive },
  ] },
];

const KPIS = [
  { id: 'all', label: 'Total', stat: 'total', tone: 'text-slate-900' },
  { id: 'unread', label: 'Unread', stat: 'unread', tone: 'text-indigo-600' },
  { id: 'important', label: 'Important', stat: 'important', tone: 'text-amber-600' },
  { id: 'action_required', label: 'Action required', stat: 'actionRequired', tone: 'text-rose-600' },
  { id: 'waiting_response', label: 'Waiting for response', stat: 'waitingResponse', tone: 'text-sky-600' },
  { id: 'assistant_to_reply', label: 'Assistant to reply', stat: 'assistantToReply', tone: 'text-indigo-600' },
  { id: 'client_to_reply', label: 'Client to reply', stat: 'clientToReply', tone: 'text-amber-600' },
];

const SEGMENT_LABEL = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])));

function Sidebar({ segment, setSegment, stats, accounts, accountId, setAccountId, onConnect, onNavigate, onSettings }) {
  return (
    <nav className="flex h-full flex-col overflow-y-auto" aria-label="Inbox segments">
      <div className="space-y-5 p-3">
        {NAV.map((g) => (
          <div key={g.group || 'top'}>
            {g.group && <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.group}</p>}
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const n = i.stat ? stats?.[i.stat] : null;
                const active = segment === i.id;
                return (
                  <li key={i.id}>
                    <button
                      onClick={() => { setSegment(i.id); onNavigate?.(); }}
                      aria-current={active ? 'page' : undefined}
                      className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition', active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')}
                    >
                      {i.dot ? <span className={cx('h-2 w-2 shrink-0 rounded-full', i.dot)} /> : <i.icon className="h-4 w-4 shrink-0" />}
                      <span className="flex-1 truncate text-left">{i.label}</span>
                      {n > 0 && <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', i.alert ? 'bg-rose-100 text-rose-700' : active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500')}>{n}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between px-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mailboxes</p>
          <button onClick={onSettings} className="text-[11px] font-semibold text-indigo-600 hover:underline">Manage</button>
        </div>
        <ul className="space-y-1">
          {accounts.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => { setAccountId(accountId === a.id ? '' : a.id); onNavigate?.(); }}
                className={cx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition', accountId === a.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-100')}
              >
                <ProviderMark provider={a.provider} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-700">{a.clientEmail}</span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span className={cx('h-1.5 w-1.5 rounded-full', a.status === 'connected' ? 'bg-emerald-500' : a.status === 'syncing' ? 'animate-pulse bg-amber-400' : 'bg-rose-500')} />
                    {a.status === 'connected' ? `Synced ${timeAgo(a.lastSyncedAt)}` : a.status}
                  </span>
                </span>
                {a.unreadCount > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">{a.unreadCount}</span>}
              </button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="sm" className="mt-2 w-full" icon={Plus} onClick={onConnect}>
          Connect inbox
        </Button>
      </div>
    </nav>
  );
}

function Overview({ stats, upcoming, onOpen, onSegment, onSimulate }) {
  const empty = stats?.total === 0;
  return (
    <div className="mx-auto max-w-xl animate-fade-up px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
          <Mail className="h-7 w-7" />
        </div>
        <h2 className="font-display text-xl font-extrabold text-slate-900">{empty ? 'Inbox is ready' : 'Select a conversation'}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {empty ? 'No messages yet — send your first incoming email to test live AI triage.' : 'Pick a thread to see AI insights, ownership and a draft reply.'}
        </p>
        {empty && onSimulate && (
          <Button variant="primary" size="md" className="mt-4" icon={Zap} onClick={onSimulate}>
            Send first message
          </Button>
        )}
      </div>

      {stats?.needsReview > 0 && (
        <button onClick={() => onSegment('needs_review')} className="mb-4 flex w-full items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-left transition hover:bg-rose-100/60">
          <HelpCircle className="h-5 w-5 shrink-0 text-rose-500" />
          <span className="flex-1 text-sm text-rose-800"><b>{stats.needsReview} conversation{stats.needsReview > 1 ? 's' : ''}</b> where AI wasn’t sure who should reply.</span>
          <span className="text-xs font-bold text-rose-700">Review →</span>
        </button>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <CalendarClock className="h-4 w-4 text-sky-500" /> Upcoming meetings & deadlines <span className="text-xs font-medium text-slate-400">found by AI</span>
        </h3>
        {upcoming?.length ? (
          <ul className="divide-y divide-slate-100">
            {upcoming.map((e, i) => (
              <li key={i}>
                <button onClick={() => onOpen(e.conversationId)} className="flex w-full items-center gap-3 py-2.5 text-left transition hover:opacity-80">
                  <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold', e.type === 'deadline' ? 'bg-rose-50 text-rose-600' : 'bg-sky-50 text-sky-600')}>
                    {e.type === 'deadline' ? '!' : <CalendarDays className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{e.label}</span>
                    <span className="block truncate text-xs text-slate-500">{e.dateText} · {e.clientName}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">No upcoming dates detected yet.</p>
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
        const [d, a] = await Promise.all([api.get(`/conversations?${qs}`), api.get('/accounts')]);
        setData(d);
        setAccounts(a.accounts);
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
    // A thread opened from a notification / AI answer may not be in the current segment.
    setSegment((s) => s);
    setSelectedId(id);
  }, []);

  const hasFilters = segment !== 'all' || Boolean(accountId) || Boolean(debounced);
  const selected = useMemo(() => data.items.find((i) => i.id === selectedId) || (selectedId ? { id: selectedId, subject: '' } : null), [data.items, selectedId]);
  const title = accountId ? accounts.find((a) => a.id === accountId)?.clientEmail : SEGMENT_LABEL[segment];

  const pickSegment = (s) => { setSegment(s); setSelectedId(null); };

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
      toast.push('All messages removed — send your first message');
    } catch (e) {
      toast.push(e.message, { type: 'error' });
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      {/* Top bar */}
      <header className="z-30 flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5 sm:gap-3 sm:px-4">
        <button onClick={() => setNavOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <Logo className="hidden sm:flex lg:w-56" />
        <div className="relative min-w-0 flex-1 sm:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sender, subject or message…"
            aria-label="Search conversations"
            className="h-10 w-full rounded-xl border border-transparent bg-slate-100 pl-9 pr-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button variant="secondary" size="sm" icon={Zap} className="hidden md:inline-flex" onClick={() => setSimulate(true)}>Simulate email</Button>
          <Button variant="primary" size="sm" icon={Sparkles} onClick={() => setCopilot({ open: true, pending: null })}>
            <span className="hidden sm:inline">Ask AI</span>
          </Button>
          <NotificationBell refreshKey={bellKey} onOpenThread={openThread} />
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-1.5 rounded-xl p-1 pr-2 transition hover:bg-slate-100" aria-label="Account menu" aria-expanded={menuOpen}>
              <Avatar name={user.name} size="sm" />
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>
            {menuOpen && (
              <div className="animate-pop absolute right-0 z-40 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.title}</p>
                </div>
                <div className="p-1.5 text-sm">
                  <button onClick={() => nav('/client')} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-800"><Eye className="h-4 w-4" /> Switch to Client view</button>
                  <button onClick={() => setSimulate(true)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-100 md:hidden"><Zap className="h-4 w-4" /> Simulate incoming email</button>
                  <button onClick={() => nav('/accounts')} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"><Settings2 className="h-4 w-4" /> Manage mailboxes</button>
                  <button onClick={clearInbox} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /> Clear all messages</button>
                  <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" /> Sign out</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
          <Sidebar segment={segment} setSegment={pickSegment} stats={data.stats} accounts={accounts} accountId={accountId} setAccountId={setAccountId} onConnect={() => setConnect(true)} onSettings={() => nav('/accounts')} />
        </aside>

        {/* Mobile nav drawer */}
        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setNavOpen(false)} />
            <aside className="animate-fade-up absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <Logo />
                <button onClick={() => setNavOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
              </div>
              <div className="h-[calc(100%-57px)]">
                <Sidebar segment={segment} setSegment={pickSegment} stats={data.stats} accounts={accounts} accountId={accountId} setAccountId={setAccountId} onConnect={() => { setNavOpen(false); setConnect(true); }} onSettings={() => nav('/accounts')} onNavigate={() => setNavOpen(false)} />
              </div>
            </aside>
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          {/* KPI strip */}
          <section aria-label="Inbox overview" className="shrink-0 border-b border-slate-200 bg-white">
            <div className="flex snap-x gap-2.5 overflow-x-auto px-3 py-3 sm:px-4 lg:grid lg:grid-cols-7">
              {KPIS.map((k) => {
                const active = segment === k.id && !accountId;
                return (
                  <button
                    key={k.id}
                    onClick={() => pickSegment(k.id)}
                    className={cx('min-w-[104px] shrink-0 snap-start rounded-xl border px-3.5 py-2.5 text-left transition lg:min-w-0', active ? 'border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm')}
                  >
                    <span className={cx('block font-display text-2xl font-extrabold tabular-nums', k.tone)}>{data.stats ? data.stats[k.stat] : <span className="skeleton inline-block h-6 w-8 align-middle" />}</span>
                    <span className="block truncate text-[11px] font-semibold text-slate-500">{k.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex min-h-0 flex-1">
            {/* List */}
            <section className="flex w-full min-w-0 flex-col border-r border-slate-200 bg-white lg:w-[400px] lg:shrink-0 xl:w-[440px]" aria-label="Conversations">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <h1 className="truncate text-sm font-bold text-slate-900">{title} <span className="font-medium text-slate-400">· {data.items.length}</span></h1>
                {hasFilters && (
                  <button onClick={() => { setSegment('all'); setAccountId(''); setSearch(''); }} className="text-xs font-semibold text-indigo-600 hover:underline">Reset</button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ThreadList
                  items={data.items}
                  loading={loading}
                  error={error}
                  onRetry={() => load()}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  hasFilters={hasFilters}
                  onClear={() => { setSegment('all'); setAccountId(''); setSearch(''); }}
                  onConnect={() => setConnect(true)}
                  onSimulate={() => setSimulate(true)}
                />
              </div>
            </section>

            {/* Detail */}
            <section className={cx('min-w-0 flex-1 bg-white', selectedId ? 'fixed inset-0 z-40 lg:static lg:z-auto' : 'hidden lg:block')} aria-label="Conversation detail">
              {selectedId ? (
                <ThreadDetail
                  key={selectedId}
                  id={selectedId}
                  onChanged={onChanged}
                  onClose={() => setSelectedId(null)}
                  onAsk={(question, id) => setCopilot({ open: true, pending: { question, id } })}
                />
              ) : (
                <div className="h-full overflow-y-auto bg-slate-50/60">
                  <Overview stats={data.stats} upcoming={data.upcoming} onOpen={openThread} onSegment={pickSegment} onSimulate={() => setSimulate(true)} />
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
        onDone={(c) => { setBellKey((k) => k + 1); load(true); setSelectedId(c.id); }}
      />
      <Modal open={connect} onClose={() => setConnect(false)} title="Add a mailbox">
        <ConnectWizard
          onCancel={() => setConnect(false)}
          onDone={() => { setConnect(false); load(); toast.push('Mailbox connected and synced'); }}
        />
      </Modal>
    </div>
  );
}
