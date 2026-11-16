import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Plug, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import ConnectWizard from '../components/ConnectWizard.jsx';
import { Button, EmptyState, ErrorState, Logo, Modal, ProviderMark, cx, timeAgo, useToast } from '../components/ui.jsx';

const STATUS = {
  connected: { label: 'Connected', cls: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]', dot: 'bg-[#059669]' },
  syncing: { label: 'Syncing...', cls: 'border-[#FDE68A] bg-[#FEF3C7] text-[#B45309]', dot: 'animate-pulse bg-[#D97706]' },
  attention_needed: { label: 'Needs attention', cls: 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]', dot: 'bg-[#DC2626]' },
  disconnected: { label: 'Disconnected', cls: 'border-[#E4E4E7] bg-[#F4F4F5] text-[#52525B]', dot: 'bg-[#71717A]' },
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
    <div className="min-h-dvh bg-[#FAFAFA]">
      <header className="border-b border-[#EBEBEB] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => nav('/assistant')}
            aria-label="Back to inbox"
            className="motion-transition rounded-lg p-2 text-[#4D4D4D] hover:bg-[#F4F4F5]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Logo />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="heading-5 text-[#171717]">Connected mailboxes</h1>
            <p className="body-6 mt-1 text-[#73706D]">Connection health and sync status for every client inbox.</p>
          </div>
          <Button variant="primary" icon={Plus} onClick={() => setConnect(true)}>
            Connect inbox
          </Button>
        </div>

        {error && !accounts && <ErrorState message={error} onRetry={load} />}
        {!accounts && !error && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-28 !rounded-2xl" />
            ))}
          </div>
        )}
        {accounts?.length === 0 && (
          <div className="rounded-2xl border border-[#EBEBEB] bg-white">
            <EmptyState
              icon={Plug}
              title="No mailboxes connected"
              text="Connect a Google Workspace or Microsoft Outlook inbox to start triaging with AI."
              action={
                <Button variant="primary" icon={Plus} onClick={() => setConnect(true)}>
                  Connect inbox
                </Button>
              }
            />
          </div>
        )}

        <ul className="space-y-4">
          {accounts?.map((a) => {
            const s = STATUS[a.status] || STATUS.connected;
            return (
              <li key={a.id} className="card-lift animate-fade-up rounded-2xl border border-[#EBEBEB] bg-white p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <ProviderMark provider={a.provider} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="body-4 truncate text-[#171717]">{a.clientEmail}</p>
                    <p className="caption-2 text-[#73706D]">
                      {a.clientName} · {a.provider === 'custom_api' ? 'API Bridge' : a.provider === 'gmail' ? 'Google Gmail' : 'Microsoft Outlook'}
                    </p>
                  </div>
                  <span className={cx('caption-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1', s.cls)}>
                    <span className={cx('h-1.5 w-1.5 rounded-full', s.dot)} /> {s.label}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] p-3 text-center">
                  {[
                    ['Conversations', a.totalCount],
                    ['Unread', a.unreadCount],
                    ['Last sync', timeAgo(a.lastSyncedAt)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="caption-4 uppercase tracking-wider text-[#73706D]">{k}</dt>
                      <dd className="title-2 font-mono mt-0.5 text-[#171717]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" icon={RefreshCw} loading={busy === a.id} onClick={() => sync(a)}>
                    Sync now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    className="text-[#DC2626] hover:bg-[#FEF2F2]"
                    onClick={() => setConfirm(a)}
                  >
                    Disconnect
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        {accounts?.length > 0 && (
          <p className="caption-4 mt-6 flex items-center justify-center gap-1.5 text-[#73706D]">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" /> Sandbox environment: connections and sync run with realistic sample threads.
          </p>
        )}
      </main>

      <Modal open={connect} onClose={() => setConnect(false)} title="Add a mailbox">
        <ConnectWizard
          onCancel={() => setConnect(false)}
          onDone={() => {
            setConnect(false);
            load();
            toast.push('Mailbox connected and synced');
          }}
        />
      </Modal>
      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="Disconnect this mailbox?"
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="danger" loading={busy === confirm?.id} onClick={remove}>
              Disconnect
            </Button>
          </div>
        }
      >
        <p className="body-6 text-[#4D4D4D]">
          All imported conversations for <b>{confirm?.clientEmail}</b> will be removed from this workspace.
        </p>
      </Modal>
    </div>
  );
}
