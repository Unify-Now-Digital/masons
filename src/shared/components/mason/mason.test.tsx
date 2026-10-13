import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextActionPill, StatusSymbol, NextStepBox, ReplyTimer, StatusLegend } from './index';
import { permitStep, proofStep, stoneStep } from './stepState';
import { nextActionForOrder } from '@/shared/lib/nextAction';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('pills', () => {
  it('action pill shows icon + label, tinted unless solid', () => {
    const a = nextActionForOrder({ jobPaidAt: 'x', permitStatus: 'not_started' });
    const tinted = html(<NextActionPill action={a} />);
    expect(tinted).toContain('Send permit');
    expect(tinted).toContain('bg-gardens-act-permit-lt');
    expect(html(<NextActionPill action={a} solid />)).toContain('bg-gardens-act-permit text-white');
  });
  it('waiting renders a grey chip, never a button', () => {
    const out = html(<NextActionPill action={nextActionForOrder({ jobPaidAt: 'x', permitStatus: 'pending' })} />);
    expect(out).toContain('Waiting · cemetery');
    expect(out).toContain('data-kind="waiting"');
    expect(out).not.toContain('<button');
  });
  it('none renders nothing', () => {
    expect(html(<NextActionPill action={nextActionForOrder({ jobStage: 'complete' })} />)).toBe('');
  });
});

describe('status symbols', () => {
  it('symbol carries the state with an accessible label', () => {
    const out = html(<StatusSymbol state="blocked" stage="Permit" />);
    expect(out).toContain('!');
    expect(out).toContain('aria-label="Permit: blocked on us"');
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
    expect(permitStep('not_started')).toBe('blocked');
    expect(permitStep('not_started', false)).toBe('todo');
    expect(permitStep('pending')).toBe('progress');
    expect(proofStep('Revision')).toBe('blocked');
    expect(proofStep('Lettered')).toBe('done');
  });
});

describe('next-step box + timer', () => {
  it('only the reason line carries colour', () => {
    const out = html(
      <NextStepBox action={nextActionForOrder({ jobPaidAt: 'x', permitStatus: 'not_started' })}>
        <button type="button">Send permit to cemetery</button>
      </NextStepBox>,
    );
    expect(out).toContain('Next step');
    expect(out).toContain('data-tone="red"');
    expect(out).toContain('Blocked on us: permit not started');
    expect(out).toContain('bg-gardens-surf p-3');
  });
  it('timer shows words', () => {
    expect(html(<ReplyTimer timer={{ text: 'Overdue · 2d', tone: 'over' }} />)).toContain('Overdue · 2d');
  });
});
