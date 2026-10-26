import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from '@react-native-vector-icons/entypo';
import AIcon from "../AntDesign";

import LinearGradient from 'react-native-linear-gradient';


const CustomModal = ({ visible, onClose, onSubmit, children }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Select Dashboard View</Text>
                <TouchableOpacity onPress={onClose}>
                  <AIcon name="close" size={20} color="#333" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Modal Content from Parent */}
              <View style={styles.content}>
                {children}
              </View>

              {/* Submit Button */}
              <LinearGradient colors={['#C9A24D', '#A67C2E', '#C9A24D']} start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }} style={styles.linearGradient}>
                <TouchableOpacity style={styles.submitButton} onPress={onSubmit}>
                  <Text style={styles.submitText}>Submit</Text>
                </TouchableOpacity>
              </LinearGradient>


            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default CustomModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderTopRightRadius: 22,
    borderTopLeftRadius: 22,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  submitButton: {
    // backgroundColor: '#0044cc',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
