# Revolut field mapping

Amounts on `order_payments` are decimal GBP pounds. Revolut leg amounts are already major units (pounds), signed. We store the positive incoming amount, rounded to pence (`Math.round(n * 100) / 100`). We do not multiply by 100. `invoice_payments.amount` stays pence and is divided by 100 only when a Stripe invoice payment is folded into cash-in.

Dates shown on Finance, Reconcile, the order panel, and Settings use `Europe/London`. Cash in today is London midnight to the next London midnight. Cash in this month is the London first of the month up to now. A record-payment date is stored as noon Europe/London.

`provider_state` is `pending`, `completed`, `declined`, `failed`, or `reverted`. Cash-in KPIs count `completed`, and a blank state (a legacy row). Pending, declined, failed, and reverted do not count. A blank state is treated as acceptable in Reconcile.

| Revolut field | DB column | Where it shows | Transform |
| --- | --- | --- | --- |
| Transaction `id` | `order_payments.external_id` | Not shown as a raw id. Accept and Ignore update the row with this id. A second row with the same id is skipped. The duplicate warning names it. | Idempotency key. Manual rows use `manual:<uuid>` and are not this id. |
| Transaction `type` | `order_payments.revolut_type` | Not shown. | Only `transfer`, `topup`, `refund`, `card_refund`, `card_credit` are incoming. Card spend, fee, tax, exchange, ATM are skipped. |
| Transaction `state` | `order_payments.provider_state` | Reconcile (pending waits). Order panel shows the state when the row is not matched. KPIs use it as a filter. | Lower case. `completed` can auto-match and counts as cash. `pending` is queued, not counted. `declined`, `failed`, `reverted` become `status = dismissed` and are not counted. |
| Transaction `reference` | `order_payments.reference` | Reconcile. Payments ledger. Order panel when there is no counterparty name. | Trimmed. Used for order-number matching (the number must be its own token, and at least 100). |
| `completed_at`, else `created_at` | `order_payments.received_at` | Cash in today, Cash in this month, Payments date, Reconcile date, order panel date. | Stored as the Revolut timestamp. Displayed in Europe/London. |
| Leg `leg_id` | `order_payments.leg_id` | Not shown. | The incoming leg we posted. |
| Leg `account_id` | `order_payments.account_id` | Not shown. | Account the money landed in. |
| Leg `amount` | `order_payments.amount` | Cash in today (Revolut subtotal), Cash in this month (Revolut subtotal), Payments amount, Reconcile amount, Owed to us (subtracted once matched), order panel Paid and the payment line. | Positive pounds only. Two decimals. Negative legs are not money in. |
| Leg `currency` | `order_payments.currency` | Not shown as a separate label. Amounts are formatted as £. | Upper case. A GBP leg is preferred. If the only incoming leg is another currency, that currency is stored and the number is still shown as a decimal. |
| Leg `description` | `order_payments.counterparty_name` when no counterparty name was fetched | Reconcile payer, Payments line when the payment is not on an order, order panel line. | A leading "From " is removed. |
| Leg `counterparty.id` | Not stored | Used only to call `GET /counterparty/{id}`. | — |
| Leg `counterparty.account_type` | Not stored | Not shown. | `self` is skipped. Two positive legs and no external counterparty is an internal transfer and is skipped. |
| `GET /counterparty/{id}` `.name` | `order_payments.counterparty_name` | Reconcile payer. Payments line. Order panel line. Duplicate-warning name when the manual row has no order. | Preferred over the leg description. |
| `GET /accounts` `id` | `order_payments.account_id` (via the leg) | Not shown. | Sync asks Revolut for the one active GBP account and passes it as the transactions filter. |
| `GET /accounts` `currency`, `state` | Not stored | Not shown. | Keep `GBP` and `active`. Name and balance are not stored. |
| Webhook `Revolut-Request-Timestamp` | Not stored | Not shown. | Unix milliseconds. Rejected if it is not all digits or is more than 5 minutes off. |
| Webhook `Revolut-Signature` | Checked against `revolut_connections.webhook_signing_secret` | Not shown. The secret is not in `revolut_connections_safe`. | `v1.` + timestamp + `.` + raw body, HMAC-SHA256, header `v1=<hex>`. Several signatures are allowed during secret rotation. |
| Webhook `event` | Not stored | Not shown. | `TransactionCreated` (full transaction, often pending). `TransactionStateChanged` (only id and states; the function then fetches the transaction). |
| Webhook `data.id` | `order_payments.external_id` | Same as the transaction id. | Same idempotency key. |
| Webhook `data.old_state`, `data.new_state` | `order_payments.provider_state` (`new_state`) | Same as transaction state. | A terminal `new_state` dismisses the existing row and keeps a human `matched_by` if one was set. |
| Webhook `data.request_id`, body `timestamp` | Not stored | Not shown. | The signature uses the header timestamp, not the body timestamp. |
| OAuth client id | `revolut_connections.client_id` | Not shown. | From `REVOLUT_CLIENT_ID`. One client id can be active on one organisation. |
| Access token, refresh token | `revolut_connections.access_token`, `refresh_token` | Not shown. Column grants hide them from the browser. | Service role only. |
| Access token expiry | `revolut_connections.token_expires_at` | Settings, under the connection: "access refreshes" in Europe/London. | About 40 minutes. Sync and the token cron refresh it when it is inside 5 minutes of expiry. |
| Refresh lifetime | `revolut_connections.refresh_token_expires_at` | Settings badge and the "Token expiring" line. | Revolut does not send an expiry. We store now + 90 days (or `refresh_token_expires_in` when a response includes it). Warning at 14 days. Past that, status becomes expired and Settings asks to Connect again. |
| Connection `status` | `revolut_connections.status` | Settings badge: Connected, Token expired, Disconnected, Not connected. | `active`, `expired`, `revoked`. |
| Connection `environment` | `revolut_connections.environment` | Settings: Sandbox or Production. | Chosen by `REVOLUT_SANDBOX` at connect time and kept for later API calls. |
| `last_synced_at` | `revolut_connections.last_synced_at` | Settings "Last synced", Europe/London. | Set when a sync finishes. The next sync starts two days before this, or 90 days back on the first run. |
| `last_sync_error` | `revolut_connections.last_sync_error` | Settings error line. | Short code only (`refresh_expired`, `webhook_registration_failed`, `sync_failed`). Cleared after a successful sync. |
| `webhook_id` | `revolut_connections.webhook_id` | Not shown. | Deleted on disconnect. |
| — | `order_payments.source` | Payments source pill "Revolut". KPI Revolut subtotals. | Always `revolut` for these rows. Accept sets it again so a manual id cannot be rewritten onto this transaction. |
| — | `order_payments.status` | Reconcile lists `unmatched`. Matched rows feed KPIs, Owed to us, and the order panel Paid figure. | `matched` updates `orders.amount_paid` via the existing trigger. `dismissed` does not. |
| — | `order_payments.order_id` | Suggested order on Reconcile. Payments shows the order once matched. Owed to us subtracts the matched amount. | Set only for one high-confidence completed match, or when someone presses Accept. |
| — | `order_payments.match_candidates` | Reconcile: suggested order, confidence (High / Medium / Low), reason. | High: order number in the reference, or living-customer surname plus amount within £0.01. Medium and low are suggestions only. |
| — | `order_payments.payment_type` | Payments "type". | Left null by sync. Accept sets `deposit` when matched payments on that order are £0, otherwise `final`. |
| — | `order_payments.matched_by` | Not shown. | `auto` for a high match. The signed-in email for Accept and Ignore. |
| Manual Record payment | `order_payments.external_id` `manual:<uuid>`, `source` as chosen, `amount` pounds, `received_at` London noon | Record payment dialog. Payments. Owed to us. A Revolut choice shows the hint to Accept in Reconcile instead. | If a completed Revolut row for the same order, same pounds (±£0.01), within 3 days is also matched, the manual row is left out of cash-in. The Reconcile flags still say "Likely manual duplicate of Revolut" even when the Revolut row is not matched yet, and cash-in keeps the manual row until the Revolut row is the matched one. |

Settings actions: Connect, Connected, Last synced, Sync now, Disconnect, Token expiring, plus load, connect, sync, disconnect, OAuth, and webhook errors. OAuth returns to Settings → Integrations.
