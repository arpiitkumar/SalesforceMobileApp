import React, { useState, useEffect } from 'react';

import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';

import { useRef } from 'react';
import Ionicons from "../Ionicons";
import { launchCamera } from 'react-native-image-picker';
import { toWords } from 'number-to-words';
import { Dropdown } from 'react-native-element-dropdown';
import { Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../../redux/slices/toastSlice';
import { isInternetAvailable } from '../../utils/networkUtils';
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import { CollectionApi } from '../../utils/Collection/CollectionApi';
import { CollectionAllocationApi } from '../../utils/Collection/CollectionAllocationApi';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert'
import useVisitUpdateApi from '../../utils/Collection/VisitUpdateApi';
import LoaderOverlay from '../../utils/helper/LoaderOverlay'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const { width } = Dimensions.get('window');

const bankData = [
  { label: 'State Bank of India', value: 'SBI' },
  { label: 'HDFC Bank', value: 'HDFC' },
  { label: 'ICICI Bank', value: 'ICICI' },
  { label: 'Axis Bank', value: 'AXIS' },
  { label: 'Punjab National Bank', value: 'PNB' },
];

const CollectPaymentModal = ({ visible, onClose, data, selectedTab, selectedInvoice, allInvoice, handleCollection }) => {

  // console.log('Received : ', data)
  const [bankError, setBankError] = useState('');
  const [ifscError, setIfscError] = useState('');
  const [chequeError, setChequeError] = useState('');
  const ifscRef = useRef(null);
  const { VisitUpdateApi } = useVisitUpdateApi();
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState('');
  const [ifsc, setIFSC] = useState('');
  const [chequeNumber, setChequeNumber] = useState(Array(6).fill(''));
  const [imageUri, setImageUri] = useState(null);
  // const [bank, setBank] = useState(null);
  const chequeInputRefs = useRef([]);
  const dispatch = useDispatch();
  const [amountError, setAmountError] = useState('');
  const [loading, setLoading] = useState(false)
  const [showAmout, setShowAmount] = useState(null);
  // const [payloadData, setPayloadData] = useState({})
  const selectedVisit = useSelector(state => state.selectedVisit);
  const { apiFetch, apiComposite } = useApiFetch();

  // console.log("visit id ", selectedVisit)

  useEffect(() => {
    if (!visible) {
      setChequeNumber(Array(6).fill(''));   // reset cheque numbers
      setBank('');
      setIFSC('');
      setAmount('');
      setAmountError('');
      setBankError('');
      setIfscError('');
      setChequeError('');
      setImageUri(null);
    }
  }, [visible]);

  useEffect(() => {

    setBank('')
    if (data && data.Outstanding_Amount__c !== undefined) {
      setShowAmount(Number(data.Outstanding_Amount__c));
    } else {
      const selectedItems = allInvoice.filter(inv => selectedInvoice.includes(inv.Sf_Id));
      const totalAmount = selectedItems.reduce((sum, inv) => sum + Number(inv.Outstanding_Amount__c || 0), 0);
      setShowAmount(totalAmount);
    }
  }, [data, selectedTab, selectedInvoice, allInvoice]);
  const handleChequeNumberChange = (index, value) => {
    const updated = [...chequeNumber];
    updated[index] = value;
    setChequeNumber(updated);

    //  Check if cheque number becomes 000000
    const fullNumber = updated.join("");
    if (fullNumber.length === 6 && fullNumber === "000000") {
      setChequeError("Cheque number cannot be 000000");
      return; // Stop further auto-focus
    } else {
      // Clear error if user corrects
      if (chequeError) setChequeError("");
    }

    // 👉 Move to next box automatically
    if (value && index < chequeNumber.length - 1) {
      chequeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace') {

      // If current box is empty → move to previous box
      if (chequeNumber[index] === '' && index > 0) {

        // Move focus back
        chequeInputRefs.current[index - 1]?.focus();

        // Clear the previous digit also
        const updated = [...chequeNumber];
        updated[index - 1] = '';
        setChequeNumber(updated);
      }
    }
  };

  const handleCameraOpen = async () => {
    const result = await launchCamera({ mediaType: 'photo' });
    if (result?.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleAmountChange = (text) => {
    //  Do NOT allow starting with "."
    if (text.startsWith(".")) return;

    // Allow only numbers and decimal point
    let numericValue = text.replace(/[^0-9.]/g, '');

    // Prevent multiple decimals
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      numericValue = parts[0] + '.' + parts.slice(1).join('');
    }

    let [intPart, decPart] = numericValue.split('.');

    // Max 9 digits before decimal
    intPart = intPart?.slice(0, 9) || '';

    // Max 2 digits after decimal
    decPart = decPart?.slice(0, 2);

    // Combine
    numericValue = decPart !== undefined ? `${intPart}.${decPart}` : intPart;

    setAmount(numericValue);
    if (amountError) setAmountError('');
  };

  // Format for display with commas and decimals
  const getFormattedAmount = (value) => {
    if (!value) return '';
    // Split integer and decimal parts
    const [intPart, decPart] = value.split('.');
    const intWithCommas = Number(intPart).toLocaleString('en-IN');
    return decPart !== undefined ? `${intWithCommas}.${decPart}` : intWithCommas;
  };

  const generateRandomOrderNumber = () => {
    const timestamp = Date.now(); // current time in ms
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // random 4-digit number
    return `ORD-${timestamp}-${randomSuffix}`;
  };
  const generateRandomName = () => {
    const randomNumber = Math.floor(Math.random() * 1000000); // 0 to 999999 range
    const paddedNumber = String(randomNumber).padStart(6, '0'); // pad to 6 digits
    return `COL-${paddedNumber}`;
  };


  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async () => {

    // --- cheque-specific validation ---
    if (paymentMode === 'Cheque') {
      let hasError = false;

      // bank
      if (!bank) {
        setBankError('Please select a bank');
        hasError = true;
      } else {
        setBankError('');
      }

      // IFSC validation: common IFSC pattern (4 letters, 0, 6 chars)
      const ifscTrim = (ifsc || '').trim();
      const ifscRegex = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
      if (!ifscTrim) {
        setIfscError('Please enter IFSC code');
        if (!hasError) {
          // focus IFSC
          ifscRef.current?.focus?.();
        }
        hasError = true;
      } else if (!ifscRegex.test(ifscTrim)) {
        setIfscError('Invalid IFSC format');
        if (!hasError) ifscRef.current?.focus?.();
        hasError = true;
      } else {
        setIfscError('');
      }

      // Cheque number validation: ensure 6 digits filled
      const chequeStr = chequeNumber.join('');
      if (!/^\d{6}$/.test(chequeStr)) {
        setChequeError('Please enter a 6-digit cheque number');
        // focus first cheque input if exists
        if (!hasError && chequeInputRefs.current?.[0]?.focus) {
          chequeInputRefs.current[0].focus();
        }
        hasError = true;
      } else {
        setChequeError('');
      }

      if (hasError) {
        // stop submit flow
        setLoading(false);
        return;
      }
    }

    // if (selectedInvoice.length && data?.length === 0) {
    //       dispatch(showToast({ message: 'You do not have any items in the cart.', type: 'warning' }));
    //       return;
    //     }
    const connected = await isInternetAvailable();

    let resonseId = generateRandomOrderNumber();
    let resonseName = generateRandomName();
    let isFromApi = false;

    const currentOutstanding = parseFloat(showAmout || 0);
    const enteredAmount = parseFloat(amount || 0);

    if (enteredAmount > 0 && enteredAmount <= currentOutstanding) {
      setAmountError('');
    } else {
      setAmountError('Entered amount must be greater than 0 and less than or equal to the current outstanding amount');
      return;
    }

    // const today = new Date().toISOString().split('T')[0];

    // 🔁 Fallback: if no selectedInvoice provided, fallback to single `data`
    let selectedItems = [];

    if (selectedInvoice?.length && allInvoice?.length) {
      selectedItems = allInvoice.filter(inv => selectedInvoice.includes(inv.Sf_Id));
    } else if (data) {
      selectedItems = [data]; // fallback to single object
    }

    const customer__c = data?.Customer__c || selectedItems?.[0]?.Customer__c || 'N/A';

    const payload = {
      apiName: 'Collection__c',
      fields: {
        Comment__c: 'N/A',
        DateOfPayment__c: today,
        PaidAmount__c: amount,
        BankName__c: paymentMode === 'Cheque' ? bank : 'N/A',
        ChequeApproveDate__c: paymentMode === 'Cheque' ? today : null,
        ChequeNEFTDate__c: paymentMode === 'Cheque' ? today : null,
        Visit__c: selectedVisit?.sfId || 'N/A',
        ChequeNumber__c: paymentMode === 'Cheque' ? chequeNumber.join('') : 'N/A',
        Customer__c: customer__c,
        PaymentMode__c: paymentMode,
        CollectionType__c: selectedTab === "withInvoice" ? "With Invoice" : "Without Invoice",
      }
    };

    onClose();
    setLoading(true)
    if (connected) {
      const apiResponse = await CollectionApi(apiFetch, (msg) => dispatch(showToast(msg)), payload);
      const apiResponseId = apiResponse.id;
      const apiResponseName = apiResponse.name;
      if (!apiResponseId) return;

      resonseId = apiResponseId;
      resonseName = apiResponseName;
      isFromApi = true;

      let remainingAmount = parseFloat(amount); // user ne jo diya hai

      for (let i = 0; i < selectedItems.length; i++) {
        if (remainingAmount <= 0) break;

        const item = selectedItems[i];
        const outstanding = parseFloat(item?.Outstanding_Amount__c) || 0;
        const adjustedAmount = Math.min(remainingAmount, outstanding);

        const allocationPayload = {
          apiName: 'Collection_Allocation__c',
          fields: {
            Collection__c: resonseId,
            Invoice__c: item?.Sf_Id,
            AdjustedAmount__c: adjustedAmount,
            AllocationDate__c: today,
          }
        };

        try {
          await CollectionAllocationApi(apiFetch, (msg) => dispatch(showToast(msg)), allocationPayload);
          console.log(`Allocation successful for invoice ${item?.Sf_Id} with amount ${adjustedAmount}`);
        } catch (error) {
          console.error(`Error allocating invoice ${item?.Sf_Id}:`, error);
        }

        remainingAmount -= adjustedAmount;
      }

    }
    await saveLocally(resonseId, isFromApi, resonseName);
    await VisitUpdateApi(selectedItems, amount, parseFloat(showAmout || 0))

    dispatch(showToast({
      message: 'Your Collection has been saved successfully.',
      type: 'success'
    }));

    // const resposeId = await CollectionApi(apiFetch, (msg) => dispatch(showToast(msg)), payload);
    // console.log('responseId : ', resposeId);

    // 🔁 Loop through selected items (whether from multi or single)

    setLoading(false)
    // Reset everything

    setAmount('');
    setIFSC('');
    setChequeNumber(Array(6).fill(''));
    setImageUri(null);
    setPaymentMode('Cash');
    setBank('');
    handleCollection()
  };

  // console.log('Payload Data : ',payloadData)

  const saveLocally = async (resonseId, isFromApi = false, resonseName) => {
    let selectedItems = [];

    if (selectedInvoice?.length && allInvoice?.length) {
      selectedItems = allInvoice.filter(inv => selectedInvoice.includes(inv.Sf_Id));
    } else if (data) {
      selectedItems = [data]; // fallback to single object
    }

    const customer__c = data?.Customer__c || selectedItems?.[0]?.Customer__c || 'N/A';

    // Save Collection__c record locally
    const collectionPayload = {
      Sf_Id: resonseId,
      Name: resonseName,
      Comment__c: 'N/A',
      DateOfPayment__c: today,
      PaidAmount__c: Number(amount),
      BankName__c: paymentMode === 'Cheque' ? bank : 'N/A',
      ChequeApproveDate__c: paymentMode === 'Cheque' ? today : null,
      ChequeNEFTDate__c: paymentMode === 'Cheque' ? today : null,
      Visit__c: selectedVisit?.sfId || 'N/A',
      ChequeNumber__c: paymentMode === 'Cheque' ? chequeNumber.join('') : 'N/A',
      Customer__c: customer__c,
      PaymentMode__c: paymentMode,
      CollectionType__c: selectedTab === "withInvoice" ? "With Invoice" : "Without Invoice",
      is_locally_changed: !isFromApi,
      operation_type: isFromApi ? null : "insert",
      last_modified: Date.now(),
      is_synced: isFromApi,
    };

    try {
      await UniversalUpdateInsert({
        ObjectName: 'Collection__c',
        Type: 'insert',
        data: collectionPayload,
      });

      console.log(`Inserted new record into [Collection__c]:`, collectionPayload);
    } catch (error) {
      console.error(' Failed to insert into Collection__c:', error);
    }

    // Sequential allocation for invoices
    let remainingAmount = Number(amount);

    for (const item of selectedItems) {
      if (remainingAmount <= 0) break;

      const outstanding = Number(item?.Outstanding_Amount__c) || 0;
      const adjustedAmount = Math.min(remainingAmount, outstanding);

      const allocationPayload = {
        Sf_Id: generateRandomOrderNumber(),
        Collection__c: resonseId,
        Invoice__c: item?.Sf_Id,
        AdjustedAmount__c: adjustedAmount,
        AllocationDate__c: today,
        is_locally_changed: !isFromApi,
        operation_type: isFromApi ? null : "insert",
        last_modified: Date.now(),
        is_synced: isFromApi,
      };

      try {
        await UniversalUpdateInsert({
          ObjectName: 'Collection_Allocation__c',
          Type: 'insert',
          data: allocationPayload,
        });

        console.log(`Inserted new record into [Collection_Allocation__c]:`, allocationPayload);
      } catch (error) {
        console.error(` Failed to insert into Collection_Allocation__c for invoice ${item?.Sf_Id}:`, error);
      }

      remainingAmount -= adjustedAmount;
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        statusBarTranslucent={false}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.backdrop}>
            <KeyboardAwareScrollView
              enableOnAndroid
              style={{ flex: 1, width: '100%' }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'flex-end', // keep sheet at bottom
                alignItems: 'stretch',
              }}
              // make this tiny on Android to avoid big blank space
              extraScrollHeight={Platform.OS === 'ios' ? 20 : 0}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalContainer}>
                <ScrollView
                  contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 10 : 6 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.header}>
                    <Text style={styles.headerText}>Collect Payment</Text>
                    <TouchableOpacity onPress={onClose}>
                      <Ionicons name="close" size={22} color="#000" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.outstandingBox}>
                    <Text style={styles.outstandingText}>
                      Current Outstanding: <Text style={styles.amountText}> ₹ {Number(showAmout).toLocaleString("en-IN")}</Text>
                    </Text>
                  </View>

                  <Text style={styles.label}>Payment Mode</Text>
                  <View style={styles.radioRow}>
                    {['Cash', 'Cheque'].map((mode) => (
                      <TouchableOpacity
                        key={mode}
                        style={styles.radioOption}
                        onPress={() => setPaymentMode(mode)}
                      >
                        <View style={styles.radioCircle}>
                          {paymentMode === mode && <View style={styles.radioDot} />}
                        </View>
                        <Text style={styles.radioLabel}>{mode}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {paymentMode === 'Cheque' && (
                    <>
                      <Text style={styles.label}>
                        Bank <Text style={{ color: 'red' }}>*</Text>
                      </Text>

                      <Dropdown
                        style={styles.input} // your existing TextInput style
                        containerStyle={styles.dropdownContainer}
                        data={bankData}
                        labelField="label"
                        valueField="value"
                        placeholder="Select Bank"
                        value={bank}
                        onChange={(item) => { setBank(item.value); if (bankError) setBankError(''); }}
                        placeholderStyle={{ color: '#888' }}
                        selectedTextStyle={{ color: '#000' }}
                        itemTextStyle={{ color: '#000' }}
                        activeColor="#F1EADB"
                      />
                      {bankError ? <Text style={styles.errorText}>{bankError}</Text> : null}

                      <Text style={styles.label}>IFSC Code <Text style={{ color: 'red' }}>*</Text></Text>
                      {/* <TextInput
                        style={styles.input}
                        placeholder="IFSC Code Here"
                        value={ifsc}
                        onChangeText={setIFSC}
                      /> */}

                      <TextInput
                        ref={ifscRef}
                        style={[styles.input, ifscError ? { borderColor: 'red' } : {}]}
                        placeholder="IFSC Code Here"
                        value={ifsc}
                        onChangeText={(text) => { setIFSC(text); if (ifscError) setIfscError(''); }}
                      />
                      {ifscError ? <Text style={styles.errorText}>{ifscError}</Text> : null}

                      <Text style={styles.label}>Cheque Number <Text style={{ color: 'red' }}>*</Text></Text>
                      <View style={styles.chequeRow}>
                        {chequeNumber.map((digit, index) => (
                          <TextInput
                            key={index}
                            ref={(ref) => (chequeInputRefs.current[index] = ref)}
                            style={[styles.chequeInput, chequeError ? { borderColor: 'red' } : {}]}
                            keyboardType="numeric"
                            maxLength={1}
                            value={digit}
                            onChangeText={(val) => {
                              handleChequeNumberChange(index, val);
                              if (chequeError) setChequeError('');
                            }}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                          />
                        ))}
                      </View>
                      {chequeError ? <Text style={styles.errorText}>{chequeError}</Text> : null}

                      <Text style={styles.label}>Enter Amount <Text style={{ color: 'red' }}>*</Text></Text>
                      <TextInput
                        style={[styles.input, amountError ? { borderColor: 'red' } : {}]}
                        keyboardType="decimal-pad"
                        placeholder="₹ Enter Amount"
                        value={getFormattedAmount(amount)}
                        onChangeText={handleAmountChange}
                      />
                      {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}

                      {amount ? (
                        <Text style={styles.inWordsText}>
                          (In Words) {toWords(Number(amount)).replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())} Rupees
                        </Text>
                      ) : (
                        <Text style={styles.inWordsText}>(In Words) Rupees</Text>
                      )}

                      <Text style={[styles.label, { marginTop: 12 }]}>
                        Capture Cheque (JPG, PNG)
                      </Text>
                      <View style={styles.uploadRow}>
                        <TouchableOpacity onPress={handleCameraOpen} style={styles.cameraButton}>
                          <Ionicons name="camera-outline" size={26} color="#666" />
                        </TouchableOpacity>
                        {imageUri && (
                          <View style={styles.imageContainer}>
                            <Image
                              source={{ uri: imageUri }}
                              style={styles.chequeImage}
                              resizeMode="cover"
                            />
                            <TouchableOpacity
                              style={styles.removeImageBtn}
                              onPress={() => setImageUri(null)}
                            >
                              <Text style={{ color: '#A67C2E', fontSize: 20 }}>x</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </>
                  )}

                  {paymentMode === 'Cash' && (
                    <>
                      <Text style={styles.label}>Enter Amount <Text style={{ color: 'red' }}>*</Text></Text>
                      <TextInput
                        style={[styles.input, amountError ? { borderColor: 'red' } : {}]}
                        keyboardType="decimal-pad"
                        placeholder="₹ Enter Amount"
                        value={getFormattedAmount(amount)}
                        onChangeText={handleAmountChange}
                      />
                      {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}

                      {amount ? (
                        <Text style={styles.inWordsText}>
                          (In Words) {toWords(Number(amount)).replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())} Rupees
                        </Text>
                      ) : (
                        <Text style={styles.inWordsText}>(In Words) Rupees</Text>
                      )}

                    </>
                  )}
                </ScrollView>

                {(data || (selectedInvoice && selectedInvoice.length > 0)) && (
                  <TouchableOpacity onPress={handleSubmit}>
                    <LinearGradient
                      colors={['#A67C2E', '#C9A24D']}
                      style={styles.submitBtn}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 14 }}>Submit</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </KeyboardAwareScrollView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <LoaderOverlay visible={loading} />
    </>
  );
};

export default CollectPaymentModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  // modalContainer: {
  //   backgroundColor: '#fff',
  //   borderTopLeftRadius: 20,
  //   borderTopRightRadius: 20,
  //   maxHeight: '90%',
  //   padding: 20,
  // },

  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%', // keeps sheet as bottom sheet
    padding: 20,
    // optional to ensure it stretches across width:
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 12,
  },
  outstandingBox: {
    borderWidth: 1,
    borderColor: '#D9D2C3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  outstandingText: {
    fontSize: 14,
    color: '#333',
  },
  amountText: {
    color: '#ED174F',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 12,
  },
  radioRow: {
    flexDirection: 'row',
    marginVertical: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#C9A24D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C9A24D',
  },
  radioLabel: {
    marginLeft: 6,
    fontSize: 14,
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D9D2C3',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginTop: 4,
  },
  dropdownContainer: {
    borderRadius: 6,
    marginTop: -28,
    backgroundColor: '#fff',
    elevation: 3, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  inWordsText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 20,
  },
  chequeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  chequeInput: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    textAlign: 'center',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  cameraButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  imageContainer: {
    position: 'relative',
  },
  chequeImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F1EADB',
    borderRadius: 10,
  },
  submitBtn: {
    height: 50,
    backgroundColor: '#4663FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 15,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4
  },

});
