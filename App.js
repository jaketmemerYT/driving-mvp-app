// App.js
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import axios from 'axios';

const Stack = createNativeStackNavigator();
// From running 'ipconfig' in terminal to determine our Wi-Fi IP
const API_BASE = 'http://192.168.254.40:3000';

function TrailList({ navigation }) {
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/trailheads`)
      .then(r => setTrails(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={trails}
      keyExtractor={i => i.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={{padding:16,borderBottomWidth:1,borderColor:'#eee'}}
          onPress={() => navigation.navigate('Tracker', { trailId: item.id, name: item.name })}
        >
          <Text style={{fontSize:18}}>{item.name}</Text>
          <Text style={{color:'#666'}}>{item.difficulty}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

function Tracker({ route }) {
  const { trailId, name } = route.params;
  return (
    <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
      <Text style={{fontSize:20}}>Tracker Screen</Text>
      <Text>Trail: {name} ({trailId})</Text>
      {/* Next: hook up Expo Location here */}
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Trails">
        <Stack.Screen name="Trails" component={TrailList} />
        <Stack.Screen name="Tracker" component={Tracker} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
