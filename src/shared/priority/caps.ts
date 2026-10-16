/**
 * Per-lane list caps from the purposes doc.
 * Sales 15, Customer Service 10, Proofs 10, Permits 7, Finance 5.
 * One source for Today and Inbox Priority so a shared default cannot widen CS.
 */
export const LANE_LIST_CAP = { Sales: 15, CS: 10, Proofs: 10, Permits: 7, Finance: 5 } as const;
