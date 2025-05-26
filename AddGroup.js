// AddGroup.js
import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, TextInput, Switch, Button, Alert, FlatList,
  TouchableOpacity, Text, StyleSheet
} from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';

export default function AddGroup({ navigation }) {
  const [name, setName]             = useState('');
  const [isPrivate, setPrivate]     = useState(false);
  const [categories, setCategories] = useState([]);
  const [selCats, setSelCats]       = useState([]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'New Group' });
  }, [navigation]);

  useEffect(() => {
    axios.get(`${API_BASE}/api/categories`)
      .then(r => setCategories(r.data))
      .catch(err => console.error(err));
  }, []);

  const toggleCat = id => {
    setSelCats(s =>
      s.includes(id) ? s.filter(x => x !== id) : [...s, id]
    );
  };

  const create = () => {
    if (!name.trim()) return Alert.alert('Please enter a group name');
    axios.post(`${API_BASE}/api/groups`, {
      name:        name.trim(),
      isPrivate,
      categoryIds: selCats,
    })
    .then(() => navigation.goBack())
    .catch(err => {
      console.error(err);
      Alert.alert('Failed to create group', err.response?.data?.error || err.message);
    });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Group name"
      />
      <View style={styles.row}>
        <Text>Private?</Text>
        <Switch value={isPrivate} onValueChange={setPrivate} />
      </View>
      <Text style={styles.label}>Select Categories</Text>
      <FlatList
        data={categories}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.catItem,
              selCats.includes(item.id) && styles.catSelected,
            ]}
            onPress={() => toggleCat(item.id)}
          >
            <Text>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      <Button title="Create Group" onPress={create} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:16 },
  input:     {
    borderWidth:1, borderColor:'#ccc', borderRadius:4,
    padding:8, marginBottom:16
  },
  row:       { flexDirection:'row', justifyContent:'space-between', marginBottom:16 },
  label:     { marginBottom:8, fontWeight:'500' },
  catItem:   {
    padding:12, borderWidth:1, borderColor:'#ccc',
    borderRadius:4, marginBottom:8
  },
  catSelected: {
    backgroundColor:'#E6F0FF', borderColor:'#007AFF'
  },
});
