import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PlaceholderScreen = ({ name }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>This is the {name} screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    
    flex: 1,
    justifyContent: 'center',   // center vertically
    alignItems: 'center',       // center horizontally
    paddingBottom: 80,          // to avoid overlap with tab bar if you want
    backgroundColor: '#FBF8F1', // optional, light background
    //backgroundColor: 'red', // optional, light background
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#A67C2E',
  },
});

export default PlaceholderScreen;
