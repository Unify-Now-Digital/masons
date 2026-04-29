import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { ScheduleStop } from '../../utils/scheduleTypes';
import { isKerb } from '../../utils/jobTypeClassifier';

const API_KEY = 'AIzaSyAO0Wh9bqRA4WaYkmm0NqGAFgJnZ6MX9SU';
const UK_CENTER = { lat: 51.5074, lng: -0.1278 };
const UK_ZOOM = 10;

interface UkJobsMapProps {
  stops: ScheduleStop[];
  draftDates: Map<string, string | null>;
  pinnedOrderIds: Set<string>;
  highlightedOrderId: string | null;
  onMarkerClick?: (orderId: string) => void;
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
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersByOrderIdRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const stopByOrderIdRef = useRef<Map<string, ScheduleStop>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const prevHighlightedOrderIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

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
    });
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const map = mapInstanceRef.current;
    const nextStopIds = new Set(stops.map((s) => s.orderId));
    stopByOrderIdRef.current = new Map(stops.map((s) => [s.orderId, s]));

    for (const [orderId, marker] of markersByOrderIdRef.current.entries()) {
      if (!nextStopIds.has(orderId)) {
        marker.setMap(null);
        markersByOrderIdRef.current.delete(orderId);
      }
    }

    for (const stop of stops) {
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

    if (stops.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      for (const stop of stops) {
        bounds.extend({ lat: stop.latitude, lng: stop.longitude });
      }
      map.fitBounds(bounds);
    } else {
      map.setCenter(UK_CENTER);
      map.setZoom(UK_ZOOM);
    }
  }, [stops, draftDates, pinnedOrderIds, highlightedOrderId, onMarkerClick, isLoaded]);

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
