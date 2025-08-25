// RunDetail.js
import React, { useEffect, useState, useRef, useContext } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Polyline, Marker } from 'react-native-maps';
import axios from 'axios';

import MapBase from './MapBase';         // <-- tiled base map
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function RunDetail({ route }) {
  const { run, trailName } = route.params;
  const { prefs } = useContext(UserContext);

  const [trail, setTrail] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [userName, setUserName] = useState(null);

  const mapRef = useRef(null);

  // load trail, vehicle, and user display name
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [tRes, vRes, uRes] = await Promise.all([
          axios.get(`${API_BASE}/api/trailheads/${run.trailId}`),
          axios.get(`${API_BASE}/api/vehicles`),
          axios.get(`${API_BASE}/api/users`),
        ]);
        if (!active) return;

        setTrail(tRes.data);
        setVehicle(vRes.data.find((v) => v.id === run.vehicleId) || null);
        const u = uRes.data.find((u) => u.id === run.userId);
        setUserName(u?.name || 'Unknown');
      } catch (err) {
        console.error(err);
      }
    };
    load();

    return () => {
      active = false;
    };
  }, [run.trailId, run.vehicleId, run.userId]);

  // fit map to both traces (official + this run)
  useEffect(() => {
    if (!mapRef.current || !trail || !run?.coords?.length) return;
    const official = trail.route || [];
    const coords = run.coords;

    const all = [...coords, ...official];
    if (all.length === 0) return;

    // pad around path
    mapRef.current.fitToCoordinates(all, {
      edgePadding: { top: 60, bottom: 40, left: 40, right: 40 },
      animated: false,
    });
  }, [trail, run?.coords]);

  if (!run?.coords?.length || !trail) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const officialColor = prefs?.officialRouteColor || '#000000';
  const liveColor = prefs?.routeColor || '#1E90FF';

  const startMarker = trail.coords;
  const endMarker = trail.endCoords || run.coords[run.coords.length - 1];

  return (
    <View style={styles.container}>
      <MapBase
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: run.coords[0].latitude,
          longitude: run.coords[0].longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {/* official route (black or preference) */}
        {Array.isArray(trail.route) && trail.route.length > 1 && (
          <Polyline coordinates={trail.route} strokeWidth={4} strokeColor={officialColor} />
        )}
        {/* run route (user preference color) */}
        {run.coords.length > 1 && (
          <Polyline coordinates={run.coords} strokeWidth={4} strokeColor={liveColor} />
        )}

        {startMarker && <Marker coordinate={startMarker} title="Trailhead" />}
        {endMarker && <Marker coordinate={endMarker} title="End" pinColor="green" />}
      </MapBase>

      <View style={styles.meta}>
        <Text style={styles.title}>{trailName || 'Run Detail'}</Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Runner:</Text> {userName || 'Unknown'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Vehicle:</Text>{' '}
          {vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year})` : 'Unknown'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Duration:</Text> {Math.round(run.duration)}s
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Distance:</Text>{' '}
          {run.distance ? `${run.distance.toFixed(1)} m` : '—'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Avg Speed:</Text>{' '}
          {run.avgSpeed ? `${run.avgSpeed.toFixed(2)} m/s` : '—'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Min/Max Speed:</Text>{' '}
          {run.minSpeed != null && run.maxSpeed != null
            ? `${run.minSpeed.toFixed(2)} / ${run.maxSpeed.toFixed(2)} m/s`
            : '—'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>When:</Text>{' '}
          {new Date(run.timestamp).toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  meta: { padding: 16, borderTopWidth: 1, borderColor: '#eee' },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  row: { marginTop: 4, color: '#333' },
  label: { fontWeight: '600' },
});
