import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { View, Text, Alert, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Button } from 'react-native';
import axios from 'axios';
import * as Location from 'expo-location';
import { API_BASE } from './config';

export default function Tracker({ route, navigation }) {
  const { trailId, name } = route.params;
  const [vehicles, setVehicles] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [coords, setCoords] = useState([]);
  const startTime = useRef(null);
  const subscription = useRef(null);

  // Load vehicles on focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      axios.get(`${API_BASE}/api/vehicles`)
        .then(r => setVehicles(r.data))
        .catch(() => Alert.alert('Error', 'Could not load vehicles'));
    });
    return unsubscribe;
  }, [navigation]);

  const startTracking = async () => {
    if (!selectedVehicleId) return Alert.alert('Select a vehicle first');
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
      await axios.post(`${API_BASE}/api/routes`, { trailId, coords, duration, avgSpeed, vehicleId: selectedVehicleId });
      navigation.replace('Leaderboard', { trailId, name });
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.error || err.message);
    }
  };

  // Set start/stop button in header
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

  if (vehicles === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {vehicles.length === 0 ? (
        <Button title="Add a Vehicle" onPress={() => navigation.navigate('AddVehicle')} />
      ) : (
        <>
          <Text style={styles.subheader}>Select Vehicle</Text>
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
                <Text>{item.make} {item.model} ({item.year})</Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:16 },
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  subheader: { marginBottom:8, fontWeight:'500' },
  vehicleItem: { padding:12, borderWidth:1, borderColor:'#ccc', borderRadius:4, marginBottom:8 },
  selectedVehicle: { borderColor:'#007AFF', backgroundColor:'#E6F0FF' },
});

