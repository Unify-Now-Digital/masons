import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { ScheduleStop } from '../../utils/scheduleTypes';
import { isKerb } from '../../utils/jobTypeClassifier';

const UK_CENTER: [number, number] = [54.5, -2.5];
const UK_ZOOM = 6;

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

function buildIcon(
  kerb: boolean,
  scheduled: boolean,
  highlighted: boolean,
  highPriority: boolean,
  pinned: boolean
): L.DivIcon {
  const fill = scheduled ? '#2F855A' : '#D69E2E';
  const ring = highlighted ? '#1A202C' : highPriority ? '#C53030' : 'rgba(0,0,0,0.25)';
  const ringWidth = highlighted ? 3 : highPriority ? 2.25 : 1.5;
  const shape = kerb
    ? `<rect x="3" y="3" width="14" height="14" rx="2" fill="${fill}" stroke="${ring}" stroke-width="${ringWidth}"/>`
    : `<circle cx="10" cy="10" r="7" fill="${fill}" stroke="${ring}" stroke-width="${ringWidth}"/>`;
  const pinDot = pinned
    ? `<circle cx="16" cy="4" r="2.5" fill="#1A202C" stroke="#fff" stroke-width="1"/>`
    : '';
  const html = `<svg width="20" height="20" viewBox="0 0 20 20">${shape}${pinDot}</svg>`;
  return L.divIcon({
    html,
    className: 'mapping-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

interface JobMarkersLayerProps {
  stops: ScheduleStop[];
  draftDates: Map<string, string | null>;
  pinnedOrderIds: Set<string>;
  highlightedOrderId: string | null;
  onMarkerClick?: (orderId: string) => void;
}

function JobMarkersLayer({
  stops,
  draftDates,
  pinnedOrderIds,
  highlightedOrderId,
  onMarkerClick,
}: JobMarkersLayerProps) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const cluster = (
      L as unknown as { markerClusterGroup: (opts?: unknown) => L.MarkerClusterGroup }
    ).markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true,
      maxClusterRadius: 50,
    });
    clusterRef.current = cluster;
    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
      clusterRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    for (const stop of stops) {
      const date = draftDates.get(stop.orderId);
      const scheduled = !!date;
      const highlighted = stop.orderId === highlightedOrderId;
      const highPriority = stop.priority === 'high';
      const pinned = pinnedOrderIds.has(stop.orderId);
      const marker = L.marker([stop.latitude, stop.longitude], {
        icon: buildIcon(isKerb(stop), scheduled, highlighted, highPriority, pinned),
      });
      const dateLine = date
        ? `<div>Scheduled: <strong>${date}</strong>${pinned ? ' <span style="color:#C53030">(pinned)</span>' : ''}</div>`
        : '<div>Unscheduled</div>';
      const priorityLine =
        stop.priority === 'high'
          ? '<div style="color:#C53030;font-weight:600">High priority</div>'
          : '';
      marker.bindTooltip(
        `<div style="font-size:12px">
          <div><strong>${escapeHtml(stop.customerName)}</strong></div>
          <div>${escapeHtml(stop.location)}</div>
          <div>${escapeHtml(stop.orderType)}</div>
          ${priorityLine}
          ${dateLine}
        </div>`,
        { direction: 'top', offset: [0, -8] }
      );
      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(stop.orderId));
      }
      cluster.addLayer(marker);
    }
  }, [stops, draftDates, pinnedOrderIds, highlightedOrderId, onMarkerClick]);

  return null;
}

export const UkJobsMap: React.FC<UkJobsMapProps> = ({
  stops,
  draftDates,
  pinnedOrderIds,
  highlightedOrderId,
  onMarkerClick,
}) => {
  const stopsKey = useMemo(() => stops.map((s) => s.orderId).join(','), [stops]);
  return (
    <MapContainer
      center={UK_CENTER}
      zoom={UK_ZOOM}
      minZoom={5}
      maxZoom={18}
      style={{ height: '100%', width: '100%' }}
      worldCopyJump={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <JobMarkersLayer
        key={stopsKey}
        stops={stops}
        draftDates={draftDates}
        pinnedOrderIds={pinnedOrderIds}
        highlightedOrderId={highlightedOrderId}
        onMarkerClick={onMarkerClick}
      />
    </MapContainer>
  );
};
