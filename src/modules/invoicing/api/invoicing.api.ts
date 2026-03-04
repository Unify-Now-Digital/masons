import { supabase } from '@/shared/lib/supabase';
import type { Invoice, InvoiceInsert, InvoiceUpdate, InvoicePayment } from '../types/invoicing.types';

const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
const adminToken = import.meta.env.VITE_INBOX_ADMIN_TOKEN as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function ensureFunctionsEnv(): { functionsUrl: string; adminToken: string; anonKey: string } {
  if (!functionsUrl?.trim()) {
    throw new Error(
      'VITE_SUPABASE_FUNCTIONS_URL is missing. Add it to .env and restart Vite.',
    );
  }
  if (!adminToken?.trim()) {
    throw new Error(
      'VITE_INBOX_ADMIN_TOKEN is missing. Add it to .env and restart Vite.',
    );
  }
  if (!supabaseAnonKey?.trim()) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY is missing. Add it to .env and restart Vite.',
    );
  }
  return {
    functionsUrl: functionsUrl.replace(/\/$/, ''),
    adminToken: adminToken.trim(),
    anonKey: supabaseAnonKey.trim(),
  };
}

export async function fetchInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Invoice[];
}

export async function fetchInvoice(id: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  
  if (error) throw error;
  return data as Invoice;
}

export async function createInvoice(invoice: InvoiceInsert) {
  // Generate invoice number if not provided
  if (!invoice.invoice_number) {
    // Try to get next value from sequence via RPC
    // If RPC function doesn't exist, we'll use a fallback
    try {
      const { data: invoiceNumber, error: rpcError } = await supabase
        .rpc('get_next_invoice_number');
      
      if (!rpcError && invoiceNumber) {
        invoice.invoice_number = invoiceNumber;
      } else {
        // Fallback: Get max invoice number and increment
        const { data: maxInvoice, error: maxError } = await supabase
          .from('invoices')
          .select('invoice_number')
          .order('invoice_number', { ascending: false })
          .limit(1)
          .single();
        
        if (!maxError && maxInvoice?.invoice_number) {
          // Extract number from format like "INV-000001" or "1001"
          const match = maxInvoice.invoice_number.match(/\d+/);
          const nextNum = match ? parseInt(match[0], 10) + 1 : 1001;
          invoice.invoice_number = `INV-${String(nextNum).padStart(6, '0')}`;
        } else {
          // First invoice
          invoice.invoice_number = 'INV-000001';
        }
      }
    } catch {
      // Fallback: Use timestamp-based number for Phase 1
      const timestamp = Date.now();
      invoice.invoice_number = `INV-${String(timestamp).slice(-6)}`;
    }
  }
  
  const { data, error } = await supabase
    .from('invoices')
    .insert(invoice)
    .select()
    .single();
  
  if (error) throw error;
  return data as Invoice;
}

export async function updateInvoice(id: string, updates: InvoiceUpdate) {
  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Invoice;
}

export async function deleteInvoice(id: string) {
  const { functionsUrl, adminToken, anonKey } = ensureFunctionsEnv();

  const res = await fetch(`${functionsUrl}/invoices-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ invoice_id: id }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Delete invoice failed (${res.status})`;
    try {
      const j = JSON.parse(body) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }
}

export async function fetchInvoicePayments(invoiceId: string): Promise<InvoicePayment[]> {
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as InvoicePayment[];
}

