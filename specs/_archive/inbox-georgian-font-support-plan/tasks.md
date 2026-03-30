# Tasks: Inbox Georgian font support

## Task 1 — Add message-body font stack constant and iframe style

- [x] **File:** `src/modules/inbox/components/ConversationThread.tsx`
- [ ] **Where:** Top of file, after imports and before `formatBubbleTimestamp`.
- [ ] **Add:**
  - `const MESSAGE_BODY_FONT_STACK = '"Noto Sans Georgian", "Sylfaen", "Segoe UI", "Segoe UI Symbol", system-ui, sans-serif';`
  - `const MESSAGE_BODY_IFRAME_STYLE = '<style>html,body,body *{font-family:' + MESSAGE_BODY_FONT_STACK + '}</style>';`

## Task 2 — Apply font stack to raw HTML view (pre)

- [x] **File:** `src/modules/inbox/components/ConversationThread.tsx`
- [ ] **Where:** Line 299, the `<pre>` for raw email body.
- [ ] **Change:** Remove `font-sans` from className. Add `style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}`.
- [ ] **Keep:** `text-xs whitespace-pre-wrap break-words`.

## Task 3 — Apply font stack to plain text view (p)

- [x] **File:** `src/modules/inbox/components/ConversationThread.tsx`
- [ ] **Where:** Lines 321–323, the `<p>` for plain text body.
- [ ] **Change:** Add `style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}` to the `<p>`.
- [ ] **Keep:** Existing className unchanged.

## Task 4 — Inject base font style into iframe srcDoc

- [x] **File:** `src/modules/inbox/components/ConversationThread.tsx`
- [ ] **Where:** Line 304, the iframe `srcDoc` prop.
- [ ] **Change:** From `srcDoc={sanitizeHtml(body)}` to `srcDoc={MESSAGE_BODY_IFRAME_STYLE + sanitizeHtml(body)}`.
- [ ] **Do not** modify `sanitizeHtml()`.

## Task 5 — (Optional) Apply font stack on InboxMessageBubble body wrapper

- [ ] **File:** `src/modules/inbox/components/InboxMessageBubble.tsx`
- [ ] **Where:** Line 80, the div that wraps `{children}` (body content).
- [ ] **Change:** Add inline style with the same font stack. Requires exporting or redefining the constant (e.g. move to shared util or pass as prop). Can be skipped and rely on Tasks 2–4 only.

## Task 6 — Regression check

- [ ] Georgian plain text message: readable.
- [ ] Georgian in email raw view: readable.
- [ ] Georgian in email formatted view (iframe): readable.
- [ ] English/Latin messages: no visual regression.
- [ ] Layout and colors unchanged; sanitization unchanged.
