// UserList.js
import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Button,
  StyleSheet,
} from 'react-native';
import axios from 'axios';
import { UserContext } from './UserContext';
import { API_BASE } from './config';

export default function UserList({ navigation }) {
  const { setUser } = useContext(UserContext);
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    axios
      .get(`${API_BASE}/api/users`)
      .then(res => {
        if (!active) return;
        setUsers(res.data);
      })
      .catch(console.error)
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large"/>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Guest option */}
      <Button
        title="Continue as Guest"
        onPress={() =>
          setUser({ id: 'guest', name: 'Guest', email: null })
        }
      />

      {/* Existing profiles */}
      <FlatList
        data={users}
        keyExtractor={u => u.id}
        ListHeaderComponent={<Text style={styles.header}>Select Profile</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => setUser(item)}
          >
            <Text style={styles.itemText}>{item.name}</Text>
            {item.email ? (
              <Text style={styles.subText}>{item.email}</Text>
            ) : null}
          </TouchableOpacity>
        )}
      />

      {/* Create new profile */}
      <View style={styles.footer}>
        <Button
          title="New Profile"
          onPress={() => navigation.navigate('AddUser')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:    { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  item:      {
    padding:        12,
    borderBottomWidth: 1,
    borderColor:    '#EEE',
  },
  itemText:  { fontSize: 16 },
  subText:   { color: '#666', marginTop: 4 },
  footer:    { marginTop: 16 },
});
