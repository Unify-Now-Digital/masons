import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { Order } from '@/modules/orders/types/orders.types';
import { isKerb } from '../utils/jobTypeClassifier';

// UK bounding box, centered roughly on the country
const UK_CENTER: [number, number] = [54.5, -2.5];
const UK_ZOOM = 6;

interface UkJobsMapProps {
  orders: Order[];
  scheduledDates: Map<string, string | null>;
  highlightedOrderId: string | null;
  onMarkerClick?: (orderId: string) => void;
}

function buildIcon(kerb: boolean, scheduled: boolean, highlighted: boolean): L.DivIcon {
  const fill = scheduled ? '#2F855A' : '#D69E2E';
  const ring = highlighted ? '#1A202C' : 'rgba(0,0,0,0.25)';
  const ringWidth = highlighted ? 3 : 1.5;
  const shape = kerb
    ? `<rect x="3" y="3" width="14" height="14" rx="2" fill="${fill}" stroke="${ring}" stroke-width="${ringWidth}"/>`
    : `<circle cx="10" cy="10" r="7" fill="${fill}" stroke="${ring}" stroke-width="${ringWidth}"/>`;
  const html = `<svg width="20" height="20" viewBox="0 0 20 20">${shape}</svg>`;
  return L.divIcon({
    html,
    className: 'mapping-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

interface JobMarkersLayerProps {
  orders: Order[];
  scheduledDates: Map<string, string | null>;
  highlightedOrderId: string | null;
  onMarkerClick?: (orderId: string) => void;
}

function JobMarkersLayer({
  orders,
  scheduledDates,
  highlightedOrderId,
  onMarkerClick,
}: JobMarkersLayerProps) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const cluster = (L as unknown as { markerClusterGroup: () => L.MarkerClusterGroup })
      .markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        chunkedLoading: true,
        maxClusterRadius: 50,
      } as L.MarkerClusterGroupOptions);
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
    for (const order of orders) {
      if (order.latitude == null || order.longitude == null) continue;
      const scheduled = !!scheduledDates.get(order.id);
      const highlighted = order.id === highlightedOrderId;
      const marker = L.marker([order.latitude, order.longitude], {
        icon: buildIcon(isKerb(order), scheduled, highlighted),
      });
      const date = scheduledDates.get(order.id);
      const dateLine = date ? `<div>Scheduled: <strong>${date}</strong></div>` : '<div>Unscheduled</div>';
      marker.bindTooltip(
        `<div style="font-size:12px">
          <div><strong>${escapeHtml(order.customer_name)}</strong></div>
          <div>${escapeHtml(order.location ?? '')}</div>
          <div>${escapeHtml(order.order_type)}</div>
          ${dateLine}
        </div>`,
        { direction: 'top', offset: [0, -8] }
      );
      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(order.id));
      }
      cluster.addLayer(marker);
    }
  }, [orders, scheduledDates, highlightedOrderId, onMarkerClick]);

  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const UkJobsMap: React.FC<UkJobsMapProps> = ({
  orders,
  scheduledDates,
  highlightedOrderId,
  onMarkerClick,
}) => {
  const ordersKey = useMemo(
    () => orders.map((o) => o.id).join(','),
    [orders]
  );
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
        key={ordersKey}
        orders={orders}
        scheduledDates={scheduledDates}
        highlightedOrderId={highlightedOrderId}
        onMarkerClick={onMarkerClick}
      />
    </MapContainer>
  );
};
