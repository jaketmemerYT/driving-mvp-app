// LeaderboardMarquee.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

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

const medalFor = (rank) => (['🥇','🥈','🥉'][rank - 1] || `${rank}.`);

export default function LeaderboardMarquee({
  trails = [],
  routes = [],
  users = [],
  vehicles = [],
  selectedTrailId,                // optional: controlled selection from parent (chips)
  onSelectedTrailIdChange,        // optional callback when marquee cycles
  cycleMs = 4000,
  autoplay = true,
  highlightUserId = null,
  onRowPress,                     // ({ run, trail }) => void
  onTrailPress,                   // (trail) => void
}) {
  const isFocused = useIsFocused();

  // App foreground detection
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppIsActive(s === 'active'));
    return () => sub.remove();
  }, []);

  // Build “eligible” trail list for auto-cycle (has >=1 run)
  const trailsWithRuns = useMemo(() => {
    const byTrail = new Map();
    routes.forEach(r => {
      byTrail.set(r.trailId, (byTrail.get(r.trailId) || 0) + 1);
    });
    return trails.filter(t => (byTrail.get(t.id) || 0) > 0);
  }, [trails, routes]);

  // If selectedTrailId is not provided, maintain our own index; else mirror the parent’s selection
  const [internalIndex, setInternalIndex] = useState(0);
  const effectiveTrail = useMemo(() => {
    if (selectedTrailId) {
      return trails.find(t => t.id === selectedTrailId) || null;
    }
    return trailsWithRuns.length
      ? trailsWithRuns[internalIndex % trailsWithRuns.length]
      : (trails[0] || null);
  }, [selectedTrailId, trails, trailsWithRuns, internalIndex]);

  // --- Auto-cycle with focus + foreground + cleanup
  const timerRef = useRef(null);
  const lastBuzzAtRef = useRef(0);

  useEffect(() => {
    const canRun = autoplay && cycleMs > 0 && trailsWithRuns.length > 1 && isFocused && appIsActive;

    // clear any existing
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!canRun) return;

    timerRef.current = setInterval(() => {
      if (selectedTrailId) {
        // Controlled mode: compute next from current selectedTrailId
        const idx = Math.max(0, trailsWithRuns.findIndex(t => t.id === selectedTrailId));
        const next = trailsWithRuns[(idx + 1) % trailsWithRuns.length];
        onSelectedTrailIdChange?.(next.id);
      } else {
        // Uncontrolled mode: bump our local index
        setInternalIndex((prev) => (prev + 1) % trailsWithRuns.length);
      }

      // Haptic (throttled)
      const now = Date.now();
      if (now - lastBuzzAtRef.current > 700) {
        lastBuzzAtRef.current = now;
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
      }
    }, cycleMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    autoplay,
    cycleMs,
    isFocused,
    appIsActive,
    trailsWithRuns,               // safe: recreated only when list changes
    selectedTrailId,
    onSelectedTrailIdChange
  ]);

  const top5 = useMemo(() => {
    if (!effectiveTrail) return [];
    return routes
      .filter(r => r.trailId === effectiveTrail.id)
      .sort((a, b) => a.duration - b.duration)
      .slice(0, 5);
  }, [routes, effectiveTrail]);

  // Pad to 5 rows for stable height
  const rows = useMemo(() => {
    const padded = [...top5];
    while (padded.length < 5) padded.push({ id: `placeholder-${padded.length}` });
    return padded;
  }, [top5]);

  const userName = useCallback(
    (uid) => users.find(u => u.id === uid)?.name || 'Unknown',
    [users]
  );
  const vehicleLabel = useCallback(
    (vid) => {
      const v = vehicles.find(x => x.id === vid);
      return v ? `${v.make} ${v.model}${v.year ? ` (${v.year})` : ''}` : 'Vehicle';
    },
    [vehicles]
  );
  const topVehiclePhoto = useMemo(() => {
    const top = top5[0];
    if (!top) return null;
    const v = vehicles.find(x => x.id === top.vehicleId);
    return v?.photoUrl || null;
  }, [vehicles, top5]);

  const keyExtractor = (item, index) => item.id || `row-${index}`;

  const Hero = () => {
    const r = rows[0];
    const isPlaceholder = !r?.userId;
    const mph = r ? mphFrom(r) : 0;
    const dateStr = r?.timestamp ? new Date(r.timestamp).toLocaleDateString() : '';

    return (
      <TouchableOpacity
        activeOpacity={isPlaceholder ? 1 : 0.8}
        onPress={() => !isPlaceholder && onRowPress?.({ run: r, trail: effectiveTrail })}
        style={[styles.hero, isPlaceholder && styles.heroPlaceholder]}
      >
        <View style={styles.heroPhotoWrap}>
          {topVehiclePhoto ? (
            <Image source={{ uri: topVehiclePhoto }} style={styles.heroPhoto} resizeMode="cover" />
          ) : (
            <View style={[styles.heroPhoto, styles.heroPhotoEmpty]}>
              <Text style={styles.photoEmptyTxt}>No Photo</Text>
            </View>
          )}
          <View style={styles.medalBadge}>
            <Text style={styles.medalTxt}>🥇</Text>
          </View>
        </View>
        <View style={styles.heroMeta}>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {effectiveTrail?.name || 'Trail'}
          </Text>
          <Text style={styles.heroUser} numberOfLines={1}>
            {isPlaceholder ? '—' : `${userName(r.userId)} • ${vehicleLabel(r.vehicleId)}`}
          </Text>
          <View style={styles.heroMetrics}>
            <Text style={styles.heroMetric}>
              {isPlaceholder ? '—' : fmtDuration(r.duration)}
            </Text>
            <Text style={styles.heroDot}>•</Text>
            <Text style={styles.heroMetric}>
              {isPlaceholder ? '—' : `${mph.toFixed(1)} mph`}
            </Text>
            {dateStr ? (
              <>
                <Text style={styles.heroDot}>•</Text>
                <Text style={styles.heroMetric}>{dateStr}</Text>
              </>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRow = ({ item, index }) => {
    const rank = index + 1;
    const isPlaceholder = !item?.userId;
    const mph = mphFrom(item);
    const isHighlighted = !!highlightUserId && item.userId === highlightUserId;

    return (
      <TouchableOpacity
        activeOpacity={isPlaceholder ? 1 : 0.8}
        onPress={() => !isPlaceholder && onRowPress?.({ run: item, trail: effectiveTrail })}
        style={[
          styles.row,
          rank <= 3 && styles.rowTop,
          isHighlighted && styles.rowHighlight,
        ]}
      >
        <View style={styles.rankCol}>
          <Text style={styles.rankTxt}>{medalFor(rank)}</Text>
        </View>
        <View style={styles.mainCol}>
          <Text style={styles.userLine} numberOfLines={1}>
            {isPlaceholder ? '—' : `${userName(item.userId)} • ${vehicleLabel(item.vehicleId)}`}
          </Text>
          <View style={styles.metricsRow}>
            <Text style={styles.metric}>
              {isPlaceholder ? '—' : fmtDuration(item.duration)}
            </Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.metric}>
              {isPlaceholder ? '—' : `${mph.toFixed(1)} mph`}
            </Text>
          </View>
        </View>
        <View style={styles.ctaCol}>
          {!isPlaceholder && <Text style={styles.linkBtnTxt}>View</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.card}>
      {/* Trail title as a link */}
      <TouchableOpacity onPress={() => effectiveTrail && onTrailPress?.(effectiveTrail)} activeOpacity={0.8}>
        <Text style={styles.cardTitle}>
          {effectiveTrail?.name || 'Leaderboard'}
        </Text>
      </TouchableOpacity>

      {/* Hero */}
      <Hero />

      {/* Top 5 (fixed height via always 5 rows) */}
      <FlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  cardTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },

  // Hero
  hero: {
    marginTop: 10,
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  heroPlaceholder: { opacity: 0.85 },
  heroPhotoWrap: { width: 92, height: 68, marginRight: 10 },
  heroPhoto: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: '#0B1220' },
  heroPhotoEmpty: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#1F2937',
  },
  photoEmptyTxt: { color: '#9CA3AF', fontSize: 12 },
  medalBadge: {
    position: 'absolute', top: -8, left: -8, backgroundColor: '#0F172A',
    borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2,
  },
  medalTxt: { fontSize: 16 },

  heroMeta: { flex: 1, minWidth: 0 },
  heroTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  heroUser: { color: '#D1D5DB', marginTop: 2 },
  heroMetrics: { flexDirection: 'row', marginTop: 6, alignItems: 'center' },
  heroMetric: { color: '#E5E7EB', fontWeight: '600' },
  heroDot: { color: '#6B7280', marginHorizontal: 6 },

  // Rows
  sep: { height: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  rowTop: { backgroundColor: '#11161F' },
  rowHighlight: { borderWidth: 1, borderColor: '#6366F1' },

  rankCol: { width: 36, alignItems: 'center' },
  rankTxt: { fontSize: 18, color: '#FDE68A' },
  mainCol: { flex: 1, paddingRight: 8, minWidth: 0 },
  userLine: { color: '#F9FAFB', fontWeight: '600' },
  metricsRow: { flexDirection: 'row', marginTop: 4, alignItems: 'center' },
  metric: { color: '#E5E7EB' },
  dot: { color: '#6B7280', marginHorizontal: 6 },
  ctaCol: { paddingLeft: 6 },
  linkBtnTxt: { color: '#D1D5DB', fontWeight: '600' },
});
