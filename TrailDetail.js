// TrailDetail.js
import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  StyleSheet,
  Alert
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from './config';

export default function TrailDetail({ route, navigation }) {
  const { trailId, trailName } = route.params;

  const [trail, setTrail]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [arrived, setArrived] = useState(false);
  const [sub, setSub]         = useState(null);

  // Haversine for distance in meters
  const distanceMeters = (a, b) => {
    const toRad = deg => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinDlat = Math.sin(dLat/2);
    const sinDlon = Math.sin(dLon/2);
    const sq = sinDlat*sinDlat + sinDlon*sinDlon * Math.cos(lat1)*Math.cos(lat2);
    return 2*R*Math.asin(Math.sqrt(sq));
  };

  // Fetch trailhead from API
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      axios.get(`${API_BASE}/api/trailheads`)
        .then(res => {
          const t = res.data.find(x => x.id === trailId);
          setTrail(t);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [trailId])
  );

  // Put Start/Stop buttons in header
  useLayoutEffect(() => {
    navigation.setOptions({
      title: trailName || 'Trail',
    });
  }, [navigation, trailName]);

  // Called when user taps “Navigate to Trailhead”
  const beginNavigate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission required', 'We need location access');
    }

    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 1 },
      loc => {
        const dist = distanceMeters(loc.coords, trail.coords);
        if (dist <= 6) {
          subscription.remove();
          setArrived(true);
          Alert.alert('You’ve arrived!', 'Now you can start your run.');
        }
      }
    );
    setSub(subscription);
  };

  if (loading || !trail) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          ...trail.coords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        }}
      >
        <Marker coordinate={trail.coords} title={trail.name} />
      </MapView>

      <View style={styles.footer}>
        {arrived ? (
          <Button
            title="Start Run"
            onPress={() =>
              navigation.navigate('Tracker', {
                trailId,
                trailName,
                startCoords: trail.coords
              })
            }
          />
        ) : (
          <Button
            title="Navigate to Trailhead"
            onPress={beginNavigate}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  footer:    { padding: 16 }
});
