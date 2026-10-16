/** Sears Melvin GBP account already stored on existing order_payments rows. */
export const SEARS_MELVIN_GBP_ACCOUNT_ID = 'c131e465-7c43-43d3-9377-7e5d3291029d';

/**
 * Account id for Revolut transaction sync. Uses REVOLUT_GBP_ACCOUNT_ID when set,
 * otherwise the known GBP account. Sync must not call GET /accounts.
 */
export function revolutGbpAccountId(envValue: string | undefined | null): string {
  const trimmed = envValue?.trim();
  return trimmed ? trimmed : SEARS_MELVIN_GBP_ACCOUNT_ID;
}
