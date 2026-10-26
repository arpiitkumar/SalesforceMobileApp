import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  Modal,
} from "react-native";
import Ionicons from "../components/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { Gradients } from "../assets/css/MasterCss.js";
import Plus from "../assets/images/Plus.svg";
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert'
import { useDispatch } from "react-redux";
import { isInternetAvailable } from '../utils/networkUtils';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { showToast } from '../redux/slices/toastSlice';
import { PriceBookId_var } from '../../config'
import { UNITS_PER_CASE } from "../utils/helper/caseUnits";

const categories = ["Must Sell Products", "Product Catalogue", "Offers & Promotions"];
const reasons = ["Shortage", "Not Selling", "Damage/Leakage"];

const baseProducts = [
  {
    id: "1",
    name: "Shahi Garam Masala 25 g",
    price: 39.13,
    image: require("../assets/images/food.png"),
  },
];

export default function TakeOrder({ visible, onClose }) {
  const { apiFetch } = useApiFetch();
  const dispatch = useDispatch()
  const selectedBeatDay = useSelector((state: RootState) => state.selectedBeatDay.selectedBeatDay);
  const [productData, setProductData] = useState([])
  const selectedAccount = useSelector((state: RootState) => state.selectedAccount.selectedAccount);
  const selectedVisit = useSelector(state => state.selectedVisit);
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])

  // console.log("THIS IS SELECTED BEAT DATY++++++++", selectedBeatDay)


  const [productInstances, setProductInstances] = useState(
    baseProducts.map((p) => ({
      ...p,
      instanceId: `${p.id}-0`,
      baseId: p.id,
      quantity: 0,
      reason: null,
      unitMode: "Case",
      unitPerCase: p.unitPerCase,
    }))
  );
  const computeTotalReturnQty = () => {
    return productInstances.reduce((sum, inst) => {
      const qty = inst.quantity || 0;
      return sum + (inst.unitMode === "Case"
        ? qty * inst.unitPerCase
        : qty);
    }, 0);
  };




  const submitToApi = async () => {




    const payload = {

      apiName: 'Order',
      fields: {
        Type: 'Secondary',
        //Beat__c: selectedBeatDay.Beat__c,
        //OrderNumber: randomId,
        AccountId: selectedAccount.Sf_Id,
        ReturnDate__c: new Date().toISOString(),
        EffectiveDate: new Date().toISOString(),
        OrderPlacedBy__c: users[0].Sf_Id,
        TotalReturnQuantity__c: computeTotalReturnQty(), //make it dynamic
        Source__c: 'App',
        OrderSubmissionTime__c: new Date().toISOString(),
        TypeOfReturn__c: "Secondary Return",
        Pricebook2Id: PriceBookId_var,
        Visit__c: selectedVisit.sfId,
        Status: "Draft",
        Return_Category__c: 'Without Invoice'
      }
    };




    console.log("THISIS NEW PAYLOAD =============", payload, "THISIS NEW PAYLOAD")


    const response = await apiFetch('POST', 'records', payload, 'standard');

    console.log("THIS IS THE RESPONSE THAT I AM GETTING FROM THE APIII", JSON.stringify(response))


    // console.log("THIS IS THE RESPONSE THAT I AM GETTING FROM THE APIII",JSON.stringify(response.data.fields.OrderNumber.value))
    if (response.status === 'success') {

      const serverOrderNumber = response?.data?.id;

      dispatch(showToast({ message: 'Spot Sales Submitted Successfully (ONLINE)', type: 'success' }));
      return serverOrderNumber;
    } else {
      dispatch(showToast({ message: 'Spot Sales Submission Failed (ONLINE)', type: 'error' }));

      return false;
    }
  };



  const submitOrderItemsToApi = async (orderId, items) => {


    // 1. Filter only instances the user actually filled out:
    const validItems = items.filter(
      (i) => i.quantity > 0 && i.reason
    );
    //console.log("THIS IS THE ITEMS SSS+++", validItems)

    for (const inst of validItems) {
      // 2. Compute case‑vs‑unit fields
      const isCase = inst.unitMode === "Case";
      const orderQtyInCase = isCase ? inst.quantity : 0;
      const uom = isCase ? "Box" : "Pc";      // or "KG" if you ever support weights

      // 3. Build payload for each return‑item
      const itemPayload = {
        apiName: "OrderItem",
        fields: {
          OrderId: orderId,

          PricebookEntryId: inst.priceBookId,
          Product2Id: inst.id,            // your Salesforce product Id
          Quantity: inst.quantity,
          OrderQtyInCase__c: orderQtyInCase,
          UOM__c: uom,
          // ReasonforSRN__c: inst.reason,         // custom field for your return‑reason
          GrossAmount__c: (inst.price || 0) * inst.quantity,
          UnitPrice: inst.price,
        },
      };


      const resp = await apiFetch("POST", "records", itemPayload, "standard");

      //console.log('response for order item hit =====', resp)
      if (resp.status !== "success") {
        console.error(" Failed to push OrderItem:", resp);
        dispatch(
          showToast({
            message: `Failed to add return item for ${inst.name}`,
            type: "error",
          })
        );
        // you could break or continue based on your desired error policy
      }
    }
  };


  const saveLocally = async (orderId, isFromApi = false) => {


    // 1️⃣ Build & save the Order record locally
    const orderPayload = {
      ObjectName: "Order",
      Type: "insert",
      data: {
        Sf_Id: orderId,
        Beat__c: selectedBeatDay.Beat__c,
        Type: "Secondary",
        AccountId: selectedAccount.Sf_Id,
        ReturnDate__c: new Date().toISOString(),
        EffectiveDate: new Date().toISOString(),
        OrderPlacedBy__c: users[0].Sf_Id,
        TotalReturnQuantity__c: computeTotalReturnQty(),
        Source__c: "App",
        OrderSubmissionTime__c: new Date().toISOString(),
        TypeOfReturn__c: "Secondary Return",
        Pricebook2Id: PriceBookId_var,
        Visit__c: selectedVisit.sfId,
        Status: "Draft",
        Return_Category__c: "Without Invoice",

        // these fields control your local sync state:
        is_locally_changed: !isFromApi,
        operation_type: isFromApi ? null : "insert",
        last_modified: Date.now(),
        is_synced: isFromApi,
      },
    };

    await UniversalUpdateInsert(orderPayload);

    // 2️⃣ Loop through each filled‑out instance and save as OrderItem locally
    const validItems = productInstances.filter((i) => i.quantity > 0 && i.reason);

    for (const inst of validItems) {
      const isCase = inst.unitMode === "Case";
      const orderQtyInCase = isCase ? inst.quantity : 0;
      const uom = isCase ? "Box" : "Pc";

      const itemPayload = {
        ObjectName: "OrderItem",
        Type: "insert",
        data: {
          Sf_Id: `LI-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          // local‑only id, prefix so it doesn’t conflict with real ones
          OrderId: orderId,
          Product2Id: inst.id,
          PricebookEntryId: inst.priceBookId,
          Quantity: inst.quantity,
          OrderQtyInCase__c: orderQtyInCase,
          UOM__c: uom,
          GrossAmount__c: (inst.price || 0) * inst.quantity,
          UnitPrice: inst.price,
          ReasonforSRN__c: inst.reason,

          // sync‑tracking fields
          is_locally_changed: !isFromApi,
          operation_type: isFromApi ? null : "insert",
          last_modified: Date.now(),
          is_synced: isFromApi,
        },
      };

      await UniversalUpdateInsert(itemPayload);
    }

    // 3️⃣ Show a toast so the user knows it’s saved locally
    dispatch(
      showToast({
        message: isFromApi
          ? "Spot Sales + items synced from server"
          : "Spot Sales + items saved locally",
        type: "success",
      })
    );
  };




  const handleOrderSubmit = async () => {
    // 0️⃣ Check that at least one instance has qty > 0
    const hasAny = productInstances.some(inst => inst.quantity > 0);
    if (!hasAny) {
      dispatch(showToast({
        message: "Please add at least one return line with quantity before submitting.",
        type: "warning"
      }));
      return;
    }



    // if (cartItems.length === 0) {
    //   dispatch(showToast({ message: 'You do not have any items in the cart.', type: 'warning' }));
    //   return;
    // }

    const generateRandomOrderNumber = () => {
      const timestamp = Date.now(); // current time in ms
      const randomSuffix = Math.floor(1000 + Math.random() * 9000); // random 4-digit number
      return `ORD-${timestamp}-${randomSuffix}`;
    };

    try {
      setLoading(true);
      const connected = await isInternetAvailable();

      let orderId = generateRandomOrderNumber();
      let isFromApi = false;

      if (connected) {
        const orderIdFromApi = await submitToApi();
        if (!orderIdFromApi) return;

        orderId = orderIdFromApi;
        isFromApi = true;

        await submitOrderItemsToApi(orderId, productInstances);
      }

      await saveLocally(orderId, isFromApi);

      dispatch(showToast({
        message: 'Your spot sales have been placed successfully.',
        type: 'success'
      }));






      //   navigation.navigate('AccountDetailContainer')
    } catch (error) {
      console.error(' Order error:', error);
    } finally {
      setLoading(false);
      //navigation.navigate('AccountDetailContainer')
    }
  };


  useEffect(() => {
    const getData = async () => {
      try {
        const result = await UniversalUpdateInsert({
          ObjectName: 'Product2',
          Type: 'get',
        });
        const user = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });

        setUsers(user)
        const transformedProducts = result.map((p, index) => ({
          id: p.Sf_Id,
          name: p.Name,
          price: Number(p.PTR__c) || 0,
          priceBookId: p.PriceBookId,
          image: p.ProductImageURL__c
            ? { uri: p.ProductImageURL__c }
            : require("../assets/images/food.png"),
          unitPerCase: UNITS_PER_CASE,
        }));

        setProductData(transformedProducts);

        // Initialize productInstances
        const initialInstances = transformedProducts.map((p) => ({
          ...p,
          instanceId: `${p.id}-0`,
          baseId: p.id,
          quantity: 0,
          reason: null,
          unitMode: "Case",
        }));

        setProductInstances(initialInstances);

      } catch (error) {
        console.error(" Get User Failed For the Header:", error);
      }
    };
    getData();
  }, []);








  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [searchText, setSearchText] = useState("");
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [reasonSearch, setReasonSearch] = useState("");
  //const [unitModeMap, setUnitModeMap] = useState({});

  const updateQuantity = (instanceId, val) =>
    setProductInstances((p) =>
      p.map((x) =>
        x.instanceId === instanceId
          ? { ...x, quantity: Math.max(0, parseInt(val) || 0) }
          : x
      )
    );

  const updateReason = (instanceId, reason) =>
    setProductInstances((p) =>
      p.map((x) => (x.instanceId === instanceId ? { ...x, reason } : x))
    );

  const handleAddCopy = (baseId) => {
    const sameProductCopies = productInstances.filter((p) => p.baseId === baseId);
    if (sameProductCopies.length >= 4) return;

    const original = sameProductCopies[0];
    const newCopy = {
      ...original,
      instanceId: `${baseId}-${sameProductCopies.length}`,
    };
    setProductInstances([...productInstances, newCopy]);
  };

  const handleRemoveCopy = (instanceId) => {
    setProductInstances((p) => p.filter((x) => x.instanceId !== instanceId));
  };

  // const toggleMode = (instanceId, mode) => {
  //   setUnitModeMap((prev) => ({ ...prev, [instanceId]: mode }));
  // };

  const toggleMode = (instanceId, mode) =>
    setProductInstances((list) =>
      list.map((x) =>
        x.instanceId === instanceId ? { ...x, unitMode: mode } : x
      )
    );





  const filteredReasons = reasons.filter((r) =>
    r.toLowerCase().includes(reasonSearch.toLowerCase())
  );

  const getAvailableReasons = (currentReason) => {
    return reasons.filter(r =>
      // keep this instance’s current reason,
      // or it’s never been used yet by someone else:
      r === currentReason || !usedReasons.includes(r)
    );
  };

  const filteredBaseProducts = productData.filter((p) =>

    p.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.bgcontainer}>
        <View style={styles.container}>
          <View style={{ justifyContent: 'space-between', height: 34, flexDirection: "row", padding: 4 }}>
            <Text style={{ color: '#1F1D1A', fontSize: 16, fontWeight: '500' }}>Sales Return</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#5A5454" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              placeholder="Search"
              value={searchText}
              onChangeText={setSearchText}
              style={styles.searchInput}
            />
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          </View>

          {/* Categories */}
          <View style={styles.categoryContainer}>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {/* {categories.map((cat) => {
                const active = selectedCategory === cat;
                return active ? (
                  <LinearGradient
                    key={cat}
                    colors={Gradients.primary}
                    style={[styles.categoryBtn, styles.categoryBtnActive]}
                  >
                    <TouchableOpacity onPress={() => setSelectedCategory(cat)}>
                      <Text style={[styles.categoryText, styles.categoryTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryBtn, styles.categoryBtnInactive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={styles.categoryText}>{cat}</Text>
                  </TouchableOpacity>
                );
              })} */}
            </ScrollView>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Product Cards */}
            {filteredBaseProducts.map((baseProduct) => {
              const relatedInstances = productInstances.filter((p) => p.baseId === baseProduct.id);

              const usedReasonsForThisProduct = relatedInstances
                .map(inst => inst.reason)
                .filter(r => !!r);

              const getAvailableReasons = currentReason =>
                reasons.filter(
                  r => r === currentReason || !usedReasonsForThisProduct.includes(r)
                );
              const canAddMore = relatedInstances.length < 4;

              return (
                <View key={baseProduct.id} style={styles.productCard}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Image source={baseProduct.image} style={styles.productImage} />
                    <View style={{ flex: 1, paddingLeft: 10 }}>
                      <Text style={styles.productName}>{baseProduct.name}</Text>
                      <Text style={styles.productPrice}>₹{baseProduct.price.toFixed(2)}</Text>
                      <Text style={{ fontSize: 10 }}>Unit per case {baseProduct.unitPerCase}</Text>
                    </View>
                  </View>

                  {/* Product Instances */}
                  {relatedInstances.map((item) => (
                    <View key={item.instanceId}>
                      {/* Toggle */}
                      <View style={styles.toggleWrapper}>
                        <View style={{ flexDirection: "row", alignSelf: "flex-start" }}>
                          {["Case", "Unit"].map((mode, idx) => {
                            //const active = (unitModeMap[item.instanceId] || "Case") === mode;
                            const active = (item.unitMode || "Case") === mode;
                            const isLeft = idx === 0;
                            return active ? (
                              <LinearGradient
                                key={mode}
                                colors={['#C9A24D', '#C9A24D']}
                                style={[
                                  styles.toggleBase,
                                  isLeft ? styles.leftActive : styles.rightActive,
                                ]}
                              >
                                <TouchableOpacity onPress={() => toggleMode(item.instanceId, mode)}>
                                  <Text style={styles.textActive}>{mode}</Text>
                                </TouchableOpacity>
                              </LinearGradient>
                            ) : (
                              <TouchableOpacity
                                key={mode}
                                onPress={() => toggleMode(item.instanceId, mode)}
                                style={[
                                  styles.toggleBase,
                                  styles.inactive,
                                  isLeft ? styles.leftActive : styles.rightActive,
                                ]}
                              >
                                <Text style={styles.textInactive}>{mode}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {/* Quantity / Reason / Actions */}
                      <View style={styles.reasonRow}>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          placeholder="Qty"
                          value={item.quantity.toString()}
                          onChangeText={(v) => updateQuantity(item.instanceId, v)}
                        />

                        {item.instanceId.endsWith("-0") ? (
                          <TouchableOpacity
                            style={styles.dropdownBtn}
                            onPress={() => {
                              setActiveDropdown(item.instanceId);
                              setReasonSearch("");
                            }}
                          >
                            <Text style={{ color: item.reason ? "#000" : "#888" }}>
                              {item.reason || "Select"}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color="#888" />
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.dropdownBtn, { backgroundColor: "#F1EADB" }]}>
                            <Text style={{ color: item.reason ? "#000" : "#888" }}>
                              {item.reason || "No reason"}
                            </Text>
                          </View>
                        )}

                        {item.instanceId.endsWith("-0") ? (
                          canAddMore && (
                            <TouchableOpacity
                              style={styles.plusBtn}
                              onPress={() => handleAddCopy(item.baseId)}
                            >
                              <Plus width={24} height={24} />
                            </TouchableOpacity>
                          )
                        ) : (
                          <TouchableOpacity
                            style={styles.plusBtn}
                            onPress={() => handleRemoveCopy(item.instanceId)}
                          >
                            <Ionicons name="trash-outline" size={24} color="red" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Reason Modal */}
                      <Modal
                        transparent
                        visible={activeDropdown === item.instanceId}
                        animationType="fade"
                        onRequestClose={() => setActiveDropdown(null)}
                      >
                        <TouchableOpacity
                          style={styles.modalOverlay}
                          onPress={() => setActiveDropdown(null)}
                        />
                        <View style={styles.reasonDropdown}>
                          <TextInput
                            style={styles.searchInput}
                            placeholder="Search reason..."
                            value={reasonSearch}
                            onChangeText={setReasonSearch}
                          />
                          <FlatList
                            data={filteredReasons}
                            keyExtractor={(r, i) => i.toString()}
                            renderItem={({ item: r }) => (
                              <TouchableOpacity
                                style={styles.reasonItem}
                                onPress={() => {
                                  updateReason(item.instanceId, r);
                                  setActiveDropdown(null);
                                  setReasonSearch("");
                                }}
                              >
                                <Text>{r}</Text>
                              </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={styles.noDataText}>No reasons</Text>}
                          />
                        </View>
                      </Modal>
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>

        </View>
        <View style={{ justifyContent: 'space-between', height: 30, flexDirection: "row", padding: 4 }}>
          <Text style={{ color: '#1F1D1A', fontSize: 14, fontWeight: '500' }}>Sales Return</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#5A5454" />
          </TouchableOpacity>
        </View>

        <View style={styles.submitContainer}>
          <TouchableOpacity onPress={handleOrderSubmit} style={styles.submitWrapper}>
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButton}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

    </Modal>
  );
}

const styles = StyleSheet.create({
  submitContainer: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
    width: '100%',
    justifyContent: 'center',
    //  backgroundColor:'red'

  },

  submitButton: {
    backgroundColor: "#1F1D1A",
    paddingVertical: 18,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: "center",
  },
  submitWrapper: {
    width: '100%',
    height: '100%',
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  bgcontainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  container: {
    height: '80%',
    marginTop: 'auto',
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },

  closeBtn: {

  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 10,
    marginBottom: 10,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 16 },
  searchIcon: { marginLeft: 8 },
  categoryContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 6,
    marginBottom: 10,
  },
  categoryBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryBtnInactive: { backgroundColor: "#F1EADB", borderWidth: 1, borderColor: "#C9A24D" },
  categoryBtnActive: {},
  categoryText: { color: "black", height: 22 },
  categoryTextActive: { color: "#fff" },
  productCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  productImage: { width: 50, height: 70, borderRadius: 6, resizeMode: "contain" },
  productName: { fontWeight: "500", fontSize: 14, marginBottom: 2, color: "#1F1D1A" },
  productPrice: { fontSize: 12, color: "#7A7266", marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 5,
    height: 35,
    paddingHorizontal: 10,
    width: 50,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    justifyContent: "space-between",
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 4,
    borderRadius: 5,
    width: 140,
    justifyContent: "space-between",
  },
  plusBtn: {
    padding: 6,
    marginLeft: 8,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  reasonDropdown: {
    position: "absolute",
    top: "30%",
    left: "10%",
    right: "10%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    maxHeight: 250,
    zIndex: 10,
  },
  reasonItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  noDataText: { padding: 10, textAlign: "center", color: "#999" },

  toggleWrapper: {
    marginTop: 10,
    marginBottom: 6,
  },
  toggleBase: {
    paddingVertical: 5,
    paddingHorizontal: 25,
    justifyContent: "center",
  },
  inactive: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  leftActive: {
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  rightActive: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  textActive: {
    color: "#fff",
    fontWeight: "500",
    fontSize: 12,
  },
  textInactive: {
    color: "#A67C2E",
    fontWeight: "500",
    fontSize: 12,
  },
});
