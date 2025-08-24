// AddUser.js
import React, { useState, useContext } from 'react';
import {
  View,
  TextInput,
  Button,
  Alert,
  StyleSheet,
} from 'react-native';
import axios from 'axios';
import { UserContext } from './UserContext';
import { API_BASE } from './config';

export default function AddUser() {
  const { setUser } = useContext(UserContext);
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      return Alert.alert('Error', 'Name is required.');
    }
    try {
      const res = await axios.post(`${API_BASE}/api/users`, {
        name:  name.trim(),
        email: email.trim() || null,
      });
      setUser(res.data);
      // No navigation here—context change will switch to MainTabs automatically
    } catch (err) {
      Alert.alert(
        'Creation failed',
        err.response?.data?.error || err.message
      );
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextInput
        style={styles.input}
        placeholder="Email (optional)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Button title="Create Profile" onPress={handleCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:16, justifyContent:'center' },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
  },
});
