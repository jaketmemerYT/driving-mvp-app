// UserList.js
import React, { useEffect, useState, useLayoutEffect, useContext, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function UserList({ navigation }) {
  const { user, setUser } = useContext(UserContext) || {};
  const [users, setUsers] = useState(null);
  const activeId = user?.id || null;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Select Profile',
      headerRight: () => (
        <Text style={styles.newBtn} onPress={() => navigation.navigate('AddUser')}>New</Text>
      ),
    });
  }, [navigation]);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/users`);
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    load().catch(()=>{});
    return () => { active = false; };
  }, [load]);

  const makeActive = async (u) => {
    try {
      setUser?.(u); // context drives app to MainTabs
    } catch (e) {
      console.error(e);
    }
  };

  const editUser = (u) => {
    navigation.navigate('AddUser', { userId: u.id });
  };

  const deleteUser = async (u) => {
    if (u.id === activeId) {
      Alert.alert('Cannot delete active profile', 'Switch to a different profile first.');
      return;
    }
    Alert.alert('Delete Profile', `Delete "${u.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_BASE}/api/users/${u.id}`);
            await load();
          } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Could not delete profile.');
          }
        },
      },
    ]);
  };

  if (!users) {
    return (
      <View style={styles.center}><ActivityIndicator size="large" /></View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => {
          const isActive = item.id === activeId;
          const initials = (item.name || 'U')
            .split(' ')
            .map((s) => s[0]?.toUpperCase())
            .slice(0, 2)
            .join('');

          return (
            <TouchableOpacity
              style={[styles.row, isActive && styles.rowActive]}
              activeOpacity={0.85}
              onPress={() => makeActive(item)}
            >
              <View style={[styles.avatar, isActive && styles.avatarActive]}>
                <Text style={styles.avatarTxt}>{initials}</Text>
              </View>
              <View style={styles.main}>
                <Text style={styles.name}>
                  {item.name} {isActive ? <Text style={styles.activePill}> • Active</Text> : null}
                </Text>
                {item.email ? <Text style={styles.dim}>{item.email}</Text> : null}
              </View>
              <Text style={styles.action} onPress={() => editUser(item)}>Edit</Text>
              <Text style={[styles.action, styles.destructive]} onPress={() => deleteUser(item)}>Delete</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  newBtn: { color: '#007AFF', fontWeight: '600', padding: 8 },
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderColor: '#EEE',
  },
  rowActive: { backgroundColor: '#F8FAFF' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center',
  },
  avatarActive: { backgroundColor: '#1D4ED8' },
  avatarTxt: { color: '#fff', fontWeight: '700' },
  main: { flex: 1, marginHorizontal: 10 },
  name: { fontWeight: '700', color: '#0F172A' },
  activePill: { color: '#10B981', fontWeight: '700' },
  dim: { color: '#64748B', marginTop: 2 },
  action: { color: '#007AFF', fontWeight: '600', paddingHorizontal: 6, paddingVertical: 4 },
  destructive: { color: '#DC2626' },
});
