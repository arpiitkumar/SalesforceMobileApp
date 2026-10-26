import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { showToast } from "../redux/slices/toastSlice.js";
import { isInternetAvailable } from "../utils/networkUtils";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import LoaderOverlay from "../utils/helper/LoaderOverlay";
import { RootState } from "../redux/store";
import { getUserAccessibleSubCategories } from '../UtilityMain/producthelpers/userLineService.js';
import HeaderMain from "../components/HeaderMain";



const SelectionScreen = ({ handlestock }) => {
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState(null);

  const [availability, setAvailability] = useState({}); // Persist all selections
  const [productsData, setProductsData] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const navigation = useNavigation();

  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);

  const dispatch = useDispatch();
  const { apiFetch } = useApiFetch();
  const [loading, setLoading] = useState(false);

  const hasSelection = Object.values(availability).some(
    (v) => v === "available" || v === "notAvailable"
  );

  const [users, setUsers] = useState([]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const result = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });
        setUsers(result);
      } catch (error) {
        console.error(" Get User Failed:", error);
      }
    };
    initialize();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const getProductsData = async () => {
        try {


          const loggedInUser = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });

          const beatdata = await UniversalUpdateInsert({
            ObjectName: "Beat__c",
            Type: "get",
            filters: [
              { field: "Sf_Id", value: selectedVisit?.Beat__c },
            ],
          });


          // console.log('...........................', loggedInUser[0].Sf_Id, beatdata[0]?.DirectDBSubDB__c)
          const accessibleSubCategories = await getUserAccessibleSubCategories(loggedInUser, null);
          console.log("dfd", accessibleSubCategories)



          const productData = await UniversalUpdateInsert({
            ObjectName: "Product2",
            Type: "get",
            filters: [
              { field: "SubCategory__c", operator: 'in', value: accessibleSubCategories },
            ],

          });
          // console.log('product data', productData)




          const activeProducts = productData.filter(
            (item) => item.Active_in_SFA__c === true
          );


          setProductsData(activeProducts);

          // const uniqueCategories = [
          //   ...new Set(activeProducts.map((item) => item.Category__c)),
          // ].map((cat) => ({ label: cat, value: cat }));

          const uniqueCategories = [
            ...new Set(activeProducts.map((item) => item.Category__c)),
          ].map((cat) => ({
            label: cat?.toLowerCase() === 'flour' ? 'Staples' : cat,
            value: cat,
          }));

          setCategories(uniqueCategories);
        } catch (error) {
          console.error(" Error fetching products:", error);
        }
      };
      getProductsData();
    }, [])
  );


  console.log('users[0]?.Sf_Id', users[0]?.Sf_Id)
  useEffect(() => {
    if (selectedCategory) {
      const relatedSubCats = productsData
        .filter((p) => p.Category__c === selectedCategory)
        .map((p) => p.SubCategory__c);

      const uniqueSubCats = [...new Set(relatedSubCats)].map((sub) => ({
        label: sub,
        value: sub,
      }));

      setSubCategories(uniqueSubCats);
      setSelectedSubCategory(null);
    }
  }, [selectedCategory, productsData]);

  useEffect(() => {
    let filtered = productsData;

    if (selectedCategory) {
      filtered = filtered.filter((p) => p.Category__c === selectedCategory);
    }
    if (selectedSubCategory) {
      filtered = filtered.filter((p) => p.SubCategory__c === selectedSubCategory);
    }

    setFilteredProducts(filtered);
  }, [selectedCategory, selectedSubCategory, productsData]);

  const updateAvailability = (productId, value) => {
    setAvailability((prev) => ({
      ...prev,
      [productId]: prev[productId] === value ? null : value,
    }));
  };

  // const handleSubmit = async () => {
  //   try {
  //     if (!hasSelection) {
  //       showToastvisible("warning", "Please select availability for at least one product.");
  //       return;
  //     }
  //     setLoading(true);
  //     const connected = await isInternetAvailable();
  //     let apiSuccess = false;
  //     let apiResponse = null;

  //     if (connected) {
  //       const result = await submitToApi();
  //       apiSuccess = result.success;
  //       apiResponse = result.response;
  //     }

  //     const localSuccess = await saveLocallyB(apiSuccess, apiResponse);

  //     if (localSuccess) {
  //       showToastvisible("success", "Stock saved successfully.");
  //       setTimeout(() => {
  //         handlestock();
  //         // navigation.goBack();
  //       }, 2000);
  //     }
  //   } catch (error) {
  //     console.error(" Visit error:", error);
  //     showToastvisible("error", "An error occurred.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const submitToApi = async () => {
  //   const selectedData = productsData // use all products
  //     .map((product) => {
  //       const status = availability[product.Sf_Id];
  //       if (status === "available" || status === "notAvailable") {
  //         return {
  //           attributes: { type: "Stock_Check__c" },
  //           Name: product.Name,
  //           Visit__c: selectedVisit.sfId,
  //           Account__c: selectedVisit.AccountId,
  //           SKU__c: product.Sf_Id,
  //           Available__c: status === "available",
  //           Not_Available__c: status === "notAvailable",
  //           Stock_Check_Date__c: new Date().toISOString(),
  //           Checked_By__c: users[0]?.Sf_Id,
  //           Persona__c: users[0]?.DeveloperName === "H_T_SO" ? "SO" : "SR",
  //         };
  //       }
  //       return null;
  //     })
  //     .filter((item) => item !== null);

  //   const payload = [
  //     {
  //       objectApiName: "Stock_Check__c",
  //       allOrNone: true,
  //       records: selectedData,
  //     },
  //   ];

  //   const response = await apiFetch("POST", "upload-records", payload, "Custom");
  //   const success = response.status === "success";
  //   return { success, response };
  // };


  const handleSubmit = async () => {
    try {
      if (!hasSelection) {
        showToastvisible(
          "warning",
          "Please select availability for at least one product."
        );
        return;
      }

      setLoading(true);

      const connected = await isInternetAvailable();

      let apiSuccess = false;
      let apiResponse = null;


      if (connected) {
        const result = await submitToApi();
        apiSuccess = result.success;
        apiResponse = result.response;
      }

      // ALWAYS run local insert
      const localSuccess = await saveLocallyB(apiSuccess, apiResponse);

      if (localSuccess) {
        showToastvisible(
          "success",
          apiSuccess
            ? "Stock synced successfully."
            : "Stock saved locally (will sync later)."
        );

        setTimeout(() => {
          handlestock();
        }, 1500);
      }
    } catch (error) {
      console.error(" Final Error:", error);

      await saveLocallyB(false, null);

      showToastvisible(
        "warning",
        "Saved locally due to network issue."
      );
    } finally {

      setLoading(false);
      setTimeout(() => {
        handlestock();
      }, 1500);
    }
  };

  const getISTISOString = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC +5:30
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().replace('Z', '+05:30');
  };

  const submitToApi = async () => {
    try {
      const selectedData = productsData
        .map((product) => {
          const status = availability[product.Sf_Id];
          if (status === "available" || status === "notAvailable") {
            return {
              attributes: { type: "Stock_Check__c" },
              Name: product.Name,
              Visit__c: selectedVisit.sfId,
              Account__c: selectedVisit.AccountId__c,
              SKU__c: product.Sf_Id,
              Available__c: status === "available",
              Not_Available__c: status === "notAvailable",
              // Stock_Check_Date__c: new Date().toISOString(),
              Stock_Check_Date__c: getISTISOString(),
              Checked_By__c: users[0]?.Sf_Id,
              Persona__c:
                users[0]?.DeveloperName === "H_T_SO" ? "SO" : "SR",
            };
          }
          return null;
        })
        .filter((item) => item !== null);

      const payload = [
        {
          objectApiName: "Stock_Check__c",
          allOrNone: true,
          records: selectedData,
        },
      ];

      console.log('payload', JSON.stringify(payload))
      const response = await apiFetch("POST", "upload-records", payload, "Custom");
      console.log('response', JSON.stringify(response))
      const success = response?.status === "success";

      return { success, response };
    } catch (error) {
      console.log(" API Failed (Handled):", error);


      return { success: false, response: null };
    }
  };
  const saveLocallyB = async (apiSuccess, apiResponse) => {
    const generateRandomOrderNumber = () => {
      const timestamp = Date.now();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      return `ORD-${timestamp}-${randomSuffix}`;
    };

    const selectedProducts = productsData.filter((product) => {
      const status = availability[product.Sf_Id];
      return status === "available" || status === "notAvailable";
    });

    const selectedData = selectedProducts.map((product, index) => {
      const status = availability[product.Sf_Id];

      const apiId =
        apiSuccess &&
        apiResponse?.data?.responseBody?.[0]?.results?.[index]?.id;

      return {
        Sf_Id: apiId || generateRandomOrderNumber(), // correct mapping
        Name: product.Name,
        Visit__c: selectedVisit.sfId,
        Account__c: selectedVisit.AccountId__c,
        SKU__c: product.Sf_Id,
        Available__c: status === "available",
        Not_Available__c: status === "notAvailable",
        // Stock_Check_Date__c: new Date().toISOString(),
        Stock_Check_Date__c: getISTISOString(),
        Checked_By__c: users[0]?.Sf_Id,
        Persona__c: users[0]?.DeveloperName === "H_T_SO" ? "SO" : "SR",

        // FIXED FLAGS
        is_locally_changed: !apiId,
        is_synced: !!apiId,

        last_modified: Date.now(),
        operation_type: "insert",
      };
    });
    console.log('selectedData', JSON.stringify(selectedData))
    return await UniversalUpdateInsert({
      ObjectName: "Stock_Check__c",
      Type: "insert",
      data: selectedData,
    });
  };
  //   const saveLocallyB = async (apiSuccess, apiResponse) => {
  //     const generateRandomOrderNumber = () => {
  //       const timestamp = Date.now();
  //       const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  //       return `ORD-${timestamp}-${randomSuffix}`;
  //     };

  //     let apiIds = {};
  //     if (apiSuccess && apiResponse?.data?.responseBody?.[0]?.results?.length) {
  //       apiResponse.data.responseBody[0].results.forEach((result) => {
  //         if (result.status === "success") {
  //           apiIds[result.index] = result.id;
  //         }
  //       });
  //     }

  //     const selectedData = productsData // all products, not just filtered
  //       .map((product) => {
  //         const status = availability[product.Sf_Id];
  //         if (status === "available" || status === "notAvailable") {
  //           return {
  //             Sf_Id: apiIds[product.Sf_Id] || generateRandomOrderNumber(),
  //             Name: product.Name,
  //             Visit__c: selectedVisit.sfId, 
  //             Account__c: selectedVisit.AccountId,
  //             SKU__c: product.Sf_Id,
  //             Available__c: status === "available",
  //             Not_Available__c: status === "notAvailable",
  //             Stock_Check_Date__c: new Date().toISOString(),
  //             Checked_By__c: users[0]?.Sf_Id,
  //             Persona__c: users[0]?.DeveloperName === "H_T_SO" ? "SO" : "SR",
  //             is_locally_changed: true,
  //             is_synced: !!apiIds[product.Sf_Id],
  //             last_modified: Date.now(),
  //             operation_type: "insert",
  //           };
  //         }
  //         return null;
  //       })
  //       .filter((item) => item !== null);
  // console.log('selectedData',JSON.stringify(selectedData))
  //     return await UniversalUpdateInsert({
  //       ObjectName: "Stock_Check__c",
  //       Type: "insert",
  //       data: selectedData,
  //     });
  //   };

  const showToastvisible = (type, message) => {
    dispatch(
      showToast({
        message,
        type,
      })
    );
  };

  const CustomRadio = ({ selected, onPress, label, color }) => (
    <TouchableOpacity onPress={onPress} style={styles.radioOption}>
      <View style={[styles.radioOuter, { borderColor: color }]}>
        {selected && (
          <View style={[styles.radioInner, { backgroundColor: color }]} />
        )}
      </View>
      <Text style={styles.radioText}>{label}</Text>
    </TouchableOpacity>
  );

  const clearCategory = () => {
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setSubCategories([]);
  };

  return (
    <SafeAreaProvider style={styles.wrapper}>


      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      {/* <View style={styles.headerContainer}>
        <HeaderMain screenName="Stock Check" />
      </View> */}
      <View
        style={{
          flex: 1,
          backgroundColor: "white",
          padding: 20,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
        }}
      >
        {/* Dropdowns */}
        <View style={styles.dropdownRow}>
          <View style={{ flex: 1 }}>
            <Dropdown
              data={categories}
              labelField="label"
              valueField="value"
              placeholder="Category"
              search
              searchPlaceholder="Search..."
              value={selectedCategory}
              onChange={(item) => setSelectedCategory(item.value)}
              style={styles.dropdown}
              containerStyle={styles.dropdownContainer}
              inputSearchStyle={styles.searchbox}
              placeholderStyle={styles.placeholderDropdown}
              selectedTextStyle={styles.valueDropdown}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Dropdown
              data={subCategories}
              labelField="label"
              valueField="value"
              placeholder="Sub Category"
              search
              searchPlaceholder="Search..."
              value={selectedSubCategory}
              onChange={(item) => setSelectedSubCategory(item.value)}
              style={styles.dropdown}
              containerStyle={styles.dropdownContainer}
              inputSearchStyle={styles.searchbox}
              placeholderStyle={styles.placeholderDropdown}
              selectedTextStyle={styles.valueDropdown}
            />
          </View>

          <TouchableOpacity onPress={clearCategory} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Product List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {filteredProducts.map((item, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.itemLabel}>{item.Name}</Text>
              <View style={styles.radioGroup}>
                <CustomRadio
                  selected={availability[item.Sf_Id] === "available"}
                  onPress={() => updateAvailability(item.Sf_Id, "available")}
                  label="Available"
                  color="#28a745"
                />
                <CustomRadio
                  selected={availability[item.Sf_Id] === "notAvailable"}
                  onPress={() => updateAvailability(item.Sf_Id, "notAvailable")}
                  label="Not Available"
                  color="#B3261E"
                />
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Submit Button */}
        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!hasSelection || loading}
          activeOpacity={0.8}
          style={{ width: "100%" }} // keep full width
        >
          {hasSelection && !loading ? (
            <LinearGradient
              colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
              style={styles.submitButton}
            >
              <Text style={styles.submitText}>Submit</Text>
            </LinearGradient>
          ) : (
            // disabled look
            <View style={[styles.submitButton, styles.submitButtonDisabled]}>
              <Text style={[styles.submitText, styles.submitTextDisabled]}>
                {loading ? "Submitting..." : "Submit"}
              </Text>
            </View>
          )}
        </TouchableOpacity>

      </View>

      <LoaderOverlay visible={loading} message={'Saving data...'} />
    </SafeAreaProvider>
  );
};

