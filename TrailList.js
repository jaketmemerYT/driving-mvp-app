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
} from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { Marker, Polyline } from 'react-native-maps';

import MapBase from './MapBase';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function TrailList({ navigation }) {
  const { prefs } = useContext(UserContext);

  const [loading, setLoading] = useState(true);
  const [trails, setTrails] = useState([]);
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);

  // trailId -> [categoryId, ...]
  const [trailCatsMap, setTrailCatsMap] = useState({});
  // trailId -> runs count
  const [trailRunCount, setTrailRunCount] = useState({});

  // filters
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [filterCatIds, setFilterCatIds] = useState([]);

  // Keep header simple; App.js attaches the "New" button
  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Trails' });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadAll = async () => {
        try {
          setLoading(true);

          // Load trails, cats, groups, and routes (for counts)
          const [tRes, cRes, gRes, rRes] = await Promise.all([
            axios.get(`${API_BASE}/api/trailheads`),
            axios.get(`${API_BASE}/api/categories`),
            axios.get(`${API_BASE}/api/groups`),
            axios.get(`${API_BASE}/api/routes`),
          ]);
          if (!active) return;

          setTrails(tRes.data || []);
          setCategories(cRes.data || []);
          setGroups(gRes.data || []);

          // Default selected group + category filter = group's categories
          if (gRes.data && gRes.data.length > 0) {
            const grp = gRes.data[0];
            setSelectedGroup(grp);
            setFilterCatIds(grp.categoryIds || []);
          } else {
            setSelectedGroup(null);
            setFilterCatIds([]);
          }

          // Build trail -> categories map
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
          if (!active) return;
          setTrailCatsMap(tcMap);

          // Build trail run counts from routes
          const counts = {};
          (rRes.data || []).forEach((run) => {
            counts[run.trailId] = (counts[run.trailId] || 0) + 1;
          });
          setTrailRunCount(counts);
        } catch (err) {
          console.error(err);
        } finally {
          if (active) setLoading(false);
        }
      };

      loadAll();

      return () => {
        active = false;
      };
    }, [])
  );

  const officialColor = prefs?.officialRouteColor || '#000000';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Apply group/category filters
  const visibleTrails = trails.filter((t) => {
    const tCats = trailCatsMap[t.id] || [];
    // If group selected with categories, require at least one match
    const baseOK = !selectedGroup?.categoryIds?.length
      ? true
      : tCats.some((id) => selectedGroup.categoryIds.includes(id));
    // Manual category filter via chips (optional)
    const manualOK =
      filterCatIds.length === 0 || tCats.some((id) => filterCatIds.includes(id));
    return baseOK && manualOK;
  });

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
              <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                {g.name}
              </Text>
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

      {/* Trail list */}
      {visibleTrails.length === 0 ? (
        <Text style={styles.empty}>No trails match your filters.</Text>
      ) : (
        <FlatList
          data={visibleTrails}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            // map preview settings
            const start = item.coords && item.coords.latitude != null
              ? item.coords
              : null;
            const initialRegion = start
              ? { ...start, latitudeDelta: 0.02, longitudeDelta: 0.02 }
              : { latitude: 0, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };

            const tCats = trailCatsMap[item.id] || [];
            const count = trailRunCount[item.id] || 0;

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

                {/* badges */}
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

                {/* preview map with official route & markers */}
                <MapBase style={styles.preview} initialRegion={initialRegion}>
                  {Array.isArray(item.route) && item.route.length > 1 && (
                    <Polyline
                      coordinates={item.route}
                      strokeWidth={3}
                      strokeColor={officialColor}
                    />
                  )}
                  {item.coords && <Marker coordinate={item.coords} title="Trailhead" />}
                  {item.endCoords && (
                    <Marker coordinate={item.endCoords} title="End" pinColor="green" />
                  )}
                </MapBase>

                <Text style={styles.subtitle}>
                  Difficulty: {item.difficulty || 'Unknown'} • {count} run{count === 1 ? '' : 's'}
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
  container:     { flex: 1 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chipScroll:    { maxHeight: 40, marginVertical: 4 },
  chipContainer: { paddingHorizontal: 8 },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#EEE',
    marginHorizontal: 4,
  },
  chipSelected:     { backgroundColor: '#007AFF' },
  chipText:         { color: '#333' },
  chipTextSelected: { color: '#FFF' },

  item:       { padding: 16, borderBottomWidth: 1, borderColor: '#EEE' },
  title:      { fontSize: 16, fontWeight: 'bold' },
  badgesRow:  { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  badge: {
    backgroundColor: '#CCC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  badgeText:  { fontSize: 12, color: '#333' },

  preview:    { height: 120, marginVertical: 8, borderRadius: 8, overflow: 'hidden' },
  subtitle:   { color: '#666' },

  empty:      { textAlign: 'center', marginTop: 32, color: '#666' },
});
