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
  it('on a phone, keeps Back, the name, Order and the menu on one row and closes the summary', () => {
    const out = renderToStaticMarkup(
      <ConversationHeader
        compact
        displayName="07956013764"
        handleLine="sms · +44 7956 013764"
        linkStateLabel="Unlinked"
        leading={<button type="button">Back</button>}
        orderSlot={<button type="button">Order</button>}
        actions={[{ id: 'link', label: 'Add to Customers', onSelect: () => {} }]}
        summarySlot={<p>AI summary text</p>}
        subjectLine="About the stone"
      />,
    );
    expect(out).toContain('>Back</button>');
    expect(out).toContain('07956013764');
    expect(out).toContain('>Order</button>');
    expect(out).toContain('aria-label="Conversation actions"');
    expect(out).toContain('<details');
    expect(out).not.toContain('<details open');
    expect(out).toContain('AI summary');
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
  it('shows one pill + a one-line suggestion; no NEXT STEP box', () => {
    const out = renderToStaticMarkup(
      <ConversationNextStepBar
        action={{ kind: 'follow', label: 'Follow up enquiry', reason: 'Customer waiting on us', tone: 'red' }}
        summary="Wants the Knebworth; asked about the guarantee."
        primary={{ label: 'Reply', onClick: () => {} }}
      />,
    );
    expect(out).toContain('Wants the Knebworth; asked about the guarantee.');
    expect(out).toContain('Reply</button>');
    expect(out).toContain('data-colour="red"');
    expect(out).not.toContain('Next step');
    expect(out).not.toContain('Nothing due');
  });
  it('falls back to the reason as the suggestion line', () => {
    const out = renderToStaticMarkup(
      <ConversationNextStepBar
        action={{ kind: 'follow', label: 'Reply', reason: 'Customer waiting on us', tone: 'neutral' }}
        summary={null}
        primary={{ label: 'Reply', onClick: () => {} }}
      />,
    );
    expect(out).toContain('Customer waiting on us');
    expect(out).toContain('data-colour="amber"');
  });
  it('renders nothing when nothing is due, even with a summary', () => {
    expect(
      renderToStaticMarkup(
        <ConversationNextStepBar action={{ kind: 'none', label: '', reason: '', tone: 'neutral' }} summary="x" primary={null} />,
      ),
    ).toBe('');
  });
  it('renders nothing when there is no step and no summary', () => {
    expect(
      renderToStaticMarkup(
        <ConversationNextStepBar action={{ kind: 'none', label: '', reason: '', tone: 'neutral' }} summary={null} primary={null} />,
      ),
    ).toBe('');
  });
});
