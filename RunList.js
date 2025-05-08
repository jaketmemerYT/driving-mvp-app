// RunList.js
import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Button,
} from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';

export default function RunList({ navigation }) {
  const [runs, setRuns] = useState(null);
  const [trailsMap, setTrailsMap] = useState({});

  // Fetch runs and trail names
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/routes`)
      .then(res => setRuns(res.data))
      .catch(err => console.error('Error fetching runs:', err));

    axios
      .get(`${API_BASE}/api/trailheads`)
      .then(res => {
        const map = {};
        res.data.forEach(t => { map[t.id] = t.name; });
        setTrailsMap(map);
      })
      .catch(err => console.error('Error fetching trailheads:', err));
  }, []);

  // Add "New Run" button to header
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

  if (!runs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={runs}
      keyExtractor={(item, index) =>
        item.id ? String(item.id) : String(index)
      }
      ListEmptyComponent={() => (
        <Text style={styles.centerText}>No runs yet.</Text>
      )}
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
            {new Date(item.timestamp).toLocaleString()} • {Math.round(item.duration)}s
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerText: { textAlign: 'center', marginTop: 32, color: '#666' },
  item: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 16, fontWeight: 'bold' },
  subtitle: { color: '#666', marginTop: 4 },
});
