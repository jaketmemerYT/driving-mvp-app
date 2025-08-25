// RunList.js
import React, {
  useState, useLayoutEffect, useContext, useCallback, useMemo, memo, useRef, useEffect,
} from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity,
  StyleSheet, Button, Platform,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { Svg, Polyline as SvgPolyline, Circle as SvgCircle } from 'react-native-svg';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

import { API_BASE } from './config';
import { UserContext } from './UserContext';

// --- shared helpers ---
const M_PER_DEG_LAT = 111132;
function metersPerDegLon(latDeg) {
  const r = Math.cos((latDeg * Math.PI) / 180);
  return M_PER_DEG_LAT * Math.max(0.000001, r);
}
function fitRegionToBox(points, boxW, boxH, { padRatio = 0.06, minSpanM = 40 } = {}) {
  if (!Array.isArray(points) || points.length === 0 || boxW <= 0 || boxH <= 0) {
    return { latitude: 0, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };
  }
  const lats = points.map(p => +p.latitude).filter(Number.isFinite);
  const lons = points.map(p => +p.longitude).filter(Number.isFinite);
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

const ListMapPreview = memo(function ListMapPreview({ coords = [], stroke = '#1E90FF' }) {
  const mapRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [region, setRegion] = useState(null);
  const [pixRoute, setPixRoute] = useState(null);
  const [pixStart, setPixStart] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  const isAndroid = Platform.OS === 'android';
  const useNativeProjection = !isAndroid; // iOS only

  useEffect(() => {
    if (box.w > 0 && box.h > 0) {
      setRegion(fitRegionToBox(coords, box.w, box.h, { padRatio: 0.06, minSpanM: 40 }));
    } else {
      setRegion(null);
    }
    setPixRoute(null); setPixStart(null);
  }, [box.w, box.h, coords]);

  useEffect(() => {
    let cancelled = false;
    async function project() {
      if (!region || box.w <= 0 || box.h <= 0 || coords.length === 0) return;

      if (useNativeProjection) {
        if (!mapRef.current || !mapReady) return;
        try {
          await new Promise(r => setTimeout(r, 60));
          const rPix = await Promise.all(coords.map(async (p) => {
            const { x, y } = await mapRef.current.pointForCoordinate({ latitude: p.latitude, longitude: p.longitude });
            return `${x},${y}`;
          }));
          const sPix = await mapRef.current.pointForCoordinate({ latitude: coords[0].latitude, longitude: coords[0].longitude });
          if (!cancelled) { setPixRoute(rPix); setPixStart(sPix); }
        } catch {
          const rPix = coords.map(p => {
            const { x, y } = projectLatLngToXY(p.latitude, p.longitude, region, box.w, box.h);
            return `${x},${y}`;
          });
          const sPix = projectLatLngToXY(coords[0].latitude, coords[0].longitude, region, box.w, box.h);
          if (!cancelled) { setPixRoute(rPix); setPixStart(sPix); }
        }
      } else {
        // Android safe path
        const rPix = coords.map(p => {
          const { x, y } = projectLatLngToXY(p.latitude, p.longitude, region, box.w, box.h);
          return `${x},${y}`;
        });
        const sPix = projectLatLngToXY(coords[0].latitude, coords[0].longitude, region, box.w, box.h);
        if (!cancelled) { setPixRoute(rPix); setPixStart(sPix); }
      }
    }
    project();
    return () => { cancelled = true; };
  }, [useNativeProjection, mapReady, region, box.w, box.h, coords]);

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
              stroke={stroke}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {pixStart && <SvgCircle cx={pixStart.x} cy={pixStart.y} r={4} fill="#2E7D32" />}
        </Svg>
      )}
    </View>
  );
});

