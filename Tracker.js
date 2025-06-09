// Tracker.js
import React, {
  useState,
  useRef,
  useContext,
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
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

// Haversine formula to calculate distance in meters
function distanceMeters(a, b) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const sq =
    sinDlat * sinDlat +
    sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(sq));
}

export default function Tracker({ route, navigation }) {
  const { user } = useContext(UserContext);
  const {
    trailId: paramTrailId,
    trailName,
    startCoords,
    endCoords,
  } = route.params;

  const [trailId, setTrailId]                 = useState(paramTrailId || null);
  const [vehicles, setVehicles]               = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [tracking, setTracking]               = useState(false);

  const coordsRef = useRef(startCoords ? [startCoords] : []);
  const [coords, setCoords]     = useState(coordsRef.current);
  const [region, setRegion]     = useState(startCoords || null);

  const startTime = useRef(null);
  const subscription = useRef(null);
  const poller       = useRef(null);
  const mapRef       = useRef(null);

  // Fetch vehicles for current user
  const fetchVehicles = useCallback(async () => {
    if (!user) {
      setVehicles([]);
      return;
    }
    setVehicles(null);
    try {
      const res = await axios.get(
        `${API_BASE}/api/vehicles?userId=${user.id}`
      );
      setVehicles(res.data);
      if (res.data.length === 1) {
        // auto-select if only one
        setSelectedVehicleId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load vehicles');
      setVehicles([]);
    }
  }, [user]);

  // Reload vehicles whenever this screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchVehicles();
    }, [fetchVehicles])
  );

  // Start tracking
  const startTracking = async () => {
    if (!selectedVehicleId) {
      return Alert.alert('Select a vehicle first');
    }

    // create new trail if needed
    if (trailName && !trailId) {
      const res = await axios.post(`${API_BASE}/api/trailheads`, {
        name: trailName,
        coords: startCoords || null,
      });
      setTrailId(res.data.id);
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission denied', 'Location access required');
    }

    const initialLoc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    coordsRef.current = [{ ...initialLoc.coords }];
    setCoords([...coordsRef.current]);

    setRegion({
      ...initialLoc.coords,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    startTime.current = Date.now();
    setTracking(true);

    // poll every second
    poller.current = setInterval(async () => {
      const latest = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      coordsRef.current.push({ ...latest.coords });
      setCoords([...coordsRef.current]);

      mapRef.current?.animateToRegion({
        ...latest.coords,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      });

      if (
        endCoords &&
        distanceMeters(latest.coords, endCoords) < 6
      ) {
        stopTracking();
      }
    }, 1000);
  };

  // Stop tracking
  const stopTracking = async () => {
    clearInterval(poller.current);
    setTracking(false);

    const runCoords = coordsRef.current.length
      ? coordsRef.current
      : [{ ...region }];

    const duration = (Date.now() - startTime.current) / 1000;
    const avgSpeed =
      runCoords.reduce((sum, c) => sum + (c.speed || 0), 0) /
        runCoords.length || 0;

    try {
      const res = await axios.post(`${API_BASE}/api/routes`, {
        trailId,
        coords: runCoords,
        duration,
        avgSpeed,
        vehicleId: selectedVehicleId,
        userId: user.id,
      });
      navigation.replace('RunDetail', {
        run: res.data,
        trailName,
      });
    } catch (err) {
      Alert.alert(
        'Upload failed',
        err.response?.data?.error || err.message
      );
    }

    coordsRef.current = [];
    setCoords([]);
  };

  // Header button
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

  // If exactly one vehicle, show confirmation text
  if (!tracking && vehicles.length === 1) {
    const v = vehicles[0];
    return (
      <View style={styles.center}>
        <Text style={styles.info}>
          Using vehicle: {v.make} {v.model} ({v.year})
        </Text>
        <Text style={styles.infoSmall}>
          Hit “Start” when ready
        </Text>
      </View>
    );
  }

  // Vehicle selector
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
            <Text>
              {v.make} {v.model} ({v.year})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // Tracking view
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
  container:       { flex: 1, padding: 16 },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map:             { flex: 1 },
  subheader:       { marginBottom: 8, fontWeight: '500' },
  vehicleItem:     {
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
  info:            { fontSize: 16, marginBottom: 8 },
  infoSmall:       { color: '#666' },
});
