import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, Sparkles } from 'lucide-react';
import { api } from '../api.js';
import { Drawer, RespBadge, Spinner, cx } from './ui.jsx';

const STARTERS = [
  'Show me emails that need my attention',
  'Which emails require the client’s attention?',
  'What am I waiting for a response on?',
  'Which emails are flagged for my review?',
  'Do I have any upcoming meetings?',
];

export default function CopilotDrawer({ open, onClose, onOpenThread, focusId, pending, clearPending }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const ask = async (q, convId) => {
    const question = q.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setText('');
    setBusy(true);
    try {
      const res = await api.post('/ai/query', { question, conversationId: convId || focusId || undefined });
      setMsgs((m) => [...m, { role: 'ai', text: res.answer, items: res.conversations || [], engine: res.engine }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'ai', text: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  // Questions launched from a thread ("Summarize this conversation").
  useEffect(() => {
    if (open && pending) {
      ask(pending.question, pending.id);
      clearPending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Ask AI"
      subtitle="Ask anything about your clients’ inboxes"
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Why is this assigned to the client?"
            aria-label="Ask a question about your inbox"
            className="h-11 flex-1 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
          <button type="submit" disabled={!text.trim() || busy} aria-label="Send question" className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:bg-indigo-300">
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
      }
    >
      <div className="space-y-4 p-4">
        {!msgs.length && (
          <div className="animate-fade-up">
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-indigo-50 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Sparkles className="h-5 w-5" />
              </span>
              <p className="text-sm text-indigo-900">I can summarize threads, explain why an email was assigned, and find what needs attention.</p>
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Try asking</p>
            <div className="flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm text-white">{m.text}</p>
            </div>
          ) : (
            <div key={i} className="flex gap-3 animate-fade-up">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Bot className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cx('whitespace-pre-wrap rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed', m.error ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-800')}>{m.text}</p>
                {m.items?.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {m.items.map((c) => (
                      <li key={c.id}>
                        <button onClick={() => { onOpenThread(c.id); onClose(); }} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:shadow-sm">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-slate-900">{c.subject}</span>
                            <RespBadge value={c.responsibility} compact />
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{c.takeaway}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        )}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner className="h-4 w-4" /> Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>
    </Drawer>
  );
}
