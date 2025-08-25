// TrailDetail.js
import React, { useState, useEffect, useLayoutEffect, useRef, useContext } from 'react';
import { View, Alert, Button, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import MapBase from './MapBase';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

// Haversine (meters)
function distanceMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const sq = s1 * s1 + s2 * s2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(sq));
}

export default function TrailDetail({ route, navigation }) {
  const { prefs } = useContext(UserContext);
  const { trailId, trailName } = route.params;

  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [arrived, setArrived] = useState(false);
  const watcher = useRef(null);

  const officialColor = prefs?.officialRouteColor || '#000000';

  useLayoutEffect(() => {
    navigation.setOptions({ title: trailName || 'Trail' });
  }, [navigation, trailName]);

  // Load the trail
  useEffect(() => {
    let active = true;
    setLoading(true);
    axios
      .get(`${API_BASE}/api/trailheads/${trailId}`)
      .then((res) => {
        if (!active) return;
        setTrail(res.data);
      })
      .catch((e) => console.error(e))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [trailId]);

  // Arrival watcher (only until first arrival)
  useEffect(() => {
    let mounted = true;
    if (!trail?.coords || arrived) return;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mounted || status !== 'granted') return;

      // Clear any previous watcher
      try { watcher.current?.remove?.(); } catch {}
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1 },
        (loc) => {
          if (!mounted) return;
          const d = distanceMeters(loc.coords, trail.coords);
          if (d <= 6) {
            try { watcher.current?.remove?.(); } catch {}
            watcher.current = null;
            setArrived(true);
            Alert.alert('Arrived', 'You have reached the trailhead.');
          }
        }
      );
    })();

    return () => {
      mounted = false;
      try { watcher.current?.remove?.(); } catch {}
      watcher.current = null;
    };
  }, [trail?.coords, arrived]);

  if (loading || !trail?.coords) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const { coords: startCoords, endCoords, route: officialRoute = [] } = trail;

  return (
    <View style={styles.container}>
      <MapBase
        initialRegion={{
          latitude: startCoords.latitude,
          longitude: startCoords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker coordinate={startCoords} title={trail.name} />
        {endCoords && <Marker coordinate={endCoords} title="Trail End" pinColor="green" />}

        {officialRoute.length > 1 && (
          <Polyline
            coordinates={officialRoute.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
            strokeWidth={4}
            strokeColor={officialColor}
          />
        )}
      </MapBase>

      <View style={styles.footer}>
        {!arrived ? (
          <Button
            title="Navigate to Trailhead"
            onPress={() => {
              // Hook up to maps deeplink if desired
            }}
          />
        ) : (
          <Button
            title="Start Run"
            onPress={() =>
              navigation.navigate('Tracker', {
                trailId,
                trailName: trail.name,
                startCoords,
                endCoords: endCoords || null,
                officialRoute: officialRoute || [],
              })
            }
          />
        )}
        <Text style={styles.meta}>
          {officialRoute.length} points • Difficulty: {trail.difficulty || 'Unknown'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  footer: { padding: 12, gap: 8 },
  meta: { color: '#666', textAlign: 'center' },
});
