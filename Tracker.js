// Tracker.js
import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Button,
} from 'react-native';
import MapView, { Polyline, Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE } from './config';

// Haversine formula to compute distance between two {latitude, longitude}
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
  const {
    userId,
    trailId: paramTrailId,
    trailName,
    groupId,
    vehicleId: initialVehicleId,
    endCoords,
  } = route.params;

  const [vehicles, setVehicles] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId || null);
  const [tracking, setTracking] = useState(false);

  const coordsRef = useRef([]);
  const [coords, setCoords] = useState([]);

  const [region, setRegion] = useState(null);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const mapRef = useRef(null);

  // Load vehicles if none preselected
  useEffect(() => {
    if (initialVehicleId) {
      setVehicles([]); // skip loading
      return;
    }
    const unsub = navigation.addListener('focus', () => {
      axios
        .get(`${API_BASE}/api/vehicles?userId=${userId}`)
        .then(res => setVehicles(res.data))
        .catch(() => Alert.alert('Error', 'Could not load vehicles'));
    });
    return unsub;
  }, [navigation, initialVehicleId, userId]);

  // Configure header Start/Stop button
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

  // Start tracking
  const startTracking = useCallback(async () => {
    if (!selectedVehicleId) {
      return Alert.alert('Select a vehicle first');
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Location permission denied');
    }

    // Seed first point
    const { coords: firstLoc } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    coordsRef.current = [{ ...firstLoc }];
    setCoords([...coordsRef.current]);

    // Center map
    setRegion({ ...firstLoc, latitudeDelta: 0.01, longitudeDelta: 0.01 });

    startTimeRef.current = Date.now();
    setTracking(true);

    // Poll every second
    timerRef.current = setInterval(async () => {
      const { coords: newLoc } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      coordsRef.current.push({ ...newLoc });
      setCoords([...coordsRef.current]);

      // animate map
      mapRef.current?.animateToRegion({
        ...newLoc,
        latitudeDelta: region?.latitudeDelta || 0.01,
        longitudeDelta: region?.longitudeDelta || 0.01,
      });

      // auto-stop if close to end
      if (endCoords && distanceMeters(newLoc, endCoords) < 6) {
        stopTracking();
      }
    }, 1000);
  }, [selectedVehicleId, region, endCoords]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    clearInterval(timerRef.current);
    setTracking(false);

    const runCoords = coordsRef.current;
    const duration = (Date.now() - startTimeRef.current) / 1000;
    const avgSpeed =
      runCoords.reduce((sum, p) => sum + (p.speed || 0), 0) / runCoords.length || 0;

    try {
      const res = await axios.post(`${API_BASE}/api/routes`, {
        userId,
        trailId: paramTrailId,
        groupId,
        coords: runCoords,
        duration,
        avgSpeed,
        vehicleId: selectedVehicleId,
      });
      navigation.replace('RunDetail', { run: res.data, trailName });
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.error || err.message);
    }

    coordsRef.current = [];
    setCoords([]);
  }, [userId, paramTrailId, groupId, selectedVehicleId, trailName]);

  // While loading vehicles
  if (vehicles === null && !initialVehicleId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Vehicle picker if none preselected
  if (!tracking && !initialVehicleId) {
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

  // Map view when tracking
  if (tracking && region) {
    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
      >
        <Polyline coordinates={coords} strokeWidth={4} />
        {coords.length > 0 && (
          <Marker coordinate={coords[0]} title="Start" />
        )}
        {coords.length > 1 && (
          <Marker coordinate={coords[coords.length - 1]} title="End" />
        )}
        {endCoords && <Circle center={endCoords} radius={6} />}
      </MapView>
    );
  }

  // Ready state if preselected vehicle
  return (
    <View style={styles.center}>
      <Text>Ready to {tracking ? 'stop' : 'start'}—tap the button above.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 16 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map:          { flex: 1 },
  subheader:    { marginBottom: 8, fontWeight: '500' },
  vehicleItem:  {
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
