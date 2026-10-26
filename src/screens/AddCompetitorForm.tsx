import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Keyboard,
  StatusBar,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LoaderOverlay from "../utils/helper/LoaderOverlay";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import LinearGradient from 'react-native-linear-gradient';
import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../redux/slices/toastSlice';
import { isInternetAvailable } from '../utils/networkUtils';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import HeaderMain from "../components/HeaderMain";

// const CompetitorForm = ({ onAdded }) => {
const CompetitorForm = () => {

  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { apiFetch } = useApiFetch();
  const selectedVisit = useSelector((state) => state.selectedVisit);

  const generateRandomId = () => {
    const ts = Date.now();
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `HNTCP-${ts}-${rnd}`;
  };

  const generateRandomCode = () => {
    const number = Math.floor(1000 + Math.random() * 9000);
    return `HNTCP-${number}`;
  };

  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // 2026-02-16 format
  };

  const initialFormState = {
    Price_Zone__c: "",
    Oil_Type__c: "",
    Brand__c: "",
    Pack_Type__c: "POUCH",
    Grammage__c: "",
    Scheme__c: "",
    Others_To_Be_Field_By_HO__c: "",
    PTD__c: "",
    NPTD__c: "",
    PTR__c: "",
    NPTR__c: "",
    Remarks__c: "",
  };

  const [formData, setFormData] = useState(initialFormState);

  useFocusEffect(
    useCallback(() => {
      setFormData(initialFormState);
      setErrors({});
    }, [])
  );


  const numberFields = [
    "Scheme__c",
    "Others_To_Be_Field_By_HO__c",
    "PTD__c",
    "NPTD__c",
    "PTR__c",
    "NPTR__c",
  ];

  const [errors, setErrors] = useState({});

  const dropdownData = [];


  useEffect(() => {
    const initialize = async () => {
      const AllPicklistData = await UniversalUpdateInsert({ ObjectName: 'AllDataPicklist', Type: 'get' });
      let optionsObj = null;
      if (Array.isArray(AllPicklistData) && AllPicklistData.length) {
        const raw = AllPicklistData[0]?.OptionsData;
        if (raw) {
          try {
            optionsObj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          } catch (e) {
            console.warn('Failed to parse AllDataPicklist.OptionsData, falling back to defaults', e);
            optionsObj = null;
          }
        }
      }
      if (optionsObj?.PriceZoneValues) {
        console.log('PriceZoneValues', optionsObj.PriceZoneValues);
      }
      if (optionsObj?.OilTypeValues) {
        console.log('OilTypeValues', optionsObj.OilTypeValues);
      }
      if (optionsObj?.BrandVaues) {
        console.log('BrandVaues', optionsObj.BrandVaues);
      }
      if (optionsObj?.PackTypeValues) {
        console.log('PackTypeValues', optionsObj.PackTypeValues);
      }
      if (optionsObj?.GrammageValues) {
        console.log('GrammageValues', optionsObj.GrammageValues);
      }
    }
    initialize()
  }, [])


  const [priceZoneList, setPriceZoneList] = useState([]);
  const [oilTypeList, setOilTypeList] = useState([]);
  const [brandList, setBrandList] = useState([]);
  const [packTypeList, setPackTypeList] = useState([]);
  const [grammageList, setGrammageList] = useState([]);

  useEffect(() => {
    const initialize = async () => {
      const AllPicklistData = await UniversalUpdateInsert({
        ObjectName: 'AllDataPicklist',
        Type: 'get'
      });

      let optionsObj = null;

      if (Array.isArray(AllPicklistData) && AllPicklistData.length) {
        const raw = AllPicklistData[0]?.OptionsData;
        if (raw) {
          try {
            optionsObj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          } catch (e) {
            console.warn('Picklist parse error', e);
          }
        }
      }

      if (optionsObj) {
        setPriceZoneList(optionsObj.PriceZoneValues || []);
        setOilTypeList(optionsObj.OilTypeValues || []);
        setBrandList(optionsObj.BrandVaues || []);
        setPackTypeList(optionsObj.PackTypeValues || []);
        setGrammageList(optionsObj.GrammageValues || []);
      }
    };

    initialize();
  }, []);


  const validate = () => {
    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      if (!formData[key]) newErrors[key] = "This field is required";
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    // const formattedData = { ...formData };
    const formattedData = {
      ...formData,
      Date__c: getCurrentDate() 
    };
    numberFields.forEach((field) => {
      formattedData[field] = Number(formattedData[field]);
    });

    let recordId = generateRandomId();
    let randomName = generateRandomCode();
    let isFromApi = false;

    const localData = {
      Sf_Id: recordId,
      ...formattedData,
      last_modified: Date.now(),
    };


    try {
      const connected = await isInternetAvailable();
      if (connected) {

        const payload = {
          apiName: 'HNT_Competitor_Price__c',
          fields: formattedData,
        };
        // console.log('payload',JSON.stringify(payload))

        const response = await apiFetch('POST', 'records', payload, 'standard');

        if (response.status === 'success' && response.data?.id) {
          recordId = response.data.id;
          randomName = response.data.fields.Name.value;
          isFromApi = true;
        }
      }
    } catch (error) {
      dispatch(
        showToast({
          message: 'API error — saving locally',
          type: 'warning',
        })
      );
    } finally {

      await UniversalUpdateInsert({
        ObjectName: 'HNT_Competitor_Price__c',
        Type: 'insert',
        data: {
          ...localData,
          Sf_Id: recordId,
          Name: randomName,
          is_locally_changed: !isFromApi,
          is_synced: isFromApi,
          operation_type: isFromApi ? null : 'insert',
        },
      });

      setLoading(false);
      dispatch(showToast({ message: 'Saved Successfully', type: 'success' }));
      // onAdded?.();
      navigation.goBack();
    }
  };

  const renderDropdown = (label, field, data) => (
    <View style={styles.qCard}>
      <Text style={styles.label}>
        {label} <Text style={{ color: "red" }}>*</Text>
      </Text>

      <Dropdown
        style={styles.dropdown}
        containerStyle={styles.dropdownContainer}
        inputSearchStyle={styles.searchbox}
        placeholderStyle={styles.placeholderDropdown}
        selectedTextStyle={styles.valueDropdown}
        data={data}
        labelField="label"
        valueField="value"
        placeholder={`Select ${label}`}
        search
        searchPlaceholder="Search..."
        value={formData[field]}
        onChange={(item) =>
          setFormData({ ...formData, [field]: item.value })
        }
      />

      {errors[field] && (
        <Text style={styles.error}>{errors[field]}</Text>
      )}
    </View>
  );


  const renderNumberInput = (label, field) => (
    <View style={styles.qCard}>
      <Text style={styles.label}>
        {label} <Text style={{ color: "red" }}>*</Text>
      </Text>
      <TextInput
        style={styles.dropdown}
        keyboardType="decimal-pad"
        placeholder={`Enter ${label}`}
        value={formData[field]}
        onChangeText={(v) => {
          let cleaned = v.replace(/[^0-9.]/g, "");
          const parts = cleaned.split(".");
          if (parts.length > 2) {
            cleaned = parts[0] + "." + parts.slice(1).join("");
          }
          if (parts.length === 2 && parts[1].length > 2) {
            cleaned = parts[0] + "." + parts[1].slice(0, 2);
          }
          setFormData({
            ...formData,
            [field]: cleaned,
          });
        }}
      />
      {errors[field] && <Text style={styles.error}>{errors[field]}</Text>}
    </View>
  );

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      <View style={{ backgroundColor: "#A67C2E" }}>
        <HeaderMain screenName={'Competitor Pricing'} />
      </View>
      <View style={styles.mainContainer}>

        {loading && <LoaderOverlay visible={loading} message="Saving competitor pricing..." />}

        {!loading && (
          <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 200 }}>

            {renderDropdown("Price Zone", "Price_Zone__c", priceZoneList)}
            {renderDropdown("Oil Type", "Oil_Type__c", oilTypeList)}
            {renderDropdown("Brand", "Brand__c", brandList)}
            {renderDropdown("Pack Type", "Pack_Type__c", packTypeList)}
            {renderDropdown("Grammage", "Grammage__c", grammageList)}


            {renderNumberInput("Scheme", "Scheme__c")}
            {renderNumberInput("Others To Be Field By HO", "Others_To_Be_Field_By_HO__c")}
            {renderNumberInput("PTD", "PTD__c")}
            {renderNumberInput("NPTD", "NPTD__c")}
            {renderNumberInput("PTR", "PTR__c")}
            {renderNumberInput("NPTR", "NPTR__c")}

            <View style={styles.qCard}>
              <Text style={styles.label}>
                Remarks <Text style={{ color: "red" }}>*</Text>
              </Text>
              <TextInput
                style={[styles.dropdown, { height: 80 }]}
                multiline
                value={formData.Remarks__c}
                onChangeText={(v) =>
                  setFormData({ ...formData, Remarks__c: v })
                }
              />
              {errors.Remarks__c && <Text style={styles.error}>{errors.Remarks__c}</Text>}
            </View>

          </ScrollView>
        )}

        {!keyboardVisible && (
          <TouchableOpacity style={styles.footer} onPress={handleSubmit}>
            <LinearGradient
              colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
              style={styles.footerInner}
            >
              <Text style={styles.footerText}>Submit</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

      </View>
    </SafeAreaProvider>
  );
};

export default CompetitorForm;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#A67C2E" },
  mainContainer: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  loaderWrapper: { flex: 1, justifyContent: "center", alignItems: "center" },
  qCard: {
    backgroundColor: "#fff",
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    margin: 1,
    // iOS Shadow
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    // Android Shadow
    elevation: 4,
  },
  label: { fontSize: 12, color: "#000", marginBottom: 4, fontWeight: "500" },
  error: { color: "red", fontSize: 12, marginTop: 4 },
  dropdown: {
    height: 38,
    paddingHorizontal: 12,
    backgroundColor: "#FBF8F1",
    borderColor: "#BEBEBE",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 4,
    color: "#000",
  },
  dropdownContainer: { borderRadius: 8, marginTop: -40, paddingVertical: 5 },
  searchbox: {
    borderWidth: 0,
    backgroundColor: "transparent",
    fontSize: 14,
    paddingLeft: 4,
    borderBottomWidth: 0.2,
    borderColor: "gray",
    height: 40,
  },
  placeholderDropdown: { color: "#7A7266", fontSize: 14 },
  valueDropdown: { color: "#1F1D1A", fontSize: 14 },
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
  footerText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});