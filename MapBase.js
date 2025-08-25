// MapBase.js
import React, { forwardRef, useMemo, useRef, useState } from 'react';
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
 * Shared Map wrapper with robust fallbacks.
 *
 * Props:
 * - tilesEnabled?: boolean (default true; obeys USE_MAP_TILES and auto-fallback on errors)
 * - tileShouldReplace?: boolean (default false) — if true, UrlTile replaces base map
 * - tileZIndex?: number (default -1)
 * - style?: any (defaults to {flex:1})
 * - ...rest are passed to MapView
 */
const MapBase = forwardRef(function MapBase(
  { tilesEnabled = true, tileShouldReplace = false, tileZIndex = -1, style, children, ...props },
  ref
) {
  const [tilesOk, setTilesOk] = useState(true);
  const errorCountRef = useRef(0);

  const mergedStyle = useMemo(() => [{ flex: 1 }, style], [style]);

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
    return MAPTILER_TILE_URL_TEMPLATE
      .replace('{style}', MAPTILER_STYLE)
      .replace('{key}', MAPTILER_KEY);
  }, [canUseTiles]);

  const handleTileError = (e) => {
    errorCountRef.current += 1;
    console.warn('UrlTile error:', e?.nativeEvent || e);
    if (errorCountRef.current >= 1) setTilesOk(false);
  };

  return (
    <MapView ref={ref} style={mergedStyle} {...props}>
      {urlTemplate ? (
        <UrlTile
          urlTemplate={urlTemplate}
          maximumZ={MAPTILER_MAX_Z || 19}
          tileSize={MAPTILER_TILE_SIZE || 256}
          zIndex={tileZIndex}
          shouldReplaceMapContent={tileShouldReplace}
          onError={handleTileError}
        />
      ) : null}
      {children}
    </MapView>
  );
});

export default MapBase;
