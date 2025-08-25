// Tracker.js
import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useContext,
} from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Button,
} from 'react-native';
import MapView, { Polyline, Marker, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

/** Haversine distance (meters) */
function distanceMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sdLat = Math.sin(dLat / 2);
  const sdLon = Math.sin(dLon / 2);
  const sq = sdLat * sdLat + sdLon * sdLon * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(sq));
}

/** Distance from point P to segment AB (meters) */
function pointToSegmentMeters(p, a, b) {
  // convert to planar approximate via lat/long degrees -> rough meters using local scale
  // For short segments, we can project in degrees with cosine latitude correction.
  const latMeters = 111320; // ~ meters per degree latitude
  const cosLat = Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
  const lonMeters = 111320 * cosLat;

  const ax = a.longitude * lonMeters;
  const ay = a.latitude * latMeters;
  const bx = b.longitude * lonMeters;
  const by = b.latitude * latMeters;
  const px = p.longitude * lonMeters;
  const py = p.latitude * latMeters;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const ab2 = abx * abx + aby * aby || 1e-9;
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * abx;
  const cy = ay + t * aby;

  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Min distance from point to polyline (meters) */
function minDistanceToPolylineMeters(p, polyline) {
  if (!Array.isArray(polyline) || polyline.length === 0) return Infinity;
  if (polyline.length === 1) return distanceMeters(p, polyline[0]);
  let min = Infinity;
  for (let i = 1; i < polyline.length; i++) {
    const d = pointToSegmentMeters(p, polyline[i - 1], polyline[i]);
    if (d < min) min = d;
  }
  return min;
}

export default function Tracker({ route, navigation }) {
  const {
    trailId,
    trailName,
    startCoords,
    endCoords,
    officialRoute = [],
  } = route.params;

  const { user, prefs } = useContext(UserContext);

  // vehicles
  const [vehicles, setVehicles] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // tracking state
  const [tracking, setTracking] = useState(false);
  const [strokeColor, setStrokeColor] = useState(
    prefs?.liveRouteColor || '#1976D2'
  );

  // coords
  const coordsRef = useRef(startCoords ? [startCoords] : []);
  const [coords, setCoords] = useState(coordsRef.current);

  // map
  const [region, setRegion] = useState(
    startCoords
      ? {
          ...startCoords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : null
  );
  const mapRef = useRef(null);

  // timing + watcher
  const startTimeRef = useRef(null);
  const watchRef = useRef(null);
  const abortedRef = useRef(false);

  // thresholds (meters) + colors from prefs with safe defaults
  const warnDist = (prefs?.warnDistanceFt ?? 50) * 0.3048;   // 50 ft
  const alertDist = (prefs?.alertDistanceFt ?? 75) * 0.3048; // 75 ft
  const failDist = (prefs?.offRouteFailFt ?? 100) * 0.3048;  // 100 ft

  const liveColor = prefs?.liveRouteColor || '#1976D2';
  const warnColor = prefs?.warnColor || '#FFA000';
  const alertColor = prefs?.alertColor || '#D32F2F';
  const officialColor = prefs?.officialRouteColor || '#000000';

  // Load vehicles for this user on focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (!user) {
        setVehicles([]);
        setSelectedVehicleId(null);
        return;
      }
      axios
        .get(`${API_BASE}/api/vehicles?userId=${user.id}`)
        .then((r) => {
          setVehicles(r.data);
          if (r.data.length === 1) setSelectedVehicleId(r.data[0].id);
        })
        .catch((e) => {
          console.error('Vehicle load failed', e);
          Alert.alert('Error', 'Could not load your vehicles.');
        });
    });
    return unsub;
  }, [navigation, user]);

  // header
  useLayoutEffect(() => {
    navigation.setOptions({
      title: trailName || 'Tracker',
      headerRight: () => (
        <Button
          title={tracking ? 'Stop' : 'Start'}
          onPress={tracking ? stopTracking : startTracking}
          disabled={!selectedVehicleId || !user}
        />
      ),
    });
  }, [navigation, tracking, selectedVehicleId, user]);

  // Ensure we have an initial region even if startCoords missing
  useEffect(() => {
    let done = false;
    (async () => {
      if (region) return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!done) {
          const seed = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          if (coordsRef.current.length === 0) {
            coordsRef.current = [seed];
            setCoords([...coordsRef.current]);
          }
          setRegion({
            ...seed,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      } catch (e) {
        console.error('Initial region failed', e);
      }
    })();
    return () => {
      done = true;
    };
  }, [region]);

  // ——————— Start Tracking ———————
  const startTracking = async () => {
    if (!user) return Alert.alert('Profile', 'Please select a user first.');
    if (!selectedVehicleId)
      return Alert.alert('Vehicle', 'Please select a vehicle.');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Permission needed', 'Allow location to track.');
      }

      // seed initial point from GPS (full object)
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const seed = {
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
        speed: initial.coords.speed ?? 0,
        heading: initial.coords.heading ?? 0,
        altitude: initial.coords.altitude ?? 0,
        accuracy: initial.coords.accuracy ?? 0,
        timestamp: Date.now(),
      };
      coordsRef.current = [seed];
      setCoords([...coordsRef.current]);

      // center map
      setRegion((r) => ({
        latitude: seed.latitude,
        longitude: seed.longitude,
        latitudeDelta: r?.latitudeDelta ?? 0.01,
        longitudeDelta: r?.longitudeDelta ?? 0.01,
      }));

      setStrokeColor(liveColor);
      abortedRef.current = false;
      startTimeRef.current = Date.now();
      setTracking(true);

      // subscribe
      try {
        watchRef.current?.remove?.();
      } catch {}
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 1,
          timeInterval: 1000,
        },
        (loc) => {
          // append point (deep copy to avoid "cannot add property" issues)
          const pt = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            speed: loc.coords.speed ?? 0,
            heading: loc.coords.heading ?? 0,
            altitude: loc.coords.altitude ?? 0,
            accuracy: loc.coords.accuracy ?? 0,
            timestamp: Date.now(),
          };
          coordsRef.current.push(pt);
          setCoords([...coordsRef.current]);

          // animate map
          mapRef.current?.animateToRegion({
            latitude: pt.latitude,
            longitude: pt.longitude,
            latitudeDelta: region?.latitudeDelta ?? 0.01,
            longitudeDelta: region?.longitudeDelta ?? 0.01,
          });

          // deviation logic (only if officialRoute provided)
          if (officialRoute && officialRoute.length >= 2) {
            const d = minDistanceToPolylineMeters(pt, officialRoute);
            if (d > failDist && !abortedRef.current) {
              abortedRef.current = true;
              setStrokeColor(alertColor);
              Alert.alert(
                'Off course',
                'You have strayed more than the allowed distance. This run is invalid.'
              );
              // stop without upload
              safeStopWatcher();
              setTracking(false);
              return;
            } else if (d > alertDist) {
              setStrokeColor(alertColor);
            } else if (d > warnDist) {
              setStrokeColor(warnColor);
            } else {
              setStrokeColor(liveColor);
            }
          }

          // auto-stop if near end
          if (endCoords) {
            const endRadius = (prefs?.arriveRadiusMeters ?? 6); // ~20ft
            const toEnd = distanceMeters(pt, endCoords);
            if (toEnd <= endRadius) {
              stopTracking(); // will upload
            }
          }
        }
      );
    } catch (err) {
      console.error('startTracking error', err);
      Alert.alert('Error', err.message || 'Could not start tracking');
    }
  };

  // ——————— Stop Tracking ———————
  const safeStopWatcher = () => {
    try {
      watchRef.current?.remove?.();
    } catch {}
    watchRef.current = null;
  };

  const stopTracking = async () => {
    safeStopWatcher();
    setTracking(false);

    if (abortedRef.current) {
      // already shown an alert; do not upload, just reset
      coordsRef.current = [];
      setCoords([]);
      setStrokeColor(liveColor);
      return;
    }

    const runCoords = coordsRef.current;
    if (!runCoords.length) {
      Alert.alert('No data', 'No GPS points were recorded.');
      return;
    }

    const duration = (Date.now() - (startTimeRef.current || Date.now())) / 1000;
    const avgSpeed =
      runCoords.reduce((sum, p) => sum + (p.speed || 0), 0) / runCoords.length || 0;

    try {
      const payload = {
        trailId,
        coords: runCoords,
        duration,
        avgSpeed,
        vehicleId: selectedVehicleId,
        userId: user.id,
        groupId: null,
      };
      const res = await axios.post(`${API_BASE}/api/routes`, payload);

      // navigate to RunDetail (replace)
      navigation.replace('RunDetail', {
        run: res.data,
        trailName: trailName || 'Trail',
      });
    } catch (err) {
      console.error('Upload failed', err);
      Alert.alert(
        'Upload failed',
        err.response?.data?.error || err.message || 'Unknown error'
      );
    } finally {
      // reset buffer for next time
      coordsRef.current = [];
      setCoords([]);
      setStrokeColor(liveColor);
    }
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      safeStopWatcher();
    };
  }, []);

  // ——————— UI ———————
  // vehicles loading
  if (vehicles === null || !region) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        {!user && <Text style={styles.dim}>Select a profile first…</Text>}
      </View>
    );
  }

  // no vehicles for this user
  if (!tracking && vehicles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>You have no vehicles yet.</Text>
        <Button
          title="Add a Vehicle"
          onPress={() => navigation.navigate('VehicleList')}
        />
      </View>
    );
  }

  // vehicle picker before tracking (only if user has multiple)
  if (!tracking && vehicles.length > 1 && !selectedVehicleId) {
    return (
      <View style={styles.container}>
        <Text style={styles.subheader}>Select Your Vehicle</Text>
        {vehicles.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[
              styles.vehicleItem,
              v.id === selectedVehicleId && styles.selectedVehicle,
            ]}
            onPress={() => setSelectedVehicleId(v.id)}
          >
            <Text>{`${v.make} ${v.model} (${v.year})`}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ padding: 12 }}>
          <Button
            title="Start"
            onPress={startTracking}
            disabled={!selectedVehicleId}
          />
        </View>
      </View>
    );
  }

  // main map (tracking OR user has exactly one vehicle already selected)
  return (
    <MapView ref={mapRef} style={styles.map} initialRegion={region}>
      {/* OSM base tiles for visible background */}
      <UrlTile
        urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maximumZ={19}
        shouldReplaceMapContent
      />

      {/* official route always visible if passed in */}
      {officialRoute && officialRoute.length > 1 && (
        <Polyline
          coordinates={officialRoute.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
          }))}
          strokeWidth={4}
          strokeColor={officialColor}
        />
      )}

      {/* live route */}
      {coords.length > 0 && (
        <>
          <Polyline coordinates={coords} strokeWidth={5} strokeColor={strokeColor} />
          <Marker coordinate={coords[0]} title="Start" />
          <Marker coordinate={coords[coords.length - 1]} title="Current" />
        </>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  subheader: { marginBottom: 8, fontWeight: '600' },
  vehicleItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    marginBottom: 8,
  },
  selectedVehicle: {
    borderColor: '#007AFF',
    backgroundColor: '#E6F0FF',
  },
  dim: { color: '#666', marginTop: 8, textAlign: 'center' },
});
