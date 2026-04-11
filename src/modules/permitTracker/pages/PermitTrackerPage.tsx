import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { usePermitOrders } from '../hooks/usePermitOrders';
import { PermitSummaryBar } from '../components/PermitSummaryBar';
import { ActionQueueView } from '../components/ActionQueueView';
import { CemeteryGroupView } from '../components/CemeteryGroupView';
import { ChaseModal } from '../components/ChaseModal';
import { LogNoteModal } from '../components/LogNoteModal';
import type { PermitOrder, ChaseTarget, ChaseContext } from '../types/permitTracker.types';

type ViewMode = 'actions' | 'cemetery';

export function PermitTrackerPage() {
  const { data: orders = [], isLoading } = usePermitOrders();
  const [view, setView] = useState<ViewMode>('actions');

  // Chase modal state
  const [chaseOpen, setChaseOpen] = useState(false);
  const [chaseOrders, setChaseOrders] = useState<PermitOrder[]>([]);
  const [chaseTarget, setChaseTarget] = useState<ChaseTarget>('cemetery');
  const [chaseContext, setChaseContext] = useState<ChaseContext>('single');

  // Log note modal state
  const [logNoteOpen, setLogNoteOpen] = useState(false);
  const [logNoteOrder, setLogNoteOrder] = useState<PermitOrder | null>(null);

  function handleChase(order: PermitOrder, target: ChaseTarget) {
    setChaseOrders([order]);
    setChaseTarget(target);
    setChaseContext('single');
    setChaseOpen(true);
  }

  function handleChaseMulti(chaseableOrders: PermitOrder[]) {
    setChaseOrders(chaseableOrders);
    setChaseTarget('cemetery');
    setChaseContext('multi');
    setChaseOpen(true);
  }

  function handleLogNote(order: PermitOrder) {
    setLogNoteOrder(order);
    setLogNoteOpen(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Permit Tracker</h1>
      </div>

      {/* Summary bar */}
      <PermitSummaryBar orders={orders} />

      {/* View toggle */}
      <div className="flex items-center gap-1 border rounded-lg p-1 w-fit bg-muted/50">
        <Button
          variant={view === 'actions' ? 'default' : 'ghost'}
          size="sm"
          className="text-xs h-7"
          onClick={() => setView('actions')}
        >
          Daily actions
        </Button>
        <Button
          variant={view === 'cemetery' ? 'default' : 'ghost'}
          size="sm"
          className="text-xs h-7"
          onClick={() => setView('cemetery')}
        >
          By cemetery
        </Button>
      </div>

      {/* Views */}
      {view === 'actions' ? (
        <ActionQueueView
          orders={orders}
          onChase={handleChase}
          onLogNote={handleLogNote}
        />
      ) : (
        <CemeteryGroupView
          orders={orders}
          onChaseMulti={handleChaseMulti}
          onChaseSingle={handleChase}
          onLogNote={handleLogNote}
        />
      )}

      {/* Modals */}
      <ChaseModal
        open={chaseOpen}
        onOpenChange={setChaseOpen}
        orders={chaseOrders}
        target={chaseTarget}
        context={chaseContext}
      />

      <LogNoteModal
        open={logNoteOpen}
        onOpenChange={setLogNoteOpen}
        order={logNoteOrder}
      />
    </div>
  );
}
