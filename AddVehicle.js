// AddVehicle.js
import React, { useState, useContext, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet
} from 'react-native';
import axios from 'axios';
import { UserContext } from './UserContext';
import { API_BASE } from './config';

export default function AddVehicle({ navigation }) {
  const { user } = useContext(UserContext);
  const [make, setMake]   = useState('');
  const [model, setModel] = useState('');
  const [year, setYear]   = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'New Vehicle' });
  }, [navigation]);

  const submit = () => {
    if (!user) {
      return Alert.alert(
        'No user selected',
        'Please go to Profile and pick or create a user first.'
      );
    }
    if (!make.trim() || !model.trim() || !year.trim()) {
      return Alert.alert(
        'All fields required',
        'Please enter make, model, and year.'
      );
    }
    const payload = {
      make:  make.trim(),
      model: model.trim(),
      year:  parseInt(year, 10),
      userId: user.id,
    };
    axios
      .post(`${API_BASE}/api/vehicles`, payload)
      .then(() => navigation.goBack())
      .catch(err => {
        console.error(err);
        Alert.alert(
          'Error adding vehicle',
          err.response?.data?.error || err.message
        );
      });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.currentUser}>
        Current user: {user?.name ?? '—'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Make"
        value={make}
        onChangeText={setMake}
      />
      <TextInput
        style={styles.input}
        placeholder="Model"
        value={model}
        onChangeText={setModel}
      />
      <TextInput
        style={styles.input}
        placeholder="Year"
        value={year}
        onChangeText={setYear}
        keyboardType="numeric"
      />

      <Button title="Save Vehicle" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  currentUser: {
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
  },
});
