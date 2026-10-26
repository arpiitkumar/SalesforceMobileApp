import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  StatusBar, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View,
  Modal,
  FlatList,
  ActivityIndicator
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import Ionicons from "../components/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { isInternetAvailable } from "../utils/networkUtils";
import { showToast } from "../redux/slices/toastSlice";
import ImagePickerModal from "../components/modal/ImagePickerModal";
import { extractApiErrorMessage } from "../utils/sync/syncStatus";
import { getCurrentLocation } from "../utils/getCurrentLocation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import moment from "moment";

type ProductActivity = {
  id: string;
  competitorName: string;
  productName: string;
  price: string;
  scheme: string;
  image: any;
  availabilityNA: boolean;
};

type CompetitionActivityRecord = {
  id: string;
  name: string;
  remarks: string;
  createdDate: string;
  products: {
    competitorName: string;
    productName: string;
    price: number;
    scheme: string;
    available: boolean;
    image: string | null;
  }[];
};

const createProduct = (): ProductActivity => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  competitorName: "",
  productName: "",
  price: "",
  scheme: "",
  image: null,
  availabilityNA: false,
});

const sanitizeText = (text: string) => {
  return text
    .replace(/[^\w\s.,&()\-/%@#!?]/gi, "")
    .replace(/\s{2,}/g, " ");
};

const CompetitionActivity = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { apiFetch, fetchRecords } = useApiFetch();
  const selectedVisit = useSelector((state: any) => state.selectedVisit);
  const fieldUserId = useSelector((state: any) => state.auth?.userId);

  // Mode toggler: true for new creation form, false for list of previous entries
  const [isCreating, setIsCreating] = useState(false);

  // List states
  const [activities, setActivities] = useState<CompetitionActivityRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc"); // 'asc' = A-Z (oldest first), 'desc' = Z-A (latest first)
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempSortOrder, setTempSortOrder] = useState<"asc" | "desc">("desc");

  // Creation form states
  const [products, setProducts] = useState<ProductActivity[]>([createProduct()]);
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [imagePickerProductId, setImagePickerProductId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const resetForm = () => {
    setProducts([createProduct()]);
    setRemarks("");
    setErrors({});
    setImagePickerProductId(null);
  };

  // Reset form whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      resetForm();
      setIsCreating(false);
      loadPreviousEntries();
    }, [selectedVisit?.AccountId])
  );

  // Load previous entries
  const loadPreviousEntries = async () => {
    if (!selectedVisit?.AccountId) return;
    setLoadingList(true);
    const cacheKey = `cached_comp_activities_${selectedVisit.AccountId}`;

    try {
      // 1. Try loading cached data first for immediate display
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setActivities(JSON.parse(cached));
      }

      // 2. Fetch from Salesforce if online
      const online = await isInternetAvailable();
      if (online) {
        const queryStr = `SELECT Id, Name, Remarks__c, CreatedDate FROM Competition_Activity__c WHERE Outlet__c = '${selectedVisit.AccountId}' ORDER BY CreatedDate DESC LIMIT 50`;
        const serverActivities = await fetchRecords("Competition_Activity__c", queryStr);

        if (Array.isArray(serverActivities) && serverActivities.length > 0) {
          const activityIds = serverActivities.map(a => `'${a.Id}'`).join(",");
          const prodQuery = `SELECT Id, Competitor_Name__c, Product_Name__c, Price__c, Scheme__c, Available__c, Base64_Image__c, Competition_Activity__c FROM Competition_Product__c WHERE Competition_Activity__c IN (${activityIds})`;
          const serverProducts = await fetchRecords("Competition_Product__c", prodQuery);

          const mappedActivities: CompetitionActivityRecord[] = serverActivities.map(act => {
            const relatedProds = Array.isArray(serverProducts) 
              ? serverProducts.filter(p => p.Competition_Activity__c === act.Id)
              : [];

            const productTitle = relatedProds.length > 0
              ? relatedProds
                  .map(p => {
                    const comp = (p.Competitor_Name__c || "").trim();
                    const prod = (p.Product_Name__c || "").trim();
                    return comp ? `${comp} - ${prod}` : prod;
                  })
                  .filter(Boolean)
                  .join(", ")
              : (act.Name || "Competition Activity");

            return {
              id: act.Id,
              name: productTitle || act.Name || "Competition Activity",
              remarks: act.Remarks__c || "",
              createdDate: act.CreatedDate || new Date().toISOString(),
              products: relatedProds.map(p => ({
                competitorName: p.Competitor_Name__c || "",
                productName: p.Product_Name__c || "",
                price: p.Price__c || 0,
                scheme: p.Scheme__c || "",
                available: p.Available__c ?? true,
                image: p.Base64_Image__c || null,
              })),
            };
          });

          setActivities(mappedActivities);
          // Cache the latest server response
          await AsyncStorage.setItem(cacheKey, JSON.stringify(mappedActivities));
        }
      }
    } catch (e) {
      console.warn("Failed to load previous competition activities:", e);
    } finally {
      setLoadingList(false);
    }
  };

  // Sync temp sort order state
  useEffect(() => {
    if (filterModalVisible) {
      setTempSortOrder(sortOrder);
    }
  }, [filterModalVisible]);

  // Filtering & Sorting of activities list
  const filteredAndSortedActivities = useMemo(() => {
    let result = [...activities];

    // Apply text search on Remarks or Product Names
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(act => 
        act.remarks.toLowerCase().includes(q) || 
        act.name.toLowerCase().includes(q) ||
        act.products.some(p => p.productName.toLowerCase().includes(q))
      );
    }

    // Apply Sorting by Created Date
    result.sort((a, b) => {
      const timeA = new Date(a.createdDate).getTime();
      const timeB = new Date(b.createdDate).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    return result;
  }, [activities, searchQuery, sortOrder]);

  const updateProduct = (id: string, field: keyof ProductActivity, value: string | boolean | any) => {
    setProducts((current) => current.map((product) => {
      if (product.id !== id) return product;
      let nextValue = value;
      if (typeof value === "string") {
        if (field === "price") {
          // Allow digits and at most one decimal point with up to 2 decimal places
          let cleaned = value.replace(/[^0-9.]/g, "");
          const parts = cleaned.split(".");
          if (parts.length > 2) {
            cleaned = parts[0] + "." + parts.slice(1).join("");
          }
          if (parts.length === 2 && parts[1].length > 2) {
            cleaned = parts[0] + "." + parts[1].slice(0, 2);
          }
          nextValue = cleaned;
        } else if (field === "scheme") {
          // Disallow special characters and emojis - allow only letters, numbers, and spaces
          nextValue = value.replace(/[^a-zA-Z0-9\s]/g, "");
        } else {
          nextValue = sanitizeText(value);
        }
      }
      return { ...product, [field]: nextValue };
    }));
    setErrors((current) => ({ ...current, [`${id}-${field}`]: undefined }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    products.forEach((product, index) => {
      const prefix = `Product ${index + 1}`;
      if (!product.competitorName.trim()) nextErrors[`${product.id}-competitorName`] = `${prefix} competitor name is required.`;
      if (!product.productName.trim()) nextErrors[`${product.id}-productName`] = `${prefix} name is required.`;
      if (!product.price || product.price === ".") nextErrors[`${product.id}-price`] = `${prefix} price is required.`;
      else if (isNaN(Number(product.price)) || Number(product.price) <= 0) nextErrors[`${product.id}-price`] = "Enter a valid price greater than 0.";
      if (!product.scheme.trim()) {
        nextErrors[`${product.id}-scheme`] = `${prefix} scheme is required.`;
      } else if (/[^a-zA-Z0-9\s]/.test(product.scheme)) {
        nextErrors[`${product.id}-scheme`] = `${prefix} scheme cannot contain special characters or emojis.`;
      }
      if (!product.image?.base64) nextErrors[`${product.id}-image`] = `${prefix} picture is required.`;
    });
    if (!remarks.trim()) nextErrors.remarks = "Remarks are required.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!(await isInternetAvailable())) {
      dispatch(showToast({ message: "Please check your internet connection and try again.", type: "error" }));
      return;
    }

    setSubmitting(true);
    try {
      const location = await getCurrentLocation();
      const activityPayload = {
        Field_User__c: fieldUserId || null,
        Outlet__c: selectedVisit?.AccountId || selectedVisit?.AccountId__c || null,
        Visit__c: selectedVisit?.sfId || selectedVisit?.Sf_Id || selectedVisit?.Id || null,
        Location__Latitude__s: location.latitude,
        Location__Longitude__s: location.longitude,
        Remarks__c: remarks.trim(),
      };
      const activityResponse = await apiFetch("POST", "sobjects/Competition_Activity__c", activityPayload, "SObjects");
      const competitionActivityId = activityResponse?.data?.id;
      if (activityResponse?.status !== "success" || !competitionActivityId) {
        throw new Error(extractApiErrorMessage(activityResponse) || "Unable to create competition activity.");
      }

      for (const product of products) {
        const payload = {
          Competitor_Name__c: product.competitorName.trim(),
          Product_Name__c: product.productName.trim(),
          Price__c: Number(product.price),
          Scheme__c: product.scheme.trim(),
          Available__c: !product.availabilityNA,
          Remarks__c: remarks.trim(),
          Base64_Image__c: product.image.base64,
          Competition_Activity__c: competitionActivityId,
        };
        const response = await apiFetch("POST", "sobjects/Competition_Product__c", payload, "SObjects");
        if (response?.status !== "success" || !response?.data?.id) {
          throw new Error(extractApiErrorMessage(response) || "Unable to create competition product.");
        }
      }
      dispatch(showToast({ message: "Competition activity submitted successfully!", type: "success" }));
      resetForm();
      setIsCreating(false); // Switch back to list view
      loadPreviousEntries(); // Reload updated list
    } catch (error) {
      dispatch(showToast({ message: extractApiErrorMessage(null, error as any) || "Unable to submit competition activity.", type: "error" }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyFilters = () => {
    setSortOrder(tempSortOrder);
    setFilterModalVisible(false);
  };

  const handleClearFilters = () => {
    setTempSortOrder("desc");
    setSortOrder("desc");
    setFilterModalVisible(false);
  };

  const renderTextInput = (label: string, value: string, onChangeText: (value: string) => void, error?: string, options: { price?: boolean; multiline?: boolean; maxLength?: number; onFocus?: () => void } = {}) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label} <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={[styles.input, options.multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor="#999"
        keyboardType={options.price ? "decimal-pad" : "default"}
        multiline={options.multiline}
        textAlignVertical={options.multiline ? "top" : "center"}
        maxLength={options.maxLength}
        onFocus={options.onFocus}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity 
          onPress={() => {
            if (isCreating) {
              resetForm();
              setIsCreating(false);
            } else {
              navigation.goBack();
            }
          }} 
          hitSlop={10}
        >
          <Feather name="arrow-left" size={25} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isCreating ? "New Competition Activity" : "Competition Activity"}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {!isCreating ? (
        // ================= LIST VIEW MODE =================
        <View style={styles.content}>
          
          {/* Search bar & Filter */}
          <View style={styles.searchContainer}>
            <View style={styles.searchRow}>
              <Feather name="search" size={18} color="#8a8a8a" style={{ marginLeft: 12 }} />
              <TextInput
                placeholder="Search by remarks or products..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
                placeholderTextColor="#8a8a8a"
              />
            </View>
            <TouchableOpacity 
              style={styles.filterBtn}
              onPress={() => setFilterModalVisible(true)}
            >
              <Feather name="sliders" size={18} color="#A67C2E" />
            </TouchableOpacity>
          </View>

          {loadingList && activities.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#A67C2E" />
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredAndSortedActivities}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const getDisplayTitle = () => {
                  if (item.products && item.products.length > 0) {
                    const titles = item.products
                      .map(p => {
                        const comp = (p.competitorName || "").trim();
                        const prod = (p.productName || "").trim();
                        return comp ? `${comp} - ${prod}` : prod;
                      })
                      .filter(Boolean);
                    if (titles.length > 0) return titles.join(", ");
                  }
                  return item.name && !item.name.startsWith("a0d") ? item.name : "Competition Activity";
                };

                return (
                  <View style={styles.activityCard}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{getDisplayTitle()}</Text>
                      <Text style={styles.cardDate}>{moment(item.createdDate).format("DD MMM YYYY, h:mm a")}</Text>
                    </View>

                  <Text style={styles.remarksText} numberOfLines={2}>
                    Remarks: <Text style={styles.remarksVal}>{item.remarks}</Text>
                  </Text>

                  {/* Products inside activity card */}
                  <View style={styles.productsContainer}>
                    {item.products.map((prod, idx) => (
                      <View key={idx} style={styles.productRow}>
                        {prod.image ? (
                          <Image source={{ uri: `data:image/jpeg;base64,${prod.image}` }} style={styles.productThumb} />
                        ) : (
                          <View style={styles.productThumbPlaceholder}>
                            <Feather name="image" size={14} color="#aaa" />
                          </View>
                        )}
                        <View style={styles.productInfo}>
                          {prod.competitorName ? (
                            <Text style={styles.pBrand} numberOfLines={1}>
                              Brand : <Text style={styles.pBrandVal}>{prod.competitorName}</Text>
                            </Text>
                          ) : null}
                          <Text style={styles.pName} numberOfLines={1}>
                            Product : <Text style={styles.pNameVal}>{prod.productName}</Text>
                          </Text>
                          <Text style={styles.pPrice}>₹{prod.price} | Scheme: {prod.scheme}</Text>
                        </View>
                        <View style={[styles.availabilityBadge, { backgroundColor: prod.available ? "#E3F1EA" : "#F9E5E3" }]}>
                          <Text style={[styles.availabilityBadgeText, { color: prod.available ? "#2E7D5B" : "#B3261E" }]}>
                            {prod.available ? "Avail" : "N/A"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            }}
              ListEmptyComponent={
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>No previous entries found</Text>
                </View>
              }
            />
          )}

          {/* Floating Action Button (FAB) to switch to Form Mode */}
          <TouchableOpacity 
            style={styles.fab}
            activeOpacity={0.8}
            onPress={() => {
              resetForm();
              setIsCreating(true);
            }}
          >
            <Feather name="plus" size={26} color="#fff" />
          </TouchableOpacity>

          {/* Sort Filter Modal */}
          <Modal
            visible={filterModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setFilterModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <TouchableOpacity 
                style={styles.modalBackground} 
                activeOpacity={1} 
                onPress={() => setFilterModalVisible(false)} 
              />
              <View style={styles.filterSheet}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Sort Activities</Text>
                  <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                    <Feather name="x" size={22} color="#555" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionLabel}>Date Creation</Text>
                <View style={styles.optionsRow}>
                  <TouchableOpacity 
                    style={[styles.optionBtn, tempSortOrder === "desc" && styles.optionBtnActive]}
                    onPress={() => setTempSortOrder("desc")}
                  >
                    <Feather name={tempSortOrder === "desc" ? "check-circle" : "circle"} size={16} color={tempSortOrder === "desc" ? "#A67C2E" : "#888"} />
                    <Text style={[styles.optionText, tempSortOrder === "desc" && styles.optionTextActive]}>Newest First</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.optionBtn, tempSortOrder === "asc" && styles.optionBtnActive]}
                    onPress={() => setTempSortOrder("asc")}
                  >
                    <Feather name={tempSortOrder === "asc" ? "check-circle" : "circle"} size={16} color={tempSortOrder === "asc" ? "#A67C2E" : "#888"} />
                    <Text style={[styles.optionText, tempSortOrder === "asc" && styles.optionTextActive]}>Oldest First</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.sheetFooter}>
                  <TouchableOpacity style={styles.clearBtn} onPress={handleClearFilters}>
                    <Text style={styles.clearBtnText}>Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.applyBtn} onPress={handleApplyFilters}>
                    <Text style={styles.applyBtnText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

        </View>
      ) : (
        // ================= CREATION FORM MODE =================
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <Text style={styles.validationHint}>Text fields do not accept emoji, repeated spaces, or more than one hyphen.</Text>
            {products.map((product, index) => (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productHeader}>
                  <Text style={styles.productTitle}>Product {index + 1}</Text>
                  {products.length > 1 ? (
                    <TouchableOpacity
                      style={styles.deleteProductButton}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => setProducts((current) => current.filter((item) => item.id !== product.id))}
                    >
                      <Ionicons name="trash-outline" size={18} color="#B3261E" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {renderTextInput("Competitor Name", product.competitorName, (value) => updateProduct(product.id, "competitorName", value), errors[`${product.id}-competitorName`], { maxLength: 120 })}
                {renderTextInput("Product Name", product.productName, (value) => updateProduct(product.id, "productName", value), errors[`${product.id}-productName`], { maxLength: 120 })}
                {renderTextInput("Price", product.price, (value) => updateProduct(product.id, "price", value), errors[`${product.id}-price`], { price: true, maxLength: 10 })}
                {renderTextInput("Scheme", product.scheme, (value) => updateProduct(product.id, "scheme", value), errors[`${product.id}-scheme`], { maxLength: 250 })}

                <View style={styles.field}>
                  <Text style={styles.label}>Picture <Text style={styles.required}>*</Text></Text>
                  <TouchableOpacity style={styles.imagePicker} onPress={() => setImagePickerProductId(product.id)}>
                    {product.image?.resizedUri || product.image?.uri ? (
                      <Image source={{ uri: product.image.resizedUri || product.image.uri }} style={styles.imagePreview} />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Feather name="camera" size={28} color="#A67C2E" />
                        <Text style={styles.imageHint}>Tap to capture or upload image</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {product.image ? (
                    <TouchableOpacity style={styles.removeImageButton} onPress={() => updateProduct(product.id, "image", null)}>
                      <Ionicons name="trash-outline" size={15} color="#C9A24D" />
                      <Text style={styles.removeImage}>Remove picture</Text>
                    </TouchableOpacity>
                  ) : null}
                  {errors[`${product.id}-image`] ? <Text style={styles.error}>{errors[`${product.id}-image`]}</Text> : null}
                </View>

                <TouchableOpacity style={styles.checkboxRow} onPress={() => updateProduct(product.id, "availabilityNA", !product.availabilityNA)}>
                  <View style={[styles.checkbox, product.availabilityNA && styles.checkboxChecked]}>
                    {product.availabilityNA ? <Feather name="check" size={15} color="#fff" /> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>Not Available (N/A)</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addProductButton} onPress={() => setProducts((current) => [...current, createProduct()])}>
              <Feather name="plus" size={18} color="#A67C2E" />
              <Text style={styles.addProductText}>Add another product</Text>
            </TouchableOpacity>
            {renderTextInput("Remarks", remarks, (value) => { setRemarks(sanitizeText(value)); setErrors((current) => ({ ...current, remarks: undefined })); }, errors.remarks, {
              multiline: true,
              maxLength: 500,
              onFocus: () => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 180),
            })}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <TouchableOpacity disabled={submitting} onPress={handleSubmit} style={styles.submitButton}>
              <LinearGradient colors={["#C9A24D", "#A67C2E", "#C9A24D"]} style={styles.submitGradient}>
                <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <ImagePickerModal
        visible={Boolean(imagePickerProductId)}
        onClose={() => setImagePickerProductId(null)}
        onImageSelected={(image) => {
          if (image?.base64 && imagePickerProductId) {
            updateProduct(imagePickerProductId, "image", image);
          }
          setImagePickerProductId(null);
        }}
        title="Add Competition Picture"
        subtitle="Take a photo or choose one from your gallery"
        galleryButton
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1EADB" }, 
  header: { backgroundColor: "#A67C2E", paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "center" }, 
  headerTitle: { flex: 1, marginLeft: 18, color: "#fff", fontSize: 19, fontWeight: "700" }, 
  headerSpacer: { width: 25 }, 
  content: { flex: 1 }, 
  
  // Search bar and Filters (List view)
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#fff",
    gap: 10,
    borderBottomWidth: 1,
    borderColor: "#ececec"
  },
  searchRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    backgroundColor: "#f2f2f2",
    borderWidth: 0.5,
    borderColor: "#D9D2C3",
  },
  searchInput: { flex: 1, height: 40, paddingHorizontal: 10, fontSize: 14, color: "#333" },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 0.5,
    borderColor: "#d5d5d5",
    justifyContent: "center",
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },

  // List view cards styling
  listContent: { padding: 16, paddingBottom: 100 },
  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderColor: "#eee",
    paddingBottom: 8,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#A67C2E" },
  cardDate: { fontSize: 11, color: "#888" },
  remarksText: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 12 },
  remarksVal: { fontWeight: "400", color: "#333" },

  // Products rows list styling
  productsContainer: { gap: 10 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBF8F1",
    padding: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#eaeaea"
  },
  productThumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: "#eee" },
  productThumbPlaceholder: { width: 44, height: 44, borderRadius: 6, backgroundColor: "#eaeaea", justifyContent: "center", alignItems: "center" },
  productInfo: { flex: 1, marginLeft: 10 },
  pBrand: { fontSize: 12, fontWeight: "600", color: "#555" },
  pBrandVal: { fontWeight: "700", color: "#111" },
  pName: { fontSize: 12, fontWeight: "600", color: "#555", marginTop: 1 },
  pNameVal: { fontWeight: "700", color: "#111" },
  pPrice: { fontSize: 11, color: "#666", marginTop: 2 },
  availabilityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  availabilityBadgeText: { fontSize: 10, fontWeight: "700" },

  // Loader & Empty logic
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#777", fontSize: 14 },
  noDataContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
  noDataText: { fontSize: 15, color: "#999" },

  // FAB (Floating Action Button)
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#A67C2E",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },

  // Modal Sort sheet
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  modalBackground: {
    flex: 1,
  },
  filterSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderColor: "#F1EADB",
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
    marginTop: 10,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 24,
  },
  optionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    gap: 8,
  },
  optionBtnActive: {
    borderColor: "#A67C2E",
    backgroundColor: "#FFF5F5",
  },
  optionText: {
    fontSize: 12,
    color: "#4A5568",
    fontWeight: "500",
  },
  optionTextActive: {
    color: "#A67C2E",
    fontWeight: "600",
  },
  sheetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E0",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    fontSize: 14,
    color: "#4A5568",
    fontWeight: "600",
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#A67C2E",
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    fontSize: 14,
    color: "#FFF",
    fontWeight: "600",
  },

  // Form elements styling
  scrollContent: { padding: 16, paddingBottom: 150 }, 
  validationHint: { fontSize: 12, color: "#777", marginBottom: 12 }, 
  productCard: { backgroundColor: "#fff", borderRadius: 10, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: "#e3e3e3" }, 
  productHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }, 
  productTitle: { fontSize: 16, fontWeight: "700", color: "#333" }, 
  deleteProductButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  field: { marginBottom: 16 }, 
  label: { color: "#333", fontSize: 14, fontWeight: "600", marginBottom: 7 }, 
  required: { color: "#B3261E" }, 
  input: { minHeight: 46, borderWidth: 1, borderColor: "#d8d8d8", borderRadius: 9, backgroundColor: "#fff", paddingHorizontal: 12, color: "#333", fontSize: 15 }, 
  multilineInput: { height: 96, paddingTop: 12 }, 
  error: { color: "#B3261E", fontSize: 12, marginTop: 5 }, 
  imagePicker: { height: 155, overflow: "hidden", borderWidth: 1, borderStyle: "dashed", borderColor: "#b8b8b8", borderRadius: 9, backgroundColor: "#fff" }, 
  imagePlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" }, 
  imageHint: { marginTop: 8, color: "#777", fontSize: 13 }, 
  imagePreview: { width: "100%", height: "100%" }, 
  removeImageButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 9 }, 
  removeImage: { color: "#A67C2E", fontSize: 13, fontWeight: "600", marginLeft: 6 }, 
  checkboxRow: { flexDirection: "row", alignItems: "center", paddingVertical: 3 }, 
  checkbox: { width: 21, height: 21, borderRadius: 4, borderWidth: 1, borderColor: "#A67C2E", alignItems: "center", justifyContent: "center" }, 
  checkboxChecked: { backgroundColor: "#A67C2E" }, 
  checkboxLabel: { color: "#333", marginLeft: 9, fontSize: 14 }, 
  addProductButton: { height: 45, borderWidth: 1, borderStyle: "dashed", borderColor: "#A67C2E", borderRadius: 9, alignItems: "center", justifyContent: "center", flexDirection: "row", marginBottom: 18 }, 
  addProductText: { color: "#A67C2E", fontWeight: "700", marginLeft: 7 }, 
  footer: { backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#eee" }, 
  submitButton: { overflow: "hidden", borderRadius: 24 }, 
  submitGradient: { minHeight: 48, justifyContent: "center", alignItems: "center" }, 
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" }
});

export default CompetitionActivity;
