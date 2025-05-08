// RunDetail.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';

export default function RunDetail({ route }) {
  const { run, trailName } = route.params;

  // 1. Normalize & memoize coords so we have a stable reference
  const coords = useMemo(
    () =>
      (run.coords || []).map(c => ({
        latitude:  c.latitude ?? c.lat,
        longitude: c.longitude ?? c.lon,
      })),
    [run.id] // only rememoize if the run ID changes
  );

  const [region, setRegion] = useState(null);

  // 2. Set up the map region **once** on mount
  useEffect(() => {
    if (coords.length > 0) {
      setRegion({
        latitude:      coords[0].latitude,
        longitude:     coords[0].longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      });
    }
    // empty deps → runs only on first render
  }, []);

  // 3. Debug logs (optional — can remove once it’s working)
  console.log('📍 RunDetail run:', run);
  console.log('📍 Normalized coords:', coords);

  // 4. If we have a map region, show the map + stats
  if (region) {
    return (
      <View style={{flex:1}}>
        <MapView style={styles.map} initialRegion={region}>
          {coords.length > 0 && (
            <>
              <Polyline coordinates={coords} strokeWidth={4} />
              <Marker coordinate={coords[coords.length - 1]} />
            </>
          )}
        </MapView>
        <ScrollView style={styles.stats}>
          <Text style={styles.stat}>Trail: {trailName}</Text>
          <Text style={styles.stat}>Duration: {Math.round(run.duration)}s</Text>
          <Text style={styles.stat}>Avg Speed: {run.avgSpeed.toFixed(1)} m/s</Text>
          <Text style={styles.stat}>Vehicle: {run.vehicleId}</Text>
        </ScrollView>
      </View>
    );
  }

  // 5. Fallback: no map data available
  return (
    <View style={styles.center}>
      <Text style={{ marginBottom: 8 }}>
        {coords.length === 0
          ? 'No GPS data available for this run.'
          : 'Loading map…'}
      </Text>
      <Text style={styles.stat}>Trail: {trailName}</Text>
      <Text style={styles.stat}>Duration: {Math.round(run.duration)}s</Text>
      <Text style={styles.stat}>Avg Speed: {run.avgSpeed.toFixed(1)} m/s</Text>
      <Text style={styles.stat}>Vehicle: {run.vehicleId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map:    { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  stats:  { padding: 16, backgroundColor: '#fff' },
  stat:   { marginBottom: 4, fontSize: 16 },
});
