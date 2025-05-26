// RunDetail.js
import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';

export default function RunDetail({ route, navigation }) {
  const { run, trailName } = route.params;
  const coords = run.coords || [];

  // Add “Challenge” button to header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: trailName,
      headerRight: () => (
        <Button
          title="Challenge"
          onPress={() =>
            navigation.navigate('Tracker', {
              trailId: run.trailId,
              trailName,
              startCoords: coords[0],
              endCoords: coords[coords.length - 1],
            })
          }
        />
      ),
    });
  }, [navigation, run, trailName]);

  // No GPS data case
  if (coords.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noData}>No GPS data available for this run.</Text>
        <View style={styles.info}>
          <Text style={styles.text}>Duration: {Math.round(run.duration)}s</Text>
          <Text style={styles.text}>Avg Speed: {Math.round(run.avgSpeed)} m/s</Text>
        </View>
      </View>
    );
  }

  // Compute start/end and a safe region
  const startCoord = coords[0];
  const endCoord = coords[coords.length - 1];
  const midLat = (startCoord.latitude + endCoord.latitude) / 2;
  const midLng = (startCoord.longitude + endCoord.longitude) / 2;
  const latDelta = Math.max(
    Math.abs(endCoord.latitude - startCoord.latitude) * 2,
    0.01
  );
  const lngDelta = Math.max(
    Math.abs(endCoord.longitude - startCoord.longitude) * 2,
    0.01
  );
  const initialRegion = {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        <Polyline coordinates={coords} strokeWidth={4} />
        <Marker coordinate={startCoord} title="Start" />
        <Marker coordinate={endCoord}   title="End" />
      </MapView>
      <View style={styles.info}>
        <Text style={styles.text}>Duration: {Math.round(run.duration)}s</Text>
        <Text style={styles.text}>Avg Speed: {Math.round(run.avgSpeed)} m/s</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map:       { flex: 1 },
  info:      { padding: 16 },
  text:      { fontSize: 16, marginBottom: 4 },
  noData:    { flex:1, textAlign:'center', textAlignVertical:'center', color:'#666', fontSize:16 },
});
