import React, { useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Plus, X, Pencil, AlertTriangle } from 'lucide-react';
import type { OrderExtra } from '../types/reconciliation.types';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const sourceTag = (source: string) => {
  const colors: Record<string, string> = {
    gmail: 'bg-red-100 text-red-700',
    whatsapp: 'bg-green-100 text-green-700',
    ghl: 'bg-purple-100 text-purple-700',
    phone_note: 'bg-gray-100 text-gray-700',
  };
  const labels: Record<string, string> = {
    gmail: 'Gmail',
    whatsapp: 'WhatsApp',
    ghl: 'GHL',
    phone_note: 'Phone note',
  };
  return (
    <Badge className={`${colors[source] ?? 'bg-gray-100 text-gray-700'} text-xs`}>
      {labels[source] ?? source}
    </Badge>
  );
};

const confidenceBadge = (confidence: string) => {
  switch (confidence) {
    case 'high':
      return <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">Confirmed change</Badge>;
    case 'medium':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">Needs review</Badge>;
    case 'low':
      return <Badge className="bg-gray-100 text-gray-500 border-gray-300 text-xs">Low confidence</Badge>;
    default:
      return null;
  }
};

interface Props {
  extra: OrderExtra;
  onAddToInvoice: (extraId: string, amount: number) => void;
  onDismiss: (extraId: string) => void;
}

export function ExtrasCard({ extra, onAddToInvoice, onDismiss }: Props) {
  const [editingAmount, setEditingAmount] = useState(false);
  const [amount, setAmount] = useState(extra.suggested_amount ?? 0);
  const isLow = extra.confidence === 'low';

  const handleAdd = () => {
    onAddToInvoice(extra.id, amount);
  };

  return (
    <Card className={`transition-opacity ${isLow ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold truncate">
                {extra.orders?.customer_name ?? 'Unknown'}
              </span>
              {extra.orders?.order_number && (
                <span className="text-xs text-muted-foreground">#{extra.orders.order_number}</span>
              )}
              {sourceTag(extra.source)}
              {confidenceBadge(extra.confidence)}
            </div>

            <div className="text-sm font-medium mb-2">{extra.description}</div>

            {/* Quote snippet */}
            {extra.quote_snippet && (
              <div className="bg-muted rounded-md p-2.5 mb-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  {extra.quote_sender && <span className="font-medium">{extra.quote_sender}</span>}
                  {extra.quote_date && <span>&middot; {formatDate(extra.quote_date)}</span>}
                </div>
                <p className="italic leading-relaxed">&ldquo;{extra.quote_snippet}&rdquo;</p>
              </div>
            )}

            {/* Warning for needs review */}
            {extra.confidence === 'medium' && extra.confidence_reason && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-2 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <span className="text-xs text-red-700">{extra.confidence_reason}</span>
              </div>
            )}

            {/* Suggested price */}
            {extra.suggested_amount != null && !editingAmount && (
              <div className="text-sm">
                Suggested price: <span className="font-semibold">{formatCurrency(extra.suggested_amount)}</span>
              </div>
            )}

            {/* Amount editor */}
            {editingAmount && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-medium">Price:</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-28 h-8"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
                <Button size="sm" onClick={handleAdd}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingAmount(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        {!editingAmount && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            {extra.suggested_amount != null ? (
              <Button size="sm" variant="default" onClick={handleAdd}>
                <Plus className="h-3 w-3 mr-1" /> Add to final invoice
              </Button>
            ) : (
              <Button size="sm" variant="default" onClick={() => setEditingAmount(true)}>
                <Plus className="h-3 w-3 mr-1" /> Set price & add
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditingAmount(true)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit amount
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onDismiss(extra.id)}>
              <X className="h-3 w-3 mr-1" /> Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
