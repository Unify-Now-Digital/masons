# Inbox Georgian Font Support — Implementation Plan

## 1. Root cause summary

Message body text is rendered with fonts that often lack Georgian glyphs:

- **Email formatted (iframe):** The iframe document is the email HTML. Email markup (inline styles or defaults) can specify fonts like Arial that do not support Georgian; the app does not override them.
- **Email raw view:** The raw `<pre>` uses Tailwind `font-sans`, a system stack that may not include a Georgian-capable font.
- **Plain text (SMS/WhatsApp / plain email):** No explicit font is set; content inherits the app default, which may not support Georgian.

So the issue is **font fallback**, not layout or encoding. Fix: apply a single message-body font stack that includes Georgian-capable fonts to all three rendering paths.

---

## 2. Exact files and code areas to update

| File | Area | Change |
|------|------|--------|
| **ConversationThread.tsx** | Top of file (after imports) | Add a shared constant for the message-body font stack (and optionally a helper that returns the iframe base style string). |
| **ConversationThread.tsx** | Line 299: raw view `<pre>` | Replace `font-sans` with the message-body font stack (via inline style or a single utility class). |
| **ConversationThread.tsx** | Lines 301–306: iframe `srcDoc` | Build `srcDoc` as: injected base `<style>...</style>` + `sanitizeHtml(body)` so the iframe document uses the same font stack. |
| **ConversationThread.tsx** | Lines 321–323: plain text `<p>` | Apply the message-body font stack to the `<p>` (inline style or class). |
| **InboxMessageBubble.tsx** | Line 80: body wrapper `div` | (Optional) Apply the same font stack to the wrapper so all body content inherits it. |

No changes to `sanitizeHtml()` logic (script/style/on*/meta stripping). No changes to layout, colors, or detection logic.

---

## 3. Minimal safe change plan

1. **Define the font stack once** (e.g. in ConversationThread.tsx as a constant):  
   `MESSAGE_BODY_FONT_STACK = '"Noto Sans Georgian", "Sylfaen", "Segoe UI", "Segoe UI Symbol", system-ui, sans-serif'`

2. **Raw `<pre>` (line 299):** Use inline style `style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}` and remove `font-sans` from the className. Keep all other classes.

3. **Plain text `<p>` (lines 321–323):** Add the same inline style `style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}` to the `<p>`. Keep existing className.

4. **Iframe srcDoc:** When building the string for `srcDoc`, use:  
   `MESSAGE_BODY_IFRAME_STYLE + sanitizeHtml(body)`  
   where `MESSAGE_BODY_IFRAME_STYLE` is a constant string containing a single `<style>` tag with a rule that sets the font stack on `html, body` (and optionally `body *`). Example:  
   `'<style>html,body,body *{font-family:"Noto Sans Georgian","Sylfaen","Segoe UI",system-ui,sans-serif}</style>'`  
   Do not allow user content inside the style tag; the constant is fully under our control.

5. **(Optional)** InboxMessageBubble.tsx: On the body wrapper div (line 80), add `style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}` if we export the constant from ConversationThread or define it in a shared inbox util. Alternatively skip this and rely on the three explicit applications above.

---

## 4. Where the shared font stack should live

| Option | Pros | Cons |
|--------|------|------|
| **Inline class/style per element** | No shared constant; each place uses a Tailwind arbitrary value or long string. | Duplication; if we change the stack we update multiple places. |
| **Shared constant/helper in ConversationThread** | Single source of truth; used for `<pre>`, `<p>`, and the iframe style string. Easy to maintain. | Constant lives in one component file. |
| **Shared constant in inbox utils (e.g. conversationUtils or new font constant file)** | Reusable by other inbox components; keeps ConversationThread slimmer. | One more file or export. |
| **Wrapper-level style in InboxMessageBubble only** | One place to set font; children inherit. | Iframe content does not inherit from parent (separate document); raw/plain would still need the stack unless we only set it on the wrapper and never use iframe. So wrapper alone is insufficient for iframe. |

