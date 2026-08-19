# T011 — Arin WhatsApp warning (DRAFT)

Status: DRAFT — Giorgi reviews and sends personally; never sent unreviewed, nothing is sent
from this session. Placeholder to fill before sending: [today/tonight].

---

Hey Arin — heads-up before I flip the switch on the quote pipeline change. Three things you'll
notice, all expected:

1) **Inbox**: 23 people's conversations that currently show "Existing order" will change to
"Enquiry". That badge was actually wrong — those people only ever requested quotes, never
placed an order; the system was counting their quote as an open order. This corrects it, but
it will look different from today.

2) **Customer "Edit Your Quote" links stop working** — and it's not just old emails. The
website will KEEP sending new quote emails containing an edit link, and that link will show an
error page until the website side updates their email template. The fix lives in their
codebase — I'm raising it in Wednesday's call. Nothing breaks on our side and no data is lost;
customers who want changes can reply or submit a fresh quote.

3) Related, and it strengthens the case for retiring this: we found the edit-quote feature has
been **corrupting data**. When a customer edited their quote, the site mangled the saved
product details — two real records (orders 251/252): size text cut off at a quote mark,
price/type/photo wiped. The original clean submission was preserved elsewhere, so nothing is
lost — but the feature we're switching off was actively damaging records.

Wednesday's call: I'll demo the new pipeline live (quotes now arrive as jobs in the pipeline
instead of fake orders), plus one decision for you: the 30 old quote "orders" still show on
the Orders page — the same ones you can't edit in the order drawer. Want them hidden from the
Orders page too, or left visible? Your call, one-time decision.

Going ahead with the switch [today/tonight] — shout if anything above is a surprise.

---

Exhibits backing each point (for Giorgi's reference, not for sending):
1. Badge flip — spec §User-visible changes; inboxBuckets.ts:62/:113 mechanism in research.md.
2. Fresh broken links — F2 resolution (20 Aug); quotes.js:237 token→order resolution;
   capture trigger starved (spec FR-005).
3. Corruption — research.md §V3: Q1/Q2 20 Aug, 28 match / 2 DIFFER (orders 251/252, person
   27c7b7ac…), enquiries.details clean on all 30. Kerb note: 251/252 details show
   type "Kerb Sets".
F3 — plan.md §Flags: orders-page visibility deliberately deferred to Arin's one-time call.
