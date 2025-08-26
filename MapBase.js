// MapBase.js
import React, { forwardRef, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import MapView, { UrlTile, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  USE_MAP_TILES,
  MAPTILER_TILE_URL_TEMPLATE,
  MAPTILER_STYLE,
  MAPTILER_TILE_SIZE,
  MAPTILER_MAX_Z,
  MAPTILER_KEY,
} from './config';

/**
 * Shared Map wrapper with robust fallbacks + preview knobs.
 *
 * Props:
 * - tilesEnabled?: boolean (default true; if false, no UrlTile)
 * - liteMode?: boolean (Android-only; static/lite map ideal for list thumbnails)
 * - cacheEnabled?: boolean (Android snapshot caching; default true when liteMode)
 * - provider?: override map provider; auto to GOOGLE when liteMode on Android
 * - plus all MapView props (children, style, initialRegion, etc.)
 */
const MapBase = forwardRef(function MapBase(
  {
    tilesEnabled = true,
    liteMode = false,
    cacheEnabled,
    provider: providerProp,
    style,
    children,
    ...rest
  },
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
    return MAPTILER_TILE_URL_TEMPLATE
      .replace('{style}', MAPTILER_STYLE)
      .replace('{key}', MAPTILER_KEY);
  }, [canUseTiles]);

  const handleTileError = (e) => {
    errorCountRef.current += 1;
    console.warn('UrlTile error:', e?.nativeEvent || e);
    if (errorCountRef.current >= 1) {
      setTilesOk(false);
    }
  };

  // Force Google provider when using liteMode on Android (required for reliability)
  const providerValue =
    liteMode && Platform.OS === 'android' ? PROVIDER_GOOGLE : providerProp;

  const mapProps = {
    ref,
    style,
    provider: providerValue,
    // Lite/static map is Android-only; ignored elsewhere
    liteMode: liteMode && Platform.OS === 'android',
    cacheEnabled:
      cacheEnabled !== undefined
        ? cacheEnabled
        : Platform.OS === 'android' && liteMode,
    ...rest,
  };

  return (
    <MapView {...mapProps}>
      {urlTemplate ? (
        <UrlTile
          urlTemplate={urlTemplate}
          // Keep native base under our tiles so it never appears blank
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
