// UserList.js
import React, { useState, useContext, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Button,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function UserList({ navigation }) {
  const { user, setUser } = useContext(UserContext);
  const [users, setUsers]  = useState(null);

  // Header: title + “New” button
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Select User',
      headerRight: () => (
        <Button
          title="New"
          onPress={() => navigation.navigate('AddUser')}
        />
      ),
    });
  }, [navigation]);

  // Reload list whenever this screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      setUsers(null);
      axios
        .get(`${API_BASE}/api/users`)
        .then(res => setUsers(res.data))
        .catch(console.error);
    }, [])
  );

  if (users === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (users.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>No profiles found.</Text>
        <Button
          title="Create Profile"
          onPress={() => navigation.navigate('AddUser')}
        />
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          onPress={() => {
            setUser(item);
            navigation.navigate('HomeTab');
          }}
        >
          <Text style={styles.name}>{item.name}</Text>
          {item.email ? (
            <Text style={styles.email}>{item.email}</Text>
          ) : null}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center'
  },
  message: {
    marginBottom: 16, fontSize: 16, color: '#666'
  },
  item: {
    padding: 16, borderBottomWidth: 1, borderColor: '#EEE'
  },
  name: {
    fontSize: 18
  },
  email: {
    marginTop: 4, color: '#666'
  },
});
