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
import MapView, { Polyline, Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE } from './config';

// Haversine distance in meters
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
  const [trailId, setTrailId] = useState(paramTrailId || null);
  const [vehicles, setVehicles] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [tracking, setTracking] = useState(false);

  const coordsRef = useRef(startCoords ? [startCoords] : []);
  const [coords, setCoords] = useState(coordsRef.current);
  const [region, setRegion] = useState(
    startCoords
      ? { ...startCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      : null
  );

  const startTime = useRef(null);
  const poller = useRef(null);
  const mapRef = useRef(null);

  // Load vehicles on focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      axios.get(`${API_BASE}/api/vehicles`).then(r => setVehicles(r.data));
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

    // Seed initial location
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      return Alert.alert('Location permission denied');
    }
    const { coords: initial } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    coordsRef.current = [{ latitude: initial.latitude, longitude: initial.longitude }];
    setCoords(coordsRef.current);
    setRegion({ ...initial, latitudeDelta: 0.01, longitudeDelta: 0.01 });

    startTime.current = Date.now();
    setTracking(true);

    // Start polling loop
    poller.current = setInterval(async () => {
      const { coords: pt } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const p = { latitude: pt.latitude, longitude: pt.longitude };
      coordsRef.current.push(p);
      setCoords([...coordsRef.current]);

      // center map
      mapRef.current?.animateToRegion({
        ...p,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      });

      // auto-stop if near end
      if (endCoords && distanceMeters(p, endCoords) < 6) {
        stopTracking();
      }
    }, 1000);
  };

  const stopTracking = async () => {
    clearInterval(poller.current);
    setTracking(false);

    const runCoords = coordsRef.current;
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
      navigation.replace('RunDetail', { run: res.data, trailName });
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.error || err.message);
    }

    // reset for next run
    coordsRef.current = [];
    setCoords([]);
  };

  // Header Start/Stop button
  useLayoutEffect(() => {
    navigation.setOptions({
      title: trailName || 'Tracking',
      headerRight: () => (
        <Button
          title={tracking ? 'Stop' : 'Start'}
          onPress={tracking ? stopTracking : startTracking}
          disabled={!selectedVehicleId || !region}
        />
      ),
    });
  }, [navigation, tracking, selectedVehicleId, region]);

  if (vehicles === null) {
    return <ActivityIndicator style={styles.center} size="large" />;
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
        {vehicles.map(v => (
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

  // Map view for tracking
  return (
    <MapView ref={mapRef} style={styles.map} initialRegion={region}>
      <Polyline coordinates={coords} strokeWidth={4} />
      <Marker coordinate={coords[coords.length - 1]} />
      {endCoords && <Marker coordinate={endCoords} pinColor="green" />}
      {endCoords && <Circle center={endCoords} radius={6} />}
    </MapView>
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
