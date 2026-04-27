import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MapPin } from 'lucide-react';
import { format } from 'date-fns';
import type { MapMarker } from '../utils/mapTransform';
import { getMarkerColor } from '../utils/mapTransform';
import type { OrderMapMarker } from '../utils/orderMapTransform';
import { getOrderMarkerColor } from '../utils/orderMapTransform';

interface MapProps {
  markers: MapMarker[];
  selectedMarker: string | null; // DEPRECATED - keep for backward compatibility
  selectedMarkerIds?: Set<string>; // NEW - multi-select support
  onMarkerSelect: (markerId: string | null) => void; // DEPRECATED
  onMarkerToggle?: (markerId: string, isAssigned: boolean) => void; // NEW
  isLoading?: boolean;
  error?: Error | null;
}

export const GoogleMap: React.FC<MapProps> = ({ 
  markers, 
  selectedMarker, 
  selectedMarkerIds = new Set(),
  onMarkerSelect, 
  onMarkerToggle,
  isLoading = false,
  error = null 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowsRef = useRef<google.maps.InfoWindow[]>([]);
  const [apiKey, setApiKey] = useState('AIzaSyAO0Wh9bqRA4WaYkmm0NqGAFgJnZ6MX9SU');
  const [isLoaded, setIsLoaded] = useState(false);

  const createInfoWindowContent = (marker: MapMarker): string => {
    const statusColors: Record<string, string> = {
      scheduled: 'background-color: #E0EBF5; color: #1A3A6A;',              // gardens-blu-lt / blu-dk
      in_progress: 'background-color: #FDF0E4; color: #8A3A18;',            // gardens-amb-lt / amb-dk
      ready_for_installation: 'background-color: #E5EEE0; color: #2A5234;', // gardens-grn-lt / grn-dk
      completed: 'background-color: #E5EEE0; color: #2A5234;',              // gardens-grn-lt / grn-dk
      cancelled: 'background-color: #FDEAEA; color: #8B2020;',              // gardens-red-lt / red-dk
    };

    const formatStatus = (status: string) => {
      return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    };

    const formatDate = (date: string | null) => {
      if (!date) return 'Not scheduled';
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Invalid date';
        return format(d, 'MMM dd, yyyy');
      } catch {
        return 'Invalid date';
      }
    };

    return `
      <div style="padding: 12px; min-width: 200px; font-family: system-ui, -apple-system, sans-serif;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${marker.customer}</h3>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #7A7060;">${marker.location}</p>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #A89A86;">${marker.address}</p>
        <div style="margin: 8px 0;">
          <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; ${statusColors[marker.status] || 'background-color: #F2EEE5; color: #7A7060;'}">
            ${formatStatus(marker.status)}
          </span>
        </div>
        <p style="margin: 4px 0; font-size: 13px; color: #7A7060;">Scheduled: ${formatDate(marker.scheduledDate)}</p>
        <a href="/dashboard/jobs/${marker.id}" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #C2693B; color: white; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 500;">
          Open Job
        </a>
      </div>
    `;
  };

  useEffect(() => {
    if (!apiKey) return;

    const loader = new Loader({
      apiKey: apiKey,
      version: 'weekly',
      libraries: ['places']
    });

    loader.load().then(() => {
      if (mapRef.current && !map) {
        const googleMap = new google.maps.Map(mapRef.current, {
          zoom: 10,
          center: { lat: 51.5074, lng: -0.1278 },
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        setMap(googleMap);
        setIsLoaded(true);
      }
    });
  }, [apiKey, map]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    // Clear existing markers and info windows
    markersRef.current.forEach(marker => marker.setMap(null));
    infoWindowsRef.current.forEach(window => window.close());
    markersRef.current = [];
    infoWindowsRef.current = [];

    // Add new markers
    const newMarkers = markers.map(marker => {
      // Check if this is an OrderMapMarker
      const orderMarker = marker as OrderMapMarker;
      const isOrderMarker = 'isAssigned' in marker;
      
      // Determine marker color based on type
      let markerColor: string;
      if (isOrderMarker && onMarkerToggle) {
        const isSelected = selectedMarkerIds.has(marker.id);
        markerColor = getOrderMarkerColor(orderMarker.isAssigned, isSelected);
      } else {
        markerColor = getMarkerColor(marker.status);
      }
      
      const googleMarker = new google.maps.Marker({
        position: marker.coordinates,
        map: map,
        title: `${marker.customer} - ${marker.location}`,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="${markerColor}" stroke="white" stroke-width="2"/>
              <circle cx="12" cy="10" r="3" fill="white"/>
            </svg>
          `)}`,
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 32)
        }
      });

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent(marker),
      });

      googleMarker.addListener('click', () => {
        // Close other info windows
        infoWindowsRef.current.forEach(window => window.close());
        
        // Handle Order marker selection
        if (isOrderMarker && onMarkerToggle) {
          // Always call onMarkerSelect to trigger info panel
          onMarkerSelect(marker.id);
          
          if (orderMarker.isAssigned) {
            // Show info but don't allow selection
            infoWindow.open(map, googleMarker);
            return;
          }
          
          // Toggle selection
          onMarkerToggle(marker.id, orderMarker.isAssigned);
          
          // Show info window
          infoWindow.open(map, googleMarker);
        } else {
          // Legacy behavior for Job markers
          infoWindow.open(map, googleMarker);
          onMarkerSelect(selectedMarker === marker.id ? null : marker.id);
        }
      });

      markersRef.current.push(googleMarker);
      infoWindowsRef.current.push(infoWindow);

      return googleMarker;
    });

    // Fit bounds to show all markers
    if (newMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      newMarkers.forEach(marker => {
        const position = marker.getPosition();
        if (position) bounds.extend(position);
      });
      map.fitBounds(bounds);
    }
  }, [map, markers, selectedMarker, selectedMarkerIds, onMarkerSelect, onMarkerToggle, isLoaded]);

  if (!apiKey) {
    return (
      <div className="h-full bg-gardens-page rounded-lg flex flex-col items-center justify-center p-6">
        <MapPin className="h-12 w-12 text-gardens-txs mb-4" />
        <h3 className="text-lg font-medium text-gardens-tx mb-2">Google Maps Integration</h3>
        <p className="text-sm text-gardens-tx mb-4 text-center">
          Enter your Google Maps API key to display the interactive map
        </p>
        <input
          type="text"
          placeholder="Enter Google Maps API Key"
          className="px-4 py-2 border border-gardens-bdr rounded-lg w-full max-w-md"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              setApiKey((e.target as HTMLInputElement).value);
            }
          }}
        />
        <p className="text-xs text-gardens-txs mt-2">
          Get your API key from the Google Cloud Console
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full rounded-lg">
      <div ref={mapRef} className="h-full w-full rounded-lg" />
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gardens-blu mb-2"></div>
            <p className="text-sm text-gardens-tx">Loading jobs...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
          <div className="flex flex-col items-center text-center p-4">
            <MapPin className="h-12 w-12 text-gardens-txs mb-4" />
            <p className="text-sm text-gardens-tx">Failed to load job locations</p>
            <p className="text-xs text-gardens-txs mt-1">{error.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleMap;

