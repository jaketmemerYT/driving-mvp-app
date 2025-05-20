// RunList.js
import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback
} from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Button,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import MapView, { Polyline } from 'react-native-maps';
import { API_BASE } from './config';

export default function RunList({ navigation }) {
  const [runs, setRuns]           = useState(null);
  const [trailsMap, setTrailsMap] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Load trailsMap
  const loadTrails = () => {
    axios
      .get(`${API_BASE}/api/trailheads`)
      .then(res => {
        const m = {};
        res.data.forEach(t => (m[t.id] = t.name));
        setTrailsMap(m);
      })
      .catch(err => console.error('Error fetching trailheads:', err));
  };

  // Load runs
  const loadRuns = () => {
    setRefreshing(true);
    axios
      .get(`${API_BASE}/api/routes`)
      .then(res => {
        const sorted = res.data.sort((a, b) => b.timestamp - a.timestamp);
        setRuns(sorted);
      })
      .catch(err => console.error('Error fetching runs:', err))
      .finally(() => setRefreshing(false));
  };

  // Initial load once on mount
  useEffect(() => {
    loadTrails();
    loadRuns();
  }, []);

  // Reload whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadTrails();
      loadRuns();
    }, [])
  );

  // Header button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'My Runs',
      headerRight: () => (
        <Button
          title="New Run"
          onPress={() => navigation.navigate('AddRun')}
        />
      ),
    });
  }, [navigation]);

  // Loading state
  if (runs === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={runs}
      keyExtractor={(item, idx) => (item.id ? String(item.id) : String(idx))}
      refreshing={refreshing}
      onRefresh={loadRuns}
      ListEmptyComponent={() => (
        <Text style={styles.empty}>No runs yet.</Text>
      )}
      renderItem={({ item }) => {
        // preview region centered on first coord
        const previewRegion =
          item.coords && item.coords.length > 0
            ? {
                ...item.coords[0],
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }
            : null;
        return (
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              navigation.navigate('RunDetail', {
                run: item,
                trailName: trailsMap[item.trailId] || 'Unknown Trail',
              })
            }
          >
            <Text style={styles.title}>
              {trailsMap[item.trailId] || 'Trail'}
            </Text>
            {previewRegion && (
              <MapView
                style={styles.preview}
                initialRegion={previewRegion}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Polyline coordinates={item.coords} strokeWidth={2} />
              </MapView>
            )}
            <Text style={styles.subtitle}>
              {new Date(item.timestamp).toLocaleString()} •{' '}
              {Math.round(item.duration)}s
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 32, color: '#666' },
  item: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 16, fontWeight: 'bold' },
  preview: { height: 100, marginVertical: 8 },
  subtitle: { color: '#666' },
});
