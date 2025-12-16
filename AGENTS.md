# UnifyNow Agent Guide

## Project Name
UnifyNow — Memorial Mason Workflow System

## Version
1.1 (Last updated: 16 December 2025)

## Core Purpose
To give memorial masons one calm, trustworthy place to manage every administrative aspect of an order — from first customer message to final installation — reducing scattered admin, preventing costly mistakes, and freeing time for the craft itself.

One-line pitch to a mason:  
“A single, straightforward screen that brings together WhatsApp, email, proofs, permits, materials, payments, and installations — so nothing falls through the cracks.”

## Primary Users
### Launch Target (v1–v2)
- Small to medium independent or family-run memorial masonry businesses (1–8 people)
- 10–50 orders per month
- Day-to-day user: Owner-operator or dedicated office administrator who handles customer communication, paperwork, and coordination

### Future Scalability (v3+)
- Larger workshops and multi-site operations (10–50+ people, multiple branches)
- Higher order volumes (50–200+/month)
- Role-based access (workshop staff, installers, accounts, managers)

## Geographic Strategy
- Primary launch market: United Kingdom (British tone, £ pricing, full GDPR compliance)
- Built with internationalisation in mind (currency, date formats, tax handling) to enable future expansion to Ireland, Australia, New Zealand, Canada, and other English-speaking markets

## Tone & Personality
- Humble, practical, quietly reassuring
- British understatement — no hype, no exaggerated claims
- Deep respect for the emotional sensitivity of the work and the legacy of family businesses
- Language: Clear, polite, concise, and human — as if written by a thoughtful colleague in the trade

## Key Principles
1. **Trust above all** — the app must never risk an inscription error, permit mistake, or payment issue
2. **User in full control** — AI only ever suggests; humans decide
3. **Simplicity over features** — every new element must clearly save more time than it costs to learn
4. **Calm interface** — minimal visual noise, generous whitespace, readable on older screens
5. **Transparency** — pricing, data usage, and AI suggestions always clear and upfront
6. **Resilient to real-world conditions** — works on slower connections, older phones/browsers, and briefly offline

## Must-Have Features for v1 (Minimum Chargeable Product)
These are non-negotiable for public launch and paid subscriptions:
1. Unified inbox
   - Email (IMAP/send via SMTP or provider)
   - WhatsApp (via official Meta Business API)
   - SMS (via Twilio or equivalent)
   - Threaded conversations linked to orders/customers
2. Proof workflow
   - Status tracking: Not Received → Inscription Received → Proof Sent → Proof Signed
   - AI suggestion for status changes with one-click approve/dismiss
3. Permit workflow
   - Digital form sending, return tracking, status (NA → Form Sent → Customer Completed → Pending → Approved)
   - File upload/storage for returned forms
4. Material tracking
   - Status: NA → Ordered → In Stock (with optional delivery date)
5. Payments & invoicing
   - Stripe integration for invoice creation, sending, and payment tracking
   - Offline invoice generation (PDF) with later sync
6. Orders & activity
   - Central order list/view with searchable, filterable table
   - Internal comments, @mentions, activity log per order
7. Job planning & installations
   - Basic scheduling/calendar view
   - Map view (Google Maps) showing installation locations, colour-coded pins, basic route suggestions
8. Team communication & notifications
   - Internal team chat (general + per-order channels)
   - In-app, email, and optional SMS/push notifications for key events
9. Dashboard
   - At-a-glance overview of active orders, pending proofs/permits/materials, upcoming installations

## AI & Automation Philosophy (Critical)
- AI is a helpful assistant, never an autonomous agent
- All AI detections (inscription shared, proof change request, payment received, etc.) are presented as explicit suggestions with visible context/evidence
- User must actively approve or dismiss every suggestion
- Easy undo/audit trail for every action
- No automatic status changes on high-sensitivity items (proofs, permits, payments)
- Confidence threshold tunable per workshop (default: conservative)

## Out of Scope for First 12–18 Months
- Native iOS/Android apps (progressive web app acceptable later)
- Automated design/proof generation
- Full accounting/ledger (beyond invoicing)
- Supplier ordering marketplace or automated PO generation
- Advanced analytics/BI tools
- Phone call recording or auto-transcription
- Cemetery regulation databases

## Technical Guidelines
- Repository: GitHub (primary)
- Development workflow: Cursor or similar AI-assisted editor for rapid prototyping
- Initial prototyping: Replit acceptable; production deployment on scalable platform (Vercel, Render, Fly.io, Railway, etc.)
- Frontend: React + Tailwind CSS (or similar) — responsive, mobile-friendly, desktop-optimised
- Backend: Node.js/Express or Next.js API routes
- Database: PostgreSQL or MongoDB (with strong preference for relational for order integrity)
- Authentication: JWT + email/password + optional OAuth (Google/Apple)
- Offline: Service workers + IndexedDB for limited functionality (invoice creation, order viewing, message drafting)
- Third-party services: Prioritise official APIs and cost control

## Monetisation Model
- Partnership-oriented, scales with customer success:
  - One-time setup/onboarding fee (covers data import, training, customisation)
  - Base monthly subscription (core platform access)
  - Incremental per-order fee (aligns incentives as business grows)
  - Optional paid add-on tier for advanced AI/agent features
- 14–30 day free trial (full access)
- Priced in GBP at launch; multi-currency support planned

## Data Protection & Privacy
- Data classification: Highly sensitive (personal details of bereaved families, deceased names/dates)
- Measures:
  - End-to-end encryption for sensitive fields where feasible
  - UK/EU data residency (preferred providers: AWS London, etc.)
  - Explicit consent for AI processing of messages
  - Full GDPR compliance (right to export/delete, data processing agreement)
  - No data sharing, selling, or training of external models

## Decision Framework (When in Doubt)
Apply this filter to every proposed feature, change, or design:
1. Does it meaningfully reduce admin time for a busy mason?
2. Does it introduce zero additional risk of an inscription, permit, or payment error?
3. Is it simple enough that a non-technical user can understand and trust it in under 5 minutes?

If any answer is “no” or “unclear” → simplify, delay, or remove.

## Maintenance
- Review and update this document after every major milestone, pricing change, or significant user feedback round
- Version number in header; keep change log below if needed

---

Agent.md is now robust, future-proof, and precise enough to guide development for years while remaining readable in one sitting.

Copy it into your repo root today — it will become one of your most valuable assets.

Would you like:
- A condensed one-page “quick reference” version?
- A checklist derived from the v1 must-haves for project tracking?
- Next steps (e.g., database schema outline, Figma wireframe prompts)?

Let me know how to help move forward.