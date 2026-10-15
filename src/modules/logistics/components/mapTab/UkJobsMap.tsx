import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Loader2 } from 'lucide-react';
import type { ScheduleStop } from '../../utils/scheduleTypes';
import { isKerb } from '../../utils/jobTypeClassifier';
import { pinColour, permitPinInnerSvg, permitPinStyle, type OrderPin } from '../../utils/permitPins';
import { clusterByScreen, MAP_FIT_MAX_ZOOM, offsetOverlapping, type MapPoint } from '../../utils/mapClusters';
import { Button } from '@/shared/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet';
import { PermitStatusMark } from './PermitStatusMark';

const API_KEY = 'AIzaSyAO0Wh9bqRA4WaYkmm0NqGAFgJnZ6MX9SU';
const UK_CENTER = { lat: 51.5074, lng: -0.1278 };
const UK_ZOOM = 10;

function capFitZoom(map: google.maps.Map, pointCount: number) {
  google.maps.event.addListenerOnce(map, 'idle', () => {
    const zoom = map.getZoom();
    if (zoom == null) return;
    if (pointCount === 1) {
      if (zoom !== 12) map.setZoom(12);
      return;
    }
    if (zoom > MAP_FIT_MAX_ZOOM) map.setZoom(MAP_FIT_MAX_ZOOM);
  });
}

function fitMap(map: google.maps.Map, points: { lat: number; lng: number }[]) {
  if (points.length === 0) {
    map.setCenter(UK_CENTER);
    map.setZoom(UK_ZOOM);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  for (const point of points) bounds.extend(point);
  map.fitBounds(bounds);
  capFitZoom(map, points.length);
}

function clusterIcon(count: number): google.maps.Icon {
  const svg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="16" fill="#1A202C" stroke="#fff" stroke-width="2"/><text x="20" y="25" text-anchor="middle" font-size="13" font-family="sans-serif" fill="#fff">${count}</text></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(40, 40),
    anchor: new google.maps.Point(20, 20),
  };
}

