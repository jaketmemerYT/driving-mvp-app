// TrailList.js
import React, { useState, useEffect, useLayoutEffect } from 'react';
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
import { API_BASE } from './config';

export default function TrailList({ navigation }) {
  const [trails, setTrails]         = useState(null);
  const [groups, setGroups]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [filterCatIds, setFilterCatIds]   = useState([]);

  // Header title
  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Trails' });
  }, [navigation]);

  // Initial data fetch
  useEffect(() => {
    const loadAll = async () => {
      // 1) fetch trails, groups, categories
      const [tRes, gRes, cRes] = await Promise.all([
        axios.get(`${API_BASE}/api/trailheads`),
        axios.get(`${API_BASE}/api/groups`),
        axios.get(`${API_BASE}/api/categories`),
      ]);
      setTrails(tRes.data);
      setGroups(gRes.data);
      setCategories(cRes.data);

      // default to first group
      if (gRes.data.length > 0) {
        const grp = gRes.data[0];
        setSelectedGroup(grp);
        setFilterCatIds(grp.categoryIds || []);
      }

      // 2) fetch trail→categories for each trail
      const map = {};
      await Promise.all(
        tRes.data.map(async t => {
          const r = await axios.get(
            `${API_BASE}/api/trailheads/${t.id}/categories`
          );
          map[t.id] = r.data.map(cat => cat.id);
        })
      );
      setTrailCatsMap(map);
    };

    loadAll().catch(console.error);
  }, []);

  // Loading?
  if (!trails || !groups.length || !categories.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Filter trails by category intersection
  const visibleTrails = trails.filter(t => {
    const tCats = trailCatsMap[t.id] || [];
    // if group has no cats, show all
    if (!selectedGroup || !selectedGroup.categoryIds.length) {
      return true;
    }
    // must intersect group + any manual filters
    const baseOK = tCats.some(id =>
      selectedGroup.categoryIds.includes(id)
    );
    const manualOK =
      filterCatIds.length === 0 ||
      tCats.some(id => filterCatIds.includes(id));
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
        {groups.map(g => (
          <TouchableOpacity
            key={g.id}
            style={[
              styles.chip,
              selectedGroup.id === g.id && styles.chipSelected,
            ]}
            onPress={() => {
              setSelectedGroup(g);
              setFilterCatIds(g.categoryIds || []);
            }}
          >
            <Text
              style={[
                styles.chipText,
                selectedGroup.id === g.id && styles.chipTextSelected,
              ]}
            >
              {g.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContainer}
      >
        {categories.map(cat => {
          const selected = filterCatIds.includes(cat.id);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => {
                const next = selectedCatIds =>
                  selected
                    ? selectedCatIds.filter(x => x !== cat.id)
                    : [...selectedCatIds, cat.id];
                setFilterCatIds(next);
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  selected && styles.chipTextSelected,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Trail list */}
      <FlatList
        data={visibleTrails}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const tCats = trailCatsMap[item.id] || [];
          return (
            <TouchableOpacity
              style={styles.item}
              onPress={() =>
                navigation.navigate('Tracker', {
                  trailId: item.id,
                  trailName: item.name,
                })
              }
            >
              <Text style={styles.title}>{item.name}</Text>
              {/* small category badges */}
              <View style={styles.badgesRow}>
                {tCats.map(cid => {
                  const cat = categories.find(c => c.id === cid);
                  return cat ? (
                    <View style={styles.badge} key={cid}>
                      <Text style={styles.badgeText}>{cat.name}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <Text style={styles.empty}>No trails match these filters.</Text>
        )}
      />
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
  title: { fontSize: 18, fontWeight: 'bold' },
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
  empty: { textAlign: 'center', marginTop: 32, color: '#666' },
});
