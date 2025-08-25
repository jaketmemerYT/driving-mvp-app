// MapBase.js
import React, { forwardRef, useMemo, useRef, useState, memo } from 'react';
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
 * - style?: ViewStyle (default fills parent via absoluteFillObject)
 * - children, initialRegion, region, onPress, etc. (same as MapView)
 */
const MapBaseInner = forwardRef(function MapBase(
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
    let u = MAPTILER_TILE_URL_TEMPLATE
      .replace('{style}', MAPTILER_STYLE)
      .replace('{key}', MAPTILER_KEY);
    return u;
  }, [canUseTiles]);

  const handleTileError = (e) => {
    errorCountRef.current += 1;
    console.warn('UrlTile error:', e?.nativeEvent || e);
    if (errorCountRef.current >= 1) setTilesOk(false);
  };

  return (
    <MapView ref={ref} style={[StyleSheet.absoluteFillObject, style]} {...props}>
      {urlTemplate ? (
        <UrlTile
          urlTemplate={urlTemplate}
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

// Memoize to avoid re-rendering the Map when parent re-renders with identical props
const MapBase = memo(MapBaseInner);
export default MapBase;
