// Contact.js
import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserContext } from './UserContext';

export default function Contact() {
  const { user } = useContext(UserContext);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Name:</Text>
      <Text style={styles.value}>{user?.name || '—'}</Text>

      <Text style={styles.label}>Email:</Text>
      <Text style={styles.value}>{user?.email || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    padding:        16,
  },
  label: {
    fontWeight:     '600',
    marginTop:      12,
  },
  value: {
    fontSize:       16,
    marginTop:      4,
    color:          '#333',
  },
});
