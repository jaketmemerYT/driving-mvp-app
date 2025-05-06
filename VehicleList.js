import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';

export default function VehicleList() {
  const [vehicles, setVehicles] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/api/vehicles`)
      .then(r => setVehicles(r.data))
      .catch(console.error);
  }, []);

  if (!vehicles) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={vehicles}
      keyExtractor={v => v.id}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={styles.title}>{item.make} {item.model} ({item.year})</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {flex:1,justifyContent:'center',alignItems:'center'},
  item: {padding:16,borderBottomWidth:1,borderColor:'#eee'},
  title: {fontSize:18}
});

