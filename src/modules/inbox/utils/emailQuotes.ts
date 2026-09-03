/**
 * C11 — quoted-reply detection for inbox email bodies.
 *
 * Parse-and-mark in the parent; the frame's own stylesheet does the hiding. The marked
 * document is the ONLY document: `srcDoc` is byte-identical in both toggle states, and the
 * toggle flips one attribute on the frame's `documentElement`. No reload, no second build.
 *
 * Detection is deliberately narrow — see docs/handoff.md T20/T21 for the live marker census.
 * Everything not listed here is left visible on purpose: a bare `blockquote` with no class
 * and no `type=cite` (16 rows) is as often a customer quoting a spec as it is a reply quote,
 * and `hr` / `_____` rules and border-top styling are writer formatting at least as often as
 * they are separators.
 *
 * No regex in this file contains a non-ASCII source character: invisible codepoints in a
 * character class cannot be reviewed, and do not survive copy-paste reliably. Where one is
 * genuinely needed it is built from char codes (INVISIBLE_RE).
 */

/** Marks one quote region. Present on every element in a marked region, not just its root. */
export const QUOTE_MARK_ATTR = 'data-mason-quote';
/** `documentElement` dataset key (attribute `data-mason-quotes`) the toggle writes. */
export const QUOTE_ROOT_DATASET_KEY = 'masonQuotes';
export const QUOTE_ROOT_SHOWN = 'shown';

/**
 * Self-contained wrappers: the element and its subtree are the quote. Outermost match only.
 * `type=cite` matched case-insensitively (` i`) — Apple Mail and Thunderbird emit lowercase,
 * but the attribute value is case-sensitive in CSS by default and we have no reason to be.
 */
const QUOTE_WRAPPER_SELECTOR =
  'div.gmail_quote, div.gmail_quote_container, blockquote[type="cite" i], div.yahoo_quoted';

/**
 * Outlook trailing regions. Bound to these two ids ONLY: the element, an `<hr>` separator
 * immediately above it, and every following sibling. Outlook emits
 * `<div id="appendonsend"></div><hr><div id="divRplyFwdMsg">From: …</div><div>…quote…</div>`,
 * all as siblings, so there is no wrapper to match — 8 live rows are Outlook-only with no
 * blockquote at all. 28 rows carry divRplyFwdMsg without appendonsend, which is why the
 * preceding `<hr>` is included: otherwise a dangling rule floats under the visible text.
 */
const TRAILING_REGION_IDS = ['appendonsend', 'divRplyFwdMsg'] as const;

/**
 * ZWSP, ZWNJ, ZWJ and SHY (0x200B-0x200D, 0x00AD). These are the invisible characters JS
 * `\s` does NOT match, so they survive whitespace collapsing and would count as visible
 * text. U+00A0 NBSP and U+FEFF BOM are deliberately absent: `\s` already matches both, so
 * every `.replace(/\s+/g, ' ')` in this file handles them.
 *
 * Matched by codepoint rather than by a regex character class. Two earlier shapes were both
 * wrong: a class written with the literal characters is unreviewable in source, and a class
 * built from `String.fromCharCode` puts ZWJ between two members, which reads as a joined
 * grapheme sequence (eslint no-misleading-character-class, and it is a fair complaint —
 * inside `[...]` those four codepoints genuinely are ambiguous). A Set of codepoints has
 * neither problem and needs no non-ASCII source character.
 */
const INVISIBLE_CODEPOINTS: ReadonlySet<number> = new Set([0x200b, 0x200c, 0x200d, 0x00ad]);

function stripInvisible(s: string): string {
  let out = '';
  for (const ch of s) {
    if (!INVISIBLE_CODEPOINTS.has(ch.codePointAt(0) ?? 0)) out += ch;
  }
  return out;
}

/** "On … wrote:" attribution sitting OUTSIDE the wrapper (older Gmail markup). */
const ATTRIBUTION_RE = /\bon\b[\s\S]*\bwrote:\s*$/i;
/** An attribution is one line of prose. Anything longer is content that happens to end in "wrote:". */
const ATTRIBUTION_MAX_CHARS = 300;

