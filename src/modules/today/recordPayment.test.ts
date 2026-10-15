import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
vi.mock('@/shared/lib/supabase', () => ({ supabase: {} }));
import { toRecordPaymentRpcArgs, type RecordPaymentInput } from './useBrandData';

const base: RecordPaymentInput = { orderId: 'o1', amount: 250.004, receivedAt: '2026-10-15', source: 'bank', paymentType: 'deposit', reference: '  REF1 ' };
const root = resolve(__dirname, '../../..');

describe('Record payment → record_manual_payment RPC', () => {
  it('maps the dialog input to RPC args (rounded, trimmed)', () => {
    expect(toRecordPaymentRpcArgs(base)).toEqual({ p_order_id: 'o1', p_amount: 250, p_received_at: '2026-10-15', p_source: 'bank', p_payment_type: 'deposit', p_reference: 'REF1' });
  });
  it('empty reference becomes null', () => expect(toRecordPaymentRpcArgs({ ...base, reference: '  ' }).p_reference).toBeNull());
  it('refuses zero / negative amounts', () => {
    expect(() => toRecordPaymentRpcArgs({ ...base, amount: 0 })).toThrow(/more than £0/);
    expect(() => toRecordPaymentRpcArgs({ ...base, amount: -5 })).toThrow();
  });
  it('the browser no longer writes order_payments or order dates directly', () => {
    const src = readFileSync(resolve(root, 'src/modules/today/useBrandData.ts'), 'utf8');
    expect(src).not.toMatch(/from\('order_payments'\)\.insert/);
    expect(src).not.toMatch(/deposit_date' : 'second_payment_date'/);
    expect(src).toMatch(/record_manual_payment/);
  });
  it('the DB function is SECURITY DEFINER, pins search_path, checks the finance role and is not executable by anon', () => {
    const sql = readFileSync(resolve(root, 'supabase/migrations/20261015170100_record_manual_payment.sql'), 'utf8');
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = ''/);
    expect(sql).toMatch(/public\.user_can_view_org_finance\(v_org\)/);
    expect(sql).toMatch(/revoke all on function public\.record_manual_payment[^;]+from public, anon;/);
  });
});
