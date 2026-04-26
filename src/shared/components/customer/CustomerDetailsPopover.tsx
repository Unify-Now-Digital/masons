import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useCustomer } from '@/modules/customers/hooks/useCustomers';
import { useOrderPersonId, useInvoicePersonIds } from '@/modules/orders/hooks/useOrders';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface CustomerDetailsPopoverProps {
  personId?: string | null;
  invoiceId?: string | null;
  orderId?: string | null;
  fallbackName?: string | null;
  fallbackPhone?: string | null;
  fallbackEmail?: string | null;
  trigger: React.ReactNode;
}

export const CustomerDetailsPopover: React.FC<CustomerDetailsPopoverProps> = ({
  personId,
  invoiceId,
  orderId,
  fallbackName,
  fallbackPhone,
  fallbackEmail,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  
  // Fetch invoice person_ids when invoiceId provided and popover is open
  const { data: invoicePersonIds, isLoading: isResolvingInvoice } = useInvoicePersonIds(
    invoiceId || null,
    { enabled: open && !!invoiceId }
  );
  
  // Fetch order person_id when orderId provided and popover is open
  const { data: orderPersonId, isLoading: isResolvingOrder } = useOrderPersonId(
    orderId || null,
    { enabled: open && !!orderId }
  );
  
  // Resolution priority: personId > invoiceId (derive) > orderId (legacy) > null
  const resolvedPersonId = personId ?? 
    (invoicePersonIds && invoicePersonIds.length === 1 ? invoicePersonIds[0] : null) ??
    orderPersonId ?? 
    null;
  
  // Link state logic
  const linkState: 'linked' | 'unlinked' | 'multiple' = 
    personId || (invoicePersonIds && invoicePersonIds.length === 1) || orderPersonId
      ? 'linked'
      : invoicePersonIds && invoicePersonIds.length > 1
      ? 'multiple'
      : 'unlinked';
  
  // Data fetching - only when popover is open and linkState is 'linked' and resolvedPersonId exists
  // Note: useCustomer doesn't accept options, so we use a workaround with conditional id
  const shouldFetch = open && linkState === 'linked' && !!resolvedPersonId;
  const { data: person, isLoading: isFetchingPerson, error } = useCustomer(shouldFetch ? resolvedPersonId : '');
  
  // Combined loading state
  const isLoading = isResolvingInvoice || isResolvingOrder || (isFetchingPerson && linkState === 'linked');
  
  // Determine display values with fallbacks
  const displayName = person 
    ? `${person.first_name} ${person.last_name}` 
    : (fallbackName || '—');
    
  const displayPhone = person?.phone || fallbackPhone || '—';
  const displayEmail = person?.email || fallbackEmail || '—';
  const displayAddress = person?.address 
    ? `${person.address}${person.city ? `, ${person.city}` : ''}${person.country ? `, ${person.country}` : ''}`
    : '—';

  const isLinked = linkState === 'linked' && !!person && !error;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {displayName}
              </CardTitle>
              <Badge variant={linkState === 'linked' ? "default" : "secondary"}>
                {linkState === 'linked' ? "Linked" : 
                 linkState === 'multiple' ? "Multiple people" : 
                 "Unlinked"}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                <div className="text-sm">
                  <span className="font-medium">Phone:</span> {displayPhone}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Email:</span> {displayEmail}
                </div>
                {displayAddress !== '—' && (
                  <div className="text-sm">
                    <span className="font-medium">Address:</span> {displayAddress}
                  </div>
                )}
              </>
            )}
          </CardContent>
          
          {linkState === 'multiple' && (
            <CardContent className="pt-0 border-t">
              <div className="text-sm text-muted-foreground p-2 bg-gardens-amb-lt rounded">
                This invoice contains orders from multiple people.
              </div>
            </CardContent>
          )}
          
          {resolvedPersonId && linkState === 'linked' && (
            <CardContent className="pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigate('/dashboard/customers');
                  setOpen(false);
                }}
                className="w-full"
              >
                Open Person
              </Button>
            </CardContent>
          )}
          
          <CardContent className="pt-0 border-t">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Messages</h4>
              <p className="text-sm text-muted-foreground">
                Coming soon — Inbox messages are not connected to People yet.
              </p>
              {/* Optional: disabled skeleton rows for future layout */}
              <div className="space-y-1 opacity-50">
                <div className="h-3 bg-muted rounded" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};

