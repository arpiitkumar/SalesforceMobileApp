import React, { useState, useEffect } from "react";
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
import LoaderOverlay from "../utils/helper/LoaderOverlay"; // Your loader component
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import LinearGradient from 'react-native-linear-gradient';
import { useDispatch } from 'react-redux';
import { showToast } from '../redux/slices/toastSlice';
import { isInternetAvailable } from '../utils/networkUtils';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';

const CompetitorForm = ({ onCompetitorAdded }) => {
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const generateRandomId = () => {
    const ts = Date.now();
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `COMP-${ts}-${rnd}`;
  };

  function generateRandomCode() {
    const prefix = "CL";
    const number = Math.floor(1000 + Math.random() * 9000); // 1000–9999
    return `${prefix}-${number}`;
  }

  // Form state
  const [formData, setFormData] = useState({
    brand: "",
    oilType: "",
    sku: "",
    state: "",
    district: "",
    mop: "",
    ptd: "",
    remark: "",
  });

  const [errors, setErrors] = useState({});

  // Dropdown options
  const [brandList, setBrandList] = useState([]);
  const [oilTypes, setOilTypes] = useState([]);
  const [skuList, setSkuList] = useState([]);
  const [stateList, setStateList] = useState([]);
  const [districtList, setDistrictList] = useState([]);

  const selectedVisit = useSelector((state) => state.selectedVisit);
  // console.log("Selected Visit from Redux:", selectedVisit);
  const { apiFetch } = useApiFetch();
  const dispatch = useDispatch();
  const navigation = useNavigation();


  // Keyboard listener
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Validation
  const validate = () => {
    const newErrors = {};
    const requiredFields = {
      brand: "Brand",
      oilType: "Oil Type",
      sku: "SKU",
      state: "State",
      district: "District",
      mop: "MOP",
      ptd: "PTD",
    };

    Object.keys(requiredFields).forEach((field) => {
      if (!formData[field]) newErrors[field] = `${requiredFields[field]} is required`;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [formateDate, setFormateDate] = useState('');
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, "0");

    const formattedDate = `${year}-${month}-${day}`;
    setFormateDate(formattedDate);
  }, []);



  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    let recordId = generateRandomId();
    let randomName = generateRandomCode();
    let isFromApi = false;

    const localData = {
      Sf_Id: recordId,

      Competitor__c: formData.brand,
      Date__c: formateDate,
      OilType__c: formData.oilType,
      Product__c: formData.sku,
      State__c: formData.state,
      City__c: formData.district,
      Price_MT__c: Number(formData.mop),
      PTD__c: Number(formData.ptd),
      Remarks__c: formData.remark,
      Customer__c: selectedVisit.AccountId__c,
      last_modified: Date.now(), // always
    };

    try {
      const connected = await isInternetAvailable();
      if (connected) {
        const payload = {
          apiName: 'Competitor_LineItem__c',
          fields: {
            Competitor__c: formData.brand,
            Date__c: formateDate,
            OilType__c: formData.oilType,
            Product__c: formData.sku,
            State__c: formData.state,
            City__c: formData.district,
            Price_MT__c: Number(formData.mop),
            PTD__c: Number(formData.ptd),
            Remarks__c: formData.remark,
            Customer__c: selectedVisit.AccountId__c,
          },
        };

        const response = await apiFetch('POST', 'records', payload, 'standard');
        console.log('response.daatata.....................', JSON.stringify(response.data))
        if (response.status === 'success' && response.data?.id) {

          recordId = response.data.id;
          randomName = response.data.fields.Name.value;
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
        ObjectName: 'Competitor_LineItem__c',
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
      onCompetitorAdded();
      dispatch(
        showToast({ message: 'Competitor saved...', type: 'success' })
      );
      navigation.navigate('AccountDetailContainer');
    }
  };

  // Fetch initial dropdown data
  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // Brand
      const brands = await UniversalUpdateInsert({ ObjectName: "CompetitorMaster__c", Type: "get" });
      setBrandList(brands.map((b) => ({ label: b?.Name, value: b?.Sf_Id })));

      // Oil Type
      const oils = await UniversalUpdateInsert({ ObjectName: "Competitor__Product", Type: "get" });
      const uniqueOils = oils
        .map((i) => ({ label: i?.OilType__c, value: i?.OilType__c }))
        .filter((item, index, self) => index === self.findIndex((t) => t.value === item.value));
      setOilTypes(uniqueOils);

      // State
      const states = await UniversalUpdateInsert({ ObjectName: "Geography__c", Type: "get", filters: [{ field: "DeveloperName", value: "State" }] });
      setStateList(states.map((s) => ({ label: s?.Name, value: s?.Sf_Id })));
    } catch (err) {
      console.log("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch SKU when Oil Type changes
  useEffect(() => {
    const fetchSKU = async () => {
      if (!formData.oilType) return;
      try {
        const skus = await UniversalUpdateInsert({
          ObjectName: "Competitor__Product",
          Type: "get",
          filters: [{ field: "OilType__c", value: formData.oilType }],
        });
        setSkuList(skus.map((i) => ({ label: i?.Name, value: i?.Sf_Id })));
      } catch (err) {
        console.log("SKU Fetch Error:", err);
      }
    };
    fetchSKU();
  }, [formData.oilType]);

  // Fetch District when State changes
  useEffect(() => {
    const fetchDistrict = async () => {
      if (!formData.state) return;
      try {
        const districts = await UniversalUpdateInsert({
          ObjectName: "Geography__c",
          Type: "get",
          filters: [{ field: "ParentGeography__c", value: formData.state }],
        });
        setDistrictList(districts.map((i) => ({ label: i?.Name, value: i?.Sf_Id })));
      } catch (err) {
        console.log("District Fetch Error:", err);
      }
    };
    fetchDistrict();
  }, [formData.state]);

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      <View style={styles.mainContainer}>
        {loading && <LoaderOverlay visible={loading} />}

        {!loading && (
          <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 230 }}>
            {/* Brand */}
            <View style={styles.qCard}>
              <Text style={styles.label}>
                Brand <Text style={{ color: "red" }}>*</Text>
              </Text>
              <Dropdown
                style={styles.dropdown}
                containerStyle={styles.dropdownContainer}
                inputSearchStyle={styles.searchbox}
                placeholderStyle={styles.placeholderDropdown}
                selectedTextStyle={styles.valueDropdown}
                data={brandList}
                labelField="label"
                valueField="value"
                placeholder="Select Brand"
                search
                searchPlaceholder="Search..."
                value={formData.brand}
                onChange={(item) => setFormData({ ...formData, brand: item.value })}
              />
              {errors.brand && <Text style={styles.error}>{errors.brand}</Text>}
            </View>

            {/* Oil Type */}
            <View style={styles.qCard}>
              <Text style={styles.label}>
                Oil Type <Text style={{ color: "red" }}>*</Text>
              </Text>
              <Dropdown
                style={styles.dropdown}
                containerStyle={styles.dropdownContainer}
                inputSearchStyle={styles.searchbox}
                placeholderStyle={styles.placeholderDropdown}
                selectedTextStyle={styles.valueDropdown}
                data={oilTypes}
                labelField="label"
                valueField="value"
                placeholder="Select Oil Type"
                search
                searchPlaceholder="Search..."
                value={formData.oilType}
                onChange={(item) => setFormData({ ...formData, oilType: item.value, sku: "" })}
              />
              {errors.oilType && <Text style={styles.error}>{errors.oilType}</Text>}
            </View>

            {/* SKU */}
            <View style={styles.qCard}>
              <Text style={styles.label}>
                SKU <Text style={{ color: "red" }}>*</Text>
              </Text>
              <Dropdown
                style={styles.dropdown}
                containerStyle={styles.dropdownContainer}
                inputSearchStyle={styles.searchbox}
                placeholderStyle={styles.placeholderDropdown}
                selectedTextStyle={styles.valueDropdown}
                data={skuList}
                labelField="label"
                valueField="value"
                placeholder="Select SKU"
                search
                searchPlaceholder="Search..."
                value={formData.sku}
                onChange={(item) => setFormData({ ...formData, sku: item.value })}
              />
              {errors.sku && <Text style={styles.error}>{errors.sku}</Text>}
            </View>

            {/* State */}
            <View style={styles.qCard}>
              <Text style={styles.label}>
                State <Text style={{ color: "red" }}>*</Text>
              </Text>
              <Dropdown
                style={styles.dropdown}
                containerStyle={styles.dropdownContainer}
                inputSearchStyle={styles.searchbox}
                placeholderStyle={styles.placeholderDropdown}
                selectedTextStyle={styles.valueDropdown}
                data={stateList}
                labelField="label"
                valueField="value"
                placeholder="Select State"
                search
                searchPlaceholder="Search..."
                value={formData.state}
                onChange={(item) => setFormData({ ...formData, state: item.value, district: "" })}
              />
              {errors.state && <Text style={styles.error}>{errors.state}</Text>}
            </View>

            {/* District */}
            <View style={styles.qCard}>
              <Text style={styles.label}>
                District <Text style={{ color: "red" }}>*</Text>
              </Text>
              <Dropdown
                style={styles.dropdown}
                containerStyle={styles.dropdownContainer}
                inputSearchStyle={styles.searchbox}
                placeholderStyle={styles.placeholderDropdown}
                selectedTextStyle={styles.valueDropdown}
                data={districtList}
                labelField="label"
                valueField="value"
                placeholder="Select District"
                search
                searchPlaceholder="Search..."
                value={formData.district}
                onChange={(item) => setFormData({ ...formData, district: item.value })}
              />
              {errors.district && <Text style={styles.error}>{errors.district}</Text>}
            </View>

            {/* MOP */}
            <View style={styles.qCard}>
              <Text style={styles.label}>
                MOP <Text style={{ color: "red" }}>*</Text>
              </Text>
              <TextInput
                style={styles.dropdown}
                keyboardType="numeric"
                placeholder="Enter MOP"
                value={formData.mop}
                // onChangeText={(v) => setFormData({ ...formData, mop: v.replace(/[^0-9]/g, "") })}

                onChangeText={(v) => {
                  // Remove non-numeric characters
                  let numeric = v.replace(/[^0-9]/g, "");

                  // Prevent values like 0, 00, 000
                  if (numeric.startsWith("0")) {
                    numeric = numeric.replace(/^0+/, ""); // remove all leading zeros
                  }

                  setFormData({ ...formData, mop: numeric });
                }}
              />
              {errors.mop && <Text style={styles.error}>{errors.mop}</Text>}
            </View>

            {/* PTD */}
            <View style={styles.qCard}>
              <Text style={styles.label}>
                PTD <Text style={{ color: "red" }}>*</Text>
              </Text>

              <TextInput
                style={styles.dropdown}
                keyboardType="numeric"
                placeholder="Enter PTD"
                value={formData.ptd}
                onChangeText={(v) => {
                  // Keep only numbers
                  let numeric = v.replace(/[^0-9]/g, "");

                  // Remove leading zeros (prevents 0, 00, 000)
                  if (numeric.startsWith("0")) {
                    numeric = numeric.replace(/^0+/, "");
                  }

                  setFormData({ ...formData, ptd: numeric });
                }}
              />

              {errors.ptd && <Text style={styles.error}>{errors.ptd}</Text>}
            </View>


            {/* Remarks */}
            <View style={styles.qCard}>
              <Text style={styles.label}>Remarks</Text>
              <TextInput
                style={[styles.dropdown, { height: 90, textAlignVertical: "top" }]}
                multiline
                placeholder="Enter remarks"
                value={formData.remark}
                onChangeText={(v) => setFormData({ ...formData, remark: v })}
              />
            </View>
          </ScrollView>
        )}

        {!keyboardVisible && (
          <TouchableOpacity style={styles.footer} onPress={handleSubmit}>
            <LinearGradient
              colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
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