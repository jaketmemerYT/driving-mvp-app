// TrailList.js
import React, { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Button,
  Platform,
} from 'react-native';
import { Polyline } from 'react-native-maps';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from './config';
import { useRouteColors } from './useRouteColors';
import MapThumbSnapshot from './MapThumbSnapshot';

const MAX_OFFICIAL_PTS = 300;

// --- helpers (no hooks) ---
function sampleLine(line = [], maxPts) {
  if (!Array.isArray(line) || line.length <= maxPts) return line || [];
  const step = Math.ceil(line.length / maxPts);
  const out = [];
  for (let i = 0; i < line.length; i += step) out.push(line[i]);
  const last = line[line.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
function regionFromCoords(points, padFrac = 0.12) {
  const pts = (points || []).filter(
    (p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number'
  );
  if (pts.length === 0) return null;
  if (pts.length === 1) {
    return {
      latitude: pts[0].latitude,
      longitude: pts[0].longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of pts) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLon) minLon = p.longitude;
    if (p.longitude > maxLon) maxLon = p.longitude;
  }
  const latSpan = Math.max(0.0005, maxLat - minLat);
  const lonSpan = Math.max(0.0005, maxLon - minLon);
  const padLat = latSpan * padFrac;
  const padLon = lonSpan * padFrac;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: latSpan + padLat * 2,
    longitudeDelta: lonSpan + padLon * 2,
  };
}

// --- memoized row component ---
const TrailRow = memo(function TrailRow({
  item,
  categories,
  catIds,
  officialColor,
  cacheKey,
  onPress,
}) {
  const start = item.coords;
  const end = item.endCoords;
  const route = Array.isArray(item.route) ? item.route : [];

  const sampledOfficial = sampleLine(route, MAX_OFFICIAL_PTS);

  const fitCoords = (() => {
    const arr = [];
    sampledOfficial.forEach((p) => arr.push({ latitude: p.latitude, longitude: p.longitude }));
    if (start) arr.push(start);
    if (end) arr.push(end);
    return arr;
  })();

  const previewRegion =
    regionFromCoords(fitCoords, 0.12) ||
    (start
      ? { latitude: start.latitude, longitude: start.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
      : { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.2, longitudeDelta: 0.2 });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.dim}>Difficulty: {item.difficulty || 'Unknown'}</Text>

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

      <View style={styles.previewWrap}>
        <MapThumbSnapshot
          region={previewRegion}
          fitCoords={fitCoords}
          style={styles.previewMap}
          cacheKey={cacheKey} // only official color included
        >
          {sampledOfficial.length > 1 && (
            <Polyline
              coordinates={sampledOfficial.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
              strokeWidth={3}
              strokeColor={officialColor}
            />
          )}
        </MapThumbSnapshot>
      </View>

      <Text style={styles.dimSmall}>
        {route.length} points • {new Date().toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );
});

export default function TrailList({ navigation }) {
  const { officialColor, signatureOfficial } = useRouteColors();

  const [trails, setTrails] = useState(null);
  const [categories, setCategories] = useState([]);
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [filterCatIds, setFilterCatIds] = useState([]);

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
          removeClippedSubviews={Platform.OS === 'android' ? false : undefined}
          windowSize={7}
          initialNumToRender={6}
          renderItem={({ item }) => {
            const catIds = trailCatsMap[item.id] || [];
            return (
              <TrailRow
                item={item}
                categories={categories}
                catIds={catIds}
                officialColor={officialColor}
                cacheKey={`trail:${item.id}:${signatureOfficial}`} // <— only official color matters here
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

  previewWrap: { height: 130, marginTop: 8 },
  previewMap: { flex: 1, borderRadius: 10, overflow: 'hidden' },

  empty: { textAlign: 'center', marginTop: 32, color: '#666' },
});
