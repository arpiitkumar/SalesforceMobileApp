import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Dropdown } from "react-native-element-dropdown";
import Feather from "@react-native-vector-icons/feather";
import Ionicons from "../components/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import moment from "moment";
import ImagePickerModal from "../components/modal/ImagePickerModal";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { isInternetAvailable } from "../utils/networkUtils";
import { showToast } from "../redux/slices/toastSlice";
import { extractApiErrorMessage } from "../utils/sync/syncStatus";

// Restricted picklist values on Merchandising__c.Activity__c
const ACTIVITY_OPTIONS = [
  { label: "Poster", value: "Poster" },
  { label: "Display Rack", value: "Display Rack" },
  { label: "Counter Branding", value: "Counter Branding" },
  { label: "Consumer Activation", value: "Consumer Activation" },
];

// Base64_Image__c is a LongTextArea of length 131072
const MAX_BASE64_LENGTH = 131072;

type MerchEntry = {
  id: string;
  activity: string;
  image: string | null;
  createdDate: string;
};

const Merchandising = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { apiFetch, fetchRecords } = useApiFetch();
  const selectedVisit = useSelector((state: any) => state.selectedVisit);

  const outletId =
    selectedVisit?.AccountId || selectedVisit?.AccountId__c || null;
  const visitId =
    selectedVisit?.sfId || selectedVisit?.Sf_Id || selectedVisit?.Id || null;

  // list / form toggle
  const [isCreating, setIsCreating] = useState(false);

  // list state
  const [entries, setEntries] = useState<MerchEntry[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // form state
  const [activity, setActivity] = useState("");
  const [image, setImage] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const resetForm = () => {
    setActivity("");
    setImage(null);
    setErrors({});
  };

  useFocusEffect(
    useCallback(() => {
      resetForm();
      setIsCreating(false);
      loadEntries();
    }, [outletId]),
  );

  const loadEntries = async () => {
    if (!outletId) return;
    setLoadingList(true);
    const cacheKey = `cached_merchandising_${outletId}`;
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) setEntries(JSON.parse(cached));

      const online = await isInternetAvailable();
      if (online) {
        const query = `SELECT Id, Name, Activity__c, Base64_Image__c, CreatedDate FROM Merchandising__c WHERE Retailer__c = '${outletId}' ORDER BY CreatedDate DESC LIMIT 50`;
        const records = await fetchRecords("Merchandising__c", query);
        if (Array.isArray(records)) {
          const mapped: MerchEntry[] = records.map((r) => ({
            id: r.Id,
            activity: r.Activity__c || "—",
            image: r.Base64_Image__c || null,
            createdDate: r.CreatedDate || new Date().toISOString(),
          }));
          setEntries(mapped);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(mapped));
        }
      }
    } catch (e) {
      console.warn("Failed to load merchandising entries:", e);
    } finally {
      setLoadingList(false);
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!activity) next.activity = "Please select an activity.";
    if (!image?.base64) next.image = "Branding proof photo is required.";
    else if (image.base64.length > MAX_BASE64_LENGTH)
      next.image = "Image is too large. Please retake the photo.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    if (!outletId || !visitId) {
      dispatch(
        showToast({
          message: "Missing outlet or visit reference. Please reopen the visit.",
          type: "error",
        }),
      );
      return;
    }

    if (!(await isInternetAvailable())) {
      dispatch(
        showToast({
          message: "Please check your internet connection and try again.",
          type: "error",
        }),
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        Retailer__c: outletId,
        Visit__c: visitId,
        Activity__c: activity,
        Base64_Image__c: image.base64,
      };
      const response = await apiFetch(
        "POST",
        "sobjects/Merchandising__c",
        payload,
        "SObjects",
      );
      if (response?.status !== "success" || !response?.data?.id) {
        throw new Error(
          extractApiErrorMessage(response) ||
            "Unable to submit merchandising entry.",
        );
      }
      dispatch(
        showToast({
          message: "Merchandising entry submitted successfully!",
          type: "success",
        }),
      );
      resetForm();
      setIsCreating(false);
      loadEntries();
    } catch (error) {
      dispatch(
        showToast({
          message:
            extractApiErrorMessage(null, error as any) ||
            "Unable to submit merchandising entry.",
          type: "error",
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderEntry = ({ item }: { item: MerchEntry }) => (
    <View style={styles.card}>
      {item.image ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.image}` }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Feather name="image" size={26} color="#bbb" />
        </View>
      )}
      <View style={styles.cardMeta}>
        <Text style={styles.cardActivity}>{item.activity}</Text>
        <Text style={styles.cardDate}>
          {moment(item.createdDate).format("DD MMM YYYY, h:mm a")}
        </Text>
      </View>
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
          {isCreating ? "New Merchandise Activity" : "Merchandise"}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {!isCreating ? (
        // ================= LIST VIEW =================
        <View style={styles.content}>
          {loadingList && entries.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#A67C2E" />
              <Text style={styles.loadingText}>Loading entries...</Text>
            </View>
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={renderEntry}
              ListEmptyComponent={
                <View style={styles.noDataContainer}>
                  <Feather name="camera-off" size={40} color="#ccc" />
                  <Text style={styles.noDataText}>
                    No merchandising activity yet
                  </Text>
                  <Text style={styles.noDataHint}>
                    Tap + to capture branding proof
                  </Text>
                </View>
              }
            />
          )}

          <TouchableOpacity
            style={[styles.fab, { bottom: Math.max(insets.bottom, 16) + 16 }]}
            activeOpacity={0.85}
            onPress={() => {
              resetForm();
              setIsCreating(true);
            }}
          >
            <Feather name="plus" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        // ================= CREATE FORM =================
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.content}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Activity picklist */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Activity <Text style={styles.required}>*</Text>
              </Text>
              <Dropdown
                style={styles.dropdown}
                data={ACTIVITY_OPTIONS}
                labelField="label"
                valueField="value"
                value={activity}
                placeholder="Select activity"
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                onChange={(item) => {
                  setActivity(item.value);
                  setErrors((prev) => ({ ...prev, activity: undefined }));
                }}
              />
              {errors.activity ? (
                <Text style={styles.error}>{errors.activity}</Text>
              ) : null}
            </View>

            {/* Branding proof photo */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Select branding proof <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.imagePicker}
                onPress={() => setImagePickerVisible(true)}
              >
                {image?.resizedUri || image?.uri ? (
                  <Image
                    source={{ uri: image.resizedUri || image.uri }}
                    style={styles.imagePreview}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Feather name="camera" size={28} color="#A67C2E" />
                    <Text style={styles.imageHint}>
                      Tap to capture or upload image
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {image ? (
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setImage(null)}
                >
                  <Ionicons name="trash-outline" size={15} color="#C9A24D" />
                  <Text style={styles.removeImage}>Remove photo</Text>
                </TouchableOpacity>
              ) : null}
              {errors.image ? (
                <Text style={styles.error}>{errors.image}</Text>
              ) : null}
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 14) },
            ]}
          >
            <TouchableOpacity
              disabled={submitting}
              onPress={handleSubmit}
              style={styles.submitButton}
            >
              <LinearGradient
                colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>
                  {submitting ? "Submitting..." : "Submit"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <ImagePickerModal
        visible={imagePickerVisible}
        onClose={() => setImagePickerVisible(false)}
        onImageSelected={(img) => {
          if (img?.base64) {
            setImage(img);
            setErrors((prev) => ({ ...prev, image: undefined }));
          }
          setImagePickerVisible(false);
        }}
        title="Add Branding Proof"
        subtitle="Take a photo or choose one from your gallery"
        galleryButton
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1EADB" },
  header: {
    backgroundColor: "#A67C2E",
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    marginLeft: 18,
    color: "#fff",
    fontSize: 19,
    fontWeight: "700",
  },
  headerSpacer: { width: 25 },
  content: { flex: 1 },

  // list
  listContent: { padding: 16, paddingBottom: 110 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardImage: { width: "100%", height: 170, backgroundColor: "#eee" },
  cardImagePlaceholder: { justifyContent: "center", alignItems: "center" },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  cardActivity: { fontSize: 14, fontWeight: "700", color: "#A67C2E", flex: 1 },
  cardDate: { fontSize: 11, color: "#888", marginLeft: 10 },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#777", fontSize: 14 },
  noDataContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  noDataText: { fontSize: 15, color: "#999", marginTop: 12 },
  noDataHint: { fontSize: 12.5, color: "#bbb", marginTop: 4 },

  fab: {
    position: "absolute",
    right: 20,
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

  // form
  scrollContent: { padding: 16, paddingBottom: 150 },
  field: { marginBottom: 18 },
  label: { color: "#333", fontSize: 14, fontWeight: "600", marginBottom: 7 },
  required: { color: "#B3261E" },
  dropdown: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#d8d8d8",
    borderRadius: 9,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
  },
  dropdownPlaceholder: { color: "#999", fontSize: 15 },
  dropdownSelectedText: { color: "#333", fontSize: 15 },
  error: { color: "#B3261E", fontSize: 12, marginTop: 5 },
  imagePicker: {
    height: 155,
    overflow: "hidden",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#b8b8b8",
    borderRadius: 9,
    backgroundColor: "#fff",
  },
  imagePlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  imageHint: { marginTop: 8, color: "#777", fontSize: 13 },
  imagePreview: { width: "100%", height: "100%" },
  removeImageButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 9,
  },
  removeImage: {
    color: "#A67C2E",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  footer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  submitButton: { overflow: "hidden", borderRadius: 24 },
  submitGradient: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default Merchandising;
