import React, { useEffect, useState } from 'react';
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
  Keyboard
} from 'react-native';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from "react-native-responsive-screen";
import HeaderMain from '../components/HeaderMain';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useDispatch } from 'react-redux';
import { showToast } from '../redux/slices/toastSlice';
import { isInternetAvailable } from '../utils/networkUtils';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import LoaderOverlay from '../utils/helper/LoaderOverlay';

const generateRandomId = () => {
  const ts = Date.now();
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `COMP-${ts}-${rnd}`;
};

const CompetitorForm = ({ onCompetitorAdded }) => {
  const [beatDays, setBeatDays] = useState([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const { apiFetch } = useApiFetch();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    areaTown: '',
    competitorBrand: '',
    productName: '',
    packSize: '',
    PTC: '',
    PTR: '',
    PTD: '',
    notes: '',
    visit: '',
    beatDay: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const selectedVisit = useSelector((state) => state.selectedVisit);

  useEffect(() => {
    const loadTodayBeat = async () => {
      try {
        // format today as YYYY-MM-DD
        const today = new Date().toISOString().slice(0, 10);
        // fetch only today's beat day record from local DB
        const records = await UniversalUpdateInsert({
          ObjectName: 'BeatDay__c',
          Type: 'get',
          filters: [{ field: 'BeatDate__c', value: today }],
        });
        console.log('TODAY BEATTTTT', records);
        if (records.length > 0 && records[0].Sf_Id) {
          // auto-fill formData.beatDay with the SFID
          setFormData((f) => ({ ...f, beatDay: records[0].Sf_Id }));
        } else {
          dispatch(
            showToast({
              message: 'No beat record for today – please select manually',
              type: 'warning',
            })
          );
        }
      } catch (err) {
        console.error('Error loading today\'s beat:', err);
        dispatch(
          showToast({
            message: 'Failed to load today\'s beat',
            type: 'error',
          })
        );
      }
    };

    loadTodayBeat();
  }, [dispatch]);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);


  const fields = [
    { key: 'areaTown', label: 'Area/Town' },
    { key: 'competitorBrand', label: 'Competitor Brand' },
    { key: 'productName', label: 'Product Name' },
    { key: 'packSize', label: 'Pack Size' },
    { key: 'PTC', label: 'PTC' },
    { key: 'PTR', label: 'PTR' },
    { key: 'PTD', label: 'PTD' },
    { key: 'notes', label: 'Notes' },
  ];

  const validate = () => {
    const newErrors = {};
    fields.forEach(({ key, label }) => {
      if (!formData[key]?.trim()) {
        newErrors[key] = `${label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    let recordId = generateRandomId();
    let isFromApi = false;

    const localData = {
      Sf_Id: recordId,
      AreaTown__c: formData.areaTown,
      CompetitorBrand__c: formData.competitorBrand,
      ProductName__c: formData.productName,
      PackSize__c: formData.packSize,
      PTC__c: formData.PTC,
      PTR__c: formData.PTR,
      PTD__c: formData.PTD,
      Notes__c: formData.notes,
      BeatDay__c: formData.beatDay,
      Visit__c: selectedVisit.sfId,
      last_modified: Date.now(), // always
    };

    try {
      const connected = await isInternetAvailable();
      if (connected) {
        const payload = {
          apiName: 'Competitor__c',
          fields: {
            AreaTown__c: formData.areaTown,
            CompetitorBrand__c: formData.competitorBrand,
            ProductName__c: formData.productName,
            PackSize__c: formData.packSize,
            PTC__c: formData.PTC,
            PTR__c: formData.PTR,
            PTD__c: formData.PTD,
            Notes__c: formData.notes,
            Visit__c: selectedVisit.sfId,
          },
        };

        const response = await apiFetch('POST', 'records', payload, 'standard');
        if (response.status === 'success' && response.data?.id) {
          recordId = response.data.id;
          isFromApi = true;
        }
      }
    } catch (error) {
      console.error('API error, will still save locally:', error);
      dispatch(
        showToast({
          message: 'API error — saving locally',
          type: 'warning',
        })
      );
    } finally {
      console.log('LOCAL DATA TO SAVE---', localData, recordId, isFromApi);
      // Always store locally regardless of API success
      await UniversalUpdateInsert({
        ObjectName: 'Competitor__c',
        Type: 'insert',
        data: {
          ...localData,
          Sf_Id: recordId,
          is_locally_changed: !isFromApi,
          is_synced: isFromApi,
          operation_type: isFromApi ? null : 'insert',
        },
      });

      setLoading(false);
      onCompetitorAdded();
      dispatch(
        showToast({ message: 'Competitor saved...', type: 'success' })
      );
      navigation.navigate('AccountDetailContainer');
    }
  };

  return (
    <>
      <SafeAreaProvider style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />


        <View style={{
          flex: 1,
          backgroundColor: 'white',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 10
        }}>
          {loading && (
            <View style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center"
            }}>
              <LoaderOverlay visible={loading} />
            </View>
          )}

          {!loading && (
            <ScrollView
              style={{ padding: 15 }}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {fields.map(({ key, label }) => (
                <View key={key} style={styles.qCard}>
                  <View style={{ flexDirection: 'row' }}>

                    <Text style={styles.label}>{label}</Text>
                    <Text style={{ color: 'red', marginLeft: 2 }}>*</Text>
                  </View>


                  <TextInput
                    style={[styles.container, { padding: 8 }]}
                    value={formData[key]}
                    onChangeText={(val) => handleChange(key, val)}
                    placeholder={`Enter ${label}`}
                    placeholderTextColor="#999"
                  />
                  {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
                </View>
              ))}
            </ScrollView>
          )}

          {!keyboardVisible && (
            <TouchableOpacity
              style={styles.footer}
              onPress={() => {
                handleSubmit();
              }}
            >
              <LinearGradient
                colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.footerInner}
              >
                <Text style={styles.footerText}>
                  {loading ? 'Saving...' : 'Save'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaProvider>
    </>
  );
};

export default CompetitorForm;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#A67C2E',
  },
  headerContainer: {
    backgroundColor: '#A67C2E',
  },
  container: {
    width: "100%",
    alignSelf: "center",
    borderColor: "#BEBEBE",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#fff",
    height: 38,
    justifyContent: "center",
  },
  qCard: {
    backgroundColor: "#fff",
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    margin: 1,
  },
  label: {
    fontSize: 12,
    color: "#000",
    marginBottom: 4,
    fontWeight: "500",
  },
  error: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    marginHorizontal: 15,
    left: 0,
    right: 0,
    height: 50,
  },
  footerInner: {
    flex: 1,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
});