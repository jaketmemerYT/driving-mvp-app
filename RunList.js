// RunList.js
import React, { useState, useLayoutEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Button,
  Platform,
} from 'react-native';
import { Polyline } from 'react-native-maps';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from './config';
import { useRouteColors } from './useRouteColors';
import { buildDeviationSegments } from './geoUtils';
import MapThumbSnapshot from './MapThumbSnapshot';

const MAX_RUN_PTS = 300;
const MAX_OFFICIAL_PTS = 200;

// helpers (no hooks)
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

// memoized row
const RunRow = memo(function RunRow({
  item,
  trailName,
  official,
  tCats,
  categories,
  colors,   // {liveColor, officialColor, warn1Color, warn2Color, warningThreshold1, warningThreshold2}
  cacheKey, // signatureRunThumb
  onPress,
}) {
  const coords = Array.isArray(item.coords) ? item.coords : [];

  const sampledRun = sampleLine(coords, MAX_RUN_PTS);
  const sampledOfficial = sampleLine(official, MAX_OFFICIAL_PTS);

  const fitCoords = (() => {
    const combo = [];
    sampledRun.forEach((p) => combo.push({ latitude: p.latitude, longitude: p.longitude }));
    sampledOfficial.forEach((p) => combo.push({ latitude: p.latitude, longitude: p.longitude }));
    return combo;
  })();

  const previewRegion =
    regionFromCoords(fitCoords, 0.12) ||
    (sampledRun[0]
      ? { latitude: sampledRun[0].latitude, longitude: sampledRun[0].longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
      : { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.2, longitudeDelta: 0.2 });

  const coloredSegments =
    sampledRun.length > 0
      ? buildDeviationSegments(sampledRun, sampledOfficial, {
          liveRouteColor: colors.liveColor,
          warningColor1: colors.warn1Color,
          warningColor2: colors.warn2Color,
          warningThreshold1: colors.warningThreshold1,
          warningThreshold2: colors.warningThreshold2,
        })
      : [];

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.title}>{trailName}</Text>

      <View style={styles.badgesRow}>
        {tCats.map((cid) => (
          <View style={styles.badge} key={cid}>
            <Text style={styles.badgeText}>{categories.find((c) => c.id === cid)?.name}</Text>
          </View>
        ))}
      </View>

      {coords.length > 0 && (
        <View style={styles.previewWrap}>
          <MapThumbSnapshot
            region={previewRegion}
            fitCoords={fitCoords}
            style={styles.previewMap}
            cacheKey={cacheKey} // depends on live/warn/critical colors + thresholds
          >
            {sampledOfficial.length > 1 && (
              <Polyline
                coordinates={sampledOfficial.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
                strokeWidth={3}
                strokeColor={colors.officialColor}
              />
            )}
            {coloredSegments.length > 0 ? (
              coloredSegments.map((seg, i) => (
                <Polyline key={`seg-${i}-${seg.color}`} coordinates={seg.coordinates} strokeWidth={3} strokeColor={seg.color} />
              ))
            ) : sampledRun.length > 1 ? (
              <Polyline
                coordinates={sampledRun.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
                strokeWidth={3}
                strokeColor={colors.liveColor}
              />
            ) : null}
          </MapThumbSnapshot>
        </View>
      )}

      <Text style={styles.subtitle}>
        {new Date(item.timestamp).toLocaleString()} • {Math.round(item.duration)}s
      </Text>
    </TouchableOpacity>
  );
});

export default function RunList({ navigation }) {
  const {
    liveColor,
    officialColor,
    warn1Color,
    warn2Color,
    warningThreshold1,
    warningThreshold2,
    signatureRunThumb,
  } = useRouteColors();

  const colors = {
    liveColor,
    officialColor,
    warn1Color,
    warn2Color,
    warningThreshold1,
    warningThreshold2,
  };

  const [runs, setRuns] = useState(null);
  const [trailsMap, setTrailsMap] = useState({});
  const [trailRoutesMap, setTrailRoutesMap] = useState({});
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [filterCatIds, setFilterCatIds] = useState([]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'My Runs',
      headerRight: () => <Button title="New Run" onPress={() => navigation.navigate('AddRun')} />,
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadAll = async () => {
        try {
          const [rRes, tRes, cRes, gRes] = await Promise.all([
            axios.get(`${API_BASE}/api/routes`),
            axios.get(`${API_BASE}/api/trailheads`),
            axios.get(`${API_BASE}/api/categories`),
            axios.get(`${API_BASE}/api/groups`),
          ]);
          if (cancelled) return;

          setRuns(rRes.data.sort((a, b) => b.timestamp - a.timestamp));

          const tNameMap = {};
          const tRouteMap = {};
          (tRes.data || []).forEach((t) => {
            tNameMap[t.id] = t.name;
            tRouteMap[t.id] = Array.isArray(t.route) ? t.route : [];
          });
          setTrailsMap(tNameMap);
          setTrailRoutesMap(tRouteMap);

          setCategories(cRes.data);
          setGroups(gRes.data);
          if (gRes.data.length > 0) {
            const grp = gRes.data[0];
            setSelectedGroup(grp);
            setFilterCatIds(grp.categoryIds || []);
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
          console.error(e);
        }
      };
      loadAll();
      return () => { cancelled = true; };
    }, [])
  );

  if (!runs || !categories.length || !groups.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const visibleRuns = runs.filter((r) => {
    const tCats = trailCatsMap[r.trailId] || [];
    if (!selectedGroup?.categoryIds?.length) {
      return filterCatIds.length === 0 || tCats.some((id) => filterCatIds.includes(id));
    }
    const inGroup  = tCats.some((id) => selectedGroup.categoryIds.includes(id));
    const inManual = filterCatIds.length === 0 || tCats.some((id) => filterCatIds.includes(id));
    return inGroup && inManual;
  });

  return (
    <View style={styles.container}>
      {/* Group chips */}
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

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContainer}>
        {categories.map((cat) => {
          const sel = filterCatIds.includes(cat.id);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, sel && styles.chipSelected]}
              onPress={() => setFilterCatIds(sel ? filterCatIds.filter((x) => x !== cat.id) : [...filterCatIds, cat.id])}
            >
              <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{cat.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {visibleRuns.length === 0 ? (
        <Text style={styles.empty}>No runs to show.</Text>
      ) : (
        <FlatList
          data={visibleRuns}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={Platform.OS === 'android' ? false : undefined}
          windowSize={7}
          initialNumToRender={6}
          renderItem={({ item }) => {
            const trailName = trailsMap[item.trailId] || 'Trail';
            const official  = trailRoutesMap[item.trailId] || [];
            const tCats     = trailCatsMap[item.trailId] || [];

            return (
              <RunRow
                item={item}
                trailName={trailName}
                official={official}
                tCats={tCats}
                categories={categories}
                colors={colors}
                cacheKey={`run:${item.id}:${signatureRunThumb}`} // <— only run-related prefs
                onPress={() => navigation.navigate('RunDetail', { run: item, trailName })}
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
  chipScroll: { maxHeight: 40, marginVertical: 4 },
  chipContainer: { paddingHorizontal: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#EEE',
    marginHorizontal: 4,
  },
  chipSelected: { backgroundColor: '#007AFF' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#FFF' },
  item: { padding: 16, borderBottomWidth: 1, borderColor: '#EEE' },
  title: { fontSize: 16, fontWeight: 'bold' },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  badge: {
    backgroundColor: '#CCC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  badgeText: { fontSize: 12, color: '#333' },
  previewWrap: { height: 110, marginVertical: 8 },
  previewMap: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  subtitle: { color: '#666' },
  empty: { textAlign: 'center', marginTop: 32, color: '#666' },
});
