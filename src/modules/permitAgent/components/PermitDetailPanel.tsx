import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import {
  ExternalLink, Send, FilePen, Search, Bot, CheckCircle2,
  MapPin, Calendar, Package, X, Mail, UserCheck, Reply,
} from 'lucide-react';
import type { PermitPipelineItem } from '../types/permitAgent.types';
import { PHASE_LABELS, PHASE_COLORS, PHASE_ORDER } from '../types/permitAgent.types';
import { ActivityTracker } from './ActivityTracker';
import { formatDateDMY } from '@/shared/lib/formatters';

interface PermitDetailPanelProps {
  item: PermitPipelineItem;
  onClose: () => void;
  onSearchForm: () => void;
  onPrefill: () => void;
  onSubmit: () => void;
  onSendToClient: () => void;
  onClientReturned: () => void;
  onFollowUp: () => void;
  onAdvancePhase: (phase: string) => void;
}

export const PermitDetailPanel: React.FC<PermitDetailPanelProps> = ({
  item,
  onClose,
  onSearchForm,
  onPrefill,
  onSubmit,
  onSendToClient,
  onClientReturned,
  onFollowUp,
  onAdvancePhase,
}) => {
  const { permit, order, activities, daysUntilInstall, isUrgent } = item;
  const currentPhaseIndex = PHASE_ORDER.indexOf(permit.permit_phase);

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{order.customer_name}</h3>
          <p className="text-sm text-slate-500">
            Order #{order.order_number || '—'} &middot; {order.order_type}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Phase progress */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Permit Progress</span>
            <Badge className={PHASE_COLORS[permit.permit_phase]}>
              {PHASE_LABELS[permit.permit_phase]}
            </Badge>
          </div>
          <Progress value={permit.readiness_score} className="h-2 mb-2" />
          <div className="flex justify-between text-xs text-slate-400">
            <span>Required</span>
            <span>{permit.readiness_score}% complete</span>
            <span>Approved</span>
          </div>

          {/* Phase steps */}
          <div className="flex items-center gap-1 mt-3 overflow-x-auto">
            {PHASE_ORDER.map((phase, i) => {
              const done = i <= currentPhaseIndex;
              const isCurrent = i === currentPhaseIndex;
              return (
                <div
                  key={phase}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap ${
                    isCurrent
                      ? PHASE_COLORS[phase]
                      : done
                      ? 'bg-green-50 text-green-600'
                      : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  {done && !isCurrent && <CheckCircle2 className="h-3 w-3" />}
                  <span className="hidden sm:inline">{PHASE_LABELS[phase]}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Order info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span>{order.location || 'No location set'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>
              {order.installation_date
                ? formatDateDMY(order.installation_date)
                : 'No install date'}
              {daysUntilInstall !== null && (
                <span className={`ml-2 ${isUrgent ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                  ({daysUntilInstall <= 0 ? 'Overdue' : `${daysUntilInstall} days away`})
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-slate-400" />
            <span>{order.material || 'Material TBD'}</span>
          </div>
          {permit.authority_name && (
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-slate-400" />
              <span>{permit.authority_name}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onSearchForm}
            disabled={permit.permit_phase !== 'REQUIRED' && permit.permit_phase !== 'SEARCHING'}
          >
            <Search className="h-4 w-4 mr-2" />
            AI Search for Form
          </Button>

          {permit.form_url && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => window.open(permit.form_url!, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Form
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onPrefill}
            disabled={!permit.form_url || permit.permit_phase === 'APPROVED'}
          >
            <FilePen className="h-4 w-4 mr-2" />
            Auto Pre-fill Form
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onSendToClient}
            disabled={!permit.prefilled_data || permit.permit_phase === 'APPROVED' || permit.permit_phase === 'SUBMITTED'}
          >
            <Mail className="h-4 w-4 mr-2" />
            Send to Client for Signature
          </Button>

          {permit.permit_phase === 'SENT_TO_CLIENT' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-teal-700 hover:text-teal-800 hover:bg-teal-50"
              onClick={onClientReturned}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Client Returned Signed Form
            </Button>
          )}

          <Button
            size="sm"
            className="w-full justify-start"
            onClick={onSubmit}
            disabled={!permit.authority_contact || permit.permit_phase === 'APPROVED'}
          >
            <Send className="h-4 w-4 mr-2" />
            Submit to Authority
          </Button>

          {(permit.permit_phase === 'SENT_TO_CLIENT' || permit.permit_phase === 'SUBMITTED') && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={onFollowUp}
            >
              <Reply className="h-4 w-4 mr-2" />
              Send Follow-up
            </Button>
          )}

          {permit.permit_phase !== 'APPROVED' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-green-700 hover:text-green-800 hover:bg-green-50"
              onClick={() => onAdvancePhase('APPROVED')}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark as Approved
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <ActivityTracker activities={activities} />
    </div>
  );
};
