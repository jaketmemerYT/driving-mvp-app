import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Button } from 'react-native';
import axios from 'axios';
import { API_BASE } from './config';

export default function Leaderboard({ route, navigation }) {
  const { trailId, name } = route.params;
  const [runs, setRuns] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/api/leaderboard/${trailId}`)
      .then(r => setRuns(r.data))
      .catch(console.error);
  }, []);

  if (!runs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{flex:1}}>
      <Text style={styles.header}>{name} — Top 5</Text>
      <FlatList
        data={runs}
        keyExtractor={(_,i)=>String(i)}
        renderItem={({item,index})=>(
            <TouchableOpacity
              style={styles.item}
              onPress={() =>
                navigation.navigate('RunDetail', { run: item, trailName: name })
              }
            >

            <Text>{index+1}. {Math.round(item.duration)}s @ {item.avgSpeed.toFixed(1)} m/s</Text>
          </TouchableOpacity>
        )}
      />
      <Button title="Back to Trails" onPress={()=>navigation.popToTop()} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {flex:1,justifyContent:'center',alignItems:'center'},
  header: {fontSize:18,fontWeight:'bold',padding:16},
  item: {padding:16,borderBottomWidth:1,borderColor:'#eee'}
});
