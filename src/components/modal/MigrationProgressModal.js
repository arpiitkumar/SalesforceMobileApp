// src/components/modal/MigrationProgressModal.js
// ============================================================
// Blocking, non-dismissable popup shown while the offline DB is
// rebuilt + re-synced after a Remote-Config schema migration.
// Uses only core RN APIs (no extra deps). Determinate progress bar.
// ============================================================
import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';

const clamp = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

const MigrationProgressModal = ({ visible, progress = 0, message = '' }) => {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const target = clamp(progress);

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: target,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false, // animating width %, not transform
    }).start();
  }, [target, widthAnim]);

  const widthInterpolated = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const pct = Math.round(target * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // No-op: hardware back must NOT dismiss a migration in progress.
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#C9A24D" style={styles.spinner} />

          <Text style={styles.title}>Updating App Data</Text>
          <Text style={styles.subtitle}>
            We’re upgrading your offline database to the latest version. This
            happens only once and may take a little while.
          </Text>

          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, { width: widthInterpolated }]} />
          </View>

          <Text style={styles.pct}>{pct}%</Text>

          {!!message && <Text style={styles.message} numberOfLines={2}>{message}</Text>}

          <Text style={styles.warn}>
            Please keep the app open and do not close it.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

export default MigrationProgressModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  spinner: {
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#A67C2E',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  barTrack: {
    width: '100%',
    height: 10,
    borderRadius: 6,
    backgroundColor: '#E6EAF2',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#C9A24D',
  },
  pct: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#A67C2E',
  },
  message: {
    marginTop: 8,
    fontSize: 12.5,
    color: '#444',
    textAlign: 'center',
  },
  warn: {
    marginTop: 16,
    fontSize: 12,
    color: '#B00020',
    textAlign: 'center',
    fontWeight: '500',
  },
});
