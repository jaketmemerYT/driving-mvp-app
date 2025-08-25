// RunDetail.js
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useContext } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import MapView, { Polyline, Marker, UrlTile } from 'react-native-maps';
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

function msToHMS(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

function metersToMiles(m) {
  return m / 1609.344;
}

export default function RunDetail({ route, navigation }) {
  const { prefs } = useContext(UserContext);
  const { run, trailName: initialTrailName } = route.params;

  const [trail, setTrail] = useState(null);          // {coords, endCoords, route, name...}
  const [vehName, setVehName] = useState(null);      // "Make Model (Year)"
  const [userName, setUserName] = useState(null);    // "Runner Name"
  const [loading, setLoading] = useState(true);

  const mapRef = useRef(null);

  const officialColor = prefs?.officialRouteColor || '#000000';
  const liveColor     = prefs?.liveRouteColor     || '#1976D2';

  // Header title
  useLayoutEffect(() => {
    navigation.setOptions({
      title: initialTrailName || 'Run Detail',
    });
  }, [navigation, initialTrailName]);

  // Load trail + vehicle + user
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const tasks = [];

        // Trail (for official route overlay)
        if (run?.trailId) {
          tasks.push(
            axios.get(`${API_BASE}/api/trailheads/${run.trailId}`).then((r) => {
              if (!mounted) return;
              setTrail(r.data);
            })
          );
        }

        // Vehicle label
        tasks.push(
          axios.get(`${API_BASE}/api/vehicles`).then((r) => {
            if (!mounted) return;
            const v = (r.data || []).find((x) => x.id === run?.vehicleId);
            if (v) setVehName(`${v.make} ${v.model} (${v.year})`);
          })
        );

        // User label
        tasks.push(
          axios.get(`${API_BASE}/api/users`).then((r) => {
            if (!mounted) return;
            const u = (r.data || []).find((x) => x.id === run?.userId);
            if (u) setUserName(u.name);
          })
        );

        await Promise.all(tasks);
      } catch (err) {
        console.error('RunDetail load failed', err);
        Alert.alert('Error', err?.response?.data?.error || err.message || 'Load failed');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [run?.trailId, run?.vehicleId, run?.userId]);

  // Build map bounds to fit both official route & actual run
  const fitAll = () => {
    const coords = [];
    if (Array.isArray(trail?.route)) {
      trail.route.forEach((p) => {
        if (p?.latitude != null && p?.longitude != null) coords.push({ latitude: p.latitude, longitude: p.longitude });
      });
    }
    if (Array.isArray(run?.coords)) {
      run.coords.forEach((p) => {
        if (p?.latitude != null && p?.longitude != null) coords.push({ latitude: p.latitude, longitude: p.longitude });
      });
    }
    if (coords.length >= 2 && mapRef.current) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  };

  // After load, fit
  useEffect(() => {
    if (!loading) {
      // small delay so MapView mounts
      const t = setTimeout(fitAll, 250);
      return () => clearTimeout(t);
    }
  }, [loading, trail?.route, run?.coords]);

  // Initial region fallback if we can’t fit yet (e.g., single point runs)
  const initialRegion = useMemo(() => {
    const first =
      (Array.isArray(run?.coords) && run.coords[0]) ||
      trail?.coords ||
      { latitude: 37.7749, longitude: -122.4194 }; // SF fallback
    return {
      latitude: first.latitude,
      longitude: first.longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    };
  }, [trail?.coords, run?.coords]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const officialRoute = Array.isArray(trail?.route) ? trail.route : [];
  const actualRoute   = Array.isArray(run?.coords)  ? run.coords  : [];

  const startRun = actualRoute[0];
  const endRun   = actualRoute[actualRoute.length - 1];

  const titleName = trail?.name || initialTrailName || 'Trail';

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>{titleName}</Text>

      <View style={styles.mapWrap}>
        <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion}>
          {/* OSM tiles for nice background */}
          <UrlTile
            urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            shouldReplaceMapContent
          />

          {/* Official route (black or prefs.officialRouteColor) */}
          {officialRoute.length > 1 && (
            <Polyline
              coordinates={officialRoute.map((p) => ({
                latitude: p.latitude,
                longitude: p.longitude,
              }))}
              strokeWidth={5}
              strokeColor={officialColor}
            />
          )}

          {/* Actual run (prefs.liveRouteColor) */}
          {actualRoute.length > 1 && (
            <Polyline
              coordinates={actualRoute.map((p) => ({
                latitude: p.latitude,
                longitude: p.longitude,
              }))}
              strokeWidth={4}
              strokeColor={liveColor}
            />
          )}

          {/* Markers */}
          {trail?.coords && <Marker coordinate={trail.coords} title="Trailhead" />}
          {trail?.endCoords && <Marker coordinate={trail.endCoords} title="Trail End" pinColor="green" />}

          {startRun && <Marker coordinate={startRun} title="Run Start" />}
          {endRun && <Marker coordinate={endRun} title="Run End" pinColor="purple" />}
        </MapView>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: officialColor }]} />
            <Text style={styles.legendText}>Official Route</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: liveColor }]} />
            <Text style={styles.legendText}>Your Run</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.card}>
        <Text style={styles.section}>Summary</Text>
        <Text style={styles.kv}><Text style={styles.k}>Date:</Text> {new Date(run.timestamp).toLocaleString()}</Text>
        <Text style={styles.kv}><Text style={styles.k}>Duration:</Text> {msToHMS(run.duration)}</Text>
        {'distance' in run && (
          <Text style={styles.kv}>
            <Text style={styles.k}>Distance:</Text> {metersToMiles(run.distance).toFixed(2)} mi
          </Text>
        )}
        {'avgSpeed' in run && (
          <Text style={styles.kv}><Text style={styles.k}>Avg Speed:</Text> {run.avgSpeed.toFixed(2)} m/s</Text>
        )}
        {'minSpeed' in run && (
          <Text style={styles.kv}><Text style={styles.k}>Min Speed:</Text> {run.minSpeed.toFixed(2)} m/s</Text>
        )}
        {'maxSpeed' in run && (
          <Text style={styles.kv}><Text style={styles.k}>Max Speed:</Text> {run.maxSpeed.toFixed(2)} m/s</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Runner</Text>
        <Text style={styles.kv}><Text style={styles.k}>User:</Text> {userName || run.userId}</Text>
        <Text style={styles.kv}><Text style={styles.k}>Vehicle:</Text> {vehName || run.vehicleId}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  title: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },

  mapWrap: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  map: { height: 260, width: '100%' },

  legend: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  swatch: { width: 14, height: 14, borderRadius: 7, marginRight: 6 },
  legendText: { fontSize: 12, color: '#333' },

  card: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  section: { fontWeight: '700', marginBottom: 6 },
  kv: { marginBottom: 4, color: '#333' },
  k: { fontWeight: '600' },
});
