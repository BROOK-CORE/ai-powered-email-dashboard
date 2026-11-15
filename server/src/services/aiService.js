/**
 * AI service: classification, summaries, drafts, quick-intent expansion and inbox Q&A.
 *
 * Providers (first configured wins): Groq -> Gemini -> OpenAI. All via plain fetch (no SDKs).
 * If no key is configured, or a provider call fails, a deterministic heuristic engine is used so the
 * prototype always works offline.
 */

import { logSecurityEvent, scrubText } from './securityLogger.js';

const CONFIDENCE_THRESHOLD = 0.75;

/* ----------------------------------------------------------------------------------------- */
/* LLM transport                                                                              */
/* ----------------------------------------------------------------------------------------- */

export function activeProvider() {
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'heuristic';
}

async function openAiCompatible({ url, key, model, system, user, json }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function gemini({ system, user, json }) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2, ...(json ? { responseMimeType: 'application/json' } : {}) },
      }),
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
}

async function callLLM({ system, user, json = false }) {
  const provider = activeProvider();
  if (provider === 'heuristic') return null;
  try {
    if (provider === 'groq')
      return await openAiCompatible({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        system,
        user,
        json,
      });
    if (provider === 'gemini') return await gemini({ system, user, json });
    return await openAiCompatible({
      url: 'https://api.openai.com/v1/chat/completions',
      key: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      system,
      user,
      json,
    });
  } catch (err) {
    const safeReason = scrubText(err?.message || 'unknown');
    logSecurityEvent({ event: 'ai.provider_fallback', severity: 'warn', outcome: 'fallback', meta: { provider, reason: safeReason } });
    return null;
  }
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/* ----------------------------------------------------------------------------------------- */
/* Helpers                                                                                    */
/* ----------------------------------------------------------------------------------------- */

const RESPONSIBILITIES = ['assistant_to_reply', 'client_to_reply', 'no_reply_needed'];
const SEGMENTS = ['action_required', 'waiting_response', 'meetings', 'important', 'general'];

export function threadText(conv, maxChars = 6000) {
  const lines = conv.messages.map(
    (m) => `[${m.direction === 'outbound' ? 'SENT' : 'RECEIVED'}] ${m.senderName} <${m.senderEmail}> @ ${new Date(m.sentAt).toISOString()}\n${m.body}`
  );
  return `Subject: ${conv.subject}\n\n${lines.join('\n\n---\n\n')}`.slice(-maxChars);
}

function firstSentence(text, max = 140) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(.{20,}?[.!?])(\s|$)/);
  const s = m ? m[1] : clean;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

const WEEKDAY = '(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?';
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

