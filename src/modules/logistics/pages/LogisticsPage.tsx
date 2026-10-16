import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapTab } from '../components/mapTab/MapTab';

/**
 * Logistics is the map view only (Oct 2026). The Planner tab was retired;
 * legacy ?tab=planner links are normalised to the map.
 */
export const LogisticsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('tab') === 'planner') {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('tab', 'map');
          return params;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  return <MapTab />;
};
