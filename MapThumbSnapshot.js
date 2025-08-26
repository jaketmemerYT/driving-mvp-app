// MapThumbSnapshot.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import MapView, { UrlTile } from 'react-native-maps';
import {
  USE_MAP_TILES,
  MAPTILER_TILE_URL_TEMPLATE,
  MAPTILER_STYLE,
  MAPTILER_TILE_SIZE,
  MAPTILER_MAX_Z,
  MAPTILER_KEY,
} from './config';

// simple in-memory cache: cacheKey -> { uri, w, h }
const memorySnapCache = new Map();

function edgePaddingFor(size, frac = 0.12) {
  const top = Math.max(8, Math.round(size.height * frac));
  const left = Math.max(8, Math.round(size.width * frac));
  return { top, left, right: left, bottom: top };
}

export default function MapThumbSnapshot({
  region,
  fitCoords = [],
  style,
  children,
  cacheKey,        // IMPORTANT: include colors/thresholds etc in this key
  delayMs = 150,   // wait a tick for tiles/overlays before snapshot
}) {
  const mapRef = useRef(null);
  const viewRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageUri, setImageUri] = useState(null);
  const [ready, setReady] = useState(false);

  // pull from cache (if present) immediately
  useEffect(() => {
    const cached = cacheKey ? memorySnapCache.get(cacheKey) : null;
    if (cached) {
      setImageUri(cached.uri);
      setReady(true);
    } else {
      setImageUri(null);
      setReady(false);
    }
  }, [cacheKey]);

  // Once laid out + ready and not cached, fit & snapshot
  useEffect(() => {
    if (!mapRef.current || !size.width || !size.height) return;
    if (imageUri) return; // already showing cached
    let cancelled = false;

    const doFitThenSnap = async () => {
      try {
        // Fit to coords if provided
        if (fitCoords && fitCoords.length > 1) {
          const pad = edgePaddingFor(size, 0.12);
          mapRef.current.fitToCoordinates(fitCoords, { edgePadding: pad, animated: false });
        }

        // small pause for tiles/overlays to settle
        await new Promise((r) => setTimeout(r, Platform.OS === 'android' ? delayMs + 100 : delayMs));

        if (cancelled) return;

        // take snapshot
        const uri = await mapRef.current.takeSnapshot({
          width: size.width,
          height: size.height,
          region: undefined, // we already positioned via fit
          result: 'file',
          format: 'png',
          quality: 1,
        });

        if (cancelled) return;
        setImageUri(uri);
        setReady(true);
        if (cacheKey) {
          memorySnapCache.set(cacheKey, { uri, w: size.width, h: size.height });
        }
      } catch (e) {
        // If snapshot fails, leave map visible as fallback
        setReady(true);
      }
    };

    // wait for onMapReady tick
    const id = setTimeout(doFitThenSnap, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [fitCoords, size.width, size.height, imageUri, cacheKey, delayMs]);

  // Build tile url (optional)
  const canUseTiles =
    !!USE_MAP_TILES && !!MAPTILER_TILE_URL_TEMPLATE && !!MAPTILER_STYLE && !!MAPTILER_KEY;
  const urlTemplate = canUseTiles
    ? MAPTILER_TILE_URL_TEMPLATE.replace('{style}', MAPTILER_STYLE).replace('{key}', MAPTILER_KEY)
    : null;

  return (
    <View
      ref={viewRef}
      style={[styles.wrap, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout || {};
        if (width && height) setSize({ width: Math.round(width), height: Math.round(height) });
      }}
    >
      {/* If we have an image, just show it (no flicker) */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}

      {/* Keep a live map underneath until snapshot completes (or as fallback) */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region || undefined}
        pointerEvents={imageUri ? 'none' : 'auto'}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapReady={() => setReady(true)}
      >
        {urlTemplate ? (
          <UrlTile
            urlTemplate={urlTemplate}
            maximumZ={MAPTILER_MAX_Z || 19}
            tileSize={MAPTILER_TILE_SIZE || 256}
            zIndex={-1}
            onError={() => {}}
          />
        ) : null}
        {children}
      </MapView>

      {!imageUri && !ready && (
        <View style={styles.spinner}>
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#f2f2f2', borderRadius: 8 },
  spinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
