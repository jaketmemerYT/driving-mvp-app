// AddUser.js
import React, { useEffect, useState, useLayoutEffect, useContext } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function AddUser({ route, navigation }) {
  const editId = route?.params?.userId || null;
  const isEdit = !!editId;

  const { user, setUser } = useContext(UserContext) || {};

  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(isEdit);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Profile' : 'New Profile' });
  }, [navigation, isEdit]);

  useEffect(() => {
    let active = true;
    if (!isEdit) return;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/users/${editId}`);
        if (!active) return;
        setName(res.data?.name || '');
        setEmail(res.data?.email || '');
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Could not load user.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isEdit, editId]);

  const onSave = async () => {
    const payload = { name: name.trim(), email: email.trim() || undefined };
    if (!payload.name) {
      Alert.alert('Name required', 'Please enter a name.');
      return;
    }
    try {
      if (isEdit) {
        const res = await axios.put(`${API_BASE}/api/users/${editId}`, payload);
        // if we edited the active user, update context
        if (user?.id === editId) setUser?.(res.data);
        navigation.goBack();
      } else {
        const res = await axios.post(`${API_BASE}/api/users`, payload);
        // commonly, activate newly created profile
        setUser?.(res.data);
        navigation.popToTop(); // go back to where UserList/Auth leads
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', isEdit ? 'Could not save changes.' : 'Could not create profile.');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Display Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g., Alex Rider"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Email (optional)</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="alex@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Button title={isEdit ? 'Save Changes' : 'Create Profile'} onPress={onSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10,
    backgroundColor: '#fff',
  },
});
