import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { Provider, RadioButton, Menu } from 'react-native-paper';
import { launchCamera } from 'react-native-image-picker';
import { toWords } from 'number-to-words';
import Invoice from '../assets/images/invoice.svg';
import File from '../assets/images/file-cancel-outline.svg';
import Receipt from '../assets/images/receipt.svg';
import ChaqueModel from '../components/modal/CollectModel';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { useFocusEffect } from '@react-navigation/native';
import { Dropdown } from 'react-native-element-dropdown';
import Ionicons from "../components/Ionicons";
import LinearGradient from 'react-native-linear-gradient';
import { useRef } from 'react';
import { Item } from 'react-native-paper/lib/typescript/components/Drawer/Drawer';
import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../redux/slices/toastSlice';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { CollectionApi } from '../utils/Collection/CollectionApi'
import { CollectionAllocationApi } from '../utils/Collection/CollectionAllocationApi'
import { isInternetAvailable } from '../utils/networkUtils';
import LoaderOverlay from '../utils/helper/LoaderOverlay'
import { SafeAreaProvider } from "react-native-safe-area-context";
import useVisitUpdateApi from '../utils/Collection/VisitUpdateApi';

const bankData = [
  { label: 'State Bank of India', value: 'SBI' },
  { label: 'HDFC Bank', value: 'HDFC' },
  { label: 'ICICI Bank', value: 'ICICI' },
  { label: 'Axis Bank', value: 'AXIS' },
  { label: 'Punjab National Bank', value: 'PNB' },
];


