// RunList.js
import React, {
  useState,
  useLayoutEffect,
  useContext,
  useCallback
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
import MapView, { Polyline } from 'react-native-maps';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function RunList({ navigation }) {
  const { user } = useContext(UserContext);
  const [runs, setRuns]                   = useState(null);
  const [trailsMap, setTrailsMap]         = useState({});
  const [trailCatsMap, setTrailCatsMap]   = useState({});
  const [categories, setCategories]       = useState([]);
  const [groups, setGroups]               = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [filterCatIds, setFilterCatIds]   = useState([]);

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
      const loadAll = async () => {
        const [rRes, tRes, cRes, gRes] = await Promise.all([
          axios.get(`${API_BASE}/api/routes?userId=${user.id}`),
          axios.get(`${API_BASE}/api/trailheads`),
          axios.get(`${API_BASE}/api/categories`),
          axios.get(`${API_BASE}/api/groups`),
        ]);
        setRuns(rRes.data.sort((a, b) => b.timestamp - a.timestamp));

        const tMap = {};
        tRes.data.forEach(t => (tMap[t.id] = t.name));
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
    }, [user])
  );

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Please select a user in the Profile tab.
        </Text>
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

  const visibleRuns = runs.filter(r => {
    const tCats = trailCatsMap[r.trailId] || [];
    if (!selectedGroup.categoryIds.length) return true;
    const inGroup = tCats.some(id => selectedGroup.categoryIds.includes(id));
    const inManual =
      filterCatIds.length === 0 || tCats.some(id => filterCatIds.includes(id));
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

      {visibleRuns.length === 0 ? (
        <Text style={styles.empty}>No runs to show.</Text>
      ) : (
        <FlatList
          data={visibleRuns}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const trailName = trailsMap[item.trailId] || 'Trail';
            const coords    = item.coords || [];
            const previewRegion =
              coords.length > 0
                ? {
                    ...coords[0],
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }
                : null;
            const tCats = trailCatsMap[item.trailId] || [];

            return (
              <TouchableOpacity
                style={styles.item}
                onPress={() =>
                  navigation.navigate('RunDetail', { run: item, trailName })
                }
              >
                <Text style={styles.title}>{trailName}</Text>
                <View style={styles.badgesRow}>
                  {tCats.map(cid => (
                    <View style={styles.badge} key={cid}>
                      <Text style={styles.badgeText}>
                        {categories.find(c => c.id === cid)?.name}
                      </Text>
                    </View>
                  ))}
                </View>
                {previewRegion && (
                  <MapView
                    style={styles.preview}
                    initialRegion={previewRegion}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    <Polyline coordinates={coords} strokeWidth={2} />
                  </MapView>
                )}
                <Text style={styles.subtitle}>
                  {new Date(item.timestamp).toLocaleString()} •{' '}
                  {Math.round(item.duration)}s
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
  message:       { color: '#666', textAlign: 'center', padding: 16 },
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
  title:         { fontSize: 16, fontWeight: 'bold' },
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
  preview:       { height: 80, marginVertical: 8 },
  subtitle:      { color: '#666' },
  empty:         { textAlign: 'center', marginTop: 32, color: '#666' },
});
