import { useEffect, useRef } from 'react';
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

/**
 * Fires the `inbox-ai-rank` sweep once per inbox mount, fire-and-forget (FR-019).
 * Nothing here surfaces in the UI: a failed sweep leaves the inbox exactly as it
 * was, with whatever ranks the last successful sweep wrote.
 *
 * `organization_id` comes from `useOrganization()` — the same source
 * `useConversationsList` uses (useInboxConversations.ts:104) — so a staff user
 * with more than one membership sweeps the org they are actually looking at,
 * rather than falling into the function's several-memberships 400 ([A1]).
 */
export function useInboxAiSweep(): void {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  // One sweep per mount. Keyed on the org id, not a bare boolean, because
  // organizationId is null on the first render and resolves a moment later —
  // and because switching org under a mounted inbox should sweep the new one.
  // The ref survives StrictMode's double effect, so the invoke fires once.
  const sweptForOrgRef = useRef<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    if (sweptForOrgRef.current === organizationId) return;
    sweptForOrgRef.current = organizationId;

    // No cancellation flag and no cleanup: invalidateQueries is a global cache
    // operation and is safe after unmount, whereas a flag cleared by StrictMode's
    // first cleanup would drop the invalidation for the one invoke that fires.
    void (async () => {
      try {
        const { data, error } = await supabase.functions.invoke<InboxAiRankResponse>(
          'inbox-ai-rank',
          { body: { organization_id: organizationId } },
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
      }
    })();
  }, [organizationId, queryClient]);
}
