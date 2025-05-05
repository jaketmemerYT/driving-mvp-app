// App.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Button,
  StyleSheet,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import axios from 'axios';
import * as Location from 'expo-location';

const Stack = createNativeStackNavigator();
// From running 'ipconfig' in terminal to determine our Wi-Fi IP
const API_BASE = 'http://192.168.254.40:3000';

function TrailList({ navigation }) {
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/trailheads`)
      .then(r => setTrails(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={trails}
      keyExtractor={i => i.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          onPress={() =>
            navigation.navigate('Tracker', {
              trailId: item.id,
              name: item.name,
            })
          }
        >
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.subtitle}>{item.difficulty}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

function Tracker({ route, navigation }) {
  const { trailId, name } = route.params;
  const [tracking, setTracking] = useState(false);
  const [coords, setCoords] = useState([]);
  const startTime = useRef(null);
  let subscription = useRef(null);

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return alert('Location permission denied');
    setCoords([]);
    startTime.current = Date.now();
    subscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, timeInterval: 1000, distanceInterval: 1 },
      loc => {
        setCoords(c => [...c, loc.coords]);
      }
    );
    setTracking(true);
  };

  const stopTracking = async () => {
    subscription.current?.remove();
    setTracking(false);

    const durationMs = Date.now() - startTime.current;
    const duration = durationMs / 1000; // seconds
    const avgSpeed =
      coords.reduce((sum, p) => sum + (p.speed ?? 0), 0) / coords.length || 0;

    try {
      await axios.post(`${API_BASE}/api/routes`, {
        trailId,
        coords,
        duration,
        avgSpeed,
      });
      navigation.replace('Leaderboard', { trailId, name });
    } catch (err) {
      console.error(err);
      alert('Failed to upload run');
    }
  };

  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 20, marginBottom: 8 }}>{name}</Text>
      <Button
        title={tracking ? 'Stop & Upload' : 'Start Tracking'}
        onPress={tracking ? stopTracking : startTracking}
      />
      {tracking && <Text style={{ marginTop: 8 }}>Recording… {coords.length} pts</Text>}
    </View>
  );
}

function Leaderboard({ route }) {
  const { trailId, name } = route.params;
  const [runs, setRuns] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/leaderboard/${trailId}`)
      .then(r => setRuns(r.data))
      .catch(console.error);
  }, []);

  if (!runs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>{name} — Top 5</Text>
      <FlatList
        data={runs}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={styles.item}>
            <Text>
              {index + 1}. {Math.round(item.duration)}s @ {item.avgSpeed.toFixed(1)} m/s
            </Text>
          </View>
        )}
      />
      <Button title="Back to Trails" onPress={() => route.params.navigation.popToTop()} />
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Trails">
        <Stack.Screen name="Trails" component={TrailList} />
        <Stack.Screen
          name="Tracker"
          component={Tracker}
          options={({ route }) => ({ title: route.params.name })}
        />
        <Stack.Screen
          name="Leaderboard"
          component={Leaderboard}
          options={{ title: 'Leaderboard' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  item: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: '#666' },
});
