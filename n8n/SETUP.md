# n8n Automation Setup — Churchill Memorials

## Overview

Two n8n workflows that automate the quote-to-follow-up pipeline:

1. **Quote Detector** — Watches your Gmail sent folder, detects quote emails, and moves the GHL contact to "Quote Sent"
2. **Quote Follow-up Sequence** — Runs daily at 9am, advances stale opportunities through the follow-up stages

## Flow Diagram

```
[You send a quote email]
        ↓
[Quote Detector workflow]
  Gmail Trigger (sent folder, every 5 min)
        ↓
  Filter: Subject starts with "Memorial:" + body has "SKU" + "50% deposit"
        ↓
  GHL API: Find contact by recipient email
        ↓
  GHL API: Move opportunity to "Quote Sent" stage
        ↓
[Follow-up Sequence workflow — runs daily 9am]
  Checks all open opportunities
        ↓
  Quote Sent → 3 days → Follow-up 1
  Follow-up 1 → 5 days → Follow-up 2
  Follow-up 2 → 7 days → Final Follow-up
  Final Follow-up → 14 days → Cold (marked as lost)
        ↓
  Sends a follow-up email for each stage (except Cold)
```

## Prerequisites

### 1. GHL Pipeline Stages

In your GoHighLevel Churchill Memorials pipeline, create these stages in order:

| Order | Stage Name      | Stage ID (copy from GHL URL) |
|-------|-----------------|------------------------------|
| 1     | New Lead        | `___________________________` |
| 2     | Quote Sent      | `___________________________` |
| 3     | Follow-up 1     | `___________________________` |
| 4     | Follow-up 2     | `___________________________` |
| 5     | Final Follow-up | `___________________________` |
| 6     | Won             | `___________________________` |
| 7     | Cold            | `___________________________` |

**How to find stage IDs:** In GHL, go to Opportunities → Pipeline Settings. Click each stage — the ID appears in the URL: `.../pipeline/PIPELINE_ID/stage/STAGE_ID`

### 2. GHL API Key

1. In GHL, go to **Settings → Business Profile → API Keys** (or Settings → Integrations → API)
2. Create a new API key with `contacts.readonly` and `opportunities.write` scopes
3. Copy the key — you'll paste it into n8n

### 3. Gmail OAuth2 in n8n

1. In n8n, go to **Credentials → Add Credential → Gmail OAuth2**
2. Follow the Google Cloud Console setup to create OAuth credentials
3. Grant access to your Churchill Memorials Gmail account

## Import & Configure

### Step 1: Import Workflows

1. Open n8n
2. Go to **Workflows → Import from File**
3. Import `quote-detector.workflow.json`
4. Import `quote-followup-sequence.workflow.json`

### Step 2: Replace Placeholder Values

In **both** workflows, find and replace these placeholders:

| Placeholder | Replace With |
|-------------|-------------|
| `REPLACE_WITH_GMAIL_CREDENTIAL_ID` | Your n8n Gmail OAuth2 credential ID |
| `REPLACE_WITH_GHL_CREDENTIAL_ID` | Your n8n HTTP Header Auth credential ID (GHL API key) |
| `REPLACE_WITH_PIPELINE_ID` | Your GHL pipeline ID |
| `REPLACE_WITH_QUOTE_SENT_STAGE_ID` | GHL "Quote Sent" stage ID |
| `REPLACE_WITH_FOLLOWUP1_STAGE_ID` | GHL "Follow-up 1" stage ID |
| `REPLACE_WITH_FOLLOWUP2_STAGE_ID` | GHL "Follow-up 2" stage ID |
| `REPLACE_WITH_FINAL_FOLLOWUP_STAGE_ID` | GHL "Final Follow-up" stage ID |
| `REPLACE_WITH_COLD_STAGE_ID` | GHL "Cold" stage ID |

### Step 3: Set Up GHL Credential in n8n

1. In n8n, go to **Credentials → Add Credential → Header Auth**
2. Header Name: `Authorization`
3. Header Value: `Bearer YOUR_GHL_API_KEY`
4. Name it "GHL API Key"

### Step 4: Test

1. Open the **Quote Detector** workflow
2. Click "Test Workflow" with a manual trigger
3. Send a test quote email with `Memorial:` in the subject, and `SKU` + `50% deposit` in the body
4. Verify the contact moves to "Quote Sent" in GHL

### Step 5: Activate

Toggle both workflows to **Active** in n8n.

## Quote Detection Rules

An email is flagged as a quote when **all three** conditions match:

1. Subject starts with `Memorial:` (followed by the quote number)
2. Body contains `SKU`
3. Body contains `50% deposit`

Additional markers available for tighter filtering (can be added to the Filter node):
- Body contains `Permit fee: £`
- Body contains `Next steps`

## Follow-up Timing

| Current Stage    | Days Before Advance | Next Stage      |
|-----------------|--------------------:|-----------------|
| Quote Sent      | 3 days              | Follow-up 1     |
| Follow-up 1     | 5 days              | Follow-up 2     |
| Follow-up 2     | 7 days              | Final Follow-up |
| Final Follow-up | 14 days             | Cold            |

To adjust timing, edit the conditions in the "Due for Follow-up?" node in the follow-up sequence workflow.
