// Home.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { API_BASE } from './config';

const { width } = Dimensions.get('window');

export default function Home() {
  const [loading, setLoading]         = useState(true);
  const [trails, setTrails]           = useState([]);
  const [runs, setRuns]               = useState([]);
  const [vehicles, setVehicles]       = useState([]);
  const [users, setUsers]             = useState([]);

  const [selectedTrailId, setSelectedTrailId] = useState(null);
  const [leaderRuns, setLeaderRuns]           = useState([]);
  const [trailCategories, setTrailCategories] = useState([]);
  const [totalCount, setTotalCount]           = useState(0);

  // 1) Initial load of trails, runs, vehicles, users
  useEffect(() => {
    let active = true;
    async function loadAll() {
      try {
        const [tRes, rRes, vRes, uRes] = await Promise.all([
          axios.get(`${API_BASE}/api/trailheads`),
          axios.get(`${API_BASE}/api/routes`),
          axios.get(`${API_BASE}/api/vehicles`),
          axios.get(`${API_BASE}/api/users`)
        ]);
        if (!active) return;
        setTrails(tRes.data);
        setRuns(rRes.data);
        setVehicles(vRes.data);
        setUsers(uRes.data);

        // find most popular
        const counts = rRes.data.reduce((acc, r) => {
          acc[r.trailId] = (acc[r.trailId]||0) + 1;
          return acc;
        }, {});
        let max=0, popular=null;
        for (let tid in counts) {
          if (counts[tid] > max) {
            max = counts[tid];
            popular = tid;
          }
        }
        // default to first trail if none have runs
        setSelectedTrailId(popular || (tRes.data[0] && tRes.data[0].id));
      } catch(err){
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadAll();
    return () => { active = false; };
  }, []);

  // 2) Whenever selectedTrailId changes, fetch leaderboard + categories + total count
  useEffect(() => {
    if (!selectedTrailId) return;
    let active = true;

    // total count
    setTotalCount(runs.filter(r => r.trailId === selectedTrailId).length);

    // leaderboard (top 5 fastest)
    axios.get(`${API_BASE}/api/leaderboard/${selectedTrailId}`)
      .then(res => {
        if (!active) return;
        // enrich with user & vehicle names
        const enriched = res.data.map(r => ({
          ...r,
          userName: 
            (users.find(u=>u.id===r.userId)||{}).name || 'Unknown',
          vehicleName:
            (() => {
              const v = vehicles.find(v=>v.id===r.vehicleId);
              return v ? `${v.make} ${v.model}` : 'Unknown';
            })()
        }));
        setLeaderRuns(enriched);
      })
      .catch(console.error);

    // categories for this trail
    axios.get(`${API_BASE}/api/trailheads/${selectedTrailId}/categories`)
      .then(res => { if (active) setTrailCategories(res.data); })
      .catch(console.error);

    return () => { active = false; };
  }, [selectedTrailId, runs, users, vehicles]);

  if (loading || !selectedTrailId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const selectedTrail = trails.find(t => t.id === selectedTrailId) || {};

  return (
    <View style={styles.container}>
      {/* Trail picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContainer}
      >
        {trails.map(t => {
          const sel = t.id === selectedTrailId;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.chip, sel && styles.chipSelected]}
              onPress={() => setSelectedTrailId(t.id)}
            >
              <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                {t.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Leaderboard header */}
      <Text style={styles.sectionTitle}>Leaderboard</Text>
      <Text style={styles.trailTitle}>{selectedTrail.name}</Text>
      <Text style={styles.subtext}>
        {totalCount} run{totalCount === 1 ? '' : 's'} • {selectedTrail.difficulty}
      </Text>

      {/* Category badges */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContainer}
      >
        {trailCategories.map(cat => (
          <View key={cat.id} style={styles.categoryBadge}>
            <MaterialIcons name="label" size={14} color="#fff" />
            <Text style={styles.categoryText}>{cat.name}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Top 5 runs */}
      {leaderRuns.length === 0 ? (
        <Text style={styles.empty}>No runs yet.</Text>
      ) : (
        <FlatList
          data={leaderRuns}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <View style={styles.runRow}>
              <Text style={styles.rank}>{index + 1}.</Text>
              <View style={styles.runInfo}>
                <Text style={styles.runMeta}>
                  {item.userName} in {item.vehicleName}
                </Text>
                <Text style={styles.runTime}>
                  {Math.round(item.duration)}s
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, padding: 16 },
  center:        { flex: 1, justifyContent:'center', alignItems:'center' },
  chipScroll:    { maxHeight: 40, marginBottom: 8 },
  chipContainer: { paddingHorizontal: 8 },
  chip:          {
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      16,
    backgroundColor:  '#EEE',
    marginHorizontal: 4,
  },
  chipSelected:  { backgroundColor: '#007AFF' },
  chipText:      { color: '#333' },
  chipTextSelected: { color: '#FFF' },

  sectionTitle:  { fontSize:18, fontWeight:'600', marginTop: 12 },
  trailTitle:    { fontSize:16, fontWeight:'500', marginTop:4 },
  subtext:       { color:'#666', marginBottom: 8 },

  categoryBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    backgroundColor:'#4A90E2',
    borderRadius:  12,
    paddingHorizontal:8,
    paddingVertical:4,
    marginHorizontal:4,
  },
  categoryText:  { color:'#fff', marginLeft:4, fontSize:12 },

  empty:         { textAlign:'center', marginTop:16, color:'#666' },

  runRow:        {
    flexDirection:'row',
    alignItems:   'center',
    paddingVertical:8,
    borderBottomWidth:1,
    borderColor:  '#EEE'
  },
  rank:          { width:24, fontSize:16, fontWeight:'500' },
  runInfo:       { flex:1 },
  runMeta:       { fontSize:14 },
  runTime:       { color:'#666', marginTop:4 },
});
