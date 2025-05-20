// AddGroup.js
import React, { useState, useLayoutEffect } from 'react';
import {
  View, TextInput, Switch, Button, Alert, StyleSheet, Text
} from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';

export default function AddGroup({ navigation }) {
  const [name, setName]         = useState('');
  const [isPrivate, setPrivate] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'New Group' });
  }, [navigation]);

  const create = async () => {
    if (!name.trim()) return Alert.alert('Please enter a group name');
    try {
      await axios.post(`${API_BASE}/api/groups`, { name, isPrivate });
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert('Failed to create group', err.response?.data?.error || err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Group Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Coast Cruisers"
      />
      <View style={styles.row}>
        <Text>Private Group?</Text>
        <Switch value={isPrivate} onValueChange={setPrivate} />
      </View>
      <Button title="Create Group" onPress={create} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:16 },
  label:     { marginBottom:8, fontWeight:'500' },
  input:     {
    borderWidth:1, borderColor:'#ccc', borderRadius:4,
    padding:8, marginBottom:16
  },
  row:       {
    flexDirection:'row', justifyContent:'space-between',
    alignItems:'center', marginBottom:16
  },
});
