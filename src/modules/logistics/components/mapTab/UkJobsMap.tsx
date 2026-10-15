import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { ScheduleStop } from '../../utils/scheduleTypes';
import { isKerb } from '../../utils/jobTypeClassifier';
import { pinColour, permitPinInnerSvg, permitPinStyle, type OrderPin } from '../../utils/permitPins';
import { Button } from '@/shared/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet';
import { PermitStatusMark } from './PermitStatusMark';

const API_KEY = 'AIzaSyAO0Wh9bqRA4WaYkmm0NqGAFgJnZ6MX9SU';
const UK_CENTER = { lat: 51.5074, lng: -0.1278 };
const UK_ZOOM = 10;

interface UkJobsMapProps {
  stops: ScheduleStop[];
  draftDates: Map<string, string | null>;
  pinnedOrderIds: Set<string>;
  highlightedOrderId: string | null;
  /** List click: pan the map to this order. */
  focusedOrderId?: string | null;
  focusNonce?: number;
  onMarkerClick?: (orderId: string) => void;
  /** Confirmed-order pins at the cemetery, coloured by permit status. */
  orderPins?: OrderPin[];
  onOpenOrder?: (orderId: string) => void;
  onReady?: () => void;
}

function buildOrderPinSvg(pin: OrderPin, highlighted: boolean, scheduled: boolean): string {
  const st = permitPinStyle(pin.permitStatus);
  const colour = pinColour(st);
  const ring = highlighted ? '#1A202C' : 'rgba(0,0,0,0.35)';
  const rw = highlighted ? 3 : 1.5;
  const inner = permitPinInnerSvg(st, colour);
  const sched = scheduled ? `<circle cx="24" cy="5" r="3.6" fill="#2F855A" stroke="#fff" stroke-width="1.2"/>` : '';
  return `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 1.5C7.1 1.5 1.5 7 1.5 13.6 1.5 22.8 14 34 14 34s12.5-11.2 12.5-20.4C26.5 7 20.9 1.5 14 1.5z" fill="${colour}" stroke="${ring}" stroke-width="${rw}"/>${inner}${sched}</svg>`;
}

function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
}

type MapSheetState =
  | { kind: 'pin'; pin: OrderPin; date: string | null }
  | { kind: 'stop'; stop: ScheduleStop; date: string | null; pinned: boolean };

