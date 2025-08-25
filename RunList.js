// RunList.js
import React, {
  useState,
  useLayoutEffect,
  useContext,
  useCallback,
  useRef,
  memo,
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
  Platform,
} from 'react-native';
import { Polyline, Marker } from 'react-native-maps';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

import MapBase from './MapBase';
import { API_BASE } from './config';
import { UserContext } from './UserContext';
import { useFitToGeometry } from './hooks/useFitToGeometry';

export default function RunList({ navigation }) {
  const { user, prefs } = useContext(UserContext);
  const [runs, setRuns] = useState(null);
  const [trailsMap, setTrailsMap] = useState({});
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [filterCatIds, setFilterCatIds] = useState([]);

  const liveColor = prefs?.liveRouteColor || '#1E90FF'; // default blue

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'My Runs',
      headerRight: () => (
        <Button title="New Run" onPress={() => navigation.navigate('AddRun')} />
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setRuns([]);
        return;
      }
      let cancelled = false;
      const loadAll = async () => {
        try {
          const [rRes, tRes, cRes, gRes] = await Promise.all([
            axios.get(`${API_BASE}/api/routes?userId=${user.id}`),
            axios.get(`${API_BASE}/api/trailheads`),
            axios.get(`${API_BASE}/api/categories`),
            axios.get(`${API_BASE}/api/groups`),
          ]);
          if (cancelled) return;

          setRuns(rRes.data.sort((a, b) => b.timestamp - a.timestamp));

          const tMap = {};
          tRes.data.forEach((t) => (tMap[t.id] = t.name));
          setTrailsMap(tMap);

          setCategories(cRes.data);
          setGroups(gRes.data);
          if (gRes.data.length > 0) {
            const grp = gRes.data[0];
            setSelectedGroup(grp);
            setFilterCatIds(grp.categoryIds || []);
          }

          const tcMap = {};
          await Promise.all(
            tRes.data.map(async (t) => {
              const resp = await axios.get(`${API_BASE}/api/trailheads/${t.id}/categories`);
              tcMap[t.id] = resp.data.map((c) => c.id);
            })
          );
          if (!cancelled) setTrailCatsMap(tcMap);
        } catch (e) {
          console.error(e);
        }
      };
      loadAll();
      return () => {
        cancelled = true;
      };
    }, [user])
  );

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

  const visibleRuns = runs.filter((r) => {
    const tCats = trailCatsMap[r.trailId] || [];
    if (!selectedGroup?.categoryIds?.length) return true;
    const inGroup = tCats.some((id) => selectedGroup.categoryIds.includes(id));
    const inManual = filterCatIds.length === 0 || tCats.some((id) => filterCatIds.includes(id));
    return inGroup && inManual;
  });

  return (
    <View style={styles.container}>
      {/* Group chips */}
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

      {/* Category chips */}
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
      </ScrollView>

      {visibleRuns.length === 0 ? (
        <Text style={styles.empty}>No runs to show.</Text>
      ) : (
        <FlatList
          data={visibleRuns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const trailName = trailsMap[item.trailId] || 'Trail';
            const tCats = trailCatsMap[item.trailId] || [];
            return (
              <RunCard
                item={item}
                trailName={trailName}
                tCats={tCats}
                categories={categories}
                liveColor={liveColor}
                onPress={() => navigation.navigate('RunDetail', { run: item, trailName })}
              />
            );
          }}
        />
      )}
    </View>
  );
}

/** Memoized card with its own Map ref + gated auto-fit */
const RunCard = memo(function RunCard({ item, trailName, tCats, categories, liveColor, onPress }) {
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const coords = Array.isArray(item.coords) ? item.coords : [];
  const hasRoute = coords.length > 1;

  // Initial region so there's *something* to render before fit
  const previewRegion = coords.length
    ? {
        latitude: coords[0].latitude,
        longitude: coords[0].longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 60,
        longitudeDelta: 60,
      };

  // Auto-fit to the run geometry once map is ready (HALF padding = 12)
  useFitToGeometry({
    mapRef,
    route: coords,
    start: coords[0] || null,
    end: coords[coords.length - 1] || null,
    padding: 12,
    animated: false,   // thumbnails snap instantly
    minSpan: 0.0005,
    debounceMs: 0,
    enabled: mapReady,
  });

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

      <View style={styles.previewWrap}>
        <MapBase
          ref={mapRef}
          initialRegion={previewRegion}
          tilesEnabled={false}      // fast + stable previews
          cacheEnabled              // improves draw in scroll lists
          liteMode={Platform.OS === 'android'} // Android tiny-map stability
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          onMapReady={() => setMapReady(true)}
          pointerEvents="none"      // thumbnails don't need interaction
          style={styles.previewMap} // rounded corners applied to the map
        >
          {coords[0] && (
            <Marker coordinate={{ latitude: coords[0].latitude, longitude: coords[0].longitude }} />
          )}
          {hasRoute && (
            <Polyline
              coordinates={coords.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
              strokeWidth={2}
              strokeColor={liveColor}
            />
          )}
        </MapBase>
      </View>

      <Text style={styles.subtitle}>
        {new Date(item.timestamp).toLocaleString()} • {Math.round(item.duration)}s
      </Text>
    </TouchableOpacity>
  );
});

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

  previewWrap: { height: 110, marginVertical: 8, borderRadius: 8 }, // no overflow hidden here
  previewMap: { ...StyleSheet.absoluteFillObject, borderRadius: 8, overflow: 'hidden' },
  subtitle: { color: '#666' },
  empty: { textAlign: 'center', marginTop: 32, color: '#666' },
});