/**
 * Abort floor. Visible text below this AND no visible image ⇒ mark nothing.
 *
 * Kept low deliberately. Live, across the 332 gmail_quote rows, the visible remainder is 0
 * chars on 2 rows and 6-9 chars on 4 more ("Thank you", "Hi <name>"); a floor of 10 would
 * abort on exactly the short replies this feature exists for. Nothing live sits between 1
 * and 5, so the number itself is not what does the work — `measureVisible` is, by refusing
 * to count a remainder with no letter or digit in it.
 *
 * A genuine one-character reply ("K") renders unstripped. Accepted.
 */
const MIN_VISIBLE_TEXT_CHARS = 2;

const FULL_DOC_HEAD_SAMPLE_LEN = 12000;

/** Moved here from ConversationThread: serialization below must take the same branch. */
export function isFullHtmlDocument(html: string): boolean {
  const s = html.slice(0, FULL_DOC_HEAD_SAMPLE_LEN);
  return (
    /<!doctype/i.test(s) ||
    /<html[\s>]/i.test(s) ||
    (/<head[\s>]/i.test(s) && /<body[\s>]/i.test(s))
  );
}

export interface EmailHtmlQuoteParse {
  kind: 'html';
  /** Marked HTML, or the input string unchanged (same reference) when hasQuote is false. */
  html: string;
  hasQuote: boolean;
}

export interface EmailTextQuoteParse {
  kind: 'text';
  visible: string;
  quoted: string;
}

export type EmailQuoteParse = EmailHtmlQuoteParse | EmailTextQuoteParse | { kind: 'none' };

function markElement(el: Element, marked: Element[]): void {
  if (el.hasAttribute(QUOTE_MARK_ATTR)) return;
  el.setAttribute(QUOTE_MARK_ATTR, '');
  marked.push(el);
}

function hasMarkedAncestor(el: Element): boolean {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.hasAttribute(QUOTE_MARK_ATTR)) return true;
  }
  return false;
}

/** `\s+` collapsing covers the NBSP that Gmail puts through attribution lines. */
function looksLikeAttribution(el: Element): boolean {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > ATTRIBUTION_MAX_CHARS) return false;
  return ATTRIBUTION_RE.test(text);
}

/** Text and images that survive marking — the abort guard's input. */
function measureVisible(body: HTMLElement): { chars: number; images: number } {
  let text = '';
  let images = 0;
  const walk = (node: Element): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.nodeValue ?? '';
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      if (el.hasAttribute(QUOTE_MARK_ATTR)) continue;
      if (el.tagName === 'IMG' && (el.getAttribute('src') ?? '').trim()) images += 1;
      walk(el);
    }
  };
  walk(body);
  /**
   * A document whose entire visible remainder is one invisible artifact would clear a pure
   * character count, so those are dropped first and the remainder must carry at least one
   * letter or digit. That is what rejects a stray "-" or "|" — which a floor of 10 would
   * also reject, but only by also rejecting "Thank you" and "Hi <name>", both live.
   */
  const visible = stripInvisible(text).replace(/\s+/g, ' ').trim();
  if (!/[\p{L}\p{N}]/u.test(visible)) return { chars: 0, images };
  return { chars: visible.length, images };
}

/**
 * Rebuilt verbatim rather than normalised to `<!DOCTYPE html>`: an XHTML 1.0 Transitional
 * doctype with no systemId puts the frame in almost-standards mode, where the inline-image
 * gap in table cells disappears. Flipping that would move pixels in table-based email.
 */
function serializeDoctype(dt: DocumentType | null): string {
  if (!dt) return '';
  const pub = dt.publicId ? ` PUBLIC "${dt.publicId}"` : '';
  const sys = dt.systemId ? (dt.publicId ? ` "${dt.systemId}"` : ` SYSTEM "${dt.systemId}"`) : '';
  return `<!DOCTYPE ${dt.name}${pub}${sys}>`;
}

/**
 * Pass **sanitized** HTML (script/style/on* already stripped) — the same string that would
 * otherwise go straight to buildEmailIframeSrcDoc.
 *
 * When nothing is marked the input string is returned unchanged, so the ~435 of 786 rows
 * with no known marker keep today's exact srcDoc bytes and carry zero regression risk. Only
 * a marked document is re-serialized, and re-serialization is the browser's own parse →
 * serialize round-trip (implied `<tbody>`, quoted attributes, re-encoded entities) — the
 * same normalisation the iframe would perform on load anyway.
 */
