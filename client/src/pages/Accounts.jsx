import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Plug, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import ConnectWizard from '../components/ConnectWizard.jsx';
import { Button, EmptyState, ErrorState, Logo, Modal, ProviderMark, cx, timeAgo, useToast } from '../components/ui.jsx';

const STATUS = {
  connected: { label: 'Connected', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  syncing: { label: 'Syncing…', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'animate-pulse bg-amber-500' },
  attention_needed: { label: 'Needs attention', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
  disconnected: { label: 'Disconnected', cls: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
};

export default function Accounts() {
  const nav = useNavigate();
  const toast = useToast();
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');
  const [connect, setConnect] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setAccounts((await api.get('/accounts')).accounts);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async (a) => {
    setBusy(a.id);
    try {
      await api.post(`/accounts/${a.id}/sync`);
      toast.push(`${a.clientEmail} is up to date`);
      await load();
    } catch (e) {
      toast.push(e.message, { type: 'error' });
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    const a = confirm;
    setBusy(a.id);
    try {
      await api.del(`/accounts/${a.id}`);
      toast.push('Mailbox disconnected');
      setConfirm(null);
      await load();
    } catch (e) {
      toast.push(e.message, { type: 'error' });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button onClick={() => nav('/assistant')} aria-label="Back to inbox" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>
          <Logo />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-slate-900">Connected mailboxes</h1>
            <p className="mt-1 text-sm text-slate-500">Connection health and sync status for every client inbox.</p>
          </div>
          <Button variant="primary" icon={Plus} onClick={() => setConnect(true)}>Connect inbox</Button>
        </div>

        {error && !accounts && <ErrorState message={error} onRetry={load} />}
        {!accounts && !error && (
          <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-24 !rounded-2xl" />)}</div>
        )}
        {accounts?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white">
            <EmptyState icon={Plug} title="No mailboxes connected" text="Connect a Gmail or Outlook inbox to start triaging with AI." action={<Button variant="primary" icon={Plus} onClick={() => setConnect(true)}>Connect inbox</Button>} />
          </div>
        )}

        <ul className="space-y-3">
          {accounts?.map((a) => {
            const s = STATUS[a.status] || STATUS.connected;
            return (
              <li key={a.id} className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <ProviderMark provider={a.provider} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{a.clientEmail}</p>
                    <p className="text-xs text-slate-500">{a.clientName} · {a.provider === 'custom_api' ? 'API key' : a.provider === 'gmail' ? 'Gmail' : 'Outlook'}</p>
                  </div>
                  <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', s.cls)}>
                    <span className={cx('h-1.5 w-1.5 rounded-full', s.dot)} /> {s.label}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-center">
                  {[['Conversations', a.totalCount], ['Unread', a.unreadCount], ['Last sync', timeAgo(a.lastSyncedAt)]].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
                      <dd className="mt-0.5 font-display text-lg font-extrabold text-slate-900">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" icon={RefreshCw} loading={busy === a.id} onClick={() => sync(a)}>Sync now</Button>
                  <Button size="sm" variant="ghost" icon={Trash2} className="text-rose-600 hover:bg-rose-50" onClick={() => setConfirm(a)}>Disconnect</Button>
                </div>
              </li>
            );
          })}
        </ul>
        {accounts?.length > 0 && (
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400"><CheckCircle2 className="h-3.5 w-3.5" /> Prototype: connections and sync are simulated with sample data.</p>
        )}
      </main>

      <Modal open={connect} onClose={() => setConnect(false)} title="Add a mailbox">
        <ConnectWizard onCancel={() => setConnect(false)} onDone={() => { setConnect(false); load(); toast.push('Mailbox connected and synced'); }} />
      </Modal>
      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="Disconnect this mailbox?"
        footer={<div className="flex justify-end gap-2"><Button onClick={() => setConfirm(null)}>Cancel</Button><Button variant="danger" loading={busy === confirm?.id} onClick={remove}>Disconnect</Button></div>}
      >
        <p className="text-sm text-slate-600">All imported conversations for <b>{confirm?.clientEmail}</b> will be removed from this workspace.</p>
      </Modal>
    </div>
  );
}
