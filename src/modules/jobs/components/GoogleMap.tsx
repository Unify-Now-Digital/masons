import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MapPin } from 'lucide-react';

interface MapProps {
  jobs: Array<{
    id: string;
    customer: string;
    location: string;
    address: string;
    coordinates: { lat: number; lng: number };
    status: string;
    priority: string;
  }>;
  selectedJob: string | null;
  onJobSelect: (jobId: string | null) => void;
}

export const GoogleMap: React.FC<MapProps> = ({ jobs, selectedJob, onJobSelect }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [apiKey, setApiKey] = useState('AIzaSyAO0Wh9bqRA4WaYkmm0NqGAFgJnZ6MX9SU');
  const [isLoaded, setIsLoaded] = useState(false);

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
          zoom: 12,
          center: { lat: 40.7128, lng: -74.0060 },
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

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);

    // Add new markers
    const newMarkers = jobs.map(job => {
      const marker = new google.maps.Marker({
        position: job.coordinates,
        map: map,
        title: job.customer,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="${
                job.status === 'ready_for_installation' ? '#10b981' :
                job.priority === 'high' ? '#ef4444' : '#3b82f6'
              }" stroke="white" stroke-width="2"/>
              <circle cx="12" cy="10" r="3" fill="white"/>
            </svg>
          `)}`,
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 32)
        }
      });

      marker.addListener('click', () => {
        onJobSelect(selectedJob === job.id ? null : job.id);
      });

      return marker;
    });

    setMarkers(newMarkers);

    // Fit bounds to show all markers
    if (newMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      newMarkers.forEach(marker => {
        const position = marker.getPosition();
        if (position) bounds.extend(position);
      });
      map.fitBounds(bounds);
    }
  }, [map, jobs, selectedJob, onJobSelect, isLoaded]);

  if (!apiKey) {
    return (
      <div className="h-full bg-slate-100 rounded-lg flex flex-col items-center justify-center p-6">
        <MapPin className="h-12 w-12 text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">Google Maps Integration</h3>
        <p className="text-sm text-slate-600 mb-4 text-center">
          Enter your Google Maps API key to display the interactive map
        </p>
        <input
          type="text"
          placeholder="Enter Google Maps API Key"
          className="px-4 py-2 border border-slate-300 rounded-lg w-full max-w-md"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              setApiKey((e.target as HTMLInputElement).value);
            }
          }}
        />
        <p className="text-xs text-slate-500 mt-2">
          Get your API key from the Google Cloud Console
        </p>
      </div>
    );
  }

  return <div ref={mapRef} className="h-full w-full rounded-lg" />;
};

export default GoogleMap;

