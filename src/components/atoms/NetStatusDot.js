import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { isInternetAvailable } from '../../utils/networkUtils'; // adjust path if needed

const NetStatusDot = () => {
  const [isOnline, setIsOnline] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const checkConnection = async () => {
      const connected = await isInternetAvailable();
      setIsOnline(connected);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000); // check every 5s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let pulse;
    if (isOnline) {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
    } else {
      pulseAnim.setValue(1); // Reset opacity if offline
    }

    return () => {
      if (pulse) pulse.stop();
    };
  }, [isOnline]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: isOnline ? '#91FF50' : 'red',
          opacity: isOnline ? pulseAnim : 1,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  dot: {
    width: 7,
    height: 7,
    borderRadius: 5,
    marginRight: 6,
  },
});

export default NetStatusDot;
