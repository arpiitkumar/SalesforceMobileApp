import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Feather from '@react-native-vector-icons/feather';

interface SessionExpiredModalProps {
  visible: boolean;
  onConfirm: () => void;
}

const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  visible,
  onConfirm,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onConfirm}
      statusBarTranslucent={true}
    >
      <Pressable style={styles.backdrop} onPress={onConfirm}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['#C9A24D', '#A67C2E', '#C9A24D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <Text style={styles.headerText}>Session Expired</Text>
          </LinearGradient>

          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Feather name="alert-triangle" size={30} color="#C9A24D" />
              </View>
            </View>

            <Text style={styles.message}>
              Session expired. Please log in again.
            </Text>

            <TouchableOpacity
              style={styles.confirmButtonWrapper}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#C9A24D', '#A67C2E', '#C9A24D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmButton}
              >
                <Text style={styles.confirmText}>OK</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default SessionExpiredModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 99999,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 340,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  header: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 14,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F9E5E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 22,
    fontWeight: '500',
  },
  confirmButtonWrapper: {
    width: '100%',
    height: 46,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
