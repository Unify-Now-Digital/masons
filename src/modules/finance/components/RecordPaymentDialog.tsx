import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { useRecordPayment, type RecordPaymentInput } from '@/modules/today/useBrandData';
import { gbp2 } from '@/modules/today/uiHelpers';
import { suggestedAmount, type Receivable } from '../receivables';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const field = 'mt-1 w-full rounded-md border border-gardens-bdr bg-gardens-surf px-2 py-2 text-[14px] text-gardens-tx';

/** Record a Revolut / bank payment → order_payments (matched). Bottom-sheet-like on mobile. */
export const RecordPaymentDialog: React.FC<{ receivable: Receivable; onClose: () => void }> = ({ receivable: r, onClose }) => {
  const initialType: RecordPaymentInput['paymentType'] = r.paid === 0 && !(r.action === 'Request balance') ? 'deposit' : 'final';
  const [type, setType] = useState<RecordPaymentInput['paymentType']>(initialType);
  const [amount, setAmount] = useState(String(suggestedAmount(r, initialType)));
  const [date, setDate] = useState(today());
  const [source, setSource] = useState<RecordPaymentInput['source']>('revolut');
  const [reference, setReference] = useState('');
  const m = useRecordPayment();
  const amt = Number.parseFloat(amount);
  const over = Number.isFinite(amt) && amt > r.remaining + 1;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    m.mutate({ orderId: r.orderId, amount: amt, receivedAt: date, source, paymentType: type, reference }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:rounded-b-none">
        <DialogHeader>
          <DialogTitle>Record payment · {r.ref}</DialogTitle>
          <DialogDescription>{r.name} · order {gbp2(r.total)} · paid {gbp2(r.paid)} · left {gbp2(r.remaining)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3" data-testid="record-payment">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[12px] text-gardens-txs">Type
              <select className={field} value={type} onChange={(e) => { const t = e.target.value as RecordPaymentInput['paymentType']; setType(t); setAmount(String(suggestedAmount(r, t))); }}>
                <option value="deposit">Deposit (50%)</option>
                <option value="final">Balance</option>
              </select>
            </label>
            <label className="text-[12px] text-gardens-txs">Came in via
              <select className={field} value={source} onChange={(e) => setSource(e.target.value as RecordPaymentInput['source'])}>
                <option value="revolut">Revolut</option>
                <option value="bank">Bank transfer</option>
                <option value="cash">Cash / cheque</option>
              </select>
            </label>
            <label className="text-[12px] text-gardens-txs">Amount £
              <input className={field} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <label className="text-[12px] text-gardens-txs">Date received
              <input className={field} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
            </label>
          </div>
          <label className="text-[12px] text-gardens-txs">Reference (bank line / Revolut note)
            <input className={field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. WOOD MEMORIAL DEP" />
          </label>
          {over && <p className="m-0 text-[12px] text-amber-700">That's more than the {gbp2(r.remaining)} left on this order. Check before saving.</p>}
          {m.isError && <p role="alert" className="m-0 rounded bg-gardens-sem-red-lt px-2 py-1 text-[12px] text-gardens-sem-red">Not saved: {(m.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gardens-bdr px-3 py-2 text-[13px]">Cancel</button>
            <button type="submit" disabled={m.isPending || !(amt > 0)} className="rounded-md bg-gardens-acc px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50">
              {m.isPending ? 'Saving…' : `Save ${Number.isFinite(amt) ? gbp2(amt) : ''}`}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
