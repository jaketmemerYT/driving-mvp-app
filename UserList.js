// UserList.js
import React, { useContext, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function UserList({ navigation }) {
  const { user, setUser } = useContext(UserContext);
  const [users, setUsers] = useState(null);

  // Reload the user list any time this screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      setUsers(null);
      axios
        .get(`${API_BASE}/api/users`)
        .then(res => setUsers(res.data))
        .catch(err => {
          console.error(err);
          setUsers([]);
        });
    }, [])
  );

  if (users === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const isSelected = user?.id === item.id;
        return (
          <TouchableOpacity
            style={[styles.item, isSelected && styles.selected]}
            onPress={() => {
              setUser(item);
              // Switch to the Runs tab (RunsTab in App.js)
              navigation.getParent()?.navigate('RunsTab');
            }}
          >
            <Text style={styles.name}>{item.name}</Text>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={() => (
        <View style={styles.center}>
          <Text>No users found.</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingVertical: 8,
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#EEE',
  },
  selected: {
    backgroundColor: '#E6F0FF',
  },
  name: {
    fontSize: 16,
  },
});
