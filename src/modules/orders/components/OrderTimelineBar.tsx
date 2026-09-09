import { Progress } from '@/shared/components/ui/progress';
import type { OrderTimeline } from '../utils/orderTimeline';

const colourClasses: Record<OrderTimeline['colour'], string> = {
  green: '[&>div]:bg-gardens-grn',
  amber: '[&>div]:bg-gardens-amb',
  red: '[&>div]:bg-gardens-red',
};

const textClasses: Record<OrderTimeline['colour'], string> = {
  green: 'text-gardens-grn-dk',
  amber: 'text-gardens-amb-dk',
  red: 'text-gardens-red-dk',
};

export function OrderTimelineBar({ timeline, compact = false }: { timeline: OrderTimeline; compact?: boolean }) {
  return (
    <div className={compact ? 'min-w-0 space-y-1' : 'space-y-2'}>
      <div className={`flex items-center justify-between gap-2 font-medium ${compact ? 'text-[10px]' : 'text-sm'} ${textClasses[timeline.colour]}`}>
        <span>{timeline.label}</span>
        {!compact && <span>{Math.round(timeline.percentage)}%</span>}
      </div>
      <Progress
        value={timeline.percentage}
        aria-label={timeline.label}
        className={`${compact ? 'h-1.5' : 'h-2'} ${colourClasses[timeline.colour]}`}
      />
      {timeline.isLegacyFallback && (
        <div className={`${compact ? 'text-[9px]' : 'text-xs'} text-muted-foreground`}>legacy deposit date</div>
      )}
    </div>
  );
}
