// RunDetail.js
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import axios from 'axios';
import MapBase from './MapBase';
import { API_BASE } from './config';
import { useRouteColors } from './useRouteColors';
import { buildDeviationSegments } from './geoUtils';

export default function RunDetail({ route, navigation }) {
  const { liveColor, warn1Color, warn2Color, warningThreshold1, warningThreshold2, officialColor } = useRouteColors();
  const { run, trailName } = route.params || {};

  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: trailName || 'Run Detail' });
  }, [navigation, trailName]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!run?.trailId) {
          setTrail(null);
          return;
        }
        setLoading(true);
        const res = await axios.get(`${API_BASE}/api/trailheads/${run.trailId}`);
        if (!active) return;
        setTrail(res.data);
      } catch (e) {
        console.error('RunDetail trail fetch error:', e?.message || e);
        if (active) setTrail(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [run?.trailId]);

  const officialRoute = useMemo(
    () => (trail?.route && Array.isArray(trail.route) ? trail.route : []),
    [trail?.route]
  );
  const startCoords = trail?.coords || (run?.coords && run.coords[0]) || null;
  const endCoords   = trail?.endCoords || (run?.coords && run.coords[run.coords.length - 1]) || null;

  const coloredSegments = useMemo(() => {
    const runPts = Array.isArray(run?.coords) ? run.coords : [];
    return buildDeviationSegments(runPts, officialRoute, {
      liveRouteColor: liveColor,
      warningColor1: warn1Color,
      warningColor2: warn2Color,
      warningThreshold1,
      warningThreshold2,
    });
  }, [run?.coords, officialRoute, liveColor, warn1Color, warn2Color, warningThreshold1, warningThreshold2]);

  const allFitCoords = useMemo(() => {
    const arr = [];
    (officialRoute || []).forEach(p => arr.push({ latitude: p.latitude, longitude: p.longitude }));
    (run?.coords || []).forEach(p => arr.push({ latitude: p.latitude, longitude: p.longitude }));
    return arr;
  }, [officialRoute, run?.coords]);

  const onMapLayout = useCallback(() => {
    if (!mapRef.current || allFitCoords.length < 2) return;
    mapRef.current.fitToCoordinates(allFitCoords, {
      edgePadding: { top: 24, right: 24, bottom: 24, left: 24 },
      animated: false,
    });
  }, [allFitCoords]);

  if (loading || !run) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const initialRegion = startCoords
    ? { latitude: startCoords.latitude, longitude: startCoords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : run?.coords?.[0]
    ? { latitude: run.coords[0].latitude, longitude: run.coords[0].longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.2, longitudeDelta: 0.2 };

  return (
    <View style={styles.container}>
      <MapBase ref={mapRef} style={styles.map} initialRegion={initialRegion} onLayout={onMapLayout}>
        {startCoords && <Marker coordinate={{ latitude: startCoords.latitude, longitude: startCoords.longitude }} title="Start" />}
        {endCoords &&   <Marker coordinate={{ latitude: endCoords.latitude,   longitude: endCoords.longitude }} title="End"   pinColor="green" />}

        {officialRoute.length > 1 && (
          <Polyline
            coordinates={officialRoute.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
            strokeWidth={4}
            strokeColor={officialColor}
          />
        )}

        {coloredSegments.length === 0 && Array.isArray(run?.coords) && run.coords.length > 1 ? (
          <Polyline
            coordinates={run.coords.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
            strokeWidth={4}
            strokeColor={liveColor}
          />
        ) : (
          coloredSegments.map((seg, idx) => (
            <Polyline key={`seg-${idx}-${seg.color}`} coordinates={seg.coordinates} strokeWidth={4} strokeColor={seg.color} />
          ))
        )}
      </MapBase>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
