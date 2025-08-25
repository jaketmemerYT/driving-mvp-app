// TrailList.js
import React, {
  useEffect, useState, useContext, useCallback, useMemo, memo, useRef,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ScrollView, Button, Platform,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { Svg, Polyline as SvgPolyline, Circle as SvgCircle } from 'react-native-svg';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

import { API_BASE } from './config';
import { UserContext } from './UserContext';

// ---------- math helpers ----------
const M_PER_DEG_LAT = 111132; // good enough for small spans
function metersPerDegLon(latDeg) {
  const r = Math.cos((latDeg * Math.PI) / 180);
  return M_PER_DEG_LAT * Math.max(0.000001, r); // avoid divide-by-zero near poles
}
function fitRegionToBox(points, boxW, boxH, { padRatio = 0.12, minSpanM = 40 } = {}) {
  if (!Array.isArray(points) || points.length === 0 || boxW <= 0 || boxH <= 0) {
    return { latitude: 0, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };
  }
  const lats = points.map(p => +p.latitude).filter(Number.isFinite);
  const lons = points.map(p => +p.longitude).filter(Number.isFinite);
  if (!lats.length || !lons.length) {
    return { latitude: 0, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };
  }
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const latC = (minLat + maxLat) / 2;
  const mPerLon = metersPerDegLon(latC);

  let heightM = Math.max((maxLat - minLat) * M_PER_DEG_LAT, minSpanM);
  let widthM  = Math.max((maxLon - minLon) * mPerLon,        minSpanM);

  heightM *= (1 + padRatio);
  widthM  *= (1 + padRatio);

  const boxAR = boxW / boxH;
  const curAR = widthM / heightM;
  if (curAR < boxAR) widthM = heightM * boxAR; else heightM = widthM / boxAR;

  return {
    latitude: latC,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: heightM / M_PER_DEG_LAT,
    longitudeDelta: widthM / mPerLon,
  };
}
function mercY(latDeg) {
  const rad = (latDeg * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}
function projectLatLngToXY(lat, lon, region, width, height) {
  const left = region.longitude - region.longitudeDelta / 2;
  const right = region.longitude + region.longitudeDelta / 2;
  const topLat = region.latitude + region.latitudeDelta / 2;
  const botLat = region.latitude - region.latitudeDelta / 2;
  const x = ((lon - left) / (right - left)) * width;
  const topY = mercY(topLat);
  const botY = mercY(botLat);
  const y = ((topY - mercY(lat)) / (topY - botY)) * height;
  return { x, y };
}

// --------- list thumbnail with safe overlay ----------
const ListMapPreview = memo(function ListMapPreview({ pointsForFit, route, start, end, strokeColor = '#000' }) {
  const mapRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [region, setRegion] = useState(null);
  const [pixRoute, setPixRoute] = useState(null);
  const [pixStart, setPixStart] = useState(null);
  const [pixEnd, setPixEnd] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  const isAndroid = Platform.OS === 'android';
  // Never use pointForCoordinate on Android (lite mode) — native crash risk.
  const useNativeProjection = !isAndroid;

  // derive region when size/points change
  useEffect(() => {
    if (box.w > 0 && box.h > 0) {
      const fit = fitRegionToBox(pointsForFit, box.w, box.h, { padRatio: 0.12, minSpanM: 40 });
      setRegion(fit);
    } else {
      setRegion(null);
    }
    setPixRoute(null); setPixStart(null); setPixEnd(null);
  }, [box.w, box.h, pointsForFit]);

  // Projection: iOS -> native pixels; Android -> math fallback (aspect-corrected)
  useEffect(() => {
    let cancelled = false;
    async function project() {
      if (!region || box.w <= 0 || box.h <= 0) return;

      if (useNativeProjection) {
        if (!mapRef.current || !mapReady) return;
        try {
          // tiny delay lets camera settle
          await new Promise(r => setTimeout(r, 60));
          const rPix = route?.length
            ? await Promise.all(route.map(async (p) => {
                const { x, y } = await mapRef.current.pointForCoordinate({ latitude: p.latitude, longitude: p.longitude });
                return `${x},${y}`;
              }))
            : [];
          const sPix = start
            ? await mapRef.current.pointForCoordinate(start).then(({ x, y }) => ({ x, y })) : null;
          const ePix = end
            ? await mapRef.current.pointForCoordinate(end).then(({ x, y }) => ({ x, y })) : null;
          if (!cancelled) { setPixRoute(rPix); setPixStart(sPix); setPixEnd(ePix); }
        } catch {
          // fall back to math if native projection fails
          const rPix = route?.length
            ? route.map(p => {
                const { x, y } = projectLatLngToXY(p.latitude, p.longitude, region, box.w, box.h);
                return `${x},${y}`;
              })
            : [];
          const sPix = start ? projectLatLngToXY(start.latitude, start.longitude, region, box.w, box.h) : null;
          const ePix = end   ? projectLatLngToXY(end.latitude, end.longitude, region, box.w, box.h)   : null;
          if (!cancelled) { setPixRoute(rPix); setPixStart(sPix); setPixEnd(ePix); }
        }
      } else {
        // Android: pure math (safe)
        const rPix = route?.length
          ? route.map(p => {
              const { x, y } = projectLatLngToXY(p.latitude, p.longitude, region, box.w, box.h);
              return `${x},${y}`;
            })
          : [];
        const sPix = start ? projectLatLngToXY(start.latitude, start.longitude, region, box.w, box.h) : null;
        const ePix = end   ? projectLatLngToXY(end.latitude, end.longitude, region, box.w, box.h)   : null;
        if (!cancelled) { setPixRoute(rPix); setPixStart(sPix); setPixEnd(ePix); }
      }
    }
    project();
    return () => { cancelled = true; };
  }, [useNativeProjection, mapReady, region, box.w, box.h, route, start, end]);

  return (
    <View
      style={styles.previewWrap}
      onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {region && (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.previewMap}
          initialRegion={region}
          liteMode={Platform.OS === 'android'}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          pointerEvents="none"
          mapPadding={{ top: 1, left: 1, right: 1, bottom: 1 }}
          renderToHardwareTextureAndroid
          onMapReady={() => setMapReady(true)}
        />
      )}
      {box.w > 0 && box.h > 0 && pixRoute && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFillObject}>
          {pixRoute.length > 1 && (
            <SvgPolyline
              points={pixRoute.join(' ')}
              fill="none"
              stroke={strokeColor}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {pixStart && <SvgCircle cx={pixStart.x} cy={pixStart.y} r={4} fill="#2E7D32" />}
          {pixEnd   && <SvgCircle cx={pixEnd.x}   cy={pixEnd.y}   r={4} fill="#D32F2F" />}
        </Svg>
      )}
    </View>
  );
});

// -------------- main list --------------
export default function TrailList({ navigation }) {
  const { prefs } = useContext(UserContext);

  const [trails, setTrails] = useState([]);
  const [categories, setCategories] = useState([]);
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [filterCatIds, setFilterCatIds] = useState([]);

  const officialColor = prefs?.officialRouteColor || '#000';

  const visibleTrails = useMemo(() => {
    if (!filterCatIds.length) return trails;
    return trails.filter((t) => {
      const cats = trailCatsMap[t.id] || [];
      return cats.some((cid) => filterCatIds.includes(cid));
    });
  }, [trails, trailCatsMap, filterCatIds]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const tRes = await axios.get(`${API_BASE}/api/trailheads`);
          if (cancelled) return;
          const tData = tRes.data || [];
          setTrails(tData);

          const cRes = await axios.get(`${API_BASE}/api/categories`).catch(() => ({ data: [] }));
          if (!cancelled) setCategories(cRes.data || []);

          const tcMap = {};
          await Promise.all(
            tData.map(async (t) => {
              try {
                const resp = await axios.get(`${API_BASE}/api/trailheads/${t.id}/categories`);
                tcMap[t.id] = (resp.data || []).map((c) => c.id);
              } catch {
                tcMap[t.id] = [];
              }
            })
          );
          if (!cancelled) setTrailCatsMap(tcMap);
        } catch (e) {
          console.error('TrailList load error', e?.message || e);
          if (!cancelled) {
            setTrails([]); setCategories([]); setTrailCatsMap({});
          }
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  return (
    <View style={styles.container}>
      {!!categories.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContainer}>
          {categories.map((cat) => {
            const sel = filterCatIds.includes(cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, sel && styles.chipSelected]}
                onPress={() =>
                  setFilterCatIds(sel ? filterCatIds.filter((x) => x !== cat.id) : [...filterCatIds, cat.id])
                }
              >
                <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
          <Button title="Clear" onPress={() => setFilterCatIds([])} />
        </ScrollView>
      )}

      {visibleTrails.length === 0 ? (
        <Text style={styles.empty}>No trails to show.</Text>
      ) : (
        <FlatList
          data={visibleTrails}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={false}
          initialNumToRender={10}
          windowSize={7}
          renderItem={({ item }) => {
            const start = item.coords || null;
            const end   = item.endCoords || null;
            const route = Array.isArray(item.route) ? item.route : [];
            const pointsForFit = route.length >= 2 ? route : [start, end].filter(Boolean);
            const catIds = trailCatsMap[item.id] || [];

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('TrailDetail', { trailId: item.id, trailName: item.name })}
                activeOpacity={0.85}
              >
                <Text style={styles.title}>{item.name}</Text>
                <Text style={styles.dim}>Difficulty: {item.difficulty || 'Unknown'}</Text>

                {!!catIds.length && (
                  <View style={styles.badgesRow}>
                    {catIds.map((cid) => {
                      const cat = categories.find((c) => c.id === cid);
                      return cat ? (
                        <View key={cid} style={styles.badge}>
                          <Text style={styles.badgeText}>{cat.name}</Text>
                        </View>
                      ) : null;
                    })}
                  </View>
                )}

                <ListMapPreview
                  pointsForFit={pointsForFit}
                  route={route}
                  start={start}
                  end={end}
                  strokeColor={officialColor}
                />

                <Text style={styles.dimSmall}>
                  {route.length} points • {new Date().toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  chipScroll: { maxHeight: 44, marginVertical: 6 },
  chipContainer: { paddingHorizontal: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#EEE', marginHorizontal: 4 },
  chipSelected: { backgroundColor: '#007AFF' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#FFF' },

  card: { marginHorizontal: 12, marginVertical: 8, padding: 12, borderRadius: 12, backgroundColor: '#fff' },
  title: { fontSize: 16, fontWeight: '600' },
  dim: { color: '#666', marginTop: 2 },
  dimSmall: { color: '#888', marginTop: 6, fontSize: 12 },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  badge: { backgroundColor: '#DDD', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginRight: 4, marginBottom: 4 },
  badgeText: { fontSize: 12, color: '#333' },

  // Rounded ONLY on wrapper; map is full-rect
  previewWrap: { height: 130, marginTop: 8, borderRadius: 10, overflow: 'hidden' },
  previewMap: { ...StyleSheet.absoluteFillObject },

  empty: { textAlign: 'center', marginTop: 24, color: '#666' },
});
