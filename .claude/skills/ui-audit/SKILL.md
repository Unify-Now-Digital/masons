---
name: ui-audit
description: Inventory every interactive element and visible text node on one route (selector, label, screenshots at 1440/390) and tag each USED / UNUSED / DUPLICATE against docs/traces/*.md and docs/walkthrough.md. Output docs/ux/<route>.md. Read-only. Uses Playwright MCP when present; static JSX enumeration via auditor otherwise.
argument-hint: <route path, e.g. /dashboard/orders>
---

Read-only; never edits `src/`. Output written by CC to `docs/ux/<route-slug>.md` after Giorgi sees it.

## Dependency
Playwright MCP is scheduled for Sprint B and is not installed yet. Check the tool list for `mcp__playwright__*` (or the configured server name). If absent, run the **static fallback** below and put this line first in the output header: `Mode: STATIC (Playwright MCP not available) — element list derived from JSX, not the rendered DOM; no screenshots.`

## Purpose
Per-route inventory of UI surface so unused and duplicated controls are visible before any UX or token pass.

## Inputs
`$ARGUMENTS` = route path. Route slug for the filename: strip leading `/`, replace `/` with `-`.

## Steps
1. Resolve route → component tree: `src/pages/Dashboard.tsx` nested routes and `src/App*.tsx`; note the page component and every child component rendered by it (auditor greps imports two levels down).
2. **Live mode (Playwright MCP present):** navigate to `https://staging.unifynow.digital<route>` as the E2E user (credentials from `.env.e2e`; never the live orgs). Enumerate `button, a[href], input, select, textarea, [role=button], [role=tab], [role=menuitem]` and visible text nodes → `selector | tag/role | label/text | disabled? | visible at 1440 | visible at 390`. Screenshot at 1440×900 and 390×844; save under `docs/ux/screens/<route-slug>-{1440,390}.png`.
   **Static fallback (auditor):** enumerate the same element kinds from JSX in the resolved component files: `file:line | element | label (literal or i18n key or expression) | handler (onClick/onSubmit name) | conditional render guard`. State that widths and visibility are not verifiable statically.
3. Cross-reference: for each element with a handler or href, grep `docs/traces/*.md` for the handler/mutation name and `docs/walkthrough.md` for the label. Tag **USED** (evidence in either), **UNUSED** (no evidence in either — this is absence of documentation, not proof of dead UI; say so), **DUPLICATE** (same label + same handler/target appears more than once on the route, or the same handler is reachable from two labels). If `docs/walkthrough.md` or `docs/traces/` are missing, state that in the header and tag only DUPLICATE/USED-by-trace.
4. Show the file to Giorgi before writing.

## Output
`docs/ux/<route-slug>.md`: header (route, mode, date, components resolved, evidence sources present/absent), element table, tag summary counts, `## Open questions`. Screenshots only in live mode.

## Rules
- Read-only; never edits `src/`. Live mode logs in only as the E2E user; never creates, edits or deletes records — navigation and reads only.
- No customer data in screenshots: the E2E org holds only fixtures; if a screenshot would show another org's data, stop and report.
