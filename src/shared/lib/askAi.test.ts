import { describe, expect, it, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('@/shared/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { askAiErrorMessage, askAiPageFor, buildAskAiRequest, invokeAskAi } from './askAi';

const ORG = '11111111-2222-3333-4444-555555555555';

describe('askAiPageFor', () => {
  it('maps routes to ask-ai pages', () => {
    expect(askAiPageFor('orders')).toBe('orders');
    expect(askAiPageFor('inquiries')).toBe('pipeline');
    expect(askAiPageFor('pipeline')).toBe('pipeline');
    expect(askAiPageFor('finance')).toBe('finance');
    expect(askAiPageFor('inbox')).toBeNull();
    expect(askAiPageFor('settings')).toBeNull();
  });
});

describe('buildAskAiRequest', () => {
  it('builds a trimmed body', () => {
    expect(buildAskAiRequest('orders', '  which   are overdue? ', ORG)).toEqual({
      ok: true,
      body: { page: 'orders', question: 'which are overdue?', organization_id: ORG },
    });
  });
  it('rejects missing page, org, empty and long questions', () => {
    expect(buildAskAiRequest(null, 'x', ORG).ok).toBe(false);
    expect(buildAskAiRequest('orders', 'x', null).ok).toBe(false);
    expect(buildAskAiRequest('orders', '   ', ORG).ok).toBe(false);
    expect(buildAskAiRequest('orders', 'a'.repeat(501), ORG).ok).toBe(false);
  });
});

describe('invokeAskAi', () => {
  beforeEach(() => invoke.mockReset());
  it('calls the ask-ai function with the body', async () => {
    invoke.mockResolvedValue({ data: { answer: '3 overdue' }, error: null });
    const body = { page: 'orders' as const, question: 'q', organization_id: ORG };
    await expect(invokeAskAi(body)).resolves.toEqual({ answer: '3 overdue' });
    expect(invoke).toHaveBeenCalledWith('ask-ai', { body });
  });
  it('throws on error or empty answer', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(invokeAskAi({ page: 'orders', question: 'q', organization_id: ORG })).rejects.toThrow('boom');
    invoke.mockResolvedValue({ data: { answer: '' }, error: null });
    await expect(invokeAskAi({ page: 'orders', question: 'q', organization_id: ORG })).rejects.toThrow();
  });
});

describe('askAiErrorMessage', () => {
  it('maps statuses to safe messages', () => {
    expect(askAiErrorMessage({ context: { status: 503 } })).toMatch(/switched on/);
    expect(askAiErrorMessage({ context: { status: 504 } })).toMatch(/too long/);
    expect(askAiErrorMessage({ context: { status: 403 } })).toMatch(/access/);
    expect(askAiErrorMessage(new Error('internal db detail'))).not.toMatch(/internal/);
  });
});