export default function RunList({ navigation }) {
  const { user, prefs } = useContext(UserContext);

  const [runs, setRuns] = useState([]);
  const [trailsMap, setTrailsMap] = useState({});
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [filterCatIds, setFilterCatIds] = useState([]);

  const liveColor = prefs?.liveRouteColor || '#1E90FF';

  const visibleRuns = useMemo(() => {
    return runs.filter((r) => {
      const tCats = trailCatsMap[r.trailId] || [];
      const groupOk = selectedGroup?.categoryIds?.length
        ? tCats.some((id) => selectedGroup.categoryIds.includes(id))
        : true;
      const manualOk = filterCatIds.length
        ? tCats.some((id) => filterCatIds.includes(id))
        : true;
      return groupOk && manualOk;
    });
  }, [runs, trailCatsMap, selectedGroup, filterCatIds]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'My Runs',
      headerRight: () => <Button title="New Run" onPress={() => navigation.navigate('AddRun')} />,
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [rRes, tRes, cRes, gRes] = await Promise.all([
            axios.get(`${API_BASE}/api/routes`, { params: { userId: user?.id || '' } }),
            axios.get(`${API_BASE}/api/trailheads`),
            axios.get(`${API_BASE}/api/categories`).catch(() => ({ data: [] })),
            axios.get(`${API_BASE}/api/groups`).catch(() => ({ data: [] })),
          ]);
          if (cancelled) return;

          const sortedRuns = (rRes.data || []).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setRuns(sortedRuns);

          const tMap = {};
          (tRes.data || []).forEach((t) => (tMap[t.id] = t.name));
          setTrailsMap(tMap);

          setCategories(cRes.data || []);
          const grps = gRes.data || [];
          setGroups(grps);
          if (grps.length > 0) {
            setSelectedGroup(grps[0]);
            setFilterCatIds(grps[0].categoryIds || []);
          }

          const tcMap = {};
          await Promise.all(
            (tRes.data || []).map(async (t) => {
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
          console.error('RunList load error', e?.message || e);
          if (!cancelled) {
            setRuns([]); setTrailsMap({}); setCategories([]); setGroups([]); setTrailCatsMap({});
          }
        }
      })();
      return () => { cancelled = true; };
    }, [user?.id])
  );

  return (
    <View style={styles.container}>
      {!!groups.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContainer}>
          {groups.map((g) => {
            const sel = selectedGroup?.id === g.id;
            return (
              <TouchableOpacity
                key={g.id}
                style={[styles.chip, sel && styles.chipSelected]}
                onPress={() => {
                  setSelectedGroup(g);
                  setFilterCatIds(g.categoryIds || []);
                }}
              >
                <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{g.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

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

      {visibleRuns.length === 0 ? (
        <Text style={styles.empty}>No runs to show.</Text>
      ) : (
        <FlatList
          data={visibleRuns}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={false}
          initialNumToRender={10}
          windowSize={7}
          renderItem={({ item }) => {
            const coords = Array.isArray(item.coords) ? item.coords : [];
            const trailName = trailsMap[item.trailId] || 'Trail';

            return (
              <TouchableOpacity
                style={styles.item}
                onPress={() => navigation.navigate('RunDetail', { run: item, trailName })}
              >
                <Text style={styles.title}>{trailName}</Text>
                <ListMapPreview coords={coords} stroke={liveColor} />
                <Text style={styles.subtitle}>
                  {new Date(item.timestamp || coords[0]?.timestamp || Date.now()).toLocaleString()} • {Math.round(item.duration || 0)}s
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

  chipScroll: { maxHeight: 40, marginVertical: 4 },
  chipContainer: { paddingHorizontal: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#EEE', marginHorizontal: 4 },
  chipSelected: { backgroundColor: '#007AFF' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#FFF' },

  item: { padding: 16, borderBottomWidth: 1, borderColor: '#EEE' },
  title: { fontSize: 16, fontWeight: 'bold' },

  // Rounded ONLY on wrapper
  previewWrap: { height: 110, marginVertical: 8, borderRadius: 8, overflow: 'hidden' },
  previewMap: { ...StyleSheet.absoluteFillObject },

  subtitle: { color: '#666' },

  empty: { textAlign: 'center', marginTop: 24, color: '#666' },
});
