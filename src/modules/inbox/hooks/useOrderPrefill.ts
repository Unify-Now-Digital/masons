import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useConversationsList } from './useInboxConversations';
import { pickPrefillConversationIds } from '../utils/pickPrefillConversationIds';

/** Above the server's 30 s model abort (D-10) plus its reads. A later reply is ignored. */
const TIMEOUT_MS = 40_000;

export type OrderPrefillStatus = 'idle' | 'loading' | 'done';

export interface OrderPrefill {
  status: OrderPrefillStatus;
  /** Raw `fields` from inbox-ai-extract-order; `applyPrefill` validates each entry. */
  fields: Readonly<Record<string, unknown>> | null;
}

const IDLE: OrderPrefill = { status: 'idle', fields: null };

export interface UseOrderPrefillArgs {
  /** The side form is open. */
  enabled: boolean;
  /** The panel's per-open generation: one extraction per value. */
  generation: number;
  /** The snapshot's person, fixed for the life of the open form. */
  personId: string | null;
}

async function extractOrderFields(
  organizationId: string,
  conversationIds: string[],
): Promise<OrderPrefill['fields']> {
  try {
    const { data, error } = await supabase.functions.invoke<{ fields?: unknown }>(
      'inbox-ai-extract-order',
      { body: { organization_id: organizationId, conversation_ids: conversationIds } },
    );
    if (error) {
      console.error('[useOrderPrefill] extraction failed', error);
      return null;
    }
    const fields = data?.fields;
    return typeof fields === 'object' && fields !== null && !Array.isArray(fields)
      ? (fields as Record<string, unknown>)
      : null;
  } catch (err) {
    console.error('[useOrderPrefill] extraction failed', err);
    return null;
  }
}

/** functions-js 2.4.4 takes no abort signal, so the timeout is a race; the server call still finishes. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = window.setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

/**
 * One inbox-ai-extract-order call per open of the side order form (FR-016). Errors and
 * timeouts resolve to `fields: null`, with no toast. A reply for an earlier open, or one
 * that lands after close, is never returned.
 */
export function useOrderPrefill({ enabled, generation, personId }: UseOrderPrefillArgs): OrderPrefill {
  const { organizationId } = useOrganization();
  // D-16: the person's open conversations. Filters are always an object; fetch only while enabled.
  const listQuery = useConversationsList(
    { status: 'open', person_id: personId },
    { enabled: enabled && !!personId },
  );
  const listSettled = listQuery.isSuccess || listQuery.isError;
  // FR-019: the rows are read through a ref; the array never reaches a dependency list.
  const rowsRef = useRef(listQuery.data);
  rowsRef.current = listQuery.data;
  // Once per open, keyed on the generation. No cleanup, so StrictMode's second run sees the ref.
  const firedForGenerationRef = useRef<number | null>(null);
  const [result, setResult] = useState<(OrderPrefill & { generation: number }) | null>(null);

  useEffect(() => {
    if (!enabled || !organizationId || !personId || !listSettled) return;
    if (firedForGenerationRef.current === generation) return;
    firedForGenerationRef.current = generation;
    // Captured once, when the list first settles. D-18: a cached list may lack a just-linked thread.
    const ids = pickPrefillConversationIds(rowsRef.current ?? []);
    if (ids.length === 0) {
      setResult({ generation, status: 'done', fields: null });
      return;
    }
    setResult({ generation, status: 'loading', fields: null });
    void withTimeout(extractOrderFields(organizationId, ids), TIMEOUT_MS, null).then((fields) => {
      // A reply for an earlier open never replaces a later open's state.
      setResult((prev) =>
        prev && prev.generation !== generation ? prev : { generation, status: 'done', fields },
      );
    });
  }, [enabled, generation, organizationId, personId, listSettled]);

  return useMemo(
    () =>
      enabled && result?.generation === generation
        ? { status: result.status, fields: result.fields }
        : IDLE,
    [enabled, generation, result],
  );
}
