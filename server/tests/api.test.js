import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { ensureDemoData } from '../src/seed/seed.js';

let ctx;
let api;
let assistant; // bearer token
let client; // bearer token

const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  delete process.env.MONGODB_URI;
  ctx = await connectDb();
  await ensureDemoData();
  api = request(createApp());
  assistant = (await api.post('/api/auth/demo').send({ role: 'assistant' })).body.token;
  client = (await api.post('/api/auth/demo').send({ role: 'client' })).body.token;
});

afterAll(async () => {
  await disconnectDb(ctx);
});

async function list(params = '') {
  return (await api.get(`/api/conversations${params}`).set(auth(assistant))).body;
}

describe('auth & onboarding', () => {
  it('logs in as demo assistant and client, rejects anonymous access', async () => {
    expect(assistant).toBeTruthy();
    expect(client).toBeTruthy();
    expect((await api.get('/api/conversations')).status).toBe(401);
  });

  it('registers a new assistant and connects a Gmail account with a synced inbox', async () => {
    const reg = await api.post('/api/auth/register').send({ name: 'Test PA', email: 'pa@test.dev', password: 'secret123' });
    expect(reg.status).toBe(201);
    const t = reg.body.token;
    const empty = await api.get('/api/conversations').set(auth(t));
    expect(empty.body.items).toHaveLength(0);

    const conn = await api.post('/api/accounts/connect').set(auth(t)).send({ provider: 'gmail', clientName: 'Nora Vale', clientEmail: 'nora@vale.co' });
    expect(conn.status).toBe(201);
    expect(conn.body.imported).toBeGreaterThan(3);
    const after = await api.get('/api/conversations').set(auth(t));
    expect(after.body.items.length).toBeGreaterThan(3);
    expect(after.body.items[0].clientName).toBe('Nora Vale');
    expect((await api.post('/api/accounts/connect').set(auth(t)).send({ provider: 'gmail', clientName: 'Nora Vale', clientEmail: 'nora@vale.co' })).status).toBe(409);
  });

  it('keeps clients out of assistant-only endpoints', async () => {
    expect((await api.get('/api/conversations').set(auth(client))).status).toBe(403);
    expect((await api.get('/api/accounts').set(auth(client))).status).toBe(403);
  });
});

describe('dashboard & segments', () => {
  it('returns KPI stats consistent with the seeded inbox', async () => {
    const { stats, items, upcoming } = await list();
    expect(stats.total).toBe(items.length);
    expect(stats.assistantToReply + stats.clientToReply + stats.noReplyNeeded).toBe(stats.total);
    expect(stats.clientToReply).toBeGreaterThanOrEqual(4);
    expect(stats.needsReview).toBeGreaterThanOrEqual(1);
    expect(stats.waitingResponse).toBeGreaterThanOrEqual(2);
    expect(upcoming.length).toBeGreaterThan(0);
  });

  it('filters by segment and searches message bodies', async () => {
    const client2 = await list('?segment=client_to_reply');
    expect(client2.items.every((c) => c.responsibility === 'client_to_reply')).toBe(true);
    const found = await list('?search=term%20sheet');
    expect(found.items.some((c) => /term sheet/i.test(c.subject))).toBe(true);
    const review = await list('?segment=needs_review');
    expect(review.items.every((c) => c.needsReview)).toBe(true);
    const unread = await list('?segment=unread');
    expect(unread.items.length).toBeGreaterThan(0);
    expect(unread.items.every((c) => c.isUnread)).toBe(true);
  });
});

describe('automatic AI classification', () => {
  it('classifies an investor email as client_to_reply and surfaces it in the client queue', async () => {
    const res = await api.post('/api/conversations/simulate').set(auth(assistant)).send({
      fromName: 'Lena Park',
      fromEmail: 'lena@orbitcapital.com',
      subject: 'Term sheet from Orbit Capital',
      body: 'Hi Arjun, our investment committee approved a term sheet at a $20M valuation. This is confidential and we need your decision by Friday.',
    });
    expect(res.status).toBe(201);
    expect(res.body.conversation.responsibility).toBe('client_to_reply');
    expect(res.body.conversation.clientActionWhy).toBeTruthy();
    const queue = await api.get('/api/conversations/client-queue').set(auth(client));
    expect(queue.body.items.some((c) => c.subject === 'Term sheet from Orbit Capital')).toBe(true);
    expect(queue.body.audioBriefText).toMatch(/personal response/);
  });

  it('does not treat newsletters as needing a reply', async () => {
    const res = await api.post('/api/conversations/simulate').set(auth(assistant)).send({
      fromName: 'Product Weekly',
      fromEmail: 'newsletter@productweekly.io',
      subject: 'This week in product',
      body: 'Our weekly newsletter: 5 stories you might like. Unsubscribe anytime.',
    });
    expect(res.body.conversation.responsibility).toBe('no_reply_needed');
  });

  it('flags ambiguous conversations for assistant review', async () => {
    const res = await api.post('/api/conversations/simulate').set(auth(assistant)).send({
      fromName: 'Vendor Co',
      fromEmail: 'sales@vendor.co',
      subject: 'Renewal budget',
      body: 'Please confirm the renewal budget of $20,000 and send the new billing contact.',
    });
    expect(res.body.conversation.needsReview).toBe(true);
    expect(res.body.conversation.aiConfidence).toBeLessThan(0.75);
  });

  it('re-evaluates classification when a new message arrives in an existing thread', async () => {
    const { items } = await list();
    const dinner = items.find((c) => /Board dinner/.test(c.subject));
    expect(dinner.responsibility).toBe('assistant_to_reply');
    const res = await api.post('/api/conversations/simulate').set(auth(assistant)).send({
      conversationId: dinner.id,
      body: 'Update: the board now needs Arjun\'s sign-off on the confidential equity amendment and the term sheet before dinner. This is a legal matter and requires your signature.',
    });
    expect(res.body.conversation.responsibility).toBe('client_to_reply');
    expect(res.body.changedFrom).toBe('assistant_to_reply');
    expect(res.body.conversation.responsibilityHistory.length).toBeGreaterThan(1);
  });

  it('lets the assistant override a classification and the override sticks', async () => {
    const { items } = await list('?segment=assistant_to_reply');
    const target = items[0];
    const res = await api.patch(`/api/conversations/${target.id}`).set(auth(assistant)).send({ responsibility: 'client_to_reply' });
    expect(res.body.conversation.manualOverride).toBe(true);
    expect(res.body.conversation.responsibility).toBe('client_to_reply');
    const again = await api.get(`/api/conversations/${target.id}`).set(auth(assistant));
    expect(again.body.conversation.responsibility).toBe('client_to_reply');
  });
});

