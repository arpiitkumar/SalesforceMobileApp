import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

const ToastModal = ({ visible, message, type = 'success', onClose }) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const getColor = () => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      case 'warning': return '#FFC107';
      case 'info': return '#2196F3';
      default: return '#333';
    }
  };

  const renderToastIcon = () => {
    switch (type) {
      case 'success':
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={styles.icon}>
            <Circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2" />
            <Path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case 'error':
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={styles.icon}>
            <Circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2" />
            <Path d="M15 9l-6 6M9 9l6 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case 'warning':
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={styles.icon}>
            <Circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2" />
            <Path d="M12 8v4M12 16h.01" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case 'info':
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={styles.icon}>
            <Circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2" />
            <Path d="M12 16v-4M12 8h.01" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      default:
        return null;
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toastBox,
          { backgroundColor: getColor(), transform: [{ translateY: slideAnim }] },
        ]}
      >
        {renderToastIcon()}
        <Text style={styles.toastText}>{message}</Text>
        <TouchableOpacity onPress={onClose}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 50,
    width: '100%',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    minWidth: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
    marginHorizontal: 10,
  },
  icon: {
    marginLeft: 4,
  },
});

export default ToastModal;
