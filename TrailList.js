// TrailList.js
import React, {
  useState,
  useLayoutEffect,
  useCallback,
  useContext,
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
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function TrailList({ navigation }) {
  const { user } = useContext(UserContext);

  const [trails, setTrails] = useState(null);
  const [categories, setCategories] = useState([]);
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [filterCatIds, setFilterCatIds] = useState([]);

  // Header: New Trail
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Trails',
      headerRight: () => (
        <Button title="New" onPress={() => navigation.navigate('AddTrail')} />
      ),
    });
  }, [navigation]);

  // Load/refresh on focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadAll = async () => {
        try {
          const [tRes, cRes, gRes] = await Promise.all([
            axios.get(`${API_BASE}/api/trailheads`),
            axios.get(`${API_BASE}/api/categories`),
            axios.get(`${API_BASE}/api/groups`),
          ]);
          if (!active) return;

          setTrails(tRes.data);
          setCategories(cRes.data);
          setGroups(gRes.data);

          // pick default group (first one) if none selected yet
          if (!selectedGroup && gRes.data.length > 0) {
            const g = gRes.data[0];
            setSelectedGroup(g);
            setFilterCatIds(g.categoryIds || []);
          }

          // build trail -> [categoryId,...] map
          const tcMap = {};
          await Promise.all(
            tRes.data.map(async (t) => {
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
          if (active) setTrailCatsMap(tcMap);
        } catch (err) {
          console.error('Error loading trails/cats/groups:', err);
          if (active) {
            setTrails([]);
            setCategories([]);
            setGroups([]);
            setTrailCatsMap({});
          }
        }
      };

      loadAll();
      return () => {
        active = false;
      };
    }, [selectedGroup?.id]) // refresh if group context changes
  );

  if (!trails || !categories.length || !groups.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Group/category filtering
  const visibleTrails = trails.filter((t) => {
    const tCats = trailCatsMap[t.id] || [];
    if (!selectedGroup?.categoryIds?.length) {
      // group has no category restriction — allow manual filter only
      return (
        filterCatIds.length === 0 ||
        tCats.some((id) => filterCatIds.includes(id))
      );
    }
    // must match group categories
    const inGroup = tCats.some((id) => selectedGroup.categoryIds.includes(id));
    // and manual selection (if any)
    const inManual =
      filterCatIds.length === 0 || tCats.some((id) => filterCatIds.includes(id));
    return inGroup && inManual;
  });

  const renderTrail = ({ item }) => {
    const start = item.coords || null;
    const end = item.endCoords || null;
    const line = Array.isArray(item.route) ? item.route : [];

    const initialRegion =
      (line && line.length > 0
        ? {
            latitude: line[0].latitude,
            longitude: line[0].longitude,
          }
        : start) || { latitude: 0, longitude: 0 };

    const region =
      initialRegion.latitude != null
        ? {
            ...initialRegion,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }
        : null;

    const tCats = trailCatsMap[item.id] || [];

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() =>
          navigation.navigate('TrailDetail', {
            trailId: item.id,
            trailName: item.name,
          })
        }
      >
        <Text style={styles.title}>{item.name}</Text>
        <View style={styles.badgesRow}>
          {tCats.map((cid) => {
            const cat = categories.find((c) => c.id === cid);
            return cat ? (
              <View style={styles.badge} key={cid}>
                <Text style={styles.badgeText}>{cat.name}</Text>
              </View>
            ) : null;
          })}
        </View>

        {region && (
          <MapView
            style={styles.preview}
            initialRegion={region}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            {/* OpenStreetMap tiles for context */}
            <UrlTile
              urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              flipY={false}
            />
            {start && <Marker coordinate={start} title="Start" />}
            {end && <Marker coordinate={end} title="End" pinColor="green" />}

            {line.length > 1 && (
              <Polyline
                coordinates={line}
                strokeWidth={3}
                strokeColor="black"
              />
            )}
          </MapView>
        )}

        <Text style={styles.subtitle}>
          {item.difficulty ? `Difficulty: ${item.difficulty}` : 'Difficulty: —'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Group switcher */}
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
              <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                {g.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Category filter row */}
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
                  sel
                    ? filterCatIds.filter((x) => x !== cat.id)
                    : [...filterCatIds, cat.id]
                )
              }
            >
              <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {visibleTrails.length === 0 ? (
        <Text style={styles.empty}>No trails match your filters.</Text>
      ) : (
        <FlatList
          data={visibleTrails}
          keyExtractor={(t) => t.id}
          renderItem={renderTrail}
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

  preview: { height: 120, marginVertical: 8, borderRadius: 8, overflow: 'hidden' },
  subtitle: { color: '#666' },
  empty: { textAlign: 'center', marginTop: 32, color: '#666' },
});
