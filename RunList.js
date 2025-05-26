// RunList.js
import React, {
  useState,
  useEffect,
  useLayoutEffect,
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
import { API_BASE } from './config';

export default function RunList({ navigation }) {
  const [runs, setRuns]               = useState(null);
  const [trailsMap, setTrailsMap]     = useState({});
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [categories, setCategories]   = useState([]);
  const [groups, setGroups]           = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [filterCatIds, setFilterCatIds]   = useState([]);

  // Header + New Run button
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'My Runs',
      headerRight: () => (
        <Button title="New Run" onPress={() => navigation.navigate('AddRun')} />
      ),
    });
  }, [navigation]);

  // Load runs, trails, cats, groups, trail→cats
  useEffect(() => {
    const loadAll = async () => {
      const [rRes, tRes, cRes, gRes] = await Promise.all([
        axios.get(`${API_BASE}/api/routes`),
        axios.get(`${API_BASE}/api/trailheads`),
        axios.get(`${API_BASE}/api/categories`),
        axios.get(`${API_BASE}/api/groups`),
      ]);
      setRuns(rRes.data.sort((a,b)=>b.timestamp-a.timestamp));
      // map trailId→name
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

      // get trail→categories
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
  }, []);

  if (!runs || !categories.length || !groups.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Filter runs by trail’s cats just like TrailList
  const visibleRuns = runs.filter(r => {
    const tCats = trailCatsMap[r.trailId] || [];
    if (!selectedGroup.categoryIds.length) return true;
    const baseOK = tCats.some(id => selectedGroup.categoryIds.includes(id));
    const manualOK =
      filterCatIds.length === 0 || tCats.some(id => filterCatIds.includes(id));
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
            style={[styles.chip, selectedGroup.id===g.id&&styles.chipSelected]}
            onPress={() => {
              setSelectedGroup(g);
              setFilterCatIds(g.categoryIds || []);
            }}
          >
            <Text style={[styles.chipText, selectedGroup.id===g.id&&styles.chipTextSelected]}>{g.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Category filter */}
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
              style={[styles.chip, sel&&styles.chipSelected]}
              onPress={() =>
                setFilterCatIds(sel
                  ? filterCatIds.filter(x=>x!==cat.id)
                  : [...filterCatIds, cat.id])
              }
            >
              <Text style={[styles.chipText, sel&&styles.chipTextSelected]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={visibleRuns}
        keyExtractor={(item)=>item.id}
        ListEmptyComponent={()=>(
          <Text style={styles.empty}>No runs to show.</Text>
        )}
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
          const tCats = trailCatsMap[item.trailId]||[];

          return (
            <TouchableOpacity
              style={styles.item}
              onPress={() =>
                navigation.navigate('RunDetail', { run:item, trailName })
              }
            >
              <Text style={styles.title}>{trailName}</Text>
              {/* category badges */}
              <View style={styles.badgesRow}>
                {tCats.map(cid => {
                  const cat = categories.find(c=>c.id===cid);
                  return cat ? (
                    <View style={styles.badge} key={cid}>
                      <Text style={styles.badgeText}>{cat.name}</Text>
                    </View>
                  ) : null;
                })}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1 },
  center: { flex:1,justifyContent:'center',alignItems:'center' },
  chipScroll: { maxHeight:40,marginVertical:4 },
  chipContainer: { paddingHorizontal:8 },
  chip: {
    paddingHorizontal:12,
    paddingVertical:6,
    borderRadius:16,
    backgroundColor:'#EEE',
    marginHorizontal:4,
  },
  chipSelected: { backgroundColor:'#007AFF' },
  chipText: { color:'#333' },
  chipTextSelected: { color:'#FFF' },
  item: { padding:16,borderBottomWidth:1,borderColor:'#EEE' },
  title: { fontSize:16,fontWeight:'bold' },
  badgesRow: { flexDirection:'row',flexWrap:'wrap',marginVertical:4 },
  badge: {
    backgroundColor:'#CCC',
    paddingHorizontal:6,
    paddingVertical:2,
    borderRadius:8,
    marginRight:4,
    marginBottom:4,
  },
  badgeText: { fontSize:12,color:'#333' },
  preview: { height:80,marginVertical:8 },
  subtitle:{ color:'#666' },
  empty:{ textAlign:'center',marginTop:32,color:'#666' },
});