export default SelectionScreen;

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#C9A24D" },
  list: { paddingBottom: 100 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftColor: "#C9A24D",
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  radioGroup: { flexDirection: "row", alignItems: "center", gap: 20 },
  radioOption: { flexDirection: "row", alignItems: "center" },
  radioOuter: {
    height: 18,
    width: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  radioInner: { height: 10, width: 10, borderRadius: 5 },
  radioText: { fontSize: 14, color: "#555", marginRight: 10 },
  submitButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 5,
    marginHorizontal: 20,
    width: "100%",
    alignSelf: "center",
  },
  submitText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 15,
  },
  clearBtn: {
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: "#A67C2E",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -5,
  },
  clearText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  dropdown: {
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: "#FBF8F1",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 0.5,
    marginBottom: 10,
    marginTop: 4,
    color: "#000",
  },
  searchbox: {
    borderWidth: 0,
    backgroundColor: "transparent",
    fontSize: 14,
    paddingLeft: 4,
    borderBottomWidth: 0.2,
    borderColor: "gray",
    height: 40,
  },
  dropdownContainer: { borderRadius: 8, marginTop: -40, paddingVertical: 5 },
  placeholderDropdown: { color: "#7A7266", fontSize: 12 },
  valueDropdown: { color: "#1F1D1A", fontSize: 14 },
  submitButtonDisabled: {
    backgroundColor: "#B9C7E6", // muted blue/gray
    opacity: 0.9,
  },
  submitTextDisabled: {
    color: "#F1F6FB",
    fontWeight: "600",
  },
});