// Home.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import LeaderboardMarquee from './LeaderboardMarquee';

export default function Home() {
  // Keep Home lean; the marquee fetches what it needs and cycles through trails.
  return (
    <View style={styles.container}>
      <LeaderboardMarquee dwellMs={4000} maxRows={5} pauseOnPress />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
});