const CollectionScreen = ({ accountDetailId, handleCollection }) => {
  const chequeInputRefs = useRef([]);
  const [loading, setLoading] = useState(false)
  const [selectedTab, setSelectedTab] = useState('withInvoice');
  const [paymentMode, setPaymentMode] = useState('Cheque');
  const [bank, setBank] = useState('');
  // const [ifsc, setIfsc] = useState('');
  const [chequeNumber, setChequeNumber] = useState(Array(6).fill(''));
  const [amount, setAmount] = useState('');
  const [imageUri, setImageUri] = useState(null);
  // const [menuVisible, setMenuVisible] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [clickData, setClickData] = useState([]);
  const [dataInvoice, setDataInvoice] = useState([]);
  const [totalOutstanding, setTotalOutstanding] = useState('0')
  const [totalSelectedInvAmt, setTotalSelectedInvAmt] = useState('0');
  const [amountError, setAmountError] = useState('');
  const [ifsc, setIFSC] = useState('');
  const [isSelectMultiple, setIsSelectMultiple] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [selectCount, setSelectCount] = useState('0');
  const selectedVisit = useSelector(state => state.selectedVisit);
  const { apiFetch, apiComposite } = useApiFetch();
  const dispatch = useDispatch();
  const { VisitUpdateApi } = useVisitUpdateApi();



  const handleCaptureImage = () => {
    launchCamera({ mediaType: 'photo' }, response => {
      if (response?.assets && response.assets.length > 0) {
        setImageUri(response.assets[0].uri);
      }
    });
  };

  const removeImage = () => setImageUri(null);

  const invoiceData = new Array(6).fill({
    number: '#8765431',
    dueDate: '28/1/2025',
    days: '100',
    balance: '₹1500',
  });


  useFocusEffect(
    useCallback(() => {
      const getInvoiceData = async () => {
        try {

          const allInvoiceData = await UniversalUpdateInsert({
            ObjectName: 'Invoice__c',
            Type: 'get',
          });

          const matchedInvoices = allInvoiceData.filter(
            item =>
              item.Customer__c === accountDetailId &&
              (item.Status__c === 'Draft' || item.Status__c === 'Pending')
          );

          console.log('matchedInvoices', matchedInvoices);
          console.log(
            'allInvoiceData',
            matchedInvoices.map(i => ({
              Sf_Id: i.Sf_Id,
              Status__c: i.Status__c,
              Outstanding_Amount__c: i.Outstanding_Amount__c,
            }))
          );

          setDataInvoice(matchedInvoices || []);




          // Calculate total outstanding
          setTotalOutstanding(
            matchedInvoices.reduce((sum, item) => {
              return sum + (parseFloat(item.Outstanding_Amount__c) || 0);
            }, 0)
          );

          // console.log('Customer data : ', accountDetailId)
          // console.log('Geted : ', allInvoiceData)
          // console.log('Geted : ', matchedInvoices)
        } catch (error) {
          console.error('Error fetching invoice data:', error);
        }
      };

      getInvoiceData();
    }, [])
  );

  const handeCollect = (item) => {
    setClickData(item)
    setIsModalVisible(true)
  }


  const handleChequeNumberChange = (index, value) => {
    const updated = [...chequeNumber];
    updated[index] = value;
    setChequeNumber(updated);

    if (value && index < chequeNumber.length - 1) {
      // Move to next box
      chequeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (chequeNumber[index] === '' && index > 0) {
        chequeInputRefs.current[index - 1]?.focus();
      }
    }
  };


  const handleCameraOpen = async () => {
    const result = await launchCamera({ mediaType: 'photo' });
    if (result?.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
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
    setClickData([]);

    const connected = await isInternetAvailable();

    let resonseId = generateRandomOrderNumber();
    let resonseName = generateRandomName();
    let isFromApi = false;


    const enteredAmount = parseFloat(amount || 0);

    // Validation for "Without Invoice"
    if (selectedTab === 'withoutInvoice') {
      const currentOutstanding = parseFloat(totalOutstanding || 0);
      if (enteredAmount > 0 && enteredAmount <= currentOutstanding) {
        setAmountError('');
      } else {
        setAmountError('Entered amount must be greater than 0 and less than or equal to the current outstanding amount');
        return;
      }
    }

    const customer__c = dataInvoice?.[0]?.Customer__c || 'N/A';

    //  If "withoutInvoice", skip modal and directly submit
    if (selectedTab === 'withoutInvoice') {

      setLoading(true)
      const payload = {
        apiName: 'Collection__c',
        fields: {
          Comment__c: 'N/A',
          DateOfPayment__c: today,
          PaidAmount__c: amount,
          BankName__c: 'N/A',
          ChequeApproveDate__c: today,
          ChequeNEFTDate__c: today,
          Visit__c: selectedVisit?.sfId || 'N/A',
          ChequeNumber__c: 'N/A',
          Customer__c: customer__c,
          PaymentMode__c: paymentMode,
          CollectionType__c: selectedTab === 'withoutInvoice' ? 'Without Invoice' : 'With Invoice', // defaulting to With Invoice
        }
      };
      //  If payment mode is Cheque, overwrite cheque-related fields
      if (paymentMode === 'Cheque') {
        payload.fields.BankName__c = bank;
        payload.fields.ChequeNumber__c = chequeNumber.join('');
        payload.fields.ChequeApproveDate__c = today;
        payload.fields.ChequeNEFTDate__c = today;
      }
      //   // Direct submit logic here
      //      const respId =  await CollectionApi(apiFetch, (msg) => dispatch(showToast(msg)), payload);
      // //    console.log("rppp ",resp)
      if (connected) {
        const apiResponse = await CollectionApi(apiFetch, (msg) => dispatch(showToast(msg)), payload);
        const apiResponseId = apiResponse.id;
        const apiResponseName = apiResponse.name;
        if (!apiResponseId) return;

        resonseId = apiResponseId;
        resonseName = apiResponseName;
        isFromApi = true;

        let remainingAmount = parseFloat(amount) || 0;
        for (let i = 0; i < dataInvoice.length; i++) {
          const item = dataInvoice[i];
          if (remainingAmount <= 0) break; // amount finish, stop creating records

          const invoiceOutstanding = parseFloat(item?.Outstanding_Amount__c || 0);
          if (invoiceOutstanding <= 0) continue;

          // allocate min(remaining, outstanding)
          const allocationAmount = Math.min(remainingAmount, invoiceOutstanding);

          const allocationPayload = {
            apiName: 'Collection_Allocation__c',
            fields: {
              Collection__c: resonseId,
              Invoice__c: item?.Sf_Id,
              AdjustedAmount__c: allocationAmount,
              AllocationDate__c: today,
            },
          };

          try {
            await CollectionAllocationApi(
              apiFetch,
              (msg) => dispatch(showToast(msg)),
              allocationPayload
            );
            console.log(
              `Allocation successful for invoice ${item?.Sf_Id}, amount: ${allocationAmount}`
            );
          } catch (error) {
            console.error(
              ` Error allocating invoice ${item?.Sf_Id}:`,
              error
            );
          }

          // reduce remaining
          remainingAmount -= allocationAmount;
        }


      }
      await saveLocally(resonseId, isFromApi, resonseName);
      // await VisitUpdateApi(dataInvoice, amount, parseFloat(totalOutstanding || 0))
      setLoading(false)
      dispatch(showToast({
        message: 'Your Collection has been saved successfully.',
        type: 'success'
      }));
      handleCollection()

    }
    else {
      // Show modal for confirmation or other logic
      setIsModalVisible(true);
    }

    // Reset form
    setAmount('');
    setIFSC('');
    setChequeNumber(Array(6).fill(''));
    setImageUri(null);
    setPaymentMode('Cash');
    setBank('');

  };


  const saveLocally = async (resonseId, isFromApi = false, resonseName) => {
    const customer__c = dataInvoice?.[0]?.Customer__c || 'N/A';

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

    // Sequential allocation logic (like API)
    let remainingAmount = parseFloat(amount) || 0;

    try {
      for (let i = 0; i < dataInvoice.length; i++) {
        const item = dataInvoice[i];
        if (remainingAmount <= 0) break; // stop when paid amount exhausted

        const invoiceOutstanding = parseFloat(item?.Outstanding_Amount__c || 0);
        if (invoiceOutstanding <= 0) continue;

        // allocate min(remaining, outstanding)
        const allocationAmount = Math.min(remainingAmount, invoiceOutstanding);

        const allocationPayload = {
          Sf_Id: generateRandomOrderNumber(),
          Collection__c: resonseId,
          Invoice__c: item?.Sf_Id,
          AdjustedAmount__c: allocationAmount,
          AllocationDate__c: today,
          is_locally_changed: !isFromApi,
          operation_type: isFromApi ? null : "insert",
          last_modified: Date.now(),
          is_synced: isFromApi,
        };

        await UniversalUpdateInsert({
          ObjectName: 'Collection_Allocation__c',
          Type: 'insert',
          data: allocationPayload,
        });

        console.log(`Inserted into [Collection_Allocation__c]:`, allocationPayload);

        remainingAmount -= allocationAmount; // reduce remaining
      }
    } catch (error) {
      console.error(' Failed to insert some allocations:', error);
    }
  };



  const toggleInvoiceSelection = (item) => {
    // console.log('Selected Items : ',item)
    const isAlreadySelected = selectedInvoices.includes(item.Sf_Id);
    const updatedSelection = isAlreadySelected
      ? selectedInvoices.filter(Sf_Id => Sf_Id !== item.Sf_Id)
      : [...selectedInvoices, item.Sf_Id];

    setSelectedInvoices(updatedSelection);

    // Optional: Calculate total
    const selectedItems = dataInvoice.filter(inv => updatedSelection.includes(inv.Sf_Id));
    const total = selectedItems.reduce((sum, inv) => sum + Number(inv.Total_Net_Amount__c || 0), 0);
    setTotalSelectedInvAmt(total);
    setSelectCount(selectedItems.length);
    console.log("Selected:", selectedItems.length, "Total: ₹", total.toLocaleString("en-IN"));
  };

  // console.log('selected iv : ',selectedInvoices)
  // Function to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateObj = new Date(dateStr);
    const day = dateObj.getDate();
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    return `${day} ${month} ${year}`;
  };


  return (
    <SafeAreaProvider style={styles.wrapper}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10, }}>
        <View style={styles.outstandingContainer}>
          <Text style={styles.outstandingLabel}>Current Outstanding:</Text>
          <Text style={styles.outstandingAmount}> ₹ {Number(totalOutstanding).toLocaleString("en-IN")}</Text>

        </View>

        {/* <Text style={styles.collectionLabel}>Select Collection Method</Text>
 
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, selectedTab === 'withInvoice' && styles.activeTab]}
            onPress={() => { setSelectedTab('withInvoice') }}>
            <Receipt width={24} height={24} />
            <Text style={selectedTab === 'withInvoice' ? styles.activeText : styles.inactiveText}>
              <Text style={styles.tabLabel}>With Invoice</Text>
            </Text>
          </TouchableOpacity>
 
          <TouchableOpacity
            style={[styles.tabButton, selectedTab === 'withoutInvoice' && styles.activeTab]}
            onPress={() => { setSelectedTab('withoutInvoice'), setIsSelectMultiple(false) }}>
            <File width={18} height={18} />
            <Text style={selectedTab === 'withoutInvoice' ? styles.activeText : styles.inactiveText}>
              <Text style={styles.tabLabel}>Without Invoice</Text>
            </Text>
          </TouchableOpacity>
        </View> */}


        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={[styles.selectText, { color: '#7A7266' }]}>Total Invoice ({dataInvoice.length})</Text>
          {/* {selectedTab === "withInvoice" &&
            <TouchableOpacity onPress={() => {
              setIsSelectMultiple(!isSelectMultiple);
              setSelectedInvoices([]);
              setSelectCount('0')
              setTotalSelectedInvAmt('0')
            }}>
 
              <Text style={[styles.selectText, isSelectMultiple && styles.selectedText]}>
                {isSelectMultiple ? `Selected Invoice : ${selectCount}` : 'Select Multiple'}
              </Text>
            </TouchableOpacity>
          } */}
        </View>


        {selectedTab === 'withInvoice' && (
          <View style={{ flex: 1 }}>
            {dataInvoice.map((item, index) => {
              const invoiceDate = new Date(item.InvoiceDate__c);
              const today = new Date();
              const diffTime = today - invoiceDate;
              const dueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              return (
                <View key={index} style={styles.invoiceCard}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>

                      {isSelectMultiple && (
                        <TouchableOpacity onPress={() => toggleInvoiceSelection(item)}>
                          <View style={styles.radioCircle}>
                            {selectedInvoices.includes(item.Sf_Id) && <View style={styles.radioDot} />}
                          </View>
                        </TouchableOpacity>
                      )}

                      <Invoice width={18} height={18} />
                      <Text style={styles.invoiceNumber}>Invoice {item.Name}</Text>
                    </View>
                    <View style={styles.invoiceDetails}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Due Date</Text>
                        <Text style={styles.detailValue}>
                          {formatDate(item.InvoiceDate__c)}
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Days</Text>
                        <Text style={styles.detailValue}>{dueDays} days</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Balance</Text>
                        <Text style={styles.detailValue}>₹{Number(item.Outstanding_Amount__c).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.collectButton}
                    onPress={() => handeCollect(item)}
                  >
                    <Text style={styles.collectText}>Collect</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}


        {selectedTab === 'withoutInvoice' && (
          <>
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
                  onChange={(item) => setBank(item.value)}
                  placeholderStyle={{ color: '#888' }}
                  selectedTextStyle={{ color: '#000' }}
                  itemTextStyle={{ color: '#000' }}
                  activeColor="#F1EADB"
                />

                <Text style={styles.label}>IFSC Code <Text style={{ color: 'red' }}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="IFSC Code Here"
                  value={ifsc}
                  onChangeText={setIFSC}
                />

                <Text style={styles.label}>Cheque Number <Text style={{ color: 'red' }}>*</Text></Text>
                <View style={styles.chequeRow}>
                  {chequeNumber.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => (chequeInputRefs.current[index] = ref)}
                      style={styles.chequeInput}
                      keyboardType="numeric"
                      maxLength={1}
                      value={digit}
                      onChangeText={(val) => handleChequeNumberChange(index, val)}
                      onKeyPress={(e) => handleKeyPress(e, index)} // 👈 handle backspace
                    />
                  ))}
                </View>


                <Text style={styles.label}>Enter Amount <Text style={{ color: 'red' }}>*</Text></Text>
                <TextInput
                  style={[styles.input, amountError ? { borderColor: 'red' } : {}]}
                  keyboardType="numeric"
                  placeholder="₹ Enter Amount"
                  value={amount ? Number(amount).toLocaleString("en-IN") : ''}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setAmount(numericValue);
                    if (amountError) setAmountError(''); // Clear error on change
                  }}
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
                  keyboardType="numeric"
                  placeholder="₹ Enter Amount"
                  value={amount ? Number(amount).toLocaleString("en-IN") : ''}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setAmount(numericValue);
                    if (amountError) setAmountError(''); // Clear error on change
                  }}
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
            {/* <Text>Upload Cheque (JPG, PNG, PDF)</Text>
            <View style={styles.uploadRow}>
              {!imageUri ? (
                <TouchableOpacity onPress={handleCaptureImage} style={styles.uploadBox}>
                  <Text>📷</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ position: 'relative' }}>
                  <Image
                    source={{ uri: imageUri }}
                    style={{ width: 80, height: 80, borderRadius: 8 }}
                  />
                  <TouchableOpacity onPress={removeImage} style={styles.removeButton}>
                    <Text style={{ color: '#fff' }}>X</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View> */}

          </>
        )}


      </ScrollView>

      {(selectedTab === 'withoutInvoice' && dataInvoice.length > 0 || (selectedTab === 'withInvoice' && isSelectMultiple && dataInvoice.length > 0)) && (
        <>
          <TouchableOpacity style={{}} onPress={handleSubmit}>
            <LinearGradient
              colors={['#A67C2E', '#C9A24D']}
              style={styles.submitBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isSelectMultiple ? (
                <Text style={{ color: '#fff' }}>{`Submit ( Total: ₹ ${totalSelectedInvAmt.toLocaleString("en-IN")} )`}</Text>
              ) : (
                <Text style={{ color: '#fff' }}>Submit</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}


      <ChaqueModel visible={isModalVisible} onClose={() => setIsModalVisible(false)} data={clickData} selectedTab={selectedTab} selectedInvoice={selectedInvoices} allInvoice={dataInvoice} handleCollection={handleCollection} />

      <LoaderOverlay visible={loading} />

    </SafeAreaProvider>
  );
}
export default CollectionScreen;

const styles = StyleSheet.create({
  dropdownContainer: {
    borderRadius: 6,
    marginTop: -28,
    backgroundColor: '#fff',
    elevation: 3, // shadow for Android
    shadowColor: '#000', // shadow for iOS
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
  inWordsText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 20,
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
    marginBottom: 20
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
  container: {
    flex: 1,
    padding: 16,
    //paddingBottom: 400
  },
  outstandingContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D9D2C3',
  },
  outstandingLabel: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  outstandingAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ED174F',
  },
  collectionLabel: {
    color: '#7A7266',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10
  },
  wrapper: {
    flex: 1,
    // backgroundColor: "#C9A24D",
  },
  tabButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    // marginHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#F1EADB',
    borderColor: '#C9A24D',
  },
  activeText: {
    color: '#A67C2E',
  },
  inactiveText: {
    color: '#888',
  },
  tabLabel: {
    color: 'black',
    fontWeight: '400',
    fontSize: 12,
  },
  selectText: {
    fontWeight: '400',
    fontSize: 12,
    marginBottom: 10,
    color: '#A67C2E'

  },
  selectedText: {
    fontWeight: '400',
    fontSize: 12,
    marginBottom: 10,
    color: '#ED174F'
  },
  invoiceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  invoiceNumber: {
    fontWeight: '500',
    color: '#000',
  },
  invoiceDetails: {
    flexDirection: 'row',
    gap: 20,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000',
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontWeight: '400'
  },
  collectButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 28,
    backgroundColor: '#F1EADB',
  },
  collectText: {
    color: '#A67C2E',
    fontWeight: '400',
    fontSize: 12,
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
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    marginVertical: 10,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 10,
  },
  submitBtn: {
    height: 70,
    backgroundColor: '#4663FF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 12,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: -2,
    marginBottom: 4
  },
});