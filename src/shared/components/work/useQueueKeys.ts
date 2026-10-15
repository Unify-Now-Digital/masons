import { useEffect, useRef } from 'react';
import type { WorkItem } from '@/shared/work/types';

export type QueueCommand =
  | { type: 'select'; id: string }
  | { type: 'open'; item: WorkItem }
  | { type: 'act'; item: WorkItem }
  | { type: 'send'; item: WorkItem }
  | { type: 'done'; item: WorkItem };

/** True when keystrokes belong to a text field (input, textarea, select, contenteditable). */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el.isContentEditable;
}

/** Pure key → command mapping (unit-tested). j/k ↓/↑ move · Enter open · a act · e send draft · d done. */
export function queueCommand(key: string, items: WorkItem[], selectedId: string | null): QueueCommand | null {
  if (!items.length) return null;
  const idx = items.findIndex((i) => i.id === selectedId);
  const cur = idx >= 0 ? items[idx] : null;
  switch (key) {
    case 'j': case 'ArrowDown': return { type: 'select', id: items[idx < 0 ? 0 : Math.min(idx + 1, items.length - 1)].id };
    case 'k': case 'ArrowUp': return { type: 'select', id: items[idx < 0 ? 0 : Math.max(idx - 1, 0)].id };
    case 'Enter': return cur ? { type: 'open', item: cur } : null;
    case 'a': return cur ? { type: 'act', item: cur } : null;
    case 'e': return cur?.draftReady ? { type: 'send', item: cur } : null;
    case 'd': return cur ? { type: 'done', item: cur } : null;
    default: return null;
  }
}

export interface UseQueueKeysOptions {
  items: WorkItem[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  onAct: (item: WorkItem) => void;
  onDone: (item: WorkItem) => void;
  onOpen?: (item: WorkItem) => void;
  /** Send the prepared draft; falls back to onAct when omitted. */
  onSend?: (item: WorkItem) => void;
  enabled?: boolean;
}

/** Keyboard queue for a WorkRow list (C.3). Ignored while typing or with a modifier held. */
export function useQueueKeys(opts: UseQueueKeysOptions): void {
  const ref = useRef(opts);
  ref.current = opts;
  const enabled = opts.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const o = ref.current;
      const cmd = queueCommand(e.key, o.items, o.selectedId);
      if (!cmd) return;
      e.preventDefault();
      if (cmd.type === 'select') o.setSelectedId(cmd.id);
      else if (cmd.type === 'open') o.onOpen?.(cmd.item);
      else if (cmd.type === 'act') o.onAct(cmd.item);
      else if (cmd.type === 'send') (o.onSend ?? o.onAct)(cmd.item);
      else o.onDone(cmd.item);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
