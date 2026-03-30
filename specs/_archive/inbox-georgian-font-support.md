# Inbox Conversation Window — Font Support for Non-Latin Scripts (Georgian)

## Overview

**Problem:** In the Inbox conversation window, some message content does not render Georgian text correctly; the text appears with broken or unreadable glyphs in the message body area.

**Goal:** Make Georgian and other non-Latin scripts render correctly in the conversation/message window while preserving existing Inbox UI styling.

---

## 1. Components responsible for rendering the message body

| Component | File | Role |
|-----------|------|------|
| **ConversationThread** | `src/modules/inbox/components/ConversationThread.tsx` | Decides how each message body is rendered (plain text vs HTML), builds `bodyContent`, and passes it to the bubble. |
| **InboxMessageBubble** | `src/modules/inbox/components/InboxMessageBubble.tsx` | Wraps the body content in a styled container; does not set font-family on the body area. |

Message body source is `message.body_text` (from API/DB). No separate “prose” or rich-text component is used.

---

## 2. How messages are rendered

Logic in **ConversationThread.tsx** (around lines 283–324):

- **Email + HTML detected** (`isEmail && isLikelyHtml(body)`):  
  - **Formatted view:** Body is rendered inside an **iframe** via `srcDoc={sanitizeHtml(body)}`. The email’s raw (sanitized) HTML is the iframe document.  
  - **Raw view** (when user toggles “View raw”): Body is rendered in a `<pre className="text-xs whitespace-pre-wrap break-words font-sans">`.
- **Otherwise** (SMS, WhatsApp, or email without HTML):  
  - Body is rendered as **plain text** in `<p className={cn('text-sm whitespace-pre-wrap break-words', isEmail && 'break-all')}>{body}</p>`.

So we have three rendering paths: (1) **sanitized HTML in an iframe** (email formatted), (2) **plain text in a `<p>`** (SMS/WhatsApp or plain email), (3) **raw HTML in a `<pre>`** (email raw view).

---

## 3. Font-family styling currently applied

| Location | Current styling | File:line |
|----------|-----------------|-----------|
| **Raw HTML view** | `font-sans` on `<pre>` | ConversationThread.tsx:299 |
| **Plain text view** | No explicit font; inherits from parent | ConversationThread.tsx:321–323 |
| **Iframe (email HTML)** | iframe has `className="... bg-white text-slate-900"`; no font-family. The **document inside the iframe** is the email HTML. `sanitizeHtml()` does not strip inline styles or font-family from that HTML. | ConversationThread.tsx:301–306 |
| **Bubble wrapper** | `text-[13px] leading-relaxed text-slate-800` on the div that wraps `{children}`; no font-family | InboxMessageBubble.tsx:80 |
| **Global** | `tailwind.config.ts` does not override `fontFamily`. Tailwind default `font-sans` is typically a system stack (e.g. ui-sans-serif, system-ui, Segoe UI, etc.). `index.css` does not set a global font on `body`. | tailwind.config.ts, index.css |

So: the only explicit font in message body rendering is **font-sans** on the raw `<pre>`. Plain text inherits the app’s default (Tailwind/system). The iframe content uses whatever fonts are specified in the **email HTML** (inline styles or removed `<style>` blocks); the sanitizer leaves font-family in the email markup intact.

---

## 4. Incoming email HTML and font-family

`sanitizeHtml()` (ConversationThread.tsx, lines 25–31) only:

- Strips `<script>...</script>`
- Strips `<style>...</style>`
- Strips `on*` event attributes
- Strips `<meta>` tags

It does **not** strip or alter inline `style` attributes or `font-family` inside the email HTML. So if the email contains e.g. `<p style="font-family: Arial">` or a `<style>` that was removed but inline styles remain, the iframe document uses those fonts. Many common email fonts (Arial, Helvetica, Times New Roman, etc.) do **not** include Georgian glyphs, so the browser falls back to a generic or replacement glyphs and the text can appear broken.

So: **yes, incoming email HTML can effectively force a font that lacks Georgian support**, and the current sanitizer does not override it.

---

## 5. Font fallback vs encoding

- **Font fallback:** The observed behavior (broken/unreadable glyphs for Georgian) is consistent with fonts that lack Georgian coverage. The app uses (a) Tailwind’s default `font-sans` for the raw `<pre>`, (b) inherited system/default for plain text, and (c) email-specified fonts inside the iframe. Many of these do not support Georgian, so the browser cannot render the script correctly. **This is the primary cause.**
- **Encoding:** If `body_text` is stored and served as UTF-8 and the page is UTF-8 (typical for modern stacks), encoding is less likely to be the cause. If Georgian displayed correctly in another context (e.g. same data in another app or after copying), that would further point to font/rendering rather than encoding. Encoding issues would more often show as mojibake or wrong characters across the board, not only in the message body. So the spec treats this as a **font fallback problem** unless evidence of incorrect charset/encoding appears.

