import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Feather from '@react-native-vector-icons/feather';

 
const StoreDetailsModal = ({ visible, onClose, data }) => {
  const details = [
    { label: 'Parent Account', value: data?.parentAccount },
  //  { label: 'Sub Channel', value: data?.subChannel },
   // { label: 'Sub Channel 1', value: data?.subChannel1 },
   // { label: 'Sub Channel 2', value: data?.subChannel2 },
    { label: 'Beat', value: data?.beat },
    { label: 'Email', value: data?.email },
    { label: 'Phone', value: data?.phone },
    { label: 'GSTIN', value: data?.gstin },
    { label: 'PAN', value: data?.pan },
   // { label: 'OTP Verified', value: data?.otpVerified },
   // { label: 'KYC Updated', value: data?.kycUpdated },
  ];
 
  const renderRows = () => {
    const rows = [];
    for (let i = 0; i < details.length; i += 2) {
      const left = details[i];
      const right = details[i + 1];
      rows.push(
        <View key={i} style={styles.row}>
          <View style={styles.item}>
            <Text style={styles.label}>{left.label}</Text>
            <Text style={styles.value}>{left.value || '-'}</Text>
          </View>
          {right ? (
            <View style={styles.item}>
              <Text style={styles.label}>{right.label}</Text>
              <Text style={styles.value}>{right.value || '-'}</Text>
            </View>
          ) : (
            <View style={styles.item} />
          )}
        </View>
      );
    }
    return rows;
  };
 
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Store Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#000" />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderRows()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
 
export default StoreDetailsModal;
 
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 19,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // alignItems: 'center',
    marginBottom: 10,
    padding:10
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: 'black',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    // backgroundColor:'red',
    padding:12,
    height:50,
  },
  item: {
    flex: 1,
    paddingRight: 10,
  },
  label: {
    fontSize: 13,
    color: '#7A7266',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    height: 40,
    fontWeight: '600',
    color: '#000',
  },
});
 