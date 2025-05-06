import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet } from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';

export default function AddVehicle({ navigation }) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  const submit = async () => {
    if (!make || !model || !year) return Alert.alert('All fields are required');
    try {
      await axios.post(`${API_BASE}/api/vehicles`, { make, model, year: Number(year) });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error adding vehicle', err.response?.data?.error || err.message);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput placeholder="Make" value={make} onChangeText={setMake} style={styles.input} />
      <TextInput placeholder="Model" value={model} onChangeText={setModel} style={styles.input} />
      <TextInput placeholder="Year" value={year} onChangeText={setYear} keyboardType="numeric" style={styles.input} />
      <Button title="Create Vehicle" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex:1,padding:16,justifyContent:'center'},
  input: {borderWidth:1,borderColor:'#ccc',padding:8,marginBottom:12}
});
