import React, { useCallback } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileCheck, Gem, GripVertical, Image as ImageIcon, MoreHorizontal, PenLine, Trash2, Truck, type LucideIcon } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { needsUs, type NextAction } from '@/shared/lib/nextAction';
import { useOpenOrder, type OrderPanelSection } from '@/shared/context/orderPanel';
import type { ColumnState } from '@/shared/tableViewPresets/types/tableViewPresets.types';
import type { UIOrder } from '../utils/orderTransform';
import { getOrderDisplayId } from '../utils/orderDisplayId';
import { formatOrderTypeLabel } from '../utils/orderTypeDisplay';
import { orderNextAction } from '../utils/orderNextAction';
import { computeTimelineProgress, weekCounterText } from '../utils/timelineProgress';
import {
  formatStepAge, groupBulkLabel, groupOrders, nextStepAgeDays, type OrdersGroupBy,
} from '../utils/orderGroups';
import { orderColumnDefinitions, type OrderColumnDefinition } from './orderColumnDefinitions';
import { colTrack, columnsForWidth } from './ordersBoardColumns';
import { StagePill } from './StagePill';
import { OrderProgressBars } from './OrderProgressBars';
import { OrdersSupplierCell } from '@/modules/supplier/components/SupplierStatusLabel';

const HEADER_ICON: Partial<Record<string, LucideIcon>> = {
  permit: FileCheck,
  stoneStatus: Gem,
  supplier: Truck,
  proof: PenLine,
};

const STRONG_HEADER = new Set(['nextStep', 'permit', 'stoneStatus']);

function useOrdersLayout() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [viewportCards, setViewportCards] = React.useState(false);
  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const apply = () => setViewportCards(media.matches);
    apply();
    media.addEventListener('change', apply);
    const node = ref.current;
    const observer = node
      ? new ResizeObserver((entries) => setWidth(Math.round(entries[0]?.contentRect.width ?? 0)))
      : null;
    if (node && observer) observer.observe(node);
    return () => {
      media.removeEventListener('change', apply);
      observer?.disconnect();
    };
  }, []);
  // Cards only when the board itself is too narrow for a wrapped table.
  // 1280px with the order panel leaves about 780px, which still fits the table.
  return { ref, width, cards: viewportCards || (width > 0 && width < 640) };
}

function NextStepLabel({ text, action }: { text: string; action: NextAction }) {
  return (
    <span className={cn('inline-flex max-w-full rounded-full px-2.5 py-1 text-[12px] font-bold leading-4', nextToneClass(action))} title={text}>
      <span className="line-clamp-2 whitespace-normal break-words">{text}</span>
    </span>
  );
}

function nextToneClass(action: NextAction): string {
  if (action.kind === 'waiting') return 'bg-gardens-na-blue-lt text-gardens-na-blue';
  if (action.kind === 'none') return 'bg-gardens-page text-gardens-txs';
  if (action.tone === 'red') return 'bg-gardens-na-red-lt text-gardens-na-red';
  return 'bg-gardens-na-amber-lt text-gardens-na-amber';
}

function nextPillText(order: UIOrder, action: NextAction, now: Date): string {
  if (action.kind === 'waiting') return `Waiting · ${action.waitingOn ?? 'others'}`;
  if (action.kind === 'none' || !action.label) return 'On track';
  const age = formatStepAge(nextStepAgeDays(order, now));
  return age ? `${action.label} · ${age}` : action.label;
}

function specLine(material?: string | null, dimensions?: string | null): string {
  const m = material?.trim();
  const d = dimensions?.trim();
  if (m && d) return `${m} · ${d}`;
  return m || d || '';
}

const Grip: React.FC<React.HTMLAttributes<HTMLSpanElement>> = (props) => (
  <span {...props} className={cn('inline-flex opacity-0 group-hover:opacity-100 cursor-grab text-gardens-txm', props.className)}>
    <GripVertical className="h-3 w-3" aria-hidden />
  </span>
);

const HeaderCell: React.FC<{
  column: OrderColumnDefinition;
  sortDirection: 'asc' | 'desc' | null;
  onSort: () => void;
}> = ({ column, sortDirection, onSort }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const Icon = HEADER_ICON[column.id];
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`orders-col-${column.id}`}
      className={cn(
        'min-w-0 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide',
        STRONG_HEADER.has(column.id) ? 'text-gardens-tx' : 'text-gardens-txs',
      )}
    >
      <Grip {...attributes} {...listeners} />
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <button
        type="button"
        className={cn('truncate text-left', column.sortable && 'cursor-pointer')}
        onClick={column.sortable ? onSort : undefined}
      >
        {column.label}
        {sortDirection ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </div>
  );
};

