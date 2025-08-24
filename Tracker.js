// Tracker.js
import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useContext
} from 'react';
import {
  View,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  Button
} from 'react-native';
import MapView, { Polyline, Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

// Haversine formula: meters between two lat/long points
function distanceMeters(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const sq =
    sinDlat * sinDlat +
    sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(sq));
}

export default function Tracker({ route, navigation }) {
  const { user } = useContext(UserContext);
  const {
    trailId,
    trailName,
    startCoords,
    endCoords,
    officialRoute
  } = route.params;

  // --- pull preferences with defaults ---
  const prefs         = user.preferences || {};
  const liveColor     = prefs.liveRouteColor     || 'blue';
  const officialColor = prefs.officialRouteColor || 'black';
  const warnColor1    = prefs.warningColor1      || 'orange';
  const warnColor2    = prefs.warningColor2      || 'red';
  const thresh1Feet   = prefs.warningThreshold1  || 50;
  const thresh2Feet   = prefs.warningThreshold2  || 75;
  const thresh1       = thresh1Feet * 0.3048;  // feet → meters
  const thresh2       = thresh2Feet * 0.3048;

  // --- state & refs ---
  const [vehicles, setVehicles] = useState(null);
  const [selectedVid, setVid]   = useState(null);
  const [tracking, setTracking] = useState(false);

  const coordsRef    = useRef(startCoords ? [startCoords] : []);
  const [coords, setCoords]     = useState(coordsRef.current);
  const [region, setRegion]     = useState(
    startCoords
      ? { ...startCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      : null
  );

  const startTime     = useRef(null);
  const watcher       = useRef(null);
  const warned1Ref    = useRef(false);
  const warned2Ref    = useRef(false);
  const [deviation, setDeviation] = useState(0);

  // --- load only this user's vehicles on focus ---
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      axios
        .get(`${API_BASE}/api/vehicles`, { params: { userId: user.id } })
        .then(r => setVehicles(r.data))
        .catch(() => Alert.alert('Error','Could not load vehicles'));
    });
    return unsub;
  }, [navigation, user.id]);

  // --- finalize and upload ---
  const finalizeRun = async () => {
    watcher.current?.remove();
    setTracking(false);

    const runCoords = coordsRef.current.length
      ? coordsRef.current
      : [startCoords];

    const duration = (Date.now() - startTime.current) / 1000;
    const avgSpeed =
      runCoords.reduce((sum, p) => sum + (p.speed || 0), 0)
      / runCoords.length || 0;

    try {
      const res = await axios.post(`${API_BASE}/api/routes`, {
        trailId,
        coords:    runCoords,
        duration,
        avgSpeed,
        vehicleId: selectedVid,
        userId:    user.id,
        groupId:   null
      });
      navigation.navigate('RunsTab', {
        screen: 'RunDetail',
        params: { run: res.data, trailName }
      });
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.error || err.message);
    }

    coordsRef.current = [];
    setCoords([]);
  };

  // --- Stop: confirm if early, else finalize ---
  const stopTracking = () => {
    if (endCoords) {
      const last = coordsRef.current[coordsRef.current.length - 1] || startCoords;
      const dist = distanceMeters(last, endCoords);
      if (dist > 6) {
        return Alert.alert(
          'Finish Early?',
          `You're ${Math.round(dist)}m from the end. Finish now?`,
          [
            { text:'Cancel' },
            { text:'Finish', onPress: finalizeRun }
          ]
        );
      }
    }
    finalizeRun();
  };

  // --- Start: seed & watch position ---
  const startTracking = async () => {
    if (!selectedVid) {
      return Alert.alert('Select a vehicle first');
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission denied','Allow location');
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });
    const pt = {
      latitude:  loc.coords.latitude,
      longitude: loc.coords.longitude,
      speed:     loc.coords.speed    || 0,
      heading:   loc.coords.heading  || 0,
      altitude:  loc.coords.altitude || 0,
      accuracy:  loc.coords.accuracy || 0,
      timestamp: loc.timestamp
    };
    coordsRef.current = [pt];
    setCoords([pt]);
    setRegion({
      latitude:       pt.latitude,
      longitude:      pt.longitude,
      latitudeDelta:  0.01,
      longitudeDelta: 0.01
    });

    startTime.current = Date.now();
    setTracking(true);

    watcher.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 1 },
      locUpdate => {
        const newPt = {
          latitude:  locUpdate.coords.latitude,
          longitude: locUpdate.coords.longitude,
          speed:     locUpdate.coords.speed    || 0,
          heading:   locUpdate.coords.heading  || 0,
          altitude:  locUpdate.coords.altitude || 0,
          accuracy:  locUpdate.coords.accuracy || 0,
          timestamp: locUpdate.timestamp
        };
        coordsRef.current.push(newPt);
        setCoords([...coordsRef.current]);

        // recenter map
        setRegion(r => ({
          ...r,
          latitude:  newPt.latitude,
          longitude: newPt.longitude
        }));

        // compute deviation (nearest distance to officialRoute)
        if (officialRoute?.length) {
          const dist = Math.min(
            ...officialRoute.map(p => distanceMeters(newPt, p))
          );
          setDeviation(dist);

          // two-phase alert
          if (dist > thresh2 && !warned2Ref.current) {
            warned2Ref.current = true;
            Alert.alert(
              'Off Course',
              `You've strayed ${Math.round(dist)}m from the route!`
            );
          } else if (dist > thresh1 && !warned1Ref.current) {
            warned1Ref.current = true;
            Alert.alert(
              'Warning',
              `You're ${Math.round(dist)}m off the official route.`
            );
          }
        }

        // auto-stop when near endpoint
        if (endCoords && distanceMeters(newPt, endCoords) < 6) {
          stopTracking();
        }
      }
    );
  };

  // --- header Start/Stop button ---
  useLayoutEffect(() => {
    navigation.setOptions({
      title: trailName,
      headerRight: () => (
        <Button
          title={tracking ? 'Stop' : 'Start'}
          onPress={tracking ? stopTracking : startTracking}
          disabled={!selectedVid}
        />
      )
    });
  }, [navigation, tracking, selectedVid]);

  // --- render phases ---
  if (vehicles === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!tracking && vehicles.length === 0) {
    return (
      <View style={styles.center}>
        <Button
          title="Add a Vehicle"
          onPress={() => navigation.navigate('AddVehicle')}
        />
      </View>
    );
  }

  if (!tracking) {
    return (
      <View style={styles.container}>
        <Text style={styles.subheader}>Select Your Vehicle</Text>
        {vehicles.map(v => (
          <TouchableOpacity
            key={v.id}
            style={[
              styles.vehicleItem,
              v.id === selectedVid && styles.selectedVehicle
            ]}
            onPress={() => setVid(v.id)}
          >
            <Text>{`${v.make} ${v.model} (${v.year})`}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // compute dynamic live polyline color
  const liveStroke = deviation > thresh2
    ? warnColor2
    : deviation > thresh1
      ? warnColor1
      : liveColor;

  return (
    <MapView style={styles.map} region={region}>
      {/* official route in user’s chosen color */}
      {officialRoute?.length > 1 && (
        <Polyline
          coordinates={officialRoute}
          strokeWidth={4}
          strokeColor={officialColor}
        />
      )}
      {/* live route, dynamically colored */}
      {coords.length > 1 && (
        <Polyline
          coordinates={coords}
          strokeWidth={4}
          strokeColor={liveStroke}
        />
      )}
      {coords[0] && <Marker coordinate={coords[0]} title="Start" />}
      {coords.length > 0 && (
        <Marker coordinate={coords[coords.length - 1]} title="You" />
      )}
      {endCoords && <Circle center={endCoords} radius={6} />}
    </MapView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, padding: 16 },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map:             { flex: 1 },
  subheader:       { marginBottom: 8, fontWeight: '500' },
  vehicleItem:     {
    padding:     12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    marginBottom: 8
  },
  selectedVehicle:{
    borderColor: '#007AFF',
    backgroundColor: '#E6F0FF'
  }
});
