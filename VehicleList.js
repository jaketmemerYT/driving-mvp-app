// VehicleList.js
import React, { useEffect, useState, useLayoutEffect, useContext, useCallback, memo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import axios from 'axios';

import { API_BASE } from './config';
import { UserContext } from './UserContext';
import ActiveUserPill from './ActiveUserPill';

const VehicleRow = memo(function VehicleRow({ item, onAddPhoto, onDelete }) {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {item.make} {item.model} {item.year ? `(${item.year})` : ''}
          </Text>
          {item.plate ? <Text style={styles.dim}>Plate: {item.plate}</Text> : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.linkBtn} onPress={() => onAddPhoto(item)}>
            <Text style={styles.linkBtnTxt}>{item.photoUrl ? 'Change Photo' : 'Add Photo'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.linkBtn, styles.dangerBtn]} onPress={() => onDelete(item)}>
            <Text style={[styles.linkBtnTxt, styles.dangerTxt]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.placeholderTxt}>No photo yet</Text>
        </View>
      )}

      <Text style={styles.tip}>
        Tip: For consistency, shoot from the <Text style={{ fontWeight: '700' }}>left rear quarter-panel</Text> angle.
      </Text>
    </View>
  );
});

export default function VehicleList({ navigation }) {
  const { user } = useContext(UserContext);
  const [vehicles, setVehicles] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Header: add "New" button
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'My Vehicles',
      headerRight: () => (
        <Text style={styles.newBtn} onPress={() => navigation.navigate('AddVehicle')}>
          New
        </Text>
      ),
    });
  }, [navigation]);

  const fetchVehicles = useCallback(async () => {
    try {
      if (!user?.id) {
        setVehicles([]);
        return;
      }
      const res = await axios.get(`${API_BASE}/api/vehicles?userId=${user.id}`);
      setVehicles(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setVehicles([]);
    }
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    (async () => { await fetchVehicles(); })();
    return () => { active = false; };
  }, [fetchVehicles]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVehicles();
    setRefreshing(false);
  }, [fetchVehicles]);

  // Image picking + upload (low-res)
  const pickFrom = async (source) => {
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Camera permission', 'Camera access is required to take a photo.');
          return null;
        }
        const res = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        });
        return res.canceled ? null : res.assets?.[0];
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Photos permission', 'Library access is required to choose a photo.');
          return null;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        });
        return res.canceled ? null : res.assets?.[0];
      }
    } catch (e) {
      console.error('pickFrom error', e);
      Alert.alert('Error', 'Could not open camera or library.');
      return null;
    }
  };

  const addOrChangePhoto = useCallback(
    async (vehicle) => {
      if (!vehicle?.id) return;

      Alert.alert(
        'Vehicle Photo',
        'Choose a source',
        [
          { text: 'Camera', onPress: async () => handlePick('camera') },
          { text: 'Library', onPress: async () => handlePick('library') },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );

      async function handlePick(kind) {
        const picked = await pickFrom(kind);
        if (!picked?.uri) return;

        try {
          // Resize/compress to low-res thumbnail (e.g., width ~640)
          const manip = await ImageManipulator.manipulateAsync(
            picked.uri,
            [{ resize: { width: 640 } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
          );

          const fd = new FormData();
          fd.append('file', {
            uri: manip.uri,
            name: `vehicle_${vehicle.id}.jpg`,
            type: 'image/jpeg',
          });

          const resp = await axios.post(`${API_BASE}/api/vehicles/${vehicle.id}/photo`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          const updated = resp.data;
          if (updated?.id) {
            setVehicles((prev) => (prev || []).map((v) => (v.id === updated.id ? { ...v, ...updated } : v)));
          } else {
            setVehicles((prev) => (prev || []).map((v) => (v.id === vehicle.id ? { ...v, photoUrl: manip.uri } : v)));
          }
        } catch (e) {
          console.error('upload error', e);
          Alert.alert('Upload failed', e.response?.data?.error || e.message || 'Could not upload photo.');
        }
      }
    },
    []
  );

  const deleteVehicle = useCallback(
    async (vehicle) => {
      if (!user?.id) return;
      Alert.alert(
        'Delete Vehicle',
        `Remove ${vehicle.make} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await axios.delete(`${API_BASE}/api/vehicles/${vehicle.id}`, {
                  params: { userId: user.id },
                });
                // Optimistic UI: remove from list (server also deletes the photo file)
                setVehicles((prev) => (prev || []).filter((v) => v.id !== vehicle.id));
              } catch (e) {
                console.error('delete error', e);
                Alert.alert('Error', e.response?.data?.error || e.message || 'Could not delete vehicle.');
              }
            },
          },
        ],
        { cancelable: true }
      );
    },
    [user?.id]
  );

  if (!user) {
    return (
      <View style={styles.center}>
        <Text>Select a profile first in Profile.</Text>
      </View>
    );
  }

  if (!vehicles) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActiveUserPill />

      {vehicles.length === 0 ? (
        <View style={styles.centerPad}>
          <Text style={styles.dim}>No vehicles yet.</Text>
          <Text style={styles.link} onPress={() => navigation.navigate('AddVehicle')}>
            Add one
          </Text>
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(v) => v.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <VehicleRow item={item} onAddPhoto={addOrChangePhoto} onDelete={deleteVehicle} />
          )}
          contentContainerStyle={{ paddingBottom: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  newBtn: { color: '#007AFF', fontWeight: '600', padding: 8 },
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerPad: { alignItems: 'center', padding: 16 },

  card: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#EEE',
    gap: 8,
  },
  title: { fontWeight: '700', color: '#111' },
  dim: { color: '#64748B' },

  linkBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  linkBtnTxt: { color: '#111', fontWeight: '600' },
  dangerBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' },
  dangerTxt: { color: '#B91C1C' },

  photo: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  placeholderTxt: { color: '#94A3B8' },

  tip: { color: '#6B7280', fontSize: 12 },

  link: { color: '#007AFF', marginTop: 8, fontWeight: '600' },
});
