// AddTrail.js
import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';

import MapBase from './MapBase';
import { API_BASE } from './config';
import { useRouteColors } from './useRouteColors';

// Simple haversine in meters for live stats
function distanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const sq = s1 * s1 + s2 * s2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(sq));
}

export default function AddTrail({ navigation }) {
  const { officialColor } = useRouteColors();

  // Inputs
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState('');

  // Geo state
  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);  // <-- fixed
  const [route, setRoute] = useState([]);            // array of rich points
  const [region, setRegion] = useState(null);

  // Recording state
  const [recording, setRecording] = useState(false);
  const watchRef = useRef(null);
  const mapRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'New Trail' });
  }, [navigation]);

  // Initial location → sets startCoords, seeds route, sets region
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Allow location to create a trail.');
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!mounted || !loc?.coords) return;

        const c = loc.coords;
        const pt = {
          latitude: c.latitude,
          longitude: c.longitude,
          speed: c.speed ?? 0,
          heading: c.heading ?? 0,
          altitude: c.altitude ?? 0,
          accuracy: c.accuracy ?? 0,
          timestamp: loc.timestamp ?? Date.now(),
        };

        setStartCoords({ latitude: pt.latitude, longitude: pt.longitude });
        setRoute([pt]);
        setRegion({
          latitude: pt.latitude,
          longitude: pt.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (err) {
        console.error('Initial location error', err);
        Alert.alert('Location error', err.message || 'Could not get current location.');
      }
    })();
    return () => {
      mounted = false;
      try { watchRef.current?.remove?.(); } catch {}
      watchRef.current = null;
    };
  }, []);

  const onMapPress = (e) => {
    if (recording) return;
    const { coordinate } = e.nativeEvent || {};
    if (coordinate?.latitude == null || coordinate?.longitude == null) return;
    setEndCoords({ latitude: coordinate.latitude, longitude: coordinate.longitude });
  };

  const liveStats = useMemo(() => {
    if (route.length < 2) {
      return { distance: 0, duration: 0, avgSpeed: 0, minSpeed: 0, maxSpeed: 0 };
    }
    let dist = 0;
    let minS = Infinity;
    let maxS = -Infinity;
    for (let i = 1; i < route.length; i++) {
      dist += distanceMeters(route[i - 1], route[i]);
    }
    for (const p of route) {
      const s = p.speed || 0;
      if (s < minS) minS = s;
      if (s > maxS) maxS = s;
    }
    if (minS === Infinity) minS = 0;
    if (maxS === -Infinity) maxS = 0;

    const durSec = Math.max(
      0,
      Math.round((route[route.length - 1].timestamp - route[0].timestamp) / 1000)
    );
    const avg = durSec > 0 ? dist / durSec : 0;
    return { distance: dist, duration: durSec, avgSpeed: avg, minSpeed: minS, maxSpeed: maxS };
  }, [route]);

  const beginRecording = async () => {
    if (!name.trim()) {
      Alert.alert('Trail name required', 'Please enter a name before recording.');
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location to record the trail.');
        return;
      }

      setRecording(true);
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 1000 },
        (loc) => {
          const c = loc?.coords;
          if (!c) return;

          const pt = {
            latitude: c.latitude,
            longitude: c.longitude,
            speed: c.speed ?? 0,
            heading: c.heading ?? 0,
            altitude: c.altitude ?? 0,
            accuracy: c.accuracy ?? 0,
            timestamp: loc.timestamp ?? Date.now(),
          };

          setRoute((prev) => {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              if (last.latitude === pt.latitude && last.longitude === pt.longitude) {
                return prev; // skip exact duplicates
              }
            }
            return [...prev, pt];
          });

          // follow camera
          const latDelta = region?.latitudeDelta ?? 0.01;
          const lonDelta = region?.longitudeDelta ?? 0.01;
          mapRef.current?.animateToRegion?.({
            latitude: pt.latitude,
            longitude: pt.longitude,
            latitudeDelta: latDelta,
            longitudeDelta: lonDelta,
          });
        }
      );
    } catch (err) {
      console.error('Begin recording error', err);
      Alert.alert('Error', err.message || 'Could not start recording.');
    }
  };

  const stopAndSave = async () => {
    try { watchRef.current?.remove?.(); } catch {}
    watchRef.current = null;
    setRecording(false);

    if (!startCoords || route.length === 0) {
      Alert.alert('Not enough data', 'Record at least a short path.');
      return;
    }

    const finalEnd =
      endCoords ||
      { latitude: route[route.length - 1].latitude, longitude: route[route.length - 1].longitude };

    const payload = {
      name: name.trim(),
      difficulty: difficulty.trim() || 'Unknown',
      coords: { ...startCoords },
      endCoords: finalEnd,
      route: route.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        speed: p.speed ?? 0,
        heading: p.heading ?? 0,
        altitude: p.altitude ?? 0,
        accuracy: p.accuracy ?? 0,
        timestamp: p.timestamp ?? Date.now(),
      })),
      categoryIds: [],
      groupIds: [],
    };

    try {
      const res = await axios.post(`${API_BASE}/api/trailheads`, payload);
      navigation.replace('TrailDetail', {
        trailId: res.data.id,
        trailName: res.data.name,
      });
    } catch (err) {
      console.error('Save trail error', err);
      Alert.alert('Error', err.response?.data?.error || err.message || 'Could not save trail.');
    }
  };

  const canBegin = !!region && !!name.trim() && !recording;
  const canStop = recording && route.length > 0;

  if (!region) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.dim}>Acquiring GPS…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Inputs */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Trail name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Difficulty (optional)"
          value={difficulty}
          onChangeText={setDifficulty}
        />
      </View>

      {/* Map with tiles via MapBase */}
      <View style={styles.mapWrap}>
        <MapBase ref={mapRef} initialRegion={region} onPress={onMapPress}>
          {startCoords && <Marker coordinate={startCoords} title="Trailhead" />}
          {endCoords && <Marker coordinate={endCoords} pinColor="green" title="Trail End" />}
          {route.length > 1 && (
            <Polyline
              coordinates={route.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
              strokeWidth={4}
              strokeColor={officialColor}
            />
          )}
        </MapBase>
      </View>

      {/* Live stats + controls */}
      <View style={styles.footer}>
        {recording ? (
          <>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>Dist: {(liveStats.distance / 1000).toFixed(2)} km</Text>
              <Text style={styles.stat}>Time: {liveStats.duration}s</Text>
              <Text style={styles.stat}>Avg: {liveStats.avgSpeed.toFixed(1)} m/s</Text>
            </View>
            <Button title="Stop & Save" onPress={stopAndSave} disabled={!canStop} />
          </>
        ) : (
          <>
            <Text style={styles.hint}>Tip: Tap the map to set an endpoint (optional).</Text>
            <Button title="Begin Recording" onPress={beginRecording} disabled={!canBegin} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#FFF' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dim:        { color: '#666', marginTop: 8 },
  form:       { paddingHorizontal: 12, paddingTop: 12 },
  input: { borderWidth: 1, borderColor: '#CCC', padding: 10, borderRadius: 6, marginBottom: 8 },
  mapWrap:    { flex: 1, marginTop: 4 },
  footer:     { padding: 12, gap: 8 },
  hint:       { color: '#666', marginBottom: 4 },
  statsRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  stat:       { color: '#333' },
});
