// Tracker.js
import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect
} from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Button
} from 'react-native';
import MapView, { Polyline, Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE } from './config';

// Haversine for auto-stop logic
function distanceMeters(a, b) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const sq = sinDlat * sinDlat + sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(sq));
}

export default function Tracker({ route, navigation }) {
  const { trailId: paramTrailId, trailName, startCoords, endCoords } = route.params;
  const [trailId, setTrailId]       = useState(paramTrailId || null);
  const [vehicles, setVehicles]     = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [tracking, setTracking]     = useState(false);

  // We'll store full Location.coords objects here
  const coordsRef = useRef(startCoords ? [startCoords] : []);
  const [coords, setCoords] = useState(coordsRef.current);

  // Map region state
  const [region, setRegion] = useState(
    startCoords
      ? { ...startCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      : null
  );

  const startTime = useRef(null);
  const poller    = useRef(null);
  const mapRef    = useRef(null);

  // Reload vehicles on focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      axios.get(`${API_BASE}/api/vehicles`)
        .then(r => setVehicles(r.data))
        .catch(() => Alert.alert('Error', 'Could not load vehicles'));
    });
    return unsub;
  }, [navigation]);

  const startTracking = async () => {
    if (!selectedVehicleId) {
      return Alert.alert('Select a vehicle first');
    }

    // Create a new trail if needed
    if (trailName && !trailId) {
      const res = await axios.post(`${API_BASE}/api/trailheads`, { name: trailName });
      setTrailId(res.data.id);
    }

    // Request permissions & ensure GPS is on
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Location permission denied');
    }

    // Seed an initial fix (full coords object)
    const initialLoc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    coordsRef.current = [{ ...initialLoc.coords }];
    setCoords([...coordsRef.current]);

    // Center the map
    setRegion({
      ...initialLoc.coords,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    // Start timer
    startTime.current = Date.now();
    setTracking(true);

    // Poll every second
    poller.current = setInterval(async () => {
      const latest = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      // Push the full coords object (includes altitude, speed, accuracy, etc)
      coordsRef.current.push({ ...latest.coords });
      setCoords([...coordsRef.current]);

      // Animate map
      mapRef.current?.animateToRegion({
        ...latest.coords,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      });

      // Auto-stop if near end
      if (endCoords && distanceMeters(latest.coords, endCoords) < 6) {
        stopTracking();
      }
    }, 1000);
  };

  const stopTracking = async () => {
    clearInterval(poller.current);
    setTracking(false);

    const runCoords = coordsRef.current;
    const duration = (Date.now() - startTime.current) / 1000;
    // avgSpeed uses the `speed` field on each coords entry, falling back to 0
    const avgSpeed =
      runCoords.reduce((sum, c) => sum + (c.speed || 0), 0) / runCoords.length || 0;

    // Post full run
    await axios.post(`${API_BASE}/api/routes`, {
      trailId,
      coords: runCoords,
      duration,
      avgSpeed,
      vehicleId: selectedVehicleId,
    });

    // Navigate to detail
    navigation.replace('RunDetail', {
      run: { ...runCoords, duration, avgSpeed, trailId }, // existing RunDetail only uses run.coords, duration, avgSpeed, trailId
      trailName,
    });

    // Reset for next time
    coordsRef.current = [];
    setCoords([]);
  };

  // Header Start/Stop
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
  }, [navigation, tracking, selectedVehicleId, region]);

  // Loading state
  if (vehicles === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // No vehicles
  if (vehicles.length === 0) {
    return (
      <View style={styles.center}>
        <Button title="Add a Vehicle" onPress={() => navigation.navigate('AddVehicle')} />
      </View>
    );
  }

  // Vehicle picker before tracking
  if (!tracking) {
    return (
      <View style={styles.container}>
        <Text style={styles.subheader}>Select Your Vehicle</Text>
        {vehicles.map(v => (
          <TouchableOpacity
            key={v.id}
            style={[
              styles.vehicleItem,
              v.id === selectedVehicleId && styles.selectedVehicle,
            ]}
            onPress={() => setSelectedVehicleId(v.id)}
          >
            <Text>{`${v.make} ${v.model} (${v.year})`}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // Tracking map view
  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={region}
    >
      <Polyline coordinates={coords} strokeWidth={4} />
      <Marker coordinate={coords[0]} title="Start" />
      <Marker coordinate={coords[coords.length - 1]} title="End" />
      {endCoords && <Circle center={endCoords} radius={6} />}
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map:       { flex: 1 },
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
