import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Ionicons from "../Ionicons";
import LinearGradient from "react-native-linear-gradient";
// @ts-ignore
import { Gradients } from "../../assets/css/MasterCss.js";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterState {
  outletName: string;
  distanceSort: "asc" | "desc" | null;
  selectedClasses: string[];
  selectedChannels: string[];
  perfectStoreOnly?: boolean;
}

interface VisitFilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  onClear: () => void;
  currentFilters: FilterState;
  classOptions: (FilterOption | string)[];
  channelOptions: (FilterOption | string)[];
}

const normalizeOption = (item: FilterOption | string): FilterOption => {
  if (typeof item === "object" && item !== null) {
    const label = (item.label || item.value || "").toString().trim();
    const value = (item.value || item.label || "").toString().trim();
    return { label, value };
  }
  const str = String(item || "").trim();
  return { label: str, value: str };
};

const VisitFilterModal: React.FC<VisitFilterModalProps> = ({
  visible,
  onClose,
  onApply,
  onClear,
  currentFilters,
  classOptions,
  channelOptions,
}) => {
  // Temporary filter state for editing inside modal
  const [outletName, setOutletName] = useState(currentFilters.outletName || "");
  const [distanceSort, setDistanceSort] = useState<"asc" | "desc" | null>(
    currentFilters.distanceSort || null
  );
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    currentFilters.selectedClasses || []
  );
  const [selectedChannels, setSelectedChannels] = useState<string[]>(
    currentFilters.selectedChannels || []
  );
  const [perfectStoreOnly, setPerfectStoreOnly] = useState<boolean>(
    !!currentFilters.perfectStoreOnly
  );

  // Dropdown expansion and search states
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classSearchText, setClassSearchText] = useState("");
  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState(false);
  const [channelSearchText, setChannelSearchText] = useState("");

  // Sync state when modal becomes visible
  useEffect(() => {
    if (visible) {
      setOutletName(currentFilters.outletName || "");
      setDistanceSort(currentFilters.distanceSort || null);
      setSelectedClasses(currentFilters.selectedClasses || []);
      setSelectedChannels(currentFilters.selectedChannels || []);
      setPerfectStoreOnly(!!currentFilters.perfectStoreOnly);
      setIsClassDropdownOpen(false);
      setClassSearchText("");
      setIsChannelDropdownOpen(false);
      setChannelSearchText("");
    }
  }, [visible, currentFilters]);

  // Normalized Class options list
  const normalizedClassOptions = useMemo<FilterOption[]>(() => {
    return (classOptions || [])
      .map(normalizeOption)
      .filter((o) => o.label || o.value);
  }, [classOptions]);

  // Normalized Channel options list
  const normalizedChannelOptions = useMemo<FilterOption[]>(() => {
    return (channelOptions || [])
      .map(normalizeOption)
      .filter((o) => o.label || o.value);
  }, [channelOptions]);

  // Filter available classes by search query
  const filteredClassOptions = useMemo(() => {
    const q = classSearchText.trim().toLowerCase();
    if (!q) return normalizedClassOptions;
    return normalizedClassOptions.filter(
      (opt) =>
        (opt.label && opt.label.toLowerCase().includes(q)) ||
        (opt.value && opt.value.toLowerCase().includes(q))
    );
  }, [normalizedClassOptions, classSearchText]);

  // Filter available channels by search query
  const filteredChannelOptions = useMemo(() => {
    const q = channelSearchText.trim().toLowerCase();
    if (!q) return normalizedChannelOptions;
    return normalizedChannelOptions.filter(
      (opt) =>
        (opt.label && opt.label.toLowerCase().includes(q)) ||
        (opt.value && opt.value.toLowerCase().includes(q))
    );
  }, [normalizedChannelOptions, channelSearchText]);

  const getClassLabel = (val: string) => {
    const found = normalizedClassOptions.find(
      (o) => o.value === val || o.label === val
    );
    return found ? found.label : val;
  };

  const getChannelLabel = (val: string) => {
    const found = normalizedChannelOptions.find(
      (o) => o.value === val || o.label === val
    );
    return found ? found.label : val;
  };

  const toggleClassSelection = (val: string) => {
    setSelectedClasses((prev) => {
      const match = prev.find(
        (item) => item.toLowerCase() === val.toLowerCase()
      );
      if (match) {
        return prev.filter((item) => item.toLowerCase() !== val.toLowerCase());
      } else {
        return [...prev, val];
      }
    });
  };

  const removeClassSelection = (val: string) => {
    setSelectedClasses((prev) =>
      prev.filter((item) => item.toLowerCase() !== val.toLowerCase())
    );
  };

  const toggleChannelSelection = (val: string) => {
    setSelectedChannels((prev) => {
      const match = prev.find(
        (item) => item.toLowerCase() === val.toLowerCase()
      );
      if (match) {
        return prev.filter((item) => item.toLowerCase() !== val.toLowerCase());
      } else {
        return [...prev, val];
      }
    });
  };

  const removeChannelSelection = (val: string) => {
    setSelectedChannels((prev) =>
      prev.filter((item) => item.toLowerCase() !== val.toLowerCase())
    );
  };

  const handleApply = () => {
    onApply({
      outletName: outletName.trim(),
      distanceSort,
      selectedClasses,
      selectedChannels,
      perfectStoreOnly,
    });
    onClose();
  };

  const handleClearAll = () => {
    setOutletName("");
    setDistanceSort(null);
    setSelectedClasses([]);
    setSelectedChannels([]);
    setPerfectStoreOnly(false);
    setIsClassDropdownOpen(false);
    setClassSearchText("");
    setIsChannelDropdownOpen(false);
    setChannelSearchText("");
    onClear();
    onClose();
  };

  const handleToggleDistance = (type: "asc" | "desc") => {
    setDistanceSort((prev) => (prev === type ? null : type));
  };

  const activeCount =
    (outletName.trim() ? 1 : 0) +
    (distanceSort ? 1 : 0) +
    (selectedClasses.length > 0 ? 1 : 0) +
    (selectedChannels.length > 0 ? 1 : 0) +
    (perfectStoreOnly ? 1 : 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.modalCard}
            >
              {/* Modal Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <Ionicons
                    name="funnel"
                    size={18}
                    color="#C9A24D"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.headerTitle}>Filter Visits</Text>
                  {activeCount > 0 && (
                    <View style={styles.activeBadgeHeader}>
                      <Text style={styles.activeBadgeHeaderText}>
                        {activeCount} active
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={22} color="#7A7266" />
                </TouchableOpacity>
              </View>

              {/* Modal Scrollable Body */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
                keyboardShouldPersistTaps="handled"
              >
                {/* 1. OUTLET / RETAILER NAME */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Search Outlet Name</Text>
                  <View style={styles.searchInputWrap}>
                    <Ionicons
                      name="search-outline"
                      size={18}
                      color="#7A7266"
                      style={styles.searchIcon}
                    />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Enter retailer, distributor or outlet name..."
                      placeholderTextColor="#7A7266"
                      value={outletName}
                      onChangeText={setOutletName}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {outletName.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setOutletName("")}
                        style={styles.clearInputIcon}
                      >
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color="#7A7266"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* PERFECT STORE FILTER */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Perfect Store</Text>
                  <View style={styles.distanceOptionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.distanceOptionChip,
                        perfectStoreOnly && {
                          backgroundColor: "#2E7D5B",
                          borderColor: "#2E7D5B",
                        },
                      ]}
                      onPress={() => setPerfectStoreOnly((prev) => !prev)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={perfectStoreOnly ? "checkmark-circle" : "checkmark-circle-outline"}
                        size={14}
                        color={perfectStoreOnly ? "#FFF" : "#2E7D5B"}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.distanceOptionText,
                          perfectStoreOnly && styles.distanceOptionTextActive,
                        ]}
                      >
                        Perfect Stores only
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. DISTANCE SORTING */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Distance Sorting</Text>
                  <View style={styles.distanceOptionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.distanceOptionChip,
                        distanceSort === "asc" && styles.distanceOptionChipActive,
                      ]}
                      onPress={() => handleToggleDistance("asc")}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="arrow-up"
                        size={14}
                        color={distanceSort === "asc" ? "#FFF" : "#7A7266"}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.distanceOptionText,
                          distanceSort === "asc" &&
                            styles.distanceOptionTextActive,
                        ]}
                      >
                        Distance: Low to High
                      </Text>
                      {distanceSort === "asc" && (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color="#FFF"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.distanceOptionChip,
                        distanceSort === "desc" &&
                          styles.distanceOptionChipActive,
                      ]}
                      onPress={() => handleToggleDistance("desc")}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="arrow-down"
                        size={14}
                        color={distanceSort === "desc" ? "#FFF" : "#7A7266"}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.distanceOptionText,
                          distanceSort === "desc" &&
                            styles.distanceOptionTextActive,
                        ]}
                      >
                        Distance: High to Low
                      </Text>
                      {distanceSort === "desc" && (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color="#FFF"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 3. CLASS FILTER */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>Class</Text>
                    {selectedClasses.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setSelectedClasses([])}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      >
                        <Text style={styles.clearSectionText}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Selected Class Chips */}
                  {selectedClasses.length > 0 && (
                    <View style={styles.selectedChipsContainer}>
                      {selectedClasses.map((clsVal) => (
                        <View key={clsVal} style={styles.selectedChip}>
                          <Text style={styles.selectedChipText}>
                            {getClassLabel(clsVal)}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeClassSelection(clsVal)}
                            style={styles.chipRemoveBtn}
                          >
                            <Ionicons
                              name="close-circle"
                              size={16}
                              color="#C9A24D"
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Dropdown Header Bar */}
                  <TouchableOpacity
                    style={[
                      styles.dropdownHeader,
                      isClassDropdownOpen && styles.dropdownHeaderActive,
                    ]}
                    onPress={() =>
                      setIsClassDropdownOpen(!isClassDropdownOpen)
                    }
                    activeOpacity={0.8}
                  >
                    <Text
                      style={
                        selectedClasses.length > 0
                          ? styles.dropdownSelectedPlaceholder
                          : styles.dropdownPlaceholder
                      }
                    >
                      {selectedClasses.length > 0
                        ? `${selectedClasses.length} Class${
                            selectedClasses.length > 1 ? "es" : ""
                          } selected`
                        : "Select Class..."}
                    </Text>
                    <Ionicons
                      name={
                        isClassDropdownOpen
                          ? "chevron-up-outline"
                          : "chevron-down-outline"
                      }
                      size={18}
                      color="#7A7266"
                    />
                  </TouchableOpacity>

                  {/* Dropdown Expandable Content */}
                  {isClassDropdownOpen && (
                    <View style={styles.dropdownContentBox}>
                      {/* Search box inside dropdown */}
                      <View style={styles.dropdownSearchBox}>
                        <Ionicons
                          name="search-outline"
                          size={14}
                          color="#7A7266"
                        />
                        <TextInput
                          style={styles.dropdownSearchInput}
                          placeholder="Search Class..."
                          placeholderTextColor="#7A7266"
                          value={classSearchText}
                          onChangeText={setClassSearchText}
                          autoCapitalize="none"
                        />
                        {classSearchText.length > 0 && (
                          <TouchableOpacity
                            onPress={() => setClassSearchText("")}
                          >
                            <Ionicons
                              name="close"
                              size={14}
                              color="#7A7266"
                            />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Picklist items */}
                      <ScrollView
                        nestedScrollEnabled
                        style={styles.dropdownScrollView}
                        showsVerticalScrollIndicator
                      >
                        {filteredClassOptions.length > 0 ? (
                          filteredClassOptions.map((opt) => {
                            const isSelected =
                              selectedClasses.some(
                                (sc) =>
                                  sc.toLowerCase() ===
                                    opt.value.toLowerCase() ||
                                  sc.toLowerCase() ===
                                    opt.label.toLowerCase()
                              );
                            return (
                              <TouchableOpacity
                                key={`${opt.value}_${opt.label}`}
                                style={[
                                  styles.dropdownItemRow,
                                  isSelected && styles.dropdownItemRowSelected,
                                ]}
                                onPress={() => toggleClassSelection(opt.value)}
                                activeOpacity={0.7}
                              >
                                <View
                                  style={[
                                    styles.checkboxSquare,
                                    isSelected && styles.checkboxSquareSelected,
                                  ]}
                                >
                                  {isSelected && (
                                    <Ionicons
                                      name="checkmark"
                                      size={12}
                                      color="#FFF"
                                    />
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.dropdownItemLabel,
                                    isSelected &&
                                      styles.dropdownItemLabelSelected,
                                  ]}
                                >
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })
                        ) : (
                          <View style={styles.noOptionsBox}>
                            <Text style={styles.noOptionsText}>
                              No class values found
                            </Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* 4. CHANNEL FILTER */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>Channel</Text>
                    {selectedChannels.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setSelectedChannels([])}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      >
                        <Text style={styles.clearSectionText}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Selected Channel Chips */}
                  {selectedChannels.length > 0 && (
                    <View style={styles.selectedChipsContainer}>
                      {selectedChannels.map((chnVal) => (
                        <View key={chnVal} style={styles.selectedChip}>
                          <Text style={styles.selectedChipText}>
                            {getChannelLabel(chnVal)}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeChannelSelection(chnVal)}
                            style={styles.chipRemoveBtn}
                          >
                            <Ionicons
                              name="close-circle"
                              size={16}
                              color="#C9A24D"
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Dropdown Header Bar */}
                  <TouchableOpacity
                    style={[
                      styles.dropdownHeader,
                      isChannelDropdownOpen && styles.dropdownHeaderActive,
                    ]}
                    onPress={() =>
                      setIsChannelDropdownOpen(!isChannelDropdownOpen)
                    }
                    activeOpacity={0.8}
                  >
                    <Text
                      style={
                        selectedChannels.length > 0
                          ? styles.dropdownSelectedPlaceholder
                          : styles.dropdownPlaceholder
                      }
                    >
                      {selectedChannels.length > 0
                        ? `${selectedChannels.length} Channel${
                            selectedChannels.length > 1 ? "s" : ""
                          } selected`
                        : "Select Channel..."}
                    </Text>
                    <Ionicons
                      name={
                        isChannelDropdownOpen
                          ? "chevron-up-outline"
                          : "chevron-down-outline"
                      }
                      size={18}
                      color="#7A7266"
                    />
                  </TouchableOpacity>

                  {/* Dropdown Expandable Content */}
                  {isChannelDropdownOpen && (
                    <View style={styles.dropdownContentBox}>
                      {/* Search box inside dropdown */}
                      <View style={styles.dropdownSearchBox}>
                        <Ionicons
                          name="search-outline"
                          size={14}
                          color="#7A7266"
                        />
                        <TextInput
                          style={styles.dropdownSearchInput}
                          placeholder="Search Channel..."
                          placeholderTextColor="#7A7266"
                          value={channelSearchText}
                          onChangeText={setChannelSearchText}
                          autoCapitalize="none"
                        />
                        {channelSearchText.length > 0 && (
                          <TouchableOpacity
                            onPress={() => setChannelSearchText("")}
                          >
                            <Ionicons
                              name="close"
                              size={14}
                              color="#7A7266"
                            />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Picklist items */}
                      <ScrollView
                        nestedScrollEnabled
                        style={styles.dropdownScrollView}
                        showsVerticalScrollIndicator
                      >
                        {filteredChannelOptions.length > 0 ? (
                          filteredChannelOptions.map((opt) => {
                            const isSelected =
                              selectedChannels.some(
                                (sc) =>
                                  sc.toLowerCase() ===
                                    opt.value.toLowerCase() ||
                                  sc.toLowerCase() ===
                                    opt.label.toLowerCase()
                              );
                            return (
                              <TouchableOpacity
                                key={`${opt.value}_${opt.label}`}
                                style={[
                                  styles.dropdownItemRow,
                                  isSelected && styles.dropdownItemRowSelected,
                                ]}
                                onPress={() =>
                                  toggleChannelSelection(opt.value)
                                }
                                activeOpacity={0.7}
                              >
                                <View
                                  style={[
                                    styles.checkboxSquare,
                                    isSelected && styles.checkboxSquareSelected,
                                  ]}
                                >
                                  {isSelected && (
                                    <Ionicons
                                      name="checkmark"
                                      size={12}
                                      color="#FFF"
                                    />
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.dropdownItemLabel,
                                    isSelected &&
                                      styles.dropdownItemLabelSelected,
                                  ]}
                                >
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })
                        ) : (
                          <View style={styles.noOptionsBox}>
                            <Text style={styles.noOptionsText}>
                              No channel values found
                            </Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Modal Footer Actions */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.clearAllBtn}
                  onPress={handleClearAll}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.applyBtnWrap}
                  onPress={handleApply}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={Gradients.primary || ["#C9A24D", "#A67C2E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.applyGradient}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#FFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.applyBtnText}>Apply Filters</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default VisitFilterModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1EADB",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  activeBadgeHeader: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  activeBadgeHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A67C2E",
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
    marginBottom: 6,
  },
  clearSectionText: {
    fontSize: 12,
    color: "#A67C2E",
    fontWeight: "600",
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBF8F1",
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#1F1D1A",
    paddingVertical: 0,
  },
  clearInputIcon: {
    padding: 4,
  },
  distanceOptionsRow: {
    flexDirection: "column",
    gap: 8,
  },
  distanceOptionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBF8F1",
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  distanceOptionChipActive: {
    backgroundColor: "#C9A24D",
    borderColor: "#C9A24D",
  },
  distanceOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F1D1A",
    flex: 1,
  },
  distanceOptionTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  selectedChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  selectedChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9F1239",
    marginRight: 4,
  },
  chipRemoveBtn: {
    padding: 1,
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FBF8F1",
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
  },
  dropdownHeaderActive: {
    borderColor: "#C9A24D",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownPlaceholder: {
    fontSize: 13,
    color: "#7A7266",
  },
  dropdownSelectedPlaceholder: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F1D1A",
  },
  dropdownContentBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#D9D2C3",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    padding: 8,
    maxHeight: 180,
  },
  dropdownSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1EADB",
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 32,
    marginBottom: 6,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 12,
    color: "#1F1D1A",
    paddingVertical: 0,
    marginLeft: 4,
  },
  dropdownScrollView: {
    maxHeight: 130,
  },
  dropdownItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  dropdownItemRowSelected: {
    backgroundColor: "#FFF1F2",
  },
  checkboxSquare: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#7A7266",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "#FFF",
  },
  checkboxSquareSelected: {
    backgroundColor: "#C9A24D",
    borderColor: "#C9A24D",
  },
  dropdownItemLabel: {
    fontSize: 13,
    color: "#1F1D1A",
    flex: 1,
  },
  dropdownItemLabelSelected: {
    color: "#A67C2E",
    fontWeight: "700",
  },
  noOptionsBox: {
    paddingVertical: 12,
    alignItems: "center",
  },
  noOptionsText: {
    fontSize: 12,
    color: "#7A7266",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1EADB",
    gap: 12,
  },
  clearAllBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#F1EADB",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 90,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7A7266",
  },
  applyBtnWrap: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  applyGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
