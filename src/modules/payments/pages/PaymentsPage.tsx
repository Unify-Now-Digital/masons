import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { PaymentsSummaryBar } from '../components/PaymentsSummaryBar';
import { ReconciliationTab } from '../components/ReconciliationTab';
import { OutstandingTab } from '../components/OutstandingTab';
import { ExtrasTab } from '../components/ExtrasTab';
import { useUnmatchedPayments } from '../hooks/useUnmatchedPayments';
import { useOutstandingOrders } from '../hooks/useOutstandingOrders';
import { useOrderExtrasList } from '../hooks/useOrderExtras';

type TabValue = 'reconciliation' | 'outstanding' | 'extras';

const isValidTab = (v: string | null): v is TabValue =>
  v === 'reconciliation' || v === 'outstanding' || v === 'extras';

export const PaymentsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: TabValue = isValidTab(rawTab) ? rawTab : 'reconciliation';

  // Fetch counts for tab badges
  const { data: unmatched } = useUnmatchedPayments();
  const { data: outstanding } = useOutstandingOrders();
  const { data: extras } = useOrderExtrasList('pending');

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Reconcile payments, track outstanding balances, and review billable extras.
        </p>
      </div>

      <PaymentsSummaryBar />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="reconciliation">
            Reconciliation{unmatched?.length ? ` (${unmatched.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="outstanding">
            Outstanding{outstanding?.length ? ` (${outstanding.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="extras">
            Extras{extras?.length ? ` (${extras.length})` : ''}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reconciliation" className="mt-3">
          <ReconciliationTab />
        </TabsContent>
        <TabsContent value="outstanding" className="mt-3">
          <OutstandingTab />
        </TabsContent>
        <TabsContent value="extras" className="mt-3">
          <ExtrasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
