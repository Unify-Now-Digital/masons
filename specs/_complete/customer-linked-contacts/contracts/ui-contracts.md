# UI Contracts: Customer Linked Contacts

---

## 1. EditCustomerDrawer — Linked Contacts section

**File**: `src/modules/customers/components/EditCustomerDrawer.tsx`
**Change type**: ADDITIVE — insert below the existing form fields, before `<DrawerFooter>`

```tsx
{/* ── Linked Contacts (read-only) ───────────────────────────────── */}
{customer && (
  <LinkedContactsSection customerId={customer.id} />
)}
```

### LinkedContactsSection sub-component (inlined or extracted)

```tsx
function LinkedContactsSection({ customerId }: { customerId: string }) {
  const { data: contacts = [], isLoading, isError } = useLinkedContactsByCustomer(customerId);

  return (
    <div className="space-y-2 pt-2">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Linked Contacts
      </h4>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Could not load linked contacts.</p>}
      {!isLoading && !isError && contacts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No linked contacts. Link addresses from the Inbox.
        </p>
      )}
      {!isLoading && contacts.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className="text-xs capitalize shrink-0">
            {channelLabel(c.channel)}
          </Badge>
          <span className="text-muted-foreground truncate">{c.handle}</span>
        </div>
      ))}
    </div>
  );
}
```

**Additional imports needed** (additive):
- `useLinkedContactsByCustomer` from `@/modules/customers`
- `Badge` from `@/shared/components/ui/badge`

---

## 2. ProofSendModal — contact picker

**File**: `src/modules/proofs/components/ProofSendModal.tsx`
**Change type**: REPLACEMENT of string props + internal contact picker

### Data fetching inside modal

```tsx
const { data: linkedContacts = [] } = useLinkedContactsByCustomer(customerId);
const { data: customer } = useCustomer(customerId ?? '');  // enabled: !!customerId

const emailOptions = buildEmailOptions(linkedContacts, customer?.email);
const phoneOptions = buildPhoneOptions(linkedContacts, customer?.phone);

// Per-channel state
const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

// Auto-select when single option
useEffect(() => {
  setSelectedEmail(emailOptions.length === 1 ? emailOptions[0] : null);
}, [emailOptions.join(',')]);

useEffect(() => {
  setSelectedPhone(phoneOptions.length === 1 ? phoneOptions[0].handle : null);
}, [phoneOptions.map(p => p.handle).join(',')]);
```

### Email channel picker

