// TrailList.js
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

export default function TrailList({ navigation }) {
  const [trails, setTrails] = useState(null);

  // Inject Vehicles button into the header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button
          title="Vehicles"
          onPress={() => navigation.navigate('Vehicles')}
        />
      ),
    });
  }, [navigation]);

  // Fetch trailheads
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/trailheads`)
      .then(res => setTrails(res.data))
      .catch(console.error);
  }, []);

  // Loading state
  if (!trails) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // List of trails
  return (
    <FlatList
      data={trails}
      keyExtractor={item => item.id}
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

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  item: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: '#666' },
});
