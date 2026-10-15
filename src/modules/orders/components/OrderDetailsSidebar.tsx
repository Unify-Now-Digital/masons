import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { PaymentProgressBar } from "@/shared/components/PaymentProgressBar";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { 
  Calendar, 
  MapPin, 
  User, 
  DollarSign, 
  Package, 
  Clock, 
  AlertTriangle,
  Edit,
  X,
  MessageSquare,
  Phone,
  Mail,
} from 'lucide-react';
import { useUpdateOrder, useAdditionalOptionsByOrder } from '../hooks/useOrders';
import { useToast } from '@/shared/hooks/use-toast';
import { transformOrderForUI, type UIOrder } from '../utils/orderTransform';
import type { Order } from '../types/orders.types';
import { useMessagesByOrder } from '@/modules/inbox/hooks/useMessages';
import { getOrderTotalFormatted, getOrderBaseValue, getOrderPermitCost, getOrderAdditionalOptionsTotal } from '../utils/orderCalculations';
import { useInscriptionsByOrderId } from '@/modules/inscriptions/hooks/useInscriptions';
import { getOrderDisplayId } from '../utils/orderDisplayId';
import { formatOrderTypeLabel, isNewMemorialOrderType } from '../utils/orderTypeDisplay';
import { formatDateTimeDMY, formatGbpDecimal } from '@/shared/lib/formatters';
import { computeTimelineProgress, TIMELINE_BAR_TONE } from '../utils/timelineProgress';
import { useNavigate } from 'react-router-dom';
import { OrderContextPanel } from './OrderContextPanel';
import { PANEL_PRIMARY, PanelHeader, PanelShell } from '@/shared/components/mason';
import { cn } from '@/shared/lib/utils';
import type { OrderPanelSection } from '@/shared/context/orderPanel';

interface OrderDetailsSidebarProps {
  order: Order | null;
  onClose: () => void;
  onOrderUpdate?: (orderId: string, updates: Partial<Order>) => void;
  onSelectOrder?: (orderId: string) => void;
  onNewOrder?: (personId: string | null) => void;
  /** Scroll the context panel to this stage when it opens. */
  focusSection?: OrderPanelSection | null;
}

