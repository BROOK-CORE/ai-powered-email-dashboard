import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { EmailAccount } from '../models/EmailAccount.js';
import { Conversation } from '../models/Conversation.js';
import { buildSeedInbox, toConversationDocs } from './seedData.js';

const PROVIDER_COLORS = { gmail: '#EA4335', outlook: '#0A64C8', custom_api: '#7C3AED' };

export function providerColor(provider) {
  return PROVIDER_COLORS[provider] || '#4F46E5';
}

/** Seed a realistic inbox for a freshly connected (simulated) account. */
export async function seedAccountInbox(ownerId, account, assistantName = 'Maya Lin') {
  const provider = account.provider === 'outlook' ? 'outlook' : 'gmail';
  const raw = buildSeedInbox({ clientName: account.clientName, clientEmail: account.clientEmail, provider, assistantName });
  const first = account.clientName.split(' ')[0];
  const personalised = JSON.parse(JSON.stringify(raw).replaceAll('Arjun Mehta', account.clientName).replaceAll('Arjun', first));
  const docs = toConversationDocs({ items: personalised, ownerId, account });
  await Conversation.insertMany(docs);
  account.syncedCount = docs.length;
  account.lastSyncedAt = new Date();
  account.status = 'connected';
  await account.save();
  return docs.length;
}

/** Idempotently create the demo assistant + client + two connected accounts with seeded inboxes. */
export async function ensureDemoData() {
  let assistant = await User.findOne({ email: 'maya@assistant.demo' });
  if (assistant) return assistant;

  assistant = await User.create({
    name: 'Maya Lin',
    email: 'maya@assistant.demo',
    role: 'assistant',
    title: 'Senior Personal Assistant',
    isDemo: true,
    onboardingCompleted: true,
    passwordHash: await bcrypt.hash(`demo-${Math.random()}`, 8),
  });
  await User.create({
    name: 'Arjun Mehta',
    email: 'arjun@client.demo',
    role: 'client',
    title: 'Founder & CEO, Lumen Labs',
    assistantId: assistant._id,
    isDemo: true,
    onboardingCompleted: true,
    passwordHash: await bcrypt.hash(`demo-${Math.random()}`, 8),
  });

  const gmail = await EmailAccount.create({
    ownerId: assistant._id, clientName: 'Arjun Mehta', clientEmail: 'arjun.mehta@gmail.com',
    provider: 'gmail', color: providerColor('gmail'),
  });
  const outlook = await EmailAccount.create({
    ownerId: assistant._id, clientName: 'Arjun Mehta', clientEmail: 'arjun@lumenlabs.io',
    provider: 'outlook', color: providerColor('outlook'),
  });
  await seedAccountInbox(assistant._id, gmail, assistant.name);
  await seedAccountInbox(assistant._id, outlook, assistant.name);
  console.log('[seed] demo assistant, client and inboxes created');
  return assistant;
}
