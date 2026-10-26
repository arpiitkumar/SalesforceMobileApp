// src/components/common/LoaderOverlay.js
// src/components/common/LoaderOverlay.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Spinner from 'react-native-spinkit';
 
const LoaderOverlay = ({ visible = false, message = 'Loading...' }) => {
  if (!visible) return null;
 
  return (
    <View style={styles.overlay}>
      <View style={styles.loaderBox}>
        <Spinner size={40} type="Wave" color="#C9A24D" style={{ marginBottom: 20 }} />
        <Text style={styles.loaderText}>{message}</Text>
      </View>
    </View>
  );
};
 
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loaderBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
});
 
export default LoaderOverlay;
 
 