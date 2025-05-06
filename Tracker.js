// Tracker.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Button,
  Alert,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import axios from 'axios';
import * as Location from 'expo-location';
import { API_BASE } from './config';

export default function Tracker({ route, navigation }) {
  const { trailId, name } = route.params;

  // State for vehicles and selection
  const [vehicles, setVehicles] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // State for GPS tracking
  const [tracking, setTracking] = useState(false);
  const [coords, setCoords] = useState([]);
  const startTime = useRef(null);
  const subscription = useRef(null);

  // Load vehicles on focus (so new ones show up after adding)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      axios.get(`${API_BASE}/api/vehicles`)
        .then(r => {
          setVehicles(r.data);
          // if user had only one, you could auto-select:
          // if (r.data.length === 1) setSelectedVehicleId(r.data[0].id);
        })
        .catch(err => {
          console.error(err);
          Alert.alert('Error', 'Could not load vehicles');
        });
    });
    return unsubscribe;
  }, [navigation]);

  const startTracking = async () => {
    if (!selectedVehicleId) {
      return Alert.alert('Select a vehicle first');
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Location permission denied');
    setCoords([]);
    startTime.current = Date.now();
    subscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
      loc => setCoords(c => [...c, loc.coords])
    );
    setTracking(true);
  };

  const stopTracking = async () => {
    subscription.current?.remove();
    setTracking(false);

    const duration = (Date.now() - startTime.current) / 1000;
    const avgSpeed = coords.reduce((sum, p) => sum + (p.speed || 0), 0) / coords.length || 0;

    try {
      await axios.post(`${API_BASE}/api/routes`, {
        trailId,
        coords,
        duration,
        avgSpeed,
        vehicleId: selectedVehicleId,
      });
      navigation.replace('Leaderboard', { trailId, name });
    } catch (err) {
      console.error(err);
      Alert.alert('Upload failed', err.response?.data?.error || err.message);
    }
  };

  // If vehicles not loaded yet
  if (vehicles === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{name}</Text>

      {vehicles.length === 0 ? (
        <Button title="Add a Vehicle First" onPress={() => navigation.navigate('AddVehicle')} />
      ) : (
        <>
          <Text style={styles.subheader}>Select Your Vehicle</Text>
          <FlatList
            data={vehicles}
            keyExtractor={v => v.id}
            extraData={selectedVehicleId}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.vehicleItem,
                  item.id === selectedVehicleId && styles.selectedVehicle,
                ]}
                onPress={() => setSelectedVehicleId(item.id)}
              >
                <Text>
                  {item.make} {item.model} ({item.year})
                </Text>
              </TouchableOpacity>
            )}
          />

          <View style={styles.trackButton}>
            <Button
              title={tracking ? 'Stop & Upload' : 'Start Tracking'}
              onPress={tracking ? stopTracking : startTracking}
              disabled={!selectedVehicleId}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
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
  trackButton: { marginTop: 16 },
});
