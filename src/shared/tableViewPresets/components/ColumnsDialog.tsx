import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { ColumnsTab } from './ColumnsTab';
import { PresetsTab } from './PresetsTab';
import type { ColumnState } from '../types/tableViewPresets.types';
import type { ColumnDefinition } from '../config/defaultColumns';

interface ColumnsDialogProps {
  module: 'orders' | 'invoices';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnState: ColumnState;
  onColumnStateChange: (state: ColumnState) => void;
  availableColumns: ColumnDefinition[];
}

export const ColumnsDialog: React.FC<ColumnsDialogProps> = ({
  module,
  open,
  onOpenChange,
  columnState,
  onColumnStateChange,
  availableColumns,
}) => {
  const [activeTab, setActiveTab] = useState('columns');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Columns</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="columns">Columns</TabsTrigger>
            <TabsTrigger value="presets">Presets</TabsTrigger>
          </TabsList>
          <TabsContent value="columns" className="mt-4">
            <ColumnsTab
              columnState={columnState}
              onColumnStateChange={onColumnStateChange}
              availableColumns={availableColumns}
              module={module}
            />
          </TabsContent>
          <TabsContent value="presets" className="mt-4">
            <PresetsTab
              module={module}
              columnState={columnState}
              onColumnStateChange={onColumnStateChange}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

