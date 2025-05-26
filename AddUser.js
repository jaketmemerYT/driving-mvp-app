// AddUser.js
import React, { useState, useLayoutEffect } from 'react';
import {
  View, TextInput, Button, Alert, StyleSheet
} from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';

export default function AddUser({ navigation }) {
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'New User' });
  }, [navigation]);

  const submit = () => {
    if (!name.trim()) return Alert.alert('Name is required');
    axios.post(`${API_BASE}/api/users`, {
      name:  name.trim(),
      email: email.trim() || undefined,
    })
    .then(() => navigation.goBack())
    .catch(err => {
      console.error(err);
      Alert.alert('Error', err.response?.data?.error || err.message);
    });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name} onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email (optional)"
        value={email} onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Button title="Create User" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1,padding:16 },
  input:    { borderWidth:1,borderColor:'#ccc',borderRadius:4,padding:8,marginBottom:16 }
});
