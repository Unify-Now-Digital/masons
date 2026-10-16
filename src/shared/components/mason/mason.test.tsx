import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextActionPill, StatusSymbol, NextStepBox, ReplyTimer, StatusLegend } from './index';
import { stoneStep } from './stepState';
import { nextActionForOrder } from '@/shared/lib/nextAction';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('pills', () => {
  it('action pill shows icon + label, tinted unless solid', () => {
    const a = nextActionForOrder({});
    const tinted = html(<NextActionPill action={a} />);
    expect(tinted).toContain('Request deposit');
    expect(tinted).toContain('bg-gardens-na-red-lt');
    expect(html(<NextActionPill action={a} solid />)).toContain('bg-gardens-na-red text-gardens-na-on');
  });
  it('waiting renders a blue info chip, never a button', () => {
    const out = html(<NextActionPill action={{ kind: 'waiting', label: 'Waiting · customer', reason: '', tone: 'neutral', waitingOn: 'customer' }} />);
    expect(out).toContain('Waiting · customer');
    expect(out).toContain('data-kind="waiting"');
    expect(out).not.toContain('<button');
  });
  it('none renders nothing', () => {
    expect(html(<NextActionPill action={nextActionForOrder({ jobStage: 'complete' })} />)).toBe('');
  });
});

describe('status symbols', () => {
  it('symbol carries the state with an accessible label', () => {
    const out = html(<StatusSymbol state="blocked" stage="Stone" />);
    expect(out).toContain('!');
    expect(out).toContain('aria-label="Stone: blocked on us"');
    expect(html(<StatusSymbol state="done" stage="Stone" />)).toContain('✓');
    expect(html(<StatusSymbol state="unknown" stage="Install" />)).toContain('border-dashed');
  });
  it('legend lists all five', () => {
    const out = html(<StatusLegend />);
    for (const s of ['✓', '◐', '!', '○', '?']) expect(out).toContain(s);
  });
  it('maps existing statuses to states', () => {
    expect(stoneStep('In Stock')).toBe('done');
    expect(stoneStep(null)).toBe('unknown');
  });
});

describe('next-step box + timer', () => {
  it('only the reason line carries colour', () => {
    const out = html(
      <NextStepBox action={nextActionForOrder({})}>
        <button type="button">Request deposit</button>
      </NextStepBox>,
    );
    expect(out).toContain('Next step');
    expect(out).toContain('data-tone="red"');
    expect(out).toContain('No deposit recorded yet');
    expect(out).toContain('bg-gardens-surf');
    expect(out).toContain('data-variant="neutral"');
  });
  it('timer shows words', () => {
    expect(html(<ReplyTimer timer={{ text: 'Overdue · 2d', tone: 'over' }} />)).toContain('Overdue · 2d');
  });
});

describe('joined next-step box', () => {
  it('is tinted and barred like the selected row', () => {
    const out = html(<NextStepBox action={nextActionForOrder({})} variant="joined" />);
    expect(out).toContain('data-variant="joined"');
    expect(out).toContain('bg-gardens-acc-lt');
    expect(out).toContain('border-l-[3px]');
  });
});