function orderPinInfoHtml(pin: OrderPin, scheduledDate: string | null): string {
  const st = permitPinStyle(pin.permitStatus);
  const approx = pin.source === 'geocode' ? '<div style="color:#718096;font-size:12px">Approximate: located from the cemetery address</div>' : '';
  const sched = scheduledDate ? `<div>Install: <strong>${escapeHtml(scheduledDate)}</strong></div>` : '';
  return `
    <div style="font-size:12px;min-width:210px;line-height:1.45;">
      <div style="font-size:14px;font-weight:700;">${escapeHtml(pin.customerName)}</div>
      <div style="color:#4A5568">${escapeHtml(pin.ref)}</div>
      <div style="margin-top:4px">${escapeHtml(pin.cemeteryName)}</div>
      <div style="margin-top:4px;display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${pinColour(st)};${st.hollow ? 'box-shadow:inset 0 0 0 3px #fff;border:1px solid ' + pinColour(st) : ''}"></span>
        Permit: <strong>${escapeHtml(st.label)}</strong>
      </div>
      ${sched}${approx}
      <button type="button" data-open-order="${escapeHtml(pin.orderId)}" style="margin-top:8px;padding:4px 10px;border:1px solid #CBD5E0;border-radius:6px;background:#fff;font-weight:600;cursor:pointer">Open order</button>
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildIconSvg(
  kerb: boolean,
  scheduled: boolean,
  highlighted: boolean,
  highPriority: boolean,
  pinned: boolean
): string {
  const fill = scheduled ? '#2F855A' : '#D69E2E';
  const ring = highlighted ? '#1A202C' : highPriority ? '#C53030' : 'rgba(0,0,0,0.25)';
  const ringWidth = highlighted ? 3 : highPriority ? 2.25 : 1.5;
  const shape = kerb
    ? `<rect x="5" y="5" width="22" height="22" rx="3" fill="${fill}" stroke="${ring}" stroke-width="${ringWidth}"/>`
    : `<path d="M16 2C8.82 2 3 7.82 3 15c0 10.11 13 19 13 19s13-8.89 13-19C29 7.82 23.18 2 16 2z" fill="${fill}" stroke="${ring}" stroke-width="${ringWidth}"/>
       <circle cx="16" cy="15" r="5" fill="white"/>`;
  const pinDot = pinned
    ? `<circle cx="27" cy="5" r="3.2" fill="#1A202C" stroke="#fff" stroke-width="1.2"/>`
    : '';
  return `<svg width="32" height="38" viewBox="0 0 32 38" xmlns="http://www.w3.org/2000/svg">${shape}${pinDot}</svg>`;
}

export const UkJobsMap: React.FC<UkJobsMapProps> = ({
  stops,
  draftDates,
  pinnedOrderIds,
  highlightedOrderId,
  focusedOrderId = null,
  focusNonce = 0,
  onMarkerClick,
  orderPins = [],
  onOpenOrder,
  onReady,
}) => {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersByOrderIdRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const stopByOrderIdRef = useRef<Map<string, ScheduleStop>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const prevHighlightedOrderIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [sheet, setSheet] = useState<MapSheetState | null>(null);
  const draftDatesRef = useRef(draftDates);
  draftDatesRef.current = draftDates;
  const pinnedRef = useRef(pinnedOrderIds);
  pinnedRef.current = pinnedOrderIds;
  const orderMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const onOpenOrderRef = useRef(onOpenOrder);
  onOpenOrderRef.current = onOpenOrder;
  const fittedRef = useRef<string>('');
  const pinnedIds = new Set(orderPins.filter((p) => p.lat != null && p.lng != null).map((p) => p.orderId));
  const pinnedKey = [...pinnedIds].sort().join(',');

  const createMarkerIcon = (
    stop: ScheduleStop,
    date: string | null,
    highlighted: boolean
  ): google.maps.Icon => {
    const scheduled = !!date;
    const highPriority = stop.priority === 'high';
    const pinned = pinnedOrderIds.has(stop.orderId);
    const svg = buildIconSvg(isKerb(stop), scheduled, highlighted, highPriority, pinned);
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(32, 38),
      anchor: new google.maps.Point(16, 36),
    };
  };

  const createInfoWindowContent = (stop: ScheduleStop, date: string | null): string => {
    const priorityLine = stop.priority === 'high'
      ? '<div style="color:#C53030;font-weight:600">High priority</div>'
      : '';
    const pinnedLine = pinnedOrderIds.has(stop.orderId)
      ? '<div style="color:#1A202C;font-weight:600">Pinned</div>'
      : '';
    const scheduleLine = date
      ? `Scheduled: <strong>${escapeHtml(date)}</strong>`
      : 'Unscheduled';

    return `
      <div style="font-size:12px;min-width:200px;line-height:1.4;">
        <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${escapeHtml(stop.customerName)}</div>
        <div>${escapeHtml(stop.location)}</div>
        <div>${escapeHtml(stop.orderType)}</div>
        ${priorityLine}
        <div style="margin-top:4px;">${scheduleLine}</div>
        ${pinnedLine}
      </div>
    `;
  };

  useEffect(() => {
    const loader = new Loader({
      apiKey: API_KEY,
      version: 'weekly',
      libraries: ['places'],
    });

    loader.load().then(() => {
      if (!mapRef.current || mapInstanceRef.current) return;
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: UK_CENTER,
        zoom: UK_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      infoWindowRef.current = new google.maps.InfoWindow();
      setIsLoaded(true);
      onReadyRef.current?.();
    });
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const map = mapInstanceRef.current;
    const visibleStops = stops.filter((s) => !pinnedIds.has(s.orderId));
    const nextStopIds = new Set(visibleStops.map((s) => s.orderId));
    stopByOrderIdRef.current = new Map(stops.map((s) => [s.orderId, s]));

    for (const [orderId, marker] of markersByOrderIdRef.current.entries()) {
      if (!nextStopIds.has(orderId)) {
        marker.setMap(null);
        markersByOrderIdRef.current.delete(orderId);
        infoWindowRef.current?.close();
      }
    }

    for (const stop of visibleStops) {
      const date = draftDates.get(stop.orderId) ?? null;
      const marker = markersByOrderIdRef.current.get(stop.orderId);
      const icon = createMarkerIcon(stop, date, stop.orderId === highlightedOrderId);

      if (!marker) {
        const newMarker = new google.maps.Marker({
          map,
          position: { lat: stop.latitude, lng: stop.longitude },
          title: `${stop.customerName} - ${stop.location}`,
          icon,
        });

        newMarker.addListener('click', () => {
          onMarkerClick?.(stop.orderId);
          const latestStop = stopByOrderIdRef.current.get(stop.orderId) ?? stop;
          const latestDate = draftDatesRef.current.get(stop.orderId) ?? null;
          if (isNarrowViewport()) {
            infoWindowRef.current?.close();
            setSheet({
              kind: 'stop',
              stop: latestStop,
              date: latestDate,
              pinned: pinnedRef.current.has(stop.orderId),
            });
            return;
          }
          if (!infoWindowRef.current) return;
          infoWindowRef.current.setContent(createInfoWindowContent(latestStop, latestDate));
          infoWindowRef.current.open(map, newMarker);
        });

        markersByOrderIdRef.current.set(stop.orderId, newMarker);
      } else {
        marker.setPosition({ lat: stop.latitude, lng: stop.longitude });
        marker.setTitle(`${stop.customerName} - ${stop.location}`);
        marker.setIcon(icon);
      }
    }

    const points = [
      ...visibleStops.map((st) => ({ lat: st.latitude, lng: st.longitude })),
      ...orderPins.filter((p) => p.lat != null && p.lng != null).map((p) => ({ lat: p.lat!, lng: p.lng! })),
    ];
    const fitKey = `${[...nextStopIds].sort().join(',')}|${pinnedKey}`;
    if (fitKey !== fittedRef.current) {
      fittedRef.current = fitKey;
      if (points.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        for (const pt of points) bounds.extend(pt);
        map.fitBounds(bounds);
        if (points.length === 1) map.setZoom(12);
      } else {
        map.setCenter(UK_CENTER);
        map.setZoom(UK_ZOOM);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, draftDates, pinnedOrderIds, highlightedOrderId, onMarkerClick, isLoaded, pinnedKey, orderPins]);

  // Confirmed-order pins (permit-coloured).
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;
    const map = mapInstanceRef.current;
    const placed = orderPins.filter((p) => p.lat != null && p.lng != null);
    const keep = new Set(placed.map((p) => p.orderId));
    for (const [id, m] of orderMarkersRef.current.entries()) {
      if (!keep.has(id)) {
        m.setMap(null);
        orderMarkersRef.current.delete(id);
        infoWindowRef.current?.close();
      }
    }
    for (const pin of placed) {
      const date = draftDates.get(pin.orderId) ?? null;
      const icon: google.maps.Icon = {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildOrderPinSvg(pin, pin.orderId === highlightedOrderId, !!date))}`,
        scaledSize: new google.maps.Size(28, 36),
        anchor: new google.maps.Point(14, 34),
      };
      const title = `${pin.customerName} · ${pin.ref} · ${pin.cemeteryName}`;
      let marker = orderMarkersRef.current.get(pin.orderId);
      if (!marker) {
        marker = new google.maps.Marker({ map, position: { lat: pin.lat!, lng: pin.lng! }, title, icon });
        const m = marker;
        marker.addListener('click', () => {
          onMarkerClick?.(pin.orderId);
          const latest = (m.get('pin') as OrderPin) ?? pin;
          const latestDate = (m.get('date') as string | null) ?? null;
          if (isNarrowViewport()) {
            infoWindowRef.current?.close();
            setSheet({ kind: 'pin', pin: latest, date: latestDate });
            return;
          }
          const iw = infoWindowRef.current;
          if (!iw) return;
          iw.setContent(orderPinInfoHtml(latest, latestDate));
          iw.open(map, m);
          google.maps.event.addListenerOnce(iw, 'domready', () => {
            document
              .querySelector<HTMLButtonElement>(`button[data-open-order="${CSS.escape(latest.orderId)}"]`)
              ?.addEventListener('click', () => onOpenOrderRef.current?.(latest.orderId));
          });
        });
        orderMarkersRef.current.set(pin.orderId, marker);
      } else {
        marker.setPosition({ lat: pin.lat!, lng: pin.lng! });
        marker.setTitle(title);
        marker.setIcon(icon);
      }
      marker.set('pin', pin);
      marker.set('date', date);
      marker.setZIndex(pin.orderId === highlightedOrderId ? 1000 : undefined);
    }
  }, [orderPins, draftDates, highlightedOrderId, isLoaded, onMarkerClick]);

  useEffect(() => {
    if (!isLoaded) return;
    const prev = prevHighlightedOrderIdRef.current;
    const next = highlightedOrderId;
    if (prev === next) return;

    const updateHighlight = (orderId: string | null, highlighted: boolean) => {
      if (!orderId) return;
      const marker = markersByOrderIdRef.current.get(orderId);
      const stop = stopByOrderIdRef.current.get(orderId);
      if (!marker || !stop) return;
      const date = draftDates.get(orderId) ?? null;
      marker.setIcon(createMarkerIcon(stop, date, highlighted));
      marker.setZIndex(highlighted ? 1000 : 1);
    };

    updateHighlight(prev, false);
    updateHighlight(next, true);
    prevHighlightedOrderIdRef.current = next;
  }, [highlightedOrderId, draftDates, pinnedOrderIds, isLoaded]);

  useEffect(() => {
    if (!sheet) return;
    const id = sheet.kind === 'pin' ? sheet.pin.orderId : sheet.stop.orderId;
    const stillThere = orderPins.some((p) => p.orderId === id) || stops.some((s) => s.orderId === id);
    if (!stillThere) setSheet(null);
  }, [sheet, orderPins, stops]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = () => {
      if (!mql.matches) setSheet(null);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const el = mapRef.current;
    const map = mapInstanceRef.current;
    if (!el || !map || !isLoaded) return;
    let wasZero = el.getBoundingClientRect().width < 2 || el.getBoundingClientRect().height < 2;
    const refit = () => {
      const bounds = new google.maps.LatLngBounds();
      let n = 0;
      const extend = (marker: google.maps.Marker) => {
        const pos = marker.getPosition();
        if (!pos) return;
        bounds.extend(pos);
        n += 1;
      };
      markersByOrderIdRef.current.forEach(extend);
      orderMarkersRef.current.forEach(extend);
      if (n === 0) return;
      map.fitBounds(bounds);
      if (n === 1) map.setZoom(12);
    };
    const onResize = () => {
      const rect = el.getBoundingClientRect();
      google.maps.event.trigger(map, 'resize');
      const empty = rect.width < 2 || rect.height < 2;
      if (wasZero && !empty) refit();
      wasZero = empty;
    };
    onResize();
    const observer = new ResizeObserver(() => onResize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || focusNonce === 0 || !focusedOrderId) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const marker =
      orderMarkersRef.current.get(focusedOrderId) ??
      markersByOrderIdRef.current.get(focusedOrderId);
    const pos = marker?.getPosition();
    if (!marker || !pos) return;
    if ((map.getZoom() ?? 0) < 12) map.setZoom(12);
    map.panTo(pos);
    marker.setZIndex(1000);
    marker.setAnimation(google.maps.Animation.BOUNCE);
    const timer = window.setTimeout(() => marker.setAnimation(null), 700);
    return () => {
      window.clearTimeout(timer);
      marker.setAnimation(null);
    };
  }, [focusNonce, focusedOrderId, isLoaded]);

  const sheetTitle = sheet?.kind === 'pin'
    ? sheet.pin.customerName
    : sheet?.kind === 'stop'
      ? sheet.stop.customerName
      : '';
  const sheetDetail = sheet?.kind === 'pin'
    ? `${sheet.pin.ref} · ${sheet.pin.cemeteryName}`
    : sheet?.kind === 'stop'
      ? `${sheet.stop.location} · ${sheet.stop.orderType}`
      : '';

  return (
    <>
      <div ref={mapRef} className="h-full w-full" />
      <Sheet open={sheet != null} onOpenChange={(open) => { if (!open) setSheet(null); }}>
        <SheetContent side="bottom" className="bottom-[calc(env(safe-area-inset-bottom)+56px)] bg-gardens-surf px-4 pb-4 pt-3 text-gardens-tx">
          <SheetHeader className="space-y-1 pr-10 text-left">
            <SheetTitle className="text-base text-gardens-tx">{sheetTitle}</SheetTitle>
            <SheetDescription className="text-xs text-gardens-txs">{sheetDetail}</SheetDescription>
          </SheetHeader>
          {sheet?.kind === 'pin' && (
            <div className="mt-3 space-y-2 text-xs text-gardens-tx">
              <div className="flex items-center gap-2">
                <PermitStatusMark status={sheet.pin.permitStatus} />
                <span>Permit: {permitPinStyle(sheet.pin.permitStatus).label}</span>
              </div>
              {sheet.date && <p>Install: {sheet.date}</p>}
              {sheet.pin.source === 'geocode' && (
                <p className="text-gardens-txs">Approximate: located from the cemetery address</p>
              )}
            </div>
          )}
          {sheet?.kind === 'stop' && (
            <div className="mt-3 space-y-1 text-xs text-gardens-tx">
              <p>{sheet.date ? `Scheduled: ${sheet.date}` : 'Unscheduled'}</p>
              {sheet.stop.priority === 'high' && <p className="font-medium text-red-700">High priority</p>}
              {sheet.pinned && <p className="font-medium">Pinned</p>}
            </div>
          )}
          {sheet && (
            <Button
              className="mt-4 h-11 w-full"
              onClick={() => {
                const id = sheet.kind === 'pin' ? sheet.pin.orderId : sheet.stop.orderId;
                onOpenOrderRef.current?.(id);
                setSheet(null);
              }}
            >
              Open order
            </Button>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
