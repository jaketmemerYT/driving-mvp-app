// LeaderboardMarquee.js
import React, { useEffect, useMemo, useRef, useState, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

const medalFor = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`);
const fmtDuration = (sec) => {
  if (sec == null) return '—';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};
const mphFrom = (run) => {
  if (run?.distance && run?.duration) {
    const mps = run.distance / run.duration;
    return mps * 2.236936;
  }
  if (run?.avgSpeed != null) return run.avgSpeed * 2.236936;
  return 0;
};

/**
 * LeaderboardMarquee
 * Props:
 * - dwellMs?: number (if omitted, we read from prefs.leaderboardDwellMs or fallback 4000)
 * - maxRows?: number = 5
 * - pauseOnPress?: boolean = true
 * - skipEmptyTrails?: boolean = true  // auto-skip trails with 0 runs
 */
export default function LeaderboardMarquee({
  dwellMs,
  maxRows = 5,
  pauseOnPress = true,
  skipEmptyTrails = true,
}) {
  const navigation = useNavigation();
  const { user, prefs, setPrefs, updatePrefs } = useContext(UserContext);

  // base datasets
  const [trails, setTrails] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // marquee state
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // initial dwell comes from props -> prefs -> default
  const initialDwell = useMemo(() => {
    if (typeof dwellMs === 'number') return Math.max(0, dwellMs);
    const saved = Number(prefs?.leaderboardDwellMs);
    return Number.isFinite(saved) ? Math.max(0, saved) : 4000;
  }, [dwellMs, prefs?.leaderboardDwellMs]);

  const [dwellMsState, setDwellMsState] = useState(initialDwell);

  // cache: per-trail leaderboard
  const [leadersByTrail, setLeadersByTrail] = useState({});
  const [loadingTrailId, setLoadingTrailId] = useState(null);

  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  // load base sets once
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const [tRes, rRes, uRes, vRes] = await Promise.all([
          axios.get(`${API_BASE}/api/trailheads`),
          axios.get(`${API_BASE}/api/routes`),
          axios.get(`${API_BASE}/api/users`),
          axios.get(`${API_BASE}/api/vehicles`),
        ]);
        if (!mountedRef.current) return;
        setTrails(Array.isArray(tRes.data) ? tRes.data : []);
        setRoutes(Array.isArray(rRes.data) ? rRes.data : []);
        setUsers(Array.isArray(uRes.data) ? uRes.data : []);
        setVehicles(Array.isArray(vRes.data) ? vRes.data : []);
      } catch (e) {
        console.error('LeaderboardMarquee base load failed:', e?.message || e);
        if (!mountedRef.current) return;
        setTrails([]); setRoutes([]); setUsers([]); setVehicles([]);
      }
    })();
    return () => { mountedRef.current = false; clearInterval(timerRef.current); };
  }, []);

  // --------- build cyclable list based on run counts ----------
  const runCounts = useMemo(() => {
    const m = {};
    (routes || []).forEach(r => {
      if (r?.trailId) m[r.trailId] = (m[r.trailId] || 0) + 1;
    });
    return m;
  }, [routes]);

  const cyclableTrails = useMemo(() => {
    if (!Array.isArray(trails) || trails.length === 0) return [];
    if (!skipEmptyTrails) return trails;
    const withRuns = trails.filter(t => (runCounts[t.id] || 0) > 0);
    return withRuns.length ? withRuns : trails; // fallback when none have runs
  }, [trails, runCounts, skipEmptyTrails]);

  // keep index valid when the list size changes
  const totalTrails = cyclableTrails.length;
  useEffect(() => {
    if (totalTrails > 0 && index >= totalTrails) {
      setIndex(0);
    }
  }, [totalTrails, index]);

  const activeTrail = totalTrails > 0 ? cyclableTrails[index % totalTrails] : null;
  const totalRunsForActive = useMemo(() => {
    if (!activeTrail) return 0;
    return runCounts[activeTrail.id] || 0;
  }, [runCounts, activeTrail]);

  // autoplay
  useEffect(() => {
    if (!totalTrails) return;
    clearInterval(timerRef.current);
    if (paused || dwellMsState === 0) return; // 0 = no auto-advance
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % totalTrails);
    }, Math.max(1000, dwellMsState));
    return () => clearInterval(timerRef.current);
  }, [totalTrails, dwellMsState, paused]);

  // fetch leaderboard for current & prefetch next
  const ensureLeaderboard = useCallback(async (trailId) => {
    if (!trailId) return;
    if (leadersByTrail[trailId]) return;
    try {
      setLoadingTrailId(trailId);
      const res = await axios.get(`${API_BASE}/api/leaderboard/${trailId}`);
      if (!mountedRef.current) return;
      setLeadersByTrail((prev) => ({ ...prev, [trailId]: Array.isArray(res.data) ? res.data : [] }));
    } catch (e) {
      console.error('leaderboard fetch failed:', e?.message || e);
      if (!mountedRef.current) return;
      setLeadersByTrail((prev) => ({ ...prev, [trailId]: [] }));
    } finally {
      if (mountedRef.current) setLoadingTrailId((id) => (id === trailId ? null : id));
    }
  }, [leadersByTrail]);

  useEffect(() => {
    if (!activeTrail?.id) return;
    ensureLeaderboard(activeTrail.id);
    if (totalTrails > 1) {
      const next = cyclableTrails[(index + 1) % totalTrails];
      if (next?.id) ensureLeaderboard(next.id);
    }
  }, [activeTrail?.id, index, totalTrails, cyclableTrails, ensureLeaderboard]);

  const leaders = activeTrail ? (leadersByTrail[activeTrail.id] || []) : [];
  const topRows = leaders.slice(0, Math.max(1, maxRows));

  // helpers
  const userName = useCallback((uid) => users.find(u => u.id === uid)?.name || 'Unknown User', [users]);
  const vehicleLabel = useCallback((vid) => {
    const v = vehicles.find(x => x.id === vid);
    return v ? `${v.make} ${v.model}${v.year ? ` (${v.year})` : ''}` : 'Unknown Vehicle';
  }, [vehicles]);

  // persist dwell to prefs
  const persistDwell = useCallback(async (val) => {
    try {
      if (typeof setPrefs === 'function') setPrefs({ ...(prefs || {}), leaderboardDwellMs: val });
      if (typeof updatePrefs === 'function') {
        await updatePrefs({ leaderboardDwellMs: val });
      } else if (user?.id) {
        await axios
          .patch(`${API_BASE}/api/users/${user.id}/prefs`, { leaderboardDwellMs: val })
          .catch(() => axios.post(`${API_BASE}/api/users/${user.id}/prefs`, { leaderboardDwellMs: val }).catch(() => {}));
      }
    } catch (e) {
      console.warn('Persist dwell failed:', e?.message || e);
    }
  }, [prefs, setPrefs, updatePrefs, user?.id]);

  // --- stack-safe deep link helpers ---
  const openTrailDetail = useCallback(() => {
    if (!activeTrail) return;
    // Step 1: ensure TrailList is active in its stack
    navigation.navigate('TrailsTab', { screen: 'TrailList' });
    // Step 2: push TrailDetail so Back goes to TrailList
    setTimeout(() => {
      navigation.navigate('TrailsTab', {
        screen: 'TrailDetail',
        params: { trailId: activeTrail.id, trailName: activeTrail.name },
      });
    }, 0);
  }, [navigation, activeTrail]);

  const openRunDetail = useCallback((row) => {
    if (!activeTrail || !row) return;
    // Step 1: ensure RunList is active in its stack
    navigation.navigate('RunsTab', { screen: 'RunList' });
    // Step 2: push RunDetail so Back goes to RunList
    setTimeout(() => {
      navigation.navigate('RunsTab', {
        screen: 'RunDetail',
        params: { run: row, trailName: activeTrail.name },
      });
    }, 0);
  }, [navigation, activeTrail]);

  // UI
  if (!activeTrail) {
    return (
      <View style={styles.skeleton}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const header = (
    <View style={styles.headerCard}>
      <View style={styles.headerTopRow}>
        {/* Trail title → TrailDetail (stack-safe) */}
        <TouchableOpacity onPress={openTrailDetail} activeOpacity={0.7}>
          <Text style={styles.trailName}>{activeTrail.name}</Text>
        </TouchableOpacity>

        {/* Controls: play/pause + page badge */}
        <View style={styles.controlsCluster}>
          <TouchableOpacity
            onPress={() => setPaused(p => !p)}
            style={styles.iconBtn}
            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
            activeOpacity={0.7}
          >
            <MaterialIcons name={paused || dwellMsState === 0 ? 'play-arrow' : 'pause'} size={18} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.pageBadge}>{index + 1}/{totalTrails}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>
            {totalRunsForActive} total run{totalRunsForActive === 1 ? '' : 's'}
          </Text>
        </View>
        {activeTrail.difficulty ? (
          <View style={[styles.metaPill, styles.diffPill]}>
            <Text style={[styles.metaPillText, styles.diffPillText]}>{activeTrail.difficulty}</Text>
          </View>
        ) : null}
      </View>

      {/* dwell time chips (includes Off = no autoplay) */}
      <View style={styles.dwellRow}>
        {[
          { label: 'Off', val: 0 },
          { label: '2s',  val: 2000 },
          { label: '4s',  val: 4000 },
          { label: '8s',  val: 8000 },
        ].map(opt => {
          const sel = dwellMsState === opt.val;
          return (
            <TouchableOpacity
              key={opt.val}
              style={[styles.dwellChip, sel && styles.dwellChipSelected]}
              onPress={() => { setDwellMsState(opt.val); persistDwell(opt.val); setPaused(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.dwellChipText, sel && styles.dwellChipTextSelected]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const panelBody = (
    <>
      {topRows.map((row, idx) => {
        const rank = idx + 1;
        const mph = mphFrom(row);
        const dateStr = row.timestamp ? new Date(row.timestamp).toLocaleDateString() : '';
        const isTop = rank <= 3;
        const isMe = user?.id && row.userId === user.id;

        return (
          <TouchableOpacity
            key={row.id || `${activeTrail.id}-${rank}`}
            style={[styles.row, isTop && styles.rowTop, isMe && styles.rowMe]}
            activeOpacity={0.75}
            onPress={() => openRunDetail(row)}   // ← stack-safe deep link
          >
            <View style={styles.rankCol}>
              <Text style={styles.medal}>{medalFor(rank)}</Text>
            </View>
            <View style={styles.mainCol}>
              <Text style={[styles.userLine, isMe && styles.meText]}>
                {(users.find(u => u.id === row.userId)?.name || 'Unknown User')}
                <Text style={styles.sep}> • </Text>
                {(() => {
                  const v = vehicles.find(x => x.id === row.vehicleId);
                  return v ? `${v.make} ${v.model}${v.year ? ` (${v.year})` : ''}` : 'Unknown Vehicle';
                })()}
              </Text>
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Time</Text>
                  <Text style={styles.metricValue}>{fmtDuration(row.duration)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Avg</Text>
                  <Text style={styles.metricValue}>{mph.toFixed(1)} mph</Text>
                </View>
                {row.distance != null && (
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Dist</Text>
                    <Text style={styles.metricValue}>{(row.distance / 1609.344).toFixed(2)} mi</Text>
                  </View>
                )}
                {dateStr ? (
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Date</Text>
                    <Text style={styles.metricValue}>{dateStr}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </>
  );

  return (
    <View style={styles.wrap}>
      {/* tap panel background to pause/resume autoplay (optional) */}
      <TouchableOpacity
        activeOpacity={pauseOnPress ? 0.92 : 1}
        onPress={() => pauseOnPress && setPaused(p => !p)}
      >
        {header}
        <View style={styles.panel}>
          {loadingTrailId === activeTrail.id && !leadersByTrail[activeTrail.id] ? (
            <View style={styles.center}><ActivityIndicator size="large" /></View>
          ) : topRows.length === 0 ? (
            <View style={styles.emptyWrap}><Text style={styles.empty}>No runs yet for this trail.</Text></View>
          ) : (
            panelBody
          )}
        </View>
      </TouchableOpacity>

      {/* dots */}
      <View style={styles.dotsRow}>
        {cyclableTrails.map((t, i) => (
          <View key={t.id} style={[styles.dot, i === index ? styles.dotActive : null]} />
        ))}
      </View>

      {/* quick trail chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.trailChipsScroll}
        contentContainerStyle={styles.trailChips}
      >
        {cyclableTrails.map((t, i) => {
          const selected = i === index;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.trailChip, selected && styles.trailChipSelected]}
              onPress={() => setIndex(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.trailChipText, selected && styles.trailChipTextSelected]}>
                {t.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12 },

  headerCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trailName: { color: '#FFF', fontSize: 18, fontWeight: '700' },

  controlsCluster: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111827',
    marginRight: 6,
  },
  pageBadge: {
    color: '#FFF',
    backgroundColor: '#111827',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, fontSize: 12, fontWeight: '700',
  },

  metaRow: { flexDirection: 'row', marginTop: 8 },
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

  dwellRow: { flexDirection: 'row', marginTop: 10, flexWrap: 'wrap' },
  dwellChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#1F2937',
    borderRadius: 999, marginRight: 8, marginTop: 6,
  },
  dwellChipSelected: { backgroundColor: '#2563EB' },
  dwellChipText: { color: '#E5E7EB', fontSize: 12, fontWeight: '700' },
  dwellChipTextSelected: { color: '#FFF' },

  panel: { backgroundColor: '#FFF', borderRadius: 12, padding: 8, elevation: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEE',
  },
  rowTop: { backgroundColor: '#FFFDF5' },
  rowMe: { backgroundColor: '#ECFDF5' },
  rankCol: { width: 42, alignItems: 'center' },
  medal: { fontSize: 20 },
  mainCol: { flex: 1, paddingRight: 8 },
  userLine: { fontSize: 15, fontWeight: '600', color: '#111' },
  meText: { color: '#065F46' },
  sep: { color: '#999' },
  metricsRow: { flexDirection: 'row', marginTop: 6, flexWrap: 'wrap' },
  metric: { marginRight: 12, marginTop: 4 },
  metricLabel: { fontSize: 11, color: '#6B7280' },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#111' },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8, marginBottom: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD', marginHorizontal: 3 },
  dotActive: { backgroundColor: '#111' },

  trailChipsScroll: { maxHeight: 48 },
  trailChips: { paddingHorizontal: 4, paddingVertical: 8 },
  trailChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#EEE',
    borderRadius: 16, marginRight: 8,
  },
  trailChipSelected: { backgroundColor: '#007AFF' },
  trailChipText: { color: '#333', fontWeight: '500' },
  trailChipTextSelected: { color: '#FFF' },

  center: { paddingVertical: 24, alignItems: 'center' },
  emptyWrap: { paddingVertical: 16, alignItems: 'center' },
  empty: { color: '#6B7280' },

  skeleton: { padding: 24, alignItems: 'center', justifyContent: 'center' },
});
