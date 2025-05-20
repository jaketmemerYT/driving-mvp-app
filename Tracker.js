// Tracker.js
import React, {
  useState, useRef, useEffect, useLayoutEffect
} from 'react';
import {
  View, Text, Alert, ActivityIndicator,
  StyleSheet, TouchableOpacity, Button
} from 'react-native';
import MapView, { Polyline, Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE } from './config';

// Haversine formula
function distanceMeters(a,b){ /* same as before */ }

export default function Tracker({ route, navigation }) {
  const { trailId: pTrailId, trailName, startCoords, endCoords } = route.params;
  const [trailId, setTrailId]     = useState(pTrailId||null);
  const [groups, setGroups]       = useState(null);
  const [vehicles, setVehicles]   = useState(null);
  const [selGroup, setSelGroup]   = useState(null);
  const [selVehicle, setSelVehicle] = useState(null);
  const [tracking, setTracking]   = useState(false);

  const coordsRef = useRef(startCoords?[startCoords]:[]);
  const [coords,setCoords] = useState(coordsRef.current);
  const [region,setRegion] = useState(
    startCoords?{...startCoords,latitudeDelta:0.01,longitudeDelta:0.01}:null
  );
  const startTime= useRef(null), poller= useRef(null), mapRef= useRef(null);

  // load groups & vehicles on focus
  useEffect(()=>{
    const unsub = navigation.addListener('focus',()=>{
      axios.get(`${API_BASE}/api/groups`).then(r=>setGroups(r.data));
      axios.get(`${API_BASE}/api/vehicles`).then(r=>setVehicles(r.data));
    });
    return unsub;
  },[navigation]);

  const startTracking = async ()=>{
    if (!selGroup)   return Alert.alert('Select a group first');
    if (!selVehicle)return Alert.alert('Select a vehicle first');

    // create trail if needed
    if (trailName && !trailId){
      const res = await axios.post(`${API_BASE}/api/trailheads`,{name:trailName});
      setTrailId(res.data.id);
    }

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status!=='granted') return Alert.alert('Location denied');

    // seed location
    const { coords:initial } = await Location.getCurrentPositionAsync({
      accuracy:Location.Accuracy.High,
    });
    coordsRef.current=[{latitude:initial.latitude,longitude:initial.longitude}];
    setCoords(coordsRef.current);
    setRegion({...initial,latitudeDelta:0.01,longitudeDelta:0.01});
    startTime.current=Date.now();
    setTracking(true);

    // polling loop
    poller.current = setInterval(async()=>{
      const { coords:pt } = await Location.getCurrentPositionAsync({
        accuracy:Location.Accuracy.High,
      });
      const p = {latitude:pt.latitude,longitude:pt.longitude};
      coordsRef.current.push(p);
      setCoords([...coordsRef.current]);
      mapRef.current?.animateToRegion({...p,latitudeDelta:region.latitudeDelta,longitudeDelta:region.longitudeDelta});
      if (endCoords && distanceMeters(p,endCoords)<6) stopTracking();
    },1000);
  };

  const stopTracking = async ()=>{
    clearInterval(poller.current);
    setTracking(false);
    const runCoords = coordsRef.current;
    const duration  = (Date.now()-startTime.current)/1000;
    const avgSpeed  = runCoords.reduce((s,p)=>s+(p.speed||0),0)/runCoords.length||0;

    await axios.post(`${API_BASE}/api/routes`,{
      trailId, coords:runCoords, duration, avgSpeed,
      vehicleId:selVehicle, groupId:selGroup
    });
    navigation.replace('RunDetail',{run:runCoords,trailName});
  };

  useLayoutEffect(()=>{
    navigation.setOptions({
      title: trailName||'Tracker',
      headerRight: ()=>(
        <Button
          title={tracking?'Stop':'Start'}
          onPress={tracking?stopTracking:startTracking}
          disabled={!selGroup || !selVehicle || !region}
        />
      ),
    });
  },[navigation,tracking,selGroup,selVehicle,region]);

  // loading states
  if (!groups||!vehicles){
    return <ActivityIndicator style={styles.center} size="large"/>;
  }
  if (groups.length===0){
    return (
      <View style={styles.center}>
        <Button title="Create a Group" onPress={()=>navigation.navigate('AddGroup')}/>
      </View>
    );
  }
  if (vehicles.length===0){
    return (
      <View style={styles.center}>
        <Button title="Add a Vehicle" onPress={()=>navigation.navigate('AddVehicle')}/>
      </View>
    );
  }

  // not tracking: pick group then vehicle
  if (!tracking){
    return (
      <View style={styles.container}>
        <Text style={styles.subheader}>Select a Group</Text>
        {groups.map(g=>(
          <TouchableOpacity
            key={g.id}
            style={[styles.item, selGroup===g.id&&styles.selected]}
            onPress={()=>setSelGroup(g.id)}
          >
            <Text>{g.name} {g.isPrivate?'🔒':''}</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.subheader}>Select Your Vehicle</Text>
        {vehicles.map(v=>(
          <TouchableOpacity
            key={v.id}
            style={[styles.item, selVehicle===v.id&&styles.selected]}
            onPress={()=>setSelVehicle(v.id)}
          >
            <Text>{v.make} {v.model} ({v.year})</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // tracking: show map
  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={region}
    >
      <Polyline coordinates={coords} strokeWidth={4}/>
      <Marker coordinate={coords[coords.length-1]}/>
      {endCoords && <Marker coordinate={endCoords} pinColor="green"/>}
      {endCoords && <Circle center={endCoords} radius={6}/>}
    </MapView>
  );
}

const styles = StyleSheet.create({
  center: {flex:1,justifyContent:'center',alignItems:'center'},
  container:{flex:1,padding:16},
  map:     {flex:1},
  subheader:{marginTop:16,marginBottom:8,fontWeight:'500'},
  item:    {padding:12,borderWidth:1,borderColor:'#ccc',borderRadius:4,marginBottom:8},
  selected:{backgroundColor:'#E6F0FF',borderColor:'#007AFF'},
});
