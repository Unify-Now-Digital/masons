import { describe, expect, it } from 'vitest';
import { clusterByScreen, clusterTapAction, MAP_FIT_MAX_ZOOM, offsetOverlapping, sameSpot } from './mapClusters';

describe('map point separation', () => {
  const stacked = [
    { id: 'a', lat: 51.5, lng: -0.12 },
    { id: 'b', lat: 51.5, lng: -0.12 },
  ];

  it('offsets identical coordinates so each marker can be tapped', () => {
    const [a, b] = offsetOverlapping(stacked, MAP_FIT_MAX_ZOOM, 44);
    expect(a.lat).not.toBe(b.lat);
    expect(Math.hypot(a.lat - b.lat, a.lng - b.lng)).toBeGreaterThan(0);
  });

  it('leaves a lone marker where it is', () => {
    const [only] = offsetOverlapping([{ id: 'a', lat: 51.5, lng: -0.12 }]);
    expect(only).toEqual({ id: 'a', lat: 51.5, lng: -0.12 });
  });

  it('clusters points that still overlap at a wide zoom', () => {
    const spread = offsetOverlapping(stacked, MAP_FIT_MAX_ZOOM, 44);
    const wide = clusterByScreen(spread, 8);
    expect(wide).toHaveLength(1);
    expect(wide[0].items).toHaveLength(2);
    const close = clusterByScreen(spread, 18);
    expect(close).toHaveLength(2);
  });

  it('opens a picker for identical pins instead of zooming forever', () => {
    expect(sameSpot(stacked)).toBe(true);
    expect(clusterTapAction(10, true)).toBe('pick');
    expect(clusterTapAction(12, false)).toBe('zoom');
    expect(clusterTapAction(18, false)).toBe('pick');
  });
});
