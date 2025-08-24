// App.js
import React, { useContext } from 'react';
import { Button } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  createBottomTabNavigator
} from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator
} from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

import { UserProvider, UserContext } from './UserContext';

// --- Import your screen components ---
import Home        from './Home';

import TrailList   from './TrailList';
import TrailDetail from './TrailDetail';
import AddTrail    from './AddTrail';
import Tracker     from './Tracker';

import RunList     from './RunList';
import AddRun      from './AddRun';
import RunDetail   from './RunDetail';

import GroupList   from './GroupList';
import AddGroup    from './AddGroup';

import CategoryList from './CategoryList';
import AddCategory  from './AddCategory';

import ProfileHome  from './ProfileHome';
import Contact      from './Contact';
import VehicleList  from './VehicleList';
import AddVehicle   from './AddVehicle';
import Preferences  from './Preferences';
import UserList     from './UserList';
import AddUser      from './AddUser';
// ---------------------------------------

const AuthStack = createNativeStackNavigator();
const Tab       = createBottomTabNavigator();
const Stack     = createNativeStackNavigator();

// 1) Authentication flow (profile selection / create)
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <AuthStack.Screen
        name="UserList"
        component={UserList}
        options={{ title: 'Select Profile' }}
      />
      <AuthStack.Screen
        name="AddUser"
        component={AddUser}
        options={{ title: 'New Profile' }}
      />
    </AuthStack.Navigator>
  );
}

// 2) Trails stack (includes AddTrail)
function TrailsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="TrailList"
        component={TrailList}
        options={({ navigation }) => ({
          title: 'Trails',
          headerRight: () => (
            <Button
              title="New"
              onPress={() => navigation.navigate('AddTrail')}
            />
          ),
        })}
      />
      <Stack.Screen
        name="TrailDetail"
        component={TrailDetail}
        options={{ title: 'Trail' }}
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

// 3) Runs stack
function RunsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="RunList"
        component={RunList}
        options={({ navigation }) => ({
          title: 'My Runs',
          headerRight: () => (
            <Button
              title="New"
              onPress={() => navigation.navigate('AddRun')}
            />
          ),
        })}
      />
      <Stack.Screen
        name="AddRun"
        component={AddRun}
        options={{ title: 'New Run' }}
      />
      <Stack.Screen
        name="RunDetail"
        component={RunDetail}
        options={{ title: 'Run Detail' }}
      />
      <Stack.Screen
        name="Tracker"
        component={Tracker}
        options={{ title: 'Tracker' }}
      />
    </Stack.Navigator>
  );
}

// 4) Groups stack
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

// 5) Categories stack
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

// 6) Profile stack
function ProfileStack() {
  return (
    <Stack.Navigator initialRouteName="ProfileHome">
      <Stack.Screen
        name="ProfileHome"
        component={ProfileHome}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="Contact"
        component={Contact}
        options={{ title: 'Contact Info' }}
      />
      <Stack.Screen
        name="VehicleList"
        component={VehicleList}
        options={{ title: 'My Vehicles' }}
      />
      <Stack.Screen
        name="AddVehicle"
        component={AddVehicle}
        options={{ title: 'New Vehicle' }}
      />
      <Stack.Screen
        name="Preferences"
        component={Preferences}
        options={{ title: 'Preferences' }}
      />
      <Stack.Screen
        name="UserList"
        component={UserList}
        options={{ title: 'Switch Profile' }}
      />
      <Stack.Screen
        name="AddUser"
        component={AddUser}
        options={{ title: 'New Profile' }}
      />
    </Stack.Navigator>
  );
}

// 7) Main tabs—including the new HomeTab
function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="HomeTab"
        component={Home}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TrailsTab"
        component={TrailsStack}
        options={{
          tabBarLabel: 'Trails',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="RunsTab"
        component={RunsStack}
        options={{
          tabBarLabel: 'Runs',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="timer" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="GroupsTab"
        component={GroupsStack}
        options={{
          tabBarLabel: 'Groups',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="group" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CategoriesTab"
        component={CategoriesStack}
        options={{
          tabBarLabel: 'Categories',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="label" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// 8) Root: if no user, go into Auth; else show MainTabs
function AppInner() {
  const { user } = useContext(UserContext);
  return (
    <NavigationContainer>
      {user == null ? <AuthNavigator /> : <MainTabs />}
    </NavigationContainer>
  );
}

// 9) Wrap with UserProvider
export default function App() {
  return (
    <UserProvider>
      <AppInner />
    </UserProvider>
  );
}
