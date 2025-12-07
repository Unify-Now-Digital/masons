import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { Progress } from "@/shared/components/ui/progress";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { 
  X, 
  Calendar, 
  MapPin, 
  User, 
  DollarSign, 
  Package, 
  Clock, 
  AlertTriangle,
  Edit,
  MessageSquare,
  Phone,
  Mail,
  Save,
  XCircle
} from 'lucide-react';

interface Order {
  id: string;
  customer: string;
  type: string;
  stoneStatus: string;
  permitStatus: string;
  proofStatus: string;
  dueDate: string;
  depositDate: string;
  secondPaymentDate: string | null;
  installationDate: string | null;
  value: string;
  location: string;
  progress: number;
  assignedTo: string;
  priority: string;
  sku: string;
  material: string;
  color: string;
  timelineWeeks: number;
}

interface OrderDetailsSidebarProps {
  order: Order | null;
  onClose: () => void;
  onOrderUpdate?: (orderId: string, updates: Partial<Order>) => void;
}

export const OrderDetailsSidebar: React.FC<OrderDetailsSidebarProps> = ({ order, onClose, onOrderUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedOrder, setEditedOrder] = useState<Order | null>(null);

  if (!order) return null;

  const handleEditStart = () => {
    setIsEditing(true);
    setEditedOrder({ ...order });
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditedOrder(null);
  };

  const handleEditSave = () => {
    if (editedOrder && onOrderUpdate) {
      onOrderUpdate(editedOrder.id, editedOrder);
    }
    setIsEditing(false);
    setEditedOrder(null);
  };

  const handleFieldChange = (field: keyof Order, value: any) => {
    if (editedOrder) {
      setEditedOrder({ ...editedOrder, [field]: value });
    }
  };

  const currentOrder = isEditing && editedOrder ? editedOrder : order;

  const getStatusColor = (status: string) => {
    switch (status) {
      // Stone statuses
      case "NA": return "bg-gray-100 text-gray-700";
      case "Ordered": return "bg-blue-100 text-blue-700";
      case "In Stock": return "bg-green-100 text-green-700";
      // Permit statuses
      case "form_sent": return "bg-yellow-100 text-yellow-700";
      case "customer_completed": return "bg-blue-100 text-blue-700";
      case "pending": return "bg-orange-100 text-orange-700";
      case "approved": return "bg-green-100 text-green-700";
      // Proof statuses
      case "Not_Received": return "bg-red-100 text-red-700";
      case "Received": return "bg-blue-100 text-blue-700";
      case "In_Progress": return "bg-yellow-100 text-yellow-700";
      case "Lettered": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-600";
      case "medium": return "text-yellow-600";
      case "low": return "text-green-600";
      default: return "text-gray-600";
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getProgressData = (order: Order) => {
    const orderStart = new Date(order.depositDate);
    const installationDate = order.installationDate ? new Date(order.installationDate) : new Date(order.dueDate);
    const today = new Date();
    
    const totalDays = Math.ceil((installationDate.getTime() - orderStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysPassed = Math.max(0, Math.ceil((today.getTime() - orderStart.getTime()) / (1000 * 60 * 60 * 24)));
    
    return {
      daysPassed: Math.min(daysPassed, totalDays),
      totalDays,
      percentage: Math.min((daysPassed / totalDays) * 100, 100)
    };
  };

  const daysUntilDue = getDaysUntilDue(currentOrder.dueDate);
  const progressData = getProgressData(currentOrder);

  const stoneStatuses = ["NA", "Ordered", "In Stock"];
  const permitStatuses = ["form_sent", "customer_completed", "pending", "approved"];
  const proofStatuses = ["NA", "Not_Received", "Received", "In_Progress", "Lettered"];

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg z-50 overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Order Details</h2>
            <p className="text-sm text-muted-foreground">{currentOrder.id}</p>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleEditSave}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleEditCancel}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleEditStart}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Priority Alert */}
        {currentOrder.priority === 'high' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700 font-medium">High Priority Order</span>
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
                    <Select value={currentOrder.stoneStatus} onValueChange={(value) => handleFieldChange('stoneStatus', value)}>
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
                    <Badge className={getStatusColor(currentOrder.stoneStatus)}>
                      {currentOrder.stoneStatus}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Permit Status</span>
                  {isEditing ? (
                    <Select value={currentOrder.permitStatus} onValueChange={(value) => handleFieldChange('permitStatus', value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {permitStatuses.map((status) => (
                          <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={getStatusColor(currentOrder.permitStatus)}>
                      {currentOrder.permitStatus.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Proof Status</span>
                  {isEditing ? (
                    <Select value={currentOrder.proofStatus} onValueChange={(value) => handleFieldChange('proofStatus', value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {proofStatuses.map((status) => (
                          <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={getStatusColor(currentOrder.proofStatus)}>
                      {currentOrder.proofStatus.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Timeline Progress</span>
                  <span>({progressData.daysPassed}/{progressData.totalDays} days)</span>
                </div>
                <Progress value={progressData.percentage} className="h-2" />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className={daysUntilDue < 0 ? 'text-red-600' : daysUntilDue < 7 ? 'text-yellow-600' : 'text-muted-foreground'}>
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
                  value={currentOrder.customer} 
                  onChange={(e) => handleFieldChange('customer', e.target.value)}
                  className="h-6 text-sm"
                />
              ) : (
                <span className="font-medium">{currentOrder.customer}</span>
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
                  value={currentOrder.type} 
                  onChange={(e) => handleFieldChange('type', e.target.value)}
                  className="h-6 text-sm"
                />
              ) : (
                <span>{currentOrder.type}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">SKU:</span>
              {isEditing ? (
                <Input 
                  value={currentOrder.sku} 
                  onChange={(e) => handleFieldChange('sku', e.target.value)}
                  className="h-6 text-sm flex-1"
                />
              ) : (
                <span className="font-medium">{currentOrder.sku}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">Material:</span>
              {isEditing ? (
                <Input 
                  value={currentOrder.material} 
                  onChange={(e) => handleFieldChange('material', e.target.value)}
                  className="h-6 text-sm flex-1"
                />
              ) : (
                <span>{currentOrder.material}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">Color:</span>
              {isEditing ? (
                <Input 
                  value={currentOrder.color} 
                  onChange={(e) => handleFieldChange('color', e.target.value)}
                  className="h-6 text-sm flex-1"
                />
              ) : (
                <span>{currentOrder.color}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              {isEditing ? (
                <Input 
                  value={currentOrder.value} 
                  onChange={(e) => handleFieldChange('value', e.target.value)}
                  className="h-6 text-sm"
                />
              ) : (
                <span className="font-medium">{currentOrder.value}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">Timeline:</span>
              {isEditing ? (
                <Input 
                  type="number"
                  value={currentOrder.timelineWeeks} 
                  onChange={(e) => handleFieldChange('timelineWeeks', parseInt(e.target.value))}
                  className="h-6 text-sm w-20"
                />
              ) : (
                <span>{currentOrder.timelineWeeks} weeks</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {isEditing ? (
                <Input 
                  value={currentOrder.location} 
                  onChange={(e) => handleFieldChange('location', e.target.value)}
                  className="h-6 text-sm"
                />
              ) : (
                <span>{currentOrder.location}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {isEditing ? (
                <Input 
                  value={currentOrder.assignedTo} 
                  onChange={(e) => handleFieldChange('assignedTo', e.target.value)}
                  className="h-6 text-sm"
                  placeholder="Assigned to:"
                />
              ) : (
                <span>Assigned to: {currentOrder.assignedTo}</span>
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
                  value={currentOrder.depositDate} 
                  onChange={(e) => handleFieldChange('depositDate', e.target.value)}
                  className="h-6 text-sm w-32"
                />
              ) : (
                <span className="text-sm font-medium">{currentOrder.depositDate}</span>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Second Payment</span>
              {isEditing ? (
                <Input 
                  type="date"
                  value={currentOrder.secondPaymentDate || ''} 
                  onChange={(e) => handleFieldChange('secondPaymentDate', e.target.value || null)}
                  className="h-6 text-sm w-32"
                />
              ) : (
                <span className="text-sm font-medium">
                  {currentOrder.secondPaymentDate || (
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
                  value={currentOrder.dueDate} 
                  onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                  className="h-6 text-sm w-32"
                />
              ) : (
                <span className="text-sm font-medium">{currentOrder.dueDate}</span>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Installation Date</span>
              {isEditing ? (
                <Input 
                  type="date"
                  value={currentOrder.installationDate || ''} 
                  onChange={(e) => handleFieldChange('installationDate', e.target.value || null)}
                  className="h-6 text-sm w-32"
                />
              ) : (
                <span className="text-sm font-medium">
                  {currentOrder.installationDate || (
                    <span className="text-muted-foreground italic">Not scheduled</span>
                  )}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

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
  );
};

export default OrderDetailsSidebar;
