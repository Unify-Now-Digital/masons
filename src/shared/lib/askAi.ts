import { supabase } from '@/shared/lib/supabase';

/**
 * Client side of the read-only `ask-ai` edge function (Mason UI phase 2).
 * Limits mirror supabase/functions/ask-ai/context.ts (kept separate so the app
 * bundle never imports edge-function code).
 */
export type AskAiPage = 'orders' | 'pipeline' | 'finance';
export const ASK_AI_MAX_QUESTION_CHARS = 500;

/** Route segment → ask-ai page. Pipeline is /dashboard/inquiries in the rail; /pipeline is the hidden legacy route. */
const SEGMENT_TO_PAGE: Record<string, AskAiPage> = {
  orders: 'orders',
  inquiries: 'pipeline',
  pipeline: 'pipeline',
  finance: 'finance',
};

export function askAiPageFor(segment: string): AskAiPage | null {
  return SEGMENT_TO_PAGE[segment] ?? null;
}

export interface AskAiRequestBody {
  page: AskAiPage;
  question: string;
  organization_id: string;
}

export type BuildResult = { ok: true; body: AskAiRequestBody } | { ok: false; error: string };

export function buildAskAiRequest(
  page: AskAiPage | null,
  question: string,
  organizationId: string | null | undefined,
): BuildResult {
  if (!page) return { ok: false, error: 'Ask AI is not available on this page.' };
  if (!organizationId) return { ok: false, error: 'No workspace selected.' };
  const q = question.replace(/\s+/g, ' ').trim();
  if (!q) return { ok: false, error: 'Type a question first.' };
  if (q.length > ASK_AI_MAX_QUESTION_CHARS) {
    return { ok: false, error: `Keep the question under ${ASK_AI_MAX_QUESTION_CHARS} characters.` };
  }
  return { ok: true, body: { page, question: q, organization_id: organizationId } };
}

export interface AskAiAnswer {
  answer: string;
}

/** Turns an invoke error into a short, user-safe message (never echoes server internals). */
export function askAiErrorMessage(err: unknown): string {
  const status = (err as { context?: { status?: number } })?.context?.status;
  if (status === 401 || status === 403) return 'You don\u2019t have access to ask about this workspace.';
  if (status === 503) return 'Ask AI isn\u2019t switched on yet.';
  if (status === 504) return 'Mason AI took too long. Try again.';
  if (status === 400) return 'That question couldn\u2019t be sent. Try rephrasing it.';
  return 'Mason AI couldn\u2019t answer right now. Try again.';
}

export async function invokeAskAi(body: AskAiRequestBody): Promise<AskAiAnswer> {
  const { data, error } = await supabase.functions.invoke<AskAiAnswer>('ask-ai', { body });
  if (error) throw error;
  if (!data?.answer) throw new Error('Empty answer');
  return { answer: data.answer };
}
