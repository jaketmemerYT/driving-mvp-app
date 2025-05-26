// CategoryList.js
import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, FlatList, TouchableOpacity,
  Text, ActivityIndicator, StyleSheet, Button
} from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';

export default function CategoryList({ navigation }) {
  const [cats, setCats] = useState(null);

  const load = () => {
    axios.get(`${API_BASE}/api/categories`)
      .then(r => setCats(r.data))
      .catch(err => console.error(err));
  };

  useEffect(load, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Categories',
      headerRight: () => (
        <Button
          title="New"
          onPress={() => navigation.navigate('AddCategory')}
        />
      ),
    });
  }, [navigation]);

  if (cats === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={cats}
      keyExtractor={item => item.id}
      ListEmptyComponent={() => <Text style={styles.empty}>No categories.</Text>}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text>{item.name}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex:1, justifyContent:'center',alignItems:'center' },
  empty:  { textAlign:'center',marginTop:32,color:'#666' },
  item:   { padding:16, borderBottomWidth:1, borderColor:'#eee' },
});
