// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';

import TrailList from './TrailList';
import Tracker from './Tracker';
import Leaderboard from './Leaderboard';
import RunDetail from './RunDetail';
import VehicleList from './VehicleList';
import AddVehicle from './AddVehicle';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Stack for route-related screens
function RoutesStack() {
  return (
    <Stack.Navigator initialRouteName="Trails">
      <Stack.Screen
        name="Trails"
        component={TrailList}
        options={{ title: 'Trails' }}
      />
      <Stack.Screen
        name="Tracker"
        component={Tracker}
        options={{ title: 'Tracker' }}
      />
      <Stack.Screen
        name="Leaderboard"
        component={Leaderboard}
        options={{ title: 'Leaderboard' }}
      />
      <Stack.Screen
        name="RunDetail"
        component={RunDetail}
        options={{ title: 'Run Detail' }}
      />
    </Stack.Navigator>
  );
}

// Stack for vehicle management
function VehiclesStack() {
  return (
    <Stack.Navigator initialRouteName="VehicleList">
      <Stack.Screen
        name="VehicleList"
        component={VehicleList}
        options={({ navigation }) => ({
          title: 'Vehicles',
          headerRight: () => (
            <MaterialIcons
              name="add-circle-outline"
              size={24}
              onPress={() => navigation.navigate('AddVehicle')}
              style={{ marginRight: 16 }}
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
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator initialRouteName="Routes" screenOptions={{ headerShown: false }}>
        <Tab.Screen
          name="Routes"
          component={RoutesStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="map" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Vehicles"
          component={VehiclesStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="directions-car" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
