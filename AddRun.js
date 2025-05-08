// AddRun.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';

export default function AddRun({ navigation }) {
  const [trailName, setTrailName] = useState('');
  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);
  const mapRef = useRef(null);

  // obtain user's current location for start
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to start a run.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setStartCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  // center map on end marker when placed
  useEffect(() => {
    if (endCoords && mapRef.current) {
      mapRef.current.animateToRegion({
        ...endCoords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [endCoords]);

  const handleMapPress = e => {
    setEndCoords(e.nativeEvent.coordinate);
  };

  const handleBegin = () => {
    if (!trailName.trim()) {
      Alert.alert('Trail name required');
      return;
    }
    if (!startCoords) {
      Alert.alert('Waiting for start location');
      return;
    }
    navigation.navigate('Tracker', {
      trailName,
      startCoords,
      endCoords,  // may be null: Tracker will stop manually
    });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Trail Name"
        value={trailName}
        onChangeText={setTrailName}
      />
      {startCoords && (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            ...startCoords,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={handleMapPress}
        >
          <Marker coordinate={startCoords} title="Start" />
          {endCoords && (
            <>
              <Marker coordinate={endCoords} title="Finish" />
              <Circle center={endCoords} radius={20} />
            </>
          )}
        </MapView>
      )}
      <Button title="Begin Run" onPress={handleBegin} disabled={!trailName || !startCoords} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  input: {
    margin: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
  },
  map: { flex: 1 },
});
