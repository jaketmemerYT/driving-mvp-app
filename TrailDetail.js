// TrailDetail.js
import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useContext,
} from 'react';
import {
  View,
  Alert,
  Button,
  ActivityIndicator,
  StyleSheet,
  Text,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function TrailDetail({ route, navigation }) {
  const { trailId, trailName: headerName } = route.params;
  const { prefs } = useContext(UserContext);

  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(true);

  // arrival state
  const [arrived, setArrived] = useState(false);
  const arrivedOnceRef = useRef(false); // ensures the alert only fires once per visit
  const watchRef = useRef(null);

  // header title
  useLayoutEffect(() => {
    navigation.setOptions({ title: headerName || 'Trail' });
  }, [navigation, headerName]);

  // fetch the single trail by id
  useEffect(() => {
    let active = true;
    setLoading(true);

    axios
      .get(`${API_BASE}/api/trailheads/${trailId}`)
      .then((res) => {
        if (!active) return;
        setTrail(res.data || null);
      })
      .catch((err) => {
        console.error('Trail fetch failed', err);
        if (active) Alert.alert('Error', 'Could not load trail.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [trailId]);

  // arrival watcher (subscribe once we know trailhead coords)
  useEffect(() => {
    if (!trail?.coords) return;

    let mounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !mounted) return;

        // clear any previous watcher
        try {
          watchRef.current?.remove?.();
        } catch {}
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 1000 },
          (loc) => {
            if (!mounted || arrivedOnceRef.current) return;
            const d = distanceMeters(loc.coords, trail.coords);
            const arrivedRadius = prefs?.arriveRadiusMeters ?? 6; // ~20 ft
            if (d <= arrivedRadius) {
              // mark arrived exactly once
              arrivedOnceRef.current = true;
              setArrived(true);
              try {
                watchRef.current?.remove?.();
              } catch {}
              watchRef.current = null;
              Alert.alert('Arrived!', 'You have reached the trailhead.');
            }
          }
        );
      } catch (err) {
        console.error('Arrival watcher error', err);
      }
    })();

    return () => {
      mounted = false;
      try {
        watchRef.current?.remove?.();
      } catch {}
      watchRef.current = null;
    };
  }, [trail?.coords, prefs?.arriveRadiusMeters]);

  // loading guard
  if (loading || !trail?.coords) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.dim}>Loading trail…</Text>
      </View>
    );
  }

  const startCoords = trail.coords;
  const endCoords = trail.endCoords || null;
  const officialRoute = Array.isArray(trail.route) ? trail.route : [];

  // colors from preferences (with safe fallbacks)
  const officialColor = prefs?.officialRouteColor || '#000000';

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: startCoords.latitude,
          longitude: startCoords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* OSM raster tiles so background imagery shows without Google billing */}
        <UrlTile
          urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          shouldReplaceMapContent
        />

        <Marker coordinate={startCoords} title={trail.name || 'Trailhead'} />
        {endCoords && <Marker coordinate={endCoords} title="Trail End" pinColor="green" />}

        {officialRoute.length > 1 && (
          <Polyline
            coordinates={officialRoute.map((p) => ({
              latitude: p.latitude,
              longitude: p.longitude,
            }))}
            strokeWidth={4}
            strokeColor={officialColor}
          />
        )}
      </MapView>

      <View style={styles.footer}>
        {!arrived ? (
          <Button
            title="Navigate to Trailhead"
            onPress={() => {
              // Optional: deep link to external navigation app here.
              Alert.alert(
                'Navigation',
                'Open your favorite navigation app to head to the trailhead.'
              );
            }}
          />
        ) : (
          <Button
            title="Start Run"
            onPress={() =>
              navigation.navigate('Tracker', {
                trailId,
                trailName: trail.name || headerName || 'Trail',
                startCoords,
                endCoords,
                officialRoute, // give Tracker the official polyline for deviation checks
              })
            }
          />
        )}
      </View>
    </View>
  );
}

/** Haversine distance in meters (inline, no deps) */
function distanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const sq =
    sinDlat * sinDlat + sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(sq));
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  footer: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dim: { marginTop: 8, color: '#666' },
});
