// Preferences.js
import React, { useContext, useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { UserContext } from './UserContext';

const COLOR_OPTIONS = [
  'black', 'gray', 'red', 'orange', 'yellow',
  'green', 'teal', 'blue', 'navy', 'purple',
  'magenta', 'pink', 'brown', 'olive', '#FF8800',
  '#0088FF'
];

export default function Preferences({ navigation }) {
  const { user, updatePreferences } = useContext(UserContext);
  if (!user) return null; // or show a loader

  // ensure prefs object exists
  const prefs = user.preferences || {};

  // local state, seeded from existing prefs or defaults
  const [liveRouteColor,     setLiveRouteColor]     = useState(prefs.liveRouteColor     || 'blue');
  const [officialRouteColor, setOfficialRouteColor] = useState(prefs.officialRouteColor || 'black');
  const [warningColor1,      setWarningColor1]      = useState(prefs.warningColor1      || 'orange');
  const [warningColor2,      setWarningColor2]      = useState(prefs.warningColor2      || 'red');
  const [warningThreshold1,  setWarningThreshold1]  = useState(String(prefs.warningThreshold1  || 50));
  const [warningThreshold2,  setWarningThreshold2]  = useState(String(prefs.warningThreshold2  || 75));

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Preferences' });
  }, [navigation]);

  const onSave = () => {
    updatePreferences({
      liveRouteColor,
      officialRouteColor,
      warningColor1,
      warningColor2,
      warningThreshold1: Number(warningThreshold1),
      warningThreshold2: Number(warningThreshold2),
    });
    Alert.alert('Preferences Saved', 'Your settings have been updated.');
  };

  // helper to render a color picklist for a given value/setter, excluding other selected colors
  const renderColorPicker = (label, value, setValue, exclude = []) => (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.swatchRow}
      >
        {COLOR_OPTIONS.map(color => {
          const disabled = exclude.includes(color);
          const selected = color === value;
          return (
            <TouchableOpacity
              key={color}
              style={[
                styles.swatch,
                { backgroundColor: color },
                selected && styles.swatchSelected,
                disabled && styles.swatchDisabled,
              ]}
              disabled={disabled}
              onPress={() => setValue(color)}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {renderColorPicker(
        'Live Route Color',
        liveRouteColor,
        setLiveRouteColor,
        [officialRouteColor, warningColor1, warningColor2]
      )}
      {renderColorPicker(
        'Official Route Color',
        officialRouteColor,
        setOfficialRouteColor,
        [liveRouteColor, warningColor1, warningColor2]
      )}
      {renderColorPicker(
        `Warning Color (≥ ${warningThreshold1} ft)`,
        warningColor1,
        setWarningColor1,
        [liveRouteColor, officialRouteColor, warningColor2]
      )}
      {renderColorPicker(
        `Critical Color (≥ ${warningThreshold2} ft)`,
        warningColor2,
        setWarningColor2,
        [liveRouteColor, officialRouteColor, warningColor1]
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Warning Threshold (feet)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={warningThreshold1}
          onChangeText={setWarningThreshold1}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Critical Threshold (feet)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={warningThreshold2}
          onChangeText={setWarningThreshold2}
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Save Preferences" onPress={onSave} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontWeight: '500',
    marginBottom: 8,
  },
  swatchRow: {
    paddingHorizontal: 4,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 4,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  swatchSelected: {
    borderColor: '#000',
    borderWidth: 2,
  },
  swatchDisabled: {
    opacity: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    marginTop: 16,
  },
});
