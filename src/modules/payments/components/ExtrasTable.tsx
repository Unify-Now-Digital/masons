import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { OrderExtra } from '../types/reconciliation.types';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

const fmtDate = (iso: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const changeTypeBadge = (type: string | null) => {
  const map: Record<string, { label: string; cls: string }> = {
    photo_plaque: { label: 'Photo plaque', cls: 'bg-gardens-blu-lt text-gardens-blu-dk' },
    inscription_increase: { label: 'Inscription', cls: 'bg-gardens-blu-lt text-gardens-blu-dk' },
    colour_change: { label: 'Colour change', cls: 'bg-gardens-amb-lt text-gardens-amb-dk' },
    vase: { label: 'Vase', cls: 'bg-gardens-grn-lt text-gardens-grn-dk' },
    other: { label: 'Other', cls: 'bg-gardens-page text-gardens-tx' },
  };
  const entry = map[type ?? 'other'] ?? map.other;
  return <Badge className={`${entry.cls} text-[10px] px-1.5 py-0`}>{entry.label}</Badge>;
};

const sourceBadge = (source: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    gmail: { label: 'Email', cls: 'bg-gardens-red-lt text-gardens-red-dk' },
    whatsapp: { label: 'WhatsApp', cls: 'bg-gardens-grn-lt text-gardens-grn-dk' },
    ghl: { label: 'GHL', cls: 'bg-gardens-blu-lt text-gardens-blu-dk' },
    phone_note: { label: 'Phone', cls: 'bg-gardens-page text-gardens-tx' },
  };
  const entry = map[source] ?? { label: source, cls: 'bg-gardens-page text-gardens-tx' };
  return <Badge className={`${entry.cls} text-[10px] px-1.5 py-0`}>{entry.label}</Badge>;
};

const confBadge = (conf: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    high: { label: 'Confirmed', cls: 'bg-gardens-grn-lt text-gardens-grn-dk border-gardens-grn-lt' },
    medium: { label: 'Review', cls: 'bg-gardens-amb-lt text-gardens-amb-dk border-gardens-amb-lt' },
    low: { label: 'Low', cls: 'bg-gardens-page text-gardens-txs border-gardens-bdr' },
  };
  const entry = map[conf] ?? map.low;
  return <Badge variant="outline" className={`${entry.cls} text-[10px] px-1.5 py-0`}>{entry.label}</Badge>;
};

interface Props {
  extras: OrderExtra[];
  onAddToInvoice: (extraId: string, amount: number) => void;
  onDismiss: (extraId: string) => void;
}

export function ExtrasTable({ extras, onAddToInvoice, onDismiss }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState(0);

  if (!extras.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6 bg-muted/50 border rounded-md">
        No pending extras detected. Click "Scan conversations" to check for recent changes.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Change</TableHead>
            <TableHead className="w-20">Source</TableHead>
            <TableHead className="w-24">Confidence</TableHead>
            <TableHead className="w-28">Amount</TableHead>
            <TableHead className="text-right w-32">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {extras.map((e) => {
            const isLow = e.confidence === 'low';
            const isExpanded = expandedId === e.id;
            const isEditing = editingId === e.id;

            return (
              <React.Fragment key={e.id}>
                <TableRow className={`${isLow ? 'opacity-60' : ''} cursor-pointer`} onClick={() => setExpandedId(isExpanded ? null : e.id)}>
                  <TableCell className="py-2">
                    <div className="text-sm font-medium">{e.orders?.customer_name ?? 'Unknown'}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {e.orders?.order_number && `#${e.orders.order_number}`}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1.5">
                      {changeTypeBadge(e.change_type)}
                      <span className="text-xs truncate max-w-[200px]">{e.description}</span>
                      {e.quote_snippet && (
                        isExpanded
                          ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
                          : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">{sourceBadge(e.source)}</TableCell>
                  <TableCell className="py-2">{confBadge(e.confidence)}</TableCell>
                  <TableCell className="py-2" onClick={(ev) => ev.stopPropagation()}>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-20 h-7 text-xs"
                          value={editAmount}
                          onChange={(ev) => setEditAmount(Number(ev.target.value))}
                          autoFocus
                        />
                        <Button size="sm" className="h-7 text-xs px-2" onClick={() => { onAddToInvoice(e.id, editAmount); setEditingId(null); }}>
                          Add
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm tabular-nums font-medium">
                        {e.suggested_amount != null ? fmt(e.suggested_amount) : (
                          <button
                            className="text-xs text-gardens-blu-dk hover:underline"
                            onClick={() => { setEditingId(e.id); setEditAmount(0); }}
                          >
                            Set price
                          </button>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      {e.suggested_amount != null && !isEditing && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={() => onAddToInvoice(e.id, e.suggested_amount!)}
                        >
                          <Plus className="h-3 w-3 mr-0.5" /> Add
                        </Button>
                      )}
                      {!e.suggested_amount && !isEditing && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={() => { setEditingId(e.id); setEditAmount(0); }}
                        >
                          <Plus className="h-3 w-3 mr-0.5" /> Price
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2 text-muted-foreground"
                        onClick={() => onDismiss(e.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {/* Expandable quote row */}
                {isExpanded && e.quote_snippet && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={6} className="py-2 px-4">
                      <div className="text-xs italic text-muted-foreground leading-relaxed">
                        <span className="font-medium not-italic text-foreground">{e.quote_sender ?? 'Unknown'}</span>
                        {e.quote_date && <span className="ml-1">({fmtDate(e.quote_date)})</span>}
                        {': '}
                        &ldquo;{e.quote_snippet}&rdquo;
                      </div>
                      {e.confidence_reason && (
                        <div className="text-[11px] text-muted-foreground mt-1">{e.confidence_reason}</div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
