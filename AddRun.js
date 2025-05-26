// AddRun.js
import React, { useState, useEffect, useContext, useLayoutEffect } from 'react';
import {
  View, Text, Button, TextInput,
  FlatList, TouchableOpacity, StyleSheet, Alert, ScrollView
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { UserContext } from './UserContext';
import { API_BASE }   from './config';

export default function AddRun() {
  const nav = useNavigation();
  const { user } = useContext(UserContext);

  const [trailheads, setTrailheads] = useState([]);
  const [groups, setGroups]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [vehicles, setVehicles]     = useState([]);

  const [name, setName]             = useState('');
  const [trailId, setTrailId]       = useState(null);
  const [groupId, setGroupId]       = useState(null);
  const [selCats, setSelCats]       = useState([]);
  const [vehicleId, setVehicleId]   = useState(null);

  useLayoutEffect(() => {
    nav.setOptions({ title: 'New Run' });
  }, [nav]);

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE}/api/trailheads`),
      axios.get(`${API_BASE}/api/groups`),
      axios.get(`${API_BASE}/api/categories`),
      axios.get(`${API_BASE}/api/vehicles`),
    ]).then(([tRes, gRes, cRes, vRes]) => {
      setTrailheads(tRes.data);
      setGroups(gRes.data);
      setCategories(cRes.data);
      setVehicles(vRes.data);
    }).catch(console.error);
  }, []);

  const toggleCat = id => {
    setSelCats(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);
  };

  const begin = () => {
    if (!user) return Alert.alert('No user selected');
    if (!trailId) return Alert.alert('Pick a trail');
    if (!groupId) return Alert.alert('Pick a group');
    if (!vehicleId) return Alert.alert('Pick a vehicle');

    nav.navigate('Tracker', {
      userId:       user.id,
      trailId,
      trailName:    name || trailheads.find(t=>t.id===trailId)?.name,
      groupId,
      categoryIds:  selCats,
    });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Optional Run Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Name (or leave blank)"
        value={name} onChangeText={setName}
      />

      <Text style={styles.label}>Choose Trail</Text>
      {trailheads.map(t => (
        <TouchableOpacity
          key={t.id}
          style={[styles.item, trailId===t.id && styles.selected]}
          onPress={()=>setTrailId(t.id)}
        >
          <Text>{t.name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.label}>Choose Group</Text>
      {groups.map(g => (
        <TouchableOpacity
          key={g.id}
          style={[styles.item, groupId===g.id && styles.selected]}
          onPress={()=>setGroupId(g.id)}
        >
          <Text>{g.name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.label}>Tags (Categories)</Text>
      <View style={styles.chipContainer}>
        {categories.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, selCats.includes(c.id)&&styles.chipSel]}
            onPress={()=>toggleCat(c.id)}
          >
            <Text style={selCats.includes(c.id)&&styles.chipTextSel}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Select Vehicle</Text>
      {vehicles.map(v => (
        <TouchableOpacity
          key={v.id}
          style={[styles.item, vehicleId===v.id && styles.selected]}
          onPress={()=>setVehicleId(v.id)}
        >
          <Text>{`${v.make} ${v.model} (${v.year})`}</Text>
        </TouchableOpacity>
      ))}

      <Button title="Begin Run" onPress={begin} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,padding:16},
  label:    {fontWeight:'500',marginTop:16,marginBottom:8},
  input:    {borderWidth:1,borderColor:'#ccc',borderRadius:4,padding:8},
  item:     {padding:12,borderWidth:1,borderColor:'#ccc',borderRadius:4,marginBottom:8},
  selected: {borderColor:'#007AFF',backgroundColor:'#E6F0FF'},
  chipContainer:{flexDirection:'row',flexWrap:'wrap',marginBottom:16},
  chip:     {
    paddingHorizontal:12,paddingVertical:6,borderRadius:16,
    backgroundColor:'#EEE',marginRight:8,marginBottom:8
  },
  chipSel:  {backgroundColor:'#007AFF'},
  chipTextSel:{color:'#FFF'}
});
