// VehicleList.js
import React, {
  useState,
  useContext,
  useLayoutEffect,
} from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Button,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function VehicleList({ navigation }) {
  const { user } = useContext(UserContext);
  const [vehicles, setVehicles] = useState(null);

  // Header button
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'My Vehicles',
      headerRight: () => (
        <Button title="New" onPress={() => navigation.navigate('AddVehicle')} />
      ),
    });
  }, [navigation]);

  // Reload vehicles whenever this screen is focused or user changes
  useFocusEffect(
    React.useCallback(() => {
      if (!user) {
        setVehicles([]);
        return;
      }
      setVehicles(null);
      axios
        .get(`${API_BASE}/api/vehicles?userId=${user.id}`)
        .then(res => setVehicles(res.data))
        .catch(err => {
          console.error(err);
          Alert.alert('Error', 'Could not fetch vehicles');
          setVehicles([]);
        });
    }, [user])
  );

  const deleteVehicle = id => {
    Alert.alert(
      'Delete Vehicle?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            axios
              .delete(`${API_BASE}/api/vehicles/${id}?userId=${user.id}`)
              .then(() => setVehicles(vs => vs.filter(v => v.id !== id)))
              .catch(err => {
                console.error(err);
                Alert.alert(
                  'Delete failed',
                  err.response?.data?.error || err.message
                );
              });
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Please select or create a user in Profile.
        </Text>
      </View>
    );
  }

  if (vehicles === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>No vehicles yet.</Text>
        <Button title="Add one" onPress={() => navigation.navigate('AddVehicle')} />
      </View>
    );
  }

  return (
    <FlatList
      data={vehicles}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <TouchableOpacity style={styles.item}>
            <Text style={styles.text}>
              {item.make} {item.model} ({item.year})
            </Text>
          </TouchableOpacity>
          <Button
            title="Delete"
            color="#d11a2a"
            onPress={() => deleteVehicle(item.id)}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    marginBottom: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  list: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#EEE',
  },
  item: {
    flex: 1,
  },
  text: {
    fontSize: 16,
  },
});