```tsx
{/* Email channel */}
<Tooltip>
  <TooltipTrigger asChild>
    <div className={`rounded border px-3 py-2 space-y-2 ${emailOptions.length === 0 ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3">
        <Checkbox
          id="send-email"
          checked={emailChecked}
          onCheckedChange={(v) => emailOptions.length > 0 && setEmailChecked(!!v)}
          disabled={emailOptions.length === 0}
        />
        <Label htmlFor="send-email" className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Email
          {emailOptions.length === 1 && (
            <span className="ml-1 text-xs text-muted-foreground">({emailOptions[0]})</span>
          )}
        </Label>
      </div>
      {emailChecked && emailOptions.length > 1 && (
        <RadioGroup value={selectedEmail ?? ''} onValueChange={setSelectedEmail} className="pl-7 space-y-1">
          {emailOptions.map((email) => (
            <div key={email} className="flex items-center gap-2">
              <RadioGroupItem value={email} id={`email-${email}`} />
              <Label htmlFor={`email-${email}`} className="text-xs font-normal">{email}</Label>
            </div>
          ))}
        </RadioGroup>
      )}
    </div>
  </TooltipTrigger>
  {emailOptions.length === 0 && (
    <TooltipContent>No email address on file for this customer</TooltipContent>
  )}
</Tooltip>
```

### WhatsApp channel picker (mirrors email picker, uses phoneOptions)

```tsx
{/* WhatsApp channel */}
<Tooltip>
  <TooltipTrigger asChild>
    <div className={`rounded border px-3 py-2 space-y-2 ${phoneOptions.length === 0 ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3">
        <Checkbox
          id="send-whatsapp"
          checked={whatsappChecked}
          onCheckedChange={(v) => phoneOptions.length > 0 && setWhatsappChecked(!!v)}
          disabled={phoneOptions.length === 0}
        />
        <Label htmlFor="send-whatsapp" className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          WhatsApp
          {phoneOptions.length === 1 && (
            <span className="ml-1 text-xs text-muted-foreground">({phoneOptions[0].handle})</span>
          )}
        </Label>
      </div>
      {whatsappChecked && phoneOptions.length > 1 && (
        <RadioGroup value={selectedPhone ?? ''} onValueChange={setSelectedPhone} className="pl-7 space-y-1">
          {phoneOptions.map((opt) => (
            <div key={opt.handle} className="flex items-center gap-2">
              <RadioGroupItem value={opt.handle} id={`phone-${opt.handle}`} />
              <Label htmlFor={`phone-${opt.handle}`} className="text-xs font-normal">
                {opt.handle}
                <span className="ml-1 text-muted-foreground">({channelLabel(opt.channel)})</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}
    </div>
  </TooltipTrigger>
  {phoneOptions.length === 0 && (
    <TooltipContent>No phone number on file for this customer</TooltipContent>
  )}
</Tooltip>
```

### Updated send gating

```tsx
const canSendEmail = emailOptions.length > 0;
const canSendWhatsApp = phoneOptions.length > 0;
const emailReady = emailChecked && (emailOptions.length === 1 ? true : !!selectedEmail);
const whatsAppReady = whatsappChecked && (phoneOptions.length === 1 ? true : !!selectedPhone);
const channelsSelected = emailReady || whatsAppReady;
```

### Updated handleSend

```tsx
const handleSend = () => {
  const channels: ('email' | 'whatsapp')[] = [];
  const resolvedEmail = emailOptions.length === 1 ? emailOptions[0] : (selectedEmail ?? null);
  const resolvedPhone = phoneOptions.length === 1 ? phoneOptions[0].handle : (selectedPhone ?? null);

  if (emailChecked && resolvedEmail) channels.push('email');
  if (whatsappChecked && resolvedPhone) channels.push('whatsapp');
  if (!channels.length) return;

  sendMutation.mutate({
    proof_id: proof.id,
    channels,
    customer_email: emailChecked ? resolvedEmail : null,
    customer_phone: whatsappChecked ? resolvedPhone : null,
  }, { onSuccess: () => { setSent(true); toast({ title: 'Proof sent to customer' }); onSuccess?.(); } });
};
```

**Additional imports needed** (additive):
- `RadioGroup, RadioGroupItem` from `@/shared/components/ui/radio-group`
- `useLinkedContactsByCustomer` from `@/modules/customers`
- `useCustomer` from `@/modules/customers/hooks/useCustomers`
- `buildEmailOptions`, `buildPhoneOptions`, `channelLabel` from `./proofContactUtils` (or inlined)

---

## 3. ProofPanel — prop pass-through update

**File**: `src/modules/proofs/components/ProofPanel.tsx`

Replace `customerEmail`/`customerPhone` with `customerId` in props and pass-through to `DraftScreen` → `ProofSendModal`:

```tsx
// Props interface: replace customerEmail/customerPhone with customerId
customerId?: string | null;

// DraftScreen props: replace customerEmail/customerPhone with customerId
// DraftScreen component signature updated accordingly
// ProofSendModal call inside DraftScreen:
<ProofSendModal
  open={sendOpen}
  onOpenChange={setSendOpen}
  proof={proof}
  renderUrl={signedUrl}
  customerId={customerId}   // was: customerEmail={customerEmail} customerPhone={customerPhone}
  onSuccess={() => setSendOpen(false)}
/>
```

---

## 4. OrderDetailsSidebar — simplification

**File**: `src/modules/orders/components/OrderDetailsSidebar.tsx`

Remove (lines added by prior hotfix):
```ts
// REMOVE these lines:
const { data: orderPeople } = useOrderPeople(order?.id ?? null);
const primaryPerson = orderPeople?.find((p) => p.is_primary) ?? orderPeople?.[0] ?? null;
const proofCustomerEmail = primaryPerson?.customers?.email ?? order?.customer_email ?? null;
const proofCustomerPhone = primaryPerson?.customers?.phone ?? order?.customer_phone ?? null;
// REMOVE import of useOrderPeople (if no longer used elsewhere in the file)
```

Update ProofPanel call:
```tsx
// Replace customerEmail + customerPhone with customerId
<ProofPanel
  orderId={order.id}
  initialInscriptionText={order.inscription_text ?? null}
  initialStonePhotoUrl={order.product_photo_url ?? null}
  initialFontStyle={order.inscription_font ?? null}
  customerId={order.person_id ?? null}
/>
```

---

## 5. customers/index.ts — export new hook

```ts
// Add to src/modules/customers/index.ts:
export { useLinkedContactsByCustomer, linkedContactsKeys } from './hooks/useLinkedContacts';
export type { LinkedContact } from './hooks/useLinkedContacts';
```
