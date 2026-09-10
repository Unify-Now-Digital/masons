import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { inboxKeys } from './useInboxConversations';

/** Shape returned by the `inbox-ai-rank` edge function (plan C2 step 6). */
interface InboxAiRankResponse {
  selected?: number;
  written?: number;
  failed?: number;
}

export interface UseInboxAiSweepOptions {
  /**
   * Conversations to score per sweep. Omitted → the function's own K_DEFAULT
   * (15); it clamps to K_MAX 25 (inbox-ai-rank/index.ts:366-368), so a larger
   * number is silently capped rather than rejected.
   */
  k?: number;
}

export interface UseInboxAiSweepResult {
  /** Sweep again on demand. No-op while this hook's own sweep is in flight. */
  run: () => void;
  isRunning: boolean;
}

/**
 * Fires the `inbox-ai-rank` sweep once per mount, fire-and-forget (FR-019), and
 * hands back a `run` for sweeping again on demand (C5). Nothing surfaces in the
 * UI beyond `isRunning`: a failed sweep leaves the inbox exactly as it was, with
 * whatever ranks the last successful sweep wrote.
 *
 * `organization_id` comes from `useOrganization()` — the same source
 * `useConversationsList` uses (useInboxConversations.ts:104) — so a staff user
 * with more than one membership sweeps the org they are actually looking at,
 * rather than falling into the function's several-memberships 400 ([A1]).
 */
export function useInboxAiSweep(options?: UseInboxAiSweepOptions): UseInboxAiSweepResult {
  // Destructured to a primitive on purpose: callers pass a fresh object literal
  // every render (`useInboxAiSweep({ k: 25 })`), so the object must never reach
  // a dependency array.
  const { k } = options ?? {};
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  // One sweep per mount. Keyed on the org id, not a bare boolean, because
  // organizationId is null on the first render and resolves a moment later —
  // and because switching org under a mounted inbox should sweep the new one.
  // The ref survives StrictMode's double effect, so the invoke fires once.
  const sweptForOrgRef = useRef<string | null>(null);
  // Read synchronously on click, which `isRunning` cannot be — a second click in
  // the same tick would still see the old state. Guards this hook INSTANCE only;
  // page and panel each hold their own, and two overlapping sweeps are safe
  // because the function claims rows before scoring them (T22 [A6]).
  const inFlightRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(() => {
    if (!organizationId) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsRunning(true);

    // No cancellation flag and no cleanup: invalidateQueries is a global cache
    // operation and is safe after unmount, whereas a flag cleared by StrictMode's
    // first cleanup would drop the invalidation for the one invoke that fires.
    // The `finally` setState is likewise a no-op after unmount under React 18.
    void (async () => {
      try {
        const { data, error } = await supabase.functions.invoke<InboxAiRankResponse>(
          'inbox-ai-rank',
          {
            body:
              k === undefined
                ? { organization_id: organizationId }
                : { organization_id: organizationId, k },
          },
        );
        if (error) {
          console.error('[useInboxAiSweep] sweep failed', error);
          return;
        }
        // Ranks changed underneath the cached list, so every conversation query
        // refetches (prefix invalidation, precedent useWhatsAppConnection.ts:30).
        if ((data?.written ?? 0) >= 1) {
          queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
        }
      } catch (err) {
        console.error('[useInboxAiSweep] sweep failed', err);
      } finally {
        inFlightRef.current = false;
        setIsRunning(false);
      }
    })();
  }, [organizationId, queryClient, k]);

  useEffect(() => {
    if (!organizationId) return;
    if (sweptForOrgRef.current === organizationId) return;
    sweptForOrgRef.current = organizationId;
    run();
  }, [organizationId, run]);

  return { run, isRunning };
}
