import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { api } from '../api.js';
import { Button, Modal, RESP, useToast } from './ui.jsx';

const PRESETS = [
  {
    id: 'investor',
    label: 'Investor decision',
    fromName: 'Lena Park',
    fromEmail: 'lena@orbitcapital.com',
    subject: 'Term sheet from Orbit Capital',
    body: 'Hi Arjun, our investment committee approved a term sheet at a $20M valuation. This is confidential and we need your decision by Friday.',
  },
  {
    id: 'schedule',
    label: 'Scheduling request',
    fromName: 'Chris Doyle',
    fromEmail: 'chris@brightlane.com',
    subject: 'Can we find time next week?',
    body: 'Hi team, could we schedule a 30-minute catch-up next week? I am available Tuesday at 2 PM or Wednesday at 10 AM. Please let me know which works.',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    fromName: 'Product Weekly',
    fromEmail: 'newsletter@productweekly.io',
    subject: 'This week in product: 5 stories',
    body: 'Our weekly newsletter is here: 5 stories you might like. You are receiving this because you subscribed. Unsubscribe anytime.',
  },
  {
    id: 'ambiguous',
    label: 'Unclear who replies',
    fromName: 'Vendor Co',
    fromEmail: 'sales@vendor.co',
    subject: 'Renewal budget',
    body: 'Please confirm the renewal budget of $20,000 and send over the new billing contact.',
  },
];

const REPLY_PRESET = {
  fromName: '',
  fromEmail: '',
  subject: '',
  body: 'Quick update — this now needs Arjun’s personal sign-off on the confidential equity amendment before we proceed. It is a legal matter and requires his signature.',
};

export default function SimulateModal({ open, onClose, accounts, selected, onDone }) {
  const toast = useToast();
  const [mode, setMode] = useState('new'); // new | reply
  const [preset, setPreset] = useState('investor');
  const [f, setF] = useState(PRESETS[0]);
  const [accountId, setAccountId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(selected ? 'reply' : 'new');
      if (selected) setF({ ...REPLY_PRESET });
      else {
        setPreset('investor');
        setF(PRESETS[0]);
      }
      setAccountId(accounts[0]?.id || '');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.post('/conversations/simulate', {
        ...(mode === 'reply' ? { conversationId: selected.id } : { accountId, subject: f.subject }),
        fromName: f.fromName,
        fromEmail: f.fromEmail,
        body: f.body,
      });
      const c = res.conversation;
      const label = RESP[c.responsibility].label;
      const msg = res.changedFrom ? `AI re-classified: ${RESP[res.changedFrom].label} → ${label}` : `AI classified as “${label}” (${Math.round(c.aiConfidence * 100)}%)${c.needsReview ? ' · flagged for review' : ''}`;
      toast.push(msg, { type: 'info', duration: 5500 });
      onDone(c);
      onClose();
    } catch (e) {
      toast.push(e.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const input = 'mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Simulate an incoming email"
      subtitle="Watch AI classify it live — or re-evaluate an existing thread."
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Zap} loading={busy} onClick={submit} disabled={f.body.trim().length < 5 || (mode === 'new' && !f.subject.trim())}>
            Deliver email
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          {[
            ['new', 'New email'],
            ['reply', 'New reply in selected thread'],
          ].map(([k, l]) => (
            <button
              key={k}
              disabled={k === 'reply' && !selected}
              onClick={() => { setMode(k); setF(k === 'reply' ? { ...REPLY_PRESET } : PRESETS.find((p) => p.id === preset)); }}
              className={`rounded-md px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${mode === k ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
            >
              {l}
            </button>
          ))}
        </div>
        {mode === 'reply' && selected && <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">Replying into: <b>{selected.subject}</b></p>}

        {mode === 'new' && (
          <>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => { setPreset(p.id); setF(p); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${preset === p.id ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {accounts.length > 1 && (
              <label className="block text-sm font-semibold text-slate-700">
                Deliver to mailbox
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={input}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.clientEmail} ({a.provider})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                From name
                <input value={f.fromName} onChange={set('fromName')} className={input} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                From email
                <input value={f.fromEmail} onChange={set('fromEmail')} className={input} />
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Subject
              <input value={f.subject} onChange={set('subject')} className={input} />
            </label>
          </>
        )}
        <label className="block text-sm font-semibold text-slate-700">
          Message
          <textarea value={f.body} onChange={set('body')} rows={5} className="mt-1 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        </label>
      </div>
    </Modal>
  );
}
