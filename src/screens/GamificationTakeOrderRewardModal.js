import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from "../components/Ionicons";

const SCREEN = Dimensions.get('window');

const GamificationTakeOrderRewardModal = ({
  visible,
  onClose,
  points = 0,
  gameName = 'Gamification',
}) => {
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  /* 🔁 Soft up-down floating animation */
  useEffect(() => {
    let floatLoop;

    if (visible) {
      opacityAnim.setValue(0);

      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      floatLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(translateYAnim, {
            toValue: -8,        // 🔼 up
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 0,         // 🔽 back to normal
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );

      floatLoop.start();
    }

    return () => {
      if (floatLoop) floatLoop.stop();
      translateYAnim.setValue(0);
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <Pressable>
            <Animated.View
              style={[
                styles.card,
                { transform: [{ translateY: translateYAnim }] },
              ]}
            >
              {/*  Close */}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={22} color="#7A7266" />
              </TouchableOpacity>

              {/* 🏆 Trophy */}
              <LinearGradient
                colors={['#FCD34D', '#F59E0B']}
                style={styles.iconWrap}
              >
                <Ionicons name="trophy" size={36} color="#fff" />
              </LinearGradient>

              <Text style={styles.title}>🎉 Congratulations!</Text>

              {/* ⭐ Points Highlight */}
              <View style={styles.pointsWrap}>
                <Text style={styles.pointsText}>+{points}</Text>
                <Text style={styles.pointsLabel}>Reward Points</Text>
              </View>

              {/* SAME LINE TEXT */}
              <Text style={styles.text}>
                You have earned{' '}
                <Text style={styles.boldPoints}>{points}</Text>{' '}
                reward points from this order in the{' '}
                <Text style={styles.gameName}>{gameName}</Text>{' '}
                game.
              </Text>

            </Animated.View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

export default GamificationTakeOrderRewardModal;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    width: SCREEN.width * 0.82,
    backgroundColor: '#fff',
    borderRadius: 26,
    paddingVertical: 30,
    paddingHorizontal: 22,
    alignItems: 'center',
    elevation: 10,
  },

  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1EADB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F1D1A',
  },

  pointsWrap: {
    paddingVertical: 10,
    paddingHorizontal: 26,
    borderRadius: 20,
    alignItems: 'center',
  },

  pointsText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#3B5BB5',
  },

  pointsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B5BB5',
    marginTop: 2,
  },

  text: {
    fontSize: 14,
    color: '#7A7266',
    textAlign: 'center',
    lineHeight: 20,
  },

  boldPoints: {
    fontWeight: '900',
    color: '#3B5BB5',
  },

  gameName: {
    fontWeight: '800',
    color: '#3B5BB5',
  },
});
