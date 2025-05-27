// AddTrail.js
import React, { useState, useEffect, useContext, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, Button, Alert
} from 'react-native';
import axios from 'axios';
import { UserContext } from './UserContext';
import { API_BASE } from './config';

export default function AddTrail({ navigation }) {
  const { user } = useContext(UserContext);
  const [name, setName]           = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [categories, setCategories] = useState([]);
  const [groups, setGroups]         = useState([]);
  const [selCats, setSelCats]       = useState([]);
  const [selGroups, setSelGroups]   = useState([]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'New Trail' });
  }, [navigation]);

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE}/api/categories`),
      axios.get(`${API_BASE}/api/groups`)
    ]).then(([cRes, gRes]) => {
      setCategories(cRes.data);
      setGroups(gRes.data);
    }).catch(err => {
      console.error(err);
      Alert.alert('Error', 'Could not load categories or groups');
    });
  }, []);

  const toggle = (id, arr, setArr) =>
    setArr(a => a.includes(id) ? a.filter(x=>x!==id) : [...a, id]);

  const submit = () => {
    if (!user) {
      return Alert.alert('No user', 'Please select or create a user first.');
    }
    if (!name.trim()) {
      return Alert.alert('Name required');
    }
    axios.post(`${API_BASE}/api/trailheads`, {
      name:        name.trim(),
      difficulty:  difficulty.trim() || undefined,
      categoryIds: selCats,
      groupIds:    selGroups,
      userId:      user.id
    })
    .then(() => navigation.goBack())
    .catch(err => {
      console.error(err);
      Alert.alert('Error', err.response?.data?.error || err.message);
    });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Trail Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. River View Loop"
      />

      <Text style={styles.label}>Difficulty (optional)</Text>
      <TextInput
        style={styles.input}
        value={difficulty}
        onChangeText={setDifficulty}
        placeholder="easy, intermediate, advanced…"
      />

      <Text style={styles.label}>Categories</Text>
      <View style={styles.chipContainer}>
        {categories.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, selCats.includes(c.id)&&styles.chipSel]}
            onPress={()=>toggle(c.id, selCats, setSelCats)}
          >
            <Text style={selCats.includes(c.id)&&styles.chipTextSel}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Visible To Groups</Text>
      <View style={styles.chipContainer}>
        {groups.map(g => (
          <TouchableOpacity
            key={g.id}
            style={[styles.chip, selGroups.includes(g.id)&&styles.chipSel]}
            onPress={()=>toggle(g.id, selGroups, setSelGroups)}
          >
            <Text style={selGroups.includes(g.id)&&styles.chipTextSel}>
              {g.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button title="Create Trail" onPress={submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex:1, padding:16 },
  label:        { marginTop:16, marginBottom:8, fontWeight:'500' },
  input:        {
    borderWidth:1, borderColor:'#ccc', borderRadius:4,
    padding:8, marginBottom:16
  },
  chipContainer:{ flexDirection:'row', flexWrap:'wrap', marginBottom:16 },
  chip:         {
    paddingHorizontal:12, paddingVertical:6,
    backgroundColor:'#EEE', borderRadius:16,
    marginRight:8, marginBottom:8
  },
  chipSel:      { backgroundColor:'#007AFF' },
  chipTextSel:  { color:'#FFF' },
});
