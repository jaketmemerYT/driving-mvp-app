// Tracker.js
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Button,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE } from './config';

export default function Tracker({ route, navigation }) {
  const { trailId, name } = route.params;

  // Vehicles state
  const [vehicles, setVehicles] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // Tracking state
  const [tracking, setTracking] = useState(false);

  // coordsRef holds the authoritative list of points
  const coordsRef = useRef([]);
  // coords state mirrors for rendering
  const [coords, setCoords] = useState([]);

  // Map region
  const [region, setRegion] = useState(null);

  // Timing
  const startTime = useRef(null);
  const subscription = useRef(null);

  // Load vehicles whenever this screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      axios
        .get(`${API_BASE}/api/vehicles`)
        .then(res => setVehicles(res.data))
        .catch(() => Alert.alert('Error', 'Could not load vehicles'));
    });
    return unsubscribe;
  }, [navigation]);

  // Start tracking
  const startTracking = async () => {
    if (!selectedVehicleId) {
      return Alert.alert('Select a vehicle first');
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Location permission denied');
    }

    // Get initial location and seed coords
    const { coords: initial } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const { latitude, longitude } = initial;
    coordsRef.current = [{ latitude, longitude }];
    setCoords([{ latitude, longitude }]);

    // Center map on initial location
    setRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    // Start timer and tracking state
    startTime.current = Date.now();
    setTracking(true);

    // Subscribe to location updates
    subscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
      loc => {
        const { latitude: lat, longitude: lon } = loc.coords;
        coordsRef.current.push({ latitude: lat, longitude: lon });
        setCoords([...coordsRef.current]);
        setRegion(r => ({ ...r, latitude: lat, longitude: lon }));
      }
    );
  };

  // Stop tracking
  const stopTracking = async () => {
    subscription.current?.remove();
    setTracking(false);

    // Use authoritative coordsRef
    let runCoords = coordsRef.current;

    // Fallback if still empty
    if (runCoords.length === 0) {
      const { coords: fallback } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      runCoords = [{ latitude: fallback.latitude, longitude: fallback.longitude }];
    }

    const duration = (Date.now() - startTime.current) / 1000;
    const avgSpeed =
      runCoords.reduce((sum, p) => sum + (p.speed || 0), 0) / runCoords.length || 0;

    try {
      const res = await axios.post(`${API_BASE}/api/routes`, {
        trailId,
        coords: runCoords,
        duration,
        avgSpeed,
        vehicleId: selectedVehicleId,
      });
      navigation.replace('RunDetail', { run: res.data, trailName: name });
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.error || err.message);
    }

    // Reset coordsRef for next run
    coordsRef.current = [];
    setCoords([]);
  };

  // Place Start/Stop in header
  useLayoutEffect(() => {
    navigation.setOptions({
      title: name,
      headerRight: () => (
        <Button
          title={tracking ? 'Stop' : 'Start'}
          onPress={tracking ? stopTracking : startTracking}
          disabled={!selectedVehicleId}
        />
      ),
    });
  }, [navigation, tracking, selectedVehicleId]);

  // Loading vehicles
  if (vehicles === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // No vehicles yet
  if (vehicles.length === 0) {
    return (
      <View style={styles.center}>
        <Button
          title="Add a Vehicle"
          onPress={() => navigation.navigate('AddVehicle')}
        />
      </View>
    );
  }

  // Show map when tracking
  if (tracking && region) {
    return (
      <MapView style={styles.map} region={region}>
        <Polyline coordinates={coords} strokeWidth={4} />
        <Marker coordinate={coords[coords.length - 1]} />
      </MapView>
    );
  }

  // Vehicle selector
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
          <Text>
            {v.make} {v.model} ({v.year})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
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
