// geoUtils.js
// Small, fast helpers for distance-to-route and colorized segments.

// Feet → meters
export const ftToM = (ft) => (Number(ft) || 0) * 0.3048;

// Equirectangular projection around a reference latitude (for small distances)
function toXYMeters(lat, lon, refLat) {
  const rad = Math.PI / 180;
  const x = (lon) * Math.cos(refLat * rad) * 111320; // meters per deg lon
  const y = (lat) * 111320;                          // meters per deg lat
  return { x, y };
}

// Point→segment distance (meters) using local equirectangular plane
function pointToSegmentDistM(pt, a, b) {
  // Guard: degenerate segment
  if (a.latitude === b.latitude && a.longitude === b.longitude) {
    // distance to point 'a'
    const refLat = a.latitude;
    const P = toXYMeters(pt.latitude, pt.longitude, refLat);
    const A = toXYMeters(a.latitude, a.longitude, refLat);
    const dx = P.x - A.x, dy = P.y - A.y;
    return Math.hypot(dx, dy);
  }
  const refLat = (a.latitude + b.latitude) * 0.5;
  const A = toXYMeters(a.latitude, a.longitude, refLat);
  const B = toXYMeters(b.latitude, b.longitude, refLat);
  const P = toXYMeters(pt.latitude, pt.longitude, refLat);

  const ABx = B.x - A.x, ABy = B.y - A.y;
  const APx = P.x - A.x, APy = P.y - A.y;

  const ab2 = ABx*ABx + ABy*ABy;
  let t = ab2 > 0 ? (APx*ABx + APy*ABy) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));

  const Cx = A.x + t*ABx, Cy = A.y + t*ABy;
  const dx = P.x - Cx, dy = P.y - Cy;
  return Math.hypot(dx, dy);
}

// Nearest distance from a point to a polyline (meters)
export function nearestDistToPolylineM(pt, line) {
  if (!Array.isArray(line) || line.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const d = pointToSegmentDistM(pt, line[i-1], line[i]);
    if (d < best) best = d;
  }
  return best;
}

// Build colorized segments for a run path based on deviation to the official route.
// Returns an array of groups: [{ color, coordinates: [{lat,lon}, ...] }]
export function buildDeviationSegments(runCoords, officialRoute, prefs = {}) {
  const liveColor = prefs.liveRouteColor || '#1E90FF';
  const warn1Color = prefs.warningColor1 || 'orange';
  const warn2Color = prefs.warningColor2 || 'red';

  const t1m = ftToM(prefs.warningThreshold1 ?? 50);
  const t2m = ftToM(prefs.warningThreshold2 ?? 75);

  const coords = Array.isArray(runCoords) ? runCoords : [];
  const route  = Array.isArray(officialRoute) ? officialRoute : [];

  if (coords.length < 2 || route.length < 2) {
    // Fallback: single-color whole path
    return coords.length > 1 ? [{ color: liveColor, coordinates: coords.map(p => ({ latitude: p.latitude, longitude: p.longitude })) }] : [];
  }

  const groups = [];
  let currentColor = null;
  let currentGroup = null;

  for (let i = 1; i < coords.length; i++) {
    const p1 = coords[i - 1];
    const p2 = coords[i];
    if (p1.latitude == null || p1.longitude == null || p2.latitude == null || p2.longitude == null) continue;

    // Use the newer point (p2) as representative for the segment
    const distM = nearestDistToPolylineM({ latitude: p2.latitude, longitude: p2.longitude }, route);

    let color = liveColor;
    if (Number.isFinite(distM)) {
      if (distM >= t2m) color = warn2Color;
      else if (distM >= t1m) color = warn1Color;
    }

    if (color !== currentColor) {
      // start new group
      if (currentGroup && currentGroup.coordinates.length > 1) groups.push(currentGroup);
      currentColor = color;
      currentGroup = { color, coordinates: [ { latitude: p1.latitude, longitude: p1.longitude } ] };
    }
    currentGroup.coordinates.push({ latitude: p2.latitude, longitude: p2.longitude });
  }

  if (currentGroup && currentGroup.coordinates.length > 1) groups.push(currentGroup);
  return groups;
}
