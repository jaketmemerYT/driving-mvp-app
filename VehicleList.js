// VehicleList.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
  Button,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { API_BASE } from './config';

export default function VehicleList({ navigation }) {
  const [vehicles, setVehicles] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch vehicles
  const loadVehicles = async () => {
    setRefreshing(true);
    try {
      const res = await axios.get(`${API_BASE}/api/vehicles`);
      setVehicles(res.data);
    } catch (err) {
      console.error('Error fetching vehicles:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadVehicles();
  }, []);

  // Reload on focus
  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [])
  );

  // Header button
  useEffect(() => {
    navigation.setOptions({
      headerTitle: 'Vehicles',
      headerRight: () => (
        <Button title="Add" onPress={() => navigation.navigate('AddVehicle')} />
      ),
    });
  }, [navigation]);

  if (vehicles === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={vehicles}
      keyExtractor={(item, idx) => (item.id ? String(item.id) : String(idx))}
      refreshing={refreshing}
      onRefresh={loadVehicles}
      ListEmptyComponent={() => (
        <Text style={styles.empty}>No vehicles yet.</Text>
      )}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={styles.title}>
            {item.make} {item.model} ({item.year})
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 32, color: '#666' },
  item: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 16 },
});
