// AddTrail.js
import React, {
    useState,
    useRef,
    useLayoutEffect,
    useEffect
  } from 'react';
  import {
    View,
    TextInput,
    Button,
    Alert,
    StyleSheet,
    ActivityIndicator
  } from 'react-native';
  import MapView, { Marker, Polyline } from 'react-native-maps';
  import * as Location from 'expo-location';
  import axios from 'axios';
  import { API_BASE } from './config';
  
  export default function AddTrail({ navigation }) {
    const [name, setName]           = useState('');
    const [difficulty, setDifficulty] = useState('');
    const [startCoords, setStart]   = useState(null);
    const [endCoords, setEnd]       = useState(null);
    const [route, setRoute]         = useState([]);
    const [recording, setRecording] = useState(false);
    const watchRef                  = useRef(null);
  
    // Header title
    useLayoutEffect(() => {
      navigation.setOptions({ title: 'New Trail' });
    }, [navigation]);
  
    // Seed trailhead
    useEffect(() => {
      let mounted = true;
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Allow location access');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });
        if (!mounted) return;
        const pt = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          speed: loc.coords.speed || 0,
          heading: loc.coords.heading || 0,
          altitude: loc.coords.altitude || 0,
          accuracy: loc.coords.accuracy || 0,
          timestamp: loc.timestamp
        };
        setStart(pt);
        setRoute([pt]);
      })();
      return () => {
        mounted = false;
        if (watchRef.current) {
          watchRef.current.remove();
          watchRef.current = null;
        }
      };
    }, []);
  
    // Begin recording live route
    const begin = async () => {
      setRecording(true);
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1 },
        loc => {
          const pt = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            speed: loc.coords.speed || 0,
            heading: loc.coords.heading || 0,
            altitude: loc.coords.altitude || 0,
            accuracy: loc.coords.accuracy || 0,
            timestamp: loc.timestamp
          };
          setRoute(r => [...r, pt]);
        }
      );
    };
  
    // Stop, finalize endpoint, and POST
    const end = async () => {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
      setRecording(false);
  
      const finalEnd = endCoords || route[route.length - 1];
  
      if (!name.trim()) {
        return Alert.alert('Name required', 'Enter a trail name.');
      }
      if (!route.length) {
        return Alert.alert('No route', 'Record some GPS points first.');
      }
  
      try {
        const res = await axios.post(`${API_BASE}/api/trailheads`, {
          name:        name.trim(),
          difficulty:  difficulty.trim() || 'Unknown',
          coords:      startCoords,
          endCoords:   finalEnd,
          route:       route,
          categoryIds: [],    // wire these up later
          groupIds:    []     // wire these up later
        });
  
        navigation.navigate('TrailDetail', {
          trailId:   res.data.id,
          trailName: res.data.name
        });
      } catch (err) {
        Alert.alert(
          'Error saving trail',
          err.response?.data?.error || err.message
        );
      }
    };
  
    // Allow tapping map to set manual end
    const onMapPress = e => {
      if (!recording) {
        setEnd({ ...e.nativeEvent.coordinate, timestamp: Date.now(), speed: 0 });
      }
    };
  
    // Guard: wait for initial trailhead
    if (!startCoords) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      );
    }
  
    return (
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          placeholder="Trail name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Difficulty (easy, intermediate...)"
          value={difficulty}
          onChangeText={setDifficulty}
        />
  
        <MapView
          style={styles.map}
          initialRegion={{
            latitude:       startCoords.latitude,
            longitude:      startCoords.longitude,
            latitudeDelta:  0.01,
            longitudeDelta: 0.01
          }}
          onPress={onMapPress}
        >
          <Marker coordinate={startCoords} title="Trailhead" />
          {endCoords && <Marker coordinate={endCoords} pinColor="green" title="Endpoint" />}
          {route.length > 1 && (
            <Polyline coordinates={route} strokeWidth={4} strokeColor="black" />
          )}
        </MapView>
  
        <View style={styles.buttons}>
          {!recording ? (
            <Button title="Begin Recording" onPress={begin} />
          ) : (
            <Button title="Stop & Save" onPress={end} />
          )}
        </View>
      </View>
    );
  }
  
  const styles = StyleSheet.create({
    container: { flex: 1 },
    center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
    input: {
      borderWidth:  1,
      borderColor:  '#CCC',
      borderRadius: 4,
      padding:      8,
      margin:       8
    },
    map:    { flex: 1 },
    buttons:{ padding: 16 }
  });
  