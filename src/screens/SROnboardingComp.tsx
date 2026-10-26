import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import HeaderMain from '../components/HeaderMain';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DatePicker from 'react-native-modern-datepicker';

const SROnboardingForm = () => {
  const [formData, setFormData] = useState({
    srFullName: '',
    fatherName: '',
    address: '',
    pinCode: '',
    contactNo: '',
    emergencyContact: '',
    dob: '',
    doj: '',
    aadhar: '',
    education: '',
    prevOrgName: '',
    monthsWorked: '',
    leavingReason: '',
    lastSalary: '',
    sfaKnowledge: '',
    sfaDuration: '',
    proposedSalary: '',
    proofRequired: false,
    allCompanies: '',
    avgIncentive: '',
    incentiveDoc: '',
    approachedBy: '',
    hireReason: '',
    distanceDB: '',
    hasBikePhone: '',
    bikeDetails: '',
    phoneDetails: '',
    imei: '',
    replacement: '',
    lwdPrevious: '',
    oldLeavingReason: '',
    bankName: '',
    branchName: '',
    accountNumber: '',
    ifsc: '',
    addressProof: '',
    photoSR: '',
    cancelCheque: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const fields = [
    // { key: 'srFullName', label: 'SR Full Name' },
    // { key: 'fatherName', label: 'Father Name' },
    { key: 'address', label: 'Complete Address' },
    { key: 'pinCode', label: 'PIN Code', keyboardType: 'numeric' },
    { key: 'contactNo', label: 'Contact No', keyboardType: 'phone-pad' },
    // { key: 'emergencyContact', label: 'Emergency Contact No', keyboardType: 'phone-pad' },
    // // doj uses normal input or modal picker as needed
    // { key: 'doj', label: 'Date of Joining' },
    // { key: 'aadhar', label: 'Aadhar No', keyboardType: 'numeric' },
    // { key: 'education', label: 'Highest Education' },
    // { key: 'prevOrgName', label: 'Previous Organisation Name' },
    // { key: 'monthsWorked', label: 'Months Worked', keyboardType: 'numeric' },
    // { key: 'leavingReason', label: 'Previous Organisation Leaving Reason' },
    // { key: 'lastSalary', label: 'Last Drawn Salary' },
    // { key: 'sfaKnowledge', label: 'Knowledge of SFA (Yes/No)' },
    // { key: 'sfaDuration', label: 'If Yes, Years/Months of SFA' },
    // { key: 'proposedSalary', label: 'Proposed Salary' },
    // { key: 'proofRequired', label: 'Salary Proof Required (Yes/No)' },
    // { key: 'allCompanies', label: 'All Companies Worked Till Date' },
    // { key: 'avgIncentive', label: 'Average Monthly Earned Incentive' },
    // { key: 'incentiveDoc', label: 'Document for Incentive (Yes/No)' },
    // { key: 'approachedBy', label: 'Approached by DB or SE/ASM' },
    // { key: 'hireReason', label: 'Strong Reason to Hire' },
    // { key: 'distanceDB', label: 'Distance from DB Point' },
    // { key: 'hasBikePhone', label: 'Owns Bike & Smartphone (Yes/No)' },
    // { key: 'bikeDetails', label: 'Bike Details' },
    { key: 'phoneDetails', label: 'Phone Details' },
    // { key: 'imei', label: 'IMEI No of Mobile' },
    // { key: 'replacement', label: 'Replacement or New Position' },
    // { key: 'lwdPrevious', label: 'LWD of Previous SR' },
    // { key: 'oldLeavingReason', label: 'Old SR Leaving Reason' },
    // { key: 'bankName', label: 'Bank Name' },
    // { key: 'branchName', label: 'Branch Name' },
    // { key: 'accountNumber', label: 'Account Number', keyboardType: 'numeric' },
    // { key: 'ifsc', label: 'IFSC Code' },
    // { key: 'addressProof', label: 'Address Proof URL' },
    // { key: 'photoSR', label: 'Photo of SR URL' },
    // { key: 'cancelCheque', label: 'Cancelled Cheque URL' },
  ];

  const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const validate = () => {
    const newErrors = {};
    fields.forEach(({ key, label }) => {
      if (!formData[key] || formData[key].toString().trim() === '') {
        newErrors[key] = `${label} is required`;
      }
    });
    if (!formData.dob) newErrors.dob = 'Date of Birth is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // TODO: Implement save logic (API or local DB)
      navigation.goBack();
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.input}>
            <Text>{formData.dob || 'Select DOB'}</Text>
          </TouchableOpacity>
          {errors.dob && <Text style={styles.error}>{errors.dob}</Text>}
        </View>

        {fields.map(({ key, label, keyboardType }) => (
          <View key={key} style={styles.inputWrapper}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={formData[key]?.toString()}
              onChangeText={val => handleChange(key, val)}
              keyboardType={keyboardType || 'default'}
            />
            {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 20}}>

        <TouchableOpacity
          style={[styles.submitButton, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitText}>{loading ? 'Submitting...' : 'Submit'}</Text>
        </TouchableOpacity>

      </View>
      {/* Modal for Date Picker */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <DatePicker
              mode="calendar"
              onSelectedChange={date => {
                handleChange('dob', date);
                setShowDatePicker(false);
              }}
              options={{
                backgroundColor: '#ffffff',
                textHeaderColor: '#000000',
                selectedTextColor: '#A67C2E',
                mainColor: '#A67C2E',
              }}
            />
            <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>Submitting Data...</Text>
        </View>
      )}
    </SafeAreaProvider>
  );
};

export default SROnboardingForm;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#A67C2E' },
  headerContainer: { backgroundColor: '#A67C2E' },
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: moderateScale(20) },
  inputWrapper: { marginBottom: moderateScale(15) },
  label: { fontSize: moderateScale(14), fontWeight: '500', marginBottom: moderateScale(6), color: '#333' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: moderateScale(12),
    paddingVertical: Platform.OS === 'ios' ? moderateScale(12) : moderateScale(8),
    fontSize: moderateScale(14),
    justifyContent: 'center'
  },
  error: { color: 'red', fontSize: moderateScale(12), marginTop: moderateScale(4) },
  submitButton: { backgroundColor: '#A67C2E', paddingVertical: moderateScale(16), borderRadius: moderateScale(10), alignItems: 'center', },
  submitText: { color: '#fff', fontSize: moderateScale(16), fontWeight: '600' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  overlayText: { color: '#fff', fontSize: moderateScale(18), marginTop: moderateScale(10) },
  modalOverlay: { flex: 1, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalContent: { backgroundColor: '#fff', padding: moderateScale(20), borderRadius: moderateScale(12), borderTopRightRadius: moderateScale(12) },
  modalClose: { marginTop: moderateScale(10), alignSelf: 'center' },
  modalCloseText: { fontSize: moderateScale(16), color: '#A67C2E' },
});
