// RunList.js
import React, {
  useState,
  useLayoutEffect,
  useContext,
  useCallback,
  useMemo,
  memo,
  useRef,
  useEffect,
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
  Image,
} from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

import MapBase from './MapBase';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

// Snapshot cache (keyed by geometry/version)
const thumbCache = new Map(); // mapVersion -> file:// URI

// Padded region util (same as TrailList)
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

export default function RunList({ navigation }) {
  const { user, prefs } = useContext(UserContext);
  const [runs, setRuns] = useState(null);
  const [trailsMap, setTrailsMap] = useState({});
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [filterCatIds, setFilterCatIds] = useState([]);

  const liveColor = prefs?.liveRouteColor || '#1E90FF';

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
          removeClippedSubviews={false}  // keep cells mounted to avoid map remount flicker
          windowSize={7}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
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

const RunCard = memo(function RunCard({ item, trailName, tCats, categories, liveColor, onPress }) {
  const coords = Array.isArray(item.coords) ? item.coords : [];

  const region = useMemo(
    () => regionFromPoints(coords, { padRatio: 0.12, minSpanDeg: 0.002 }),
    [coords]
  );

  const mapVersion = useMemo(() => {
    const len = coords.length;
    const last = len ? `${coords[len-1].latitude.toFixed(5)},${coords[len-1].longitude.toFixed(5)}` : '-';
    return `${item.id}|${len}|${last}`;
  }, [item.id, coords]);

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

      <StaticThumbnail
        region={region}
        coords={coords}
        color={liveColor}
        mapVersion={mapVersion}
      />

      <Text style={styles.subtitle}>
        {new Date((item.timestamp) || Date.now()).toLocaleString()} • {Math.round(item.duration || 0)}s
      </Text>
    </TouchableOpacity>
  );
});

const StaticThumbnail = memo(function StaticThumbnail({ region, coords, color, mapVersion }) {
  const mapRef = useRef(null);
  const [size, setSize] = useState(null);
  const [loaded, setLoaded] = useState(false);  // onMapLoaded
  const [uri, setUri] = useState(() => thumbCache.get(mapVersion) || null);

  useEffect(() => {
    if (thumbCache.has(mapVersion)) setUri(thumbCache.get(mapVersion));
    else setUri(null);
  }, [mapVersion]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (uri || !loaded || !size || !mapRef.current) return;
      try {
        await new Promise(r => setTimeout(r, 120)); // let overlays paint
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
        console.warn('Run thumb snapshot failed:', e?.message || e);
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
          {coords[0] && (
            <Marker
              coordinate={{ latitude: coords[0].latitude, longitude: coords[0].longitude }}
              tracksViewChanges={false}
            />
          )}
          {coords.length > 1 && (
            <Polyline
              coordinates={coords.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
              strokeWidth={2}
              strokeColor={color}
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

  previewWrap: { height: 110, marginVertical: 8, borderRadius: 8 },
  previewMap: { ...StyleSheet.absoluteFillObject, borderRadius: 8, overflow: 'hidden' },
  subtitle: { color: '#666' },
  empty: { textAlign: 'center', marginTop: 32, color: '#666' },
});
