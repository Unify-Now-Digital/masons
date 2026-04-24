import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Search, Users } from 'lucide-react';
import { useCustomersList, type Customer } from '@/modules/customers/hooks/useCustomers';
import {
  useLinkConversation,
  useLinkConversations,
  useUnlinkConversation,
  useUnlinkConversations,
} from '@/modules/inbox/hooks/useInboxConversations';

function getPersonDisplayName(c: Customer): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || c.email || c.phone || '—';
}

interface LinkConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  /** Optional: when provided, link/unlink applies to all these conversation ids. */
  conversationIds?: string[];
  conversationPersonId: string | null;
  candidates?: string[];
  onLinked?: (personId: string) => void;
  onUnlinked?: () => void;
}

export const LinkConversationModal: React.FC<LinkConversationModalProps> = ({
  open,
  onOpenChange,
  conversationId,
  conversationIds,
  conversationPersonId,
  candidates = [],
  onLinked,
  onUnlinked,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: customers = [] } = useCustomersList();
  const linkMutation = useLinkConversation();
  const linkBulkMutation = useLinkConversations();
  const unlinkMutation = useUnlinkConversation();
  const unlinkBulkMutation = useUnlinkConversations();

  const bulk = (conversationIds ?? []).filter(Boolean);
  const hasBulk = bulk.length > 0;

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.first_name?.toLowerCase().includes(q) ?? false) ||
        (c.last_name?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false)
    );
  }, [customers, searchQuery]);

  const candidateCustomers = useMemo(() => {
    if (candidates.length === 0) return [];
    return customers.filter((c) => candidates.includes(c.id));
  }, [customers, candidates]);

  const handleLink = (personId: string) => {
    if (hasBulk) {
      linkBulkMutation.mutate(
        { conversationIds: bulk, personId },
        {
          onSuccess: () => {
            onLinked?.(personId);
            onOpenChange(false);
          },
        }
      );
      return;
    }

    linkMutation.mutate(
      { conversationId, personId },
      {
        onSuccess: () => {
          onLinked?.(personId);
          onOpenChange(false);
        },
      }
    );
  };

  const handleUnlink = () => {
    if (hasBulk) {
      unlinkBulkMutation.mutate(bulk, {
        onSuccess: () => {
          onUnlinked?.();
          onOpenChange(false);
        },
      });
      return;
    }

    unlinkMutation.mutate(conversationId, {
      onSuccess: () => {
        onUnlinked?.();
        onOpenChange(false);
      },
    });
  };

  const isPending =
    linkMutation.isPending ||
    unlinkMutation.isPending ||
    linkBulkMutation.isPending ||
    unlinkBulkMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Link to person</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {conversationPersonId && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleUnlink} disabled={isPending}>
                Unlink
              </Button>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gardens-txs" />
            <Input
              placeholder="Search by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex-1 overflow-y-auto border rounded-md min-h-[200px]">
            {candidateCustomers.length > 0 && (
              <div className="p-2 border-b">
                <p className="text-xs font-medium text-gardens-txs mb-2">Possible matches</p>
                {candidateCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleLink(c.id)}
                    disabled={isPending}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gardens-page rounded"
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    {getPersonDisplayName(c)}
                  </button>
                ))}
              </div>
            )}
            <div className="p-2">
              {candidateCustomers.length > 0 && <p className="text-xs font-medium text-gardens-txs mb-2">All people</p>}
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleLink(c.id)}
                  disabled={isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gardens-page rounded"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  {getPersonDisplayName(c)}
                </button>
              ))}
              {filteredCustomers.length === 0 && (
                <p className="text-sm text-gardens-txs py-4 text-center">No people found</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
