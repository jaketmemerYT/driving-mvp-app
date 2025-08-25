// TrailList.js
import React, { useEffect, useState, useContext, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Button,
  Platform,
} from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

import MapBase from './MapBase';
import { API_BASE } from './config';
import { UserContext } from './UserContext';
import { useFitToGeometry } from './hooks/useFitToGeometry';

export default function TrailList({ navigation }) {
  const { prefs } = useContext(UserContext);

  const [trails, setTrails] = useState(null);
  const [categories, setCategories] = useState([]);
  const [trailCatsMap, setTrailCatsMap] = useState({});
  const [filterCatIds, setFilterCatIds] = useState([]);

  const officialColor = prefs?.officialRouteColor || '#000000';

  // Load data on focus so lists refresh after adds
  useFocusEffect(
    useCallback(() => {
      let canceled = false;
      const load = async () => {
        try {
          const [tRes, cRes] = await Promise.all([
            axios.get(`${API_BASE}/api/trailheads`),
            axios.get(`${API_BASE}/api/categories`),
          ]);
          if (canceled) return;

          setTrails(tRes.data);
          setCategories(cRes.data || []);

          // Build a map of trailId -> [categoryIds]
          const tcMap = {};
          await Promise.all(
            (tRes.data || []).map(async (t) => {
              try {
                const resp = await axios.get(`${API_BASE}/api/trailheads/${t.id}/categories`);
                tcMap[t.id] = (resp.data || []).map((c) => c.id);
              } catch {
                tcMap[t.id] = [];
              }
            })
          );
          if (!canceled) setTrailCatsMap(tcMap);
        } catch (e) {
          console.error(e);
        }
      };
      load();
      return () => { canceled = true; };
    }, [])
  );

  if (!trails) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const visibleTrails = trails.filter((t) => {
    if (filterCatIds.length === 0) return true;
    const cats = trailCatsMap[t.id] || [];
    return cats.some((cid) => filterCatIds.includes(cid));
  });

  return (
    <View style={styles.container}>
      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContainer}
      >
        {categories.map((cat) => {
          const sel = filterCatIds.includes(cat.id);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, sel && styles.chipSelected]}
              onPress={() =>
                setFilterCatIds(sel ? filterCatIds.filter((x) => x !== cat.id) : [...filterCatIds, cat.id])
              }
            >
              <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{cat.name}</Text>
            </TouchableOpacity>
          );
        })}
        {categories.length > 0 && (
          <Button title="Clear" onPress={() => setFilterCatIds([])} />
        )}
      </ScrollView>

      {visibleTrails.length === 0 ? (
        <Text style={styles.empty}>No trails match the current filters.</Text>
      ) : (
        <FlatList
          data={visibleTrails}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const start = item.coords || null;
            const end = item.endCoords || null;
            const route = Array.isArray(item.route) ? item.route : [];

            // Provide a stable initialRegion so the map has something to show before first fit
            const previewRegion =
              start
                ? {
                    latitude: start.latitude,
                    longitude: start.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }
                : route.length > 0
                ? {
                    latitude: route[0].latitude,
                    longitude: route[0].longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }
                : {
                    latitude: 0,
                    longitude: 0,
                    latitudeDelta: 60,
                    longitudeDelta: 60,
                  };

            const catIds = trailCatsMap[item.id] || [];

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  navigation.navigate('TrailDetail', {
                    trailId: item.id,
                    trailName: item.name,
                  })
                }
                activeOpacity={0.85}
              >
                <Text style={styles.title}>{item.name}</Text>
                <Text style={styles.dim}>Difficulty: {item.difficulty || 'Unknown'}</Text>

                {/* Category badges */}
                <View style={styles.badgesRow}>
                  {catIds.map((cid) => {
                    const cat = categories.find((c) => c.id === cid);
                    return cat ? (
                      <View key={cid} style={styles.badge}>
                        <Text style={styles.badgeText}>{cat.name}</Text>
                      </View>
                    ) : null;
                  })}
                </View>

                {/* Scaled map preview (with Android-lite + half padding) */}
                <TrailCardMap
                  previewRegion={previewRegion}
                  start={start}
                  end={end}
                  route={route}
                  officialColor={officialColor}
                />

                <Text style={styles.dimSmall}>
                  {route.length} points • {new Date().toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const TrailCardMap = memo(function TrailCardMap({ previewRegion, start, end, route, officialColor }) {
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Auto-fit thumbnails with HALF padding = 12
  useFitToGeometry({
    mapRef,
    route,
    start,
    end,
    padding: 12,
    animated: false,
    minSpan: 0.0005,
    debounceMs: 0,
    enabled: mapReady,
  });

  return (
    <View style={styles.previewWrap}>
      <MapBase
        ref={mapRef}
        initialRegion={previewRegion}
        tilesEnabled={false}
        cacheEnabled
        liteMode={Platform.OS === 'android'}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapReady={() => setMapReady(true)}
        pointerEvents="none"
        style={styles.previewMap}
      >
        {start && <Marker coordinate={start} title="Trailhead" />}
        {end && <Marker coordinate={end} title="End" pinColor="green" />}
        {route.length > 1 && (
          <Polyline
            coordinates={route.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
            strokeWidth={3}
            strokeColor={officialColor}
          />
        )}
      </MapBase>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  chipScroll: { maxHeight: 44, marginVertical: 6 },
  chipContainer: { paddingHorizontal: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#EEE',
    marginHorizontal: 4,
  },
  chipSelected: { backgroundColor: '#007AFF' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#FFF' },

  card: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
  },
  title: { fontSize: 16, fontWeight: '600' },
  dim: { color: '#666', marginTop: 2 },
  dimSmall: { color: '#888', marginTop: 6, fontSize: 12 },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  badge: {
    backgroundColor: '#DDD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  badgeText: { fontSize: 12, color: '#333' },

  previewWrap: { height: 130, marginTop: 8, borderRadius: 10 },
  previewMap: { ...StyleSheet.absoluteFillObject, borderRadius: 10, overflow: 'hidden' },
});
