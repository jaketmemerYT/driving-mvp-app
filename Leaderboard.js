// Leaderboard.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Button,
} from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';

// -------- helpers ----------
const fmtDuration = (sec) => {
  if (sec == null) return '—';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};

const mphFrom = (run) => {
  // Prefer computed from distance if present; otherwise fall back to avgSpeed (m/s)
  if (run?.distance && run?.duration) {
    const mps = run.distance / run.duration; // meters / sec
    return mps * 2.236936; // m/s → mph
  }
  if (run?.avgSpeed != null) {
    return run.avgSpeed * 2.236936;
  }
  return 0;
};

const medalFor = (rank) => {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `${rank}.`;
  }
};

// --------------------------------------------

export default function Leaderboard({ route, navigation }) {
  const paramTrailId = route?.params?.trailId || null;
  const paramTrailName = route?.params?.name || null;

  const [loading, setLoading] = useState(true);
  const [trails, setTrails] = useState([]);               // [{id,name,difficulty,...}]
  const [routes, setRoutes] = useState([]);               // all runs (for popularity / counts)
  const [users, setUsers] = useState([]);                 // for display names
  const [vehicles, setVehicles] = useState([]);           // for vehicle info

  const [selectedTrailId, setSelectedTrailId] = useState(paramTrailId);
  const [runs, setRuns] = useState(null);                 // leaderboard rows for selected trail

  // Load base data: all trails, all routes, users, vehicles
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

        setTrails(Array.isArray(tRes.data) ? tRes.data : []);
        setRoutes(Array.isArray(rRes.data) ? rRes.data : []);
        setUsers(Array.isArray(uRes.data) ? uRes.data : []);
        setVehicles(Array.isArray(vRes.data) ? vRes.data : []);

        // Pick selected trail:
        // - Use param if valid
        // - Else pick most popular by run count
        // - Else first trail
        let chosen = paramTrailId;
        const allTrails = Array.isArray(tRes.data) ? tRes.data : [];
        if (!chosen && allTrails.length > 0) {
          const counts = {};
          (Array.isArray(rRes.data) ? rRes.data : []).forEach((r) => {
            counts[r.trailId] = (counts[r.trailId] || 0) + 1;
          });
          const mostPopular = [...allTrails]
            .map((t) => ({ t, count: counts[t.id] || 0 }))
            .sort((a, b) => b.count - a.count)[0];
          chosen = mostPopular ? mostPopular.t.id : allTrails[0].id;
        }
        setSelectedTrailId(chosen || null);
      } catch (e) {
        console.error('Leaderboard base load failed:', e);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [paramTrailId]);

  // Load leaderboard for selected trail
  useEffect(() => {
    let active = true;
    if (!selectedTrailId) {
      setRuns([]);
      return;
    }
    (async () => {
      try {
        const r = await axios.get(`${API_BASE}/api/leaderboard/${selectedTrailId}`);
        if (!active) return;
        setRuns(Array.isArray(r.data) ? r.data : []);
      } catch (e) {
        console.error('Leaderboard fetch failed:', e);
        if (active) setRuns([]);
      }
    })();
    return () => { active = false; };
  }, [selectedTrailId]);

  const selectedTrail = useMemo(
    () => trails.find((t) => t.id === selectedTrailId) || null,
    [trails, selectedTrailId]
  );

  const totalRunsForSelected = useMemo(() => {
    if (!selectedTrailId) return 0;
    return routes.filter((r) => r.trailId === selectedTrailId).length;
  }, [routes, selectedTrailId]);

  const userName = useCallback(
    (uid) => users.find((u) => u.id === uid)?.name || 'Unknown User',
    [users]
  );

  const vehicleLabel = useCallback(
    (vid) => {
      const v = vehicles.find((x) => x.id === vid);
      if (!v) return 'Unknown Vehicle';
      return `${v.make} ${v.model} (${v.year})`;
    },
    [vehicles]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // header title text
  const headerTitle = selectedTrail
    ? `${selectedTrail.name} — Top 5`
    : (paramTrailName ? `${paramTrailName} — Top 5` : 'Leaderboard');

  return (
    <View style={styles.container}>
      {/* Trail selector chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trailChips}
        style={styles.trailChipsScroll}
      >
        {trails.map((t) => {
          const selected = t.id === selectedTrailId;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.trailChip, selected && styles.trailChipSelected]}
              onPress={() => setSelectedTrailId(t.id)}
            >
              <Text style={[styles.trailChipText, selected && styles.trailChipTextSelected]}>
                {t.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Header card */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={styles.headerMetaRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>
              {totalRunsForSelected} total run{totalRunsForSelected === 1 ? '' : 's'}
            </Text>
          </View>
          {selectedTrail?.difficulty ? (
            <View style={[styles.metaPill, styles.diffPill]}>
              <Text style={[styles.metaPillText, styles.diffPillText]}>
                {selectedTrail.difficulty}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Leaderboard list */}
      {!runs ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      ) : runs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No runs yet for this trail.</Text>
        </View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const rank = index + 1;
            const mph = mphFrom(item);
            const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : '';
            const isTop = rank <= 3;

            return (
              <TouchableOpacity
                style={[styles.row, isTop && styles.rowTop]}
                onPress={() =>
                  navigation.navigate('RunDetail', { run: item, trailName: selectedTrail?.name || 'Trail' })
                }
              >
                <View style={styles.rankCol}>
                  <Text style={styles.medal}>{medalFor(rank)}</Text>
                </View>

                <View style={styles.mainCol}>
                  <Text style={styles.userLine}>
                    {userName(item.userId)} <Text style={styles.sep}>•</Text> {vehicleLabel(item.vehicleId)}
                  </Text>
                  <View style={styles.metricsRow}>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Time</Text>
                      <Text style={styles.metricValue}>{fmtDuration(item.duration)}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Avg</Text>
                      <Text style={styles.metricValue}>{mph.toFixed(1)} mph</Text>
                    </View>
                    {item.distance != null && (
                      <View style={styles.metric}>
                        <Text style={styles.metricLabel}>Dist</Text>
                        <Text style={styles.metricValue}>
                          {(item.distance / 1609.344).toFixed(2)} mi
                        </Text>
                      </View>
                    )}
                  </View>
                  {dateStr ? <Text style={styles.dateLine}>{dateStr}</Text> : null}
                </View>

                <View style={styles.ctaCol}>
                  <MaterialChip text="View" />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <Button title="Back to Trails" onPress={() => navigation.popToTop()} />
      </View>
    </View>
  );
}

// Simple pill-like button for the CTA
function MaterialChip({ text }) {
  return (
    <View style={styles.chipBtn}>
      <Text style={styles.chipBtnText}>{text}</Text>
    </View>
  );
}

// -------- styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#666' },

  trailChipsScroll: { maxHeight: 48 },
  trailChips: { paddingHorizontal: 12, paddingVertical: 8 },
  trailChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EEE',
    borderRadius: 16,
    marginRight: 8,
  },
  trailChipSelected: { backgroundColor: '#007AFF' },
  trailChipText: { color: '#333', fontWeight: '500' },
  trailChipTextSelected: { color: '#FFF' },

  headerCard: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  headerMetaRow: { flexDirection: 'row', marginTop: 8 },
  metaPill: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  metaPillText: { color: '#E5E7EB', fontSize: 12, fontWeight: '600' },
  diffPill: { backgroundColor: '#111827' },
  diffPillText: { color: '#FACC15' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEE',
  },
  rowTop: {
    backgroundColor: '#FFFDF5',
  },
  rankCol: { width: 42, alignItems: 'center' },
  medal: { fontSize: 20 },

  mainCol: { flex: 1, paddingRight: 8 },
  userLine: { fontSize: 15, fontWeight: '600', color: '#111' },
  sep: { color: '#999' },
  metricsRow: { flexDirection: 'row', marginTop: 6 },
  metric: { marginRight: 12 },
  metricLabel: { fontSize: 11, color: '#6B7280' },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#111' },
  dateLine: { marginTop: 4, fontSize: 12, color: '#6B7280' },

  ctaCol: { paddingLeft: 4 },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
  },
  chipBtnText: { fontSize: 12, fontWeight: '600', color: '#111' },

  footer: { padding: 12 },
});
