// RunList.js
import React, {
  useState,
  useLayoutEffect,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Button,
} from 'react-native';
import MapView, { Polyline, UrlTile } from 'react-native-maps';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

// Compute a nice preview region from a list of coords (lat/lng objects)
// Falls back to first point or a default if nothing is present
function regionFromCoords(points) {
  const valid = (points || []).filter(
    (p) => p && p.latitude != null && p.longitude != null
  );
  if (valid.length === 0) {
    // SF fallback
    return {
      latitude: 37.7749,
      longitude: -122.4194,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }
  if (valid.length === 1) {
    return {
      latitude: valid[0].latitude,
      longitude: valid[0].longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }
  let minLat = +Infinity,
    maxLat = -Infinity,
    minLon = +Infinity,
    maxLon = -Infinity;
  for (const p of valid) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLon) minLon = p.longitude;
    if (p.longitude > maxLon) maxLon = p.longitude;
  }
  const lat = (minLat + maxLat) / 2;
  const lon = (minLon + maxLon) / 2;
  const pad = 1.2; // add margin around bounds
  const latDelta = Math.max((maxLat - minLat) * pad, 0.01);
  const lonDelta = Math.max((maxLon - minLon) * pad, 0.01);
  return {
    latitude: lat,
    longitude: lon,
    latitudeDelta: latDelta,
    longitudeDelta: lonDelta,
  };
}

export default function RunList({ navigation }) {
  const { user, prefs } = useContext(UserContext);

  const [runs, setRuns] = useState(null);
  const [trailsMap, setTrailsMap] = useState({});          // trailId -> trail object
  const [trailCatsMap, setTrailCatsMap] = useState({});    // trailId -> [categoryId]
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [filterCatIds, setFilterCatIds] = useState([]);

  const officialColor = prefs?.officialRouteColor || '#000000';
  const liveColor = prefs?.liveRouteColor || '#1976D2';

  // Header
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'My Runs',
      headerRight: () => (
        <Button title="New Run" onPress={() => navigation.navigate('AddRun')} />
      ),
    });
  }, [navigation]);

  // Load data on focus (and when user changes)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadAll = async () => {
        if (!user) {
          setRuns([]);
          setTrailsMap({});
          setCategories([]);
          setGroups([]);
          setSelectedGroup(null);
          setFilterCatIds([]);
          return;
        }
        try {
          const [rRes, tRes, cRes, gRes] = await Promise.all([
            axios.get(`${API_BASE}/api/routes?userId=${user.id}`),
            axios.get(`${API_BASE}/api/trailheads`),
            axios.get(`${API_BASE}/api/categories`),
            axios.get(`${API_BASE}/api/groups`),
          ]);
          if (cancelled) return;

          const sortedRuns = (rRes.data || []).sort(
            (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
          );
          setRuns(sortedRuns);

          // Build trailId -> trail object map (we want official route + start coords)
          const tMap = {};
          (tRes.data || []).forEach((t) => (tMap[t.id] = t));
          setTrailsMap(tMap);

          setCategories(cRes.data || []);
          setGroups(gRes.data || []);

          // Default selected group: first one
          if (!cancelled && (gRes.data || []).length > 0) {
            const grp = gRes.data[0];
            setSelectedGroup(grp);
            setFilterCatIds(grp.categoryIds || []);
          }

          // Map trail -> categories
          const tcMap = {};
          await Promise.all(
            (tRes.data || []).map(async (t) => {
              try {
                const resp = await axios.get(
                  `${API_BASE}/api/trailheads/${t.id}/categories`
                );
                tcMap[t.id] = (resp.data || []).map((c) => c.id);
              } catch {
                tcMap[t.id] = [];
              }
            })
          );
          if (!cancelled) setTrailCatsMap(tcMap);
        } catch (err) {
          console.error('RunList load failed', err);
        }
      };

      loadAll();
      return () => {
        cancelled = true;
      };
    }, [user])
  );

  const visibleRuns = useMemo(() => {
    if (!runs) return null;
    if (!selectedGroup) return runs;
    return runs.filter((r) => {
      const tCats = trailCatsMap[r.trailId] || [];
      if (!selectedGroup.categoryIds?.length) return true;
      const inGroup = tCats.some((id) => selectedGroup.categoryIds.includes(id));
      const inManual =
        filterCatIds.length === 0 || tCats.some((id) => filterCatIds.includes(id));
      return inGroup && inManual;
    });
  }, [runs, selectedGroup, filterCatIds, trailCatsMap]);

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Please select a user in the Profile tab.</Text>
      </View>
    );
  }
  if (!runs || !categories.length || !groups.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Group picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContainer}
      >
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

      {/* Category filter */}
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
                setFilterCatIds(
                  sel ? filterCatIds.filter((x) => x !== cat.id) : [...filterCatIds, cat.id]
                )
              }
            >
              <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{cat.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {visibleRuns && visibleRuns.length === 0 ? (
        <Text style={styles.empty}>No runs to show.</Text>
      ) : (
        <FlatList
          data={visibleRuns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const trail = trailsMap[item.trailId];
            const trailName = trail?.name || 'Trail';
            const official = Array.isArray(trail?.route) ? trail.route : [];
            const actual = Array.isArray(item.coords) ? item.coords : [];

            // Build a region that includes both official + actual polylines
            const region = regionFromCoords([...official, ...actual]);

            const tCats = trailCatsMap[item.trailId] || [];

            return (
              <TouchableOpacity
                style={styles.item}
                onPress={() => navigation.navigate('RunDetail', { run: item, trailName })}
              >
                <Text style={styles.title}>{trailName}</Text>

                {/* Category badges */}
                <View style={styles.badgesRow}>
                  {tCats.map((cid) => (
                    <View style={styles.badge} key={cid}>
                      <Text style={styles.badgeText}>
                        {(categories.find((c) => c.id === cid) || {}).name || 'Category'}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Preview Map */}
                <View style={styles.previewWrap}>
                  <MapView
                    style={styles.preview}
                    initialRegion={region}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    <UrlTile
                      urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      maximumZ={19}
                      shouldReplaceMapContent
                    />
                    {official.length > 1 && (
                      <Polyline
                        coordinates={official.map((p) => ({
                          latitude: p.latitude,
                          longitude: p.longitude,
                        }))}
                        strokeWidth={3}
                        strokeColor={officialColor}
                      />
                    )}
                    {actual.length > 1 && (
                      <Polyline
                        coordinates={actual.map((p) => ({
                          latitude: p.latitude,
                          longitude: p.longitude,
                        }))}
                        strokeWidth={2}
                        strokeColor={liveColor}
                      />
                    )}
                  </MapView>

                  {/* Tiny legend overlay */}
                  <View style={styles.legend}>
                    <View style={styles.legendRow}>
                      <View style={[styles.swatch, { backgroundColor: officialColor }]} />
                      <Text style={styles.legendText}>Official</Text>
                    </View>
                    <View style={styles.legendRow}>
                      <View style={[styles.swatch, { backgroundColor: liveColor }]} />
                      <Text style={styles.legendText}>Run</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.subtitle}>
                  {new Date(item.timestamp).toLocaleString()} • {Math.round(item.duration)}s
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  message: { color: '#666', textAlign: 'center', padding: 16 },

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

  previewWrap: {
    marginTop: 8,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  preview: { height: '100%', width: '100%' },

  legend: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 1 },
  swatch: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  legendText: { fontSize: 10, color: '#333' },

  subtitle: { color: '#666', marginTop: 6 },
  empty: { textAlign: 'center', marginTop: 32, color: '#666' },
});