export const OrderDetailsSidebar: React.FC<OrderDetailsSidebarProps> = ({ order, onClose, onOrderUpdate, onSelectOrder, onNewOrder, focusSection }) => {
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => {
    if (!order || isEditing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, isEditing, onClose]);
  const [editedOrder, setEditedOrder] = useState<Order | null>(null);
  const { mutate: updateOrder, isPending } = useUpdateOrder();
  const { toast } = useToast();
  const { data: messages, isLoading: isMessagesLoading } = useMessagesByOrder(order?.id ?? null);
  const { data: additionalOptions, isLoading: isOptionsLoading } = useAdditionalOptionsByOrder(order?.id ?? null);
  const { data: inscriptions, isLoading: isInscriptionsLoading } = useInscriptionsByOrderId(order?.id ?? null);
  const navigate = useNavigate();
  const messagesRef = React.useRef<HTMLDivElement | null>(null);

  if (!order) return null;

  // Transform DB order to UI format for display
  const uiOrder = transformOrderForUI(order);

  const handleEditStart = () => {
    setIsEditing(true);
    setEditedOrder({ ...order });
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditedOrder(null);
  };

  const handleEditSave = () => {
    if (!editedOrder) return;

    // Convert UI format back to DB format
    const updates = {
      customer_name: editedOrder.customer_name,
      customer_email: editedOrder.customer_email || null,
      customer_phone: editedOrder.customer_phone || null,
      order_type: editedOrder.order_type,
      sku: editedOrder.sku || null,
      material: editedOrder.material || null,
      color: editedOrder.color || null,
      stone_status: editedOrder.stone_status,
      permit_status: editedOrder.permit_status,
      proof_status: editedOrder.proof_status,
      deposit_date: editedOrder.deposit_date || null,
      second_payment_date: editedOrder.second_payment_date || null,
      due_date: editedOrder.due_date || null,
      installation_date: editedOrder.installation_date || null,
      location: editedOrder.location || null,
      value: editedOrder.order_type === 'Renovation' ? null : (editedOrder.value ?? null),
      permit_cost: editedOrder.permit_cost ?? null,
      renovation_service_description: editedOrder.renovation_service_description?.trim() || null,
      renovation_service_cost: editedOrder.order_type === 'Renovation' 
        ? (editedOrder.renovation_service_cost ?? null)
        : null,
      progress: editedOrder.progress,
      assigned_to: editedOrder.assigned_to || null,
      priority: editedOrder.priority,
      timeline_weeks: editedOrder.timeline_weeks,
      notes: editedOrder.notes || null,
    };

    updateOrder(
      { id: editedOrder.id, updates },
      {
        onSuccess: () => {
          toast({
            title: 'Order updated',
            description: 'Order has been updated successfully.',
          });
          setIsEditing(false);
          setEditedOrder(null);
          if (onOrderUpdate) {
            onOrderUpdate(editedOrder.id, updates);
          }
        },
        onError: (error: unknown) => {
          const description = error instanceof Error ? error.message : 'Failed to update order.';
          toast({
            title: 'Error',
            description,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleFieldChange = (field: keyof Order, value: Order[keyof Order]) => {
    if (editedOrder) {
      setEditedOrder({ ...editedOrder, [field]: value });
    }
  };

  const currentOrder = isEditing && editedOrder ? editedOrder : order;
  const currentUIOrder = isEditing && editedOrder ? transformOrderForUI(editedOrder) : uiOrder;
  const quoteProductFallback =
    !currentOrder.product_id &&
    currentOrder.quote_product_name &&
    currentOrder.quote_product_name.trim().length > 0
      ? currentOrder.quote_product_name.trim()
      : null;
  
  // Use fetched additional options if available, otherwise fall back to order.additional_options (if present)
  const displayOptions = additionalOptions || currentOrder.additional_options || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      // Stone statuses
      case "NA": return "bg-gardens-page text-gardens-tx";
      case "Ordered": return "bg-gardens-blu-lt text-gardens-blu-dk";
      case "In Stock": return "bg-gardens-grn-lt text-gardens-grn-dk";
      // Permit statuses
      case "form_sent": return "bg-gardens-amb-lt text-gardens-amb-dk";
      case "customer_completed": return "bg-gardens-blu-lt text-gardens-blu-dk";
      case "pending": return "bg-gardens-amb-lt text-gardens-amb-dk";
      case "approved": return "bg-gardens-grn-lt text-gardens-grn-dk";
      // Proof statuses
      case "Not_Received": return "bg-gardens-red-lt text-gardens-red-dk";
      case "Received": return "bg-gardens-blu-lt text-gardens-blu-dk";
      case "Sent": return "bg-gardens-amb-lt text-gardens-amb-dk";
      case "Revision": return "bg-gardens-amb-lt text-gardens-amb-dk";
      case "Approved": return "bg-gardens-grn-lt text-gardens-grn-dk";
      case "In_Progress": return "bg-gardens-amb-lt text-gardens-amb-dk";
      case "Lettered": return "bg-gardens-grn-lt text-gardens-grn-dk";
      default: return "bg-gardens-page text-gardens-tx";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-gardens-red-dk";
      case "medium": return "text-gardens-amb-dk";
      case "low": return "text-gardens-grn-dk";
      default: return "text-gardens-tx";
    }
  };

  const getDaysUntilDue = (dueDate: string | null) => {
    if (!dueDate) return Infinity;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Same helper as the Orders table Timeline column, so sidebar and cell always agree.
  const getProgressData = (order: Order) =>
    computeTimelineProgress(
      { depositDate: order.deposit_date, timelineWeeks: order.timeline_weeks, installationDate: order.installation_date },
      new Date()
    );

  const daysUntilDue = getDaysUntilDue(currentOrder.due_date);
  const progressData = getProgressData(currentOrder);

  const stoneStatuses = ["NA", "Ordered", "In Stock"];

  const formatMessageDate = (isoString: string) => {
    if (!isoString) return '';
    return formatDateTimeDMY(isoString, { withTime: true, withSeconds: false, use12Hour: false });
  };

  // orders-v10: compact shared panel in view mode. Edit mode keeps the full form below.
  const extras = (
    <>
        {/* Related Messages */}
        <div ref={messagesRef} />
        <Card className="mb-4 bg-gardens-surf">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Related Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isMessagesLoading && (
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            )}
            {!isMessagesLoading && (!messages || messages.length === 0) && (
              <p className="text-sm text-muted-foreground">No messages for this order</p>
            )}
            {!isMessagesLoading && messages && messages.length > 0 && (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className="border rounded-md p-2">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-sm font-medium">{message.from_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatMessageDate(message.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line line-clamp-3">
                      {message.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inscriptions */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inscriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isInscriptionsLoading && (
              <p className="text-sm text-muted-foreground">Loading inscriptions...</p>
            )}
            {!isInscriptionsLoading && (!inscriptions || inscriptions.length === 0) && (
              <p className="text-sm text-muted-foreground">No inscriptions linked to this order.</p>
            )}
            {!isInscriptionsLoading && inscriptions && inscriptions.length > 0 && (
              <div className="space-y-2">
                {inscriptions.map((inscription) => (
                  <div key={inscription.id} className="flex items-start justify-between p-2 border rounded">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium mb-1">
                        {inscription.inscription_text.substring(0, 50)}
                        {inscription.inscription_text.length > 50 && '...'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {inscription.type.charAt(0).toUpperCase() + inscription.type.slice(1)}
                        {inscription.created_at && (
                          <span className="ml-2">
                            • {format(new Date(inscription.created_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

    </>
  );

  if (!isEditing) {
    // Universal context panel (Oct 2026): same component and section order as the Inbox panel.
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-l border-gardens-bdr bg-gardens-surf max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:bottom-14 max-lg:z-50 lg:sticky lg:top-0 lg:h-[calc(100dvh-6rem)] lg:max-h-[calc(100dvh-6rem)] lg:self-start" aria-label="Order details">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-8">
          <OrderContextPanel
            key={order.id}
            order={order}
            focusSection={focusSection}
            onSelectOrder={onSelectOrder}
            onNewOrder={onNewOrder && order.person_id ? () => onNewOrder(order.person_id) : undefined}
            headerActions={
              <>
                <Button variant="ghost" size="sm" className="h-11 w-11 p-0" onClick={handleEditStart} aria-label="Edit order">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-11 w-11 p-0" onClick={onClose} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </>
            }
            extraSections={[{ id: 'messages', title: 'Messages & inscriptions', icon: MessageSquare, node: extras }]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gardens-surf2 lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[420px] lg:border-l lg:border-gardens-bdr">
      <PanelHeader
        kicker={getOrderDisplayId(currentOrder)}
        name={currentOrder.person_name || currentOrder.customer_name || 'Order'}
        source={currentOrder.quote_id != null && String(currentOrder.quote_id).trim() !== '' ? <Badge variant="secondary" className="text-xs font-normal">From Quote</Badge> : undefined}
        action={(
          <button type="button" data-testid="panel-primary" className={cn(PANEL_PRIMARY, 'w-full')} onClick={handleEditSave} disabled={isPending}>
            Save
          </button>
        )}
        extra={(
          <button type="button" onClick={handleEditCancel} disabled={isPending} className="inline-flex h-11 items-center px-2 text-[13px] font-semibold text-gardens-txs hover:text-gardens-tx disabled:opacity-50">
            Cancel
          </button>
        )}
        onClose={onClose}
      />
      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-6">
        {/* Priority Alert */}
        {currentOrder.priority === 'high' && (
          <div className="mb-4 p-3 bg-gardens-red-lt border border-gardens-red-lt rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-gardens-red-dk" />
            <span className="text-sm text-gardens-red-dk font-medium">High Priority Order</span>
          </div>
        )}

        {/* Status and Progress */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status & Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Stone Status</span>
                  {isEditing ? (
                    <Select value={currentOrder.stone_status} onValueChange={(value) => handleFieldChange('stone_status', value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stoneStatuses.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={getStatusColor(currentOrder.stone_status)}>
                      {currentOrder.stone_status}
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Timeline Progress</span>
                  <span
                    className={
                      progressData.state === 'active' && progressData.isOver
                        ? 'text-gardens-red-dk font-medium'
                        : 'text-muted-foreground'
                    }
                  >
                    {progressData.label}
                  </span>
                </div>
                {progressData.state === 'active' ? (
                  <PaymentProgressBar
                    percent={progressData.percent}
                    tone={progressData.isOver ? TIMELINE_BAR_TONE.over : TIMELINE_BAR_TONE.under}
                  />
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className={daysUntilDue < 0 ? 'text-gardens-red-dk' : daysUntilDue < 7 ? 'text-gardens-amb-dk' : 'text-muted-foreground'}>
                  {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days until due`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {isEditing ? (
                <Input 
                  value={currentOrder.customer_name} 
                  onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                  className="h-6 text-sm"
                />
              ) : (
                <span className="font-medium">{currentUIOrder.customer}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                <Phone className="h-3 w-3 mr-1" />
                Call
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                <Mail className="h-3 w-3 mr-1" />
                Email
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Order Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              {isEditing ? (
                <Input 
                  value={currentOrder.order_type} 
                  onChange={(e) => handleFieldChange('order_type', e.target.value)}
                  className="h-6 text-sm"
                />
              ) : (
                <span>{formatOrderTypeLabel(currentOrder.order_type)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">Product:</span>
              {quoteProductFallback ? (
                <span className="text-sm text-muted-foreground">
                  (From quote: {quoteProductFallback})
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">N/A</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">SKU:</span>
              {isEditing ? (
                <Input 
                  value={currentOrder.sku || ''} 
                  onChange={(e) => handleFieldChange('sku', e.target.value)}
                  className="h-6 text-sm flex-1"
                />
              ) : (
                <span className="font-medium">{currentUIOrder.sku || '—'}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">Material:</span>
              {isEditing ? (
                <Input 
                  value={currentOrder.material || ''} 
                  onChange={(e) => handleFieldChange('material', e.target.value)}
                  className="h-6 text-sm flex-1"
                />
              ) : (
                <span>{currentUIOrder.material || '—'}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">Color:</span>
              {isEditing ? (
                <Input 
                  value={currentOrder.color || ''} 
                  onChange={(e) => handleFieldChange('color', e.target.value)}
                  className="h-6 text-sm flex-1"
                />
              ) : (
                <span>{currentUIOrder.color || '—'}</span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Base Value:</span>
                {isEditing ? (
                  <Input 
                    type="number"
                    step="0.01"
                    value={getOrderBaseValue(currentOrder) || ''} 
                    onChange={(e) => {
                      // For Renovation orders, update renovation_service_cost; for New Memorial, update value
                      if (currentOrder.order_type === 'Renovation') {
                        handleFieldChange('renovation_service_cost', e.target.value ? parseFloat(e.target.value) : null);
                      } else {
                        handleFieldChange('value', e.target.value ? parseFloat(e.target.value) : null);
                      }
                    }}
                    className="h-6 text-sm flex-1"
                  />
                ) : (
                  <span className="font-medium">
                    {(() => {
                      const baseValue = getOrderBaseValue(currentOrder);
                      return baseValue > 0 
                        ? formatGbpDecimal(baseValue)
                        : formatGbpDecimal(0);
                    })()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Permit Cost:</span>
                {isEditing ? (
                  <Input 
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentOrder.permit_cost ?? ''} 
                    onChange={(e) => handleFieldChange('permit_cost', e.target.value ? parseFloat(e.target.value) : null)}
                    className="h-6 text-sm flex-1"
                  />
                ) : (
                  <span className="font-medium">
                    {getOrderPermitCost(currentOrder) > 0 
                      ? formatGbpDecimal(getOrderPermitCost(currentOrder))
                      : formatGbpDecimal(0)}
                  </span>
                )}
              </div>
              {/* Additional Options */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Additional Options:</span>
                </div>
                {isOptionsLoading ? (
                  <p className="text-sm text-muted-foreground pl-6">Loading options...</p>
                ) : displayOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6 italic">No additional options</p>
                ) : (
                  <div className="pl-6 space-y-1">
                    {displayOptions.map((option) => (
                      <div key={option.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {option.name}
                          {option.description && (
                            <span className="text-xs text-muted-foreground ml-2">({option.description})</span>
                          )}
                        </span>
                        <span className="font-medium">
                          {formatGbpDecimal(option.cost)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="text-sm text-muted-foreground">Options Subtotal:</span>
                  <span className="font-medium">
                    {isOptionsLoading ? (
                      <span className="text-muted-foreground">...</span>
                    ) : (
                      formatGbpDecimal(getOrderAdditionalOptionsTotal(currentOrder))
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Total:</span>
                <span className="font-bold text-base">
                  {getOrderTotalFormatted(currentOrder)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">Timeline:</span>
              {isEditing ? (
                <Input 
                  type="number"
                  value={currentOrder.timeline_weeks} 
                  onChange={(e) => handleFieldChange('timeline_weeks', parseInt(e.target.value) || 12)}
                  className="h-6 text-sm w-20"
                />
              ) : (
                <span>{currentUIOrder.timelineWeeks} weeks</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {isEditing ? (
                <Input 
                  value={currentOrder.location || ''} 
                  onChange={(e) => handleFieldChange('location', e.target.value)}
                  className="h-6 text-sm"
                />
              ) : (
                <span>{currentUIOrder.location || '—'}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {isEditing ? (
                <Input 
                  value={currentOrder.assigned_to || ''} 
                  onChange={(e) => handleFieldChange('assigned_to', e.target.value)}
                  className="h-6 text-sm"
                  placeholder="Assigned to:"
                />
              ) : (
                <span>Assigned to: {currentUIOrder.assignedTo || 'Unassigned'}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${getPriorityColor(currentOrder.priority)}`} />
              <span className={`capitalize ${getPriorityColor(currentOrder.priority)}`}>
                {currentOrder.priority} Priority
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Product Photo - Only for New Memorial orders with photo */}
        {isNewMemorialOrderType(currentOrder.order_type) && currentOrder.product_photo_url && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Product Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <img
                  src={currentOrder.product_photo_url}
                  alt="Product photo"
                  className="max-w-full max-h-[300px] object-contain rounded border"
                  onError={(e) => {
                    // Fallback to placeholder on error
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const placeholder = document.createElement('div');
                      placeholder.className = 'text-center text-muted-foreground py-8';
                      placeholder.textContent = 'Photo unavailable';
                      parent.appendChild(placeholder);
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Important Dates */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Important Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Deposit Date</span>
              {isEditing ? (
                <Input 
                  type="date"
                  value={currentOrder.deposit_date || ''} 
                  onChange={(e) => handleFieldChange('deposit_date', e.target.value || null)}
                  className="h-6 text-sm w-32"
                />
              ) : (
                <span className="text-sm font-medium">{currentUIOrder.depositDate || '—'}</span>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Second Payment</span>
              {isEditing ? (
                <Input 
                  type="date"
                  value={currentOrder.second_payment_date || ''} 
                  onChange={(e) => handleFieldChange('second_payment_date', e.target.value || null)}
                  className="h-6 text-sm w-32"
                />
              ) : (
                <span className="text-sm font-medium">
                  {currentUIOrder.secondPaymentDate || (
                    <span className="text-muted-foreground italic">Not scheduled</span>
                  )}
                </span>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Due Date</span>
              {isEditing ? (
                <Input 
                  type="date"
                  value={currentOrder.due_date || ''} 
                  onChange={(e) => handleFieldChange('due_date', e.target.value || null)}
                  className="h-6 text-sm w-32"
                />
              ) : (
                <span className="text-sm font-medium">{currentUIOrder.dueDate || '—'}</span>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fixing date</span>
              {isEditing ? (
                <Input 
                  type="date"
                  value={currentOrder.installation_date || ''} 
                  onChange={(e) => handleFieldChange('installation_date', e.target.value || null)}
                  className="h-6 text-sm w-32"
                />
              ) : (
                <span className="text-sm font-medium">
                  {currentUIOrder.installationDate || (
                    <span className="text-muted-foreground italic">Not scheduled</span>
                  )}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {extras}
        {/* Actions */}
        <div className="space-y-2">
          <Button className="w-full">
            <Edit className="h-4 w-4 mr-2" />
            Edit Order
          </Button>
          <Button variant="outline" className="w-full">
            <MessageSquare className="h-4 w-4 mr-2" />
            Add Note
          </Button>
          <Button variant="outline" className="w-full">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Installation
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default OrderDetailsSidebar;
