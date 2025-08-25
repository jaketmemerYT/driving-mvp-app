// MapBase.js
import React, { forwardRef } from 'react';
import MapView, { UrlTile, PROVIDER_GOOGLE } from 'react-native-maps';
import { MAP_TILER_KEY, MAP_TILER_STYLE, MAP_TILER_ATTRIBUTION } from './config';

/**
 * Shared map wrapper that:
 * - Renders MapTiler tiles if a key is present; otherwise falls back to the native base map
 * - Keeps a consistent look across screens
 *
 * Props:
 * - children: markers/polylines/etc
 * - initialRegion / region / onPress ... (pass-through to MapView)
 * - mapType: 'standard' | 'none' | 'satellite' etc (optional; defaults to 'standard')
 * - showTiles: boolean to toggle tiles (default true)
 */
const MapBase = forwardRef(({ children, mapType = 'standard', showTiles = true, ...rest }, ref) => {
  const hasTiles = !!MAP_TILER_KEY && !!MAP_TILER_STYLE;
  return (
    <MapView
      ref={ref}
      style={{ flex: 1 }}
      provider={PROVIDER_GOOGLE}
      mapType={mapType}
      {...rest}
    >
      {showTiles && hasTiles && (
        <UrlTile
          urlTemplate={`${MAP_TILER_STYLE}?key=${MAP_TILER_KEY}`}
          maximumZ={20}
          shouldReplaceMapContent
          tileCachePath={undefined}
          tileCacheMaxAge={0}
          zIndex={-1}
        />
      )}
      {children}
    </MapView>
  );
});

export default MapBase;
