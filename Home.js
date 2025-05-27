// Home.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  StyleSheet
} from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from './config';

export default function Home() {
  const [runs, setRuns] = useState(null);

  useFocusEffect(
    useCallback(() => {
      axios
        .get(`${API_BASE}/api/routes`)
        .then(r => {
          // sort by newest
          setRuns(r.data.sort((a, b) => b.timestamp - a.timestamp));
        })
        .catch(console.error);
    }, [])
  );

  if (runs === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={runs}
      keyExtractor={i=>i.id}
      renderItem={({item})=>(
        <View style={styles.item}>
          <Text style={styles.text}>
            {`${item.duration.toFixed(1)}s — ${new Date(item.timestamp).toLocaleString()}`}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center:{ flex:1, justifyContent:'center',alignItems:'center' },
  item: { padding:16, borderBottomWidth:1, borderColor:'#EEE' },
  text: { fontSize:16 },
});
