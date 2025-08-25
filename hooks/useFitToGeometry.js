// hooks/useFitToGeometry.js
import { useEffect, useMemo } from 'react';

/**
 * Auto-fits a react-native-maps MapView (via ref) to either:
 * - a route polyline (>= 2 points), OR
 * - start + end points (fallback),
 * with consistent padding + animation. Safe to use across screens.
 *
 * @param {Object} opts
 * @param {Object} opts.mapRef - ref created with useRef(null) and passed to <MapBase ref={...} />
 * @param {Array<{latitude:number, longitude:number, timestamp?:number}>} [opts.route] - rich route points
 * @param {{latitude:number, longitude:number}|null} [opts.start] - start point
 * @param {{latitude:number, longitude:number}|null} [opts.end] - end point
 * @param {{top:number,right:number,bottom:number,left:number}|number} [opts.padding=60]
 * @param {boolean} [opts.animated=true]
 * @param {number} [opts.minSpan=0.0005] - ~50m; avoids zero-area bounds
 * @param {number} [opts.debounceMs=0] - extra delay before fitting
 */
export function useFitToGeometry({
  mapRef,
  route = [],
  start = null,
  end = null,
  padding = 60,
  animated = true,
  minSpan = 0.0005,
  debounceMs = 0,
}) {
  // Normalize padding to an object
  const edgePadding = useMemo(() => {
    if (typeof padding === 'number') {
      return { top: padding, right: padding, bottom: padding, left: padding };
    }
    return {
      top: padding.top ?? 60,
      right: padding.right ?? 60,
      bottom: padding.bottom ?? 60,
      left: padding.left ?? 60,
    };
  }, [padding]);

  // Pick which coordinates to fit to
  const coords = useMemo(() => {
    if (route && route.length >= 2) {
      return route.map(p => ({ latitude: p.latitude, longitude: p.longitude }));
    }
    if (start && end) {
      return [start, end];
    }
    if (start) {
      return [start]; // single point (we'll pad to non-zero span below)
    }
    return null;
  }, [route, start, end]);

  // Create a simple change key so we don't refit on every render
  const changeKey = useMemo(() => {
    if (!coords || coords.length === 0) return 'none';
    const last = coords[coords.length - 1];
    return `${coords.length}:${last.latitude?.toFixed(6)},${last.longitude?.toFixed(6)}`;
  }, [coords]);

  useEffect(() => {
    if (!mapRef?.current || !coords || coords.length === 0) return;

    // Ensure non-zero area: if all points collapse to one spot, add a tiny buffer
    let fitCoords = coords;
    if (coords.length === 1) {
      const { latitude, longitude } = coords[0];
      const dLat = minSpan / 2;
      const dLon = minSpan / 2;
      fitCoords = [
        { latitude: latitude - dLat, longitude: longitude - dLon },
        { latitude: latitude + dLat, longitude: longitude + dLon },
      ];
    } else {
      // Also handle case where route points are identical (rare but possible)
      const lats = coords.map(c => c.latitude);
      const lons = coords.map(c => c.longitude);
      const latSpan = Math.max(...lats) - Math.min(...lats);
      const lonSpan = Math.max(...lons) - Math.min(...lons);
      if (latSpan < minSpan && lonSpan < minSpan) {
        const midLat = (Math.max(...lats) + Math.min(...lats)) / 2;
        const midLon = (Math.max(...lons) + Math.min(...lons)) / 2;
        const dLat = Math.max(minSpan / 2, latSpan / 2);
        const dLon = Math.max(minSpan / 2, lonSpan / 2);
        fitCoords = [
          { latitude: midLat - dLat, longitude: midLon - dLon },
          { latitude: midLat + dLat, longitude: midLon + dLon },
        ];
      }
    }

    const id = setTimeout(() => {
      try {
        mapRef.current?.fitToCoordinates(fitCoords, {
          edgePadding,
          animated,
        });
      } catch (e) {
        // Non-fatal; avoid crashing on rapid remounts/layout changes
        console.warn('fitToCoordinates failed', e);
      }
    }, debounceMs);

    return () => clearTimeout(id);
    // changeKey ensures we refit only when geometry meaningfully changes
  }, [mapRef, changeKey, edgePadding, animated, minSpan, debounceMs]);
}
