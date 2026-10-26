import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

const CONFETTI = ['🎉', '✨', '🌟', '💎', '⭐', '🎆', '🪄'];

const ConfettiModal = ({
  visible,
  onClose,
  badge = 'Achievement Unlocked',
  confetti = 'Great work! Keep going ',
}) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  /* 🔑 Modal floating animation */
  const modalFloat = useRef(new Animated.Value(0)).current;

  /* 🎆 Confetti */
  const confettiLoops = useRef([]);
  const confettiAnims = useRef(
    [...Array(12)].map(() => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(height + 40),
      opacity: new Animated.Value(0.8),
      scale: new Animated.Value(0.6 + Math.random() * 0.4),
    }))
  ).current;

  /* ================= OPEN / CLOSE ================= */
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      startModalFloat();
      startConfetti();
    } else {
      stopConfetti();
      modalFloat.stopAnimation();
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }

    return stopConfetti;
  }, [visible]);

  /* ================= MODAL FLOAT ================= */
  const startModalFloat = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(modalFloat, {
          toValue: -10,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(modalFloat, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  /* ================= CONFETTI ================= */
  const startConfetti = () => {
    stopConfetti();
    confettiLoops.current = [];

    confettiAnims.forEach((item, i) => {
      item.y.setValue(height + 40);
      item.opacity.setValue(0.8);

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(item.y, {
            toValue: -60,
            duration: 4200 + i * 180,
            useNativeDriver: true,
          }),
          Animated.timing(item.opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );

      confettiLoops.current.push(loop);
      loop.start();
    });
  };

  const stopConfetti = () => {
    confettiLoops.current.forEach(loop => loop.stop());
    confettiLoops.current = [];
  };

  const handleClose = () => {
    stopConfetti();
    modalFloat.stopAnimation();
    onClose && onClose();
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* ✨ Confetti */}
        <View style={{ position: 'absolute', width, height }}>
          {confettiAnims.map((item, i) => (
            <Animated.Text
              key={i}
              style={{
                position: 'absolute',
                fontSize: 20,
                opacity: item.opacity,
                transform: [
                  { translateX: item.x },
                  { translateY: item.y },
                  { scale: item.scale },
                ],
              }}
            >
              {CONFETTI[i % CONFETTI.length]}
            </Animated.Text>
          ))}
        </View>

        {/* 💎 Floating Modal Card */}
        <Animated.View
          style={{
            width: width * 0.82,
            borderRadius: 22,
            backgroundColor: 'rgba(255,255,255,0.95)',
            padding: 24,
            transform: [
              { scale: scaleAnim },
              { translateY: modalFloat },
            ],
            opacity: opacityAnim,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 18,
            elevation: 16,
          }}
        >
          {/*  Close */}
          <TouchableOpacity
            onPress={handleClose}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              height: 32,
              width: 32,
              borderRadius: 16,
              backgroundColor: '#D9D2C3',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 22,
              fontWeight: '800',
              color: '#1F1D1A',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            🎊 Congratulations
          </Text>

          <LinearGradient
            colors={['#F9FAFB', '#EEF2FF']}
            style={{
              padding: 16,
              borderRadius: 16,
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: '#3730A3',
              }}
            >
              🏆 {badge}
            </Text>
          </LinearGradient>

          <Text
            style={{
              fontSize: 14,
              color: '#1F1D1A',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 22,
            }}
          >
            {confetti}
          </Text>

          <TouchableOpacity
            onPress={handleClose}
            style={{
              alignSelf: 'center',
              backgroundColor: '#1F1D1A',
              paddingVertical: 12,
              paddingHorizontal: 38,
              borderRadius: 26,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
              Awesome
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default ConfettiModal;