function extractDates(text) {
  const out = [];
  const seen = new Set();
  const patterns = [
    new RegExp(`\\b${WEEKDAY}\\.?,?\\s+(?:at\\s+)?\\d{1,2}(?::\\d{2})?\\s?(?:am|pm)\\b`, 'gi'),
    new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?(?:\\s+(?:at\\s+)?\\d{1,2}(?::\\d{2})?\\s?(?:am|pm))?`, 'gi'),
    new RegExp(`\\b(?:by|before|until|deadline[:\\s])\\s+(?:end of\\s+)?(?:${WEEKDAY}|${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?|tomorrow|next week|eod|end of (?:day|week|month))`, 'gi'),
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const t = m[0].trim();
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const isDeadline = /^(by|before|until|deadline)/i.test(t);
      out.push({ dateText: t, type: isDeadline ? 'deadline' : 'meeting' });
    }
  }
  return out.slice(0, 4);
}

/* ----------------------------------------------------------------------------------------- */
/* Heuristic engine (offline fallback)                                                        */
/* ----------------------------------------------------------------------------------------- */

const SIGNALS = {
  noReply: [
    'noreply', 'no-reply', 'do-not-reply', 'notifications@', 'newsletter', 'unsubscribe', 'receipt for', 'payout',
    'changelog', 'weekly digest', 'what\'s new', 'release notes', 'automated message', 'invoice paid', 'thanks!', 'got it, thanks',
    'sounds good, thanks', 'no action needed', 'for your records', 'has been accepted', 'accepted:',
  ],
  client: [
    'term sheet', 'valuation', 'equity', 'vesting', 'cap table', 'investor', 'board resolution', 'sign off', 'sign-off',
    'your signature', 'sign the', 'legal', 'nda', 'confidential', 'acquisition', 'your decision', 'your approval',
    'need your', 'personally', 'your call', 'salary', 'compensation', 'keynote', 'exclusive', 'counteroffer', 'counter-offer',
    'term-sheet', 'fundraise', 'series a', 'series b', 'would love your', 'your input', 'your thoughts',
  ],
  assistant: [
    'schedule', 'reschedule', 'calendar', 'availability', 'available', 'meeting', 'logistics', 'itinerary', 'flight',
    'booking', 'confirm', 'invoice', 'receipt', 'follow up', 'following up', 'send over', 'can you send', 'address',
    'hotel', 'travel', 'agenda', 'venue', 'catering', 'reminder', 'document request', 'w-9', 'billing',
  ],
};

function countHits(text, list) {
  let n = 0;
  for (const k of list) if (text.includes(k)) n += 1;
  return n;
}

function heuristicAnalyze(conv) {
  const last = conv.messages[conv.messages.length - 1];
  const lastInbound = [...conv.messages].reverse().find((m) => m.direction === 'inbound');
  const fullText = `${conv.subject}\n${conv.messages.map((m) => m.body).join('\n')}`;
  const lower = fullText.toLowerCase();
  const senderBlob = `${lastInbound?.senderEmail || ''} ${lastInbound?.senderName || ''}`.toLowerCase();

  const noReplyScore = countHits(lower, SIGNALS.noReply) + countHits(senderBlob, ['noreply', 'no-reply', 'notifications', 'billing@', 'receipts', 'newsletter']) * 2;
  const clientScore = countHits(lower, SIGNALS.client) + (/\$\s?\d{2,3},\d{3}|\$\s?\d+(\.\d+)?\s?(m|million|k)\b/i.test(fullText) ? 1 : 0);
  const assistantScore = countHits(lower, SIGNALS.assistant);
  const asksQuestion = /\?/.test(lastInbound?.body || '') || /\b(please|could you|can you|would you|let me know|need)\b/i.test(lastInbound?.body || '');

  let responsibility;
  let confidence;
  let reason;
  let clientWhy = '';

  const waitingOnOthers = last?.direction === 'outbound';

  if (waitingOnOthers) {
    responsibility = 'no_reply_needed';
    confidence = 0.88;
    reason = 'The last message was sent from this account — the conversation is waiting on the other party.';
  } else if (noReplyScore >= 2 && clientScore < 2) {
    responsibility = 'no_reply_needed';
    confidence = Math.min(0.97, 0.8 + noReplyScore * 0.04);
    reason = 'Automated, informational or already-resolved message with no question or request directed at you.';
  } else if (clientScore >= 2 && clientScore >= assistantScore) {
    responsibility = 'client_to_reply';
    confidence = Math.min(0.96, 0.78 + (clientScore - assistantScore) * 0.04 + clientScore * 0.02);
    reason = 'Involves a personal decision, approval, sensitive or high-stakes topic that only the client should answer.';
    clientWhy = 'This needs your personal decision or sign-off — it is outside what your assistant can decide for you.';
  } else if (assistantScore >= 1 && clientScore === 0 && asksQuestion) {
    responsibility = 'assistant_to_reply';
    confidence = Math.min(0.94, 0.76 + assistantScore * 0.04);
    reason = 'Routine scheduling, logistics or administrative request an assistant can handle without the client.';
  } else if (clientScore >= 1 && assistantScore >= 1) {
    responsibility = 'assistant_to_reply';
    confidence = 0.6;
    reason = 'Mixed signals: routine admin content with a possible decision/approval element — flagged for assistant review.';
  } else if (noReplyScore >= 1 && !asksQuestion) {
    responsibility = 'no_reply_needed';
    confidence = 0.78;
    reason = 'Looks informational and contains no clear request.';
  } else if (asksQuestion) {
    responsibility = 'assistant_to_reply';
    confidence = 0.66;
    reason = 'A reply seems expected, but ownership is unclear — flagged for assistant review.';
  } else {
    responsibility = 'no_reply_needed';
    confidence = 0.7;
    reason = 'No clear request or question detected.';
  }

  const dates = extractDates(fullText).map((d) => ({ ...d, label: conv.subject }));
  const segments = new Set();
  if (responsibility !== 'no_reply_needed') segments.add('action_required');
  if (waitingOnOthers) segments.add('waiting_response');
  if (dates.length || /\b(meeting|call|dinner|lunch|appointment|calendar|invite|reschedule)\b/i.test(lower)) segments.add('meetings');
  if (clientScore >= 2 || /\b(urgent|asap|deadline|important)\b/i.test(lower)) segments.add('important');
  if (!segments.size) segments.add('general');

  const amounts = [...fullText.matchAll(/\$\s?\d[\d,.]*\s?(?:[mMkK]|million|thousand)?/g)].map((m) => m[0].trim());
  const highlights = [...new Set(amounts)].slice(0, 3);
  for (const d of dates.slice(0, 2)) highlights.push(`${d.type === 'deadline' ? 'Deadline' : 'When'}: ${d.dateText}`);

  const chips = [];
  if (responsibility === 'client_to_reply') {
    if (/\b(approve|sign|accept|terms|nda|agreement)\b/i.test(lower)) {
      chips.push({ label: 'Approve', intentPrompt: 'Approve this and confirm we are good to proceed.', actionType: 'approve' });
      chips.push({ label: 'Need a call first', intentPrompt: 'Say I would like a short call before deciding and propose a time.', actionType: 'schedule' });
    }
    if (/\b(invite|invitation|keynote|speak|join|attend)\b/i.test(lower)) {
      chips.push({ label: 'Accept', intentPrompt: 'Accept the invitation and thank them.', actionType: 'approve' });
      chips.push({ label: 'Decline politely', intentPrompt: 'Politely decline due to schedule constraints.', actionType: 'decline' });
    }
    if (dates.length && !chips.some((c) => c.actionType === 'schedule')) {
      chips.push({ label: `${dates[0].dateText} works`, intentPrompt: `Confirm that ${dates[0].dateText} works for me.`, actionType: 'schedule' });
    }
  }

  const sender = lastInbound?.senderName || 'the sender';
  const summaryBits = conv.messages.length > 1 ? `${conv.messages.length}-message thread. ` : '';
  const aiSummary = `${summaryBits}${firstSentence(lastInbound?.body || last?.body || conv.subject, 220)}`;
  const takeaway =
    responsibility === 'client_to_reply'
      ? `${sender} needs your decision: ${conv.subject.replace(/^(re|fwd?):\s*/i, '')}`
      : responsibility === 'assistant_to_reply'
        ? `${sender}: ${firstSentence(lastInbound?.body || conv.subject, 90)}`
        : waitingOnOthers
          ? `Waiting on ${sender} to reply`
          : firstSentence(conv.subject, 90);

  return {
    responsibility,
    confidence: Number(confidence.toFixed(2)),
    classificationReason: reason,
    clientActionWhy: clientWhy,
    oneLineTakeaway: takeaway,
    aiSummary,
    highlights: highlights.slice(0, 5),
    extractedDates: dates,
    quickActionChips: chips.slice(0, 3),
    segments: [...segments],
    engine: 'heuristic',
  };
}

function heuristicDraft(conv, { tone = 'professional', instruction = '' } = {}) {
  const lastInbound = [...conv.messages].reverse().find((m) => m.direction === 'inbound') || conv.messages[conv.messages.length - 1];
  const first = (lastInbound?.senderName || 'there').split(' ')[0];
  const greet = tone === 'warm' ? `Hi ${first}, hope you're doing well!` : tone === 'concise' ? `Hi ${first},` : `Hi ${first}, thank you for your email.`;
  const body = instruction
    ? instruction.charAt(0).toUpperCase() + instruction.slice(1).replace(/\.?$/, '.')
    : /\b(schedule|reschedule|meeting|call|dinner|available)\b/i.test(conv.subject + (lastInbound?.body || ''))
      ? 'Thank you for flagging this. Please let me know which of the proposed times works best on your side and I will confirm it on the calendar right away.'
      : 'Thank you for the details — I have reviewed everything and will follow up with next steps shortly.';
  return `${greet}\n\n${body}\n\nBest regards`;
}

function heuristicQuery(question, convs) {
  const q = question.toLowerCase();
  const pick = (fn) => convs.filter(fn);
  const open = (c) => c.status === 'open' || c.status === 'waiting_response';
  let list;
  let answer;

  if (/(client|executive|boss).*(attention|reply|respond)|require.*client|client.*(need|require)/.test(q)) {
    list = pick((c) => c.responsibility === 'client_to_reply' && open(c));
    answer = list.length ? `${list.length} conversation(s) need the client's personal attention.` : 'Nothing currently needs the client personally.';
  } else if (/waiting|pending response|awaiting|haven't heard/.test(q)) {
    list = pick((c) => c.status === 'waiting_response');
    answer = list.length ? `You are waiting on replies in ${list.length} conversation(s).` : 'You are not waiting on any replies right now.';
  } else if (/assistant.*(reply|handle|to do)|for me to (reply|handle)/.test(q)) {
    list = pick((c) => c.responsibility === 'assistant_to_reply' && open(c));
    answer = `${list.length} conversation(s) are waiting on the assistant.`;
  } else if (/(meeting|schedule|appointment|calendar|upcoming)/.test(q)) {
    list = pick((c) => (c.segments || []).includes('meetings') && open(c));
    answer = `${list.length} conversation(s) involve meetings or appointments.`;
  } else if (/(review|unsure|uncertain|not sure|flagged)/.test(q)) {
    list = pick((c) => c.needsReview);
    answer = list.length ? `${list.length} conversation(s) were flagged because the AI wasn't confident about ownership.` : 'No conversations are flagged for review.';
  } else if (/(attention|urgent|important|need)/.test(q)) {
    list = pick((c) => open(c) && c.responsibility !== 'no_reply_needed');
    answer = `${list.length} conversation(s) need action. The most important are listed first.`;
    list.sort((a, b) => Number(b.isImportant) - Number(a.isImportant));
  } else {
    const words = q.split(/\W+/).filter((w) => w.length > 3);
    list = pick((c) => words.some((w) => `${c.subject} ${c.aiSummary} ${c.clientName}`.toLowerCase().includes(w)));
    answer = list.length ? `Found ${list.length} conversation(s) related to your question.` : "I couldn't find matching conversations. Try asking what needs attention or what you're waiting on.";
  }
  return { answer, conversationIds: list.slice(0, 8).map((c) => String(c._id)) };
}

/* ----------------------------------------------------------------------------------------- */
/* Public API                                                                                 */
/* ----------------------------------------------------------------------------------------- */

function normalizeAnalysis(raw, fallback) {
  if (!raw || typeof raw !== 'object') return fallback;
  const responsibility = RESPONSIBILITIES.includes(raw.responsibility) ? raw.responsibility : fallback.responsibility;
  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = fallback.confidence;
  confidence = Math.max(0, Math.min(1, confidence));
  const dates = Array.isArray(raw.extractedDates)
    ? raw.extractedDates
        .filter((d) => d && d.dateText)
        .map((d) => ({
          label: String(d.label || '').slice(0, 120),
          dateText: String(d.dateText).slice(0, 80),
          isoDate: d.isoDate ? String(d.isoDate) : undefined,
          type: ['meeting', 'deadline', 'followup'].includes(d.type) ? d.type : 'meeting',
        }))
        .slice(0, 5)
    : fallback.extractedDates;
  const chips = Array.isArray(raw.quickActionChips)
    ? raw.quickActionChips
        .filter((c) => c && c.label && c.intentPrompt)
        .map((c) => ({
          label: String(c.label).slice(0, 30),
          intentPrompt: String(c.intentPrompt).slice(0, 200),
          actionType: ['approve', 'schedule', 'counter', 'decline'].includes(c.actionType) ? c.actionType : 'approve',
        }))
        .slice(0, 3)
    : fallback.quickActionChips;
  const segments = Array.isArray(raw.segments) ? raw.segments.filter((s) => SEGMENTS.includes(s)) : fallback.segments;
  return {
    responsibility,
    confidence: Number(confidence.toFixed(2)),
    classificationReason: String(raw.classificationReason || fallback.classificationReason).slice(0, 300),
    clientActionWhy: responsibility === 'client_to_reply' ? String(raw.clientActionWhy || fallback.clientActionWhy || 'This needs your personal input.').slice(0, 300) : '',
    oneLineTakeaway: String(raw.oneLineTakeaway || fallback.oneLineTakeaway).slice(0, 140),
    aiSummary: String(raw.aiSummary || fallback.aiSummary).slice(0, 600),
    highlights: Array.isArray(raw.highlights) ? raw.highlights.map(String).slice(0, 6) : fallback.highlights,
    extractedDates: dates,
    quickActionChips: responsibility === 'client_to_reply' ? chips : [],
    segments: segments.length ? segments : fallback.segments,
    engine: activeProvider(),
  };
}

const CLASSIFY_SYSTEM = `You are an email triage engine for a PERSONAL ASSISTANT who manages a CLIENT's (an executive's) inbox.
Decide WHO should reply to the conversation. Respond with ONLY a JSON object, no prose.

responsibility:
- "assistant_to_reply": routine/administrative — scheduling, rescheduling, logistics, invoices/admin requests, follow-ups, general business inquiries.
- "client_to_reply": needs the client personally — personal decisions or approvals, sensitive/confidential or high-stakes business (investors, legal, equity, contracts, hiring/compensation), messages explicitly asking for the client's input.
- "no_reply_needed": newsletters, notifications, receipts, automated alerts, FYI updates, already-resolved threads ("thanks", "got it"), or threads where the last message was SENT and we are waiting on the other side.
Do NOT treat every email as needing a reply. Consider the FULL conversation history, not just the last message.
confidence: 0..1. Use < 0.75 when ownership is genuinely ambiguous.

JSON shape:
{"responsibility":"...","confidence":0.0,"classificationReason":"1 sentence for the assistant","clientActionWhy":"1 sentence addressed to the client explaining why THEY must reply (empty unless client_to_reply)","oneLineTakeaway":"<=15 words headline","aiSummary":"2-3 sentences","highlights":["key amounts, decisions, commitments"],"extractedDates":[{"label":"","dateText":"as written","isoDate":"YYYY-MM-DD if inferable","type":"meeting|deadline|followup"}],"quickActionChips":[{"label":"<=3 words","intentPrompt":"instruction to write the reply","actionType":"approve|schedule|counter|decline"}] (max 3, only when the client is asked for a decision/time, else []),"segments":["action_required|waiting_response|meetings|important|general"]}`;

export async function classifyAndAnalyzeThread(conv, { playbook } = {}) {
  const fallback = heuristicAnalyze(conv);
  const system = playbook ? `${CLASSIFY_SYSTEM}\n\nClient preferences to respect:\n${playbook}` : CLASSIFY_SYSTEM;
  const text = await callLLM({
    system,
    user: `Client: ${conv.clientName}\nToday: ${new Date().toISOString().slice(0, 10)}\n\n${threadText(conv)}`,
    json: true,
  });
  const analysis = normalizeAnalysis(parseJson(text), fallback);
  analysis.needsReview = analysis.confidence < CONFIDENCE_THRESHOLD;
  return analysis;
}

export async function draftReply(conv, { tone = 'professional', instruction = '', asClient = false } = {}) {
  const system = `You write email replies for a personal assistant managing an executive's inbox. Write ONLY the email body (no subject line, no markdown). Be ${tone}, concise and specific to the conversation. ${
    asClient ? "Write in the executive's first-person voice." : 'Write on behalf of the executive, as the assistant.'
  } Never invent facts, prices or commitments that aren't implied; if unsure, ask a short clarifying question. End with a brief sign-off line.`;
  const text = await callLLM({
    system,
    user: `${instruction ? `Instruction: ${instruction}\n\n` : ''}${threadText(conv)}`,
  });
  return (text || '').trim() || heuristicDraft(conv, { tone, instruction });
}

export async function expandQuickIntentToReply(conv, shortIntent) {
  const system =
    "You turn a busy executive's very short instruction into a polished, first-person email reply to the conversation. Write ONLY the email body (no subject, no markdown), 2-5 sentences, warm but efficient, ending with a brief sign-off. Do not invent facts beyond the instruction.";
  const text = await callLLM({ system, user: `Executive's instruction: "${shortIntent}"\n\n${threadText(conv)}` });
  return (text || '').trim() || heuristicDraft(conv, { tone: 'concise', instruction: shortIntent });
}

export async function answerInboxQuery(question, convs) {
  const fallback = heuristicQuery(question, convs);
  if (activeProvider() === 'heuristic') return { ...fallback, engine: 'heuristic' };

  const catalog = convs
    .slice(0, 60)
    .map(
      (c) =>
        `${c._id} | ${c.clientName} | "${c.subject}" | owner:${c.responsibility} | status:${c.status} | unread:${c.isUnread} | important:${c.isImportant} | review:${c.needsReview} | why:${c.classificationReason} | summary:${c.aiSummary}`
    )
    .join('\n');
  const text = await callLLM({
    system: `You answer questions about an assistant's managed inbox. Use ONLY the provided conversation catalog. Respond with ONLY JSON: {"answer":"short, direct answer (max 4 sentences)","conversationIds":["ids of the relevant conversations"]}. For "why" questions, explain using the "why" field.`,
    user: `Question: ${question}\n\nCatalog (id | client | subject | ...):\n${catalog}`,
    json: true,
  });
  const parsed = parseJson(text);
  if (!parsed?.answer) return { ...fallback, engine: 'heuristic' };
  const valid = new Set(convs.map((c) => String(c._id)));
  return {
    answer: String(parsed.answer),
    conversationIds: (Array.isArray(parsed.conversationIds) ? parsed.conversationIds : []).map(String).filter((id) => valid.has(id)).slice(0, 8),
    engine: activeProvider(),
  };
}

export function audioBrief(items, name) {
  if (!items.length) return `You're all caught up${name ? `, ${name.split(' ')[0]}` : ''}. Nothing needs your attention.`;
  const parts = items.slice(0, 5).map((c, i) => `${i + 1}. ${c.oneLineTakeaway || c.subject}.`);
  return `${name ? `${name.split(' ')[0]}, ` : ''}you have ${items.length} ${items.length === 1 ? 'item' : 'items'} that need your personal response. ${parts.join(' ')}`;
}

export const _internals = { heuristicAnalyze, heuristicDraft, heuristicQuery, extractDates, CONFIDENCE_THRESHOLD };
