// UserList.js
import React, { useState, useEffect, useContext, useLayoutEffect } from 'react';
import {
  View, FlatList, TouchableOpacity,
  Text, ActivityIndicator, StyleSheet, Button
} from 'react-native';
import axios from 'axios';
import { UserContext } from './UserContext';
import { API_BASE } from './config';

export default function UserList({ navigation }) {
  const [users, setUsers] = useState(null);
  const { setUser }       = useContext(UserContext);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Select User',
      headerRight: () => (
        <Button title="New" onPress={() => navigation.navigate('AddUser')} />
      ),
    });
  }, [navigation]);

  useEffect(() => {
    axios.get(`${API_BASE}/api/users`)
      .then(r => setUsers(r.data))
      .catch(console.error);
  }, []);

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
      keyExtractor={u => u.id}
      ListEmptyComponent={() => (
        <Text style={styles.empty}>No users—please create one.</Text>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          onPress={() => {
            setUser(item);
            navigation.navigate('Runs'); // go to Runs tab
          }}
        >
          <Text style={styles.name}>{item.name}</Text>
          {item.email && <Text style={styles.email}>{item.email}</Text>}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex:1,justifyContent:'center',alignItems:'center' },
  empty:  { textAlign:'center',marginTop:32,color:'#666' },
  item:   { padding:16,borderBottomWidth:1,borderColor:'#EEE' },
  name:   { fontSize:16,fontWeight:'bold' },
  email:  { color:'#666',marginTop:4 },
});
