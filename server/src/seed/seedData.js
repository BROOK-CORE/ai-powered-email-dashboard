/**
 * Realistic demo inbox for a connected client account.
 * Analysis fields are pre-baked so the demo is deterministic and instant (no LLM call at seed time);
 * anything simulated or newly synced afterwards goes through the live AI classifier.
 */

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);
const daysAhead = (d) => new Date(Date.now() + d * 86400 * 1000).toISOString().slice(0, 10);

export function buildSeedInbox({ clientName, clientEmail, provider, assistantName = 'Maya Lin' }) {
  const out = (body, h) => ({ senderName: `${assistantName} (for ${clientName.split(' ')[0]})`, senderEmail: clientEmail, direction: 'outbound', body, sentAt: hoursAgo(h) });
  const inn = (name, email, body, h) => ({ senderName: name, senderEmail: email, direction: 'inbound', body, sentAt: hoursAgo(h) });

  const gmail = [
    {
      subject: 'Keynote invitation — TechSummit 2027 (Mar 14)',
      messages: [
        inn('Priya Raman', 'priya@techsummit.io', "Hi Arjun,\n\nWe'd be honored to have you deliver the closing keynote at TechSummit 2027 on March 14 in Lisbon (45 min + Q&A). We can offer a $15,000 speaker fee plus travel and two nights' accommodation.\n\nCould you let us know by Friday if you're interested? We're finalising the lineup next week.\n\nWarmly,\nPriya", 5),
      ],
      a: {
        responsibility: 'client_to_reply', confidence: 0.9, important: true, unread: true,
        reason: 'A speaking invitation is a personal decision about the client’s time and public profile.',
        why: 'You were personally invited to keynote — only you can decide whether to accept.',
        takeaway: 'Priya invites you to keynote TechSummit on Mar 14 — reply by Friday.',
        summary: '45-minute closing keynote in Lisbon on March 14 with a $15,000 fee, travel and two nights covered. They need an answer by Friday.',
        highlights: ['$15,000 speaker fee', 'Mar 14, Lisbon', 'Answer by Friday'],
        dates: [{ label: 'TechSummit keynote', dateText: 'March 14', isoDate: daysAhead(120), type: 'meeting' }, { label: 'Reply deadline', dateText: 'by Friday', isoDate: daysAhead(4), type: 'deadline' }],
        chips: [
          { label: 'Accept', intentPrompt: 'Accept the keynote invitation, thank Priya and ask for the logistics pack.', actionType: 'approve' },
          { label: 'Decline politely', intentPrompt: 'Politely decline the keynote due to existing commitments and suggest staying in touch for next year.', actionType: 'decline' },
          { label: 'Counter fee', intentPrompt: 'Say I am interested but my speaker fee is $20,000; ask if that works.', actionType: 'counter' },
        ],
        segments: ['action_required', 'important', 'meetings'],
      },
    },
    {
      subject: 'Podcast booking — Founders Unfiltered (logistics)',
      messages: [
        inn('Jordan Blake', 'jordan@foundersunfiltered.fm', 'Hi team, thanks for confirming Arjun for the episode! Could you share his preferred recording time next week, a short bio and a headshot? We record remotely over Riverside.', 30),
        out('Hi Jordan, great — Arjun is open Tuesday or Wednesday afternoon. I will send the bio and headshot shortly.', 26),
        inn('Jordan Blake', 'jordan@foundersunfiltered.fm', 'Perfect. Wednesday 2 PM works for us. Please send the bio + headshot by tomorrow so we can prep the show notes.', 3),
      ],
      a: {
        responsibility: 'assistant_to_reply', confidence: 0.93, unread: true,
        reason: 'Routine scheduling and asset logistics — no personal decision required.',
        takeaway: 'Podcast confirmed Wednesday 2 PM — send bio and headshot by tomorrow.',
        summary: 'The podcast team confirmed Wednesday at 2 PM and needs a short bio and headshot by tomorrow for show notes.',
        highlights: ['Wednesday 2 PM', 'Bio + headshot due tomorrow'],
        dates: [{ label: 'Podcast recording', dateText: 'Wednesday 2 PM', isoDate: daysAhead(4), type: 'meeting' }, { label: 'Send assets', dateText: 'by tomorrow', isoDate: daysAhead(1), type: 'deadline' }],
        segments: ['action_required', 'meetings'],
      },
    },
    {
      subject: 'Itinerary confirmation — SFO → LHR, Dec 2',
      messages: [
        inn('Skyline Travel', 'bookings@skyline-travel.com', 'Hello, your itinerary for Arjun Mehta is attached: SFO → LHR on December 2, departing 5:40 PM (BA286, Business). Please confirm the passport number on file and whether the aisle-seat preference should stay. Reply to confirm so we can ticket today.', 9),
      ],
      a: {
        responsibility: 'assistant_to_reply', confidence: 0.87, unread: true,
        reason: 'Travel logistics confirmation an assistant can complete using profile details on file.',
        takeaway: 'Confirm passport + seat preference to ticket SFO→LHR on Dec 2.',
        summary: 'Skyline Travel needs confirmation of passport details and seat preference to ticket the Dec 2 SFO→LHR flight today.',
        highlights: ['BA286 · Dec 2 · 5:40 PM', 'Business class', 'Confirm today'],
        dates: [{ label: 'Flight SFO → LHR', dateText: 'December 2, 5:40 PM', isoDate: daysAhead(17), type: 'meeting' }],
        segments: ['action_required', 'meetings'],
      },
    },
    {
      subject: 'Notion changelog — November updates',
      messages: [
        inn('Notion', 'notifications@notion.so', "What's new in Notion this month: AI meeting notes, faster databases, and improved mobile widgets. Read the full release notes on our blog. You're receiving this because you subscribed to product updates. Unsubscribe anytime.", 48),
      ],
      a: {
        responsibility: 'no_reply_needed', confidence: 0.98, unread: false,
        reason: 'Automated product newsletter — informational only, no request directed at the client.',
        takeaway: 'Notion product newsletter — nothing to do.',
        summary: 'Monthly product update newsletter from Notion with feature announcements.',
        highlights: [], dates: [], segments: ['general'],
      },
    },
    {
      subject: 'Accepted: Product sync — Thursday 11 AM',
      messages: [
        out('Hi team, confirming Arjun for Thursday 11 AM product sync.', 20),
        inn('Sam Okafor', 'sam@lumenlabs.io', 'Got it, thanks! See you then.', 18),
      ],
      a: {
        responsibility: 'no_reply_needed', confidence: 0.91, unread: false, status: 'completed',
        reason: 'Resolved scheduling thread — the other party simply acknowledged.',
        takeaway: 'Product sync confirmed for Thursday 11 AM — resolved.',
        summary: 'Thursday 11 AM product sync confirmed by Sam. No further action.',
        highlights: ['Thursday 11 AM'],
        dates: [{ label: 'Product sync', dateText: 'Thursday 11 AM', isoDate: daysAhead(3), type: 'meeting' }],
        segments: ['meetings'],
      },
    },
    {
      subject: 'Intro to Ravi (Stripe) — following up',
      messages: [
        out("Hi Ravi, Arjun asked me to follow up on the intro you offered to the Stripe Atlas team. Would a 20-minute call next week work? Happy to send times.", 52),
      ],
      a: {
        responsibility: 'no_reply_needed', confidence: 0.88, unread: false, status: 'waiting_response',
        reason: 'The last message was sent from this account — waiting on Ravi to reply.',
        takeaway: 'Waiting on Ravi to reply about the Stripe intro call.',
        summary: 'Follow-up sent asking Ravi for a 20-minute intro call next week. No response yet.',
        highlights: ['20-minute call', 'Sent 2 days ago'], dates: [], segments: ['waiting_response'],
      },
    },
  ];

  const outlook = [
    {
      subject: 'Series A — revised term sheet',
      messages: [
        inn('Sarah Chen', 'sarah.chen@northstarvc.com', "Arjun — thanks for the call. After partner discussion we can move to a $12M pre-money valuation with a $3M lead cheque and a standard 1x non-participating preference. We'd also like a board seat.\n\nWe'd need your decision by next Wednesday to hold the slot in our IC.\n\nSarah", 28),
        out('Hi Sarah, thank you — Arjun will review the terms with counsel and revert shortly.', 24),
        inn('Sarah Chen', 'sarah.chen@northstarvc.com', 'Understood. Flagging that the valuation is firm unless metrics beat plan before signing. Let me know if a quick call helps.', 4),
      ],
      a: {
        responsibility: 'client_to_reply', confidence: 0.97, important: true, unread: true, staged: true,
        reason: 'Investor term-sheet with valuation, board seat and a hard decision deadline — only the client can respond.',
        why: 'Northstar is asking you to accept or counter terms (valuation, board seat) with a decision due next Wednesday.',
        takeaway: 'Northstar offers $12M pre-money, $3M lead — decide by next Wednesday.',
        summary: 'Northstar Ventures proposes a $12M pre-money valuation, $3M lead cheque, 1x non-participating preference and a board seat. They say valuation is firm and need a decision by next Wednesday.',
        highlights: ['$12M pre-money', '$3M lead cheque', 'Board seat requested', 'Decision by next Wednesday'],
        dates: [{ label: 'Term sheet decision', dateText: 'by next Wednesday', isoDate: daysAhead(6), type: 'deadline' }],
        chips: [
          { label: 'Accept terms', intentPrompt: 'Accept the revised terms in principle, subject to final legal review, and say we are excited to move forward.', actionType: 'approve' },
          { label: 'Counter at $14M', intentPrompt: 'Thank Sarah and counter at a $14M pre-money valuation, keeping the rest of the terms as proposed.', actionType: 'counter' },
          { label: 'Need a call first', intentPrompt: 'Say I would like a quick call before deciding and propose Friday morning.', actionType: 'schedule' },
        ],
        segments: ['action_required', 'important'],
        pa: 'Counsel (Daniel) reviewed — terms are market. My recommendation: counter at $14M or request a call. Draft below is ready.',
        draft: "Hi Sarah,\n\nThank you for the update and the clear terms. We're excited about the partnership. Before we finalise, I'd welcome a short call on Friday morning to discuss the valuation and board composition.\n\nBest,\nArjun",
      },
    },
    {
      subject: 'Co-founder vesting amendment — signature needed',
      messages: [
        inn('Daniel Ortiz', 'daniel@ortizlaw.com', "Arjun, the vesting amendment for you and Sam is ready. It moves to a 4-year schedule with a 1-year cliff and double-trigger acceleration. This is a legal document — I need your signature on pages 3 and 7 before the board meeting on Dec 3. Please confirm you've reviewed the changes.", 14),
      ],
      a: {
        responsibility: 'client_to_reply', confidence: 0.94, important: true, unread: true,
        reason: 'Legal document requiring the client’s personal signature and confirmation.',
        why: 'This is a legal amendment that only you can review and sign.',
        takeaway: 'Sign the vesting amendment before the Dec 3 board meeting.',
        summary: 'Daniel prepared the co-founder vesting amendment (4-year, 1-year cliff, double-trigger acceleration). It needs your signature before the Dec 3 board meeting.',
        highlights: ['4-year vesting, 1-year cliff', 'Signature pages 3 & 7', 'Before Dec 3 board meeting'],
        dates: [{ label: 'Board meeting', dateText: 'Dec 3', isoDate: daysAhead(18), type: 'deadline' }],
        chips: [
          { label: 'Reviewed — will sign', intentPrompt: 'Confirm I have reviewed the changes and will sign pages 3 and 7 by the end of the week.', actionType: 'approve' },
          { label: 'Questions first', intentPrompt: 'Say I have a couple of questions on the acceleration clause and ask for a quick call.', actionType: 'schedule' },
        ],
        segments: ['action_required', 'important'],
      },
    },
    {
      subject: 'Partnership NDA — Helix Partners (for review)',
      messages: [
        inn('Marcus Webb', 'marcus@helixpartners.com', "Hi Arjun, attached is our mutual NDA ahead of the partnership discussions. Standard 2-year term. Can you confirm you're comfortable so we can share our confidential product roadmap?", 22),
      ],
      a: {
        responsibility: 'client_to_reply', confidence: 0.9, unread: true,
        reason: 'Confidential partnership agreement — requires the client’s approval.',
        why: 'An NDA commits you legally; your approval is needed before confidential information is shared.',
        takeaway: 'Helix wants you to approve a mutual 2-year NDA.',
        summary: 'Helix Partners sent a standard mutual NDA (2-year term) and will share a confidential roadmap once you approve.',
        highlights: ['Mutual NDA', '2-year term'], dates: [],
        chips: [
          { label: 'Approve NDA', intentPrompt: 'Confirm I am comfortable with the NDA and will countersign today.', actionType: 'approve' },
          { label: 'Legal to review', intentPrompt: 'Say our counsel will review the NDA and we will revert within two business days.', actionType: 'schedule' },
        ],
        segments: ['action_required', 'important'],
      },
    },
    {
      subject: 'Board dinner — Dec 3 (can we reschedule?)',
      messages: [
        inn('Elena Fischer', 'elena@lumenlabs.io', 'Hi! The venue for the Dec 3 board dinner had a double-booking. Could we move to Dec 4 at 7:30 PM, or keep Dec 3 at 6 PM at a different restaurant?', 36),
        out("Hi Elena, I'll check Arjun's calendar and confirm shortly.", 33),
        inn('Elena Fischer', 'elena@lumenlabs.io', "Thanks! I need to confirm the restaurant by Wednesday, so a quick answer would be ideal.", 6),
      ],
      a: {
        responsibility: 'assistant_to_reply', confidence: 0.95, unread: true, important: true,
        reason: 'Calendar rescheduling — the assistant can check availability and confirm.',
        takeaway: 'Board dinner: choose Dec 4 7:30 PM or Dec 3 6 PM elsewhere — answer by Wednesday.',
        summary: 'The Dec 3 venue is double-booked. Elena proposes moving to Dec 4 at 7:30 PM or keeping Dec 3 at 6 PM at another restaurant and needs an answer by Wednesday.',
        highlights: ['Dec 4 · 7:30 PM (option A)', 'Dec 3 · 6 PM (option B)', 'Answer by Wednesday'],
        dates: [{ label: 'Board dinner (A)', dateText: 'Dec 4 at 7:30 PM', isoDate: daysAhead(19), type: 'meeting' }, { label: 'Board dinner (B)', dateText: 'Dec 3 at 6 PM', isoDate: daysAhead(18), type: 'meeting' }, { label: 'Confirm venue', dateText: 'by Wednesday', isoDate: daysAhead(4), type: 'deadline' }],
        segments: ['action_required', 'meetings', 'important'],
      },
    },
    {
      subject: 'Invoice #4821 — question on line items',
      messages: [
        inn('Accounts, DesignCo', 'accounts@designco.studio', 'Hello, we noticed invoice #4821 ($3,400) is unpaid and the PO number is missing. Could you send the PO number and confirm the payment date?', 40),
      ],
      a: {
        responsibility: 'assistant_to_reply', confidence: 0.85, unread: false,
        reason: 'Routine billing/admin follow-up that an assistant can handle.',
        takeaway: 'DesignCo needs the PO number and payment date for invoice #4821.',
        summary: 'DesignCo asks for the missing PO number and a payment date for the unpaid $3,400 invoice #4821.',
        highlights: ['$3,400', 'Invoice #4821', 'PO number missing'], dates: [], segments: ['action_required'],
      },
    },
    {
      subject: 'CloudStack enterprise renewal — budget approval & new billing contact',
      messages: [
        inn('Taylor Reed', 'taylor@cloudstack.dev', "Hi Arjun's team, your CloudStack Enterprise plan renews on Dec 15. The new annual price is $48,000 (up 12%). Can you confirm the renewal and share an updated billing contact? We can discuss volume discounts if you'd like to talk.", 12),
      ],
      a: {
        responsibility: 'assistant_to_reply', confidence: 0.62, needsReview: true, unread: true,
        reason: 'Mixed signals: updating a billing contact is admin work, but approving a $48,000 renewal may need the client — please review.',
        takeaway: 'CloudStack renewal at $48,000 — who should approve?',
        summary: 'CloudStack renews on Dec 15 at $48,000 (+12%) and asks for confirmation plus a new billing contact. Ownership is unclear: admin follow-up versus a budget approval.',
        highlights: ['$48,000 (+12%)', 'Renews Dec 15', 'New billing contact needed'],
        dates: [{ label: 'CloudStack renewal', dateText: 'Dec 15', isoDate: daysAhead(30), type: 'deadline' }],
        segments: ['action_required', 'important'],
      },
    },
    {
      subject: 'Stripe payout — $8,214.50 is on its way',
      messages: [
        inn('Stripe', 'notifications@stripe.com', 'A payout of $8,214.50 has been initiated and should arrive in your bank account within 2 business days. This is an automated message — no action is needed.', 60),
      ],
      a: {
        responsibility: 'no_reply_needed', confidence: 0.97, unread: false,
        reason: 'Automated payout notification — no action required.',
        takeaway: 'Stripe payout of $8,214.50 is on its way.',
        summary: 'Automated notice that a $8,214.50 payout was initiated and arrives within 2 business days.',
        highlights: ['$8,214.50'], dates: [], segments: ['general'],
      },
    },
    {
      subject: 'Q4 offsite venue options',
      messages: [
        out('Hi Lena, sharing Arjun\'s shortlist for the Q4 offsite: Lisbon, Austin or Lake Tahoe. Could you send quotes for 25 people for each?', 70),
      ],
      a: {
        responsibility: 'no_reply_needed', confidence: 0.9, unread: false, status: 'waiting_response',
        reason: 'The last message was sent from this account — waiting on the venue coordinator.',
        takeaway: 'Waiting on Lena for Q4 offsite venue quotes.',
        summary: 'Asked the venue coordinator for quotes (25 people) for Lisbon, Austin and Lake Tahoe. No reply yet.',
        highlights: ['25 attendees', '3 candidate venues'], dates: [], segments: ['waiting_response'],
      },
    },
  ];

  return provider === 'outlook' ? outlook : gmail;
}

