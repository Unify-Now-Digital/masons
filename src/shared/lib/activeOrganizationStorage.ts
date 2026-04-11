/** localStorage key for the active organization, scoped per Supabase user. */
export function activeOrganizationStorageKey(userId: string): string {
  return `activeOrganizationId:${userId}`;
}
