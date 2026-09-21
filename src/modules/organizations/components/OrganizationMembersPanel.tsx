import React, { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { OrganizationMemberWithIdentity, OrganizationRole } from '@/modules/organizations';
import { addMemberByEmail } from '@/modules/organizations/api/organizationManagement.rpc';
import { removeMember, updateMemberRole } from '@/modules/organizations/api/organizationMembers.api';
import { useOrganizationMembers, organizationMembersKeys } from '@/modules/organizations/hooks/useOrganizationMembers';
import { OrganizationMemberRoleSelect } from './OrganizationMemberRoleSelect';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { supabase } from '@/shared/lib/supabase';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

function memberPrimaryLabel(m: OrganizationMemberWithIdentity): string {
  const name = m.display_name?.trim();
  if (name) return name;
  const email = m.email?.trim();
  if (email) return email;
  return m.user_id;
}

function memberSecondaryLine(m: OrganizationMemberWithIdentity): string | null {
  const name = m.display_name?.trim();
  const email = m.email?.trim();
  if (name && email && name.toLowerCase() !== email.toLowerCase()) return email;
  return null;
}

function countAdmins(members: OrganizationMemberWithIdentity[]): number {
  return members.filter((m) => m.role === 'admin').length;
}

export function OrganizationMembersPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isOrgAdmin, organizationId, refetchMemberships } = useOrganization();
  const { data: members, isLoading, isError } = useOrganizationMembers();
  const [inviteEmail, setInviteEmail] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const invalidateMemberList = useCallback(() => {
    if (organizationId) {
      void queryClient.invalidateQueries({ queryKey: organizationMembersKeys.list(organizationId) });
    }
  }, [organizationId, queryClient]);

  const addMemberMutation = useMutation({
    mutationFn: (email: string) => {
      if (!organizationId) throw new Error('No organisation selected');
      return addMemberByEmail(organizationId, email);
    },
    onSuccess: () => {
      invalidateMemberList();
      setInviteEmail('');
      toast({ title: 'Member added' });
    },
    onError: (err: Error) => {
      toast({ title: 'Could not add member', description: err.message, variant: 'destructive' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => {
      if (!organizationId) throw new Error('No organisation selected');
      return removeMember(organizationId, userId);
    },
    onSuccess: async (_data, userId) => {
      invalidateMemberList();
      if (userId === currentUserId) {
        await refetchMemberships();
      }
      toast({ title: 'Member removed' });
    },
    onError: (err: Error) => {
      toast({ title: 'Could not remove member', description: err.message, variant: 'destructive' });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, nextRole }: { userId: string; nextRole: OrganizationRole }) => {
      if (!organizationId) throw new Error('No organisation selected');
      return updateMemberRole(organizationId, userId, nextRole);
    },
    onSuccess: () => {
      invalidateMemberList();
      toast({ title: 'Role updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Could not update role', description: err.message, variant: 'destructive' });
    },
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteEmail.trim();
    if (!trimmed) {
      toast({ title: 'Email required', variant: 'destructive' });
      return;
    }
    addMemberMutation.mutate(trimmed);
  };

  if (!isOrgAdmin) return null;

  const list = members ?? [];
  const addPending = addMemberMutation.isPending;
  const removePendingFor = (userId: string) =>
    removeMemberMutation.isPending && removeMemberMutation.variables === userId;
  const rolePendingFor = (userId: string) =>
    roleMutation.isPending &&
    roleMutation.variables !== undefined &&
    roleMutation.variables.userId === userId;

  return (
    <div className="rounded-lg border border-gardens-bdr bg-gardens-surf p-4 space-y-4">
      <h3 className="font-head text-sm font-semibold text-gardens-tx">Organisation members</h3>

      <form onSubmit={handleAddMember} className="space-y-2">
        <Label htmlFor="org-add-member-email" className="text-xs text-gardens-txs">
          Add member by email
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id="org-add-member-email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            disabled={addPending}
            className="text-sm bg-gardens-page sm:flex-1"
            autoComplete="email"
          />
          <Button type="submit" size="sm" disabled={addPending} className="shrink-0">
            {addPending ? 'Adding…' : 'Add'}
          </Button>
        </div>
        <p className="text-[11px] text-gardens-txs">
          They must already have an account. No invitation email is sent.
        </p>
      </form>

      {isLoading && <p className="font-body text-xs text-gardens-txm">Loading…</p>}
      {isError && <p className="font-body text-xs text-destructive">Could not load members.</p>}

      {!isLoading && !isError && list.length > 0 && (
        <ul className="space-y-2 border-t border-gardens-bdr pt-3">
          {list.map((m) => {
            const secondary = memberSecondaryLine(m);
            const soleAdmin = m.role === 'admin' && countAdmins(list) === 1;
            const removeDisabled = soleAdmin || removePendingFor(m.user_id);
            return (
              <li
                key={m.id}
                className="font-body text-xs text-gardens-tx flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-gardens-tx">{memberPrimaryLabel(m)}</div>
                  {secondary && (
                    <div className="truncate text-[11px] text-gardens-txs">{secondary}</div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <OrganizationMemberRoleSelect
                    member={m}
                    members={list}
                    value={m.role}
                    disabled={rolePendingFor(m.user_id)}
                    onValueChange={(nextRole) => {
                      if (nextRole === m.role) return;
                      roleMutation.mutate({ userId: m.user_id, nextRole });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-destructive border-gardens-bdr hover:bg-destructive/10"
                    disabled={removeDisabled}
                    title={
                      soleAdmin
                        ? 'Cannot remove the last organisation admin.'
                        : removePendingFor(m.user_id)
                          ? 'Removing…'
                          : 'Remove from organisation'
                    }
                    onClick={() => removeMemberMutation.mutate(m.user_id)}
                  >
                    {removePendingFor(m.user_id) ? 'Removing…' : 'Remove'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && !isError && list.length === 0 && (
        <p className="font-body text-xs text-gardens-txm border-t border-gardens-bdr pt-3">No members listed.</p>
      )}
    </div>
  );
}
