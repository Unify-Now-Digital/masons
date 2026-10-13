import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AskAiPanelView, type AskAiViewState } from './AskAiPanelView';

const render = (state: AskAiViewState, prompts: string[] = ['Which orders are overdue?']) =>
  renderToStaticMarkup(
    <AskAiPanelView state={state} draft="" prompts={prompts} onDraftChange={() => {}} onAsk={() => {}} />,
  );

describe('AskAiPanelView states', () => {
  it('idle shows prompts and the read-only hint', () => {
    const html = render({ status: 'idle' });
    expect(html).toContain('data-state="idle"');
    expect(html).toContain('Which orders are overdue?');
    expect(html).toMatch(/can.{1,8}t change anything/);
  });
  it('loading shows a status and disables prompts', () => {
    const html = render({ status: 'loading', question: 'Q1' });
    expect(html).toContain('role="status"');
    expect(html).toContain('Q1');
    expect(html).toMatch(/<button type="button" disabled=""/);
  });
  it('error shows an alert with retry', () => {
    const html = render({ status: 'error', question: 'Q2', message: 'Mason AI took too long. Try again.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('took too long');
    expect(html).toContain('Try again');
  });
  it('answer shows the answer text', () => {
    const html = render({ status: 'answer', question: 'Q3', answer: '3 orders are overdue.' });
    expect(html).toContain('data-testid="ask-ai-answer"');
    expect(html).toContain('3 orders are overdue.');
    expect(html).not.toContain('role="alert"');
  });
});
