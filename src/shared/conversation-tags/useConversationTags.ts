import { useMemo } from 'react';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { useCemeteriesList } from '@/modules/cemeteries';
import { emailDomain, normaliseHandle } from './normalise';
import type { ConversationTagResult, InboxTag } from './types';

export interface ConversationTagInput {
  handle: string | null;
  personId: string | null;
  orderId: string | null;
}

export interface ConversationTagsBundle {
  /** True once the underlying queries have finished loading. While false,
   *  derive() returns {tags:[], orderRefs:[]} so UI can avoid flicker. */
  isReady: boolean;
  /** Derive tags + order refs for a single conversation. Pure function
   *  over the pre-built lookup indexes. Safe to call in render. */
  derive: (input: ConversationTagInput) => ConversationTagResult;
}

/** Tokens we require to appear as a bounded segment of the email domain.
 *  "parish-council.gov.uk" matches; "church" in "church-hill-cafe.com"
 *  does not because that would hit the false-positive rule below. */
const CEMETERY_DOMAIN_TOKENS = ['parish', 'church', 'cemetery', 'crematorium'];

/** Treat the token as a bounded segment of the domain — delimited by
 *  "." or "-" or start/end. Prevents "church-hill-cafe.com" matching. */
function domainContainsBoundedToken(domain: string, token: string): boolean {
  if (!domain) return false;
  const re = new RegExp(`(^|[-.])${token}($|[-.])`, 'i');
  return re.test(domain);
}

/**
 * Build the cross-entity lookup maps used to derive conversation tags.
 *
 * Use this once at the top of a page and call `derive()` per conversation.
 * The heavy lifting (Map/Set construction) happens inside useMemo and
 * only recomputes when the underlying lists change.
 */
export function useConversationTags(): ConversationTagsBundle {
  const orders = useOrdersList();
  const customers = useCustomersList();
  const cemeteries = useCemeteriesList();

  const isReady = orders.isSuccess && customers.isSuccess && cemeteries.isSuccess;

  // Handle → customer.id
  const personIdByHandle = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers.data ?? []) {
      const email = normaliseHandle(c.email);
      const phone = normaliseHandle(c.phone);
      if (email) map.set(email, c.id);
      if (phone) map.set(phone, c.id);
    }
    return map;
  }, [customers.data]);

  // person_id → order refs (string form, e.g. "OR-123")
  const orderRefsByPerson = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const o of orders.data ?? []) {
      if (!o.person_id) continue;
      const ref = o.order_number != null ? `OR-${o.order_number}` : `OR-${o.id.slice(0, 6)}`;
      const list = map.get(o.person_id) ?? [];
      list.push(ref);
      map.set(o.person_id, list);
    }
    return map;
  }, [orders.data]);

  // order.id → order ref (for the direct-link case)
  const orderRefById = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders.data ?? []) {
      map.set(o.id, o.order_number != null ? `OR-${o.order_number}` : `OR-${o.id.slice(0, 6)}`);
    }
    return map;
  }, [orders.data]);

  // Set of cemetery exact-match handles (primary_email + phone)
  const cemeteryHandleSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of cemeteries.data ?? []) {
      const email = normaliseHandle(c.primary_email);
      const phone = normaliseHandle(c.phone);
      if (email) set.add(email);
      if (phone) set.add(phone);
    }
    return set;
  }, [cemeteries.data]);

  // Set of cemetery email domains (e.g. "stmarks.org" → cemetery)
  const cemeteryDomainSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of cemeteries.data ?? []) {
      const d = emailDomain(c.primary_email);
      if (d) set.add(d);
    }
    return set;
  }, [cemeteries.data]);

  const derive = useMemo(() => {
    return (input: ConversationTagInput): ConversationTagResult => {
      if (!isReady) return { tags: [], orderRefs: [] };

      const handle = normaliseHandle(input.handle);
      const domain = emailDomain(handle);
      const resolvedPersonId =
        input.personId ?? (handle ? personIdByHandle.get(handle) ?? null : null);
      const refsFromPerson = resolvedPersonId ? orderRefsByPerson.get(resolvedPersonId) ?? [] : [];
      const refFromConversation = input.orderId ? orderRefById.get(input.orderId) : null;

      const orderRefs = Array.from(
        new Set([...(refFromConversation ? [refFromConversation] : []), ...refsFromPerson])
      );

      const hasExistingOrder = orderRefs.length > 0;

      // Cemetery detection:
      //  1. exact handle match against cemeteries.primary_email / phone
      //  2. email domain matches any saved cemetery's email domain
      //  3. domain contains a bounded cemetery token (parish / church /
      //     cemetery / crematorium)
      //  4. .gov.uk sender (kept as a catch-all for council-run cemeteries)
      let isCemetery = false;
      if (handle && cemeteryHandleSet.has(handle)) isCemetery = true;
      else if (domain && cemeteryDomainSet.has(domain)) isCemetery = true;
      else if (domain && CEMETERY_DOMAIN_TOKENS.some((t) => domainContainsBoundedToken(domain, t))) {
        isCemetery = true;
      } else if (domain.endsWith('.gov.uk')) {
        isCemetery = true;
      }

      const tags: InboxTag[] = [];
      if (hasExistingOrder) tags.push('order');
      else tags.push('enquiry');
      if (isCemetery) tags.push('cemetery');

      return { tags, orderRefs };
    };
  }, [
    isReady,
    personIdByHandle,
    orderRefsByPerson,
    orderRefById,
    cemeteryHandleSet,
    cemeteryDomainSet,
  ]);

  return { isReady, derive };
}
