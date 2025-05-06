import React from 'react';
import { Button } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TrailList from './TrailList';
import Tracker from './Tracker';
import Leaderboard from './Leaderboard';
import VehicleList from './VehicleList';
import AddVehicle from './AddVehicle';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Trails">
        <Stack.Screen
          name="Trails"
          component={TrailList}
          options={({ navigation }) => ({
            headerRight: () => (
              <Button
                title="Vehicles"
                onPress={() => navigation.navigate('Vehicles')}
              />
            ),
          })}
        />
        <Stack.Screen
          name="Tracker"
          component={Tracker}
          options={{ title: 'Tracker' }}
        />
        <Stack.Screen name="Leaderboard" component={Leaderboard} />
        <Stack.Screen
          name="Vehicles"
          component={VehicleList}
          options={({ navigation }) => ({
            title: 'Vehicles',
            headerRight: () => (
              <Button
                title="Add"
                onPress={() => navigation.navigate('AddVehicle')}
              />
            ),
          })}
        />
        <Stack.Screen
          name="AddVehicle"
          component={AddVehicle}
          options={{ title: 'New Vehicle' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}