import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { createOrganization } from '@/modules/organizations/api/organizationManagement.rpc';

export interface CreateOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationModal({ open, onOpenChange }: CreateOrganizationModalProps) {
  const { toast } = useToast();
  const { refetchMemberships, setActiveOrganizationId } = useOrganization();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: 'Name required',
        description: 'Enter an organisation name.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const newId = await createOrganization(trimmed);
      await refetchMemberships(newId);
      setActiveOrganizationId(newId);
      onOpenChange(false);
      toast({ title: 'Organisation created' });
    } catch (err) {
      toast({
        title: 'Could not create organisation',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-gardens-bdr bg-gardens-surf sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-head text-gardens-tx">Create organisation</DialogTitle>
            <DialogDescription className="font-body text-gardens-txs">
              You will become the admin of this organisation. You can switch workspaces afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="create-org-name" className="text-xs text-gardens-txs">
              Organisation name
            </Label>
            <Input
              id="create-org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riverside Memorials"
              disabled={submitting}
              className="text-sm bg-gardens-page"
              autoComplete="organization"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
