import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { activeOrganizationStorageKey } from "@/shared/lib/activeOrganizationStorage";
import type { OrganizationMembershipListItem, OrganizationRole } from "@/modules/organizations";

export interface OrganizationContextValue {
  organizationId: string | null;
  organizationName: string | null;
  role: OrganizationRole | null;
  memberships: OrganizationMembershipListItem[];
  setActiveOrganizationId: (id: string) => void;
  isLoading: boolean;
  error: Error | null;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembershipListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUserId(session?.user.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionUserId) {
      setMemberships([]);
      setActiveId(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    (async () => {
      const { data: memberRows, error: memErr } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", sessionUserId);

      if (cancelled) return;
      if (memErr) {
        setLoadError(new Error(memErr.message));
        setMemberships([]);
        setActiveId(null);
        setIsLoading(false);
        return;
      }

      const orgIds = [...new Set((memberRows ?? []).map((r) => r.organization_id as string))];
      if (orgIds.length === 0) {
        setMemberships([]);
        setActiveId(null);
        setLoadError(new Error("No organization membership for this account."));
        setIsLoading(false);
        return;
      }

      const { data: orgRows, error: orgErr } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);

      if (cancelled) return;
      if (orgErr) {
        setLoadError(new Error(orgErr.message));
        setMemberships([]);
        setActiveId(null);
        setIsLoading(false);
        return;
      }

      const nameById = new Map((orgRows ?? []).map((o) => [o.id as string, (o.name as string) ?? "Organization"]));

      const list: OrganizationMembershipListItem[] = (memberRows ?? [])
        .map((r) => ({
          organizationId: r.organization_id as string,
          name: nameById.get(r.organization_id as string) ?? "Organization",
          role: r.role as OrganizationRole,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setMemberships(list);

      let stored: string | null = null;
      try {
        stored = localStorage.getItem(activeOrganizationStorageKey(sessionUserId));
      } catch {
        stored = null;
      }

      const preferred =
        stored && list.some((m) => m.organizationId === stored)
          ? stored
          : list.length === 1
            ? list[0].organizationId
            : list[0]?.organizationId ?? null;

      setActiveId(preferred ?? null);
      setLoadError(null);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  const setActiveOrganizationId = useCallback(
    (id: string) => {
      setActiveId(id);
      if (sessionUserId) {
        try {
          localStorage.setItem(activeOrganizationStorageKey(sessionUserId), id);
        } catch {
          /* ignore */
        }
      }
      void queryClient.invalidateQueries();
    },
    [queryClient, sessionUserId],
  );

  const active = useMemo(
    () => memberships.find((m) => m.organizationId === activeId) ?? null,
    [memberships, activeId],
  );

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organizationId: activeId,
      organizationName: active?.name ?? null,
      role: active?.role ?? null,
      memberships,
      setActiveOrganizationId,
      isLoading,
      error: loadError,
    }),
    [activeId, active, memberships, setActiveOrganizationId, isLoading, loadError],
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return ctx;
}
