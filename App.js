// App.js
import React from 'react';
import { Button } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator }  from '@react-navigation/native-stack';
import { createBottomTabNavigator }    from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';

import { UserProvider } from './UserContext';
import UserList    from './UserList';
import AddUser     from './AddUser';
import RunList     from './RunList';
import AddRun      from './AddRun';
import Tracker     from './Tracker';
import RunDetail   from './RunDetail';
import AddTrail   from './AddTrail';
import TrailList   from './TrailList';
import VehicleList from './VehicleList';
import AddVehicle  from './AddVehicle';
import GroupList   from './GroupList';
import AddGroup    from './AddGroup';
import CategoryList  from './CategoryList';
import AddCategory   from './AddCategory';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="UserList"
        component={UserList}
        options={{ title: 'Select User' }}
      />
      <Stack.Screen
        name="AddUser"
        component={AddUser}
        options={{ title: 'New User' }}
      />
    </Stack.Navigator>
  );
}

function RunsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="RunList"
        component={RunList}
        options={{ title: 'My Runs' }}
      />
      <Stack.Screen
        name="AddRun"
        component={AddRun}
        options={{ title: 'New Run' }}
      />
      <Stack.Screen
        name="Tracker"
        component={Tracker}
        options={{ title: 'Tracker' }}
      />
      <Stack.Screen
        name="RunDetail"
        component={RunDetail}
        options={{ title: 'Run Detail' }}
      />
    </Stack.Navigator>
  );
}

function TrailsStack() {
  return (
    <Stack.Navigator initialRouteName="TrailList">
      <Stack.Screen
        name="TrailList"
        component={TrailList}
        options={({ navigation }) => ({
          title: 'Trails',
          headerRight: () => (
            <Button
              title="New Trail"
              onPress={() => navigation.navigate('AddTrail')}
            />
          ),
        })}
      />
      <Stack.Screen
        name="AddTrail"
        component={AddTrail}
        options={{ title: 'New Trail' }}
      />
      <Stack.Screen
        name="Tracker"
        component={Tracker}
        options={{ title: 'Tracker' }}
      />
    </Stack.Navigator>
  );
}

function GroupsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="GroupList"
        component={GroupList}
        options={({ navigation }) => ({
          title: 'Groups',
          headerRight: () => (
            <Button
              title="New"
              onPress={() => navigation.navigate('AddGroup')}
            />
          ),
        })}
      />
      <Stack.Screen
        name="AddGroup"
        component={AddGroup}
        options={{ title: 'New Group' }}
      />
    </Stack.Navigator>
  );
}

function CategoriesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CategoryList"
        component={CategoryList}
        options={({ navigation }) => ({
          title: 'Categories',
          headerRight: () => (
            <Button
              title="New"
              onPress={() => navigation.navigate('AddCategory')}
            />
          ),
        })}
      />
      <Stack.Screen
        name="AddCategory"
        component={AddCategory}
        options={{ title: 'New Category' }}
      />
    </Stack.Navigator>
  );
}

function VehiclesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="VehicleList"
        component={VehicleList}
        options={({ navigation }) => ({
          title: 'Vehicles',
          headerRight: () => (
            <Button
              title="New"
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
  );
}

export default function App() {
  return (
    <UserProvider>
      <NavigationContainer>
        <Tab.Navigator initialRouteName="Profile">
          <Tab.Screen
            name="Profile"
            component={ProfileStack}
            options={{
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="person" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Runs"
            component={RunsStack}
            options={{
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="timer" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Trails"
            component={TrailsStack}
            options={{
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="map" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Groups"
            component={GroupsStack}
            options={{
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="group" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Categories"
            component={CategoriesStack}
            options={{
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="label" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Vehicles"
            component={VehiclesStack}
            options={{
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="directions-car" size={size} color={color} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </UserProvider>
  );
}