export function parseEmailHtmlQuotes(sanitizedHtml: string): EmailHtmlQuoteParse {
  const unmarked: EmailHtmlQuoteParse = { kind: 'html', html: sanitizedHtml, hasQuote: false };
  if (!sanitizedHtml.trim() || typeof DOMParser === 'undefined') return unmarked;

  try {
    const doc = new DOMParser().parseFromString(sanitizedHtml, 'text/html');
    const body = doc.body;
    if (!body) return unmarked;

    const marked: Element[] = [];

    // Trailing regions first: a region can swallow a wrapper, and marking it first lets the
    // wrapper pass's ancestor/self check do the de-duplication for free.
    for (const id of TRAILING_REGION_IDS) {
      const anchor = body.querySelector(`#${CSS.escape(id)}`);
      if (!anchor || hasMarkedAncestor(anchor)) continue;
      const separator = anchor.previousElementSibling;
      if (separator && separator.tagName === 'HR') markElement(separator, marked);
      for (let n: Element | null = anchor; n; n = n.nextElementSibling) markElement(n, marked);
    }

    // Document order ⇒ outermost wrapper is visited first.
    for (const el of Array.from(body.querySelectorAll(QUOTE_WRAPPER_SELECTOR))) {
      if (el.hasAttribute(QUOTE_MARK_ATTR) || hasMarkedAncestor(el)) continue;
      markElement(el, marked);
      const prev = el.previousElementSibling;
      if (prev && !prev.hasAttribute(QUOTE_MARK_ATTR) && looksLikeAttribution(prev)) {
        markElement(prev, marked);
      }
    }

    if (marked.length === 0) return unmarked;

    const visible = measureVisible(body);
    if (visible.chars < MIN_VISIBLE_TEXT_CHARS && visible.images === 0) return unmarked;

    const html = isFullHtmlDocument(sanitizedHtml)
      ? serializeDoctype(doc.doctype) + (doc.documentElement?.outerHTML ?? body.innerHTML)
      : body.innerHTML;

    return { kind: 'html', html, hasQuote: true };
  } catch {
    return unmarked;
  }
}

/**
 * Plain-text path. Built now on 8 live rows, but a revoked Gmail connection sends all 786
 * HTML rows down this branch (T20 ruling 5).
 *
 * Cut at the first anchored "On … wrote:" line or the first `>`-prefixed line, whichever
 * comes first. Below the cut, every non-blank line must be `>`-prefixed and at least one
 * must be — a writer replying UNDER the quote, or an Outlook plain-text quote with no `>`
 * prefixes, returns null and renders exactly as today.
 *
 * Known limitation: the attribution must be one line. A wrapped
 * "On Tue, 1 Jul 2026 at 10:03,\nJane <j@x> wrote:" leaves its first line visible above the
 * toggle, because the second line is matched by the `>`-run rule and not by the anchor.
 */
export function parsePlainTextQuote(text: string): EmailTextQuoteParse | null {
  const raw = text ?? '';
  if (!raw.trim()) return null;

  const lines = raw.split('\n');
  const isQuoteLine = (l: string) => /^\s*>/.test(l);
  // `\s*` at both ends absorbs the NBSP some clients pad attribution lines with.
  const isAttributionLine = (l: string) => /^\s*on\b.*\bwrote:\s*$/i.test(l);

  let cut = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isQuoteLine(lines[i]) || isAttributionLine(lines[i])) {
      cut = i;
      break;
    }
  }
  if (cut <= 0) return null;

  const before = lines.slice(0, cut);
  if (!before.some((l) => l.trim())) return null; // floor: needs a non-blank line above

  const after = lines.slice(cut);
  if (!after.some(isQuoteLine)) return null; // attribution with nothing quoted under it
  if (!after.slice(1).every((l) => !l.trim() || isQuoteLine(l))) return null;

  return { kind: 'text', visible: before.join('\n').replace(/\s+$/, ''), quoted: after.join('\n') };
}
