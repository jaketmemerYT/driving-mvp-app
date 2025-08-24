// TrailDetail.js
import React, {
    useState,
    useEffect,
    useLayoutEffect,
    useRef
  } from 'react';
  import {
    View,
    Alert,
    Button,
    ActivityIndicator,
    StyleSheet
  } from 'react-native';
  import MapView, { Marker, Polyline } from 'react-native-maps';
  import * as Location from 'expo-location';
  import axios from 'axios';
  import { API_BASE } from './config';
  
  export default function TrailDetail({ route, navigation }) {
    const { trailId, trailName } = route.params;
    const [trail,   setTrail]   = useState(null);
    const [loading, setLoading] = useState(true);
    const [arrived, setArrived] = useState(false);
    const watchRef = useRef(null);
  
    // 1) header title
    useLayoutEffect(() => {
      navigation.setOptions({ title: trailName });
    }, [navigation, trailName]);
  
    // 2) fetch trail
    useEffect(() => {
      let active = true;
      setLoading(true);
  
      axios.get(`${API_BASE}/api/trailheads/${trailId}`)
        .then(res => { if (active) setTrail(res.data); })
        .catch(console.error)
        .finally(() => { if (active) setLoading(false); });
  
      return () => {
        active = false;
        watchRef.current?.remove();
      };
    }, [trailId]);
  
    // 3) arrival watcher
    useEffect(() => {
      if (!trail?.coords) return;
      let mounted = true;
  
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !mounted) return;
  
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 1 },
          loc => {
            if (!mounted) return;
            const d = distanceMeters(loc.coords, trail.coords);
            if (d <= 6) {
              watchRef.current.remove();
              setArrived(true);
              Alert.alert('Arrived!', 'You have reached the trailhead.');
            }
          }
        );
      })();
  
      return () => {
        mounted = false;
        watchRef.current?.remove();
      };
    }, [trail?.coords]);
  
    // 4) loading state
    if (loading || !trail?.coords) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      );
    }
  
    // pull out what we need
    const {
      coords: startCoords,
      endCoords,
      route:  officialRoute
    } = trail;
  
    return (
      <View style={styles.container}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude:       startCoords.latitude,
            longitude:      startCoords.longitude,
            latitudeDelta:  0.01,
            longitudeDelta: 0.01
          }}
        >
          <Marker coordinate={startCoords} title={trail.name} />
          {endCoords && (
            <Marker
              coordinate={endCoords}
              title="Trail End"
              pinColor="green"
            />
          )}
          {officialRoute?.length > 1 && (
            <Polyline
              coordinates={officialRoute}
              strokeWidth={4}
              strokeColor="black"
            />
          )}
        </MapView>
  
        <View style={styles.footer}>
          {!arrived ? (
            <Button
              title="Navigate to Trailhead"
              onPress={() => {
                /* deep-link to Maps or your own nav here */
              }}
            />
          ) : (
            <Button
              title="Start Run"
              onPress={() =>
                navigation.navigate('Tracker', {
                  trailId,
                  trailName,
                  startCoords,
                  endCoords,
                  officialRoute
                })
              }
            />
          )}
        </View>
      </View>
    );
  }
  
  // inline Haversine distance in meters
  function distanceMeters(a, b) {
    const toRad = deg => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
  
    const sinDlat = Math.sin(dLat / 2);
    const sinDlon = Math.sin(dLon / 2);
    const sq = sinDlat * sinDlat +
               sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
  
    return 2 * R * Math.asin(Math.sqrt(sq));
  }
  
  const styles = StyleSheet.create({
    container: { flex: 1 },
    map:       { flex: 1 },
    center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
    footer:    { padding: 16 }
  });
  