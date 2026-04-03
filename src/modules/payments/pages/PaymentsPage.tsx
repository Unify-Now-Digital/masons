import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { PaymentsSummaryBar } from '../components/PaymentsSummaryBar';
import { ReconciliationTab } from '../components/ReconciliationTab';
import { OutstandingTab } from '../components/OutstandingTab';
import { ExtrasTab } from '../components/ExtrasTab';

type TabValue = 'reconciliation' | 'outstanding' | 'extras';

const isValidTab = (v: string | null): v is TabValue =>
  v === 'reconciliation' || v === 'outstanding' || v === 'extras';

export const PaymentsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: TabValue = isValidTab(rawTab) ? rawTab : 'reconciliation';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold">Payments</h1>
        <p className="text-muted-foreground">
          Reconcile payments, track outstanding balances, and review billable extras.
        </p>
      </div>

      <PaymentsSummaryBar />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="extras">Extras to Invoice</TabsTrigger>
        </TabsList>
        <TabsContent value="reconciliation" className="mt-4">
          <ReconciliationTab />
        </TabsContent>
        <TabsContent value="outstanding" className="mt-4">
          <OutstandingTab />
        </TabsContent>
        <TabsContent value="extras" className="mt-4">
          <ExtrasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
