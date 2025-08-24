// ProfileHome.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';

import Contact     from './Contact';
import VehicleList from './VehicleList';
import Preferences from './Preferences';
import UserList    from './UserList';

const Tab = createBottomTabNavigator();

export default function ProfileHome() {
  return (
    <Tab.Navigator
      initialRouteName="Contact"
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Contact"
        component={Contact}
        options={{
          tabBarLabel: 'Contact',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Vehicles"
        component={VehicleList}
        options={{
          tabBarLabel: 'Vehicles',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="directions-car" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Preferences"
        component={Preferences}
        options={{
          tabBarLabel: 'Prefs',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="settings" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profiles"
        component={UserList}
        options={{
          tabBarLabel: 'Profiles',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="switch-account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
