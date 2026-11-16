import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { api } from '../api.js';
import { Button, Modal, RESP, cx, useToast } from './ui.jsx';

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
    body: 'Hi team, could we schedule a 30 minute catch up next week? I am available Tuesday at 2 PM or Wednesday at 10 AM. Please let me know which works.',
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
  body: 'Quick update: this now needs Arjun personal sign off on the confidential equity amendment before we proceed. It is a legal matter and requires his signature.',
};

export default function SimulateModal({ open, onClose, accounts, selected, onDone }) {
  const toast = useToast();
  const [mode, setMode] = useState('new');
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
      const msg = res.changedFrom
        ? `AI reclassified from ${RESP[res.changedFrom].label} to ${label}`
        : `AI classified as ${label} (${Math.round(c.aiConfidence * 100)}%)${c.needsReview ? ' and flagged for review' : ''}`;
      toast.push(msg, { type: 'info', duration: 5500 });
      onDone(c);
      onClose();
    } catch (e) {
      toast.push(e.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const input =
    'body-5 mt-1.5 h-10 w-full rounded-lg border border-[#D4D4D8] bg-white px-3 text-[#171717] outline-none focus:border-[#0070F3] focus:ring-2 focus:ring-[#0070F3]/20';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Simulate an incoming email"
      subtitle="Watch AI classify ownership live or reevaluate an active thread."
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={Zap}
            loading={busy}
            onClick={submit}
            disabled={f.body.trim().length < 5 || (mode === 'new' && !f.subject.trim())}
          >
            Deliver email
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="inline-flex rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] p-1">
          {[
            ['new', 'New email'],
            ['reply', 'Reply in selected thread'],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              disabled={k === 'reply' && !selected}
              onClick={() => {
                setMode(k);
                setF(k === 'reply' ? { ...REPLY_PRESET } : PRESETS.find((p) => p.id === preset));
              }}
              className={cx(
                'button-xsm rounded-md px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40',
                mode === k ? 'bg-[#171717] text-white' : 'text-[#73706D] hover:text-[#171717]'
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {mode === 'reply' && selected && (
          <p className="body-6 rounded-lg border border-[#BFDBFE] bg-[#EBF5FF] px-3 py-2 text-[#1E40AF]">
            Replying into: <b>{selected.subject}</b>
          </p>
        )}

        {mode === 'new' && (
          <>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPreset(p.id);
                    setF(p);
                  }}
                  className={cx(
                    'button-xsm motion-transition rounded-full border px-3 py-1.5',
                    preset === p.id
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : 'border-[#D4D4D8] bg-white text-[#4D4D4D] hover:border-[#171717]'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {accounts.length > 1 && (
              <label className="title-4 block text-[#171717]">
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
              <label className="title-4 block text-[#171717]">
                From name
                <input value={f.fromName} onChange={set('fromName')} className={input} />
              </label>
              <label className="title-4 block text-[#171717]">
                From email
                <input value={f.fromEmail} onChange={set('fromEmail')} className={input} />
              </label>
            </div>
            <label className="title-4 block text-[#171717]">
              Subject
              <input value={f.subject} onChange={set('subject')} className={input} />
            </label>
          </>
        )}
        <label className="title-4 block text-[#171717]">
          Message
          <textarea
            value={f.body}
            onChange={set('body')}
            rows={5}
            className="body-6 mt-1.5 w-full resize-y rounded-lg border border-[#D4D4D8] bg-white p-3 text-[#171717] outline-none focus:border-[#0070F3] focus:ring-2 focus:ring-[#0070F3]/20"
          />
        </label>
      </div>
    </Modal>
  );
}
