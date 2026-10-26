import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet, 
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import LinearGradient from "react-native-linear-gradient";


const UpdateModal = ({ visible, type, message, storeUrl, onClose }) => {
  return (
    <Modal transparent statusBarTranslucent={true} visible={visible} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Drag Indicator */}
          <View style={styles.dragIndicator} />

          <Text style={styles.title}>
            {type === 'hard' ? 'Update Required' : 'New Update Available'}
          </Text>

          <Text style={styles.message}>
            {message || 'Please update the app to continue.'}
          </Text>


          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Linking.openURL(storeUrl)}
          >
            <LinearGradient colors={['#C9A24D', '#A67C2E', '#C9A24D']}
              style={styles.updateBtn}>
              <Text style={styles.updateText}>Update Now</Text>
            </LinearGradient>
          </TouchableOpacity>

          {type === 'soft' && (
            <TouchableOpacity
              style={styles.laterBtn}
              activeOpacity={0.7}
              onPress={onClose}
            >
              <Text style={styles.laterText}>Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default UpdateModal;
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  sheet: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 70 : 60,
    paddingTop: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },

  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 4,
    alignSelf: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1F1D1A',
  },

  message: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    color: '#7A7266',
  },

  updateBtn: {
    // backgroundColor: '#1F1D1A',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 24,
  },

  updateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  laterBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderColor: '#1F1D1A',
    borderWidth: 2,
    borderRadius: 10,
  },

  laterText: {
    textAlign: 'center',
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
