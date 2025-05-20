// GroupList.js
import React, {
    useState,
    useEffect,
    useLayoutEffect,
    useCallback
  } from 'react';
  import {
    View,
    FlatList,
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
    Button,
  } from 'react-native';
  import { useFocusEffect } from '@react-navigation/native';
  import axios from 'axios';
  import { API_BASE } from './config';
  
  export default function GroupList({ navigation }) {
    const [groups, setGroups]       = useState(null);
    const [refreshing, setRefreshing] = useState(false);
  
    // Load groups
    const loadGroups = () => {
      setRefreshing(true);
      axios
        .get(`${API_BASE}/api/groups`)
        .then(res => setGroups(res.data))
        .catch(err => console.error('Error fetching groups:', err))
        .finally(() => setRefreshing(false));
    };
  
    // Initial load
    useEffect(() => {
      loadGroups();
    }, []);
  
    // Reload on focus
    useFocusEffect(
      useCallback(() => {
        loadGroups();
      }, [])
    );
  
    // Header button
    useLayoutEffect(() => {
      navigation.setOptions({
        headerTitle: 'Groups',
        headerRight: () => (
          <Button
            title="New"
            onPress={() => navigation.navigate('AddGroup')}
          />
        ),
      });
    }, [navigation]);
  
    // Loading state
    if (groups === null) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      );
    }
  
    return (
      <FlatList
        data={groups}
        keyExtractor={(item, idx) => (item.id ? String(item.id) : String(idx))}
        refreshing={refreshing}
        onRefresh={loadGroups}
        ListEmptyComponent={() => (
          <Text style={styles.empty}>No groups yet.</Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.subtitle}>
              {item.isPrivate ? 'Private' : 'Public'}
            </Text>
          </TouchableOpacity>
        )}
      />
    );
  }
  
  const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { textAlign: 'center', marginTop: 32, color: '#666' },
    item: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
    title: { fontSize: 16, fontWeight: 'bold' },
    subtitle: { color: '#666' },
  });
  