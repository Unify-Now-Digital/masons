import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConversationHeader } from './ConversationHeader';
import { ConversationNextStepBar } from './ConversationNextStepBar';

describe('ConversationHeader (inbox-v11)', () => {
  it('shows only the name and one quiet status; no Linked pill, no score badge', () => {
    const out = renderToStaticMarkup(
      <ConversationHeader
        displayName="Sharena De Freitas"
        handleLine="all channels"
        statusLine="Invoice sent, deposit not paid"
        linkStateLabel="Linked"
        linkStateTone="linked"
        scoreBadge={<span data-testid="score">50</span>}
        actions={[{ id: 'link', label: 'Change link…', onSelect: () => {} }]}
      />,
    );
    expect(out).toContain('Sharena De Freitas');
    expect(out).toContain('· Invoice sent, deposit not paid');
    expect(out).not.toContain('>Linked<');
    expect(out).not.toContain('data-testid="score"');
    expect(out).not.toContain('all channels');
    expect(out).toContain('aria-label="Conversation actions"');
  });
  it('flags an unlinked chat', () => {
    const out = renderToStaticMarkup(
      <ConversationHeader displayName="a@b.com" handleLine="Email" linkStateLabel="Unlinked" />,
    );
    expect(out).toContain('>Unlinked<');
    expect(out).toContain('· Email');
  });
});

describe('ConversationNextStepBar', () => {
  it('shows the reason, the AI summary source and one primary', () => {
    const out = renderToStaticMarkup(
      <ConversationNextStepBar
        action={{ kind: 'follow', label: 'Follow up enquiry', reason: 'Customer waiting on us', tone: 'red' }}
        summary="Wants the Knebworth; asked about the guarantee."
        primary={{ label: 'Reply', onClick: () => {} }}
      />,
    );
    expect(out).toContain('Customer waiting on us');
    expect(out).toContain('From the AI summary');
    expect(out).toContain('>Reply<');
  });
  it('renders nothing when there is no step and no summary', () => {
    expect(
      renderToStaticMarkup(
        <ConversationNextStepBar action={{ kind: 'none', label: '', reason: '', tone: 'neutral' }} summary={null} primary={null} />,
      ),
    ).toBe('');
  });
});
