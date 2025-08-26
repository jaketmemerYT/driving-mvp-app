// Home.js
import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import axios from 'axios';
import { MaterialIcons } from '@expo/vector-icons';

import { API_BASE } from './config';
import { UserContext } from './UserContext';
import ActiveUserPill from './ActiveUserPill';
import LeaderboardMarquee from './LeaderboardMarquee';

export default function Home({ navigation }) {
  const { user } = useContext(UserContext);

  const [loading, setLoading]   = useState(true);
  const [trails, setTrails]     = useState([]);
  const [routes, setRoutes]     = useState([]);
  const [users, setUsers]       = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // Optional manual selection via chips; also updated by marquee cycle
  const [selectedTrailId, setSelectedTrailId] = useState(null);

  // initial load
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [tRes, rRes, uRes, vRes] = await Promise.all([
          axios.get(`${API_BASE}/api/trailheads`),
          axios.get(`${API_BASE}/api/routes`),
          axios.get(`${API_BASE}/api/users`),
          axios.get(`${API_BASE}/api/vehicles`),
        ]);
        if (!active) return;

        const t = Array.isArray(tRes.data) ? tRes.data : [];
        const r = Array.isArray(rRes.data) ? rRes.data : [];
        const u = Array.isArray(uRes.data) ? uRes.data : [];
        const v = Array.isArray(vRes.data) ? vRes.data : [];

        setTrails(t);
        setRoutes(r);
        setUsers(u);
        setVehicles(v);

        // Pick a sensible initial trail: most popular or first
        const counts = r.reduce((acc, run) => {
          acc[run.trailId] = (acc[run.trailId] || 0) + 1;
          return acc;
        }, {});
        let mostId = null; let max = 0;
        for (const tid in counts) {
          if (counts[tid] > max) { max = counts[tid]; mostId = tid; }
        }
        setSelectedTrailId(mostId || (t[0] && t[0].id) || null);
      } catch (e) {
        console.error('Home load error', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const trailsWithRunCounts = useMemo(() => {
    const counts = routes.reduce((acc, run) => {
      acc[run.trailId] = (acc[run.trailId] || 0) + 1;
      return acc;
    }, {});
    return trails.map(t => ({ ...t, runCount: counts[t.id] || 0 }));
  }, [trails, routes]);

  const onRowPress = useCallback(({ run, trail }) => {
    navigation.navigate('RunDetail', { run, trailName: trail?.name || 'Trail' });
  }, [navigation]);

  const onTrailPress = useCallback((trail) => {
    navigation.navigate('TrailDetail', { trailId: trail.id, trailName: trail.name });
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const visibleTrailIdsForCycle = trailsWithRunCounts.filter(t => t.runCount > 0).map(t => t.id);

  return (
    <View style={styles.container}>
      <ActiveUserPill />

      {/* Trail chips at the top; consistent position/height */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContainer}
      >
        {trailsWithRunCounts.map((t) => {
          const sel = t.id === selectedTrailId;
          const disabled = t.runCount === 0; // still tappable if you want; we dim instead
        return (
          <TouchableOpacity
            key={t.id}
            style={[styles.chip, sel && styles.chipSelected, disabled && styles.chipDisabled]}
            onPress={() => setSelectedTrailId(t.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
              {t.name}
            </Text>
            <Text style={[styles.countPill, sel && styles.countPillSelected]}>
              {t.runCount}
            </Text>
          </TouchableOpacity>
        );
        })}
      </ScrollView>

      {/* Marquee (cycles only among trails that have runs); fixed height internally */}
      <LeaderboardMarquee
        trails={trails}
        routes={routes}
        users={users}
        vehicles={vehicles}
        selectedTrailId={selectedTrailId}
        onSelectedTrailIdChange={(tid) => {
          // only accept auto-cycle updates if the trail is eligible & user hasn't manually selected recently
          if (visibleTrailIdsForCycle.includes(tid)) setSelectedTrailId(tid);
        }}
        cycleMs={4000}
        autoplay={true}
        highlightUserId={user?.id || null}
        onRowPress={onRowPress}
        onTrailPress={onTrailPress}
      />

      {/* Secondary actions row (optional) */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('RunsTab')}
        >
          <MaterialIcons name="timer" size={18} color="#111" />
          <Text style={styles.quickTxt}>My Runs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('TrailsTab')}
        >
          <MaterialIcons name="map" size={18} color="#111" />
          <Text style={styles.quickTxt}>Browse Trails</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#FFF' },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },

  chipScroll:    { maxHeight: 58, marginTop: 8 },
  chipContainer: { paddingHorizontal: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      16,
    backgroundColor:  '#EEE',
    marginRight: 8,
  },
  chipSelected:  { backgroundColor: '#007AFF' },
  chipDisabled:  { opacity: 0.6 },
  chipText:      { color: '#333', fontWeight: '600' },
  chipTextSelected: { color: '#FFF' },
  countPill: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    color: '#111',
    fontSize: 12,
    fontWeight: '700',
  },
  countPillSelected: {
    backgroundColor: '#FDE68A',
  },

  quickRow: {
    marginTop: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  quickTxt: { marginLeft: 8, fontWeight: '600', color: '#111' },
});
