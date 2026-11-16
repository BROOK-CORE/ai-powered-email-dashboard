import crypto from 'node:crypto';

const SECRET = process.env.JWT_SECRET || 'dev-secret-key-at-least-32-chars-long';
const KEY = crypto.createHash('sha256').update(SECRET).digest();

export function encryptText(text) {
  if (!text || typeof text !== 'string') return text;
  // If already encrypted with our format, return as is
  if (text.startsWith('enc:v1:')) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `enc:v1:${iv.toString('hex')}:${tag}:${enc}`;
}

export function decryptText(payload) {
  if (!payload || typeof payload !== 'string' || !payload.startsWith('enc:v1:')) {
    return payload;
  }
  try {
    const parts = payload.slice(7).split(':');
    if (parts.length !== 3) return payload;
    const [ivHex, tagHex, encHex] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let dec = decipher.update(encHex, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch {
    return payload;
  }
}

export function encryptConversationMessages(conv) {
  if (!conv || !Array.isArray(conv.messages)) return conv;
  for (const m of conv.messages) {
    if (m && m.body && !m.body.startsWith('enc:v1:')) {
      m.body = encryptText(m.body);
    }
  }
  if (conv.draftReply && conv.draftReply.body && !conv.draftReply.body.startsWith('enc:v1:')) {
    conv.draftReply.body = encryptText(conv.draftReply.body);
  }
  conv.isEncrypted = true;
  return conv;
}

export function decryptConversationMessages(conv) {
  if (!conv) return conv;
  const doc = conv.toObject ? conv.toObject() : { ...conv };
  if (Array.isArray(doc.messages)) {
    doc.messages = doc.messages.map((m) => ({
      ...m,
      body: decryptText(m.body),
    }));
  }
  if (doc.draftReply && doc.draftReply.body) {
    doc.draftReply = {
      ...doc.draftReply,
      body: decryptText(doc.draftReply.body),
    };
  }
  return doc;
}
