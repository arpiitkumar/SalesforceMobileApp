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

const DeviceConfirmModal = ({
  isVisible,
  title = 'Access Denied',
  message = 'You are not allowed to use this app as you are not logged in with the assigned device.',
  buttonText = 'Logout',
  onLogout,
  onYes,
  onNo,
}) => {
  const handleAction = onLogout || onNo;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleAction}
      statusBarTranslucent={false}
    >
      <Pressable style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#C9A24D', '#A67C2E', '#C9A24D']}
            style={styles.header}
          >
            <Text style={styles.headerText}>{title}</Text>
          </LinearGradient>

          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>🚫</Text>
            </View>

            <Text style={styles.message}>{message}</Text>

            <View style={styles.buttons}>
              {onYes ? (
                <>
                  <TouchableOpacity style={styles.noButton} onPress={onNo}>
                    <Text style={styles.noText}>No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.yesButton} onPress={onYes}>
                    <Text style={styles.yesText}>Yes</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={handleAction}
                  activeOpacity={0.8}
                >
                  <Text style={styles.logoutText}>{buttonText}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 380,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  header: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconText: {
    fontSize: 48,
  },
  message: {
    fontSize: 15,
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    fontWeight: '500',
  },
  buttons: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  logoutButton: {
    backgroundColor: '#C9A24D',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  yesButton: {
    backgroundColor: '#C9A24D',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  noButton: {
    borderColor: '#C9A24D',
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  yesText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  noText: {
    color: '#A67C2E',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default DeviceConfirmModal;