interface UkJobsMapProps {
  stops: ScheduleStop[];
  draftDates: Map<string, string | null>;
  /** Dates shown as a proposal, not an unsaved edit. */
  suggestedOrderIds?: Set<string>;
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

type MapSheetState =
  | { kind: 'pin'; pin: OrderPin; date: string | null; suggested: boolean }
  | { kind: 'stop'; stop: ScheduleStop; date: string | null; pinned: boolean; suggested: boolean };

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
  suggestedOrderIds,
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
  const prevHighlightedOrderIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [sheet, setSheet] = useState<MapSheetState | null>(null);
  const draftDatesRef = useRef(draftDates);
  draftDatesRef.current = draftDates;
  const pinnedRef = useRef(pinnedOrderIds);
  pinnedRef.current = pinnedOrderIds;
  const orderMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const clusterMarkersRef = useRef<google.maps.Marker[]>([]);
  const orderPinsRef = useRef(orderPins);
  orderPinsRef.current = orderPins;
  const suggestedRef = useRef(suggestedOrderIds);
  suggestedRef.current = suggestedOrderIds;
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
          setSheet({
            kind: 'stop',
            stop: latestStop,
            date: latestDate,
            pinned: pinnedRef.current.has(stop.orderId),
            suggested: suggestedRef.current?.has(stop.orderId) ?? false,
          });
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
      fitMap(map, points);
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
          setSheet({
            kind: 'pin',
            pin: latest,
            date: latestDate,
            suggested: suggestedRef.current?.has(pin.orderId) ?? false,
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

  const layoutRef = useRef<() => void>(() => {});
  layoutRef.current = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    for (const marker of clusterMarkersRef.current) marker.setMap(null);
    clusterMarkersRef.current = [];

    const raw: MapPoint[] = [];
    for (const [id] of markersByOrderIdRef.current) {
      const stop = stopByOrderIdRef.current.get(id);
      if (!stop) continue;
      raw.push({ id, lat: stop.latitude, lng: stop.longitude });
    }
    for (const pin of orderPinsRef.current) {
      if (pin.lat == null || pin.lng == null) continue;
      if (!orderMarkersRef.current.has(pin.orderId)) continue;
      if (markersByOrderIdRef.current.has(pin.orderId)) continue;
      raw.push({ id: pin.orderId, lat: pin.lat, lng: pin.lng });
    }

    const zoom = map.getZoom() ?? UK_ZOOM;
    const placed = offsetOverlapping(raw, MAP_FIT_MAX_ZOOM);
    const markerFor = (id: string) =>
      markersByOrderIdRef.current.get(id) ?? orderMarkersRef.current.get(id);

    for (const cluster of clusterByScreen(placed, zoom)) {
      if (cluster.items.length < 2) {
        const item = cluster.items[0];
        const marker = markerFor(item.id);
        if (!marker) continue;
        marker.setMap(map);
        marker.setPosition({ lat: item.lat, lng: item.lng });
        continue;
      }
      for (const item of cluster.items) markerFor(item.id)?.setMap(null);
      const marker = new google.maps.Marker({
        map,
        position: { lat: cluster.lat, lng: cluster.lng },
        title: `${cluster.items.length} jobs here`,
        icon: clusterIcon(cluster.items.length),
        zIndex: 800,
      });
      marker.addListener('click', () => {
        map.setZoom(Math.min((map.getZoom() ?? zoom) + 2, 18));
        map.panTo({ lat: cluster.lat, lng: cluster.lng });
      });
      clusterMarkersRef.current.push(marker);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    layoutRef.current();
  }, [isLoaded, stops, orderPins, draftDates, highlightedOrderId, pinnedOrderIds]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;
    let zoom = map.getZoom();
    const listener = map.addListener('idle', () => {
      const next = map.getZoom();
      if (next === zoom) return;
      zoom = next;
      layoutRef.current();
    });
    return () => listener.remove();
  }, [isLoaded]);

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
    const el = mapRef.current;
    const map = mapInstanceRef.current;
    if (!el || !map || !isLoaded) return;
    let wasZero = el.getBoundingClientRect().width < 2 || el.getBoundingClientRect().height < 2;
    const refit = () => {
      const points: { lat: number; lng: number }[] = [];
      const collect = (marker: google.maps.Marker) => {
        const pos = marker.getPosition();
        if (!pos) return;
        points.push({ lat: pos.lat(), lng: pos.lng() });
      };
      markersByOrderIdRef.current.forEach(collect);
      orderMarkersRef.current.forEach(collect);
      if (points.length === 0) return;
      fitMap(map, points);
    };
    const redraw = () => {
      const rect = el.getBoundingClientRect();
      const center = map.getCenter();
      google.maps.event.trigger(map, 'resize');
      if (center) map.setCenter(center);
      const empty = rect.width < 2 || rect.height < 2;
      if (wasZero && !empty) refit();
      wasZero = empty;
      layoutRef.current();
    };
    redraw();
    const frame = requestAnimationFrame(redraw);
    const soon = window.setTimeout(redraw, 50);
    const later = window.setTimeout(redraw, 300);
    const onVisible = () => {
      if (document.visibilityState === 'visible') redraw();
    };
    document.addEventListener('visibilitychange', onVisible);
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) redraw();
    });
    seen.observe(el);
    const observer = new ResizeObserver(() => redraw());
    observer.observe(el);
    const parent = el.parentElement;
    if (parent) observer.observe(parent);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(soon);
      window.clearTimeout(later);
      document.removeEventListener('visibilitychange', onVisible);
      seen.disconnect();
      observer.disconnect();
    };
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
    if (!marker.getMap()) map.setZoom(Math.min((map.getZoom() ?? UK_ZOOM) + 2, 18));
    else if ((map.getZoom() ?? 0) < 12) map.setZoom(12);
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
    <div className="relative h-full w-full">
      <div ref={mapRef} className="absolute inset-0" />
      {!isLoaded && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-gardens-page"
          role="status"
          aria-live="polite"
          aria-label="Loading map"
        >
          <div className="absolute inset-6 animate-pulse rounded-md bg-gardens-bdr/50" />
          <Loader2 className="relative h-6 w-6 animate-spin text-gardens-txm-aa" />
        </div>
      )}
      <Sheet open={sheet != null} onOpenChange={(open) => { if (!open) setSheet(null); }}>
        <SheetContent side="bottom" className="bottom-[calc(env(safe-area-inset-bottom)+56px)] bg-gardens-surf px-4 pb-4 pt-3 text-gardens-tx lg:bottom-4 [&>button]:h-11 [&>button]:w-11">
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
              {sheet.date && (
                <p>{sheet.suggested ? `Suggested: ${sheet.date}` : `Install: ${sheet.date}`}</p>
              )}
              {sheet.pin.source === 'geocode' && (
                <p className="text-gardens-txs">Approximate: located from the cemetery address</p>
              )}
            </div>
          )}
          {sheet?.kind === 'stop' && (
            <div className="mt-3 space-y-1 text-xs text-gardens-tx">
              <p>
                {sheet.suggested && sheet.date
                  ? `Suggested: ${sheet.date}`
                  : sheet.date
                    ? `Scheduled: ${sheet.date}`
                    : 'Unscheduled'}
              </p>
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
    </div>
  );
};
