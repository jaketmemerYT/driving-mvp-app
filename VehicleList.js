// VehicleList.js
import React, {
  useState,
  useEffect,
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
import axios from 'axios';
import { API_BASE } from './config';
import { UserContext } from './UserContext';

export default function VehicleList({ navigation }) {
  const { user } = useContext(UserContext);
  const [vehicles, setVehicles] = useState(null);

  // Configure header: title + “New” button
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'My Vehicles',
      headerRight: () => (
        <Button
          title="New"
          onPress={() => navigation.navigate('AddVehicle')}
        />
      ),
    });
  }, [navigation]);

  // Fetch only this user’s vehicles whenever user changes
  useEffect(() => {
    if (!user) {
      setVehicles([]);  // no user → treat as empty
      return;
    }
    setVehicles(null); // trigger loading state
    axios
      .get(`${API_BASE}/api/vehicles?userId=${user.id}`)
      .then(res => setVehicles(res.data))
      .catch(err => {
        console.error(err);
        Alert.alert('Error', 'Could not fetch vehicles');
        setVehicles([]);
      });
  }, [user]);

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
              .then(() => {
                setVehicles(vs => vs.filter(v => v.id !== id));
              })
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

  // No user selected
  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Please select or create a user in the Profile tab.
        </Text>
      </View>
    );
  }

  // Still loading
  if (vehicles === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // No vehicles yet
  if (vehicles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>No vehicles yet.</Text>
        <Button
          title="Add one"
          onPress={() => navigation.navigate('AddVehicle')}
        />
      </View>
    );
  }

  // Render list
  return (
    <FlatList
      data={vehicles}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              /* could mark default vehicle here */
            }}
          >
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
