import React from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Mail, Phone, MessageCircle, ExternalLink } from 'lucide-react';

interface CommunicationIntegrationsProps {
  customerEmail?: string;
  customerPhone?: string;
}

export const CommunicationIntegrations: React.FC<CommunicationIntegrationsProps> = ({ 
  customerEmail, 
  customerPhone 
}) => {
  const handleEmailClick = () => {
    if (customerEmail) {
      window.open(`mailto:${customerEmail}`, '_blank');
    }
  };

  const handlePhoneClick = () => {
    if (customerPhone) {
      window.open(`tel:${customerPhone}`, '_blank');
    }
  };

  const handleWhatsAppClick = () => {
    if (customerPhone) {
      const phoneNumber = customerPhone.replace(/\D/g, '');
      window.open(`https://wa.me/${phoneNumber}`, '_blank');
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Communication Channels
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleEmailClick}
            disabled={!customerEmail}
            className="flex items-center gap-2"
          >
            <Mail className="h-3 w-3" />
            Email
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePhoneClick}
            disabled={!customerPhone}
            className="flex items-center gap-2"
          >
            <Phone className="h-3 w-3" />
            Call
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleWhatsAppClick}
            disabled={!customerPhone}
            className="flex items-center gap-2 text-gardens-grn-dk border-gardens-grn-lt hover:bg-gardens-grn-lt"
          >
            <MessageCircle className="h-3 w-3" />
            WhatsApp
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
        <div className="mt-2 text-xs text-gardens-txs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Connected</Badge>
            <span>Direct integrations enabled</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CommunicationIntegrations;

