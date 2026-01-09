import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { MapPin, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import type { Order } from '@/modules/orders/types/orders.types';
import { mapStoneStatusToOperational, STATUS_LABELS } from '../utils/orderStatusMap';
import { getOrderTotalFormatted } from '@/modules/orders/utils/orderCalculations';

interface OrderInfoPanelProps {
  order: Order;
  isSelected: boolean;
  onToggleSelection: () => void;
  onViewOrder: () => void;
  onClose?: () => void;
}

export const OrderInfoPanel: React.FC<OrderInfoPanelProps> = ({
  order,
  isSelected,
  onToggleSelection,
  onViewOrder,
  onClose,
}) => {
  const isAssigned = order.job_id !== null;
  
  // Parse dimensions from notes (if present)
  const parseDimensions = (notes: string | null): string | null => {
    if (!notes) return null;
    // Simple regex to find dimensions (e.g., "12x8x2", "12\" x 8\" x 2\"")
    const dimensionMatch = notes.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?/i);
    if (dimensionMatch) {
      return dimensionMatch[0];
    }
    return null;
  };

  const dimensions = parseDimensions(order.notes);

  return (
    <Card className="w-full max-w-md relative">
      {onClose && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 h-6 w-6 p-0"
        >
          ×
        </Button>
      )}
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg pr-8">{order.customer_name}</CardTitle>
          {isAssigned && (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700">
              Assigned
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Details */}
        <div className="space-y-2 text-sm">
          {order.sku && (
            <div>
              <span className="font-medium">Grave Number:</span> {order.sku}
            </div>
          )}
          {order.location && (
            <div className="flex items-start">
              <MapPin className="h-4 w-4 mr-1 mt-0.5 text-slate-500 flex-shrink-0" />
              <span>{order.location}</span>
            </div>
          )}
          {/* Coordinates / pinned status */}
          {(() => {
            const hasCoords =
              typeof order.latitude === 'number' &&
              typeof order.longitude === 'number' &&
              Number.isFinite(order.latitude) &&
              Number.isFinite(order.longitude) &&
              order.latitude >= -90 &&
              order.latitude <= 90 &&
              order.longitude >= -180 &&
              order.longitude <= 180;

            if (hasCoords) {
              return (
                <div className="text-xs text-slate-600">
                  Coordinates: {order.latitude.toFixed(6)}, {order.longitude.toFixed(6)}
                </div>
              );
            }

            return (
              <div className="text-xs text-slate-500">
                No location pinned
              </div>
            );
          })()}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant="outline">
                {STATUS_LABELS[mapStoneStatusToOperational(order.stone_status)]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Product Snapshot */}
        {(order.material || order.color) && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs font-medium text-slate-600">Product Details</p>
            {order.material && (
              <div className="text-sm">
                <span className="font-medium">Stone Type:</span> {order.material}
              </div>
            )}
            {order.color && (
              <div className="text-sm">
                <span className="font-medium">Stone Color:</span> {order.color}
              </div>
            )}
            {dimensions && (
              <div className="text-sm">
                <span className="font-medium">Dimensions:</span> {dimensions}
              </div>
            )}
          </div>
        )}

        {/* Price */}
        <div className="pt-2 border-t">
          <div className="text-sm">
            <span className="font-medium">Total:</span> {getOrderTotalFormatted(order)}
          </div>
        </div>

        {/* Notes (Collapsed) */}
        {order.notes && (
          <details className="pt-2 border-t">
            <summary className="text-sm font-medium cursor-pointer">Notes</summary>
            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{order.notes}</p>
          </details>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          {!isAssigned && (
            <Button
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={onToggleSelection}
              className="flex-1"
            >
              {isSelected ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Deselect
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Select
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onViewOrder}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Order
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