/** Splits seed into the two demo accounts. */
export function toConversationDocs({ items, ownerId, account }) {
  return items.map(({ subject, messages, a }) => {
    const last = messages[messages.length - 1];
    return {
      ownerId,
      accountId: account._id,
      clientName: account.clientName,
      provider: account.provider,
      subject,
      participants: Array.from(new Map(messages.map((m) => [m.senderEmail, { name: m.senderName, email: m.senderEmail }])).values()),
      snippet: last.body.replace(/\s+/g, ' ').slice(0, 140),
      messages,
      responsibility: a.responsibility,
      aiConfidence: a.confidence,
      needsReview: Boolean(a.needsReview),
      classificationReason: a.reason,
      clientActionWhy: a.why || '',
      responsibilityHistory: [{ from: null, to: a.responsibility, reason: a.reason, source: 'ai' }],
      oneLineTakeaway: a.takeaway,
      aiSummary: a.summary,
      highlights: a.highlights || [],
      extractedDates: a.dates || [],
      quickActionChips: a.chips || [],
      segments: a.segments,
      status: a.status || (last.direction === 'outbound' && !a.status ? 'waiting_response' : 'open'),
      isUnread: a.unread ?? false,
      isImportant: Boolean(a.important),
      stagedForClient: Boolean(a.staged),
      paContextNote: a.pa || '',
      draftReply: a.draft ? { body: a.draft, tone: 'executive', approved: false, updatedAt: new Date() } : undefined,
      lastMessageAt: last.sentAt,
    };
  });
}
