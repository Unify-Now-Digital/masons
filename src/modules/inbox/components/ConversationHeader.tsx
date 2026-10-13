import React, { useState } from 'react';
import { Link2, MoreHorizontal, Plus, User, Columns3, Check, EyeOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { cn } from '@/shared/lib/utils';
import { newJobConfirmCopy, type OpenJobRef } from '@/shared/lib/orderPanel';

/** One entry in the header's ⋯ menu. */
export interface ConversationHeaderAction {
  /** Stable identity: React key, and a handle for e2e selectors. */
  id: string;
  label: string;
  onSelect: () => void;
  /** Native tooltip. Hide/Unmute carries a distinct string per state. */
  title?: string;
  /** Second, quieter line in the menu (e.g. "Linked to … · ORD-000280"). */
  hint?: string | null;
  /** Shows a check mark (display state, e.g. "Show all channels"). */
  checked?: boolean;
  /** Draw a separator above this item. */
  separatorBefore?: boolean;
}

export interface ConversationHeaderProps {
  displayName: string;
  /** Fallback quiet line when no statusLine is given (channel · handle). */
  handleLine: string;
  /** inbox-v11: ONE quiet status beside the name, e.g. "Invoice sent, deposit not paid". */
  statusLine?: string | null;
  subjectLine?: string | null;
  /** Only the unlinked state gets a visible flag (linked is the normal state). */
  linkStateLabel: string;
  linkStateTone?: 'linked' | 'neutral';
  /** Kept for API compatibility; no longer rendered (v11 noise cut). */
  orderDisplayIdsText?: string | null;
  /** Contact-record actions, in display order — all live in the ⋯ menu. */
  actions?: ConversationHeaderAction[];
  /** Kept for API compatibility; the stage now shows in the menu ("Open in Pipeline"). */
  pipelineHintLabel?: string | null;
  /** Multi-job picker (2+ jobs) — still inline, it changes what the panel shows. */
  pipelineHintSlot?: React.ReactNode;
  /** "New job" / "Add to pipeline" / "Adding…" — rendered as a menu item. */
  pipelineActionButtonLabel?: string;
  onPipelineActionClick?: () => void;
  /** When set, the pipeline action asks first (duplicate check). */
  pipelineConfirm?: { title: string; body: string; confirmLabel?: string } | null;
  /** Alternative to pipelineConfirm: the header builds the duplicate-check copy. */
  duplicateCheck?: { firstName: string; openJobs: OpenJobRef[] } | null;
  /** Extra menu items after the pipeline action (Show all channels, Open in Pipeline, Customer details). */
  menuExtras?: ConversationHeaderAction[];
  /** Rendered below the header row (legacy summary banner for views without a next-step bar). */
  summarySlot?: React.ReactNode;
  /** Kept for API compatibility; v11 drops the score badge from the header. */
  scoreBadge?: React.ReactNode;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  link: Link2,
  'link-person': Link2,
  pipeline: Plus,
  channels: Check,
  'open-pipeline': Columns3,
  customer: User,
  mute: EyeOff,
};

/** inbox-v11 conversation header: name + one quiet status + ⋯ menu. */
export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  displayName,
  handleLine,
  statusLine,
  subjectLine = null,
  linkStateLabel,
  linkStateTone = 'neutral',
  actions,
  pipelineHintSlot,
  pipelineActionButtonLabel,
  onPipelineActionClick,
  pipelineConfirm: pipelineConfirmProp,
  duplicateCheck,
  menuExtras,
  summarySlot,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pipelineConfirm: { title: string; body: string; confirmLabel?: string } | null =
    pipelineConfirmProp ?? (duplicateCheck ? newJobConfirmCopy(duplicateCheck.firstName, duplicateCheck.openJobs) : null);

  const pipelineItem: ConversationHeaderAction | null =
    pipelineActionButtonLabel != null && onPipelineActionClick
      ? {
          id: 'pipeline',
          label: pipelineConfirm ? `${pipelineActionButtonLabel}…` : pipelineActionButtonLabel,
          hint: pipelineConfirm ? 'Asks you to confirm first' : null,
          onSelect: () => (pipelineConfirm ? setConfirmOpen(true) : onPipelineActionClick()),
        }
      : null;

  const items: ConversationHeaderAction[] = [
    ...(actions ?? []),
    ...(pipelineItem ? [pipelineItem] : []),
    ...(menuExtras ?? []),
  ];

  const showUnlinkedFlag = linkStateTone !== 'linked' && linkStateLabel.trim() !== '';
  const quiet = statusLine ?? handleLine;

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gardens-bdr shrink-0 px-4 py-2.5 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0 flex-1 flex items-baseline gap-2.5">
          <h2 className="font-head text-[20px] font-semibold text-gardens-tx truncate m-0" data-testid="conversation-title">
            {displayName}
          </h2>
          {showUnlinkedFlag && (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border bg-gardens-page border-gardens-bdr text-gardens-tx">
              {linkStateLabel}
            </span>
          )}
          {quiet && <span className="text-[13px] text-gardens-txs truncate min-w-0" data-testid="conversation-status">· {quiet}</span>}
        </div>
        {pipelineHintSlot}
        {items.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Conversation actions"
              className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gardens-bdr bg-white text-gardens-tx hover:bg-gardens-page focus:outline-none focus:ring-2 focus:ring-gardens-acc/30"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {items.map((item) => {
                const Icon = ICONS[item.id];
                return (
                  <React.Fragment key={item.id}>
                    {item.separatorBefore && <DropdownMenuSeparator />}
                    <DropdownMenuItem title={item.title} onSelect={item.onSelect} className="items-start gap-2" data-testid={`header-action-${item.id}`}>
                      {Icon && item.id !== 'channels' ? <Icon className="h-4 w-4 mt-0.5 shrink-0 text-gardens-txs" /> : <span className="w-4" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] text-gardens-tx">{item.label}</span>
                        {item.hint && <span className="block text-[11px] text-gardens-txm-aa truncate">{item.hint}</span>}
                      </span>
                      {item.checked && <Check className="h-4 w-4 mt-0.5 shrink-0 text-gardens-tx" aria-label="On" />}
                    </DropdownMenuItem>
                  </React.Fragment>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {subjectLine && <p className={cn('text-[12px] text-gardens-tx truncate mt-0.5')}>{subjectLine}</p>}
      {summarySlot != null && summarySlot !== false && <div className="min-w-0 w-full mt-2">{summarySlot}</div>}

      {pipelineConfirm && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-head">{pipelineConfirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{pipelineConfirm.body}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                data-testid="confirm-new-job"
                onClick={() => {
                  setConfirmOpen(false);
                  onPipelineActionClick?.();
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                {pipelineConfirm.confirmLabel ?? 'Start new job'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};