---

## 6. Root cause (exact)

- **Root cause:** Message body content is rendered using fonts that do not support the Georgian script:  
  - **Email formatted (iframe):** The email’s own HTML (with its font-family from inline styles or default) is displayed; that font often has no Georgian glyphs.  
  - **Email raw view:** Explicit `font-sans` (Tailwind’s default system stack) is used; that stack often does not include a Georgian-capable font.  
  - **Plain text:** Content inherits the app default (system/Tailwind); that default may not include Georgian.  
- **Exact files and areas:**  
  - **ConversationThread.tsx:** (1) Line 299: `<pre className="... font-sans">` for raw HTML. (2) Lines 301–306: iframe with `srcDoc={sanitizeHtml(body)}` and no injection of a Georgian-capable font. (3) Lines 321–323: plain text `<p>` with no font-family (inherits).  
  - **InboxMessageBubble.tsx:** Lines 80–82: wrapper div has no font-family.  
  - **sanitizeHtml()** (ConversationThread.tsx, 25–31): Preserves inline font-family in email HTML; does not inject a safe font stack.

---

## 7. Recommended fix

**Objective:** Ensure Georgian (and other non-Latin scripts that share the same need) render correctly in all three body rendering paths, with minimal change to existing Inbox UI.

**Approach:**

1. **Define a single “message body” font stack** that includes Georgian-capable fonts, for use wherever message body text is rendered. Example (system fonts first to avoid extra assets):  
   `"Noto Sans Georgian", "Sylfaen", "Segoe UI", "Segoe UI Symbol", system-ui, sans-serif`  
   - Sylfaen: Georgian on older Windows.  
   - Segoe UI: Includes Georgian on Windows 10+.  
   - Noto Sans Georgian: Good fallback; can be added via fontsource or Google Fonts if needed.  
   Use this stack for both the raw `<pre>` and the plain text `<p>` (and optionally the bubble body wrapper so all children inherit).

2. **ConversationThread.tsx — raw view (line 299):**  
   Replace `font-sans` with a class or inline style that uses the message-body font stack above (e.g. a new utility class such as `font-message-body` or inline `style={{ fontFamily: '...' }}`).

3. **ConversationThread.tsx — plain text (lines 321–323):**  
   Apply the same font stack to the `<p>` (e.g. same class or inline style) so plain SMS/WhatsApp/email text uses a Georgian-capable font.

4. **ConversationThread.tsx — iframe (email HTML):**  
   Ensure the iframe document uses the same font stack so email HTML content (which may specify Arial, etc.) still falls back to Georgian-capable fonts. Options:  
   - **Option A (recommended):** When building `srcDoc`, **inject a safe base style** after sanitization. For example, prepend a single `<style>` to the sanitized HTML:  
     `html, body, body * { font-family: "Noto Sans Georgian", "Sylfaen", "Segoe UI", system-ui, sans-serif; }`  
     (Avoid `!important` unless necessary so email styling can still override for non-script reasons if desired.)  
   - **Option B:** In `sanitizeHtml()`, strip or override inline `font-family` in style attributes and then inject the same base style. More invasive and may alter email layout; use only if Option A is insufficient.

5. **InboxMessageBubble.tsx (optional):**  
   If the bubble’s body wrapper (`div` with `text-[13px] leading-relaxed`, line 80) is given the same message-body font stack, all child content (plain text and any future inline content) will inherit it without repeating the class on every branch.

6. **Preserve existing UI:**  
   Do not change layout, colors, or non-font styling of the conversation window. Only add or adjust font-family for message body areas so Georgian (and similar scripts) render correctly.

**Implementation notes:**

- If “Noto Sans Georgian” is not loaded, the browser will use the next font in the stack that has Georgian (e.g. Sylfaen, Segoe UI). Adding `@fontsource/noto-sans-georgian` or a link to Google Fonts is optional for maximum compatibility.
- For the iframe, the injected `<style>` must be part of the string passed to `srcDoc` (e.g. `'<style>...</style>' + sanitizeHtml(body)`), and must not reintroduce unsafe content; only our own font rule.

---

## 8. What not to change

- Sanitization rules (script, event handlers, meta) and overall security of `sanitizeHtml()`.
- Layout, spacing, or colors of the conversation thread or message bubbles.
- How HTML vs plain text is detected (`isLikelyHtml`) or when the iframe vs `<p>` vs `<pre>` is used.
- Global theme or Tailwind config for the rest of the app, unless adding a single shared “message body” font stack that is used only in the Inbox message body areas.
