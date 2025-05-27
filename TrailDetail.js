// TrailDetail.js
import React, { useState, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Button,
} from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from './config';

export default function TrailDetail({ route, navigation }) {
  const { trailId, trailName } = route.params;
  const [runs, setRuns] = useState(null);

  // Reload runs for this trail whenever we come back here
  useFocusEffect(
    useCallback(() => {
      setRuns(null);
      axios
        .get(`${API_BASE}/api/routes?trailId=${trailId}`)
        .then(r => setRuns(r.data))
        .catch(console.error);
    }, [trailId])
  );

  // Configure the “Start Run” button
  // We must navigate into the RunsTab's AddRun screen
  useLayoutEffect(() => {
    navigation.setOptions({
      title: trailName,
      headerRight: () => (
        <Button
          title="Start Run"
          onPress={() => {
            // This tab navigator key must match your App.js:
            navigation.getParent()?.navigate('RunsTab', {
              screen: 'AddRun',
              params: { trailId, trailName },
            });
          }}
        />
      ),
    });
  }, [navigation, trailId, trailName]);

  if (runs === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Top‐5 leaderboard
  const top5 = [...runs]
    .sort((a, b) => a.duration - b.duration)
    .slice(0, 5);

  // Most‐recent 5
  const recent = [...runs]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>👑 Top 5</Text>
      {top5.map(r => (
        <Text key={r.id} style={styles.row}>
          {`${Math.round(r.duration)}s — ${new Date(r.timestamp).toLocaleString()}`}
        </Text>
      ))}

      <Text style={styles.heading}>🕒 Recent</Text>
      {recent.map(r => (
        <Text key={r.id} style={styles.row}>
          {`${Math.round(r.duration)}s — ${new Date(r.timestamp).toLocaleString()}`}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading:   { fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  row:       { paddingVertical: 4 },
});
