// MapBase.js
import React, { forwardRef, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { UrlTile } from 'react-native-maps';
import {
  USE_MAP_TILES,
  MAPTILER_TILE_URL_TEMPLATE,
  MAPTILER_STYLE,
  MAPTILER_TILE_SIZE,
  MAPTILER_MAX_Z,
  MAPTILER_KEY,
} from './config';

/**
 * Shared Map wrapper with robust fallbacks:
 * - Leaves platform base map visible (no shouldReplaceMapContent).
 * - If tiles error even once, auto-disables tiles for this instance (so users never stare at a blank map).
 * - Accepts `tilesEnabled={false}` for thumbnail/previews to keep them snappy and avoid any tile hiccups.
 *
 * Props you can pass through:
 * - tilesEnabled?: boolean (default true, but obeys USE_MAP_TILES and auto-fallback on errors)
 * - children, style, initialRegion, region, etc. (same as MapView)
 */
const MapBase = forwardRef(function MapBase(
  { tilesEnabled = true, children, style, ...props },
  ref
) {
  const [tilesOk, setTilesOk] = useState(true);
  const errorCountRef = useRef(0);

  const canUseTiles = useMemo(() => {
    return (
      !!tilesEnabled &&
      !!USE_MAP_TILES &&
      !!MAPTILER_TILE_URL_TEMPLATE &&
      !!MAPTILER_STYLE &&
      !!MAPTILER_KEY &&
      tilesOk
    );
  }, [tilesEnabled, tilesOk]);

  const urlTemplate = useMemo(() => {
    if (!canUseTiles) return null;
    // Build final URL from template (no /tiles, no @2x here; size must match MAPTILER_TILE_SIZE)
    // Example template in config:
    // 'https://api.maptiler.com/maps/{style}/{z}/{x}/{y}.png?key={key}'
    // or explicitly 256-sized endpoints:
    // 'https://api.maptiler.com/maps/{style}/256/{z}/{x}/{y}.png?key={key}'
    let u = MAPTILER_TILE_URL_TEMPLATE
      .replace('{style}', MAPTILER_STYLE)
      .replace('{key}', MAPTILER_KEY);
    return u;
  }, [canUseTiles]);

  const handleTileError = (e) => {
    // Any tile error disables tiles for this MapView instance to ensure user sees base map.
    errorCountRef.current += 1;
    console.warn('UrlTile error:', e?.nativeEvent || e);
    if (errorCountRef.current >= 1) {
      setTilesOk(false);
    }
  };

  return (
    <MapView ref={ref} style={[StyleSheet.absoluteFillObject, style]}
    {...props}>
      {urlTemplate ? (
        <UrlTile
          urlTemplate={urlTemplate}
          // Keep Google/Apple base under our tiles so the map never appears blank
          // (do NOT set shouldReplaceMapContent here)
          maximumZ={MAPTILER_MAX_Z || 19}
          tileSize={MAPTILER_TILE_SIZE || 256}
          zIndex={-1}
          onError={handleTileError}
        />
      ) : null}
      {children}
    </MapView>
  );
});

export default MapBase;
