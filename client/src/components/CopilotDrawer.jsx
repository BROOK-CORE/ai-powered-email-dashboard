import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, Sparkles } from 'lucide-react';
import { api } from '../api.js';
import { Drawer, RespBadge, Spinner, cx } from './ui.jsx';

const STARTERS = [
  'Show me emails that need my attention',
  'Which emails require the client personal decision?',
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
      subtitle="Query across all connected client mailboxes"
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
            placeholder="Ask why an email was assigned or what needs action..."
            aria-label="Ask a question about your inbox"
            className="body-5 h-10 flex-1 rounded-lg border border-[#D4D4D8] px-3 text-[#171717] outline-none focus:border-[#0070F3] focus:ring-2 focus:ring-[#0070F3]/20"
          />
          <button
            type="submit"
            disabled={!text.trim() || busy}
            aria-label="Send question"
            className="motion-transition flex h-10 w-10 items-center justify-center rounded-lg bg-[#171717] text-white hover:bg-black disabled:bg-[#A1A1AA]"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      }
    >
      <div className="space-y-4 p-4">
        {!msgs.length && (
          <div className="animate-fade-up">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#BFDBFE] bg-[#EBF5FF] p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0070F3] text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <p className="body-6 text-[#171717]">
                Ask me to summarize threads, explain why an email was assigned, or surface urgent client decisions.
              </p>
            </div>
            <p className="caption-3 mb-2 uppercase tracking-wider text-[#73706D]">Suggested prompts</p>
            <div className="flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="motion-transition body-5 rounded-xl border border-[#EBEBEB] bg-white px-3.5 py-2.5 text-left text-[#171717] hover:border-[#0070F3] hover:bg-[#FAFAFA]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="body-6 max-w-[85%] rounded-2xl bg-[#171717] px-4 py-2.5 text-white">{m.text}</p>
            </div>
          ) : (
            <div key={i} className="animate-fade-up flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#171717] text-white">
                <Bot className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cx(
                    'body-6 whitespace-pre-wrap rounded-2xl border px-4 py-3',
                    m.error ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]' : 'border-[#EBEBEB] bg-[#FAFAFA] text-[#171717]'
                  )}
                >
                  {m.text}
                </p>
                {m.items?.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {m.items.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenThread(c.id);
                            onClose();
                          }}
                          className="card-lift w-full rounded-xl border border-[#EBEBEB] bg-white p-3 text-left hover:border-[#0070F3]"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="body-4 truncate text-[#171717]">{c.subject}</span>
                            <RespBadge value={c.responsibility} compact />
                          </span>
                          <span className="caption-4 mt-0.5 block truncate text-[#73706D]">{c.takeaway}</span>
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
          <div className="body-6 flex items-center gap-2 text-[#73706D]">
            <Spinner className="h-4 w-4" /> Analyzing workspace...
          </div>
        )}
        <div ref={endRef} />
      </div>
    </Drawer>
  );
}
