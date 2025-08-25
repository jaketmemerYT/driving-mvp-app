// Tracker.js
import React, { useState, useRef, useEffect, useLayoutEffect, useContext } from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Button,
} from 'react-native';
import { Polyline, Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';

import MapBase from './MapBase';            // <-- tiled base map
import { API_BASE } from './config';
import { UserContext } from './UserContext';

// --- helpers ---
const FT_TO_M = 0.3048;

function haversineMeters(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + s2 * s2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// nearest distance to any point in an official polyline (fast, good enough for MVP)
function minDistanceToPolylineMeters(pt, polyline) {
  if (!Array.isArray(polyline) || polyline.length === 0) return Infinity;
  let min = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const d = haversineMeters(pt, polyline[i]);
    if (d < min) min = d;
  }
  return min;
}

export default function Tracker({ route, navigation }) {
  const { user, prefs } = useContext(UserContext);
  const {
    trailId,
    trailName,
    startCoords: startFromDetail,      // optional
    endCoords: endFromDetail,          // optional
  } = route.params;

  const [trail, setTrail] = useState(null); // fetch ensures we have official route
  const [vehicles, setVehicles] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  const [tracking, setTracking] = useState(false);
  const [region, setRegion] = useState(
    startFromDetail
      ? { ...startFromDetail, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      : null
  );

  const coordsRef = useRef([]);
  const [coords, setCoords] = useState([]);

  const startTime = useRef(null);
  const watchRef = useRef(null);
  const [strokeColor, setStrokeColor] = useState(
    prefs?.routeColor || '#1E90FF' // live route color default
  );

  // --- load trail & vehicles on focus ---
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        // fetch the single trail so we have official route + endCoords
        const t = await axios.get(`${API_BASE}/api/trailheads/${trailId}`);
        if (!active) return;
        setTrail(t.data);

        // vehicles limited to current user, if any
        if (user?.id) {
          const v = await axios.get(`${API_BASE}/api/vehicles?userId=${user.id}`);
          if (!active) return;
          setVehicles(v.data);
          if (v.data.length === 1) setSelectedVehicleId(v.data[0].id);
        } else {
          setVehicles([]); // no user selected
        }

        // if no region yet and we have start coords (from trail), seed map
        const start = startFromDetail || t.data.coords;
        if (!region && start && start.latitude != null) {
          setRegion({ ...start, latitudeDelta: 0.01, longitudeDelta: 0.01 });
        }
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Could not load trail/vehicles.');
      }
    };

    const unsubscribe = navigation.addListener('focus', load);
    return () => {
      active = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, trailId, user?.id]);

  // --- header start/stop ---
  useLayoutEffect(() => {
    navigation.setOptions({
      title: trailName || 'Tracker',
      headerRight: () => (
        <Button
          title={tracking ? 'Stop' : 'Start'}
          onPress={tracking ? stopTracking : startTracking}
          disabled={!selectedVehicleId}
        />
      ),
    });
  }, [navigation, tracking, selectedVehicleId, trailName]);

  // --- start tracking ---
  const startTracking = async () => {
    if (!user?.id) return Alert.alert('Profile', 'Select a profile first in Profile tab.');
    if (!selectedVehicleId) return Alert.alert('Vehicle', 'Pick a vehicle to continue.');

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Location', 'Permission denied.');
    }

    const initialLoc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const startPt = { ...initialLoc.coords };
    coordsRef.current = [startPt];
    setCoords([startPt]);

    if (!region) {
      setRegion({
        ...initialLoc.coords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }

    startTime.current = Date.now();
    setTracking(true);

    // reset to preferred live color on start
    setStrokeColor(prefs?.routeColor || '#1E90FF');

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 1000 },
      (loc) => {
        const pt = { ...loc.coords };
        coordsRef.current.push(pt);
        setCoords([...coordsRef.current]);

        // keep map centered
        setRegion((r) =>
          r
            ? { ...r, latitude: pt.latitude, longitude: pt.longitude }
            : { ...pt, latitudeDelta: 0.01, longitudeDelta: 0.01 }
        );

        // deviation warnings vs official route (if present)
        const official = trail?.route || [];
        if (official.length > 0) {
          const distM = minDistanceToPolylineMeters(pt, official);
          const warn50 = (prefs?.warn50Feet ?? 50) * FT_TO_M;
          const warn75 = (prefs?.warn75Feet ?? 75) * FT_TO_M;
          if (distM > warn75) {
            setStrokeColor(prefs?.warn75Color || '#FF0000');
          } else if (distM > warn50) {
            setStrokeColor(prefs?.warn50Color || '#FFA500');
          } else {
            setStrokeColor(prefs?.routeColor || '#1E90FF');
          }
        }
      }
    );
  };

  // --- stop tracking ---
  const stopTracking = async () => {
    watchRef.current?.remove();
    watchRef.current = null;
    setTracking(false);

    const runCoords = coordsRef.current;
    if (!runCoords || runCoords.length === 0) {
      return Alert.alert('No GPS', 'No GPS points recorded.');
    }

    // duration
    const duration = (Date.now() - (startTime.current || Date.now())) / 1000;

    // avg speed from points (m/s average of samples)
    const avgSpeed =
      runCoords.reduce((sum, c) => sum + (c.speed || 0), 0) / runCoords.length || 0;

    // post run
    try {
      const payload = {
        trailId,
        coords: runCoords,
        duration,
        avgSpeed,
        vehicleId: selectedVehicleId,
        userId: user.id,
        groupId: null,
      };
      const res = await axios.post(`${API_BASE}/api/routes`, payload);

      // clear local buffer
      coordsRef.current = [];
      setCoords([]);

      navigation.replace('RunDetail', { run: res.data, trailName });
    } catch (err) {
      console.error(err);
      Alert.alert('Upload failed', err.response?.data?.error || err.message);
    }
  };

  // --- render states ---
  if (!user) {
    return (
      <View style={styles.center}>
        <Text>Select a profile first in the Profile tab.</Text>
      </View>
    );
  }

  if (vehicles === null || !trail) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={styles.center}>
        <Button title="Add a Vehicle" onPress={() => navigation.navigate('AddVehicle')} />
      </View>
    );
  }

  if (!tracking) {
    return (
      <View style={styles.container}>
        <Text style={styles.subheader}>Select Your Vehicle</Text>
        {vehicles.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[styles.vehicleItem, v.id === selectedVehicleId && styles.selectedVehicle]}
            onPress={() => setSelectedVehicleId(v.id)}
          >
            <Text>{`${v.make} ${v.model} (${v.year})`}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // tracking map
  const startMarker = coords[0];
  const lastMarker = coords[coords.length - 1];
  const official = trail?.route || [];
  const officialColor = prefs?.officialRouteColor || '#000000';

  return (
    <MapBase style={styles.map} initialRegion={region}>
      {/* official route */}
      {official.length > 1 && (
        <Polyline coordinates={official} strokeWidth={4} strokeColor={officialColor} />
      )}

      {/* live route */}
      {coords.length > 1 && <Polyline coordinates={coords} strokeWidth={4} strokeColor={strokeColor} />}

      {/* markers */}
      {trail?.coords && <Marker coordinate={trail.coords} title="Trailhead" />}
      {trail?.endCoords && <Marker coordinate={trail.endCoords} title="End" pinColor="green" />}
      {startMarker && <Marker coordinate={startMarker} title="Start (This run)" />}
      {lastMarker && <Marker coordinate={lastMarker} title="You" />}
      {trail?.endCoords && <Circle center={trail.endCoords} radius={6} />}
    </MapBase>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  subheader: { marginBottom: 8, fontWeight: '500' },
  vehicleItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    marginBottom: 8,
  },
  selectedVehicle: {
    borderColor: '#007AFF',
    backgroundColor: '#E6F0FF',
  },
});
