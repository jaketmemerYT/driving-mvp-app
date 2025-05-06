import React, { useState, useRef } from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import axios from 'axios';
import * as Location from 'expo-location';
import { API_BASE } from './config';

export default function Tracker({ route, navigation }) {
  const { trailId, name, vehicleId } = route.params;
  const [tracking, setTracking] = useState(false);
  const [coords, setCoords] = useState([]);
  const startTime = useRef(null);
  const subscription = useRef(null);

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission denied');
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
    const avgSpeed = coords.reduce((sum, p) => sum + (p.speed || 0), 0) / coords.length;
    try {
      await axios.post(`${API_BASE}/api/routes`, { trailId, coords, duration, avgSpeed, vehicleId });
      navigation.replace('Leaderboard', { trailId, name });
    } catch (e) {
      console.error(e);
      Alert.alert('Upload failed', e.response?.data?.error || e.message);
    }
  };

  return (
    <View style={styles.center}>
      <Text style={styles.header}>{name}</Text>
      <Button title={tracking ? 'Stop & Upload' : 'Start Tracking'} onPress={tracking ? stopTracking : startTracking} />
      {tracking && <Text style={styles.status}>Recording… {coords.length} pts</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  header: { fontSize:20, marginBottom:8 },
  status: { marginTop:8 }
});
