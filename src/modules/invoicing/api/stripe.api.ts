/**
 * Stripe Checkout API – Lean MVP.
 * createCheckoutSession creates a Stripe Checkout Session and returns the payment URL.
 */

const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
const adminToken = import.meta.env.VITE_INBOX_ADMIN_TOKEN as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function ensureEnv(): { functionsUrl: string; adminToken: string; anonKey: string } {
  if (!functionsUrl?.trim()) {
    throw new Error(
      'VITE_SUPABASE_FUNCTIONS_URL is missing. Add it to .env and restart Vite.'
    );
  }
  if (!adminToken?.trim()) {
    throw new Error(
      'VITE_INBOX_ADMIN_TOKEN is missing. Add it to .env and restart Vite.'
    );
  }
  if (!supabaseAnonKey?.trim()) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY is missing. Add it to .env and restart Vite.'
    );
  }
  return {
    functionsUrl: functionsUrl.replace(/\/$/, ''),
    adminToken: adminToken.trim(),
    anonKey: supabaseAnonKey.trim(),
  };
}

export interface CreateCheckoutSessionResponse {
  url: string;
}

/**
 * Create a Stripe Checkout Session for the given invoice.
 * Returns the checkout URL to share with the customer.
 * @throws If env vars missing or non-2xx response
 */
export async function createCheckoutSession(
  invoiceId: string
): Promise<CreateCheckoutSessionResponse> {
  const { functionsUrl, adminToken, anonKey } = ensureEnv();

  const res = await fetch(`${functionsUrl}/stripe-create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Stripe Checkout failed (${res.status})`;
    try {
      const j = JSON.parse(body) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  const data = (await res.json()) as CreateCheckoutSessionResponse;
  if (!data?.url || typeof data.url !== 'string') {
    throw new Error('Invalid response: missing url');
  }
  return data;
}

// ---------------------------------------------------------------------------
// Stripe Invoicing API (new flow — embedded Payment Element)
// ---------------------------------------------------------------------------

export interface CreateStripeInvoiceResponse {
  stripe_invoice_id: string;
  /** Hosted invoice page URL (customer pays here; partial payments supported) */
  hosted_invoice_url: string | null;
  invoice_pdf?: string | null;
  stripe_invoice_status?: string;
  amount_paid?: number;
  amount_remaining?: number | null;
}

export interface SendStripeInvoiceResponse {
  stripe_invoice_id: string;
  hosted_invoice_url: string | null;
  stripe_invoice_status: string;
}

/**
 * Create (or retrieve existing) Stripe Invoice for the given Mason invoice.
 * Uses send_invoice (hosted page only; partial payments supported).
 * Returns hosted_invoice_url for opening in new tab.
 */
export async function createStripeInvoice(
  invoiceId: string
): Promise<CreateStripeInvoiceResponse> {
  const { functionsUrl, adminToken, anonKey } = ensureEnv();

  const res = await fetch(`${functionsUrl}/stripe-create-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Stripe Invoice creation failed (${res.status})`;
    try {
      const j = JSON.parse(body) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  const data = (await res.json()) as CreateStripeInvoiceResponse;
  if (!data?.stripe_invoice_id || typeof data.stripe_invoice_id !== 'string') {
    throw new Error('Invalid response: missing stripe_invoice_id');
  }
  return data;
}

/**
 * Send or re-send Stripe Invoice (e.g. "Request payment").
 * Returns latest hosted_invoice_url and status.
 */
export async function sendStripeInvoice(
  invoiceId: string
): Promise<SendStripeInvoiceResponse> {
  const { functionsUrl, adminToken, anonKey } = ensureEnv();

  const res = await fetch(`${functionsUrl}/stripe-send-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Send invoice failed (${res.status})`;
    try {
      const j = JSON.parse(body) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  const data = (await res.json()) as SendStripeInvoiceResponse;
  if (!data?.stripe_invoice_id) {
    throw new Error('Invalid response: missing stripe_invoice_id');
  }
  return data;
}

export interface ReviseStripeInvoiceResponse {
  new_invoice_id: string;
  new_invoice_number: string;
  revised_from_invoice_id: string;
}

export interface CreateInvoicePaymentLinkResponse {
  checkout_url: string;
  session_id: string;
  amount: number;
  currency: string;
}

/**
 * Revise invoice: void old Stripe invoice and create a new Mason invoice
 * with the same orders. Returns the new invoice id; call createStripeInvoice(new_invoice_id) next.
 */
export async function reviseStripeInvoice(
  invoiceId: string
): Promise<ReviseStripeInvoiceResponse> {
  const { functionsUrl, adminToken, anonKey } = ensureEnv();

  const res = await fetch(`${functionsUrl}/stripe-revise-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Revise invoice failed (${res.status})`;
    try {
      const j = JSON.parse(body) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  const data = (await res.json()) as ReviseStripeInvoiceResponse;
  if (!data?.new_invoice_id) {
    throw new Error('Invalid response: missing new_invoice_id');
  }
  return data;
}

/**
 * Create a partial-payment Checkout link attached to an existing Stripe invoice.
 */
export async function createInvoicePaymentLink(
  invoiceId: string,
  amount: number
): Promise<CreateInvoicePaymentLinkResponse> {
  const { functionsUrl, adminToken, anonKey } = ensureEnv();

  const res = await fetch(`${functionsUrl}/stripe-create-invoice-payment-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ invoice_id: invoiceId, amount }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Create invoice payment link failed (${res.status})`;
    try {
      const j = JSON.parse(body) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  const data = (await res.json()) as CreateInvoicePaymentLinkResponse;
  if (!data?.checkout_url || !data.session_id) {
    throw new Error('Invalid response: missing checkout_url or session_id');
  }
  return data;
}
