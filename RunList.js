// RunList.js
import React, { useEffect, useState, useLayoutEffect, useCallback } from 'react';
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
import { API_BASE } from './config';

export default function RunList({ navigation }) {
  const [runs, setRuns] = useState(null);
  const [trailsMap, setTrailsMap] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Fetch trailheads and build map
  const loadTrails = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/trailheads`);
      const map = {};
      res.data.forEach(t => (map[t.id] = t.name));
      setTrailsMap(map);
    } catch (err) {
      console.error('Error fetching trailheads:', err);
    }
  };

  // Fetch and sort runs
  const loadRuns = async () => {
    setRefreshing(true);
    try {
      const res = await axios.get(`${API_BASE}/api/routes`);
      const sorted = res.data.sort((a, b) => b.timestamp - a.timestamp);
      setRuns(sorted);
    } catch (err) {
      console.error('Error fetching runs:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Initial load on mount
  useEffect(() => {
    loadTrails();
    loadRuns();
  }, []);

  // Also reload both when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadTrails();
      loadRuns();
    }, [])
  );

  // Inject header button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'My Runs',
      headerRight: () => (
        <Button title="New Run" onPress={() => navigation.navigate('AddRun')} />
      ),
    });
  }, [navigation]);

  // Show spinner until we have run data
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
      onRefresh={() => {
        loadTrails();
        loadRuns();
      }}
      ListEmptyComponent={() => <Text style={styles.empty}>No runs yet.</Text>}
      renderItem={({ item }) => (
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
          <Text style={styles.subtitle}>
            {new Date(item.timestamp).toLocaleString()} •{' '}
            {Math.round(item.duration)}s
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 32, color: '#666' },
  item: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 16, fontWeight: 'bold' },
  subtitle: { color: '#666', marginTop: 4 },
});