describe('client portal', () => {
  async function firstClientItem(pick = (c) => c) {
    const q = await api.get('/api/conversations/client-queue').set(auth(client));
    return q.body.items.find(pick);
  }

  it('hands an item back to the assistant and notifies them', async () => {
    const item = await firstClientItem((c) => /NDA/.test(c.subject));
    const res = await api.post(`/api/conversations/${item.id}/client-action`).set(auth(client)).send({ action: 'delegate_to_assistant', note: 'Please have legal review first' });
    expect(res.body.conversation.responsibility).toBe('assistant_to_reply');
    const n = await api.get('/api/notifications').set(auth(assistant));
    expect(n.body.unread).toBeGreaterThan(0);
    expect(n.body.items.some((x) => x.type === 'client_delegated')).toBe(true);
  });

  it('turns a short intent into a draft, sends it, and supports undo within the window', async () => {
    const item = await firstClientItem((c) => /Keynote/.test(c.subject));
    const draft = await api.post(`/api/conversations/${item.id}/client-action`).set(auth(client)).send({ action: 'quick_intent', text: 'Accept, but ask for travel in business class' });
    expect(draft.body.conversation.draftReply.body.length).toBeGreaterThan(20);
    const sent = await api.post(`/api/conversations/${item.id}/client-action`).set(auth(client)).send({ action: 'approve_and_send' });
    expect(sent.body.conversation.status).toBe('waiting_response');
    expect(sent.body.undoUntil).toBeTruthy();
    const undo = await api.post(`/api/conversations/${item.id}/undo-send`).set(auth(client));
    expect(undo.status).toBe(200);
    expect(undo.body.conversation.status).toBe('open');
  });

  it('snoozes an item out of the queue and marks another as handled', async () => {
    const item = await firstClientItem((c) => /vesting/i.test(c.subject));
    await api.post(`/api/conversations/${item.id}/client-action`).set(auth(client)).send({ action: 'snooze' });
    const q = await api.get('/api/conversations/client-queue').set(auth(client));
    expect(q.body.items.some((c) => c.id === item.id)).toBe(false);
    expect(q.body.snoozedCount).toBeGreaterThan(0);

    const other = await firstClientItem();
    if (other) {
      const done = await api.post(`/api/conversations/${other.id}/client-action`).set(auth(client)).send({ action: 'mark_handled' });
      expect(done.body.conversation.status).toBe('completed');
    }
  });

  it('executes a one-tap chip as a sent reply', async () => {
    const created = await api.post('/api/conversations/simulate').set(auth(assistant)).send({
      fromName: 'Pat', fromEmail: 'pat@fund.vc', subject: 'Investor term sheet decision',
      body: 'We would love your decision on the term sheet and valuation. This is confidential. Can we meet Thursday at 3 PM?',
    });
    const id = created.body.conversation.id;
    const chips = created.body.conversation.quickActionChips;
    if (chips.length) {
      const res = await api.post(`/api/conversations/${id}/client-action`).set(auth(client)).send({ action: 'quick_chip', chipIndex: 0 });
      expect(res.body.conversation.messages.at(-1).direction).toBe('outbound');
    }
  });
});

describe('assistant reply flow & AI Q&A', () => {
  it('generates a draft and sends it only on explicit approval', async () => {
    const { items } = await list('?segment=assistant_to_reply');
    const target = items[0];
    const drafted = await api.post(`/api/conversations/${target.id}/draft`).set(auth(assistant)).send({ tone: 'concise' });
    expect(drafted.body.draft.length).toBeGreaterThan(20);
    const before = (await api.get(`/api/conversations/${target.id}`).set(auth(assistant))).body.conversation;
    expect(before.messages.at(-1).direction).toBe('inbound'); // not sent yet
    const sent = await api.post(`/api/conversations/${target.id}/reply`).set(auth(assistant)).send({ body: drafted.body.draft });
    expect(sent.body.conversation.status).toBe('waiting_response');
    expect(sent.body.conversation.messages.at(-1).direction).toBe('outbound');
  });

  it('answers natural-language questions about the inbox', async () => {
    const q1 = await api.post('/api/ai/query').set(auth(assistant)).send({ question: 'Which emails require the client\'s attention?' });
    expect(q1.body.conversations.length).toBeGreaterThan(0);
    expect(q1.body.conversations.every((c) => c.responsibility === 'client_to_reply')).toBe(true);
    const q2 = await api.post('/api/ai/query').set(auth(assistant)).send({ question: 'What am I waiting for a response on?' });
    expect(q2.body.conversations.every((c) => c.status === 'waiting_response')).toBe(true);
  });
});
