// AddCategory.js
import React, { useState, useLayoutEffect } from 'react';
import {
  View, TextInput, Button, Alert, StyleSheet
} from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';

export default function AddCategory({ navigation }) {
  const [name, setName] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'New Category' });
  }, [navigation]);

  const create = () => {
    if (!name.trim()) return Alert.alert('Please enter a category name');
    axios.post(`${API_BASE}/api/categories`, { name: name.trim() })
      .then(() => navigation.goBack())
      .catch(err => {
        console.error(err);
        Alert.alert('Failed to create category', err.message);
      });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Category name"
        value={name}
        onChangeText={setName}
      />
      <Button title="Create" onPress={create} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:16 },
  input:     {
    borderWidth:1, borderColor:'#ccc', borderRadius:4,
    padding:8, marginBottom:16
  },
});
