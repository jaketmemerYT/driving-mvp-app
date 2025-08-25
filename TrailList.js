// TrailList.js
import React, {
  useEffect,
  useState,
  useContext,
  useCallback,
  useMemo,
  memo,
  useRef,
} from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Button,
  Image,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

import MapBase from './MapBase';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

// In-memory snapshot cache for thumbnails (keyed by geometry/version)
const thumbCache = new Map(); // mapVersion -> file:// URI

// Compute a stable padded region from points (no native fit → no flicker)
function regionFromPoints(points, { padRatio = 0.12, minSpanDeg = 0.002 } = {}) {
  if (!Array.isArray(points) || points.length === 0) {
    return { latitude: 0, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };
  }
  const lats = points.map(p => +p.latitude).filter(Number.isFinite);
  const lons = points.map(p => +p.longitude).filter(Number.isFinite);
  if (lats.length === 0 || lons.length === 0) {
    return { latitude: 0, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };
  }
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  let dLat = Math.max(maxLat - minLat, minSpanDeg);
  let dLon = Math.max(maxLon - minLon, minSpanDeg);
  dLat *= (1 + padRatio);
  dLon *= (1 + padRatio);
  const lat = (minLat + maxLat) / 2;
  const lon = (minLon + maxLon) / 2;
  return { latitude: lat, longitude: lon, latitudeDelta: dLat, longitudeDelta: dLon };
}

export default function TrailList({ navigation }) {
  const { prefs } = useContext(UserContext);

  const [trails, setTrails] = useState(null);
  const [categories, setCategories] = useState([]);
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [filterCatIds, setFilterCatIds] = useState([]);

  const officialColor = prefs?.officialRouteColor || '#000000';

  // Load data on focus so lists refresh after adds
  useFocusEffect(
    useCallback(() => {
      let canceled = false;
      const load = async () => {
        try {
          const [tRes, cRes] = await Promise.all([
            axios.get(`${API_BASE}/api/trailheads`),
            axios.get(`${API_BASE}/api/categories`),
          ]);
          if (canceled) return;

          setTrails(tRes.data);
          setCategories(cRes.data || []);

          // Build a map of trailId -> [categoryIds]
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
          if (!canceled) setTrailCatsMap(tcMap);
        } catch (e) {
          console.error(e);
        }
      };
      load();
      return () => { canceled = true; };
    }, [])
  );

  if (!trails) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const visibleTrails = trails.filter((t) => {
    if (filterCatIds.length === 0) return true;
    const cats = trailCatsMap[t.id] || [];
    return cats.some((cid) => filterCatIds.includes(cid));
  });

  return (
    <View style={styles.container}>
      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContainer}
      >
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
        {categories.length > 0 && (
          <Button title="Clear" onPress={() => setFilterCatIds([])} />
        )}
      </ScrollView>

      {visibleTrails.length === 0 ? (
        <Text style={styles.empty}>No trails match the current filters.</Text>
      ) : (
        <FlatList
          data={visibleTrails}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={false} // keep mounted to avoid map remount churn
          windowSize={7}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          renderItem={({ item }) => {
            const catIds = trailCatsMap[item.id] || [];
            return (
              <TrailCard
                item={item}
                categories={categories}
                catIds={catIds}
                officialColor={officialColor}
                onPress={() =>
                  navigation.navigate('TrailDetail', {
                    trailId: item.id,
                    trailName: item.name,
                  })
                }
              />
            );
          }}
        />
      )}
    </View>
  );
}

