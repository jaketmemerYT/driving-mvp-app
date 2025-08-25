// AddTrail.js
import React, { useState, useRef, useLayoutEffect, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function AddTrail({ navigation }) {
  const { prefs } = useContext(UserContext);

  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);

  // We record a full trace; each item may include lat/lon plus extra props if device provides them.
  const [route, setRoute] = useState([]);
  const [recording, setRecording] = useState(false);

  // Safe initialRegion once we have a fix
  const [region, setRegion] = useState(null);

  const watchRef = useRef(null);
  const mapRef = useRef(null);

  // Header
  useLayoutEffect(() => {
    navigation.setOptions({ title: 'New Trail' });
  }, [navigation]);

  // Acquire initial location & seed start/region/route
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow location access to create a trail.');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!mounted) return;

        const pt = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          speed: loc.coords.speed ?? 0,
          heading: loc.coords.heading ?? 0,
          altitude: loc.coords.altitude ?? 0,
          accuracy: loc.coords.accuracy ?? 0,
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
      try {
        watchRef.current?.remove?.();
      } catch {}
      watchRef.current = null;
    };
  }, []);

  const onMapPress = (e) => {
    if (recording) return; // only set endpoint when not recording
    const { coordinate } = e.nativeEvent || {};
    if (coordinate?.latitude != null && coordinate?.longitude != null) {
      setEndCoords({ latitude: coordinate.latitude, longitude: coordinate.longitude });
    }
  };

  const beginRecording = async () => {
    if (!name.trim()) {
      Alert.alert('Trail name required', 'Please enter a name for this trail.');
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow location access to record the trail.');
        return;
      }

      setRecording(true);

      // Subscribe to location updates
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
            // Avoid duplicating identical consecutive fixes by lat/lon
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              if (last.latitude === pt.latitude && last.longitude === pt.longitude) {
                return prev; // no change
              }
            }
            return [...prev, pt];
          });

          // keep camera roughly following user
          mapRef.current?.animateToRegion?.({
            latitude: pt.latitude,
            longitude: pt.longitude,
            latitudeDelta: region?.latitudeDelta ?? 0.01,
            longitudeDelta: region?.longitudeDelta ?? 0.01,
          });
        }
      );
    } catch (err) {
      console.error('Begin recording error', err);
      Alert.alert('Error', err.message || 'Could not start recording.');
    }
  };

  const stopAndSave = async () => {
    try {
      watchRef.current?.remove?.();
    } catch {}
    watchRef.current = null;
    setRecording(false);

    // Final endpoint: explicit endCoords or last recorded fix
    const finalEnd =
      endCoords ||
      (route.length > 0
        ? { latitude: route[route.length - 1].latitude, longitude: route[route.length - 1].longitude }
        : startCoords);

    if (!startCoords || !Array.isArray(route) || route.length === 0) {
      Alert.alert('Not enough data', 'No route was recorded. Please try again.');
      return;
    }

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
      // You can wire these up later to chips/inputs if needed:
      categoryIds: [],
      groupIds: [],
    };

    try {
      const res = await axios.post(`${API_BASE}/api/trailheads`, payload);
      // Navigate to the new trail’s detail screen
      navigation.replace('TrailDetail', {
        trailId: res.data.id,
        trailName: res.data.name,
      });
    } catch (err) {
      console.error('Save trail error', err);
      Alert.alert('Error', err.response?.data?.error || err.message || 'Could not save trail.');
    }
  };

  // UI guards
  const canBegin = !!region && !!name.trim() && !recording;
  const canStopAndSave = recording && route.length > 0;

  // Loading: we must have a region to render the map safely
  if (!region) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: '#666' }}>Acquiring GPS…</Text>
      </View>
    );
  }

  // Colors from preferences (fallbacks provided)
  const officialColor = prefs?.officialRouteColor || '#000000';

  return (
    <View style={styles.container}>
      {/* Basic inputs */}
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

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onPress={onMapPress}
      >
        {/* OSM tiles (remove UrlTile if you prefer the default vector map only) */}
        <UrlTile
          urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          shouldReplaceMapContent
        />

        {startCoords && <Marker coordinate={startCoords} title="Trailhead" />}
        {endCoords && <Marker coordinate={endCoords} pinColor="green" title="Trail End" />}

        {route.length > 1 && (
          <Polyline
            coordinates={route.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
            strokeWidth={4}
            strokeColor={officialColor}
          />
        )}
      </MapView>

      <View style={styles.footer}>
        {!recording ? (
          <>
            <Text style={styles.hint}>Tip: tap on the map to set an endpoint before you start (optional).</Text>
            <Button title="Begin Recording" onPress={beginRecording} disabled={!canBegin} />
          </>
        ) : (
          <Button title="Stop & Save" onPress={stopAndSave} disabled={!canStopAndSave} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    padding: 10,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 6,
  },
  map: { flex: 1, marginTop: 8 },
  footer: { padding: 16 },
  hint: { color: '#666', marginBottom: 8 },
});
