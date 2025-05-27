// TrailList.js
import React, { useState, useLayoutEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Button,
} from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from './config';

export default function TrailList({ navigation }) {
  const [trails, setTrails]             = useState(null);
  const [categories, setCategories]     = useState([]);
  const [groups, setGroups]             = useState([]);
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [filterCatIds, setFilterCatIds]   = useState([]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Trails',
      headerRight: () => (
        <Button
          title="New Trail"
          onPress={() => navigation.navigate('AddTrail')}
        />
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const loadAll = async () => {
        const [tRes, cRes, gRes] = await Promise.all([
          axios.get(`${API_BASE}/api/trailheads`),
          axios.get(`${API_BASE}/api/categories`),
          axios.get(`${API_BASE}/api/groups`),
        ]);
        setTrails(tRes.data);
        setCategories(cRes.data);
        setGroups(gRes.data);

        if (gRes.data.length > 0) {
          const grp = gRes.data[0];
          setSelectedGroup(grp);
          setFilterCatIds(grp.categoryIds || []);
        }

        const tcMap = {};
        await Promise.all(
          tRes.data.map(async t => {
            const resp = await axios.get(
              `${API_BASE}/api/trailheads/${t.id}/categories`
            );
            tcMap[t.id] = resp.data.map(c => c.id);
          })
        );
        setTrailCatsMap(tcMap);
      };
      loadAll().catch(console.error);
    }, [])
  );

  if (!trails || !categories.length || !groups.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const visibleTrails = trails.filter(t => {
    const tCats = trailCatsMap[t.id] || [];
    if (!selectedGroup.categoryIds.length) return true;
    const inGroup = tCats.some(id =>
      selectedGroup.categoryIds.includes(id)
    );
    const inManual =
      filterCatIds.length === 0 ||
      tCats.some(id => filterCatIds.includes(id));
    return inGroup && inManual;
  });

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContainer}
      >
        {groups.map(g => {
          const sel = selectedGroup.id === g.id;
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContainer}
      >
        {categories.map(cat => {
          const sel = filterCatIds.includes(cat.id);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, sel && styles.chipSelected]}
              onPress={() =>
                setFilterCatIds(
                  sel
                    ? filterCatIds.filter(x => x !== cat.id)
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

      <FlatList
        data={visibleTrails}
        keyExtractor={item => item.id}
        ListEmptyComponent={() => (
          <Text style={styles.empty}>No trails match these filters.</Text>
        )}
        renderItem={({ item }) => {
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
                {tCats.map(cid => (
                  <View style={styles.badge} key={cid}>
                    <Text style={styles.badgeText}>
                      {categories.find(c => c.id === cid)?.name}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        }}
      />
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
  item:          { padding: 16, borderBottomWidth: 1, borderColor: '#EEE' },
  title:         { fontSize: 18, fontWeight: 'bold' },
  badgesRow:     { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  badge:         {
    backgroundColor: '#CCC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  badgeText:     { fontSize: 12, color: '#333' },
  empty:         { textAlign: 'center', marginTop: 32, color: '#666' },
});