const TrailCard = memo(function TrailCard({ item, categories, catIds, officialColor, onPress }) {
  const start = item.coords || null;
  const end   = item.endCoords || null;
  const route = Array.isArray(item.route) ? item.route : [];

  const pointsForRegion = useMemo(
    () => (route.length >= 2 ? route : [start, end].filter(Boolean)),
    [route, start, end]
  );

  const previewRegion = useMemo(
    () => regionFromPoints(pointsForRegion, { padRatio: 0.12, minSpanDeg: 0.002 }),
    [pointsForRegion]
  );

  // Geometry-based version key → only regenerate snapshot when this changes
  const mapVersion = useMemo(() => {
    const s = start ? `${start.latitude.toFixed(5)},${start.longitude.toFixed(5)}` : '-';
    const e = end   ? `${end.latitude.toFixed(5)},${end.longitude.toFixed(5)}`       : '-';
    const rlen = route.length;
    const rlast = rlen ? `${route[rlen-1].latitude.toFixed(5)},${route[rlen-1].longitude.toFixed(5)}` : '-';
    return `${item.id}|${rlen}|${rlast}|${s}|${e}`;
  }, [item.id, start, end, route]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.dim}>Difficulty: {item.difficulty || 'Unknown'}</Text>

      {/* Category badges */}
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

      <StaticThumbnail
        region={previewRegion}
        start={start}
        end={end}
        route={route}
        strokeColor={officialColor}
        mapVersion={mapVersion}
      />

      <Text style={styles.dimSmall}>
        {route.length} points • {new Date().toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );
});

const StaticThumbnail = memo(function StaticThumbnail({ region, start, end, route, strokeColor, mapVersion }) {
  const mapRef = useRef(null);
  const [size, setSize] = useState(null);
  const [loaded, setLoaded] = useState(false);     // onMapLoaded (tiles drawn)
  const [uri, setUri] = useState(() => thumbCache.get(mapVersion) || null);

  useEffect(() => {
    if (thumbCache.has(mapVersion)) setUri(thumbCache.get(mapVersion));
    else setUri(null);
  }, [mapVersion]);

  // Try snapshot after map reports loaded + we have layout.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (uri || !loaded || !size || !mapRef.current) return;
      try {
        // tiny delay helps ensure polylines/markers are actually painted
        await new Promise(r => setTimeout(r, 120));
        const snap = await mapRef.current.takeSnapshot({
          width: Math.max(1, Math.round(size.width)),
          height: Math.max(1, Math.round(size.height)),
          format: 'png',
          quality: 1,
          result: 'file',
        });
        if (!cancelled && snap) {
          thumbCache.set(mapVersion, snap);
          setUri(snap);
        }
      } catch (e) {
        console.warn('Thumbnail snapshot failed:', e?.message || e);
      }
    })();
    return () => { cancelled = true; };
  }, [uri, loaded, size, mapVersion]);

  return (
    <View style={styles.previewWrap} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {uri ? (
        <Image source={{ uri }} style={styles.previewMap} resizeMode="cover" />
      ) : (
        <MapBase
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          initialRegion={region}
          tilesEnabled={false}
          // Important: for the snapshot phase, avoid cacheEnabled (can show beige on some builds)
          cacheEnabled={false}
          liteMode={false}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          pointerEvents="none"
          style={styles.previewMap}
          onMapLoaded={() => setLoaded(true)}
        >
          {start && <Marker coordinate={start} tracksViewChanges={false} />}
          {end && <Marker coordinate={end} pinColor="green" tracksViewChanges={false} />}
          {route.length > 1 && (
            <Polyline
              coordinates={route.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
              strokeWidth={3}
              strokeColor={strokeColor}
            />
          )}
        </MapBase>
      )}
    </View>
  );
}, (prev, next) => prev.mapVersion === next.mapVersion);

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  chipScroll: { maxHeight: 44, marginVertical: 6 },
  chipContainer: { paddingHorizontal: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#EEE',
    marginHorizontal: 4,
  },
  chipSelected: { backgroundColor: '#007AFF' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#FFF' },

  card: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
  },
  title: { fontSize: 16, fontWeight: '600' },
  dim: { color: '#666', marginTop: 2 },
  dimSmall: { color: '#888', marginTop: 6, fontSize: 12 },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  badge: {
    backgroundColor: '#DDD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  badgeText: { fontSize: 12, color: '#333' },

  previewWrap: { height: 130, marginTop: 8, borderRadius: 10 },
  previewMap: { ...StyleSheet.absoluteFillObject, borderRadius: 10, overflow: 'hidden' },
});
