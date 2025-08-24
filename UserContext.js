// UserContext.js
import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from './config';

export const UserContext = createContext({
  users:       [],
  user:        null,
  setUser:     () => {},
  refreshUsers:() => {},
  addUser:     async () => {},
  updatePreferences: async () => {}
});

export function UserProvider({ children }) {
  const [users, setUsers] = useState(null);
  const [user,  _setUser] = useState(null);

  // wrap setUser to guarantee prefs object
  const setUser = u => {
    if (!u) return _setUser(null);
    _setUser({ ...u, preferences: u.preferences || {} });
  };

  // reload the user list
  const refreshUsers = () => {
    axios.get(`${API_BASE}/api/users`)
      .then(res => setUsers(res.data))
      .catch(err => {
        console.error('Failed to load users:', err);
        setUsers([]);
      });
  };

  // add a brand‐new user
  const addUser = async (name, email) => {
    const res = await axios.post(`${API_BASE}/api/users`, { name, email });
    const newUser = { ...res.data, preferences: {} };
    setUsers(prev => (prev || []).concat(newUser));
    return newUser;
  };

  // update & persist preferences
  const updatePreferences = async prefsUpdate => {
    // merge into local copy
    const updated = {
      ...user,
      preferences: {
        ...(user.preferences || {}),
        ...prefsUpdate
      }
    };
    setUser(updated);

    // persist to backend
    try {
      const res = await axios.patch(
        `${API_BASE}/api/users/${user.id}/preferences`,
        { preferences: updated.preferences }
      );
      // sync with whatever the server returns
      setUser(res.data);
    } catch (err) {
      console.error('Failed to save preferences:', err);
      // optionally re-fetch or alert user
    }
  };

  useEffect(refreshUsers, []);

  return (
    <UserContext.Provider
      value={{
        users,
        user,
        setUser,
        refreshUsers,
        addUser,
        updatePreferences
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