export const OrdersBoard: React.FC<{
  orders: UIOrder[];
  columnState: ColumnState;
  onColumnStateChange?: (state: ColumnState) => void;
  groupBy?: OrdersGroupBy;
  now?: Date;
  onViewOrder?: (order: UIOrder) => void;
  onEditOrder?: (order: UIOrder) => void;
  onDeleteOrder?: (order: UIOrder) => void;
  onSort?: (columnId: string) => void;
  sortDirection?: (columnId: string) => 'asc' | 'desc' | null;
  productById?: Map<string, { name: string; imageUrl: string | null }>;
}> = ({
  orders,
  columnState,
  onColumnStateChange,
  groupBy = 'priority',
  now = new Date(),
  onViewOrder,
  onEditOrder,
  onDeleteOrder,
  onSort,
  sortDirection,
  productById,
}) => {
  const openOrder = useOpenOrder();
  const layout = useOrdersLayout();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const visible = React.useMemo(() => {
    return orderColumnDefinitions
      .filter((col) => columnState.visibility[col.id] !== false)
      .sort((a, b) => {
        const ai = columnState.order.indexOf(a.id);
        const bi = columnState.order.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
  }, [columnState]);

  const shown = columnsForWidth(visible, layout.width);
  const template = `3px ${shown.map((c) => colTrack(c.id)).join(' ')} 24px`;
  const { active, archived } = React.useMemo(() => {
    const live: UIOrder[] = [];
    const old: UIOrder[] = [];
    for (const order of orders) (order.archivedAt ? old : live).push(order);
    return { active: live, archived: old };
  }, [orders]);
  const groups = [
    ...(groupBy === 'none'
      ? (active.length ? [{ key: 'Active', orders: active }] : [])
      : groupOrders(active, groupBy, now)),
    ...(archived.length ? [{ key: 'Archived', orders: archived }] : []),
  ];

  const onDragEnd = useCallback((event: DragEndEvent) => {
    if (!onColumnStateChange || !event.over) return;
    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    if (activeId === overId) return;
    const ids = visible.map((c) => c.id);
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const nextVisible = [...ids];
    const [moved] = nextVisible.splice(from, 1);
    nextVisible.splice(to, 0, moved);
    const hidden = columnState.order.filter((id) => !ids.includes(id));
    onColumnStateChange({ ...columnState, order: [...nextVisible, ...hidden] });
  }, [columnState, onColumnStateChange, visible]);

  const openSection = (order: UIOrder, section: OrderPanelSection) => {
    openOrder(order.id, { section });
  };

  const cardList = (
    <ul className="flex flex-col gap-2" data-testid="orders-cards">
      {groups.map((group) => (
        <li key={group.key} className="flex flex-col gap-2">
          {(groupBy !== 'none' || group.key === 'Archived') && (
            <div className="flex items-center gap-2 px-1" data-testid={`orders-group-${group.key}`}>
              <span className="text-[11px] font-bold uppercase tracking-wide text-gardens-txs">{group.key}</span>
              <span className="text-[12px] tabular-nums text-gardens-txm-aa">{group.orders.length}</span>
            </div>
          )}
          {group.orders.map((order) => {
            const action = orderNextAction(order, now);
            const deceased = order.deceasedName?.trim();
            return (
              <div
                key={order.id}
                className={cn(
                  'rounded-lg border border-gardens-bdr',
                  order.archivedAt ? 'bg-gardens-page text-gardens-txs opacity-60' : 'bg-gardens-surf',
                )}
              >
                <button
                  type="button"
                  onClick={() => onViewOrder?.(order)}
                  className="flex min-h-11 w-full flex-col gap-1.5 px-3 py-2.5 text-left"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="font-head text-[14px] font-semibold truncate">{order.customer}</span>
                    {order.archivedAt && <ArchivedTag />}
                  </span>
                  <span className="text-[12px] tabular-nums text-gardens-txs">{getOrderDisplayId(order)}</span>
                  <span className={cn('text-[12.5px] truncate', deceased ? 'text-gardens-txs' : 'italic text-gardens-txm')}>
                    {deceased ? `In memory of ${deceased}` : 'Deceased not recorded'}
                  </span>
                  <NextStepLabel text={nextPillText(order, action, now)} action={action} />
                  <OrdersSupplierCell rollup={order.supplier} loaded={order.supplierLoaded} compact />
                </button>
                <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
                  <StagePill stage="permit" order={order} now={now} onOpen={() => openSection(order, 'permit')} />
                  <StagePill stage="proof" order={order} now={now} onOpen={() => openSection(order, 'proof')} />
                  <StagePill stage="stone" order={order} now={now} onOpen={() => openSection(order, 'stone')} />
                </div>
              </div>
            );
          })}
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={layout.ref} className="min-w-0 w-full">
    {layout.cards ? cardList : (
    <div className="min-w-0 overflow-x-clip rounded-lg border border-gardens-bdr bg-gardens-surf flex flex-col" data-testid="orders-board">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={shown.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
          <div
            className="group grid items-center h-9 pr-3 border-b border-gardens-bdr bg-gardens-surf2 gap-x-4"
            style={{ gridTemplateColumns: template }}
          >
            <span />
            {shown.map((column) => (
              <HeaderCell
                key={column.id}
                column={column}
                sortDirection={sortDirection?.(column.id) ?? null}
                onSort={() => onSort?.(column.id)}
              />
            ))}
            <span />
          </div>
        </SortableContext>
      </DndContext>
      <div>
        {groups.map((group) => {
          const bulk = groupBy === 'none' ? null : groupBulkLabel(groupBy, group.key, group.orders, now);
          return (
            <div key={group.key}>
              {(groupBy !== 'none' || group.key === 'Archived') && (
                <div
                  className="flex items-center gap-2.5 h-9 px-3 bg-gardens-page border-b border-gardens-bdr"
                  data-testid={`orders-group-${group.key}`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wide text-gardens-txs">{group.key}</span>
                  <span className="text-[12px] text-gardens-txm-aa tabular-nums">{group.orders.length}</span>
                  {bulk && (
                    <button
                      type="button"
                      data-testid={`orders-bulk-${group.key}`}
                      className="ml-auto h-6 rounded-full border border-gardens-na-amber px-2.5 text-[12px] font-bold text-gardens-na-amber"
                      onClick={() => {
                        const first = group.orders[0];
                        if (first) openOrder(first.id);
                      }}
                    >
                      {bulk}
                    </button>
                  )}
                </div>
              )}
              {group.orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  now={now}
                  visible={shown}
                  template={template}
                  productById={productById}
                  onView={() => onViewOrder?.(order)}
                  onEdit={onEditOrder ? () => onEditOrder(order) : undefined}
                  onDelete={onDeleteOrder ? () => onDeleteOrder(order) : undefined}
                  onSection={(section) => openSection(order, section)}
                />
              ))}
            </div>
          );
        })}
      </div>
      <Legend />
    </div>
    )}
    </div>
  );
};

const OrderRow: React.FC<{
  order: UIOrder;
  now: Date;
  visible: OrderColumnDefinition[];
  template: string;
  productById?: Map<string, { name: string; imageUrl: string | null }>;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSection: (section: OrderPanelSection) => void;
}> = ({ order, now, visible, template, productById, onView, onEdit, onDelete, onSection }) => {
  const action = orderNextAction(order, now);
  const overdue = action.tone === 'red' && needsUs(action);
  const timeline = computeTimelineProgress(
    { depositDate: order.depositDate, timelineWeeks: order.timelineWeeks, installationDate: order.installationDate },
    now,
  );
  const wk = weekCounterText(timeline).text;
  const wkTitle = wk === '—' ? '' : wk;
  const deceased = order.deceasedName?.trim();
  const catalog = order.productId ? productById?.get(order.productId) : undefined;
  const productName = order.productName || catalog?.name || formatOrderTypeLabel(order.type);
  const photo = order.productPhotoUrl || catalog?.imageUrl || null;
  const spec = specLine(order.material, order.dimensions);

  return (
    <div
      data-testid="orders-row"
      data-archived={order.archivedAt ? 'true' : 'false'}
      title={`${getOrderDisplayId(order)}${wkTitle ? ` · ${wkTitle}` : ''}`}
      onClick={onView}
      className={cn(
        'grid items-start min-h-[64px] pr-3 border-b border-gardens-bdr/70 gap-x-4 cursor-pointer',
        order.archivedAt ? 'bg-gardens-page text-gardens-txs opacity-60' : 'hover:bg-gardens-page',
      )}
      style={{ gridTemplateColumns: template }}
    >
      <span className={cn('self-stretch', overdue ? 'bg-gardens-na-red' : 'bg-transparent')} />
      {visible.map((column) => (
        <div key={column.id} className="min-w-0 overflow-hidden py-2">
          {column.id === 'customer' && (
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="font-head text-[14px] font-semibold leading-5 line-clamp-2 whitespace-normal break-words" title={order.customer}>{order.customer}</span>
                {order.archivedAt && <ArchivedTag />}
              </span>
              <span
                className={cn('text-[12.5px] leading-4 line-clamp-2 whitespace-normal break-words', deceased ? 'text-gardens-txs' : 'italic text-[#8A8378]')}
                title={deceased || 'Deceased not recorded'}
              >
                {deceased || 'Deceased not recorded'}
              </span>
            </div>
          )}
          {column.id === 'nextStep' && (
            <div className="flex flex-col gap-0.5 items-start min-w-0">
              <NextStepLabel text={nextPillText(order, action, now)} action={action} />
              {action.reason && (
                <span className="max-w-full text-[11.5px] leading-4 text-gardens-txs line-clamp-2 whitespace-normal break-words" title={action.reason}>{action.reason}</span>
              )}
            </div>
          )}
          {column.id === 'product' && (
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="hidden min-[1440px]:flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gardens-page border border-gardens-bdr text-gardens-txm overflow-hidden">
                {photo
                  ? <img src={photo} alt="" className="h-full w-full object-contain" />
                  : <ImageIcon className="h-4 w-4" aria-hidden />}
              </span>
              <span className="min-w-0 flex flex-col gap-0.5">
                <span
                  className="text-[13px] font-semibold leading-5 text-gardens-acc-dk hover:underline line-clamp-2 whitespace-normal break-words"
                  title={productName}
                  onClick={(e) => e.stopPropagation()}
                >
                  {productName}
                </span>
                {spec && <span className="text-[12px] leading-4 text-gardens-txs tabular-nums line-clamp-2 whitespace-normal break-words" title={spec}>{spec}</span>}
              </span>
            </div>
          )}
          {column.id === 'permit' && <StagePill stage="permit" order={order} now={now} onOpen={() => onSection('permit')} />}
          {column.id === 'stoneStatus' && <StagePill stage="stone" order={order} now={now} onOpen={() => onSection('stone')} />}
          {column.id === 'supplier' && <OrdersSupplierCell rollup={order.supplier} loaded={order.supplierLoaded} />}
          {column.id === 'proof' && <StagePill stage="proof" order={order} now={now} onOpen={() => onSection('proof')} />}
          {column.id === 'progress' && <OrderProgressBars order={order} now={now} />}
          {!['customer', 'nextStep', 'product', 'permit', 'stoneStatus', 'supplier', 'proof', 'progress'].includes(column.id) && (
            <span className="text-[13px] text-gardens-tx truncate block">{extraText(order, column.id)}</span>
          )}
        </div>
      ))}
      <span onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gardens-txm" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <DropdownMenuItem disabled={order.invoiceLocked} onSelect={onEdit}>
                Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem onSelect={onDelete} className="text-gardens-red-dk focus:text-gardens-red-dk">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete order
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
};

function ArchivedTag() {
  return (
    <span className="shrink-0 inline-flex h-5 items-center rounded border border-gardens-bdr bg-gardens-surf px-1.5 text-[11px] font-semibold text-gardens-txs">
      Archived
    </span>
  );
}

function extraText(order: UIOrder, id: string): string {
  switch (id) {
    case 'id': return getOrderDisplayId(order);
    case 'deceasedName': return order.deceasedName || '—';
    case 'customerType': return order.group;
    case 'type': return formatOrderTypeLabel(order.type);
    case 'value': return order.value;
    case 'material': return order.material || '—';
    case 'color': return order.color || '—';
    case 'dueDate': return order.dueDate || '—';
    case 'messages': return '';
    default: return '';
  }
}

function Legend() {
  const item = (swatch: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-full', swatch)} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gardens-bdr bg-gardens-surf2 px-4 py-2 text-[11.5px] text-gardens-txs">
      {item('bg-gardens-na-green', 'Done / pre-approved')}
      {item('bg-gardens-na-amber', 'Needs us')}
      {item('bg-gardens-na-blue', 'Waiting on others')}
      {item('bg-gardens-na-red', 'Overdue')}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-4 items-center rounded bg-gardens-tx px-1 font-head text-[11px] font-semibold text-white">Aa</span>
        Inscription recorded
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-4 items-center rounded border border-dashed border-gardens-na-red px-1 font-head text-[11px] font-semibold text-gardens-na-red">Aa</span>
        No inscription yet
      </span>
    </div>
  );
}
