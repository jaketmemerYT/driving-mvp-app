// ActiveUserPill.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { UserContext } from './UserContext';

export default function ActiveUserPill() {
  const navigation = useNavigation();
  const { user } = React.useContext(UserContext) || {};
  if (!user) return null;

  const initials = (user.name || 'U')
    .split(' ')
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <View style={styles.wrap}>
      <View style={styles.avatar}><Text style={styles.avatarTxt}>{initials}</Text></View>
      <View style={styles.meta}>
        <Text numberOfLines={1} style={styles.name}>{user.name}</Text>
        <Text style={styles.dim}>Active profile</Text>
      </View>
      <TouchableOpacity
        style={styles.switchBtn}
        onPress={() => navigation.navigate('UserList')}
        activeOpacity={0.85}
      >
        <Text style={styles.switchTxt}>Switch</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    padding: 10, margin: 12, borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: '#fff', fontWeight: '700' },
  meta: { flex: 1, marginHorizontal: 10 },
  name: { fontWeight: '700', color: '#0F172A' },
  dim: { color: '#64748B', fontSize: 12, marginTop: 2 },
  switchBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#111827', borderRadius: 999 },
  switchTxt: { color: '#fff', fontWeight: '600' },
});
