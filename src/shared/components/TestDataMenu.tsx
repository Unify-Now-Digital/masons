import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Beaker, Loader2 } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { useTestDataMode } from '@/shared/context/TestDataContext';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useToast } from '@/shared/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/ui/alert-dialog';
import { Switch } from '@/shared/components/ui/switch';

/**
 * Top-bar control for the Sears Melvin demo dataset. Renders nothing for
 * any other organisation. Provides:
 *   - a Show/Hide toggle (filters `is_test` rows out of every list hook
 *     that reads `useTestDataMode().showTestData`)
 *   - a Seed button (calls `seed_sears_melvin_test_data` RPC, idempotent)
 *   - a Clear button (calls `clear_sears_melvin_test_data` RPC, requires
 *     a destructive confirmation)
 */
export const TestDataMenu: React.FC = () => {
  const { enabled, showTestData, setShowTestData } = useTestDataMode();
  const { organizationName } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const invalidateLists = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['cemeteries'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['inscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['logistics'] });
    queryClient.invalidateQueries({ queryKey: ['map', 'orders'] });
  };

  const seed = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('seed_sears_melvin_test_data');
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Test data seeded',
        description: `${organizationName} now has the demo dataset (orders, jobs, customers, invoices…).`,
      });
      invalidateLists();
      setOpen(false);
    },
    onError: (err) => {
      toast({
        title: 'Seed failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('clear_sears_melvin_test_data');
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Test data cleared',
        description: `All is_test rows for ${organizationName} were removed. Real rows untouched.`,
      });
      invalidateLists();
      setOpen(false);
    },
    onError: (err) => {
      toast({
        title: 'Clear failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  if (!enabled) return null;

  const busy = seed.isPending || clear.isPending;
  const stateLabel = showTestData ? 'ON' : 'OFF';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Test data menu"
          className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-semibold hover:bg-amber-100"
        >
          <Beaker className="h-3.5 w-3.5" />
          <span>Test {stateLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-zinc-900">Test data</div>
            <div className="text-[11px] text-zinc-500">
              Sears Melvin only. Other organisations are never affected.
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-zinc-800">Show test data</div>
              <div className="text-[11px] text-zinc-500">
                When off, lists hide rows flagged is_test.
              </div>
            </div>
            <Switch checked={showTestData} onCheckedChange={setShowTestData} />
          </div>

          <div className="border-t border-zinc-200" />

          <button
            type="button"
            onClick={() => seed.mutate()}
            disabled={busy}
            className="w-full text-left px-2 py-1.5 rounded text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {seed.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Beaker className="h-3.5 w-3.5 text-emerald-700" />
            )}
            Seed test data
          </button>
          <div className="text-[10.5px] text-zinc-500 px-2 -mt-2">
            Inserts ~25 orders, 6 cemeteries, jobs, invoices. Idempotent.
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={busy}
                className="w-full text-left px-2 py-1.5 rounded text-xs font-medium hover:bg-red-50 text-red-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {clear.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Beaker className="h-3.5 w-3.5" />
                )}
                Clear all test data
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all test data in Sears Melvin?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes every row flagged is_test for this organisation —
                  orders, jobs, customers, cemeteries, invoices, payments and
                  inscriptions. Real (non-test) rows are not touched. This
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clear.mutate()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Clear test data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PopoverContent>
    </Popover>
  );
};