**Recommendation:** Define a **shared constant** at the top of **ConversationThread.tsx** (e.g. `MESSAGE_BODY_FONT_STACK` and `MESSAGE_BODY_IFRAME_STYLE`). Use it for the raw `<pre>`, the plain `<p>`, and the iframe `srcDoc`. Optionally apply the same stack on **InboxMessageBubble** body wrapper by passing the constant from a small shared place (e.g. export from ConversationThread or add to `conversationUtils`) so the bubble can use it without duplicating the string. Prefer keeping the constant in ConversationThread unless we want to reuse it elsewhere; then move to something like `src/modules/inbox/utils/messageBodyFont.ts`.

---

## 5. How to inject the iframe base font safely without weakening sanitization

- **Do not** change `sanitizeHtml()` to allow user-controlled `<style>` or to parse and modify user HTML in complex ways. Keep stripping script, style, on*, and meta as today.
- **Do** build the iframe document as: **our own fixed string** + **sanitizeHtml(body)**.  
  - Our string is a constant, e.g. `'<style>html,body,body *{font-family:"Noto Sans Georgian","Sylfaen","Segoe UI",system-ui,sans-serif}</style>'`.  
  - It contains no user input. It is not passed through the sanitizer; we just concatenate it with the already-sanitized body.  
- **Result:** The iframe document starts with our style rule, then the sanitized email HTML. Email content cannot inject script or new style blocks; we only added a single font-family rule we control. Sanitization is unchanged; we are **prepending** safe content to the sanitized output, not relaxing the sanitizer.

---

## 6. Recommended final approach

1. **ConversationThread.tsx**
   - Add at top (after imports):  
     - `const MESSAGE_BODY_FONT_STACK = '"Noto Sans Georgian", "Sylfaen", "Segoe UI", "Segoe UI Symbol", system-ui, sans-serif';`  
     - `const MESSAGE_BODY_IFRAME_STYLE = '<style>html,body,body *{font-family:' + MESSAGE_BODY_FONT_STACK + '}</style>';`  
     (or build the style string once from the same stack constant.)
   - **Raw `<pre>`:** Remove `font-sans`, add `style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}`.
   - **Plain `<p>`:** Add `style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}`.
   - **iframe srcDoc:** Change from `srcDoc={sanitizeHtml(body)}` to `srcDoc={MESSAGE_BODY_IFRAME_STYLE + sanitizeHtml(body)}`.

2. **InboxMessageBubble.tsx (optional)**  
   - Import or receive the same font stack (e.g. export it from ConversationThread or from a tiny shared util).  
   - On the body wrapper div (line 80), add `style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}` so any future body content inherits.  
   - If we keep the constant only in ConversationThread, we can skip the bubble change and rely on the three explicit applications; then no export needed.

3. **No changes** to sanitizeHtml(), isLikelyHtml(), layout, colors, or global theme. No new dependencies unless we later add Noto Sans Georgian via fontsource/Google Fonts for broader coverage.

---

## 7. Regression checklist

| Check | Expected |
|-------|----------|
| **Georgian plain text** | Message with Georgian in SMS/WhatsApp or plain email body renders with readable Georgian glyphs. |
| **Georgian raw HTML email** | Email with Georgian in body; switch to “View raw”; raw `<pre>` shows Georgian correctly. |
| **Georgian formatted HTML email** | Email with Georgian in body; formatted view (iframe) shows Georgian correctly. |
| **English / Latin text** | Messages with only English or Latin script still look normal; no visual regression. |
| **Layout and colors** | No change to bubble size, padding, or colors; only font-family for body content. |
| **Sanitization** | Scripts and event handlers in email HTML remain stripped; no new XSS surface. |
| **Iframe behavior** | “View formatted” / “View raw” toggle still works; iframe still sandboxed and constrained. |
