/**
 * SM deposit rule (SM Finance, 2026-10-14): deposit = 50% of the memorial (order
 * value excluding the permit fee) + 100% of the permit fee. All figures in PENCE.
 */
export function depositPence(memorialPence: number, permitPence: number): number {
  const memorial = Math.max(0, Math.round(memorialPence));
  const permit = Math.max(0, Math.round(permitPence));
  return Math.round(memorial * 0.5) + permit;
}

/** Same rule in pounds (2 dp) from an order total that INCLUDES the permit fee. */
export function depositPoundsFromTotal(totalPounds: number, permitPounds: number): number {
  const totalP = Math.round((totalPounds || 0) * 100);
  const permitP = Math.min(Math.round((permitPounds || 0) * 100), totalP);
  return depositPence(totalP - permitP, permitP) / 100;
}
