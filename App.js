// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator }    from '@react-navigation/bottom-tabs';
import { MaterialIcons }               from '@expo/vector-icons';

import RunList      from './RunList';
import AddRun       from './AddRun';
import Tracker      from './Tracker';
import RunDetail    from './RunDetail';
import VehicleList  from './VehicleList';
import AddVehicle   from './AddVehicle';
import GroupList    from './GroupList';
import AddGroup     from './AddGroup';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// Routes stack: runs & tracking
function RoutesStack() {
  return (
    <Stack.Navigator initialRouteName="RunList">
      <Stack.Screen name="RunList"   component={RunList}   options={{ title: 'My Runs' }} />
      <Stack.Screen name="AddRun"    component={AddRun}    options={{ title: 'New Run' }} />
      <Stack.Screen name="Tracker"   component={Tracker}   options={{ title: 'Tracker' }} />
      <Stack.Screen name="RunDetail" component={RunDetail} options={{ title: 'Run Detail' }} />
    </Stack.Navigator>
  );
}

// Vehicles stack
function VehiclesStack() {
  return (
    <Stack.Navigator initialRouteName="VehicleList">
      <Stack.Screen name="VehicleList" component={VehicleList} options={{ title: 'Vehicles' }} />
      <Stack.Screen name="AddVehicle"  component={AddVehicle}  options={{ title: 'New Vehicle' }} />
    </Stack.Navigator>
  );
}

// Groups stack
function GroupsStack() {
  return (
    <Stack.Navigator initialRouteName="GroupList">
      <Stack.Screen name="GroupList" component={GroupList} options={{ title: 'Groups' }} />
      <Stack.Screen name="AddGroup"  component={AddGroup}  options={{ title: 'New Group' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator initialRouteName="Routes"
        screenOptions={{ headerShown: false }}
      >
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
          name="Groups"
          component={GroupsStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="group" size={size} color={color} />
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
