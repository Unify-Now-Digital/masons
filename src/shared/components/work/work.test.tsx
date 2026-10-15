import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WorkItem } from '@/shared/work/types';
import { ActionPill } from '@/shared/components/mason/ActionPill';
import { WorkRow } from './WorkRow';
import { LaneStrip } from './LaneStrip';
import { laneCells } from './laneCells';
import { QueueKeysHint } from './QueueKeys';
import { queueCommand, isTypingTarget } from './useQueueKeys';
import { formatValue } from './format';

const NOW = new Date('2026-10-15T12:00:00Z');
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const item = (o: Partial<WorkItem> = {}): WorkItem => ({
  id: 'permit:o1', lane: 'permit', stage: 'submitted', verb: 'chase_council', blockedBy: 'them', since: '2026-09-20T12:00:00Z',
  dueAt: null, urgency: 'overdue', value: 2180, valueIsEstimate: false, orderId: 'o1', personId: null, conversationId: null,
  title: 'Fixture Name', ref: '#101', blocker: 'Council has not responded', draftReady: false, ownerId: null, ...o,
});
const noop = () => {};

describe('ActionPill extension', () => {
  it('stays a read-only span without onClick, becomes a real button with it', () => {
    expect(html(<ActionPill kind="follow" label="Reply" />)).toMatch(/^<span/);
    expect(html(<ActionPill kind="follow" label="Reply" onClick={noop} />)).toMatch(/^<button type="button"/);
  });
  it('muted uses neutral --g surface tokens', () => {
    expect(html(<ActionPill kind="follow" label="Reply" muted />)).toContain('bg-gardens-surf2');
  });
});

describe('WorkRow', () => {
  it('renders test ids, lane/urgency data, red bar and the verb label', () => {
    const out = html(<WorkRow item={item()} onOpen={noop} onAct={noop} now={NOW} />);
    expect(out).toContain('data-testid="work-row"');
    expect(out).toContain('data-lane="permit"');
    expect(out).toContain('data-urgency="overdue"');
    expect(out).toContain('role="row"');
    expect(out).toContain('aria-selected="false"');
    expect(out).toContain('bg-gardens-na-red');
    expect(out).toContain('Chase council');
    expect(out).toContain('£2,180');
    expect(out).not.toContain('Permits'); // lane tag only when showLane
  });
  it('shows ✦ only when draftReady, never in the label text', () => {
    expect(html(<WorkRow item={item()} onOpen={noop} onAct={noop} now={NOW} />)).not.toContain('work-row-draft');
    const out = html(<WorkRow item={item({ draftReady: true })} onOpen={noop} onAct={noop} now={NOW} />);
    expect(out).toContain('work-row-draft');
    expect(out).toContain('>Chase council<');
  });
  it('waiting rows get a slate bar, a neutral pill and the lane tag when asked', () => {
    const out = html(<WorkRow item={item({ urgency: 'waiting' })} onOpen={noop} onAct={noop} showLane rankNumber={3} now={NOW} />);
    expect(out).toContain('bg-gardens-na-blue');
    expect(out).toContain('data-colour="neutral"');
    expect(out).toContain('Permits');
    expect(out).toMatch(/>3</);
  });
  it('value convention', () => {
    expect(formatValue({ value: 2180, valueIsEstimate: false })).toEqual({ text: '£2,180', muted: false });
    expect(formatValue({ value: 2180, valueIsEstimate: true })).toEqual({ text: 'est. £2,180', muted: true });
    expect(formatValue({ value: null, valueIsEstimate: false })).toEqual({ text: '—', muted: true });
  });
});

describe('LaneStrip', () => {
  it('marks: ✓ terminal, ● ours, ○ theirs, – not started', () => {
    const cells = laneCells(
      [item({ lane: 'proof', stage: 'changes_requested', blockedBy: 'us', urgency: 'due' }), item()],
      { sales: 'won' },
    );
    expect(cells.map((c) => `${c.lane}:${c.mark}`)).toEqual(['sales:done', 'permit:them', 'proof:us', 'payment:idle']);
  });
  it('compact shows marks only; full shows lane + stage word', () => {
    const compact = html(<LaneStrip items={[item()]} size="compact" />);
    expect(compact).toContain('data-size="compact"');
    expect(compact).toContain('○');
    expect(compact).not.toContain('>Submitted<');
    const full = html(<LaneStrip items={[item()]} stages={{ sales: 'won' }} />);
    expect(full).toContain('Submitted');
    expect(full).toContain('Payments');
    expect(full).toContain('✓');
  });
});

describe('queue keys', () => {
  const items = [item({ id: 'a' }), item({ id: 'b', draftReady: true }), item({ id: 'c' })];
  it('j/k and arrows move, clamped at the ends', () => {
    expect(queueCommand('j', items, null)).toEqual({ type: 'select', id: 'a' });
    expect(queueCommand('j', items, 'a')).toEqual({ type: 'select', id: 'b' });
    expect(queueCommand('ArrowDown', items, 'c')).toEqual({ type: 'select', id: 'c' });
    expect(queueCommand('k', items, 'b')).toEqual({ type: 'select', id: 'a' });
    expect(queueCommand('ArrowUp', items, 'a')).toEqual({ type: 'select', id: 'a' });
  });
  it('enter / a / d act on the selection; e only when a draft is ready', () => {
    expect(queueCommand('Enter', items, 'a')).toMatchObject({ type: 'open' });
    expect(queueCommand('a', items, 'a')).toMatchObject({ type: 'act' });
    expect(queueCommand('d', items, 'a')).toMatchObject({ type: 'done' });
    expect(queueCommand('e', items, 'a')).toBeNull();
    expect(queueCommand('e', items, 'b')).toMatchObject({ type: 'send' });
    expect(queueCommand('a', items, null)).toBeNull();
    expect(queueCommand('x', items, 'a')).toBeNull();
  });
  it('ignores typing targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: false } as unknown as EventTarget)).toBe(false);
  });
  it('hint is desktop-only', () => {
    expect(html(<QueueKeysHint />)).toContain('hidden lg:block');
  });
});
