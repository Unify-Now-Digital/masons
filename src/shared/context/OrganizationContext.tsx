import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  isOrgAdmin: boolean;
  memberships: OrganizationMembershipListItem[];
  setActiveOrganizationId: (id: string) => void;
  refetchMemberships: (preferredOrganizationId?: string) => Promise<void>;
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

  const membershipLoadGenerationRef = useRef(0);

  const runMembershipLoad = useCallback(
    async (
      userId: string,
      options: {
        preferredOrganizationId?: string;
        /** If still in the new list, keep this org active (used when refetching without a preferred id) */
        fallBackActiveId?: string | null;
      } = {},
    ) => {
      const myGeneration = ++membershipLoadGenerationRef.current;
      setIsLoading(true);
      setLoadError(null);

      const finishIfCurrent = () => myGeneration === membershipLoadGenerationRef.current;

      try {
        const { data: memberRows, error: memErr } = await supabase
          .from("organization_members")
          .select("organization_id, role")
          .eq("user_id", userId);

        if (!finishIfCurrent()) return;

        if (memErr) {
          if (finishIfCurrent()) {
            setLoadError(new Error(memErr.message));
            setMemberships([]);
            setActiveId(null);
          }
          return;
        }

        const orgIds = [...new Set((memberRows ?? []).map((r) => r.organization_id as string))];
        if (orgIds.length === 0) {
          if (finishIfCurrent()) {
            setMemberships([]);
            setActiveId(null);
            setLoadError(new Error("No organization membership for this account."));
          }
          return;
        }

        const { data: orgRows, error: orgErr } = await supabase
          .from("organizations")
          .select("id, name")
          .in("id", orgIds);

        if (!finishIfCurrent()) return;

        if (orgErr) {
          if (finishIfCurrent()) {
            setLoadError(new Error(orgErr.message));
            setMemberships([]);
            setActiveId(null);
          }
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

        if (!finishIfCurrent()) return;

        setMemberships(list);

        let stored: string | null = null;
        try {
          stored = localStorage.getItem(activeOrganizationStorageKey(userId));
        } catch {
          stored = null;
        }

        const preferredId = options.preferredOrganizationId;
        const fallBack = options.fallBackActiveId ?? null;

        const nextActive =
          preferredId && list.some((m) => m.organizationId === preferredId)
            ? preferredId
            : fallBack && list.some((m) => m.organizationId === fallBack)
              ? fallBack
              : stored && list.some((m) => m.organizationId === stored)
                ? stored
                : list.length === 1
                  ? list[0].organizationId
                  : list[0]?.organizationId ?? null;

        if (finishIfCurrent()) {
          setActiveId(nextActive ?? null);
          if (nextActive) {
            try {
              localStorage.setItem(activeOrganizationStorageKey(userId), nextActive);
            } catch {
              /* ignore */
            }
          }
          setLoadError(null);
        }
      } finally {
        if (finishIfCurrent()) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

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
      membershipLoadGenerationRef.current += 1;
      setMemberships([]);
      setActiveId(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    void runMembershipLoad(sessionUserId, { fallBackActiveId: null });

    return () => {
      membershipLoadGenerationRef.current += 1;
    };
  }, [sessionUserId, runMembershipLoad]);

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

  const refetchMemberships = useCallback(
    async (preferredOrganizationId?: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      if (!uid) return;

      await runMembershipLoad(uid, { preferredOrganizationId, fallBackActiveId: activeId });
      void queryClient.invalidateQueries();
    },
    [activeId, queryClient, runMembershipLoad],
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
      isOrgAdmin: active?.role === "admin",
      memberships,
      setActiveOrganizationId,
      refetchMemberships,
      isLoading,
      error: loadError,
    }),
    [activeId, active, memberships, setActiveOrganizationId, refetchMemberships, isLoading, loadError],
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
