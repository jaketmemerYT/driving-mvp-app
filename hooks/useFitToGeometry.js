// hooks/useFitToGeometry.js
import { useEffect, useMemo } from 'react';

/**
 * Auto-fits a react-native-maps MapView (via ref) to either:
 * - a route polyline (>= 2 points), OR
 * - start + end points, OR
 * - a single start point (expanded to a tiny span),
 * with consistent padding + animation, and a readiness gate.
 *
 * @param {Object} opts
 * @param {Object} opts.mapRef
 * @param {Array<{latitude:number, longitude:number}>} [opts.route=[]]
 * @param {{latitude:number, longitude:number}|null} [opts.start=null]
 * @param {{latitude:number, longitude:number}|null} [opts.end=null]
 * @param {{top:number,right:number,bottom:number,left:number}|number} [opts.padding=60]
 * @param {boolean} [opts.animated=true]
 * @param {number} [opts.minSpan=0.0005]
 * @param {number} [opts.debounceMs=0]
 * @param {boolean} [opts.enabled=true] - set false until MapView is ready
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
  enabled = true,
}) {
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

  const clean = (p) =>
    p &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180;

  const coords = useMemo(() => {
    if (Array.isArray(route) && route.length >= 2) {
      const r = route
        .map((p) => ({ latitude: +p.latitude, longitude: +p.longitude }))
        .filter(clean);
      if (r.length >= 2) return r;
    }
    if (start && end && clean(start) && clean(end)) return [start, end];
    if (start && clean(start)) return [start];
    return null;
  }, [route, start, end]);

  // Change key minimizes refits
  const changeKey = useMemo(() => {
    if (!coords || coords.length === 0) return 'none';
    const last = coords[coords.length - 1];
    return `${coords.length}:${last.latitude?.toFixed(6)},${last.longitude?.toFixed(6)}`;
  }, [coords]);

  useEffect(() => {
    if (!enabled) return;
    if (!mapRef?.current || !coords || coords.length === 0) return;

    let fitCoords = coords;

    // Ensure non-zero viewing box
    const ensureMinSpan = (points) => {
      const lats = points.map((c) => c.latitude);
      const lons = points.map((c) => c.longitude);
      const latSpan = Math.max(...lats) - Math.min(...lats);
      const lonSpan = Math.max(...lons) - Math.min(...lons);
      if (latSpan >= minSpan || lonSpan >= minSpan) return points;

      const midLat = (Math.max(...lats) + Math.min(...lats)) / 2;
      const midLon = (Math.max(...lons) + Math.min(...lons)) / 2;
      const dLat = Math.max(minSpan / 2, latSpan / 2 || minSpan / 2);
      const dLon = Math.max(minSpan / 2, lonSpan / 2 || minSpan / 2);
      return [
        { latitude: midLat - dLat, longitude: midLon - dLon },
        { latitude: midLat + dLat, longitude: midLon + dLon },
      ];
    };

    fitCoords =
      coords.length === 1 ? ensureMinSpan([coords[0], coords[0]]) : ensureMinSpan(coords);

    const id = setTimeout(() => {
      try {
        mapRef.current?.fitToCoordinates(fitCoords, { edgePadding, animated });
      } catch (e) {
        console.warn('fitToCoordinates failed', e);
      }
    }, debounceMs);

    return () => clearTimeout(id);
  }, [enabled, mapRef, changeKey, edgePadding, animated, minSpan, debounceMs]);
}
