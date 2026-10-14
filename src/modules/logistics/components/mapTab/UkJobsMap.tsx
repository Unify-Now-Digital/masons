import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { ScheduleStop } from '../../utils/scheduleTypes';
import { isKerb } from '../../utils/jobTypeClassifier';
import { permitPinStyle, type OrderPin } from '../../utils/permitPins';

const API_KEY = 'AIzaSyAO0Wh9bqRA4WaYkmm0NqGAFgJnZ6MX9SU';
const UK_CENTER = { lat: 51.5074, lng: -0.1278 };
const UK_ZOOM = 10;

interface UkJobsMapProps {
  stops: ScheduleStop[];
  draftDates: Map<string, string | null>;
  pinnedOrderIds: Set<string>;
  highlightedOrderId: string | null;
  onMarkerClick?: (orderId: string) => void;
  /** Confirmed-order pins at the cemetery, coloured by permit status. */
  orderPins?: OrderPin[];
  onOpenOrder?: (orderId: string) => void;
  onReady?: () => void;
}

function buildOrderPinSvg(pin: OrderPin, highlighted: boolean, scheduled: boolean): string {
  const st = permitPinStyle(pin.permitStatus);
  const ring = highlighted ? '#1A202C' : 'rgba(0,0,0,0.35)';
  const rw = highlighted ? 3 : 1.5;
  const inner = st.hollow
    ? `<circle cx="14" cy="13" r="5.5" fill="white"/>`
    : `<circle cx="14" cy="13" r="3.2" fill="white"/>`;
  const sched = scheduled ? `<circle cx="24" cy="5" r="3.6" fill="#2F855A" stroke="#fff" stroke-width="1.2"/>` : '';
  return `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 1.5C7.1 1.5 1.5 7 1.5 13.6 1.5 22.8 14 34 14 34s12.5-11.2 12.5-20.4C26.5 7 20.9 1.5 14 1.5z" fill="${st.colour}" stroke="${ring}" stroke-width="${rw}"/>${inner}${sched}</svg>`;
}

function orderPinInfoHtml(pin: OrderPin, scheduledDate: string | null): string {
  const st = permitPinStyle(pin.permitStatus);
  const approx = pin.source === 'geocode' ? '<div style="color:#718096;font-size:11px">Approximate: located from the cemetery address</div>' : '';
  const sched = scheduledDate ? `<div>Install: <strong>${escapeHtml(scheduledDate)}</strong></div>` : '';
  return `
    <div style="font-size:12px;min-width:210px;line-height:1.45;">
      <div style="font-size:14px;font-weight:700;">${escapeHtml(pin.customerName)}</div>
      <div style="color:#4A5568">${escapeHtml(pin.ref)}</div>
      <div style="margin-top:4px">${escapeHtml(pin.cemeteryName)}</div>
      <div style="margin-top:4px;display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${st.colour};${st.hollow ? 'box-shadow:inset 0 0 0 3px #fff;border:1px solid ' + st.colour : ''}"></span>
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
  onMarkerClick,
  orderPins = [],
  onOpenOrder,
  onReady,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersByOrderIdRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const stopByOrderIdRef = useRef<Map<string, ScheduleStop>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const prevHighlightedOrderIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
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
      onReady?.();
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
          if (!infoWindowRef.current) return;
          const latestStop = stopByOrderIdRef.current.get(stop.orderId) ?? stop;
          const latestDate = draftDates.get(stop.orderId) ?? null;
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
    // Orders at the same cemetery share coordinates: fan them out on a small circle so every
    // order is clickable (count shown in the title), instead of N pins stacked as one.
    // Pins within ~250 m of each other (same cemetery, slightly different coordinates) are one group.
    const groups = new Map<string, OrderPin[]>();
    const centres: { k: string; lat: number; lng: number }[] = [];
    for (const p of orderPins) if (p.lat != null && p.lng != null) {
      const near = centres.find((c) => Math.abs(c.lat - p.lat!) < 0.0025 && Math.abs(c.lng - p.lng!) < 0.004);
      const k = near?.k ?? `${p.lat},${p.lng}`;
      if (!near) centres.push({ k, lat: p.lat, lng: p.lng });
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(p);
    }
    const placed: OrderPin[] = [];
    for (const g of groups.values()) g.forEach((p, i) => {
      if (g.length === 1) return placed.push(p);
      const a = (2 * Math.PI * i) / g.length, r = 0.0012;
      const c = g[0];
      placed.push({ ...p, lat: c.lat! + r * Math.sin(a), lng: c.lng! + (r * Math.cos(a)) / Math.cos((c.lat! * Math.PI) / 180), cemeteryName: `${p.cemeteryName} (${g.length} orders here)` });
    });
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
        scaledSize: new google.maps.Size(38, 49),
        anchor: new google.maps.Point(19, 46),
        labelOrigin: new google.maps.Point(19, 60),
      };
      const title = `${pin.ref} · ${pin.customerName} · ${pin.cemeteryName}`;
      // Visible ref under every pin (e.g. "245"), so stacked/clustered orders can be told apart at a glance.
      const label: google.maps.MarkerLabel = {
        text: pin.ref.replace(/^ORD-0*/, ''),
        color: '#1A1815',
        fontSize: '11px',
        fontWeight: '700',
        className: 'mason-pin-label',
      };
      let marker = orderMarkersRef.current.get(pin.orderId);
      if (!marker) {
        marker = new google.maps.Marker({ map, position: { lat: pin.lat!, lng: pin.lng! }, title, icon, label });
        const m = marker;
        marker.addListener('click', () => {
          onMarkerClick?.(pin.orderId);
          const iw = infoWindowRef.current;
          if (!iw) return;
          const latest = (m.get('pin') as OrderPin) ?? pin;
          iw.setContent(orderPinInfoHtml(latest, (m.get('date') as string | null) ?? null));
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
        marker.setLabel(label);
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
    };

    updateHighlight(prev, false);
    updateHighlight(next, true);
    prevHighlightedOrderIdRef.current = next;
  }, [highlightedOrderId, draftDates, pinnedOrderIds, isLoaded]);

  return <div ref={mapRef} className="h-full w-full" />;
};
