// AddUser.js
import React, { useState, useContext, useLayoutEffect } from 'react';
import {
  View,
  TextInput,
  Button,
  Alert,
  StyleSheet,
} from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function AddUser({ navigation }) {
  const { setUser } = useContext(UserContext);
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'New User' });
  }, [navigation]);

  const submit = async () => {
    if (!name.trim()) {
      return Alert.alert('Name required', 'Please enter your name.');
    }
    try {
      const res = await axios.post(`${API_BASE}/api/users`, {
        name:  name.trim(),
        email: email.trim() || null,
      });
      setUser(res.data);
      navigation.navigate('HomeTab');
    } catch (err) {
      console.error(err);
      Alert.alert(
        'Error creating profile',
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
        autoFocus
      />
      <TextInput
        style={styles.input}
        placeholder="Email (optional)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Button title="Create Profile" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, padding: 16
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
  },
});
