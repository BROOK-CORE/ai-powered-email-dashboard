import crypto from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { Conversation } from '../models/Conversation.js';
import { analyzeConversation } from './conversationService.js';
import { logSecurityEvent } from './securityLogger.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-key-at-least-32-chars-long';
const KEY = crypto.createHash('sha256').update(SECRET).digest();

export function encryptPassword(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${enc}`;
}

export function decryptPassword(payload) {
  if (!payload || !payload.includes(':')) return null;
  try {
    const [ivHex, tagHex, encHex] = payload.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let dec = decipher.update(encHex, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch {
    return null;
  }
}

export function resolveImapConfig(provider, customHost = '', customPort = 993) {
  if (provider === 'gmail') {
    return { host: 'imap.gmail.com', port: 993, secure: true };
  }
  if (provider === 'outlook') {
    return { host: 'outlook.office365.com', port: 993, secure: true };
  }
  return {
    host: customHost.trim() || 'imap.gmail.com',
    port: Number(customPort) || 993,
    secure: Number(customPort) !== 143,
  };
}

export async function testImapConnection({ provider, email, password, host, port }) {
  const cleanPass = (password || '').replace(/\s+/g, '');
  if (!cleanPass) throw new Error('App password or IMAP password is required');

  const config = resolveImapConfig(provider, host, port);
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: email.trim().toLowerCase(), pass: cleanPass },
    logger: false,
    connectionTimeout: 12000,
    greetingTimeout: 10000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    const messageCount = client.mailbox?.exists || 0;
    lock.release();
    await client.logout();
    return { ok: true, messageCount };
  } catch (err) {
    if (err.authenticationFailed || err.message?.includes('AUTHENTICATIONFAILED')) {
      if (provider === 'gmail') {
        throw new Error(
          'Gmail rejected the password. Google requires a 16-character App Password. Go to Google Account -> Security -> 2-Step Verification -> App passwords to create one.'
        );
      }
      throw new Error('Authentication failed. Check your email and password / app password.');
    }
    throw new Error(`IMAP connection failed: ${err.message || 'Unable to connect to mail server'}`);
  }
}

export async function syncImapMailbox({
  ownerId,
  account,
  password,
  limit = 10,
  replaceExisting = false,
  req = null,
}) {
  const effectivePass = (password || (account.encryptedPassword ? decryptPassword(account.encryptedPassword) : '') || '').replace(/\s+/g, '');
  if (!effectivePass) {
    throw new Error('Enter an App Password to sync live emails from this mailbox.');
  }

  const config = resolveImapConfig(account.provider, account.imapHost, account.imapPort);
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: account.clientEmail, pass: effectivePass },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 12000,
  });

  try {
    await client.connect();
  } catch (err) {
    if (err.authenticationFailed || err.message?.includes('AUTHENTICATIONFAILED')) {
      if (account.provider === 'gmail') {
        throw new Error(
          'Gmail rejected credentials. Create a 16-character Google App Password at myaccount.google.com/apppasswords and use it here.'
        );
      }
      throw new Error('Invalid email or app password for this mailbox.');
    }
    throw new Error(`Could not connect to ${config.host}: ${err.message}`);
  }

  let totalImported = 0;
  const lock = await client.getMailboxLock('INBOX');
  try {
    const totalInBox = client.mailbox?.exists || 0;
    if (totalInBox === 0) {
      account.lastSyncedAt = new Date();
      account.status = 'connected';
      if (password) account.encryptedPassword = encryptPassword(password);
      await account.save();
      return { count: 0, total: 0 };
    }

    const startSeq = Math.max(1, totalInBox - limit + 1);
    const range = `${startSeq}:*`;
    const fetched = [];

    for await (const msg of client.fetch(range, { uid: true, envelope: true, source: true })) {
      fetched.push(msg);
    }

    // Process from newest to oldest
    fetched.reverse();

    if (replaceExisting) {
      await Conversation.deleteMany({ ownerId, accountId: account._id });
    }

    const userEmail = account.clientEmail.toLowerCase();

    for (const msg of fetched) {
      if (!msg.source) continue;
      let parsed;
      try {
        parsed = await simpleParser(msg.source);
      } catch {
        continue;
      }

      const subject = (parsed.subject || '(No subject)').trim().slice(0, 200);
      const fromObj = parsed.from?.value?.[0];
      const senderName = (fromObj?.name || fromObj?.address?.split('@')[0] || 'Unknown').trim().slice(0, 100);
      const senderEmail = (fromObj?.address || 'unknown@domain.com').trim().toLowerCase().slice(0, 200);
      const body = (parsed.text || parsed.textAsHtml?.replace(/<[^>]+>/g, ' ') || '(Empty message)').trim().slice(0, 20000);
      const sentAt = parsed.date || new Date();

      // Check if conversation with this subject and recent date already exists in this account
      let conv = await Conversation.findOne({
        ownerId,
        accountId: account._id,
        subject,
      });

      const isOutbound = senderEmail === userEmail;

      if (conv) {
        // Append message to existing thread if not duplicate
        const hasMsg = conv.messages.some((m) => Math.abs(new Date(m.sentAt) - new Date(sentAt)) < 2000);
        if (!hasMsg) {
          conv.messages.push({
            senderName,
            senderEmail,
            direction: isOutbound ? 'outbound' : 'inbound',
            body,
            sentAt,
          });
          conv.snippet = body.replace(/\s+/g, ' ').slice(0, 140);
          conv.lastMessageAt = sentAt;
          await analyzeConversation(conv, { reconsider: true });
          await conv.save();
        }
      } else {
        // Create new conversation document
        conv = new Conversation({
          ownerId,
          accountId: account._id,
          clientName: account.clientName,
          provider: account.provider,
          subject,
          participants: [
            { name: senderName, email: senderEmail },
            { name: account.clientName, email: account.clientEmail },
          ],
          snippet: body.replace(/\s+/g, ' ').slice(0, 140),
          messages: [
            {
              senderName,
              senderEmail,
              direction: isOutbound ? 'outbound' : 'inbound',
              body,
              sentAt,
            },
          ],
          responsibility: 'assistant_to_reply',
          aiConfidence: 0.9,
          classificationReason: 'Imported from live IMAP sync',
          status: isOutbound ? 'waiting_response' : 'open',
          isUnread: !isOutbound,
          isImportant: false,
          lastMessageAt: sentAt,
        });

        // Run full AI triage and extraction on the imported thread
        await analyzeConversation(conv);
        await conv.save();
        totalImported += 1;
      }
    }

    account.syncedCount = await Conversation.countDocuments({ ownerId, accountId: account._id });
    account.lastSyncedAt = new Date();
    account.status = 'connected';
    account.connectionType = 'imap_live';
    if (password) {
      account.encryptedPassword = encryptPassword(password);
    }
    await account.save();

    logSecurityEvent({
      event: 'admin.imap_synced',
      outcome: 'success',
      req,
      targetId: account._id,
      meta: { count: totalImported, mailbox: account.clientEmail, status: 200 },
    });

    return { count: totalImported, total: account.syncedCount };
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
}
